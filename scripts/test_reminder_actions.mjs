#!/usr/bin/env node
/* Exercise the evening reminder and its occurrence-safe actions in the HA lab. */

const baseUrl = (process.env.HA_DEV_URL || "http://127.0.0.1:18124").replace(/\/$/, "");
const clientId = `${baseUrl}/`;
const statusEntity = "sensor.clock_advanced_lab_status";
const oneTimeEntity = "datetime.clock_advanced_lab_one_time_next_alarm";
const recalculateEntity = "button.clock_advanced_lab_recalculate_schedule";
const managedSwitches = [
  "switch.clock_advanced_lab_enabled",
  "switch.clock_advanced_lab_skip_next_alarm",
  "switch.clock_advanced_lab_vacation_mode",
];

async function request(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`${options.method || "GET"} ${url}: ${response.status}`);
  const body = await response.text();
  return body ? JSON.parse(body) : null;
}

const login = await request(`${baseUrl}/auth/login_flow`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    client_id: clientId,
    handler: ["trusted_networks", null],
    redirect_uri: clientId,
  }),
});
const tokenResponse = await fetch(`${baseUrl}/auth/token`, {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    grant_type: "authorization_code",
    code: login.result,
    client_id: clientId,
  }),
});
const token = await tokenResponse.json();
const headers = {
  authorization: `Bearer ${token.access_token}`,
  "content-type": "application/json",
};

const socket = new WebSocket(`${baseUrl.replace(/^http/, "ws")}/api/websocket`);
const inbox = [];
const waiters = [];
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  const index = waiters.findIndex((waiter) => waiter.predicate(message));
  if (index >= 0) waiters.splice(index, 1)[0].resolve(message);
  else inbox.push(message);
});
const receive = (predicate) => {
  const index = inbox.findIndex(predicate);
  if (index >= 0) return Promise.resolve(inbox.splice(index, 1)[0]);
  return new Promise((resolve) => waiters.push({ predicate, resolve }));
};
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});
await receive((message) => message.type === "auth_required");
socket.send(JSON.stringify({ type: "auth", access_token: token.access_token }));
await receive((message) => message.type === "auth_ok");

let id = 0;
async function callWS(payload) {
  const commandId = ++id;
  socket.send(JSON.stringify({ id: commandId, ...payload }));
  const response = await receive((message) => message.id === commandId);
  if (!response.success) throw new Error(`${payload.type}: ${response.error?.message || "failed"}`);
  return response.result;
}
const state = (entityId) => request(`${baseUrl}/api/states/${entityId}`, { headers });
const service = (domain, name, data) => request(`${baseUrl}/api/services/${domain}/${name}`, {
  method: "POST", headers, body: JSON.stringify(data),
});
const pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function reminderStep(entryId) {
  const flow = await request(`${baseUrl}/api/config/config_entries/options/flow`, {
    method: "POST", headers, body: JSON.stringify({ handler: entryId }),
  });
  return request(`${baseUrl}/api/config/config_entries/options/flow/${flow.flow_id}`, {
    method: "POST", headers, body: JSON.stringify({ next_step_id: "reminder" }),
  });
}

async function saveReminder(step, values) {
  const result = await request(
    `${baseUrl}/api/config/config_entries/options/flow/${step.flow_id}`,
    { method: "POST", headers, body: JSON.stringify(values) },
  );
  if (result.type !== "create_entry") throw new Error(`Reminder options were not saved: ${result.type}`);
}

async function waitForNext(predicate, timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const current = await state(statusEntity);
    if (predicate(current.attributes.next_alarm, current)) return current;
    await pause(200);
  }
  const current = await state(statusEntity);
  throw new Error(`Next alarm did not reach the expected value: ${current.attributes.next_alarm}`);
}

