const fs = require("fs");
const path = require("path");

class FakeShadow {
  constructor() { this.innerHTML = ""; }
  addEventListener() {}
  querySelector() { return null; }
  querySelectorAll() { return []; }
}
class FakeElement {
  constructor() { this.shadowRoot = null; }
  attachShadow() { this.shadowRoot = new FakeShadow(); return this.shadowRoot; }
  addEventListener() {}
  dispatchEvent() {}
}
global.HTMLElement = FakeElement;
global.Event = class { constructor(type, options) { this.type = type; Object.assign(this, options); } };
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
  const hass = { states: { "sensor.clock_status": { state: "scheduled", attributes: { card_contract: 1, card_type: "custom:clock-advanced-card", controls: {}, schedule: [] } } }, language: "en", callService: async () => {} };
  const stub = Card.getStubConfig(hass);
  if (stub.entity !== "sensor.clock_status") throw new Error("Stub did not discover the status entity");
  if (stub.mode !== "easy") throw new Error("Easy is not the default Card mode");
  const instance = new Card();
  instance.setConfig(stub);
  instance.hass = hass;
  if (instance.getCardSize() !== 7 || instance.getGridOptions().columns !== 12 || instance.getGridOptions().rows !== 7) throw new Error("Sizing API is invalid");
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
  if (!badge.shadowRoot.innerHTML.includes('<ha-badge') || !badge.shadowRoot.innerHTML.includes('icon-only')) throw new Error("Badge does not use the native ha-badge element");
  if (!window.customBadges?.some((item) => item.type === "clock-advanced-badge")) throw new Error("Badge picker registration missing");
  if (!source.includes('{ value: "compact"') || !source.includes('{ value: "easy"') || !source.includes('{ value: "advanced"')) throw new Error("Compact, Easy, and Advanced modes are not available");
  console.log("Clock Advanced Card runtime contract valid");
})().catch((error) => { console.error(error); process.exit(1); });
