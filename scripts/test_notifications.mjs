#!/usr/bin/env node
/* Exercise configured notification reasons against the live HA lab. */

const baseUrl = (process.env.HA_DEV_URL || "http://127.0.0.1:18124").replace(/\/$/, "");
const clientId = `${baseUrl}/`;
const statusEntity = "sensor.schedule_helper_lab_status";
const allowEntity = "input_boolean.allow_alarm";

async function request(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`${options.method || "GET"} ${url}: ${response.status}`);
  return response.json();
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

async function optionsStep(entryId) {
  const flow = await request(`${baseUrl}/api/config/config_entries/options/flow`, {
    method: "POST",
    headers,
    body: JSON.stringify({ handler: entryId }),
  });
  const step = await request(
    `${baseUrl}/api/config/config_entries/options/flow/${flow.flow_id}`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ next_step_id: "notifications" }),
    },
  );
  return step;
}

async function saveOptions(step, values) {
  const result = await request(
    `${baseUrl}/api/config/config_entries/options/flow/${step.flow_id}`,
    { method: "POST", headers, body: JSON.stringify(values) },
  );
  if (result.type !== "create_entry") {
    throw new Error(`Notification options were not saved: ${result.type}`);
  }
}

async function setBoolean(entityId, enabled) {
  const service = enabled ? "turn_on" : "turn_off";
  await request(`${baseUrl}/api/services/input_boolean/${service}`, {
    method: "POST",
    headers,
    body: JSON.stringify({ entity_id: entityId }),
  });
}

const entities = await callWS({ type: "config/entity_registry/list" });
const statusRegistry = entities.find((item) => item.entity_id === statusEntity);
if (!statusRegistry?.config_entry_id) throw new Error(`No config entry for ${statusEntity}`);
const entryId = statusRegistry.config_entry_id;
const allowState = await request(`${baseUrl}/api/states/${allowEntity}`, { headers });
const notificationId = `clock_advanced_${entryId}_blocked`;

let original;
try {
  const step = await optionsStep(entryId);
  original = Object.fromEntries(step.data_schema.map((field) => [
    field.name,
    field.suggested_value ?? field.default ?? (
      field.name === "notifications_enabled" ? false : []
    ),
  ]));
  await saveOptions(step, {
    notifications_enabled: true,
    notification_targets: [],
    notification_events: ["blocked"],
  });
  await new Promise((resolve) => setTimeout(resolve, 1500));
  await setBoolean(allowEntity, true);
  await new Promise((resolve) => setTimeout(resolve, 400));
  await setBoolean(allowEntity, false);

  let notification;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const notifications = await callWS({ type: "persistent_notification/get" });
    notification = notifications.find((item) => item.notification_id === notificationId);
    if (notification) break;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (!notification) throw new Error("Blocked notification was not created");
  if (!/(Reason|Grund):/.test(notification.message)) {
    throw new Error(`Notification does not explain its reason: ${notification.message}`);
  }
  if (!/(allow|Freigabe|start condition|Startbedingung)/i.test(notification.message)) {
    throw new Error(`Notification did not identify the failed condition: ${notification.message}`);
  }
  console.log("Clock Advanced notification delivery and reason: PASS");
} finally {
  await setBoolean(allowEntity, allowState.state === "on");
  if (original) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    const restoreStep = await optionsStep(entryId);
    await saveOptions(restoreStep, original);
  }
  await request(`${baseUrl}/api/services/persistent_notification/dismiss`, {
    method: "POST",
    headers,
    body: JSON.stringify({ notification_id: notificationId }),
  });
  socket.close();
}
