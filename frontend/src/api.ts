export type Priority = "Alto" | "Medio" | "Bajo" | string;
export type EventStatus = "Pendiente" | "Revisado" | string;

export interface RiskEvent {
  id: number;
  type: string;
  subject: string;
  location: string;
  camera: string;
  date: string;
  time: string;
  occurred_at?: string;
  priority: Priority;
  status: EventStatus;
  description?: string | null;
}

export interface AlertRecord {
  id_alerta: number;
  nivel: string;
  estado: string;
  event: RiskEvent;
}

export interface Metrics {
  total: number;
  pendientes: number;
  alto: number;
}

export interface CameraRecord {
  camera_id: number;
  name: string;
  ip_address: string;
  status: string;
  location_id: number;
}

export interface EventTypeRecord {
  event_type_id: number;
  name: string;
  description: string | null;
  severity_level: number;
  priority: string;
}

export interface LocationRecord {
  location_id: number;
  name: string;
  description: string | null;
}

export interface SubjectRecord {
  subject_id: number;
  name: string;
  subject_type: string;
  description: string | null;
}

export interface ZoneRecord {
  zone_id: number;
  name: string;
  description: string | null;
  coordinates: number[][];
  is_active: boolean;
  camera_id: number;
}

export interface AuthUser { id: number | string; name: string; email: string; }
export interface AuthSession { authenticated: true; user: AuthUser; }
export interface AlertStreamMessage {
  tipo: "alerta_nueva" | "evento_revisado" | "ping";
  alerta?: AlertRecord;
  evento?: RiskEvent;
}

export interface EventFilters {
  q?: string;
  prioridad?: string;
  estado?: string;
  camara_id?: number;
  desde?: string;
  hasta?: string;
  limit?: number;
  offset?: number;
}

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

export class SafeVisionApi {
  readonly baseUrl = (import.meta.env.VITE_API_URL || "https://safevision-backend-pw6t.onrender.com").replace(/\/$/, "");

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        signal: init.signal ?? AbortSignal.timeout(90_000),
        credentials: "include",
        headers: { Accept: "application/json", ...init.headers },
      });
    } catch {
      throw new ApiError(0, "No se pudo conectar con la API. Comprueba la conexión e inténtalo de nuevo.");
    }

    if (!response.ok) {
      let message = this.statusMessage(response.status);
      try {
        const body = await response.json() as { detail?: unknown; message?: unknown };
        if (typeof body.detail === "string") message = body.detail;
        else if (Array.isArray(body.detail)) {
          const details = body.detail.flatMap((item: unknown) => {
            if (!item || typeof item !== "object") return [];
            const validation = item as { loc?: unknown; msg?: unknown };
            if (typeof validation.msg !== "string") return [];
            const location = Array.isArray(validation.loc)
              ? validation.loc.filter((part: unknown) => typeof part === "string" || typeof part === "number").join(".")
              : "";
            return [location ? `${location}: ${validation.msg}` : validation.msg];
          });
          if (details.length) message = details.join("; ");
        }
        else if (typeof body.message === "string") message = body.message;
      } catch { /* The status still gives a useful error when the body is empty. */ }
      throw new ApiError(response.status, message);
    }
    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  }

  health(): Promise<Record<string, string>> { return this.request("/health"); }
  login(email: string, password: string): Promise<AuthSession> {
    return this.request("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
  }
  currentUser(): Promise<AuthSession> { return this.request("/api/auth/me"); }
  logout(): Promise<void> { return this.request("/api/auth/logout", { method: "POST" }); }
  wsTicket(): Promise<{ ticket: string }> { return this.request("/api/auth/ws-ticket"); }
  alertWebSocketUrl(ticket: string): string {
    const url = new URL("/ws/alertas", this.baseUrl);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.searchParams.set("ticket", ticket);
    return url.toString();
  }
  metrics(): Promise<Metrics> { return this.request("/api/metricas"); }
  events(filters: EventFilters = {}): Promise<RiskEvent[]> {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) if (value !== undefined && value !== "") query.set(key, String(value));
    return this.request(`/api/eventos${query.size ? `?${query}` : ""}`);
  }
  recentEvents(limit = 10): Promise<RiskEvent[]> { return this.request(`/api/eventos/recientes?limit=${limit}`); }
  event(id: number): Promise<RiskEvent> { return this.request(`/api/eventos/${id}`); }
  reviewEvent(id: number): Promise<RiskEvent> { return this.request(`/api/eventos/${id}/revisar`, { method: "PATCH" }); }
  markFalseAlarm(id: number): Promise<RiskEvent> { return this.request(`/api/eventos/${id}/falsa-alarma`, { method: "PATCH" }); }
  pendingAlerts(limit = 20): Promise<AlertRecord[]> { return this.request(`/api/alertas/pendientes?limit=${limit}`); }
  markAlertSeen(id: number): Promise<AlertRecord> { return this.request(`/api/alertas/${id}/vista`, { method: "PATCH" }); }
  cameras(): Promise<CameraRecord[]> { return this.request("/api/camaras"); }
  eventTypes(): Promise<EventTypeRecord[]> { return this.request("/api/tipos-evento"); }
  locations(): Promise<LocationRecord[]> { return this.request("/api/ubicaciones"); }
  subjects(): Promise<SubjectRecord[]> { return this.request("/api/sujetos"); }
  zones(): Promise<ZoneRecord[]> { return this.request("/api/zonas"); }

  private statusMessage(status: number): string {
    if (status === 401) return "La sesión no está autenticada o expiró.";
    if (status === 403) return "No tienes permiso para consultar esta información.";
    if (status === 404) return "El recurso solicitado no existe.";
    if (status === 422) return "La API rechazó uno o más parámetros de la solicitud.";
    if (status >= 500) return "La API encontró un error. Inténtalo más tarde.";
    return `La API respondió con el estado HTTP ${status}.`;
  }
}
