#!/usr/bin/env node
/* Verify the real Clock Advanced options entry point against the HA lab. */

const baseUrl = (process.env.HA_DEV_URL || "http://127.0.0.1:18124").replace(/\/$/, "");
const clientId = `${baseUrl}/`;

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
  if (!response.success) {
    throw new Error(`${payload.type}: ${response.error?.message || "failed"}`);
  }
  return response.result;
}

try {
  const entries = await callWS({ type: "config_entries/get" });
  const entry = entries.find((item) => item.domain === "clock_advanced");
  if (!entry) throw new Error("No Clock Advanced config entry was found");

  const setupFlow = await request(`${baseUrl}/api/config/config_entries/flow`, {
    method: "POST",
    headers,
    body: JSON.stringify({ handler: "clock_advanced" }),
  });
  if (setupFlow.type !== "form" || setupFlow.step_id !== "user") {
    throw new Error(`Expected the setup wizard, got ${setupFlow.type}:${setupFlow.step_id}`);
  }

  const submitFlow = (flow, values) => request(
    `${baseUrl}/api/config/config_entries/flow/${flow.flow_id}`,
    { method: "POST", headers, body: JSON.stringify(values) },
  );
  const defaults = (flow) => Object.fromEntries(
    flow.data_schema
      .filter((field) => field.default !== undefined)
      .map((field) => [field.name, field.default]),
  );
  let wizard = await submitFlow(setupFlow, { name: "Notification wizard test" });
  if (wizard.step_id !== "source") throw new Error(`Expected source, got ${wizard.step_id}`);
  wizard = await submitFlow(wizard, { schedule_source: "weekly" });
  if (wizard.step_id !== "schedule") throw new Error(`Expected schedule, got ${wizard.step_id}`);
  const wizardScheduleFields = wizard.data_schema.map((field) => field.name);
  for (const field of ["holiday_time", "holiday_weekend_time"]) {
    if (!wizardScheduleFields.includes(field)) {
      throw new Error(`The setup schedule is missing ${field}`);
    }
  }
  wizard = await submitFlow(wizard, defaults(wizard));
  if (wizard.step_id !== "guards") throw new Error(`Expected guards, got ${wizard.step_id}`);
  wizard = await submitFlow(wizard, defaults(wizard));
  if (wizard.step_id !== "start_actions") throw new Error(`Expected start actions, got ${wizard.step_id}`);
  wizard = await submitFlow(wizard, defaults(wizard));
  if (wizard.step_id !== "response") throw new Error(`Expected response, got ${wizard.step_id}`);
  wizard = await submitFlow(wizard, defaults(wizard));
  if (wizard.step_id !== "reminder") throw new Error(`Expected reminder, got ${wizard.step_id}`);
  wizard = await submitFlow(wizard, {
    next_alarm_reminder_enabled: true,
    next_alarm_reminder_time: "19:00:00",
    dashboard_path: "/lovelace/clock-lab",
  });
  if (wizard.step_id !== "notifications") throw new Error(`Expected notifications, got ${wizard.step_id}`);
  wizard = await submitFlow(wizard, {
    notifications_enabled: true,
    notification_targets: [],
    notification_events: ["start", "blocked"],
  });
  if (wizard.step_id !== "finish_actions") throw new Error(`Expected finish actions, got ${wizard.step_id}`);
  wizard = await submitFlow(wizard, defaults(wizard));
  if (wizard.step_id !== "review" || wizard.last_step !== true) {
    throw new Error(`Expected final review, got ${wizard.step_id}`);
  }
  if (!wizard.description_placeholders?.notifications?.includes("2")) {
    throw new Error("The final review does not summarize configured notifications");
  }
  if (!wizard.description_placeholders?.reminder?.includes("19:00")) {
    throw new Error("The final review does not summarize the evening reminder");
  }

  const flow = await request(`${baseUrl}/api/config/config_entries/options/flow`, {
    method: "POST",
    headers,
    body: JSON.stringify({ handler: entry.entry_id }),
  });
  const expected = [
    "source", "schedule", "guards", "start_actions", "response",
    "reminder", "notifications", "finish_actions",
  ];
  if (flow.type !== "menu" || flow.step_id !== "init") {
    throw new Error(`Expected the options menu, got ${flow.type}:${flow.step_id}`);
  }
  if (JSON.stringify(flow.menu_options) !== JSON.stringify(expected)) {
    throw new Error(`Unexpected options sections: ${JSON.stringify(flow.menu_options)}`);
  }

  const sourceStep = await request(
    `${baseUrl}/api/config/config_entries/options/flow/${flow.flow_id}`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ next_step_id: "source" }),
    },
  );
  const sourceFields = sourceStep.data_schema.map((field) => field.name);
  for (const field of ["name", "schedule_source", "schedule_entity"]) {
    if (!sourceFields.includes(field)) {
      throw new Error(`The general options section is missing ${field}`);
    }
  }

  const scheduleFlow = await request(`${baseUrl}/api/config/config_entries/options/flow`, {
    method: "POST",
    headers,
    body: JSON.stringify({ handler: entry.entry_id }),
  });
  const scheduleStep = await request(
    `${baseUrl}/api/config/config_entries/options/flow/${scheduleFlow.flow_id}`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ next_step_id: "schedule" }),
    },
  );
  const scheduleFields = scheduleStep.data_schema.map((field) => field.name);
  for (const field of ["holiday_time", "holiday_weekend_time"]) {
    if (!scheduleFields.includes(field)) {
      throw new Error(`The schedule options section is missing ${field}`);
    }
  }

  const notificationFlow = await request(`${baseUrl}/api/config/config_entries/options/flow`, {
    method: "POST",
    headers,
    body: JSON.stringify({ handler: entry.entry_id }),
  });
  const notificationStep = await request(
    `${baseUrl}/api/config/config_entries/options/flow/${notificationFlow.flow_id}`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ next_step_id: "notifications" }),
    },
  );
  const notificationFields = notificationStep.data_schema.map((field) => field.name);
  for (const field of ["notifications_enabled", "notification_targets", "notification_events"]) {
    if (!notificationFields.includes(field)) {
      throw new Error(`The notification options section is missing ${field}`);
    }
  }

  const reminderFlow = await request(`${baseUrl}/api/config/config_entries/options/flow`, {
    method: "POST",
    headers,
    body: JSON.stringify({ handler: entry.entry_id }),
  });
  const reminderStep = await request(
    `${baseUrl}/api/config/config_entries/options/flow/${reminderFlow.flow_id}`,
    { method: "POST", headers, body: JSON.stringify({ next_step_id: "reminder" }) },
  );
  const reminderFields = reminderStep.data_schema.map((field) => field.name);
  for (const field of ["next_alarm_reminder_enabled", "next_alarm_reminder_time", "dashboard_path"]) {
    if (!reminderFields.includes(field)) throw new Error(`Reminder section is missing ${field}`);
  }
  console.log("Clock Advanced setup wizard and integration options flow: PASS");
} finally {
  socket.close();
}
