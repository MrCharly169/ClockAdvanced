#!/usr/bin/env node
/* Exercise a real editable Schedule helper edge against the disposable HA lab. */

const baseUrl = (process.env.HA_DEV_URL || "http://127.0.0.1:18124").replace(/\/$/, "");
const clientId = `${baseUrl}/`;

async function request(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`${options.method || "GET"} ${url}: ${response.status}`);
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

const login = await request(`${baseUrl}/auth/login_flow`, {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ client_id: clientId, handler: ["trusted_networks", null], redirect_uri: clientId }),
});
const tokenResponse = await fetch(`${baseUrl}/auth/token`, {
  method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ grant_type: "authorization_code", code: login.result, client_id: clientId }),
});
const token = await tokenResponse.json();
const headers = { authorization: `Bearer ${token.access_token}`, "content-type": "application/json" };

const socket = new WebSocket(`${baseUrl.replace(/^http/, "ws")}/api/websocket`);
const inbox = [];
const waiters = [];
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  const index = waiters.findIndex((waiter) => waiter.predicate(message));
  if (index >= 0) waiters.splice(index, 1)[0].resolve(message); else inbox.push(message);
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
async function state(entityId) {
  return request(`${baseUrl}/api/states/${entityId}`, { headers });
}
async function service(domain, serviceName, entityId) {
  await request(`${baseUrl}/api/services/${domain}/${serviceName}`, {
    method: "POST", headers, body: JSON.stringify({ entity_id: entityId }),
  });
}
async function waitFor(entityId, expected, timeoutMs = 6000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if ((await state(entityId)).state === expected) return;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`${entityId} did not reach ${expected}; got ${(await state(entityId)).state}`);
}

const guardIds = ["input_boolean.vacation_mode", "input_boolean.quiet_mode", "input_boolean.allow_alarm"];
const guardStates = Object.fromEntries(await Promise.all(guardIds.map(async (entityId) => [entityId, (await state(entityId)).state])));
const schedule = (await callWS({ type: "schedule/list" })).find((item) => item.id === "clock_advanced_lab");
if (!schedule) throw new Error("Editable schedule.clock_advanced_lab was not found");
const weekdays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const weekday = weekdays[(new Date().getDay() + 6) % 7];

try {
  await service("input_boolean", "turn_off", ["input_boolean.vacation_mode", "input_boolean.quiet_mode"]);
  await service("input_boolean", "turn_on", "input_boolean.allow_alarm");
  await service("switch", "turn_on", "switch.schedule_helper_lab_enabled");
  await service("switch", "turn_off", "switch.schedule_helper_lab_skip_next_alarm");
  await callWS({
    type: "schedule/update", schedule_id: schedule.id, name: schedule.name,
    icon: schedule.icon || "mdi:calendar-clock", ...Object.fromEntries(weekdays.map((day) => [day, day === weekday ? [{ from: "00:00:00", to: "23:59:59" }] : []])),
  });
  await waitFor("schedule.clock_advanced_lab", "on");
  await waitFor("sensor.schedule_helper_lab_status", "ringing");
  await service("button", "press", "button.schedule_helper_lab_dismiss_alarm");
  await waitFor("sensor.schedule_helper_lab_status", "dismissed");
  console.log("Clock Advanced native Schedule helper lifecycle: PASS");
} finally {
  await callWS({
    type: "schedule/update", schedule_id: schedule.id, name: schedule.name,
    icon: schedule.icon || "mdi:calendar-clock", ...Object.fromEntries(weekdays.map((day) => [day, schedule[day] || []])),
  });
  for (const [entityId, original] of Object.entries(guardStates)) {
    await service("input_boolean", original === "on" ? "turn_on" : "turn_off", entityId);
  }
  socket.close();
}
