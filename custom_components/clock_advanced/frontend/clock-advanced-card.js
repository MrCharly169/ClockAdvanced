const CARD_TAG = "clock-advanced-card";
const EDITOR_TAG = "clock-advanced-card-editor";
const BADGE_TAG = "clock-advanced-badge";
const BADGE_EDITOR_TAG = "clock-advanced-badge-editor";

const TEXT = {
  en: {
    unavailable: "Clock unavailable",
    next: "Next alarm",
    noAlarm: "No alarm scheduled",
    today: "Today",
    tomorrow: "Tomorrow",
    in: "in",
    enabled: "Enabled",
    skip: "Skip next",
    holiday: "Holiday",
    snooze: "Snooze",
    dismiss: "Dismiss",
    schedule: "Weekly schedule",
    repeats: "repeats",
    snoozes: "snoozes",
    configure: "Open details",
    setOnce: "Set one-time alarm",
    apply: "Apply",
    entity: "Status entity",
    mode: "Layout",
    language: "Language",
    showSchedule: "Show weekly schedule",
    auto: "Automatic",
    compact: "Compact",
    easy: "Easy",
    advanced: "Advanced",
    scheduled: "Scheduled",
    idle: "Idle",
    disabled: "Disabled",
    vacation: "Vacation",
    pre_alarm: "Pre-alarm",
    ringing: "Ringing",
    snoozed: "Snoozed",
    dismissed: "Dismissed",
    skipped: "Skipped",
    timeout: "Timed out",
    error: "Error",
    blocked: "Blocked",
    brand: "CLOCK ADVANCED",
    prepare: "Prepare",
    alarm: "Alarm",
    workday: "Workday",
    nonWorkday: "Non-workday",
    source: "Time source",
    weekly: "Weekly schedule",
    one_time: "One-time alarm",
    schedule_entity: "HA Schedule helper",
    workdayRule: "Workday rule",
    confirmation: "Wake confirmation",
    safety: "Safety timeout",
    allowedWhen: "Allowed when",
    blockedWhen: "Blocked when",
    notConfigured: "Not configured",
    after: "after",
    minutes: "minutes",
    more: "More",
    less: "Less",
    summary: "The next alarm is active and recalculated automatically.",
    days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  },
  de: {
    unavailable: "Wecker nicht verfügbar",
    next: "Nächster Wecker",
    noAlarm: "Kein Wecker geplant",
    today: "Heute",
    tomorrow: "Morgen",
    in: "in",
    enabled: "Aktiv",
    skip: "Nächsten auslassen",
    holiday: "Ferien",
    snooze: "Schlummern",
    dismiss: "Beenden",
    schedule: "Wochenplan",
    repeats: "Wiederholungen",
    snoozes: "Schlummern",
    configure: "Details öffnen",
    setOnce: "Einmaligen Wecker setzen",
    apply: "Übernehmen",
    entity: "Status-Entität",
    mode: "Darstellung",
    language: "Sprache",
    showSchedule: "Wochenplan anzeigen",
    auto: "Automatisch",
    compact: "Kompakt",
    easy: "Einfach",
    advanced: "Erweitert",
    scheduled: "Geplant",
    idle: "Bereit",
    disabled: "Deaktiviert",
    vacation: "Urlaub",
    pre_alarm: "Voralarm",
    ringing: "Weckt",
    snoozed: "Schlummert",
    dismissed: "Beendet",
    skipped: "Übersprungen",
    timeout: "Zeitüberschreitung",
    error: "Fehler",
    blocked: "Gesperrt",
    brand: "CLOCK ADVANCED",
    prepare: "Vorbereitung",
    alarm: "Wecken",
    workday: "Arbeitstag",
    nonWorkday: "Freier Tag",
    source: "Zeitquelle",
    weekly: "Wochenplan",
    one_time: "Einmaliger Wecker",
    schedule_entity: "HA-Zeitplan-Helfer",
    workdayRule: "Arbeitstag",
    confirmation: "Aufstehbestätigung",
    safety: "Sicherheitsende",
    allowedWhen: "Freigabe",
    blockedWhen: "Sperre",
    notConfigured: "Nicht konfiguriert",
    after: "nach",
    minutes: "Minuten",
    more: "Mehr",
    less: "Weniger",
    summary: "Der nächste Wecker ist aktiv und wird automatisch berechnet.",
    days: ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"],
  },
};

