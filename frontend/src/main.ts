import "./style.css";
import { formatDate, formatNumber, getStoredLanguage, translate, type Language, type TranslationKey } from "./i18n";
import { loadAllEvents } from "./eventExport";
import { serializeCsvRows } from "./eventCsv";
import {
  ApiError,
  SafeVisionApi,
  type AlertStreamMessage,
  type AlertRecord,
  type CameraRecord,
  type EventFilters,
  type EventTypeRecord,
  type LocationRecord,
  type Metrics,
  type RiskEvent,
  type SubjectRecord,
  type ZoneRecord,
} from "./api";

type Page = "overview" | "cameras" | "events" | "alerts" | "subjects" | "locations" | "settings";
type Theme = "light" | "dark";
type DataResource = "health" | "metrics" | "recentEvents" | "alerts" | "cameras" | "events" | "subjects" | "locations" | "zones" | "eventTypes";
let language: Language = getStoredLanguage();
const t = (key: TranslationKey): string => translate(language, key);

const api = new SafeVisionApi();
const isLocalhost = (): boolean => import.meta.env.DEV && ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
const labels: Record<Page, TranslationKey> = {
  overview: "navOverview", cameras: "navCameras", events: "navEvents",
  alerts: "navAlerts", subjects: "navSubjects", locations: "navLocations", settings: "navSettings",
};
const pageResources: Record<Page, DataResource[]> = {
  overview: ["health", "metrics", "recentEvents", "alerts", "cameras"], cameras: ["cameras"],
  events: ["events", "cameras"], alerts: ["alerts"], subjects: ["subjects"],
  locations: ["locations", "zones"], settings: ["eventTypes"],
};
const icons: Record<string, string> = {
  overview: "<rect x='3' y='3' width='7' height='7' rx='1'/><rect x='14' y='3' width='7' height='7' rx='1'/><rect x='3' y='14' width='7' height='7' rx='1'/><rect x='14' y='14' width='7' height='7' rx='1'/>",
  cameras: "<rect x='3' y='6' width='13' height='12' rx='2'/><path d='m16 10 5-3v10l-5-3z'/>",
  events: "<circle cx='12' cy='12' r='9'/><path d='M12 7v5l3 2'/>",
  alerts: "<path d='m10.3 3.9-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3.1l-8-14a2 2 0 0 0-3.4 0Z'/><path d='M12 9v4m0 4h.01'/>",
  subjects: "<path d='M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm10-3v6m3-3h-6'/>",
  locations: "<path d='M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z'/><circle cx='12' cy='10' r='2.5'/>",
  settings: "<circle cx='12' cy='12' r='3'/><path d='m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.7a8 8 0 0 1-1.6.9l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.6-.9l-1.7.7-1.4-2.4 1.4-1.1a8 8 0 0 1 0-1.9l-1.4-1.1 1.4-2.4 1.7.7a8 8 0 0 1 1.6-.9l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.6.9l1.7-.7 1.4 2.4-1.4 1.1a8 8 0 0 1 0 1.9Z'/>",
  search: "<circle cx='11' cy='11' r='7'/><path d='m20 20-4-4'/>",
  refresh: "<path d='M20 7v5h-5M4 17v-5h5'/><path d='M5.6 9a7 7 0 0 1 11.7-2L20 12M4 12l2.7 5a7 7 0 0 0 11.7-2'/>",
  logout: "<path d='M10 17l5-5-5-5M15 12H3'/><path d='M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6'/>",
  shield: "<path d='M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z'/><path d='m9 12 2 2 4-4'/>",
};
const icon = (name: string) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] ?? icons.overview}</svg>`;
const brandLogo = (className = ""): string => { const theme = document.documentElement.dataset.theme === "light" ? "light" : "dark"; return `<img class="brand-logo ${className}" src="/images/safe-vision-ai-logo-${theme}.png" width="2172" height="724" alt="Safe Vision AI" draggable="false">`; };
const escapeHtml = (value: unknown): string => String(value ?? "—").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);

class SafeVisionFrontend {
  private page: Page = this.pageFromLocation();
  private theme: Theme = this.initialTheme();
  private reduceMotion = localStorage.getItem("safevision-reduce-motion") === "true";
  private authStatus = t("authChecking");
  private signInAvailable = false;
  private localDevSession = false;
  private backendSession = false;
  private alertSocket: WebSocket | null = null;
  private reconnectTimer: number | null = null;
  private reconnectAttempt = 0;
  private alertRefreshTimer: number | null = null;
  private cameraPollTimer: number | null = null;
  private alertStreamState: "connecting" | "connected" | "reconnecting" = "connecting";
  private loading = false;
  private actionError = "";
  private exportingCsv = false;
  private dataErrors: Partial<Record<DataResource, string>> = {};
  private loadingResources = new Set<DataResource>();
  private metrics: Metrics | null = null;
  private recentEvents: RiskEvent[] = [];
  private events: RiskEvent[] = [];
  private alerts: AlertRecord[] = [];
  private cameras: CameraRecord[] = [];
  private subjects: SubjectRecord[] = [];
  private locations: LocationRecord[] = [];
  private zones: ZoneRecord[] = [];
  private eventTypes: EventTypeRecord[] = [];
  private filters: EventFilters = { limit: 50, offset: 0 };
  private eventDetail: RiskEvent | null = null;
  private readonly root = document.querySelector<HTMLDivElement>("#app");

  initializeTheme(): void { this.applyTheme(); this.applyMotionPreference(); }
  activateLocalDevSession(): void { this.localDevSession = true; }
  async startPrivate(): Promise<void> {
    window.addEventListener("popstate", () => { this.page = this.pageFromLocation(); this.eventDetail = null; void this.loadPage(); });
    if (this.cameraPollTimer !== null) window.clearInterval(this.cameraPollTimer);
    this.cameraPollTimer = window.setInterval(() => {
      if (!this.backendSession || this.localDevSession || document.visibilityState === "hidden"
        || !["overview", "cameras", "events"].includes(this.page) || this.loading) return;
      void this.refreshCameraStatus();
    }, 30_000);
    await this.loadPage();
  }
  get authenticationStatus(): string { return this.authStatus; }
  get canSignInBackend(): boolean { return !import.meta.env.DEV || this.signInAvailable; }
  setAuthenticationStatus(message: string): void { this.authStatus = message; }
  async hasValidBackendSession(): Promise<boolean> {
    try {
      const session = await api.currentUser();
      if (session.authenticated !== true || !session.user?.id) throw new Error("Invalid session response");
      this.backendSession = true;
      this.authStatus = t("sessionValidated");
      this.startAlertStream();
      return true;
    } catch (error) {
      this.backendSession = false;
      if (error instanceof ApiError && error.status === 401) {
        this.authStatus = t("accessUnavailable");
      } else {
        console.error("Safe Vision AI: no se pudo validar la sesión", error);
        this.authStatus = t("accessFailed");
      }
      if (import.meta.env.DEV) await this.inspectAuthContract();
      return false;
    }
  }

  async signInBackend(email: string, password: string): Promise<void> {
    const login = await api.login(email, password);
    if (login.authenticated !== true || !login.user?.id) throw new Error(t("identityFailed"));
    const session = await api.currentUser();
    if (session.authenticated !== true || !session.user?.id) throw new Error(t("identityFailed"));
    this.backendSession = true;
    this.authStatus = t("sessionValidated");
    this.startAlertStream();
    await this.startPrivate();
  }

  private initialTheme(): Theme {
    const stored = localStorage.getItem("safevision-theme");
    if (stored === "light" || stored === "dark") return stored;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  private startAlertStream(): void {
    if (!this.backendSession || this.localDevSession) return;
    this.stopAlertStream();
    this.alertStreamState = "connecting";
    void this.connectAlertStream();
  }
  private stopAlertStream(): void {
    if (this.reconnectTimer !== null) window.clearTimeout(this.reconnectTimer);
    if (this.alertRefreshTimer !== null) window.clearTimeout(this.alertRefreshTimer);
    this.reconnectTimer = null;
    this.alertRefreshTimer = null;
    const socket = this.alertSocket;
    this.alertSocket = null;
    if (socket && socket.readyState < WebSocket.CLOSING) socket.close();
  }
  private async refreshCameraStatus(): Promise<void> {
    try {
      this.cameras = await api.cameras();
      delete this.dataErrors.cameras;
      this.render();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        this.backendSession = false;
        this.stopAlertStream();
        this.authStatus = t("sessionExpired");
        this.clearProtectedData();
        if (this.root) await new AccessGate(this.root, this).start();
        return;
      }
      this.dataErrors.cameras = this.reportError("loadCamerasError", error);
      this.render();
    }
  }
  private async connectAlertStream(): Promise<void> {
    if (!this.backendSession || this.localDevSession) return;
    try {
      const { ticket } = await api.wsTicket();
      if (!ticket || !this.backendSession) throw new Error("Missing WebSocket ticket");
      const socket = new WebSocket(api.alertWebSocketUrl(ticket));
      this.alertSocket = socket;
      socket.onopen = () => {
        if (this.alertSocket !== socket) return;
        this.reconnectAttempt = 0;
        this.alertStreamState = "connected";
        this.scheduleAlertRefresh();
        this.render();
      };
      socket.onmessage = event => {
        let message: AlertStreamMessage;
        try { message = JSON.parse(String(event.data)) as AlertStreamMessage; }
        catch { return; }
        if (message.tipo === "alerta_nueva" || message.tipo === "evento_revisado") this.scheduleAlertRefresh();
      };
      socket.onclose = event => {
        if (this.alertSocket !== socket) return;
        this.alertSocket = null;
        if (event.code === 4401) {
          this.backendSession = false;
          if (this.cameraPollTimer !== null) window.clearInterval(this.cameraPollTimer);
          this.cameraPollTimer = null;
          this.authStatus = t("sessionExpired");
          this.clearProtectedData();
          if (this.root) void new AccessGate(this.root, this).start();
          return;
        }
        this.scheduleAlertReconnect();
      };
      socket.onerror = () => socket.close();
    } catch (error) {
      console.warn("Safe Vision AI: no se pudo abrir el canal de alertas", error);
      this.scheduleAlertReconnect();
    }
  }
  private scheduleAlertReconnect(): void {
    if (!this.backendSession || this.localDevSession || this.reconnectTimer !== null) return;
    this.alertStreamState = "reconnecting";
    const delay = Math.min(30_000, 1_000 * (2 ** Math.min(this.reconnectAttempt++, 5)));
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      void this.connectAlertStream();
    }, delay);
    this.render();
  }
  private scheduleAlertRefresh(): void {
    if (this.alertRefreshTimer !== null) window.clearTimeout(this.alertRefreshTimer);
    this.alertRefreshTimer = window.setTimeout(() => {
      this.alertRefreshTimer = null;
      if (this.backendSession && !this.localDevSession && ["overview", "events", "alerts"].includes(this.page)) void this.loadPage();
    }, 150);
  }
  private applyTheme(): void { document.documentElement.dataset.theme = this.theme; }
  private applyMotionPreference(): void { document.documentElement.dataset.motion = this.reduceMotion ? "reduced" : "normal"; }
  private pageFromLocation(): Page {
    const key = window.location.pathname.replace(/^\/+|\/+$/g, "") as Page;
    return key in labels ? key : "overview";
  }
  private async inspectAuthContract(): Promise<void> {
    try {
      const spec = await api.request<{ paths?: Record<string, Record<string, { operationId?: string; summary?: string }>> }>("/openapi.json");
      const operations = Object.entries(spec.paths ?? {}).flatMap(([path, methods]) => Object.entries(methods).map(([method, operation]) => ({ path, method, operation })));
      this.signInAvailable = operations.some(({ path, method }) => path === "/api/auth/login" && method.toLowerCase() === "post")
        && operations.some(({ path, method }) => path === "/api/auth/me" && method.toLowerCase() === "get");
      this.authStatus = this.signInAvailable ? t("accessServiceReady") : t("accessUnavailable");
    } catch (error) {
      console.error("Safe Vision AI: no se pudo verificar el servicio de acceso", error);
      this.authStatus = t("accessCheckFailed");
    }
  }

  private render(): void {
    if (!this.root) return;
    this.root.innerHTML = `<div class="app-frame">${this.topbar()}<main class="main-area" aria-busy="${this.loading}"><section class="view-content">${this.pageView()}</section></main></div>`;
    this.bind();
  }
  private wordmark(className = ""): string {
    return brandLogo(className);
  }
  private navigation(): string {
    const nav: Page[] = ["overview", "cameras", "events", "alerts", "subjects", "locations", "settings"];
    return `<nav class="primary-navigation" aria-label="${t("navigationLabel")}">${nav.map(page => `<a class="nav-link ${this.page === page ? "selected" : ""}" href="/${page === "overview" ? "" : page}" data-page="${page}" ${this.page === page ? 'aria-current="page"' : ""}>${icon(page)}<span>${t(labels[page])}</span></a>`).join("")}</nav>`;
  }
  private topbar(): string {
    return `<header class="app-header"><div class="header-main"><a class="header-brand" href="/" data-page="overview">${this.wordmark()}</a><div class="top-actions"><button class="icon-button" id="theme-toggle" aria-label="${t("themeToggle")}">${this.theme === "dark" ? "☼" : "◐"}</button><span class="account-state" aria-label="${t("profile")}">${this.localDevSession || this.backendSession ? t("profile") : t("account")}</span>${this.localDevSession || this.backendSession ? `<button class="button secondary local-logout" data-action="logout">${t("logout")}</button>` : ""}</div></div>${this.navigation()}</header>`;
  }
  private pageView(): string {
    let view = "";
    switch (this.page) {
      case "overview": view = this.overviewView(); break;
      case "cameras": view = this.camerasView(); break;
      case "events": view = this.eventsView(); break;
      case "alerts": view = this.alertsView(); break;
      case "subjects": view = this.catalogView("subjectsTitle", this.subjects.map(s => ({ title: s.name, meta: s.subject_type, detail: s.description ?? "" })), "noSubjects", ["subjects"]); break;
      case "locations": view = this.catalogView("locationsTitle", [...this.locations.map(l => ({ title: l.name, meta: t("locationType"), detail: l.description ?? "" })), ...this.zones.map(z => ({ title: z.name, meta: z.is_active ? t("activeZone") : t("inactiveZone"), detail: z.description ?? "" }))], "noLocations", ["locations", "zones"]); break;
      case "settings": view = this.settingsView(); break;
    }
    return view;
  }
  private pageHeading(title: TranslationKey, subtitle?: TranslationKey, action = ""): string {
    return `<section class="page-heading"><div><h1>${t(title)}</h1>${subtitle ? `<p>${t(subtitle)}</p>` : ""}</div>${action}</section>`;
  }
  private overviewView(): string {
    const action = `<button class="button secondary" data-action="reload">${icon("refresh")} ${t("refresh")}</button>`;
    return `${this.pageHeading("overviewTitle", "overviewSubtitle", action)}<div class="metric-grid">${this.metricCard("totalEvents", this.metrics?.total)}${this.metricCard("pendingEvents", this.metrics?.pendientes)}${this.metricCard("highRiskEvents", this.metrics?.alto)}</div>${this.resourceNotice("metrics")}<div class="content-grid"><article class="panel"><div class="panel-title"><div><h2>${t("cameraStatus")}</h2></div><a href="/cameras" data-page="cameras">${t("seeCameras")}</a></div>${this.cameras.length ? `${this.cameras.slice(0, 5).map(c => this.cameraRow(c)).join("")}${this.resourceNotice("cameras")}` : this.dataOrEmpty("cameras", this.empty("noCameras", "noCamerasToShow"))}</article><article class="panel"><div class="panel-title"><div><h2>${t("recentAlerts")}</h2></div><a href="/alerts" data-page="alerts">${t("seeAlerts")}</a></div>${this.alerts.length ? `${this.alerts.slice(0, 5).map(a => this.alertRow(a)).join("")}${this.resourceNotice("alerts")}` : this.dataOrEmpty("alerts", this.empty("noAlerts", "noAlertsToShow"))}</article></div><article class="panel recent-panel"><div class="panel-title"><div><h2>${t("recentActivity")}</h2></div><a href="/events" data-page="events">${t("openHistory")}</a></div>${this.eventTable(this.recentEvents, true)}</article>`;
  }
  private metricCard(title: TranslationKey, value?: number): string {
    return `<article class="metric-card"><span>${t(title)}</span><strong>${value === undefined ? "—" : formatNumber(value, language)}</strong></article>`;
  }
  private camerasView(): string {
    const selected = this.cameras[0];
    const cameraCards = this.cameras.length ? `${this.cameras.map(c => this.cameraRow(c)).join("")}${this.resourceNotice("cameras")}` : this.dataOrEmpty("cameras", `<div class="empty-state compact-empty">${icon("cameras")}<b>${t("noCameraRecords")}</b><p>${t("noCamerasAvailable")}</p></div>`);
    const playerState = `<div class="video-waiting">${icon("cameras")}<strong>${selected ? t("cameraStreamUnavailable") : t("noStream")}</strong><span>${selected ? t("noVideoNow") : t("noStream")}</span></div>`;
    const selectedStatus = selected ? this.cameraStatusLabel(selected.status) : t("noData");
    return `${this.pageHeading("camerasTitle", "camerasSubtitle")}<div class="monitor-layout"><section class="panel monitor-player-card"><div class="video-player" role="img" aria-label="${t("videoPlayer")}">${playerState}<div class="player-controls"><button type="button" disabled aria-label="${t("playbackUnavailable")}">▶</button><span>--:--</span><div class="player-track" aria-hidden="true"><i></i></div><span>--:--</span></div></div><div class="camera-info monitor-info"><div><h2>${selected ? escapeHtml(selected.name) : t("camera")}</h2><p>${selected ? `${t("camera")} ${formatNumber(selected.camera_id, language)} · ${t("location")} ${formatNumber(selected.location_id, language)}` : t("noCameraSelected")}</p></div><span class="state-tag">${selectedStatus}</span>${selected ? `<small>${t("cameraAddress")}: ${escapeHtml(selected.ip_address)}</small>` : ""}</div></section><aside class="panel camera-list"><div class="panel-title"><div><h2>${t("availableCameras")}</h2></div></div>${cameraCards}</aside></div>`;
  }
  private eventsView(): string {
    const action = `<button class="button secondary" data-action="export" ${this.events.length && !this.exportingCsv ? "" : "disabled"} aria-busy="${this.exportingCsv}">${t(this.exportingCsv ? "preparingCsv" : "exportCsv")}</button>`;
    const priorities: Array<[string, TranslationKey]> = [["Alto", "high"], ["Medio", "medium"], ["Bajo", "low"]];
    const statuses: Array<[string, TranslationKey]> = [["Pendiente", "pending"], ["Revisado", "reviewed"]];
    const range = this.events.length
      ? `${t("records")} ${formatNumber(Number(this.filters.offset ?? 0) + 1, language)}–${formatNumber(Number(this.filters.offset ?? 0) + this.events.length, language)}`
      : t("noRecordsRange");
    return `${this.pageHeading("eventsTitle", "eventsSubtitle", action)}<form class="filter-bar" id="event-filters"><label>${t("search")}<input name="q" value="${escapeHtml(this.filters.q ?? "")}" placeholder="${t("searchPlaceholder")}"></label><label>${t("priority")}<select name="prioridad"><option value="">${t("all")}</option>${priorities.map(([value, key]) => `<option value="${value}" ${this.filters.prioridad === value ? "selected" : ""}>${t(key)}</option>`).join("")}</select></label><label>${t("status")}<select name="estado"><option value="">${t("allStatuses")}</option>${statuses.map(([value, key]) => `<option value="${value}" ${this.filters.estado === value ? "selected" : ""}>${t(key)}</option>`).join("")}</select></label><label>${t("camera")}<select name="camara_id"><option value="">${t("allCameras")}</option>${this.cameras.map(camera => `<option value="${camera.camera_id}" ${this.filters.camara_id === camera.camera_id ? "selected" : ""}>${escapeHtml(camera.name)}</option>`).join("")}</select></label><label>${t("from")}<input type="date" name="desde" value="${escapeHtml(this.filters.desde ?? "")}"></label><label>${t("to")}<input type="date" name="hasta" value="${escapeHtml(this.filters.hasta ?? "")}"></label><button class="button primary">${t("apply")}</button></form>${this.resourceNotice("cameras")}<article class="panel table-panel">${this.eventTable(this.events, false)}</article><div class="pagination"><button class="button secondary" data-action="previous" ${!this.filters.offset ? "disabled" : ""}>${t("previous")}</button><span role="status" aria-live="polite">${range}</span><button class="button secondary" data-action="next" ${this.events.length < Number(this.filters.limit) ? "disabled" : ""}>${t("next")}</button></div>`;
  }
  private eventTable(events: RiskEvent[], compact: boolean): string {
    const resource: DataResource = compact ? "recentEvents" : "events";
    const state = this.resourceNotice(resource);
    const actionState = this.actionError ? this.inlineError(this.actionError, false) : "";
    const stateRow = (content: string) => content ? `<tr><td colspan="7">${content}</td></tr>` : "";
    const rows = events.length ? `${stateRow(actionState || state)}${events.map(event => `<tr><td><b>${escapeHtml(event.type)}</b><small>${escapeHtml(event.subject)}${event.description ? ` · ${escapeHtml(event.description)}` : ""}</small></td><td>${escapeHtml(formatDate(event.date, language))}<small>${escapeHtml(event.time)} (${t("sourceTime")})</small></td><td>${escapeHtml(event.location)}</td><td>${escapeHtml(event.camera)}</td><td><span class="risk ${this.riskTone(event.priority)}">${escapeHtml(event.priority)}</span></td><td>${escapeHtml(event.status)}</td><td><button class="link-button" data-event-id="${event.id}">${t("details")}</button>${!compact && event.status === "Pendiente" ? `<button class="link-button" data-review-id="${event.id}">${t("review")}</button>` : ""}</td></tr>`).join("")}` : stateRow(actionState || state) || `<tr><td colspan="7"><div class="table-empty">${icon("shield")}<b>${t("noActivity")}</b><span>${t("noEventsToShow")}</span></div></td></tr>`;
    return `<div class="table-wrap"><table><thead><tr><th scope="col">${t("event")}</th><th scope="col">${t("dateTime")}</th><th scope="col">${t("locationHeader")}</th><th scope="col">${t("cameraHeader")}</th><th scope="col">${t("risk")}</th><th scope="col">${t("eventStatus")}</th><th scope="col" aria-label="${t("actions")}"></th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }
  private alertsView(): string {
    const state = this.resourceNotice("alerts");
    const rows = this.alerts.length ? `${this.actionError ? `<tr><td colspan="5">${this.inlineError(this.actionError, false)}</td></tr>` : ""}${state ? `<tr><td colspan="5">${state}</td></tr>` : ""}${this.alerts.map(a => `<tr><td><span class="risk ${this.riskTone(a.nivel)}">${escapeHtml(a.nivel)}</span></td><td>${escapeHtml(formatDate(a.event.date, language))}<small>${escapeHtml(a.event.time)}</small></td><td><b>${escapeHtml(a.event.type)}</b><small>${escapeHtml(a.event.location)} · ${escapeHtml(a.event.camera)}</small></td><td>${escapeHtml(a.estado)}</td><td><button class="link-button" data-event-id="${a.event.id}">${t("viewEvent")}</button>${a.estado.toLowerCase() === "pendiente" ? `<button class="link-button" data-alert-seen="${a.id_alerta}">${t("markSeen")}</button>` : ""}</td></tr>`).join("")}` : (this.actionError ? this.inlineError(this.actionError, false) : state) ? `<tr><td colspan="5">${this.actionError ? this.inlineError(this.actionError, false) : state}</td></tr>` : `<tr><td colspan="5"><div class="table-empty">${icon("shield")}<b>${t("noAlertsRows")}</b><span>${t("noAlertsToShow")}</span></div></td></tr>`;
    const streamState = this.backendSession ? `<p class="alert-stream-state" role="status">${t(this.alertStreamState === "connected" ? "alertsLive" : this.alertStreamState === "reconnecting" ? "alertsReconnecting" : "alertsConnecting")}</p>` : "";
    return `${this.pageHeading("alertsTitle", "alertsSubtitle")} ${streamState}<article class="panel table-panel"><div class="table-wrap"><table><thead><tr><th scope="col">${t("level")}</th><th scope="col">${t("dateTime")}</th><th scope="col">${t("event")}</th><th scope="col">${t("eventStatus")}</th><th scope="col">${t("actions")}</th></tr></thead><tbody>${rows}</tbody></table></div></article>`;
  }
  private catalogView(title: TranslationKey, items: Array<{ title: string; meta: string; detail: string }>, emptyMessage: TranslationKey, resources: DataResource[]): string {
    const state = this.resourceNoticeFor(resources);
    return `${this.pageHeading(title)}${items.length ? `<div class="catalog-grid">${items.map(item => `<article class="panel catalog-card"><span>${escapeHtml(item.meta)}</span><h2>${escapeHtml(item.title)}</h2><p>${escapeHtml(item.detail || t("noDescription"))}</p></article>`).join("")}</div>${state}` : state || this.empty(emptyMessage, "noRecords")}`;
  }
  private settingsView(): string {
    const eventTypesState = this.resourceNotice("eventTypes");
    return `${this.pageHeading("settingsTitle", "settingsSubtitle")}<section class="settings-group"><div class="settings-group-heading"><h2>${t("preferences")}</h2><p>${t("appearanceSubtitle")}</p></div><article class="panel settings-panel language-setting"><div><h3>${t("language")}</h3><p>${t("languagePreferenceDescription")}</p></div><label for="language-select">${t("language")}</label><select id="language-select" aria-label="${t("language")}"><option value="es" ${language === "es" ? "selected" : ""}>${t("spanish")}</option><option value="en" ${language === "en" ? "selected" : ""}>${t("english")}</option></select></article></section><section class="settings-group"><div class="settings-group-heading"><h2>${t("appearance")}</h2><p>${t("appearanceSubtitle")}</p></div><article class="panel settings-panel"><div><h3>${t("themeColor")}</h3><p>${t("themePreview")}</p></div><label for="theme-select">${t("theme")}</label><select id="theme-select"><option value="system">${t("followSystem")}</option><option value="light" ${this.theme === "light" ? "selected" : ""}>${t("light")}</option><option value="dark" ${this.theme === "dark" ? "selected" : ""}>${t("dark")}</option></select><button class="button secondary" data-action="theme-reset">${t("resetSystem")}</button></article></section><section class="settings-group"><div class="settings-group-heading"><h2>${t("accessibility")}</h2><p>${t("motionSettings")}</p></div><article class="panel accessibility-setting"><div><h3>${t("reduceAnimations")}</h3><p>${t("reduceAnimationsDescription")}</p></div><label class="switch-label" for="reduce-motion"><input type="checkbox" id="reduce-motion" ${this.reduceMotion ? "checked" : ""}><span>${t("enabled")}</span></label></article></section><section class="settings-group"><div class="settings-group-heading"><h2>${t("eventTypes")}</h2><p>${this.eventTypes.length ? `${formatNumber(this.eventTypes.length, language)} ${t("eventTypesAvailable")}` : (this.dataErrors.eventTypes || this.loadingResources.has("eventTypes")) ? "" : t("noEventTypes")}</p></div>${eventTypesState}</section>`;
  }
  private cameraRow(camera: CameraRecord): string {
    const status = camera.status.trim().toLowerCase();
    return `<div class="list-row"><span class="device-dot ${status === "active" ? "is-connected" : ""}"></span><div><b>${escapeHtml(camera.name)}</b><small>${t("camera")} ${formatNumber(camera.camera_id, language)} · ${t("location")} ${formatNumber(camera.location_id, language)}</small></div><span class="state-tag">${this.cameraStatusLabel(camera.status)}</span></div>`;
  }
  private cameraStatusLabel(rawStatus: string): string {
    const labels: Record<string, TranslationKey> = { active: "cameraActive", inactive: "cameraInactive", disconnected: "cameraDisconnected", maintenance: "cameraMaintenance" };
    const key = labels[rawStatus.trim().toLowerCase()];
    return key ? t(key) : escapeHtml(rawStatus);
  }
  private alertRow(alert: AlertRecord): string {
    return `<div class="list-row"><span class="risk ${this.riskTone(alert.nivel)}">${escapeHtml(alert.nivel)}</span><div><b>${escapeHtml(alert.event.type)}</b><small>${escapeHtml(formatDate(alert.event.date, language))} ${escapeHtml(alert.event.time)} · ${escapeHtml(alert.event.location)}</small></div></div>`;
  }
  private riskTone(value: string): string { return value.toLowerCase() === "alto" ? "high" : value.toLowerCase() === "medio" ? "medium" : "low"; }
  private empty(title: TranslationKey, detail: TranslationKey): string { return `<div class="empty-state">${icon("shield")}<b>${t(title)}</b><p>${t(detail)}</p></div>`; }
  private inlineError(message: string, retry = true): string { return `<div class="inline-state is-error" role="status"><span>${escapeHtml(message)}</span>${retry ? `<button class="link-button" data-action="reload">${t("retry")}</button>` : ""}</div>`; }
  private resourceNotice(resource: DataResource): string {
    const error = this.dataErrors[resource];
    if (error) {
      const visibleResources = pageResources[this.page].filter(item => item !== "health");
      const index = resource === "health" ? -1 : visibleResources.indexOf(resource);
      const alreadyReported = visibleResources.slice(0, Math.max(index, 0)).some(item => this.dataErrors[item] === error);
      return alreadyReported ? `<div class="inline-state is-muted" role="status">${t("relatedDataUnavailable")}</div>` : this.inlineError(error);
    }
    return this.loadingResources.has(resource) ? `<div class="inline-state" role="status"><span class="small-spinner" aria-hidden="true"></span>${t("loading")}</div>` : "";
  }
  private resourceNoticeFor(resources: DataResource[]): string {
    for (const resource of resources) if (this.dataErrors[resource]) return this.resourceNotice(resource);
    for (const resource of resources) if (this.loadingResources.has(resource)) return this.resourceNotice(resource);
    return "";
  }
  private dataOrEmpty(resource: DataResource, emptyContent: string): string { return this.resourceNotice(resource) || emptyContent; }
  private reportError(context: TranslationKey, error: unknown): string {
    console.error(`[Safe Vision AI] ${t(context)}`, error);
    return t(context);
  }

  private bind(): void {
    this.root?.querySelector<HTMLSelectElement>("#language-select")?.addEventListener("change", event => {
      language = (event.currentTarget as HTMLSelectElement).value as Language;
      localStorage.setItem("safevision-language", language);
      document.documentElement.lang = language;
      this.render();
    });
    this.root?.querySelectorAll<HTMLElement>("[data-page]").forEach(link => link.addEventListener("click", event => {
      event.preventDefault(); const page = link.dataset.page as Page | undefined; if (!page) return;
      history.pushState({}, "", page === "overview" ? "/" : `/${page}`); this.page = page; this.eventDetail = null; void this.loadPage();
    }));
    this.root?.querySelector("#theme-toggle")?.addEventListener("click", () => this.setTheme(this.theme === "dark" ? "light" : "dark"));
    this.root?.querySelector("#theme-select")?.addEventListener("change", event => { const choice = (event.currentTarget as HTMLSelectElement).value; if (choice === "system") { localStorage.removeItem("safevision-theme"); this.theme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"; this.applyTheme(); this.render(); } else this.setTheme(choice as Theme); });
    this.root?.querySelector("[data-action='theme-reset']")?.addEventListener("click", () => { localStorage.removeItem("safevision-theme"); this.theme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"; this.applyTheme(); this.render(); });
    this.root?.querySelector<HTMLInputElement>("#reduce-motion")?.addEventListener("change", event => {
      this.reduceMotion = (event.currentTarget as HTMLInputElement).checked;
      localStorage.setItem("safevision-reduce-motion", String(this.reduceMotion));
      this.applyMotionPreference();
      this.render();
    });
    this.root?.querySelector("[data-action='reload']")?.addEventListener("click", () => void this.loadPage());
    this.root?.querySelector("[data-action='export']")?.addEventListener("click", () => this.exportCsv());
    this.root?.querySelector("[data-action='logout']")?.addEventListener("click", () => void this.logoutSession());
    this.root?.querySelector<HTMLFormElement>("#event-filters")?.addEventListener("submit", event => { event.preventDefault(); const form = new FormData(event.currentTarget as HTMLFormElement); const cameraId = String(form.get("camara_id") || ""); this.filters = { ...this.filters, q: String(form.get("q") || "") || undefined, prioridad: String(form.get("prioridad") || "") || undefined, estado: String(form.get("estado") || "") || undefined, camara_id: cameraId ? Number(cameraId) : undefined, desde: String(form.get("desde") || "") || undefined, hasta: String(form.get("hasta") || "") || undefined, offset: 0 }; void this.loadPage(); });
    this.root?.querySelector("[data-action='previous']")?.addEventListener("click", () => { this.filters.offset = Math.max(0, Number(this.filters.offset) - Number(this.filters.limit)); void this.loadPage(); });
    this.root?.querySelector("[data-action='next']")?.addEventListener("click", () => { this.filters.offset = Number(this.filters.offset) + Number(this.filters.limit); void this.loadPage(); });
    this.root?.querySelectorAll<HTMLElement>("[data-event-id]").forEach(button => button.addEventListener("click", () => void this.openEvent(Number(button.dataset.eventId))));
    this.root?.querySelectorAll<HTMLElement>("[data-review-id]").forEach(button => button.addEventListener("click", () => void this.reviewEvent(Number(button.dataset.reviewId))));
    this.root?.querySelectorAll<HTMLElement>("[data-alert-seen]").forEach(button => button.addEventListener("click", () => void this.markSeen(Number(button.dataset.alertSeen))));
  }
  private setTheme(theme: Theme): void { this.theme = theme; localStorage.setItem("safevision-theme", theme); this.applyTheme(); this.render(); }
  private async logoutLocalSession(): Promise<void> {
    try {
      const localAuth = await import("@safevision/local-dev-access");
      await localAuth.logoutLocalDev();
    } catch (error) { console.error("Safe Vision AI: no se pudo cerrar la sesión local", error); }
    this.localDevSession = false;
    if (this.cameraPollTimer !== null) window.clearInterval(this.cameraPollTimer);
    this.cameraPollTimer = null;
    this.stopAlertStream();
    this.backendSession = false;
    this.clearProtectedData();
    this.authStatus = t("loggedOut");
    if (this.root) await new AccessGate(this.root, this).start(true);
  }
  private async logoutSession(): Promise<void> {
    if (this.localDevSession) return this.logoutLocalSession();
    this.stopAlertStream();
    if (this.cameraPollTimer !== null) window.clearInterval(this.cameraPollTimer);
    this.cameraPollTimer = null;
    let logoutFailed = false;
    try { await api.logout(); }
    catch (error) { logoutFailed = true; console.error("Safe Vision AI: no se pudo cerrar la sesión del backend", error); }
    this.backendSession = false;
    this.clearProtectedData();
    this.authStatus = t(logoutFailed ? "logoutFailed" : "loggedOut");
    if (this.root) await new AccessGate(this.root, this).start(true);
  }

  private async loadPage(): Promise<void> {
    this.loading = true;
    this.actionError = "";
    this.loadingResources = new Set(pageResources[this.page]);
    for (const resource of this.loadingResources) delete this.dataErrors[resource];
    this.render();
    try {
      if (this.page === "overview") {
        const [, metrics, recentEvents, alerts, cameras] = await Promise.all([
          this.loadResource("health", "loadOverviewError", api.health()),
          this.loadResource("metrics", "loadOverviewError", api.metrics()),
          this.loadResource("recentEvents", "loadOverviewError", api.recentEvents()),
          this.loadResource("alerts", "loadOverviewError", api.pendingAlerts()),
          this.loadResource("cameras", "loadOverviewError", api.cameras()),
        ]);
        if (metrics !== undefined) this.metrics = metrics;
        if (recentEvents !== undefined) this.recentEvents = recentEvents;
        if (alerts !== undefined) this.alerts = alerts;
        if (cameras !== undefined) this.cameras = cameras;
      } else if (this.page === "cameras") {
        const cameras = await this.loadResource("cameras", "loadCamerasError", api.cameras());
        if (cameras !== undefined) this.cameras = cameras;
      } else if (this.page === "events") {
        const [events, cameras] = await Promise.all([
          this.loadResource("events", "loadEventsError", api.events(this.filters)),
          this.loadResource("cameras", "loadCamerasError", api.cameras()),
        ]);
        if (events !== undefined) this.events = events;
        if (cameras !== undefined) this.cameras = cameras;
      } else if (this.page === "alerts") {
        const alerts = await this.loadResource("alerts", "loadAlertsError", api.pendingAlerts(100));
        if (alerts !== undefined) this.alerts = alerts;
      } else if (this.page === "subjects") {
        const subjects = await this.loadResource("subjects", "loadSubjectsError", api.subjects());
        if (subjects !== undefined) this.subjects = subjects;
      } else if (this.page === "locations") {
        const [locations, zones] = await Promise.all([
          this.loadResource("locations", "loadLocationsError", api.locations()),
          this.loadResource("zones", "loadLocationsError", api.zones()),
        ]);
        if (locations !== undefined) this.locations = locations;
        if (zones !== undefined) this.zones = zones;
      } else if (this.page === "settings") {
        const eventTypes = await this.loadResource("eventTypes", "loadSettingsError", api.eventTypes());
        if (eventTypes !== undefined) this.eventTypes = eventTypes;
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 401 && this.root) {
        this.authStatus = t("sessionExpired");
        this.backendSession = false;
        this.stopAlertStream();
        if (this.cameraPollTimer !== null) window.clearInterval(this.cameraPollTimer);
        this.cameraPollTimer = null;
        this.clearProtectedData();
        if (this.localDevSession) {
          const resource = pageResources[this.page].find(item => item !== "health") ?? "health";
          this.dataErrors[resource] = t("backendSessionRequired");
          return;
        }
        this.loading = false;
        await new AccessGate(this.root, this).start();
        return;
      }
      const resource = pageResources[this.page].find(item => item !== "health") ?? "health";
      const context: Record<DataResource, TranslationKey> = { health: "loadOverviewError", metrics: "loadOverviewError", recentEvents: "loadOverviewError", alerts: "loadAlertsError", cameras: "loadCamerasError", events: "loadEventsError", subjects: "loadSubjectsError", locations: "loadLocationsError", zones: "loadLocationsError", eventTypes: "loadSettingsError" };
      this.dataErrors[resource] = this.reportError(context[resource], error);
    }
    finally { this.loading = false; this.loadingResources.clear(); this.render(); }
  }
  private async loadResource<T>(resource: DataResource, context: TranslationKey, request: Promise<T>): Promise<T | undefined> {
    try { return await request; }
    catch (error) {
      if (error instanceof ApiError && error.status === 401) throw error;
      const message = this.reportError(context, error);
      if (resource !== "health") this.dataErrors[resource] = message;
      return undefined;
    }
  }
  private clearProtectedData(): void {
    this.metrics = null; this.recentEvents = []; this.events = []; this.alerts = []; this.cameras = []; this.subjects = []; this.locations = []; this.zones = [];
    this.dataErrors = {}; this.loadingResources.clear();
  }
  private async openEvent(id: number): Promise<void> {
    try { this.eventDetail = await api.event(id); this.showEventDialog(this.eventDetail); }
    catch (error) { this.actionError = this.reportError("openEventError", error); this.render(); }
  }
  private showEventDialog(event: RiskEvent): void {
    const dialog = document.createElement("dialog"); dialog.className = "detail-dialog";
    const fields: Array<[TranslationKey, unknown]> = [["description", event.description], ["date", formatDate(event.date, language)], ["time", `${event.time} (${t("sourceTime")})`], ["risk", event.priority], ["eventStatus", event.status], ["location", event.location], ["camera", event.camera], ["subject", event.subject]];
    dialog.innerHTML = `<form method="dialog"><button class="dialog-close" aria-label="${t("close")}">×</button></form><span class="eyebrow">${t("eventDetail")} ${formatNumber(event.id, language)}</span><h2>${escapeHtml(event.type)}</h2><dl>${fields.map(([key, value]) => `<div><dt>${t(key)}</dt><dd>${escapeHtml(value || t("noDescriptionValue"))}</dd></div>`).join("")}</dl>${event.status === "Pendiente" ? `<button class="button primary" data-review-id="${event.id}">${t("markReviewed")}</button>` : ""}`;
    this.root?.append(dialog); dialog.showModal(); dialog.addEventListener("close", () => dialog.remove());
    dialog.querySelector("[data-review-id]")?.addEventListener("click", () => void this.reviewEvent(event.id));
  }
  private async reviewEvent(id: number): Promise<void> {
    try { await api.reviewEvent(id); this.actionError = ""; await this.loadPage(); }
    catch (error) { this.actionError = this.reportError("reviewEventError", error); this.render(); }
  }
  private async markSeen(id: number): Promise<void> {
    try { await api.markAlertSeen(id); this.actionError = ""; await this.loadPage(); }
    catch (error) { this.actionError = this.reportError("markAlertSeenError", error); this.render(); }
  }
  private async exportCsv(): Promise<void> {
    if (!this.events.length || this.exportingCsv) return;
    const filters = { ...this.filters };
    this.exportingCsv = true;
    this.actionError = "";
    this.render();
    try {
      const events = await loadAllEvents(pageFilters => api.events(pageFilters), filters);
      if (!events.length) { this.actionError = t("noEventsToExport"); return; }
      const rows = [[t("csvAppliedFilters"), t("csvSearch"), filters.q ?? "", t("csvPriority"), filters.prioridad ?? t("csvAll"), t("csvStatus"), filters.estado ?? t("csvAllStatuses"), t("csvStart"), filters.desde ?? "", t("csvEnd"), filters.hasta ?? "", t("csvCamera"), filters.camara_id ?? ""], [t("csvId"), t("csvEvent"), t("csvDate"), t("csvTimeSource"), t("csvRisk"), t("csvStatus"), t("csvLocation"), t("csvCamera"), t("csvSubject"), t("csvDescription")], ...events.map(e => [e.id, e.type, e.date, e.time, e.priority, e.status, e.location, e.camera, e.subject, e.description ?? ""])];
      const csv = serializeCsvRows(rows);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" }); const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `safevision-${t("csvFilename")}-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(url);
    } catch (error) {
      this.actionError = this.reportError("exportEventsError", error);
    } finally {
      this.exportingCsv = false;
      this.render();
    }
  }
}

class AccessGate {
  private readonly root: HTMLDivElement;
  private readonly privateApp: SafeVisionFrontend;
  private submitting = false;
  constructor(root: HTMLDivElement, privateApp: SafeVisionFrontend) { this.root = root; this.privateApp = privateApp; }
  async start(forceLogin = false): Promise<void> {
    const localModeAvailable = await this.localDevModeAvailable();
    if (!forceLogin && localModeAvailable) {
      try {
        const localAuth = await import("@safevision/local-dev-access");
        if (await localAuth.hasLocalDevSession()) {
          this.privateApp.activateLocalDevSession();
          await this.privateApp.startPrivate();
          return;
        }
      } catch (error) {
        console.error("Safe Vision AI: no se pudo validar la sesión local", error);
      }
    }
    if (!forceLogin && await this.privateApp.hasValidBackendSession()) {
      await this.privateApp.startPrivate();
      return;
    }
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const backendSignInAvailable = this.privateApp.canSignInBackend;
    const primaryAvailable = backendSignInAvailable || localModeAvailable;
    if (isLocalhost() && !localModeAvailable && !backendSignInAvailable) this.privateApp.setAuthenticationStatus(t("localDevNotConfigured"));
    this.root.innerHTML = `<main class="access-shell"><section class="access-brand"><div class="brand-lockup">${brandLogo("login-wordmark")}</div><div class="access-copy"><h1><span>${t("introMain")}</span><em>${t("introSupport")}</em></h1></div></section><section class="access-panel"><form class="login-card" id="login-form"><h2>${t("loginTitle")}</h2><label for="login-email">${t("email")}</label><input type="email" id="login-email" name="email" autocomplete="username" aria-label="${t("email")}" required><label for="login-password">${t("password")}</label><div class="password-field"><input type="password" id="login-password" name="password" autocomplete="current-password" aria-label="${t("password")}" required><button type="button" id="toggle-password" aria-label="${t("showPassword")}">${t("show")}</button></div><div class="auth-message" role="alert">${escapeHtml(this.privateApp.authenticationStatus)}</div><button class="button primary" type="submit" ${primaryAvailable ? "" : "disabled"}>${backendSignInAvailable ? t("loginTitle") : t("localDevLogin")}</button>${backendSignInAvailable && localModeAvailable ? `<button class="button secondary local-dev-login" type="button">${t("localDevLogin")}</button>` : ""}<div class="auth-options"><button type="button" data-auth-info="registration">${t("createAccount")}</button><button type="button" data-auth-info="recovery">${t("forgotPassword")}</button></div></form><footer>${t("loginBrandFooter")}</footer></section></main>`;
    if (!reduceMotion) this.root.querySelector(".brand-lockup")?.classList.add("intro");
    this.root.querySelector<HTMLFormElement>("#login-form")?.addEventListener("submit", async event => {
      event.preventDefault();
      if (this.submitting) return;
      const message = this.root.querySelector<HTMLElement>(".auth-message");
      const email = this.root.querySelector<HTMLInputElement>("#login-email");
      const password = this.root.querySelector<HTMLInputElement>("#login-password");
      if (!email || !password || !email.validity.valid || !password.value) { if (message) message.textContent = t("invalidEmailPassword"); return; }
      this.submitting = true;
      const submit = this.root.querySelector<HTMLButtonElement>("#login-form button[type='submit']");
      if (submit) { submit.disabled = true; submit.setAttribute("aria-busy", "true"); }
      try {
        if (backendSignInAvailable) {
          await this.privateApp.signInBackend(email.value, password.value);
        } else if (localModeAvailable) {
          await this.loginLocal(email.value, password.value);
        } else if (message) message.textContent = t("accessUnavailable");
      } catch (error) {
        if (message) message.textContent = this.authError(error);
      } finally {
        this.submitting = false;
        if (submit?.isConnected) { submit.disabled = false; submit.removeAttribute("aria-busy"); }
      }
    });
    this.root.querySelector<HTMLButtonElement>(".local-dev-login")?.addEventListener("click", async event => {
      if (this.submitting) return;
      const button = event.currentTarget as HTMLButtonElement;
      const email = this.root.querySelector<HTMLInputElement>("#login-email");
      const password = this.root.querySelector<HTMLInputElement>("#login-password");
      const message = this.root.querySelector<HTMLElement>(".auth-message");
      if (!email || !password || !email.validity.valid || !password.value) { if (message) message.textContent = t("invalidEmailPassword"); return; }
      this.submitting = true;
      button.disabled = true;
      try { await this.loginLocal(email.value, password.value); }
      catch (error) { if (message) message.textContent = error instanceof Error ? error.message : t("localModuleFailed"); }
      finally { this.submitting = false; if (button.isConnected) button.disabled = false; }
    });
    this.root.querySelector("#toggle-password")?.addEventListener("click", event => { const input = this.root.querySelector<HTMLInputElement>("#login-password"); const button = event.currentTarget as HTMLButtonElement; if (!input) return; input.type = input.type === "password" ? "text" : "password"; button.textContent = input.type === "password" ? t("show") : t("hide"); button.setAttribute("aria-label", input.type === "password" ? t("showPassword") : t("hidePassword")); });
    this.root.querySelectorAll<HTMLElement>("[data-auth-info]").forEach(button => button.addEventListener("click", () => { const message = this.root.querySelector<HTMLElement>(".auth-message"); if (message) message.textContent = t(button.dataset.authInfo === "registration" ? "registrationUnavailable" : "recoveryUnavailable"); }));
  }
  private async localDevModeAvailable(): Promise<boolean> {
    if (!isLocalhost()) return false;
    try {
      const localAuth = await import("@safevision/local-dev-access");
      return (await localAuth.getLocalDevStatus()).configured;
    } catch { return false; }
  }
  private async loginLocal(email: string, password: string): Promise<void> {
    const localAuth = await import("@safevision/local-dev-access");
    await localAuth.loginLocalDev(email, password);
    this.privateApp.activateLocalDevSession();
    await this.privateApp.startPrivate();
  }
  private authError(error: unknown): string {
    if (!(error instanceof ApiError)) return t("accessFailed");
    if (error.status === 401) return t("invalidBackendCredentials");
    if (error.status === 429) return t("loginRateLimited");
    if (error.status === 0) return t("authServiceUnreachable");
    if (error.status >= 500) return t("authServerError");
    return t("accessFailed");
  }
}

async function bootstrap(): Promise<void> {
  const root = document.querySelector<HTMLDivElement>("#app");
  if (!root) throw new Error("No se encontró el contenedor principal de Safe Vision AI.");
  const privateApp = new SafeVisionFrontend();
  document.documentElement.lang = language;
  privateApp.initializeTheme();
  await showIntroduction(root);
  const gate = new AccessGate(root, privateApp);
  await gate.start();
}

async function showIntroduction(root: HTMLDivElement): Promise<void> {
  root.innerHTML = `<main class="intro-screen" aria-label="Safe Vision AI">${brandLogo("intro-wordmark")}</main>`;
  const screen = root.querySelector<HTMLElement>(".intro-screen");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches || localStorage.getItem("safevision-reduce-motion") === "true";
  await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => { screen?.classList.add("is-entering"); resolve(); })));
  await new Promise(resolve => window.setTimeout(resolve, reducedMotion ? 180 : 680));
  screen?.classList.add("is-leaving");
  if (!reducedMotion) await new Promise(resolve => window.setTimeout(resolve, 220));
}

void bootstrap();
