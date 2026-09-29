
import "./style.css";

type Priority = "Alto" | "Medio" | "Bajo";
type EventStatus = "Pendiente" | "Revisado";




class RiskEvent {
  public readonly id: number;
  public readonly type: string;
  public readonly subject: string;
  public readonly location: string;
  public readonly time: string;
  public readonly priority: Priority;
  public status: EventStatus;

  constructor(
    id: number,
    type: string,
    subject: string,
    location: string,
    time: string,
    priority: Priority,
    status: EventStatus
  ) {
    this.id = id;
    this.type = type;
    this.subject = subject;
    this.location = location;
    this.time = time;
    this.priority = priority;
    this.status = status;
  }

  get priorityClass(): string {
    return this.priority.toLowerCase();
  }

  get statusClass(): string {
    return this.status === "Revisado" ? "reviewed" : "pending";
  }
}

class SafeVisionDashboard {
  private readonly events: RiskEvent[] = [
    new RiskEvent(
      1048, "Posible caída", "Individuo 01",
      "Zona de monitoreo A", "10:42:18", "Alto", "Pendiente"
    ),
    new RiskEvent(
      1047, "Inmovilidad prolongada", "Individuo 02",
      "Zona de monitoreo B", "10:35:06", "Medio", "Pendiente"
    ),
    new RiskEvent(
      1046, "Cambio de postura", "Individuo 01",
      "Zona de monitoreo A", "10:21:44", "Bajo", "Revisado"
    ),
    new RiskEvent(
      1045, "Posible caída", "Individuo 03",
      "Zona de monitoreo C", "09:58:12", "Alto", "Revisado"
    ),
    new RiskEvent(
      1044, "Movimiento inusual", "Individuo 02",
      "Zona de monitoreo B", "09:42:30", "Medio", "Revisado"
    )
  ];

  private searchTerm = "";
  private priorityFilter = "Todas";

  public render(): void {
    const app = document.querySelector<HTMLDivElement>("#app");

    if (!app) {
      throw new Error("The application root #app was not found.");
    }

    app.innerHTML = this.getTemplate();
    this.bindEvents();
    this.renderEvents();
    this.renderAlerts();
    this.updateMetrics();
  }