const esc = (value) => String(value ?? "")
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;").replaceAll('"', "&quot;");

class ClockAdvancedCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._detailsOpen = true;
    this._onClick = this._onClick.bind(this);
    this.shadowRoot.addEventListener("click", this._onClick);
  }

  static getConfigElement() {
    return document.createElement(EDITOR_TAG);
  }

  static getStubConfig(hass) {
    const entity = Object.keys(hass?.states || {}).find((entityId) =>
      hass.states[entityId]?.attributes?.card_contract === 1
      && hass.states[entityId]?.attributes?.card_type === "custom:clock-advanced-card");
    return { entity: entity || "sensor.clock_advanced_status", mode: "easy", language: "auto" };
  }

  setConfig(config) {
    if (!config?.entity || !String(config.entity).startsWith("sensor.")) {
      throw new Error("Clock Advanced requires its status sensor entity");
    }
    this._config = { mode: "easy", language: "auto", ...config };
    this._signature = undefined;
    this._render();
  }

  set hass(value) {
    this._hass = value;
    const state = value?.states?.[this._config?.entity];
    const controls = state?.attributes?.controls || {};
    const signature = state ? JSON.stringify([
      state.state,
      state.last_updated,
      state.attributes.next_alarm,
      state.attributes.snooze_until,
      state.attributes.controls,
      state.attributes.schedule,
      Object.values(controls).map((entityId) => value.states[entityId]?.state),
      this._config,
      value.language,
    ]) : "missing";
    if (signature !== this._signature) {
      this._signature = signature;
      this._render();
    }
    this._updateCountdown();
  }

  connectedCallback() {
    if (!this._timer) this._timer = window.setInterval(() => this._updateCountdown(), 1000);
    this._render();
  }

  disconnectedCallback() {
    if (this._timer) window.clearInterval(this._timer);
    this._timer = undefined;
  }

  getCardSize() {
    const mode = this._mode();
    return mode === "compact" ? 4 : mode === "easy" ? 7 : 10;
  }

  getGridOptions() {
    const mode = this._mode();
    return {
      rows: mode === "compact" ? 4 : mode === "easy" ? 7 : 10,
      columns: mode === "compact" ? 6 : 12,
      min_rows: mode === "compact" ? 3 : mode === "easy" ? 5 : 8,
      min_columns: mode === "compact" ? 4 : 6,
    };
  }

  _mode() {
    const configured = this._config?.mode;
    if (["compact", "easy", "advanced"].includes(configured)) return configured;
    if (configured === "kiosk") return "advanced";
    return "easy";
  }

  _lang() {
    const configured = this._config?.language;
    if (configured === "de" || configured === "en") return configured;
    return String(this._hass?.language || navigator.language || "en").toLowerCase().startsWith("de") ? "de" : "en";
  }

  _targetDate(attrs) {
    const value = attrs.snooze_until || attrs.next_alarm || attrs.active_since;
    if (!value) return null;
    const result = new Date(value);
    return Number.isNaN(result.getTime()) ? null : result;
  }

  _formatTarget(target, lang) {
    if (!target) return "—";
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const targetDay = new Date(target.getFullYear(), target.getMonth(), target.getDate());
    const days = Math.round((targetDay - today) / 86400000);
    const prefix = days === 0 ? TEXT[lang].today : days === 1 ? TEXT[lang].tomorrow : target.toLocaleDateString(lang, { weekday: "short", day: "2-digit", month: "2-digit" });
    return `${prefix}, ${target.toLocaleTimeString(lang, { hour: "2-digit", minute: "2-digit" })}`;
  }

  _formatTime(target, lang) {
    if (!target) return "--:--";
    return target.toLocaleTimeString(lang, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }

  _guardLabel(entityId, lang) {
    const state = entityId ? this._hass?.states?.[entityId] : null;
    if (!state) return TEXT[lang].notConfigured;
    return state.attributes?.friendly_name || entityId;
  }

  _phaseProgress(status) {
    if (status === "pre_alarm") return { prepare: 72, alarm: 16 };
    if (status === "ringing") return { prepare: 100, alarm: 100 };
    if (status === "snoozed") return { prepare: 100, alarm: 48 };
    return { prepare: 0, alarm: 0 };
  }

  _render() {
    if (!this.shadowRoot || !this._config) return;
    const lang = this._lang();
    const t = TEXT[lang];
    const entity = this._hass?.states?.[this._config.entity];
    if (!entity) {
      this.shadowRoot.innerHTML = `<ha-card><div class="missing">${esc(t.unavailable)}<small>${esc(this._config.entity)}</small></div></ha-card>${this._styles()}`;
      return;
    }
    const attrs = entity.attributes || {};
    const controls = attrs.controls || {};
    const guards = attrs.guards || {};
    const settings = attrs.settings || {};
    const active = ["pre_alarm", "ringing", "snoozed"].includes(entity.state);
    const mode = this._mode();
    const schedule = Array.isArray(attrs.schedule) ? attrs.schedule : [];
    const target = this._targetDate(attrs);
    const enabled = controls.enabled && this._hass.states[controls.enabled]?.state === "on";
    const skipped = controls.skip_next && this._hass.states[controls.skip_next]?.state === "on";
    const holiday = controls.holiday_mode && this._hass.states[controls.holiday_mode]?.state === "on";
    const statusText = t[entity.state] || entity.state;
    const progress = this._phaseProgress(entity.state);
    const workdayState = guards.workday ? this._hass.states[guards.workday]?.state : null;
    const dayLabel = target ? target.toLocaleDateString(lang, { weekday: "long" }) : "";
    const dayKind = workdayState === "on" ? t.workday : workdayState === "off" ? t.nonWorkday : t.weekly;
    const scheduleMarkup = mode === "advanced" && schedule.length ? `
      <section class="schedule" aria-label="${esc(t.schedule)}">
        <div class="days">${schedule.map((day, index) => `
          <div class="day ${day.enabled ? "on" : "off"}">
            <span>${esc(t.days[index] || day.day)}</span>
            <strong>${day.enabled ? esc(String(day.time || "").slice(0, 2)) : "—"}</strong>
          </div>`).join("")}</div>
      </section>` : "";
    const activeActions = active ? `
      <div class="primary-actions">
        <button class="primary snooze" data-action="press-snooze" ${!attrs.snooze_available || !controls.snooze ? "disabled" : ""}><ha-icon icon="mdi:alarm-snooze"></ha-icon>${esc(t.snooze)}</button>
        <button class="primary dismiss" data-action="press-dismiss" ${!controls.dismiss ? "disabled" : ""}><ha-icon icon="mdi:alarm-off"></ha-icon>${esc(t.dismiss)}</button>
      </div>` : "";
    const detailsMarkup = mode === "advanced" && this._detailsOpen ? `
      <section class="details">
        <div class="detail-row"><span>${esc(t.source)}</span><strong>${esc(t[attrs.schedule_source] || t.weekly)}</strong></div>
        <div class="detail-row"><span>${esc(t.workdayRule)}</span><strong>${esc(this._guardLabel(guards.workday, lang))}${workdayState ? ` · ${esc(workdayState === "on" ? t.workday : t.nonWorkday)}` : ""}</strong></div>
        <div class="detail-row"><span>${esc(t.confirmation)}</span><strong>${esc(this._guardLabel(guards.confirmation, lang))}</strong></div>
        ${guards.allow ? `<div class="detail-row"><span>${esc(t.allowedWhen)}</span><strong>${esc(this._guardLabel(guards.allow, lang))} = ${esc(settings.allow_state)}</strong></div>` : ""}
        ${guards.block ? `<div class="detail-row"><span>${esc(t.blockedWhen)}</span><strong>${esc(this._guardLabel(guards.block, lang))} = ${esc(settings.block_state)}</strong></div>` : ""}
        <div class="detail-row"><span>${esc(t.safety)}</span><strong>${esc(t.after)} ${esc(settings.timeout_minutes ?? "—")} ${esc(t.minutes)}</strong></div>
        <p>${esc(t.summary)}</p>
      </section>` : "";
    this.shadowRoot.innerHTML = `
      <ha-card class="clock ${esc(mode)} state-${esc(entity.state)}" data-state="${esc(entity.state)}">
        <header><span class="brand">${esc(t.brand)}</span><button class="status-pill ${enabled ? "enabled" : ""}" data-action="more-info"><i></i>${esc(statusText)}</button></header>
        <h2>${esc(this._config.title || attrs.name || entity.attributes.friendly_name || "Clock Advanced")}</h2>
        <main>
          <div class="time">${esc(this._formatTime(target, lang))}</div>
          <div class="context"><span>${esc(dayLabel)}${dayLabel ? " · " : ""}${esc(dayKind)}</span><span class="countdown" data-countdown></span></div>
          ${active ? `<div class="metrics"><span>${attrs.repeat_count || 0} ${esc(t.repeats)}</span><span>${attrs.snooze_count || 0} ${esc(t.snoozes)}</span></div>` : ""}
        </main>
        <section class="progress-panel">
          <div class="progress-row"><span>${esc(t.prepare)}</span><div class="track"><i style="width:${progress.prepare}%"></i></div></div>
          <div class="progress-row"><span>${esc(t.alarm)}</span><div class="track secondary"><i style="width:${progress.alarm}%"></i></div></div>
        </section>
        ${scheduleMarkup}
        ${activeActions}
        <div class="toggles">
          <button data-action="toggle-skip" class="chip ${skipped ? "selected warning" : ""}" ${!controls.skip_next ? "disabled" : ""}><ha-icon icon="mdi:skip-next"></ha-icon>${esc(t.skip)}</button>
          ${attrs.schedule_source !== "schedule_entity" ? `<button data-action="toggle-holiday" class="chip ${holiday ? "selected holiday" : ""}" ${!controls.holiday_mode ? "disabled" : ""}><ha-icon icon="mdi:palm-tree"></ha-icon>${esc(t.holiday)}</button>` : ""}
          ${mode === "advanced" ? `<button data-action="toggle-details" class="chip details-toggle"><ha-icon icon="mdi:chevron-${this._detailsOpen ? "up" : "down"}"></ha-icon>${esc(this._detailsOpen ? t.less : t.more)}</button>` : ""}
        </div>
        ${detailsMarkup}
      </ha-card>${this._styles()}`;
    this._updateCountdown();
  }

  _updateCountdown() {
    const node = this.shadowRoot?.querySelector("[data-countdown]");
    const entity = this._hass?.states?.[this._config?.entity];
    if (!node || !entity) return;
    const target = this._targetDate(entity.attributes || {});
    if (!target) { node.textContent = ""; return; }
    const ringing = entity.state === "ringing" && !entity.attributes.snooze_until && !entity.attributes.next_alarm;
    const seconds = ringing
      ? Math.max(0, Math.floor((Date.now() - target.getTime()) / 1000))
      : Math.max(0, Math.floor((target.getTime() - Date.now()) / 1000));
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    const lang = this._lang();
    node.textContent = `${ringing ? "+" : TEXT[lang].in} ${days ? `${days}d ` : ""}${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }

  async _onClick(event) {
    const button = event.target.closest?.("[data-action]");
    if (!button || button.disabled || !this._hass) return;
    const attrs = this._hass.states[this._config.entity]?.attributes || {};
    const controls = attrs.controls || {};
    const action = button.dataset.action;
    if (action === "more-info") {
      const ev = new Event("hass-more-info", { bubbles: true, composed: true });
      ev.detail = { entityId: this._config.entity };
      this.dispatchEvent(ev);
      return;
    }
    if (action === "toggle-details") {
      this._detailsOpen = !this._detailsOpen;
      this._render();
      return;
    }
    const map = {
      "toggle-enabled": controls.enabled,
      "toggle-skip": controls.skip_next,
      "toggle-holiday": controls.holiday_mode,
    };
    if (map[action]) {
      await this._hass.callService("homeassistant", "toggle", { entity_id: map[action] });
    } else if (action === "press-snooze" && controls.snooze) {
      await this._hass.callService("button", "press", { entity_id: controls.snooze });
    } else if (action === "press-dismiss" && controls.dismiss) {
      await this._hass.callService("button", "press", { entity_id: controls.dismiss });
    } else if (action === "set-once" && controls.next_alarm) {
      const value = this.shadowRoot.querySelector("[data-once]")?.value;
      if (value) await this._hass.callService("datetime", "set_value", { entity_id: controls.next_alarm, datetime: value.length === 16 ? `${value}:00` : value });
    }
  }

  _styles() {
    return `<style>
      :host { display:block; container-type:inline-size; --ca-accent:#93c5fd; --ca-warm:#f7ca78; }
      ha-card { box-sizing:border-box; width:100%; overflow:hidden; padding:15px; color:var(--primary-text-color); background:color-mix(in srgb,var(--card-background-color,#20262e) 80%,#283443 20%); border:1px solid color-mix(in srgb,var(--divider-color) 78%,#94a3b8 22%); border-radius:22px; box-shadow:var(--ha-card-box-shadow); }
      .state-ringing,.state-pre_alarm { --ca-accent:#fb923c; --ca-warm:#fb923c; }
      .state-snoozed { --ca-accent:#a78bfa; --ca-warm:#a78bfa; }
      .state-timeout,.state-error { --ca-accent:#f87171; --ca-warm:#f87171; }
      .state-vacation { --ca-accent:#5eead4; --ca-warm:#5eead4; }
      .state-blocked { --ca-accent:#fbbf24; --ca-warm:#fbbf24; }
      .state-disabled { --ca-accent:#94a3b8; --ca-warm:#94a3b8; }
      header,.toggles,.primary-actions,.context,.progress-row { display:flex; align-items:center; }
      header { justify-content:space-between; gap:10px; }
      .brand { color:var(--secondary-text-color); font-size:.7rem; font-weight:800; letter-spacing:.13em; }
      .status-pill { display:flex; align-items:center; gap:7px; border:0; border-radius:999px; padding:8px 12px; background:color-mix(in srgb,var(--secondary-background-color) 86%,#94a3b8 14%); color:var(--primary-text-color); font-size:.72rem; font-weight:750; }
      .status-pill i { width:7px; height:7px; border-radius:50%; background:var(--ca-accent); }
      h2 { margin:3px 0 0; font-size:.76rem; font-weight:760; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      button { box-sizing:border-box; font:inherit; color:inherit; cursor:pointer; }
      button:disabled { opacity:.42; cursor:not-allowed; }
      main { padding:20px 0 15px; }
      .time { font-size:2.75rem; line-height:.95; font-weight:680; letter-spacing:-.055em; font-variant-numeric:tabular-nums; }
      .context { justify-content:space-between; gap:8px; margin-top:9px; color:var(--secondary-text-color); font-size:.72rem; }
      .countdown { color:var(--ca-accent); font-size:.66rem; font-variant-numeric:tabular-nums; white-space:nowrap; }
      .metrics { display:flex; gap:12px; margin-top:8px; font-size:.68rem; color:var(--secondary-text-color); }
      .progress-panel { display:grid; gap:10px; padding:12px; border-radius:15px; background:color-mix(in srgb,var(--secondary-background-color) 88%,#64748b 12%); }
      .progress-row { gap:10px; }
      .progress-row>span { flex:0 0 45px; color:var(--secondary-text-color); font-size:.7rem; }
      .track { height:5px; flex:1; overflow:hidden; border-radius:99px; background:color-mix(in srgb,var(--divider-color) 72%,#64748b 28%); }
      .track i { display:block; height:100%; border-radius:inherit; background:var(--ca-warm); transition:width .25s ease; }
      .track.secondary i { background:var(--ca-accent); }
      .schedule { margin-top:12px; }
      .days { display:grid; grid-template-columns:repeat(7,minmax(0,1fr)); gap:5px; }
      .day { min-width:0; text-align:center; padding:7px 1px; border-radius:11px; background:color-mix(in srgb,var(--secondary-background-color) 84%,#64748b 16%); }
      .day span,.day strong { display:block; font-size:.62rem; }
      .day span { color:var(--secondary-text-color); }
      .day strong { margin-top:4px; font-size:.72rem; font-variant-numeric:tabular-nums; }
      .day.off { opacity:.42; }
      .primary-actions { gap:8px; margin-top:12px; }
      .primary { flex:1; min-width:0; border:0; border-radius:13px; padding:10px 7px; display:flex; gap:6px; justify-content:center; align-items:center; font-size:.72rem; font-weight:750; }
      .snooze { background:color-mix(in srgb,#8b5cf6 20%,var(--card-background-color)); color:#c4b5fd; }
      .dismiss { background:var(--ca-accent); color:#111827; }
      .toggles { flex-wrap:wrap; gap:8px; margin-top:13px; }
      .chip { display:flex; gap:5px; align-items:center; min-height:35px; padding:7px 11px; border-radius:999px; border:1px solid color-mix(in srgb,var(--divider-color) 72%,#94a3b8 28%); background:color-mix(in srgb,var(--card-background-color) 92%,#64748b 8%); font-size:.7rem; }
      .chip.selected { background:color-mix(in srgb,var(--ca-warm) 16%,transparent); border-color:color-mix(in srgb,var(--ca-warm) 50%,var(--divider-color)); }
      .details-toggle { flex-basis:auto; }
      .details { display:grid; gap:14px; margin-top:14px; padding-top:14px; border-top:1px solid var(--divider-color); }
      .detail-row { display:grid; gap:4px; }
      .detail-row span { color:var(--secondary-text-color); font-size:.7rem; }
      .detail-row strong { font-size:.75rem; line-height:1.3; }
      .details p { margin:0; color:var(--secondary-text-color); font-size:.7rem; line-height:1.5; }
      .missing { padding:24px; display:grid; gap:8px; } .missing small { color:var(--secondary-text-color); }
      .compact .progress-panel,.compact .schedule,.compact .toggles,.compact .details { display:none; }
      .compact main { padding-bottom:4px; }
      .easy .schedule,.easy .details { display:none; }
      @container (max-width:300px) { ha-card { padding:13px; border-radius:19px; } .time { font-size:2.45rem; } .brand { font-size:.62rem; } .status-pill { padding:7px 9px; } .context { align-items:flex-start; flex-direction:column; } }
      @media (prefers-reduced-motion:reduce) { * { animation:none!important; transition:none!important; } }
    </style>`;
  }
}

class ClockAdvancedCardEditor extends HTMLElement {
  constructor() { super(); this.attachShadow({ mode: "open" }); }
  set hass(value) { this._hass = value; this._render(); }
  setConfig(config) { this._config = { mode: "easy", language: "auto", ...config }; this._render(); }
  _lang() { return String(this._hass?.language || navigator.language || "en").startsWith("de") ? "de" : "en"; }
  _render() {
    if (!this._config) return;
    const t = TEXT[this._lang()];
    const configuredMode = ["compact", "easy", "advanced"].includes(this._config.mode)
      ? this._config.mode : this._config.mode === "kiosk" ? "advanced" : "easy";
    this._config = { ...this._config, mode: configuredMode };
    this.shadowRoot.innerHTML = `<ha-form></ha-form><style>:host{display:block;padding:4px 0}</style>`;
    const form = this.shadowRoot.querySelector?.("ha-form");
    if (!form) return;
    form.hass = this._hass;
    form.data = this._config;
    form.schema = [
      { name: "entity", required: true, selector: { entity: { domain: "sensor" } } },
      { name: "title", selector: { text: {} } },
      { name: "mode", required: true, selector: { select: { mode: "dropdown", options: [
        { value: "compact", label: t.compact },
        { value: "easy", label: t.easy },
        { value: "advanced", label: t.advanced },
      ] } } },
      { name: "language", required: true, selector: { select: { mode: "dropdown", options: [
        { value: "auto", label: t.auto }, { value: "en", label: "English" }, { value: "de", label: "Deutsch" },
      ] } } },
    ];
    form.computeLabel = (schema) => ({ entity: t.entity, title: this._lang() === "de" ? "Überschrift" : "Title", mode: t.mode, language: t.language }[schema.name] || schema.name);
    form.addEventListener("value-changed", (event) => {
      this._config = { ...event.detail.value };
      this.dispatchEvent(new CustomEvent("config-changed", {
        detail: { config: { ...this._config } }, bubbles: true, composed: true,
      }));
    });
  }
}

class ClockAdvancedBadge extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.shadowRoot.addEventListener("click", () => {
      if (!this._config?.entity) return;
      const event = new Event("hass-more-info", { bubbles: true, composed: true });
      event.detail = { entityId: this._config.entity };
      this.dispatchEvent(event);
    });
  }

  static getConfigElement() {
    return document.createElement(BADGE_EDITOR_TAG);
  }

  static getStubConfig(hass) {
    const entity = Object.keys(hass?.states || {}).find((entityId) =>
      hass.states[entityId]?.attributes?.card_contract === 1);
    return { entity: entity || "sensor.clock_advanced_status", language: "auto" };
  }

  setConfig(config) {
    if (!config?.entity || !String(config.entity).startsWith("sensor.")) {
      throw new Error("Clock Advanced badge requires its status sensor entity");
    }
    this._config = { language: "auto", ...config };
    this._render();
  }

  set hass(value) {
    this._hass = value;
    this._render();
  }

  _lang() {
    const configured = this._config?.language;
    if (configured === "de" || configured === "en") return configured;
    return String(this._hass?.language || navigator.language || "en").toLowerCase().startsWith("de") ? "de" : "en";
  }

  _icon(status) {
    return ({
      ringing: "mdi:alarm-bell", pre_alarm: "mdi:weather-sunset-up",
      snoozed: "mdi:alarm-snooze", vacation: "mdi:palm-tree",
      blocked: "mdi:alarm-off", disabled: "mdi:power-sleep",
      timeout: "mdi:timer-alert", error: "mdi:alert-circle",
    })[status] || "mdi:alarm";
  }

  _color(status) {
    return ({
      ringing: "#fb923c", pre_alarm: "#fb923c", snoozed: "#a78bfa",
      vacation: "#2dd4bf", blocked: "#fbbf24", disabled: "#94a3b8",
      timeout: "#f87171", error: "#f87171",
    })[status] || "var(--primary-color,#03a9f4)";
  }

  _render() {
    if (!this.shadowRoot || !this._config) return;
    const entity = this._hass?.states?.[this._config.entity];
    const lang = this._lang();
    const t = TEXT[lang];
    if (!entity) {
      this.shadowRoot.innerHTML = `<style>.unavailable{display:inline-block;padding:10px;color:var(--secondary-text-color);font-size:.75rem}</style><span class="unavailable">${esc(t.unavailable)}</span>`;
      return;
    }
    const attrs = entity.attributes || {};
    const targetValue = attrs.snooze_until || attrs.next_alarm || attrs.active_since;
    const target = targetValue ? new Date(targetValue) : null;
    const validTarget = target && !Number.isNaN(target.getTime());
    const time = validTarget
      ? target.toLocaleTimeString(lang, { hour: "2-digit", minute: "2-digit", hour12: false })
      : "--:--";
    const status = t[entity.state] || entity.state;
    const title = this._config.title || attrs.name || entity.attributes.friendly_name || "Clock Advanced";
    const tooltip = `${title} · ${time} · ${status}`;
    this.shadowRoot.innerHTML = `<style>
        ha-badge{--badge-color:${esc(this._color(entity.state))}}
        .unavailable{display:inline-block;padding:10px;color:var(--secondary-text-color);font-size:.75rem}
      </style>
      <ha-badge type="button" icon-only title="${esc(tooltip)}" aria-label="${esc(tooltip)}">
        <ha-icon slot="icon" icon="${esc(this._icon(entity.state))}"></ha-icon>
      </ha-badge>`;
  }
}

class ClockAdvancedBadgeEditor extends HTMLElement {
  constructor() { super(); this.attachShadow({ mode: "open" }); }
  set hass(value) { this._hass = value; this._render(); }
  setConfig(config) { this._config = { language: "auto", ...config }; this._render(); }
  _render() {
    if (!this._config) return;
    const de = String(this._hass?.language || "en").toLowerCase().startsWith("de");
    this.shadowRoot.innerHTML = `<ha-form></ha-form><style>:host{display:block;padding:4px 0}</style>`;
    const form = this.shadowRoot.querySelector?.("ha-form");
    if (!form) return;
    form.hass = this._hass;
    form.data = this._config;
    form.schema = [
      { name: "entity", required: true, selector: { entity: { domain: "sensor" } } },
      { name: "title", selector: { text: {} } },
      { name: "language", required: true, selector: { select: { mode: "dropdown", options: [
        { value: "auto", label: de ? "Automatisch" : "Automatic" },
        { value: "en", label: "English" }, { value: "de", label: "Deutsch" },
      ] } } },
    ];
    form.computeLabel = (schema) => ({
      entity: de ? "Status-Entität" : "Status entity",
      title: de ? "Name im Tooltip" : "Tooltip name",
      language: de ? "Sprache" : "Language",
    }[schema.name] || schema.name);
    form.addEventListener("value-changed", (event) => {
      this._config = { ...event.detail.value };
      this.dispatchEvent(new CustomEvent("config-changed", {
        detail: { config: { ...this._config } }, bubbles: true, composed: true,
      }));
    });
  }
}

if (!customElements.get(CARD_TAG)) customElements.define(CARD_TAG, ClockAdvancedCard);
if (!customElements.get(EDITOR_TAG)) customElements.define(EDITOR_TAG, ClockAdvancedCardEditor);
if (!customElements.get(BADGE_TAG)) customElements.define(BADGE_TAG, ClockAdvancedBadge);
if (!customElements.get(BADGE_EDITOR_TAG)) customElements.define(BADGE_EDITOR_TAG, ClockAdvancedBadgeEditor);
window.customCards = window.customCards || [];
if (!window.customCards.some((card) => card.type === CARD_TAG)) {
  window.customCards.push({
    type: CARD_TAG,
    name: "Clock Advanced",
    description: "Responsive alarm clock for the Clock Advanced integration",
    preview: true,
    getEntitySuggestion: (hass, entityId) => {
      const state = hass?.states?.[entityId];
      if (state?.attributes?.card_contract !== 1 || state?.attributes?.card_type !== "custom:clock-advanced-card") return null;
      return { config: { type: "custom:clock-advanced-card", entity: entityId, mode: "easy", language: "auto" } };
    },
  });
}

window.customBadges = window.customBadges || [];
if (!window.customBadges.some((badge) => badge.type === BADGE_TAG)) {
  window.customBadges.push({
    type: BADGE_TAG,
    name: "Clock Advanced",
    description: "Next alarm and current clock state",
    preview: true,
  });
}

export { ClockAdvancedBadge, ClockAdvancedBadgeEditor, ClockAdvancedCard, ClockAdvancedCardEditor };
