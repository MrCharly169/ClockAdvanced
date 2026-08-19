#!/usr/bin/env node
/* Verify manual and motion-confirmed completion run Dismiss followed by Cleanup. */

const baseUrl = (process.env.HA_DEV_URL || "http://127.0.0.1:18124").replace(/\/$/, "");
const clientId = `${baseUrl}/`;
const statusEntity = "sensor.clock_advanced_lab_status";
const alarmEntity = "datetime.clock_advanced_lab_one_time_next_alarm";
const dismissEntity = "button.clock_advanced_lab_dismiss_alarm";
const confirmationEntity = "input_boolean.wake_confirmation";
const dismissProbe = "input_boolean.dismiss_probe";
const cleanupProbe = "input_boolean.cleanup_probe";

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

let commandId = 0;
async function callWS(payload) {
  const id = ++commandId;
  socket.send(JSON.stringify({ id, ...payload }));
  const response = await receive((message) => message.id === id);
  if (!response.success) throw new Error(`${payload.type}: ${response.error?.message || "failed"}`);
  return response.result;
}

const pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const state = (entityId) => request(`${baseUrl}/api/states/${entityId}`, { headers });
const service = (domain, name, data) => request(`${baseUrl}/api/services/${domain}/${name}`, {
  method: "POST",
  headers,
  body: JSON.stringify(data),
});

async function waitFor(entityId, expected, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const current = await state(entityId);
    if (current.state === expected) return current;
    await pause(150);
  }
  throw new Error(`${entityId} did not reach ${expected}; got ${(await state(entityId)).state}`);
}

async function optionsStep(entryId, nextStepId) {
  const flow = await request(`${baseUrl}/api/config/config_entries/options/flow`, {
    method: "POST",
    headers,
    body: JSON.stringify({ handler: entryId }),
  });
  return request(`${baseUrl}/api/config/config_entries/options/flow/${flow.flow_id}`, {
    method: "POST",
    headers,
    body: JSON.stringify({ next_step_id: nextStepId }),
  });
}

async function saveOptions(step, values) {
  const result = await request(
    `${baseUrl}/api/config/config_entries/options/flow/${step.flow_id}`,
    { method: "POST", headers, body: JSON.stringify(values) },
  );
  if (result.type !== "create_entry") {
    throw new Error(`Options were not saved: ${result.type}`);
  }
}

async function resetProbes() {
  await service("input_boolean", "turn_off", {
    entity_id: [dismissProbe, cleanupProbe, confirmationEntity],
  });
}

async function armImmediateAlarm() {
  const alarm = new Date(Date.now() + 2500);
  await service("datetime", "set_value", {
    entity_id: alarmEntity,
    datetime: alarm.toISOString(),
  });
  await waitFor(statusEntity, "ringing");
  await waitFor(dismissProbe, "on");
}

async function assertCompletion(label) {
  await waitFor(statusEntity, "dismissed");
  await waitFor(dismissProbe, "on");
  await waitFor(cleanupProbe, "on");
  if ((await state(statusEntity)).attributes.last_reason !== label) {
    throw new Error(`Unexpected completion reason for ${label}`);
  }
}

const entities = await callWS({ type: "config/entity_registry/list" });
const registry = entities.find((item) => item.entity_id === statusEntity);
if (!registry?.config_entry_id) throw new Error(`No config entry for ${statusEntity}`);
const entryId = registry.config_entry_id;
const finishStep = await optionsStep(entryId, "finish_actions");
const startStep = await optionsStep(entryId, "start_actions");
const valuesFrom = (step) => Object.fromEntries(step.data_schema.map((field) => [
  field.name,
  field.description?.suggested_value ?? field.suggested_value ?? field.default ?? [],
]));
const originalFinish = valuesFrom(finishStep);
const originalStart = valuesFrom(startStep);
const turnOn = (entityId) => [{
  action: "input_boolean.turn_on",
  target: { entity_id: entityId },
}];

try {
  await saveOptions(startStep, {
    actions_prepare: [],
    actions_start: [{
      if: [{
        condition: "template",
        value_template: "{{ clock_advanced.trigger_kind != 'snooze' }}",
      }],
      then: turnOn(dismissProbe),
    }],
  });
  await saveOptions(await optionsStep(entryId, "finish_actions"), {
    actions_dismiss: turnOn(dismissProbe),
    actions_timeout: [],
    actions_cleanup: turnOn(cleanupProbe),
  });
  await pause(1000);

  await resetProbes();
  await armImmediateAlarm();
  await service("button", "press", { entity_id: dismissEntity });
  await assertCompletion("manual");

  await resetProbes();
  await armImmediateAlarm();
  await service("input_boolean", "turn_on", { entity_id: confirmationEntity });
  await assertCompletion("confirmation");

  console.log("Clock Advanced manual and confirmation terminal actions: PASS");
} finally {
  await resetProbes();
  await service("button", "press", { entity_id: dismissEntity });
  await saveOptions(await optionsStep(entryId, "start_actions"), originalStart);
  await saveOptions(await optionsStep(entryId, "finish_actions"), originalFinish);
  socket.close();
}
