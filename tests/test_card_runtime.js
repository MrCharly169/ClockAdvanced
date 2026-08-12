const fs = require("fs");
const path = require("path");

class FakeShadow {
  constructor() { this._innerHTML = ""; this._badge = null; this.writeCount = 0; }
  set innerHTML(value) {
    this._innerHTML = String(value || "");
    this._badge = this._innerHTML.includes("<ha-badge") ? new FakeElement() : null;
    this.writeCount += 1;
  }
  get innerHTML() { return this._innerHTML; }
  addEventListener() {}
  querySelector(selector) { return selector === "ha-badge" ? this._badge : null; }
  querySelectorAll() { return []; }
}
class FakeElement {
  constructor() { this.shadowRoot = null; this.listeners = new Map(); this.dispatchedEvents = []; }
  attachShadow() { this.shadowRoot = new FakeShadow(); return this.shadowRoot; }
  addEventListener(type, handler) { this.listeners.set(type, handler); }
  dispatchEvent(event) { this.dispatchedEvents.push(event); return true; }
}
global.HTMLElement = FakeElement;
global.Event = class {
  constructor(type, options = {}) { this.type = type; Object.assign(this, options); }
  stopPropagation() {}
  preventDefault() {}
};
global.CustomEvent = class extends global.Event {
  constructor(type, options = {}) { super(type, options); this.detail = options.detail; }
};
global.navigator = { language: "en" };
const registry = new Map();
global.customElements = {
  define(name, ctor) { registry.set(name, ctor); },
  get(name) { return registry.get(name); },
};
global.window = { customCards: [], setInterval, clearInterval };
global.document = { createElement(name) { const Ctor = registry.get(name); return Ctor ? new Ctor() : new FakeElement(); } };