const entities = await callWS({ type: "config/entity_registry/list" });
const statusRegistry = entities.find((item) => item.entity_id === statusEntity);
if (!statusRegistry?.config_entry_id) throw new Error(`No config entry for ${statusEntity}`);
const entryId = statusRegistry.config_entry_id;
const notificationId = `clock_advanced_${entryId}_next_alarm`;
const originalSwitches = Object.fromEntries(
  await Promise.all(managedSwitches.map(async (entityId) => [entityId, (await state(entityId)).state])),
);
const initialStep = await reminderStep(entryId);
const originalReminder = Object.fromEntries(initialStep.data_schema.flatMap((field) => {
  const value = field.description?.suggested_value ?? field.suggested_value ?? field.default;
  return value === undefined ? [] : [[field.name, value]];
}));

try {
  await service("switch", "turn_on", { entity_id: managedSwitches[0] });
  await service("switch", "turn_off", { entity_id: managedSwitches.slice(1) });

  const occurrence = new Date();
  occurrence.setDate(occurrence.getDate() + 1);
  occurrence.setHours(7, 17, occurrence.getSeconds(), 0);
  await service("datetime", "set_value", {
    entity_id: oneTimeEntity,
    datetime: occurrence.toISOString(),
  });
  const scheduled = await waitForNext((next) => Boolean(next));
  const originalAlarm = new Date(scheduled.attributes.next_alarm);

  const reminderClock = new Date();
  reminderClock.setMinutes(reminderClock.getMinutes() - 1);
  const reminderTime = [
    String(reminderClock.getHours()).padStart(2, "0"),
    String(reminderClock.getMinutes()).padStart(2, "0"),
    "00",
  ].join(":");
  await saveReminder(await reminderStep(entryId), {
    next_alarm_reminder_enabled: true,
    next_alarm_reminder_time: reminderTime,
    dashboard_path: "/lovelace/clock-lab",
  });

  let notification;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const notifications = await callWS({ type: "persistent_notification/get" });
    notification = notifications.find((item) => item.notification_id === notificationId);
    if (notification) break;
    await pause(200);
  }
  if (!notification) throw new Error("Evening reminder was not delivered");
  if (!notification.message.includes("/lovelace/clock-lab")) {
    throw new Error(`Reminder has no Clock link: ${notification.message}`);
  }

  const tokenSeconds = Math.trunc(originalAlarm.getTime() / 1000);
  await request(`${baseUrl}/api/events/mobile_app_notification_action`, {
    method: "POST", headers,
    body: JSON.stringify({ action: `CLOCK_ADVANCED:${entryId}:SKIP:${tokenSeconds + 1}` }),
  });
  await pause(400);
  const afterStale = new Date((await state(statusEntity)).attributes.next_alarm);
  if (afterStale.getTime() !== originalAlarm.getTime()) {
    throw new Error("A stale notification action changed the current alarm");
  }

  const replacement = new Date(originalAlarm.getTime() + 5 * 60 * 1000);
  const reply = `${String(replacement.getHours()).padStart(2, "0")}:${String(replacement.getMinutes()).padStart(2, "0")}`;
  await request(`${baseUrl}/api/events/mobile_app_notification_action`, {
    method: "POST", headers,
    body: JSON.stringify({
      action: `CLOCK_ADVANCED:${entryId}:CHANGE:${tokenSeconds}`,
      reply_text: reply,
    }),
  });
  const changed = await waitForNext((next) => {
    const value = new Date(next);
    return value.getHours() === replacement.getHours() && value.getMinutes() === replacement.getMinutes();
  });
  if (changed.attributes.schedule?.some?.((item) => item.time === reply)) {
    throw new Error("The one-time notification action unexpectedly rewrote the weekly schedule");
  }

  await service("button", "press", { entity_id: recalculateEntity });
  await waitForNext((next) => Boolean(next) && new Date(next).getTime() !== new Date(changed.attributes.next_alarm).getTime());
  console.log("Clock Advanced evening reminder and occurrence-safe actions: PASS");
} finally {
  await service("button", "press", { entity_id: recalculateEntity });
  if (Object.keys(originalReminder).length) {
    await saveReminder(await reminderStep(entryId), originalReminder);
  }
  for (const [entityId, original] of Object.entries(originalSwitches)) {
    await service("switch", original === "on" ? "turn_on" : "turn_off", { entity_id: entityId });
  }
  await service("persistent_notification", "dismiss", { notification_id: notificationId });
  socket.close();
}
