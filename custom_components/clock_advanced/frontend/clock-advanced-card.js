const CARD_TAG = "clock-advanced-card";
const EDITOR_TAG = "clock-advanced-card-editor";
const BADGE_TAG = "clock-advanced-badge";
const BADGE_EDITOR_TAG = "clock-advanced-badge-editor";
const WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

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
    holiday: "Holiday time",
    vacationMode: "Vacation",
    snooze: "Snooze",
    dismiss: "Dismiss",
    schedule: "Weekly schedule",
    alarmTime: "Alarm time",
    holidayWeekdayTime: "Holiday time · weekdays",
    holidayWeekendTime: "Holiday time · weekends/public holidays",
    dayActive: "Day active",
    dayInactive: "Day inactive",
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
    workday: "Workday",
    nonWorkday: "Non-workday",
    source: "Time source",
    weekly: "Weekly schedule",
    one_time: "One-time alarm",
    schedule_entity: "HA schedule entity",
    workdayRule: "Workday rule",
    confirmation: "Wake confirmation",
    safety: "Safety timeout",
    allowedWhen: "Allowed when",
    blockedWhen: "Blocked when",
    nativeConditions: "Start conditions",
    conditions: "conditions",
    notConfigured: "Not configured",
    after: "after",
    minutes: "minutes",
    options: "Options",
    closeOptions: "Close",
    activeOptions: "active",
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
    holiday: "Ferienzeit",
    vacationMode: "Urlaub",
    snooze: "Schlummern",
    dismiss: "Beenden",
    schedule: "Wochenplan",
    alarmTime: "Weckzeit",
    holidayWeekdayTime: "Ferienzeit · Werktage",
    holidayWeekendTime: "Ferienzeit · Wochenende/Feiertage",
    dayActive: "Tag aktiv",
    dayInactive: "Tag inaktiv",
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
    workday: "Arbeitstag",
    nonWorkday: "Freier Tag",
    source: "Zeitquelle",
    weekly: "Wochenplan",
    one_time: "Einmaliger Wecker",
    schedule_entity: "HA-Zeitplan-Entität",
    workdayRule: "Arbeitstag",
    confirmation: "Aufstehbestätigung",
    safety: "Sicherheitsende",
    allowedWhen: "Freigabe",
    blockedWhen: "Sperre",
    nativeConditions: "Startbedingungen",
    conditions: "Bedingungen",
    notConfigured: "Nicht konfiguriert",
    after: "nach",
    minutes: "Minuten",
    options: "Optionen",
    closeOptions: "Schließen",
    activeOptions: "aktiv",
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
    this._detailsOpen = false;
    this._selectedDay = 0;
    this._scheduleDraft = null;
    this._onClick = this._onClick.bind(this);
    this._onInput = this._onInput.bind(this);
    this._onChange = this._onChange.bind(this);
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
    this._ensureStructure();
    this._patch();
  }

  set hass(value) {
    this._hass = value;
    const state = value?.states?.[this._config?.entity];
    const controls = state?.attributes?.controls || {};
    const attrs = state?.attributes || {};
    const guards = attrs.guards || {};
    const advanced = this._mode() === "advanced";
    const controlStates = Object.entries(controls).map(([key, entityId]) => [
      key,
      entityId,
      ["enabled", "skip_next", "holiday_mode", "vacation_mode"].includes(key)
        ? value?.states?.[entityId]?.state
        : undefined,
    ]);
    const visibleGuardKeys = advanced
      ? ["workday", "vacation", "confirmation", "allow", "block"]
      : ["workday", "vacation"];
    const guardStates = visibleGuardKeys.map((key) => {
      const entityId = guards[key];
      const relatedState = value?.states?.[entityId];
      return [
        key,
        entityId,
        ["workday", "vacation"].includes(key) ? relatedState?.state : undefined,
        relatedState?.attributes?.friendly_name,
      ];
    });
    const signature = state ? JSON.stringify([
      this._config.entity,
      this._config.title,
      this._mode(),
      this._lang(),
      state.state,
      attrs.name,
      attrs.friendly_name,
      attrs.next_alarm,
      attrs.active_since,
      attrs.snooze_until,
      attrs.repeat_count,
      attrs.snooze_count,
      attrs.snooze_available,
      attrs.schedule_source,
      controlStates,
      guardStates,
      advanced ? guards.native_conditions : undefined,
      advanced ? attrs.schedule : undefined,
      advanced ? attrs.settings : undefined,
    ]) : JSON.stringify([
      this._config.entity, this._config.title, this._mode(), this._lang(), "missing",
    ]);
    if (signature !== this._signature) {
      this._signature = signature;
      this._patch();
    }
    this._updateCountdown();
  }

  connectedCallback() {
    if (!this._timer) this._timer = window.setInterval(() => this._updateCountdown(), 1000);
    this._ensureStructure();
    this._patch();
  }

  disconnectedCallback() {
    if (this._timer) window.clearInterval(this._timer);
    this._timer = undefined;
  }

  getCardSize() {
    const mode = this._mode();
    return mode === "compact" ? 3 : mode === "easy" ? 5 : 9;
  }

  getGridOptions() {
    const mode = this._mode();
    return {
      columns: mode === "compact" ? 6 : 12,
      min_columns: mode === "compact" ? 4 : 6,
      max_columns: 12,
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

  _ensureStructure() {
    if (!this.shadowRoot || this._structureReady) return;
    this.shadowRoot.innerHTML = `
      <ha-card class="clock">
        <div class="missing" data-missing hidden><span data-unavailable></span><small data-missing-entity></small></div>
        <div class="card-body" data-card-body hidden>
          <header>
            <span class="brand-lockup">
              <span class="brand-logo" data-logo aria-hidden="true">
                <span class="logo-orbit"></span>
                <ha-icon class="logo-icon" icon="mdi:alarm"></ha-icon>
              </span>
              <span class="brand" data-brand></span>
            </span>
            <button class="status-pill" data-action="more-info"><i></i><span data-status></span></button>
          </header>
          <h2 data-title></h2>
          <main>
            <div class="time" data-time></div>
            <div class="context"><span data-context></span><span class="countdown" data-countdown></span></div>
            <div class="metrics" data-metrics><span data-repeats></span><span data-snoozes></span></div>
          </main>
          <section class="schedule" data-schedule>
            <div class="days">
              ${Array.from({ length: 7 }, (_, index) => `<button type="button" class="day off" data-action="select-day" data-day="${index}"><span></span><strong>—</strong></button>`).join("")}
            </div>
            <div class="schedule-editor" data-schedule-editor>
              <div class="schedule-editor-head">
                <strong data-editor-day></strong>
                <button type="button" class="day-toggle" data-action="toggle-day"><ha-icon icon="mdi:calendar-check"></ha-icon><span data-day-toggle-label></span></button>
              </div>
              <label class="time-slider-label" for="clock-advanced-time-slider"><span data-alarm-time-label></span><output data-slider-output></output></label>
              <input id="clock-advanced-time-slider" data-schedule-slider type="range" min="0" max="1439" step="5">
              <input data-schedule-time type="time" step="60" aria-label="Alarm time">
            </div>
          </section>
          <div class="primary-actions" data-primary-actions>
            <button class="primary snooze" data-action="press-snooze"><ha-icon icon="mdi:alarm-snooze"></ha-icon><span data-snooze-label></span></button>
            <button class="primary dismiss" data-action="press-dismiss"><ha-icon icon="mdi:alarm-off"></ha-icon><span data-dismiss-label></span></button>
          </div>
          <div class="menu-shell" data-menu-shell>
            <button data-action="toggle-details" class="chip menu-trigger" aria-expanded="false" aria-controls="clock-advanced-options">
              <ha-icon data-details-icon icon="mdi:tune-variant"></ha-icon>
              <span data-details-label></span>
              <small data-options-count hidden></small>
            </button>
            <section id="clock-advanced-options" class="control-menu" data-control-menu hidden>
              <div class="menu-heading"><strong data-options-heading></strong><span data-options-summary></span></div>
              <div class="toggles">
                <button data-action="toggle-skip" class="chip"><ha-icon icon="mdi:skip-next"></ha-icon><span data-skip-label></span></button>
                <button data-action="toggle-holiday" class="chip"><ha-icon icon="mdi:palm-tree"></ha-icon><span data-holiday-label></span></button>
                <button data-action="toggle-vacation" class="chip vacation"><ha-icon icon="mdi:airplane"></ha-icon><span data-vacation-label></span></button>
              </div>
              <section class="details" data-details>
                <div class="detail-row"><span data-source-label></span><strong data-source-value></strong></div>
                <div class="detail-row"><span data-workday-label></span><strong data-workday-value></strong></div>
                <div class="detail-row"><span data-confirmation-label></span><strong data-confirmation-value></strong></div>
                <div class="detail-row" data-allow-row><span data-allow-label></span><strong data-allow-value></strong></div>
                <div class="detail-row" data-block-row><span data-block-label></span><strong data-block-value></strong></div>
                <div class="detail-row" data-native-row><span data-native-label></span><strong data-native-value></strong></div>
                <div class="detail-row"><span data-safety-label></span><strong data-safety-value></strong></div>
                <p data-summary></p>
              </section>
            </section>
          </div>
        </div>
      </ha-card>${this._styles()}`;
    this.shadowRoot.addEventListener("click", this._onClick);
    this.shadowRoot.addEventListener("input", this._onInput);
    this.shadowRoot.addEventListener("change", this._onChange);
    this._structureReady = true;
  }

  _node(selector) {
    return this.shadowRoot?.querySelector(selector);
  }

  _text(selector, value) {
    const node = this._node(selector);
    const text = String(value ?? "");
    if (node && node.textContent !== text) node.textContent = text;
  }

  _hidden(selector, value) {
    const node = this._node(selector);
    if (node && node.hidden !== Boolean(value)) node.hidden = Boolean(value);
  }

  _eventNode(event, selector) {
    if (event.currentTarget?.matches?.(selector)) return event.currentTarget;
    const pathMatch = event.composedPath?.().find((node) => node?.matches?.(selector));
    return pathMatch || event.target.closest?.(selector);
  }

  _minutesFromTime(value) {
    const [hours = 0, minutes = 0] = String(value || "00:00").split(":").map(Number);
    return Math.max(0, Math.min(1439, (hours * 60) + minutes));
  }

  _timeFromMinutes(value) {
    const minutes = Math.max(0, Math.min(1439, Number(value) || 0));
    return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  }

  _selectedScheduleDay(schedule) {
    const day = schedule[this._selectedDay] || {};
    if (this._scheduleDraft?.index === this._selectedDay && !this._scheduleDraft.holidayScope) {
      return { ...day, ...this._scheduleDraft };
    }
    return day;
  }

  _holidayScopeForDay(index, workdayState) {
    const todayIndex = (new Date().getDay() + 6) % 7;
    return index >= 5 || (workdayState === "off" && index === todayIndex)
      ? "weekend"
      : "weekday";
  }

  _scheduleEditorState(schedule) {
    const day = this._selectedScheduleDay(schedule);
    const attrs = this._hass?.states?.[this._config?.entity]?.attributes || {};
    const controls = attrs.controls || {};
    const guards = attrs.guards || {};
    const settings = attrs.settings || {};
    const holiday = Boolean(
      controls.holiday_mode
      && this._hass?.states?.[controls.holiday_mode]?.state === "on"
      && settings.holiday_enabled !== false
    );
    const workdayState = guards.workday ? this._hass?.states?.[guards.workday]?.state : null;
    const holidayScope = holiday
      ? this._holidayScopeForDay(this._selectedDay, workdayState)
      : null;
    const configuredTime = holidayScope === "weekend"
      ? settings.holiday_weekend_time || settings.holiday_time
      : holidayScope === "weekday"
        ? settings.holiday_time
        : day.time;
    const draftMatches = this._scheduleDraft?.index === this._selectedDay
      && (this._scheduleDraft.holidayScope || null) === holidayScope;
    return {
      day,
      enabled: day.enabled !== false,
      holidayScope,
      time: String(draftMatches ? this._scheduleDraft.time : configuredTime || "06:00").slice(0, 5),
    };
  }

  _patchScheduleEditor(schedule, t) {
    const { day, enabled, holidayScope, time } = this._scheduleEditorState(schedule);
    const timeLabel = holidayScope === "weekend"
      ? t.holidayWeekendTime
      : holidayScope === "weekday" ? t.holidayWeekdayTime : t.alarmTime;
    this._text("[data-editor-day]", t.days[this._selectedDay] || day.day || "");
    this._text("[data-alarm-time-label]", timeLabel);
    this._text("[data-slider-output]", time);
    this._text("[data-day-toggle-label]", enabled ? t.dayActive : t.dayInactive);
    const slider = this._node("[data-schedule-slider]");
    const timeInput = this._node("[data-schedule-time]");
    const toggle = this._node('[data-action="toggle-day"]');
    const minutes = String(this._minutesFromTime(time));
    if (slider && slider.value !== minutes) slider.value = minutes;
    if (timeInput && timeInput.value !== time) timeInput.value = time;
    if (timeInput?.getAttribute("aria-label") !== timeLabel) timeInput?.setAttribute("aria-label", timeLabel);
    toggle?.classList.toggle("selected", enabled);
    toggle?.setAttribute("aria-pressed", String(enabled));
  }

  _render() {
    this._ensureStructure();
    this._patch();
  }

  _patch() {
    if (!this.shadowRoot || !this._config) return;
    this._ensureStructure();
    const lang = this._lang();
    const t = TEXT[lang];
    const entity = this._hass?.states?.[this._config.entity];
    const card = this._node("ha-card");
    this._text("[data-unavailable]", t.unavailable);
    this._text("[data-missing-entity]", this._config.entity);
    this._hidden("[data-missing]", Boolean(entity));
    this._hidden("[data-card-body]", !entity);
    if (!entity) {
      if (card) {
        if (card.className !== "clock state-unavailable") card.className = "clock state-unavailable";
        if (card.dataset.state !== "unavailable") card.dataset.state = "unavailable";
      }
      return;
    }
    const attrs = entity.attributes || {};
    const controls = attrs.controls || {};
    const guards = attrs.guards || {};
    const settings = attrs.settings || {};
    const active = ["pre_alarm", "ringing", "snoozed"].includes(entity.state);
    const mode = this._mode();
    const schedule = Array.isArray(attrs.schedule) ? attrs.schedule : [];
    if (this._scheduleDraft) {
      if (this._scheduleDraft.holidayScope) {
        const key = this._scheduleDraft.holidayScope === "weekend"
          ? "holiday_weekend_time"
          : "holiday_time";
        if (String(settings[key] || "").slice(0, 5) === this._scheduleDraft.time) {
          this._scheduleDraft = null;
        }
      } else {
        const saved = schedule[this._scheduleDraft.index];
        if (
          saved
          && String(saved.time || "").slice(0, 5) === this._scheduleDraft.time
          && Boolean(saved.enabled) === Boolean(this._scheduleDraft.enabled)
        ) this._scheduleDraft = null;
      }
    }
    const target = this._targetDate(attrs);
    const enabled = controls.enabled && this._hass.states[controls.enabled]?.state === "on";
    const skipped = controls.skip_next && this._hass.states[controls.skip_next]?.state === "on";
    const holiday = controls.holiday_mode && this._hass.states[controls.holiday_mode]?.state === "on";
    const vacationEntity = guards.vacation || controls.vacation_mode;
    const vacation = vacationEntity && this._hass.states[vacationEntity]?.state === "on";
    const statusText = t[entity.state] || entity.state;
    const workdayState = guards.workday ? this._hass.states[guards.workday]?.state : null;
    const dayLabel = target ? target.toLocaleDateString(lang, { weekday: "long" }) : "";
    const dayKind = workdayState === "on" ? t.workday : workdayState === "off" ? t.nonWorkday : t.weekly;
    if (card) {
      const cardClass = `clock ${mode} state-${entity.state}`;
      if (card.className !== cardClass) card.className = cardClass;
      if (card.dataset.state !== entity.state) card.dataset.state = entity.state;
    }
    const status = this._node(".status-pill");
    status?.classList.toggle("enabled", Boolean(enabled));
    this._text("[data-brand]", t.brand);
    this._text("[data-status]", statusText);
    this._text("[data-title]", this._config.title || attrs.name || attrs.friendly_name || "Clock Advanced");
    this._text("[data-time]", this._formatTime(target, lang));
    this._text("[data-context]", `${dayLabel}${dayLabel ? " · " : ""}${dayKind}`);
    this._hidden("[data-metrics]", !active);
    this._text("[data-repeats]", `${attrs.repeat_count || 0} ${t.repeats}`);
    this._text("[data-snoozes]", `${attrs.snooze_count || 0} ${t.snoozes}`);
    const scheduleNode = this._node("[data-schedule]");
    if (scheduleNode?.getAttribute("aria-label") !== t.schedule) scheduleNode?.setAttribute("aria-label", t.schedule);
    this._hidden("[data-schedule]", mode !== "advanced" || !schedule.length);
    const holidayWeekdayTime = holiday && settings.holiday_enabled !== false
      ? String(settings.holiday_time || "").slice(0, 5)
      : "";
    const holidayWeekendTime = holiday && settings.holiday_enabled !== false
      ? String(settings.holiday_weekend_time || settings.holiday_time || "").slice(0, 5)
      : "";
    scheduleNode?.classList.toggle("holiday-active", Boolean(holidayWeekdayTime));
    for (let index = 0; index < 7; index += 1) {
      const day = schedule[index] || {};
      const dayNode = this._node(`[data-day="${index}"]`);
      if (!dayNode) continue;
      const dayClass = `day ${day.enabled ? "on" : "off"}${index === this._selectedDay ? " selected" : ""}`;
      if (dayNode.className !== dayClass) dayNode.className = dayClass;
      const dayParts = dayNode.querySelectorAll("span,strong");
      const dayLabelText = t.days[index] || day.day || "";
      const holidayScope = this._holidayScopeForDay(index, workdayState);
      let effectiveHolidayTime = holidayScope === "weekend"
        ? holidayWeekendTime
        : holidayWeekdayTime;
      if (this._scheduleDraft?.holidayScope === holidayScope) {
        effectiveHolidayTime = this._scheduleDraft.time;
      }
      const dayTimeText = day.enabled ? effectiveHolidayTime || String(day.time || "").slice(0, 5) : "—";
      if (dayParts[0] && dayParts[0].textContent !== dayLabelText) dayParts[0].textContent = dayLabelText;
      if (dayParts[1] && dayParts[1].textContent !== dayTimeText) dayParts[1].textContent = dayTimeText;
    }
    this._patchScheduleEditor(schedule, t);

    this._hidden("[data-primary-actions]", !active);
    const snoozeButton = this._node('[data-action="press-snooze"]');
    const dismissButton = this._node('[data-action="press-dismiss"]');
    const snoozeDisabled = !attrs.snooze_available || !controls.snooze;
    const dismissDisabled = !controls.dismiss;
    if (snoozeButton && snoozeButton.disabled !== snoozeDisabled) snoozeButton.disabled = snoozeDisabled;
    if (dismissButton && dismissButton.disabled !== dismissDisabled) dismissButton.disabled = dismissDisabled;
    this._text("[data-snooze-label]", t.snooze);
    this._text("[data-dismiss-label]", t.dismiss);

    const skipButton = this._node('[data-action="toggle-skip"]');
    const holidayButton = this._node('[data-action="toggle-holiday"]');
    const vacationButton = this._node('[data-action="toggle-vacation"]');
    const detailsButton = this._node('[data-action="toggle-details"]');
    skipButton?.classList.toggle("selected", Boolean(skipped));
    skipButton?.classList.toggle("warning", Boolean(skipped));
    const skipDisabled = !controls.skip_next;
    if (skipButton && skipButton.disabled !== skipDisabled) skipButton.disabled = skipDisabled;
    holidayButton?.classList.toggle("selected", Boolean(holiday));
    holidayButton?.classList.toggle("holiday", Boolean(holiday));
    const holidayDisabled = !controls.holiday_mode;
    if (holidayButton && holidayButton.disabled !== holidayDisabled) holidayButton.disabled = holidayDisabled;
    vacationButton?.classList.toggle("selected", Boolean(vacation));
    const vacationDisabled = !vacationEntity;
    if (vacationButton && vacationButton.disabled !== vacationDisabled) vacationButton.disabled = vacationDisabled;
    this._hidden('[data-action="toggle-holiday"]', attrs.schedule_source === "schedule_entity");
    const activeOptionCount = [skipped, holiday, vacation].filter(Boolean).length;
    this._hidden("[data-menu-shell]", mode === "compact");
    this._text("[data-skip-label]", t.skip);
    this._text("[data-holiday-label]", t.holiday);
    this._text("[data-vacation-label]", t.vacationMode);
    this._text("[data-details-label]", this._detailsOpen ? t.closeOptions : t.options);
    this._text("[data-options-heading]", t.options);
    this._text("[data-options-summary]", activeOptionCount ? `${activeOptionCount} ${t.activeOptions}` : "");
    this._text("[data-options-count]", String(activeOptionCount));
    this._hidden("[data-options-count]", !activeOptionCount);
    detailsButton?.classList.toggle("selected", this._detailsOpen || activeOptionCount > 0);
    detailsButton?.setAttribute("aria-expanded", String(this._detailsOpen));
    const detailsIcon = this._node("[data-details-icon]");
    const detailsIconValue = this._detailsOpen ? "mdi:close" : "mdi:tune-variant";
    if (detailsIcon?.getAttribute("icon") !== detailsIconValue) detailsIcon?.setAttribute("icon", detailsIconValue);

    this._hidden("[data-control-menu]", mode === "compact" || !this._detailsOpen);
    this._hidden("[data-details]", mode !== "advanced");
    this._text("[data-source-label]", t.source);
    this._text("[data-source-value]", t[attrs.schedule_source] || t.weekly);
    this._text("[data-workday-label]", t.workdayRule);
    this._text("[data-workday-value]", `${this._guardLabel(guards.workday, lang)}${workdayState ? ` · ${workdayState === "on" ? t.workday : t.nonWorkday}` : ""}`);
    this._text("[data-confirmation-label]", t.confirmation);
    this._text("[data-confirmation-value]", this._guardLabel(guards.confirmation, lang));
    this._hidden("[data-allow-row]", !guards.allow);
    this._text("[data-allow-label]", t.allowedWhen);
    this._text("[data-allow-value]", `${this._guardLabel(guards.allow, lang)} = ${settings.allow_state ?? "—"}`);
    this._hidden("[data-block-row]", !guards.block);
    this._text("[data-block-label]", t.blockedWhen);
    this._text("[data-block-value]", `${this._guardLabel(guards.block, lang)} = ${settings.block_state ?? "—"}`);
    this._hidden("[data-native-row]", !guards.native_conditions);
    this._text("[data-native-label]", t.nativeConditions);
    this._text("[data-native-value]", `${guards.native_conditions || 0} ${t.conditions}`);
    this._text("[data-safety-label]", t.safety);
    this._text("[data-safety-value]", `${t.after} ${settings.timeout_minutes ?? "—"} ${t.minutes}`);
    this._text("[data-summary]", t.summary);
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
    const button = this._eventNode(event, "[data-action]");
    if (!button || button.disabled || !this._hass) return;
    const attrs = this._hass.states[this._config.entity]?.attributes || {};
    const controls = attrs.controls || {};
    const guards = attrs.guards || {};
    const action = button.dataset.action;
    if (action === "select-day") {
      this._selectedDay = Number(button.dataset.day) || 0;
      this._scheduleDraft = null;
      this._patch();
      return;
    }
    if (action === "toggle-day") {
      const schedule = Array.isArray(attrs.schedule) ? attrs.schedule : [];
      const day = this._selectedScheduleDay(schedule);
      await this._saveWeekday(String(day.time || "06:00").slice(0, 5), day.enabled === false);
      return;
    }
    if (action === "more-info") {
      const ev = new Event("hass-more-info", { bubbles: true, composed: true });
      ev.detail = { entityId: this._config.entity };
      this.dispatchEvent(ev);
      return;
    }
    if (action === "toggle-details") {
      this._detailsOpen = !this._detailsOpen;
      this._patch();
      return;
    }
    const map = {
      "toggle-enabled": controls.enabled,
      "toggle-skip": controls.skip_next,
      "toggle-holiday": controls.holiday_mode,
      "toggle-vacation": guards.vacation || controls.vacation_mode,
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

  _onInput(event) {
    const slider = this._eventNode(event, "[data-schedule-slider]");
    const timeInput = this._eventNode(event, "[data-schedule-time]");
    if (!slider && !timeInput) return;
    const schedule = this._hass?.states?.[this._config?.entity]?.attributes?.schedule || [];
    const current = this._scheduleEditorState(schedule);
    const time = slider
      ? this._timeFromMinutes(slider.value)
      : String(timeInput.value || "00:00").slice(0, 5);
    this._scheduleDraft = {
      index: this._selectedDay,
      time,
      enabled: current.enabled,
      holidayScope: current.holidayScope,
    };
    const linked = slider ? this._node("[data-schedule-time]") : this._node("[data-schedule-slider]");
    const linkedValue = slider ? time : String(this._minutesFromTime(time));
    if (linked && linked.value !== linkedValue) linked.value = linkedValue;
    this._text("[data-slider-output]", time);
    const attrs = this._hass?.states?.[this._config?.entity]?.attributes || {};
    const guards = attrs.guards || {};
    const workdayState = guards.workday ? this._hass?.states?.[guards.workday]?.state : null;
    for (let index = 0; index < 7; index += 1) {
      if (current.holidayScope && this._holidayScopeForDay(index, workdayState) !== current.holidayScope) continue;
      if (!current.holidayScope && index !== this._selectedDay) continue;
      const dayTime = this._node(`[data-day="${index}"] strong`);
      if (dayTime && dayTime.textContent !== time.slice(0, 5)) dayTime.textContent = time.slice(0, 5);
    }
  }

  async _onChange(event) {
    const slider = this._eventNode(event, "[data-schedule-slider]");
    const timeInput = this._eventNode(event, "[data-schedule-time]");
    if (!slider && !timeInput) return;
    const time = slider
      ? this._timeFromMinutes(slider.value)
      : String(timeInput.value || "00:00").slice(0, 5);
    const schedule = this._hass?.states?.[this._config?.entity]?.attributes?.schedule || [];
    const current = this._scheduleEditorState(schedule);
    if (current.holidayScope) {
      await this._saveHolidayTime(time, current.holidayScope, current.enabled);
    } else {
      await this._saveWeekday(time, current.enabled);
    }
  }

  async _saveWeekday(time, enabled) {
    const entity = this._hass?.states?.[this._config?.entity];
    if (!entity || entity.attributes?.schedule_source === "schedule_entity") return;
    this._scheduleDraft = { index: this._selectedDay, time, enabled, holidayScope: null };
    this._patchScheduleEditor(entity.attributes?.schedule || [], TEXT[this._lang()]);
    try {
      await this._hass.callService("clock_advanced", "set_weekday_alarm", {
        entity_id: this._config.entity,
        day: WEEKDAYS[this._selectedDay],
        time: `${time}:00`,
        enabled,
      });
    } catch (error) {
      this._scheduleDraft = null;
      this._patch();
      throw error;
    }
  }

  async _saveHolidayTime(time, scope, enabled) {
    const entity = this._hass?.states?.[this._config?.entity];
    if (!entity || entity.attributes?.schedule_source === "schedule_entity") return;
    this._scheduleDraft = {
      index: this._selectedDay,
      time,
      enabled,
      holidayScope: scope,
    };
    this._patchScheduleEditor(entity.attributes?.schedule || [], TEXT[this._lang()]);
    try {
      await this._hass.callService("clock_advanced", "set_holiday_time", {
        entity_id: this._config.entity,
        scope,
        time: `${time}:00`,
      });
    } catch (error) {
      this._scheduleDraft = null;
      this._patch();
      throw error;
    }
  }

  _styles() {
    return `<style>
      :host { display:block; width:100%; max-width:100%; min-width:0; overflow:visible; overflow-anchor:none; container-type:inline-size; --ca-accent:#93c5fd; --ca-warm:#f7ca78; --ca-selection:#fbbf24; }
      * { box-sizing:border-box; min-width:0; }
      [hidden] { display:none!important; }
      ha-card { position:relative; display:block; width:100%; max-width:100%; overflow:hidden; padding:16px; color:var(--primary-text-color,#fff); background:var(--ha-card-background,var(--card-background-color,#202020)); border:1px solid rgba(255,255,255,.09); border-radius:22px; box-shadow:none; }
      .state-scheduled { background:linear-gradient(135deg,rgba(59,130,246,.13),var(--ha-card-background,var(--card-background-color,#202020)) 72%); }
      .state-ringing,.state-pre_alarm { background:linear-gradient(135deg,rgba(251,146,60,.22),var(--ha-card-background,var(--card-background-color,#202020)) 72%); }
      .state-snoozed { background:linear-gradient(135deg,rgba(167,139,250,.18),var(--ha-card-background,var(--card-background-color,#202020)) 72%); }
      .state-vacation { background:linear-gradient(135deg,rgba(45,212,191,.16),var(--ha-card-background,var(--card-background-color,#202020)) 72%); }
      .state-blocked { background:linear-gradient(135deg,rgba(251,191,36,.17),var(--ha-card-background,var(--card-background-color,#202020)) 72%); }
      .state-timeout,.state-error { background:linear-gradient(135deg,rgba(248,113,113,.22),var(--ha-card-background,var(--card-background-color,#202020)) 72%); }
      .state-disabled { background:linear-gradient(135deg,rgba(148,163,184,.12),var(--ha-card-background,var(--card-background-color,#202020)) 72%); }
      .state-ringing,.state-pre_alarm { --ca-accent:#fb923c; --ca-warm:#fb923c; }
      .state-snoozed { --ca-accent:#a78bfa; --ca-warm:#a78bfa; }
      .state-timeout,.state-error { --ca-accent:#f87171; --ca-warm:#f87171; }
      .state-vacation { --ca-accent:#5eead4; --ca-warm:#5eead4; }
      .state-blocked { --ca-accent:#fbbf24; --ca-warm:#fbbf24; }
      .state-disabled { --ca-accent:#94a3b8; --ca-warm:#94a3b8; }
      header,.brand-lockup,.toggles,.primary-actions,.context { display:flex; align-items:center; }
      header { justify-content:space-between; gap:10px; }
      .brand-lockup { min-width:0; gap:9px; }
      ha-icon { display:grid; place-items:center; align-content:center; justify-content:center; flex:0 0 18px; width:18px; height:18px; min-width:18px; max-width:18px; --mdc-icon-size:16px; line-height:0; margin:0; padding:0; position:static; }
      .brand-logo { position:relative; display:grid; place-items:center; align-content:center; justify-content:center; flex:0 0 30px; width:30px; height:30px; color:var(--ca-accent); border-radius:50%; background:rgba(255,255,255,.07); box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--ca-accent) 28%,transparent); transition:color .35s ease,background-color .35s ease,box-shadow .35s ease,opacity .35s ease; transform-origin:50% 55%; }
      .logo-icon { --mdc-icon-size:19px; width:19px; height:19px; min-width:19px; max-width:19px; position:relative; z-index:2; filter:drop-shadow(0 0 5px color-mix(in srgb,var(--ca-accent) 40%,transparent)); }
      .logo-orbit { position:absolute; inset:3px; z-index:1; border:1px solid color-mix(in srgb,var(--ca-accent) 58%,transparent); border-radius:50%; opacity:.42; }
      .brand-logo::before,.brand-logo::after { content:""; position:absolute; pointer-events:none; border-radius:50%; }
      .brand-logo::before { inset:-3px; border:1px solid color-mix(in srgb,var(--ca-accent) 36%,transparent); opacity:0; }
      .brand-logo::after { inset:8px; z-index:0; background:color-mix(in srgb,var(--ca-accent) 28%,transparent); filter:blur(4px); opacity:.35; }
      .brand { color:var(--secondary-text-color); font-size:.7rem; font-weight:800; letter-spacing:.13em; }
      .status-pill { display:flex; align-items:center; justify-content:center; gap:7px; min-height:30px; border:0; border-radius:999px; padding:6px 10px; background:rgba(255,255,255,.085); color:var(--primary-text-color); font-size:.68rem; font-weight:850; line-height:1; }
      .status-pill i { width:7px; height:7px; border-radius:50%; background:var(--ca-accent); }
      .state-scheduled .brand-logo::before { animation:ca-logo-pulse 3.2s ease-out infinite; }
      .state-pre_alarm .brand-logo { animation:ca-logo-rise 2.2s ease-in-out infinite; }
      .state-pre_alarm .brand-logo::before { animation:ca-logo-pulse 1.8s ease-out infinite; }
      .state-ringing .brand-logo { animation:ca-logo-ring .58s ease-in-out infinite; background:color-mix(in srgb,var(--ca-accent) 22%,var(--card-background-color)); box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--ca-accent) 52%,transparent),0 0 16px color-mix(in srgb,var(--ca-accent) 25%,transparent); }
      .state-ringing .brand-logo::before { animation:ca-logo-pulse .9s ease-out infinite; }
      .state-snoozed .brand-logo { animation:ca-logo-sleep 3.4s ease-in-out infinite; }
      .state-vacation .brand-logo { animation:ca-logo-vacation 5.5s ease-in-out infinite; }
      .state-dismissed .brand-logo { animation:ca-logo-confirm .7s ease-out 1; }
      .state-skipped .brand-logo { animation:ca-logo-skip .65s ease-out 1; }
      .state-timeout .brand-logo,.state-error .brand-logo { animation:ca-logo-alert 1.25s ease-in-out infinite; }
      .state-disabled .brand-logo,.state-idle .brand-logo { opacity:.72; }
      @keyframes ca-logo-pulse { 0% { transform:scale(.72); opacity:.6; } 70%,100% { transform:scale(1.28); opacity:0; } }
      @keyframes ca-logo-rise { 0%,100% { transform:translateY(1px); } 50% { transform:translateY(-2px); } }
      @keyframes ca-logo-ring { 0%,100% { transform:rotate(0); } 20% { transform:rotate(-10deg); } 40% { transform:rotate(8deg); } 60% { transform:rotate(-6deg); } 80% { transform:rotate(4deg); } }
      @keyframes ca-logo-sleep { 0%,100% { transform:scale(.94); opacity:.72; } 50% { transform:scale(1.03); opacity:1; } }
      @keyframes ca-logo-vacation { 0%,100% { transform:rotate(-2deg) translateY(0); } 50% { transform:rotate(3deg) translateY(-1px); } }
      @keyframes ca-logo-confirm { 0% { transform:scale(.75) rotate(-12deg); } 62% { transform:scale(1.13) rotate(5deg); } 100% { transform:scale(1) rotate(0); } }
      @keyframes ca-logo-skip { 0% { transform:translateX(-4px); opacity:.35; } 55% { transform:translateX(3px); opacity:1; } 100% { transform:translateX(0); } }
      @keyframes ca-logo-alert { 0%,100% { box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--ca-accent) 45%,transparent),0 0 0 transparent; } 50% { box-shadow:inset 0 0 0 1px var(--ca-accent),0 0 15px color-mix(in srgb,var(--ca-accent) 34%,transparent); } }
      h2 { margin:3px 0 0; font-size:.76rem; font-weight:760; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      button { box-sizing:border-box; font:inherit; color:inherit; cursor:pointer; line-height:1; }
      button:disabled { opacity:.42; cursor:not-allowed; }
      main { padding:19px 0 14px; }
      .time { font-size:2.75rem; line-height:.95; font-weight:680; letter-spacing:-.055em; font-variant-numeric:tabular-nums; }
      .context { justify-content:space-between; gap:8px; margin-top:9px; color:var(--secondary-text-color); font-size:.72rem; }
      .countdown { flex:0 0 13ch; min-width:13ch; color:var(--ca-accent); font-size:.66rem; font-variant-numeric:tabular-nums; white-space:nowrap; text-align:right; }
      .metrics { display:flex; gap:12px; margin-top:8px; font-size:.68rem; color:var(--secondary-text-color); }
      .schedule { margin-top:1px; }
      .days { display:grid; grid-template-columns:repeat(7,minmax(0,1fr)); gap:5px; }
      .day { min-width:0; border:1px solid transparent; color:inherit; text-align:center; padding:7px 1px; border-radius:11px; background:rgba(255,255,255,.047); }
      .day span,.day strong { display:block; font-size:.62rem; }
      .day span { color:var(--secondary-text-color); }
      .day strong { margin-top:4px; font-size:.72rem; font-variant-numeric:tabular-nums; }
      .day.off { opacity:.42; }
      .day.selected { opacity:1; border-color:var(--ca-selection); background:color-mix(in srgb,var(--ca-selection) 10%,rgba(255,255,255,.047)); box-shadow:0 0 0 1px color-mix(in srgb,var(--ca-selection) 40%,transparent); }
      .schedule.holiday-active .day.on strong { color:var(--ca-accent); }
      .day.selected span,.day.selected strong,.schedule.holiday-active .day.selected strong { color:var(--ca-selection); }
      .schedule-editor { display:grid; gap:9px; margin-top:9px; padding:11px; overflow:hidden; border-radius:14px; background:rgba(255,255,255,.047); }
      .schedule-editor-head,.time-slider-label { display:flex; align-items:center; justify-content:space-between; gap:10px; }
      .schedule-editor-head>strong { font-size:.75rem; }
      .day-toggle { display:flex; align-items:center; justify-content:center; gap:5px; min-height:31px; padding:5px 9px; border:1px solid rgba(255,255,255,.10); border-radius:999px; background:rgba(255,255,255,.035); font-size:.68rem; }
      .day-toggle.selected { color:var(--ca-accent); border-color:color-mix(in srgb,var(--ca-accent) 62%,var(--divider-color)); }
      .time-slider-label { color:var(--secondary-text-color); font-size:.68rem; }
      .time-slider-label output { color:var(--primary-text-color); font-weight:750; font-variant-numeric:tabular-nums; }
      [data-schedule-slider] { width:100%; margin:0; accent-color:var(--ca-accent); }
      [data-schedule-time] { display:block; box-sizing:border-box; inline-size:100%; width:100%; max-inline-size:100%; max-width:100%; min-width:0; min-height:36px; margin:0 auto; padding:6px 10px; overflow:hidden; border:1px solid var(--divider-color); border-radius:10px; background:var(--card-background-color); color:var(--primary-text-color); font:inherit; font-size:16px; font-variant-numeric:tabular-nums; text-align:center; color-scheme:dark light; -webkit-appearance:none; appearance:none; }
      [data-schedule-time]::-webkit-date-and-time-value { min-width:0; margin:0; text-align:center; }
      [data-schedule-time]::-webkit-datetime-edit { display:flex; justify-content:center; min-width:0; padding:0; }
      .primary-actions { gap:8px; margin-top:12px; }
      .primary { flex:1; min-width:0; min-height:38px; border:0; border-radius:13px; padding:10px 7px; display:flex; gap:6px; justify-content:center; align-items:center; font-size:.72rem; font-weight:750; }
      .snooze { background:color-mix(in srgb,#8b5cf6 20%,var(--card-background-color)); color:#c4b5fd; }
      .dismiss { background:var(--ca-accent); color:#111827; }
      .menu-shell { position:relative; display:flex; justify-content:flex-end; margin-top:12px; }
      .menu-trigger { min-width:108px; justify-content:center; background:rgba(255,255,255,.07); }
      .menu-trigger small { display:grid; place-items:center; min-width:18px; height:18px; padding:0 4px; border-radius:999px; background:var(--ca-accent); color:#111827; font-size:.6rem; font-weight:850; }
      .control-menu { position:absolute; z-index:8; right:0; bottom:calc(100% + 8px); box-sizing:border-box; width:min(100%,340px); max-height:min(56vh,390px); overflow-y:auto; overscroll-behavior:contain; padding:12px; border:1px solid rgba(255,255,255,.10); border-radius:16px; background:var(--ha-card-background,var(--card-background-color,#202020)); box-shadow:0 14px 38px rgba(0,0,0,.34); }
      .menu-heading { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:1px 2px 10px; }
      .menu-heading strong { font-size:.75rem; }
      .menu-heading span { color:var(--ca-accent); font-size:.65rem; }
      .toggles { flex-wrap:wrap; gap:8px; margin:0; }
      .chip { display:flex; gap:5px; align-items:center; justify-content:center; min-height:35px; padding:7px 11px; border-radius:999px; border:1px solid rgba(255,255,255,.08); background:rgba(255,255,255,.065); font-size:.7rem; }
      .chip.selected { background:color-mix(in srgb,var(--ca-warm) 16%,transparent); border-color:color-mix(in srgb,var(--ca-warm) 50%,var(--divider-color)); }
      .chip.vacation.selected { color:#5eead4; border-color:color-mix(in srgb,#5eead4 58%,var(--divider-color)); background:color-mix(in srgb,#5eead4 14%,transparent); }
      .details { display:grid; gap:12px; margin-top:12px; padding-top:12px; border-top:1px solid var(--divider-color); }
      .detail-row { display:grid; gap:4px; }
      .detail-row span { color:var(--secondary-text-color); font-size:.7rem; }
      .detail-row strong { font-size:.75rem; line-height:1.3; }
      .details p { margin:0; color:var(--secondary-text-color); font-size:.7rem; line-height:1.5; }
      .missing { padding:24px; display:grid; gap:8px; } .missing small { color:var(--secondary-text-color); }
      .compact .schedule,.compact .menu-shell { display:none; }
      .compact main { padding-bottom:4px; }
      .easy .schedule,.easy .details { display:none; }
      @container (max-width:300px) { ha-card { padding:13px; border-radius:19px; } .brand-lockup { gap:7px; } .brand-logo { flex-basis:27px; width:27px; height:27px; } .logo-icon { --mdc-icon-size:17px; } .time { font-size:2.45rem; } .brand { font-size:.62rem; } .status-pill { padding:7px 9px; } .context { align-items:flex-start; flex-direction:column; } .countdown { flex-basis:auto; min-width:0; text-align:left; } }
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
    this._config = {};
    this._hass = null;
    this._lastRenderSignature = "";
    this._structureReady = false;
  }

  static getConfigElement() {
    return document.createElement(BADGE_EDITOR_TAG);
  }

  static getStubConfig(hass) {
    const entity = Object.keys(hass?.states || {}).find((entityId) =>
      hass.states[entityId]?.attributes?.card_contract === 1);
    return {
      entity: entity || "sensor.clock_advanced_status",
      language: "auto",
      tap_action: { action: "more-info" },
    };
  }

  setConfig(config) {
    if (!config?.entity || !String(config.entity).startsWith("sensor.")) {
      throw new Error("Clock Advanced badge requires its status sensor entity");
    }
    this._config = { language: "auto", tap_action: { action: "more-info" }, ...config };
    this._lastRenderSignature = "";
    this._ensureStructure();
    this._patch();
  }

  set hass(value) {
    this._hass = value;
    const entity = value?.states?.[this._config.entity];
    const attrs = entity?.attributes || {};
    let signature;
    try {
      signature = JSON.stringify([
        this._config.entity,
        this._config.title,
        this._lang(),
        entity?.state,
        attrs.name,
        attrs.friendly_name,
        attrs.next_alarm,
        attrs.snooze_until,
        attrs.active_since,
      ]);
    } catch (_error) {
      signature = `${this._config.entity || ""}:${entity?.state || ""}:${entity?.last_changed || ""}`;
    }
    if (signature === this._lastRenderSignature) return;
    this._lastRenderSignature = signature;
    this._patch();
  }

  _performNativeTapAction() {
    const entityId = String(this._config.entity || "");
    if (!entityId) return;
    this.dispatchEvent(new CustomEvent("hass-action", {
      bubbles: true,
      composed: true,
      detail: { action: "tap", config: { ...this._config, entity: entityId } },
    }));
  }

  _bindInteraction() {
    const badge = this.shadowRoot?.querySelector?.("ha-badge");
    if (!badge || this._interactionBound) return;
    this._interactionBound = true;
    badge.addEventListener?.("click", (event) => {
      event.stopPropagation?.();
      this._performNativeTapAction();
    });
    badge.addEventListener?.("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault?.();
      this._performNativeTapAction();
    });
  }

  _lang() {
    const configured = this._config?.language;
    if (configured === "de" || configured === "en") return configured;
    return String(this._hass?.language || navigator.language || "en").toLowerCase().startsWith("de") ? "de" : "en";
  }

  _stateIcon(status) {
    return ({
      scheduled: "mdi:calendar-check", idle: "mdi:minus",
      ringing: "mdi:bell-ring", pre_alarm: "mdi:weather-sunset-up",
      snoozed: "mdi:alarm-snooze", vacation: "mdi:palm-tree",
      blocked: "mdi:shield-off", disabled: "mdi:power",
      dismissed: "mdi:check", skipped: "mdi:skip-next",
      timeout: "mdi:timer-alert", error: "mdi:alert-circle",
      unavailable: "mdi:alert-circle-outline",
    })[status] || "mdi:calendar-clock";
  }

  _color(status) {
    return ({
      ringing: "var(--orange-color,#fb923c)",
      pre_alarm: "var(--orange-color,#fb923c)",
      snoozed: "var(--purple-color,#a78bfa)",
      vacation: "var(--teal-color,#14b8a6)",
      blocked: "var(--amber-color,#fbbf24)",
      dismissed: "var(--green-color,#4caf50)",
      skipped: "var(--info-color,var(--primary-color,#039be5))",
      timeout: "var(--error-color,var(--red-color,#db4437))",
      error: "var(--error-color,var(--red-color,#db4437))",
      unavailable: "var(--error-color,var(--red-color,#db4437))",
      disabled: "var(--state-inactive-color,var(--secondary-text-color,#727272))",
      idle: "var(--state-inactive-color,var(--secondary-text-color,#727272))",
    })[status] || "var(--primary-color,#03a9f4)";
  }

  _formatMoment(value, lang) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    const sameDate = (left, right) => left.getFullYear() === right.getFullYear()
      && left.getMonth() === right.getMonth() && left.getDate() === right.getDate();
    const locale = lang === "de" ? "de-DE" : "en-GB";
    const day = sameDate(date, now)
      ? TEXT[lang].today
      : sameDate(date, tomorrow)
        ? TEXT[lang].tomorrow
        : new Intl.DateTimeFormat(locale, {
          weekday: "short", day: "2-digit", month: "2-digit",
        }).format(date);
    const time = new Intl.DateTimeFormat(locale, {
      hour: "2-digit", minute: "2-digit", hour12: false,
    }).format(date);
    return `${day}, ${time}`;
  }

  _statusDetails(entity, lang) {
    const t = TEXT[lang];
    const attrs = entity?.attributes || {};
    const mode = String(entity?.state || "unavailable");
    const status = t[mode] || mode;
    let timing = "";
    if (mode === "snoozed") {
      const moment = this._formatMoment(attrs.snooze_until, lang);
      if (moment) timing = `${lang === "de" ? "Schlummert bis" : "Snoozed until"} ${moment}`;
    } else if (["pre_alarm", "ringing"].includes(mode)) {
      const moment = this._formatMoment(attrs.active_since, lang);
      if (moment) timing = `${lang === "de" ? "Aktiv seit" : "Active since"} ${moment}`;
    } else {
      const moment = this._formatMoment(attrs.next_alarm, lang);
      timing = moment ? `${t.next}: ${moment}` : t.noAlarm;
    }
    return { mode, status, timing };
  }

  _ensureStructure() {
    if (!this.shadowRoot || this._structureReady) return;
    this.shadowRoot.innerHTML = `<style>
        :host{display:block;width:var(--ha-badge-size,36px);height:var(--ha-badge-size,36px)}
        ha-badge{--badge-color:var(--primary-color,#03a9f4)}
        .badge-symbol{position:relative;display:grid;place-items:center;width:22px;height:22px;color:var(--badge-color)}
        .clock-symbol{--mdc-icon-size:20px}
        .state-marker{position:absolute;right:-4px;bottom:-4px;display:grid;place-items:center;width:12px;height:12px;border-radius:50%;background:var(--ha-card-background,var(--card-background-color,#fff));box-shadow:0 0 0 1px var(--ha-card-border-color,var(--divider-color,#ddd));color:var(--badge-color)}
        .state-marker ha-icon{--mdc-icon-size:9px}
      </style>
      <ha-badge type="button" icon-only data-mode="unavailable">
        <span slot="icon" class="badge-symbol">
          <ha-icon class="clock-symbol" icon="mdi:alarm"></ha-icon>
          <span class="state-marker"><ha-icon data-state-icon icon="mdi:alert-circle-outline"></ha-icon></span>
        </span>
      </ha-badge>`;
    this._structureReady = true;
    this._bindInteraction();
  }

  _render() {
    this._ensureStructure();
    this._patch();
  }

  _patch() {
    if (!this.shadowRoot || !this._config) return;
    this._ensureStructure();
    const entity = this._hass?.states?.[this._config.entity];
    const lang = this._lang();
    const t = TEXT[lang];
    const badge = this.shadowRoot.querySelector("ha-badge");
    const mode = entity?.state || "unavailable";
    const marker = this.shadowRoot.querySelector("[data-state-icon]");
    const details = entity ? this._statusDetails(entity, lang) : null;
    const tooltip = entity
      ? [
        this._config.title || entity.attributes?.name || entity.attributes?.friendly_name || "Clock Advanced",
        details.status,
        details.timing,
      ].filter(Boolean).join(" · ")
      : t.unavailable;
    if (badge) {
      const color = this._color(mode);
      if (badge.dataset.mode !== mode) badge.dataset.mode = mode;
      if (badge.style.getPropertyValue("--badge-color") !== color) {
        badge.style.setProperty("--badge-color", color);
      }
      if (badge.getAttribute("title") !== tooltip) badge.setAttribute("title", tooltip);
      if (badge.getAttribute("aria-label") !== tooltip) badge.setAttribute("aria-label", tooltip);
    }
    const markerIcon = this._stateIcon(mode);
    if (marker?.getAttribute("icon") !== markerIcon) marker?.setAttribute("icon", markerIcon);
  }

}

class ClockAdvancedBadgeEditor extends HTMLElement {
  constructor() { super(); this.attachShadow({ mode: "open" }); }
  set hass(value) { this._hass = value; this._render(); }
  setConfig(config) { this._config = { language: "auto", ...config }; this._render(); }
  _render() {
    if (!this._config) return;
    const de = String(this._hass?.language || "en").toLowerCase().startsWith("de");
    this.shadowRoot.innerHTML = `<ha-form></ha-form>
      <div class="help">${de
        ? "Das Weckerlogo, Zusatzsymbol und die Farbe folgen dem Zustand. Entität, Interaktion und Sichtbarkeit werden mit Home Assistants nativen Editoren konfiguriert; dieses Badge besitzt keine eigenen Navigate-, Hidden- oder Zustandslisten."
        : "The clock logo, marker and color follow the state. Configure the entity, interaction and visibility with Home Assistant's native editors; this Badge has no separate Navigate, Hidden or state lists."}</div>
      <style>:host{display:block;padding:4px 0}.help{margin-top:12px;font-size:11px;line-height:1.4;color:var(--secondary-text-color)}</style>`;
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
      this._config = { ...this._config, ...(event.detail?.value || {}) };
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
