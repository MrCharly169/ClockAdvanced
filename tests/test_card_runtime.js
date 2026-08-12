const fs = require("fs");
const path = require("path");

class FakeStyle {
  constructor() { this.values = new Map(); }
  setProperty(name, value) { this.values.set(name, String(value)); }
  getPropertyValue(name) { return this.values.get(name) || ""; }
}
class FakeClassList {
  constructor(element) { this.element = element; }
  _set() { return new Set(String(this.element.className || "").split(/\s+/).filter(Boolean)); }
  toggle(name, force) {
    const values = this._set();
    const enabled = force === undefined ? !values.has(name) : Boolean(force);
    if (enabled) values.add(name); else values.delete(name);
    this.element.className = [...values].join(" ");
    return enabled;
  }
  contains(name) { return this._set().has(name); }
}
class FakeElement {
  constructor(selector = "") {
    this.selector = selector;
    this.shadowRoot = null;
    this.listeners = new Map();
    this.dispatchedEvents = [];
    this.dataset = {};
    this.style = new FakeStyle();
    this.className = selector.startsWith(".") ? selector.slice(1) : "";
    this.classList = new FakeClassList(this);
    this.attributes = new Map();
    this.textContent = "";
    this.hidden = false;
    this.disabled = false;
    this.children = selector.startsWith("[data-day=")
      ? [new FakeElement("span"), new FakeElement("strong")]
      : [];
  }
  attachShadow() { this.shadowRoot = new FakeShadow(); return this.shadowRoot; }
  addEventListener(type, handler) { this.listeners.set(type, handler); }
  dispatchEvent(event) { this.dispatchedEvents.push(event); return true; }
  setAttribute(name, value) {
    this.attributes.set(name, String(value));
    if (name.startsWith("data-")) {
      const key = name.slice(5).replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
      this.dataset[key] = String(value);
    }
  }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  querySelectorAll(selector) { return selector === "span,strong" ? this.children : []; }
  closest(selector) {
    if (selector === "ha-badge" && this.selector === "ha-badge") return this;
    if (selector === "[data-action]" && this.dataset.action) return this;
    return null;
  }
  focus() { global.document.activeElement = this; global.document.focusCalls += 1; }
  scrollIntoView() { global.document.scrollCalls += 1; }
}
class FakeShadow {
  constructor() { this._innerHTML = ""; this.writeCount = 0; this.nodes = new Map(); this.listeners = new Map(); }
  set innerHTML(value) {
    this._innerHTML = String(value || "");
    this.writeCount += 1;
  }
  get innerHTML() { return this._innerHTML; }
  addEventListener(type, handler) { this.listeners.set(type, handler); }
  querySelector(selector) {
    if (!this.nodes.has(selector)) {
      const node = new FakeElement(selector);
      const action = selector.match(/^\[data-action="([^"]+)"\]$/)?.[1];
      if (action) node.dataset.action = action;
      this.nodes.set(selector, node);
    }
    return this.nodes.get(selector);
  }
  querySelectorAll() { return []; }
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
global.window = {
  customCards: [], setInterval, clearInterval,
  scroll() { global.document.scrollCalls += 1; },
  scrollTo() { global.document.scrollCalls += 1; },
};
global.document = {
  activeElement: null, focusCalls: 0, scrollCalls: 0,
  createElement(name) { const Ctor = registry.get(name); return Ctor ? new Ctor() : new FakeElement(name); },
};

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
  const cardRoot = instance.shadowRoot.querySelector("ha-card");
  const focusedControl = instance.shadowRoot.querySelector('[data-action="toggle-details"]');
  const scrollContainer = { scrollTop: 240 };
  let cardPatchCount = 0;
  const originalCardPatch = instance._patch.bind(instance);
  instance._patch = (...args) => { cardPatchCount += 1; return originalCardPatch(...args); };
  focusedControl.focus();
  const focusCallsAfterUserAction = document.focusCalls;
  instance.hass = { ...hass, states: { ...hass.states, "sensor.clock_status": {
    ...hass.states["sensor.clock_status"], last_updated: "2031-06-20T05:00:01+00:00",
  } } };
  if (instance.shadowRoot.writeCount !== cardRenderCount) throw new Error("Card rerendered for an irrelevant last_updated-only change");
  if (cardPatchCount !== 0) throw new Error("Card patched for an invisible last_updated-only change");
  if (instance.shadowRoot.querySelector("ha-card") !== cardRoot) throw new Error("Card root identity changed for an irrelevant update");
  if (document.activeElement !== focusedControl) throw new Error("Card lost focus for an irrelevant update");
  const timeBefore = instance.shadowRoot.querySelector("[data-time]").textContent;
  instance.hass = { ...hass, states: { ...hass.states, "sensor.clock_status": {
    ...hass.states["sensor.clock_status"], attributes: {
      ...hass.states["sensor.clock_status"].attributes, next_alarm: "2031-06-21T06:05:00+00:00",
    },
  } } };
  if (instance.shadowRoot.writeCount !== cardRenderCount) throw new Error("Card rebuilt its DOM for a visible alarm-time change");
  if (cardPatchCount !== 1) throw new Error("Card signature ignored a visible alarm-time change");
  if (instance.shadowRoot.querySelector("[data-time]").textContent === timeBefore) throw new Error("Card ignored a visible alarm-time change");