(async () => {
  const sourcePath = path.join(__dirname, "..", "custom_components", "clock_advanced", "frontend", "clock-advanced-card.js");
  const source = fs.readFileSync(sourcePath, "utf8");
  await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
  const Card = registry.get("clock-advanced-card");
  if (!Card) throw new Error("Card was not registered");
  if (!registry.get("clock-advanced-card-editor")) throw new Error("Editor was not registered");
  const Badge = registry.get("clock-advanced-badge");
  if (!Badge || !registry.get("clock-advanced-badge-editor")) throw new Error("Badge was not registered");
  const hass = { states: { "sensor.clock_status": { state: "scheduled", last_updated: "2031-06-20T05:00:00+00:00", attributes: { card_contract: 1, card_type: "custom:clock-advanced-card", controls: {}, schedule: [], name: "Bedroom clock", next_alarm: "2031-06-21T06:00:00+00:00" } } }, language: "en", callService: async () => {} };
  const stub = Card.getStubConfig(hass);
  if (stub.entity !== "sensor.clock_status") throw new Error("Stub did not discover the status entity");
  if (stub.mode !== "easy") throw new Error("Easy is not the default Card mode");
  const instance = new Card();
  instance.setConfig(stub);
  instance.hass = hass;
  if (instance.getCardSize() !== 7 || instance.getGridOptions().columns !== 12 || instance.getGridOptions().rows !== 7) throw new Error("Sizing API is invalid");
  instance.setConfig({ ...stub, mode: "advanced" });
  instance.hass = hass;
  if (instance.getCardSize() !== 14 || instance.getGridOptions().rows !== 14 || instance.getGridOptions().min_rows !== 12) throw new Error("Advanced sizing does not reserve its rendered height");
  const cardRenderCount = instance.shadowRoot.writeCount;
  instance.hass = { ...hass, states: { ...hass.states, "sensor.clock_status": {
    ...hass.states["sensor.clock_status"], last_updated: "2031-06-20T05:00:01+00:00",
  } } };
  if (instance.shadowRoot.writeCount !== cardRenderCount) throw new Error("Card rerendered for an irrelevant last_updated-only change");
  instance.hass = { ...hass, states: { ...hass.states, "sensor.clock_status": {
    ...hass.states["sensor.clock_status"], attributes: {
      ...hass.states["sensor.clock_status"].attributes, next_alarm: "2031-06-21T06:05:00+00:00",
    },
  } } };
  if (instance.shadowRoot.writeCount !== cardRenderCount + 1) throw new Error("Card ignored a visible alarm-time change");
  if (!Card.getConfigElement()) throw new Error("Editor API failed");
  const registration = window.customCards.find((item) => item.type === "clock-advanced-card");
  if (!registration) throw new Error("Card picker registration missing");
  const suggestion = registration.getEntitySuggestion(hass, "sensor.clock_status");
  if (suggestion?.config?.type !== "custom:clock-advanced-card") throw new Error("Entity suggestion failed");
  if (registration.getEntitySuggestion(hass, "sensor.other") !== null) throw new Error("Unsupported entity was suggested");
  const badgeStub = Badge.getStubConfig(hass);
  if (badgeStub.entity !== "sensor.clock_status") throw new Error("Badge stub did not discover the status entity");
  const badge = new Badge();
  badge.setConfig(badgeStub);
  badge.hass = hass;
  if (!badge.shadowRoot.innerHTML.includes('<ha-badge type="button" icon-only data-mode="scheduled"')
    || !badge.shadowRoot.innerHTML.includes('class="clock-symbol" icon="mdi:alarm"')
    || !badge.shadowRoot.innerHTML.includes('class="state-marker"><ha-icon icon="mdi:calendar-check"')
    || !badge.shadowRoot.innerHTML.includes("Bedroom clock")
    || !badge.shadowRoot.innerHTML.includes("Next alarm")) throw new Error("Badge lost its native Clock identity, state marker, or next alarm detail");
  badge.shadowRoot.querySelector("ha-badge")?.listeners.get("click")?.(new Event("click"));
  if (badge.dispatchedEvents.at(-1)?.detail?.entityId !== "sensor.clock_status") throw new Error("Badge did not open the native entity details");
  const renderCount = badge.shadowRoot.writeCount;
  badge.hass = hass;
  if (badge.shadowRoot.writeCount !== renderCount) throw new Error("Badge rerendered although its relevant state did not change");
  badge.hass = { ...hass, states: { ...hass.states, "sensor.clock_status": {
    ...hass.states["sensor.clock_status"], last_updated: "2031-06-20T05:00:01+00:00",
    attributes: { ...hass.states["sensor.clock_status"].attributes, diagnostic_only: "changed" },
  } } };
  if (badge.shadowRoot.writeCount !== renderCount) throw new Error("Badge rerendered for invisible timestamp or diagnostic changes");
  const badgeModeCases = {
    idle: "mdi:minus", scheduled: "mdi:calendar-check", disabled: "mdi:power",
    vacation: "mdi:palm-tree", pre_alarm: "mdi:weather-sunset-up", ringing: "mdi:bell-ring",
    snoozed: "mdi:alarm-snooze", dismissed: "mdi:check", skipped: "mdi:skip-next",
    timeout: "mdi:timer-alert", error: "mdi:alert-circle", blocked: "mdi:shield-off",
  };
  for (const [mode, marker] of Object.entries(badgeModeCases)) {
    const entityId = `sensor.clock_${mode}`;
    const modeBadge = new Badge();
    modeBadge.setConfig({ entity: entityId, language: "en" });
    modeBadge.hass = { ...hass, states: { ...hass.states, [entityId]: {
      state: mode,
      attributes: {
        name: `Clock ${mode}`,
        next_alarm: "2031-06-21T06:00:00+00:00",
        active_since: "2031-06-21T05:55:00+00:00",
        snooze_until: "2031-06-21T06:10:00+00:00",
      },
    } } };
    if (!modeBadge.shadowRoot.innerHTML.includes(`data-mode="${mode}"`)
      || !modeBadge.shadowRoot.innerHTML.includes('class="clock-symbol" icon="mdi:alarm"')
      || !modeBadge.shadowRoot.innerHTML.includes(`class="state-marker"><ha-icon icon="${marker}"`)) throw new Error(`Badge mode ${mode} lost the stable alarm identity or state marker`);
  }
  const badgeEditor = new (registry.get("clock-advanced-badge-editor"))();
  badgeEditor.setConfig(badgeStub);
  badgeEditor.hass = hass;
  if (!badgeEditor.shadowRoot.innerHTML.includes("The main symbol always remains the alarm clock")) throw new Error("Badge editor did not explain the stable alarm symbol and state marker");
  if (!window.customBadges?.some((item) => item.type === "clock-advanced-badge")) throw new Error("Badge picker registration missing");
  if (!source.includes('{ value: "compact"') || !source.includes('{ value: "easy"') || !source.includes('{ value: "advanced"')) throw new Error("Compact, Easy, and Advanced modes are not available");
  console.log("Clock Advanced Card runtime contract valid");
})().catch((error) => { console.error(error); process.exit(1); });
