#!/usr/bin/env node
/* Seed the disposable HA lab with UI-managed resources, dashboard, and Schedule helper. */

import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const baseUrl = (process.env.HA_DEV_URL || "http://127.0.0.1:18124").replace(/\/$/, "");
const clientId = `${baseUrl}/`;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function jsonFetch(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`${options?.method || "GET"} ${url}: ${response.status}`);
  return response.json();
}

let login;
for (let attempt = 0; attempt < 40; attempt += 1) {
  try {
    login = await jsonFetch(`${baseUrl}/auth/login_flow`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        handler: ["trusted_networks", null],
        redirect_uri: clientId,
      }),
    });
    break;
  } catch (error) {
    if (attempt === 39) throw error;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}
if (login.type !== "create_entry") throw new Error("Trusted-network lab login is not ready");

const tokenResponse = await fetch(`${baseUrl}/auth/token`, {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    grant_type: "authorization_code",
    code: login.result,
    client_id: clientId,
  }),
});
if (!tokenResponse.ok) throw new Error(`Token request failed: ${tokenResponse.status}`);
const token = await tokenResponse.json();

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
const auth = await receive((message) => message.type === "auth_ok" || message.type === "auth_invalid");
if (auth.type !== "auth_ok") throw new Error("Home Assistant WebSocket authentication failed");

let commandId = 0;
async function callWS(payload) {
  const id = ++commandId;
  socket.send(JSON.stringify({ id, ...payload }));
  const response = await receive((message) => message.id === id);
  if (!response.success) throw new Error(`${payload.type}: ${response.error?.message || "failed"}`);
  return response.result;
}

const resourceUrl = "/clock_advanced/clock-advanced-card.js";
const resources = await callWS({ type: "lovelace/resources/list" });
if (!resources.some((resource) => resource.url === resourceUrl)) {
  await callWS({ type: "lovelace/resources/create", res_type: "module", url: resourceUrl });
}

const weekdays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const scheduleData = Object.fromEntries(weekdays.map((day) => [
  day,
  [{ from: day === "saturday" || day === "sunday" ? "08:00:00" : "06:00:00", to: day === "saturday" || day === "sunday" ? "08:01:00" : "06:01:00" }],
]));
const schedules = await callWS({ type: "schedule/list" });
const existingSchedule = schedules.find((schedule) => schedule.id === "clock_advanced_lab");
if (existingSchedule) {
  await callWS({
    type: "schedule/update",
    schedule_id: existingSchedule.id,
    name: "Clock Advanced Lab",
    icon: "mdi:calendar-clock",
    ...scheduleData,
  });
} else {
  await callWS({
    type: "schedule/create",
    name: "Clock Advanced Lab",
    icon: "mdi:calendar-clock",
    ...scheduleData,
  });
}

const dashboard = JSON.parse(await readFile(path.join(root, "dev", "lovelace-storage.json"), "utf8"));
await callWS({ type: "lovelace/config/save", config: dashboard });

let onboardingNotification;
for (let attempt = 0; attempt < 20; attempt += 1) {
  const notifications = await callWS({ type: "persistent_notification/get" });
  onboardingNotification = notifications.find((notification) =>
    notification.notification_id.startsWith("clock_advanced_card_")
    && notification.message.includes("custom:clock-advanced-card")
    && notification.message.includes("custom:clock-advanced-badge")
    && notification.message.includes("mode: easy")
  );
  if (onboardingNotification) break;
  await new Promise((resolve) => setTimeout(resolve, 250));
}
if (!onboardingNotification) {
  const storageDirectory = path.join(root, ".dev", "ha-config", ".storage");
  const storageFiles = (await readdir(storageDirectory))
    .filter((name) => name.startsWith("clock_advanced."));
  const alreadySent = (await Promise.all(storageFiles.map(async (name) => {
    const stored = JSON.parse(await readFile(path.join(storageDirectory, name), "utf8"));
    return stored.data?.card_notification_sent === true;
  }))).some(Boolean);
  if (!alreadySent) {
    throw new Error("Clock Advanced Card and Badge onboarding notification is missing");
  }
}
socket.close();

console.log("Clock Advanced HA lab seed: PASS");
console.log(`  Editable dashboard: ${baseUrl}/lovelace/clock-lab`);
console.log("  Editable Schedule helper: schedule.clock_advanced_lab");
console.log("  Card and Badge onboarding notification: PASS");