  const originalNow = Date.now;
  const countdownBefore = instance.shadowRoot.querySelector("[data-countdown]").textContent;
  Date.now = () => originalNow() + 2000;
  instance._updateCountdown();
  Date.now = originalNow;
  const countdownAfter = instance.shadowRoot.querySelector("[data-countdown]").textContent;
  if (countdownBefore === countdownAfter) throw new Error("Countdown did not update in place");

  for (const state of ["vacation", "idle", "pre_alarm", "ringing", "snoozed"]) {
    const attrs = {
      ...hass.states["sensor.clock_status"].attributes,
      active_since: "2031-06-21T05:55:00+00:00",
      snooze_until: state === "snoozed" ? "2031-06-21T06:10:00+00:00" : null,
      snooze_available: true,
      repeat_count: 2,
      snooze_count: 1,
    };
    instance.hass = { ...hass, states: { ...hass.states, "sensor.clock_status": { state, attributes: attrs } } };
    if (instance.shadowRoot.querySelector("ha-card") !== cardRoot) throw new Error(`Card root changed in ${state}`);
    if (instance.shadowRoot.writeCount !== cardRenderCount) throw new Error(`Card rebuilt its DOM in ${state}`);
    if (document.activeElement !== focusedControl) throw new Error(`Card lost focus in ${state}`);
    if (scrollContainer.scrollTop !== 240) throw new Error(`Dashboard scroll changed in ${state}`);
    const activeState = ["pre_alarm", "ringing", "snoozed"].includes(state);
    if (instance.shadowRoot.querySelector("[data-metrics]").hidden === activeState
      || instance.shadowRoot.querySelector("[data-primary-actions]").hidden === activeState) {
      throw new Error(`Card visibility group is inconsistent in ${state}`);
    }
  }