  private getTemplate(): string {
    return `
      <div class="app-shell" id="overview">
        <aside class="sidebar">
          <div class="brand">
            <div class="brand-mark">SV</div>
            <div>
              <strong>SafeVision <span class="brand-ai">AI</span></strong>
              <small>INTELLIGENT MONITORING</small>
            </div>
          </div>

          <p class="side-label">PLATAFORMA</p>

          <nav class="nav-menu" aria-label="Navegación principal">
            <button class="nav-item active" data-page="overview">
              <span>◫</span> Panel principal
            </button>
            <button class="nav-item" data-page="camera">
              <span>▣</span> Monitoreo de cámara
            </button>
            <button class="nav-item" data-page="history">
              <span>◷</span> Eventos e historial
              <span class="nav-count" id="nav-alert-count">2</span>
            </button>
            <button class="nav-item" data-page="team">
              <span>♙</span> Equipo del proyecto
            </button>
          </nav>

          <p class="side-label system-label">ESTADO DEL SISTEMA</p>

          <div class="system-card">
            <span class="status-dot"></span>
            <div>
              <strong>Interfaz operativa</strong>
              <small>Modo de demostración</small>
            </div>
          </div>

          <div class="sidebar-bottom">
            <div class="user-avatar">SV</div>
            <div class="user-info">
              <strong>SafeVision AI</strong>
              <small>Panel de administración</small>
            </div>
            <span class="user-menu">···</span>
          </div>
        </aside>

        <main class="main-content">
          <header class="topbar">
            <div class="breadcrumbs">
              SafeVision AI <span>/</span>
              <strong id="breadcrumb-current">Panel principal</strong>
            </div>

            <div class="topbar-right">
              <div class="environment">
                <span class="status-dot"></span>
                Entorno de demostración
              </div>
              <div class="top-avatar">SV</div>
            </div>
          </header>

          <div class="page-content">
            <section class="welcome-row">
              <div>
                <div class="eyebrow">
                  <span class="eyebrow-line"></span>
                  VISIÓN ARTIFICIAL · PREVENCIÓN
                </div>
                <h1 id="page-title">Centro de monitoreo</h1>
                <p class="page-subtitle">
                  Una visión clara de los eventos, las alertas y el estado
                  general del sistema SafeVision AI.
                </p>
              </div>

              <button class="btn-secondary" id="refresh-button">
                <span>↻</span> Actualizar panel
              </button>
            </section>

            <div class="demo-notice">
              <span class="notice-icon">i</span>
              <div>
                <strong>Versión de demostración.</strong>
                Los eventos son datos de ejemplo. La cámara, el backend
                Python y la base de datos aún deben conectarse para mostrar
                información real.
              </div>
              <span class="demo-tag">DEMO</span>
            </div>

            <section class="metrics-grid" aria-label="Resumen de indicadores">
              <article class="metric-card">
                <div class="metric-top">
                  <span>Eventos registrados</span>
                  <span class="metric-icon purple">⌁</span>
                </div>
                <div class="metric-value" id="metric-total">05</div>
                <div class="metric-foot">
                  <span class="metric-neutral">Historial de ejemplo</span>
                  <span class="metric-caption">TOTAL</span>
                </div>
              </article>

              <article class="metric-card">
                <div class="metric-top">
                  <span>Alertas pendientes</span>
                  <span class="metric-icon red">!</span>
                </div>
                <div class="metric-value" id="metric-pending">02</div>
                <div class="metric-foot">
                  <span class="metric-warning">Requieren revisión</span>
                  <span class="metric-caption">PENDIENTES</span>
                </div>
              </article>

              <article class="metric-card">
                <div class="metric-top">
                  <span>Eventos de prioridad alta</span>
                  <span class="metric-icon orange">△</span>
                </div>
                <div class="metric-value" id="metric-high">02</div>
                <div class="metric-foot">
                  <span class="metric-warning">Datos de demostración</span>
                  <span class="metric-caption">PRIORIDAD</span>
                </div>
              </article>

              <article class="metric-card">
                <div class="metric-top">
                  <span>Estado de plataforma</span>
                  <span class="metric-icon green">✓</span>
                </div>
                <div class="metric-value metric-online">Activa</div>
                <div class="metric-foot">
                  <span class="metric-success">Frontend disponible</span>
                  <span class="metric-caption">LOCAL</span>
                </div>
              </article>
            </section>

            <section class="section-grid">
              <article class="panel" id="camera">
                <div class="panel-heading">
                  <div>
                    <h2>Vista de monitoreo</h2>
                    <p>Vista preparada para integrar el flujo de vídeo.</p>
                  </div>
                  <span class="status-pill status-neutral">
                    <span class="status-dot"></span> Sin conexión
                  </span>
                </div>

                <div class="camera-preview">
                  <div class="camera-grid"></div>
                  <span class="camera-label">CÁMARA 01 · Tapo C110</span>
                  <span class="camera-live"><span></span> VÍDEO NO DISPONIBLE</span>

                  <div class="camera-center">
                    <div class="camera-symbol">▣</div>
                    <strong>Vista de cámara</strong>
                    <span>
                      El espacio de vídeo está preparado. La transmisión
                      aparecerá cuando se integre el backend.
                    </span>
                  </div>
                </div>

                <div class="camera-footer">
                  <div>
                    <span class="footer-label">DISPOSITIVO</span>
                    <strong>TP-Link Tapo C110</strong>
                  </div>
                  <div>
                    <span class="footer-label">TRANSMISIÓN</span>
                    <strong class="muted-text">Pendiente de integración</strong>
                  </div>
                  <div>
                    <span class="footer-label">MOTOR DE IA</span>
                    <strong class="muted-text">No conectado</strong>
                  </div>
                </div>
              </article>

              <article class="panel" id="alerts-panel">
                <div class="panel-heading">
                  <div>
                    <h2>Alertas recientes</h2>
                    <p>Eventos de ejemplo que requieren revisión.</p>
                  </div>
                  <span class="counter-badge" id="alert-counter">02</span>
                </div>

                <div class="alert-list" id="alert-list"></div>

                <div class="panel-bottom">
                  <span id="alert-footer">Alertas pendientes de revisión</span>
                  <button class="text-button" data-page="history">
                    Ver historial →
                  </button>
                </div>
              </article>
            </section>

            <section class="panel history-panel" id="history">
              <div class="panel-heading history-heading">
                <div>
                  <h2>Registro de eventos</h2>
                  <p>Consulta, filtra y administra los eventos de demostración.</p>
                </div>

                <div class="history-actions">
                  <label class="search-box">
                    <span>⌕</span>
                    <input
                      id="event-search"
                      type="search"
                      placeholder="Buscar evento..."
                      aria-label="Buscar eventos"
                    />
                  </label>

                  <select id="priority-filter" aria-label="Filtrar por prioridad">
                    <option value="Todas">Todas las prioridades</option>
                    <option value="Alto">Prioridad alta</option>
                    <option value="Medio">Prioridad media</option>
                    <option value="Bajo">Prioridad baja</option>
                  </select>

                  <button class="btn-secondary" id="export-button">
                    <span>↓</span> Exportar CSV
                  </button>
                </div>
              </div>

              <div class="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>EVENTO</th>
                      <th>IDENTIFICADOR</th>
                      <th>UBICACIÓN</th>
                      <th>HORA</th>
                      <th>PRIORIDAD</th>
                      <th>ESTADO</th>
                      <th>ACCIÓN</th>
                    </tr>
                  </thead>
                  <tbody id="event-table-body"></tbody>
                </table>
              </div>

              <div class="table-footer">
                <span id="table-count">Mostrando 5 eventos</span>
                <span>Fuente: <strong>datos de demostración</strong></span>
              </div>
            </section>

            <section class="team-section" id="team">
              <div>
                <div class="eyebrow">
                  <span class="eyebrow-line"></span>
                  DESARROLLO ACADÉMICO
                </div>
                <h2>Equipo del proyecto</h2>
                <p>
                  SafeVision AI · Sistema inteligente para la detección
                  de eventos de riesgo mediante visión artificial.
                </p>
              </div>

              <div class="team-members">
                <div class="team-member">
                  <div class="member-avatar">I1</div>
                  <div>
                    <strong>Luisa Parra</strong>
                    <small>Equipo de desarrollo</small>
                  </div>
                </div>
                <div class="team-member">
                  <div class="member-avatar">I2</div>
                  <div>
                    <strong>Shary Velasquez </strong>
                    <small>Equipo de desarrollo</small>
                  </div>
                </div>
                <div class="team-member">
                  <div class="member-avatar">I3</div>
                  <div>
                    <strong>Luis Jamioy </strong>
                    <small>Equipo de desarrollo</small>
                  </div>
                </div>
              </div>
            </section>

            <footer class="app-footer">
              <span>© 2026 SafeVision AI </span>
            </footer>
          </div>
        </main>
      </div>
    `;
  }