  const rapidAttrs = {
    ...hass.states["sensor.clock_status"].attributes,
    controls: {
      enabled: "switch.clock_enabled", skip_next: "switch.clock_skip",
      holiday_mode: "switch.clock_holiday", snooze: "button.clock_snooze", dismiss: "button.clock_dismiss",
    },
    guards: {
      workday: "binary_sensor.workday", confirmation: "binary_sensor.motion", native_conditions: 2,
    },
    settings: { timeout_minutes: 30 },
  };
  for (let index = 0; index < 20; index += 1) {
    instance.hass = { ...hass, states: {
      ...hass.states,
      "sensor.clock_status": { state: index % 2 ? "ringing" : "snoozed", attributes: rapidAttrs },
      "switch.clock_enabled": { state: index % 2 ? "on" : "off", attributes: {} },
      "switch.clock_skip": { state: index % 3 ? "off" : "on", attributes: {} },
      "switch.clock_holiday": { state: "off", attributes: {} },
      "binary_sensor.workday": { state: index % 2 ? "on" : "off", attributes: { friendly_name: "Workday" } },
      "binary_sensor.motion": { state: "off", attributes: { friendly_name: "Motion" } },
    } };
  }
  if (instance.shadowRoot.querySelector("ha-card") !== cardRoot || instance.shadowRoot.writeCount !== cardRenderCount) throw new Error("Rapid control and guard updates rebuilt the Card");
  if (document.activeElement !== focusedControl || document.focusCalls !== focusCallsAfterUserAction) throw new Error("Card moved focus without user interaction");
  if (scrollContainer.scrollTop !== 240 || document.scrollCalls !== 0) throw new Error("Card invoked scrolling during updates");
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
  const badgeRoot = badge.shadowRoot.querySelector("ha-badge");
  const badgeMarker = badge.shadowRoot.querySelector("[data-state-icon]");
  if (badgeRoot.dataset.mode !== "scheduled"
    || badgeMarker.getAttribute("icon") !== "mdi:calendar-check"
    || !badgeRoot.getAttribute("title").includes("Bedroom clock")
    || !badgeRoot.getAttribute("title").includes("Next alarm")) throw new Error("Badge lost its native Clock identity, state marker, or next alarm detail");
  badgeRoot.listeners.get("click")?.(new Event("click"));
  if (badge.dispatchedEvents.at(-1)?.detail?.entityId !== "sensor.clock_status") throw new Error("Badge did not open the native entity details");
  const renderCount = badge.shadowRoot.writeCount;
  let badgePatchCount = 0;
  const originalBadgePatch = badge._patch.bind(badge);
  badge._patch = (...args) => { badgePatchCount += 1; return originalBadgePatch(...args); };
  badge.hass = hass;
  if (badge.shadowRoot.writeCount !== renderCount) throw new Error("Badge rerendered although its relevant state did not change");
  if (badgePatchCount !== 0) throw new Error("Badge patched although its relevant state did not change");
  badge.hass = { ...hass, states: { ...hass.states, "sensor.clock_status": {
    ...hass.states["sensor.clock_status"], last_updated: "2031-06-20T05:00:01+00:00",
    attributes: { ...hass.states["sensor.clock_status"].attributes, diagnostic_only: "changed" },
  } } };
  if (badge.shadowRoot.writeCount !== renderCount) throw new Error("Badge rerendered for invisible timestamp or diagnostic changes");
  if (badgePatchCount !== 0) throw new Error("Badge patched for invisible timestamp or diagnostic changes");
  badgeRoot.focus();
  const badgeFocusCalls = document.focusCalls;
  for (const state of ["vacation", "idle", "pre_alarm", "ringing", "snoozed"]) {
    badge.hass = { ...hass, states: { ...hass.states, "sensor.clock_status": {
      state,
      attributes: {
        ...hass.states["sensor.clock_status"].attributes,
        active_since: "2031-06-21T05:55:00+00:00",
        snooze_until: state === "snoozed" ? "2031-06-21T06:10:00+00:00" : null,
      },
    } } };
    if (badge.shadowRoot.querySelector("ha-badge") !== badgeRoot) throw new Error(`Badge root changed in ${state}`);
    if (badge.shadowRoot.writeCount !== renderCount) throw new Error(`Badge rebuilt its DOM in ${state}`);
    if (document.activeElement !== badgeRoot) throw new Error(`Badge lost focus in ${state}`);
  }
  if (document.focusCalls !== badgeFocusCalls || document.scrollCalls !== 0 || scrollContainer.scrollTop !== 240) throw new Error("Badge moved focus or Dashboard scroll during updates");
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
    if (modeBadge.shadowRoot.querySelector("ha-badge").dataset.mode !== mode
      || modeBadge.shadowRoot.querySelector("[data-state-icon]").getAttribute("icon") !== marker) throw new Error(`Badge mode ${mode} lost the stable alarm identity or state marker`);
  }
  const badgeEditor = new (registry.get("clock-advanced-badge-editor"))();
  badgeEditor.setConfig(badgeStub);
  badgeEditor.hass = hass;
  if (!badgeEditor.shadowRoot.innerHTML.includes("The main symbol always remains the alarm clock")) throw new Error("Badge editor did not explain the stable alarm symbol and state marker");
  if (!window.customBadges?.some((item) => item.type === "clock-advanced-badge")) throw new Error("Badge picker registration missing");
  if (!source.includes('{ value: "compact"') || !source.includes('{ value: "easy"') || !source.includes('{ value: "advanced"')) throw new Error("Compact, Easy, and Advanced modes are not available");
  console.log("Clock Advanced Card runtime contract valid");
})().catch((error) => { console.error(error); process.exit(1); });