  private bindEvents(): void {
    document.querySelectorAll<HTMLButtonElement>("[data-page]").forEach(button => {
      button.addEventListener("click", () => {
        const page = button.dataset.page;

        if (!page) return;

        document.querySelectorAll(".nav-item").forEach(item => {
          item.classList.toggle("active", item.getAttribute("data-page") === page);
        });

        const labels: Record<string, string> = {
          overview: "Panel principal",
          camera: "Monitoreo de cámara",
          history: "Eventos e historial",
          team: "Equipo del proyecto"
        };

        const breadcrumb = document.querySelector<HTMLElement>("#breadcrumb-current");
        if (breadcrumb) breadcrumb.textContent = labels[page] ?? "Panel principal";

        const section = document.getElementById(page);
        section?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });

    document.querySelector("#event-search")?.addEventListener("input", event => {
      this.searchTerm = (event.target as HTMLInputElement).value.toLowerCase().trim();
      this.renderEvents();
    });

    document.querySelector("#priority-filter")?.addEventListener("change", event => {
      this.priorityFilter = (event.target as HTMLSelectElement).value;
      this.renderEvents();
    });

    document.querySelector("#event-table-body")?.addEventListener("click", event => {
      const target = event.target as HTMLElement;
      const button = target.closest<HTMLButtonElement>("[data-review-id]");

      if (!button) return;

      const id = Number(button.dataset.reviewId);
      const selectedEvent = this.events.find(item => item.id === id);

      if (selectedEvent) {
        selectedEvent.status = "Revisado";
        this.renderEvents();
        this.renderAlerts();
        this.updateMetrics();
      }
    });

    document.querySelector("#alert-list")?.addEventListener("click", event => {
      const target = event.target as HTMLElement;
      const button = target.closest<HTMLButtonElement>("[data-review-alert]");

      if (!button) return;

      const id = Number(button.dataset.reviewAlert);
      const selectedEvent = this.events.find(item => item.id === id);

      if (selectedEvent) {
        selectedEvent.status = "Revisado";
        this.renderEvents();
        this.renderAlerts();
        this.updateMetrics();
      }
    });

    document.querySelector("#refresh-button")?.addEventListener("click", () => {
      this.renderEvents();
      this.renderAlerts();
      this.updateMetrics();

      const button = document.querySelector<HTMLButtonElement>("#refresh-button");
      if (button) {
        button.innerHTML = "<span>✓</span> Panel actualizado";
        window.setTimeout(() => {
          button.innerHTML = "<span>↻</span> Actualizar panel";
        }, 1500);
      }
    });

    document.querySelector("#export-button")?.addEventListener("click", () => {
      this.exportEvents();
    });
  }

  private renderEvents(): void {
    const tbody = document.querySelector<HTMLTableSectionElement>("#event-table-body");
    if (!tbody) return;

    const filtered = this.events.filter(item => {
      const matchesSearch = [
        item.type, item.subject, item.location, String(item.id)
      ].some(value => value.toLowerCase().includes(this.searchTerm));

      const matchesPriority =
        this.priorityFilter === "Todas" || item.priority === this.priorityFilter;

      return matchesSearch && matchesPriority;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr><td colspan="7" class="no-results">
          No se encontraron eventos con esos criterios.
        </td></tr>
      `;
    } else {
      tbody.innerHTML = filtered.map(item => `
        <tr>
          <td>
            <span class="event-name">
              <span class="event-dot ${item.priorityClass}"></span>
              ${this.escapeHtml(item.type)}
            </span>
          </td>
          <td>${this.escapeHtml(item.subject)}</td>
          <td>${this.escapeHtml(item.location)}</td>
          <td class="time-cell">${this.escapeHtml(item.time)}</td>
          <td>
            <span class="priority priority-${item.priorityClass}">
              ${item.priority}
            </span>
          </td>
          <td>
            <span class="event-status ${item.statusClass}">
              ${item.status}
            </span>
          </td>
          <td>
            ${item.status === "Pendiente"
              ? `<button class="table-action" data-review-id="${item.id}">Revisar</button>`
              : `<span class="done-label">✓ Revisado</span>`
            }
          </td>
        </tr>
      `).join("");
    }

    const count = document.querySelector<HTMLElement>("#table-count");
    if (count) {
      count.textContent = `Mostrando ${filtered.length} de ${this.events.length} eventos`;
    }
  }

  private renderAlerts(): void {
    const list = document.querySelector<HTMLDivElement>("#alert-list");
    if (!list) return;

    const pending = this.events.filter(item => item.status === "Pendiente");

    const counter = document.querySelector<HTMLElement>("#alert-counter");
    const navCount = document.querySelector<HTMLElement>("#nav-alert-count");
    const footer = document.querySelector<HTMLElement>("#alert-footer");

    if (counter) counter.textContent = String(pending.length).padStart(2, "0");
    if (navCount) navCount.textContent = String(pending.length);
    if (footer) footer.textContent = `${pending.length} alertas pendientes de revisión`;

    if (pending.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <span>✓</span>
          <strong>Todo revisado</strong>
          <p>No hay alertas pendientes en los datos de demostración.</p>
        </div>
      `;
      return;
    }

    list.innerHTML = pending.slice(0, 3).map(item => `
      <div class="alert-item">
        <span class="alert-indicator ${item.priorityClass}"></span>
        <div class="alert-copy">
          <strong>${this.escapeHtml(item.type)}</strong>
          <span>${this.escapeHtml(item.subject)} · ${this.escapeHtml(item.time)}</span>
          <small>${this.escapeHtml(item.location)} · Prioridad ${item.priority.toLowerCase()}</small>
        </div>
        <button
          class="review-button"
          data-review-alert="${item.id}"
          aria-label="Marcar ${this.escapeHtml(item.type)} como revisado"
          title="Marcar como revisado"
        >✓</button>
      </div>
    `).join("");
  }

  private updateMetrics(): void {
    const total = document.querySelector<HTMLElement>("#metric-total");
    const pending = document.querySelector<HTMLElement>("#metric-pending");
    const high = document.querySelector<HTMLElement>("#metric-high");

    if (total) total.textContent = String(this.events.length).padStart(2, "0");
    if (pending) {
      pending.textContent = String(
        this.events.filter(item => item.status === "Pendiente").length
      ).padStart(2, "0");
    }
    if (high) {
      high.textContent = String(
        this.events.filter(item => item.priority === "Alto").length
      ).padStart(2, "0");
    }
  }

  private exportEvents(): void {
    const rows = [
      ["ID", "Evento", "Individuo", "Ubicación", "Hora", "Prioridad", "Estado"],
      ...this.events.map(item => [
        String(item.id), item.type, item.subject, item.location,
        item.time, item.priority, item.status
      ])
    ];

    const csv = rows
      .map(row => row.map(value => `"${value.replace(/"/g, '""')}"`).join(","))
      .join("\r\n");

    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;"
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "safevision-events.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  private escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, character => {
      const entities: Record<string, string> = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      };

      return entities[character];
    });
  }
}

new SafeVisionDashboard().render();