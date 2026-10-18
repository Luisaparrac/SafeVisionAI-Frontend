# Auditoría de integración del frontend — Safe Vision AI

**Fecha de revisión:** 18 de octubre de 2026 · **Frontend revisado:** `frontend/src/api.ts`, `frontend/src/main.ts`, `frontend/src/localDevAccess.ts`, `frontend/src/localAccessDisabled.ts`, `frontend/vite.config.ts`, `frontend/src/i18n/`
**Contrato backend consultado:** `https://safevision-backend-pw6t.onrender.com/openapi.json` (OpenAPI 3.1.0; API 2.0.0).

Esta auditoría no modifica código de aplicación ni configura/despliega servicios. Los estados describen el contrato OpenAPI consultado y la implementación presente en el frontend; no prueban que la base de datos contenga registros ni que dispositivos IoT estén conectados.

## Resumen ejecutivo

- La API documenta y el frontend consume las consultas de salud, métricas, eventos, alertas, cámaras y catálogos. Sus modelos principales coinciden con los esquemas OpenAPI publicados.
- No aparecen `securitySchemes` ni requisitos de seguridad declarados en OpenAPI. La protección/autorización de las rutas de datos y CORS con cookies queda **pendiente de confirmar** con backend; no debe interpretarse como que los datos deban ser públicos.
- No se encontró contrato backend para login, sesión de usuario actual, logout, registro, verificación, OAuth Google, SMS, recuperación ni cambio de contraseña. El formulario no llama a una ruta de login. En el bundle de producción el módulo de acceso local se reemplaza por una implementación que siempre devuelve `null`/`false`; en desarrollo, el acceso local depende de `VITE_LOCAL_DEV_EMAIL` y `VITE_LOCAL_DEV_PASSWORD`, funciona únicamente en `localhost` y no autentica contra FastAPI.
- El backend entrega metadatos y estado reportado de cámaras, pero no publica un stream reproducible por navegador ni un canal de detecciones en vivo. El reproductor se mantiene en estado no disponible; no hay integración de vídeo/IA en directo en frontend.
- El CSV se genera en el navegador a partir de la página de eventos ya consultada; no se solicita una exportación al backend y, por tanto, contiene como máximo los eventos de esa página (por defecto, hasta 50), no necesariamente el historial completo.

## Configuración y transporte HTTP

`SafeVisionApi` construye la URL con `import.meta.env.VITE_API_URL`; si no está configurada, usa `https://safevision-backend-pw6t.onrender.com`. Elimina una barra final, envía `Accept: application/json` y `credentials: "include"`, y convierte respuestas no exitosas en `ApiError`. No añade `Content-Type` de forma global ni envía credenciales en el cuerpo de ninguna llamada actual. El cliente acepta `204` sin cuerpo; para las demás respuestas exitosas espera JSON.

La especificación OpenAPI no anuncia autenticación por cookie, bearer token, CSRF ni `securitySchemes`. Que el navegador incluya cookies no constituye por sí solo un contrato de sesión. El backend debe definir CORS por origen explícito si la aplicación cross-origin usa cookies; no se verifica el comportamiento CORS en esta auditoría.

## Matriz de endpoints

“Implementada y compatible” significa que la ruta, método, parámetros y forma de datos que espera el frontend coinciden con OpenAPI. La autenticación sigue pendiente de confirmar cuando se indica en la columna correspondiente. “Pendiente de confirmar” significa que OpenAPI no contiene la ruta/contrato necesario o no permite verificar su comportamiento.

| Operación del frontend | Método y ruta | Parámetros / solicitud | Respuesta esperada por frontend | Autenticación según contrato | Estado |
|---|---|---|---|---|---|
| Salud en resumen | `GET /health` | Sin parámetros ni cuerpo | Objeto JSON de propiedades string | No declarada en OpenAPI; confirmar política de acceso | Implementada y compatible |
| Métricas | `GET /api/metricas` | Sin parámetros ni cuerpo | `{ total: number, pendientes: number, alto: number }` | No declarada; confirmar autenticación y autorización de datos | Implementada y compatible |
| Historial de eventos | `GET /api/eventos` | Query: `q`, `prioridad`, `estado`, `camara_id`, `desde`, `hasta`, `limit`, `offset`; sin cuerpo. La UI expone búsqueda, prioridad, estado y fechas; `camara_id` está en el cliente, no en los controles actuales. `limit` inicial 50 | Array de `EventOut`: `id`, `type`, `subject`, `location`, `camera`, `date`, `time`, `priority`, `status`, `description?` | No declarada; confirmar | Implementada y compatible |
| Actividad reciente | `GET /api/eventos/recientes?limit=10` | `limit` (API admite 1–100); sin cuerpo | Array de `EventOut` | No declarada; confirmar | Implementada y compatible |
| Detalle de evento | `GET /api/eventos/{event_id}` | Path `event_id` entero | Un `EventOut` | No declarada; confirmar | Implementada y compatible |
| Revisar evento | `PATCH /api/eventos/{event_id}/revisar` | Path `event_id`; sin cuerpo | Un `EventOut`; API indica que cierra alertas del evento | No declarada; confirmar permiso de revisión | Implementada y compatible |
| Marcar falsa alarma | `PATCH /api/eventos/{event_id}/falsa-alarma` | Path `event_id`; sin cuerpo | Un `EventOut`; puede responder `409` si ya fue resuelto | No declarada; confirmar permiso | Implementada en cliente, acción no expuesta en la UI actual; contrato compatible |
| Alertas pendientes | `GET /api/alertas/pendientes?limit=20` (resumen) / `?limit=100` (sección Alertas) | Query `limit` (API admite 1–100); sin cuerpo | Array de `AlertOut`: `id_alerta`, `nivel`, `estado`, `event: EventOut` | No declarada; confirmar | Implementada y compatible |
| Marcar alerta vista | `PATCH /api/alertas/{alert_id}/vista` | Path `alert_id`; sin cuerpo | Un `AlertOut`; API aclara que verla no cierra la alerta. Puede responder `409` si ya fue atendida/descartada | No declarada; confirmar permiso | Implementada y compatible |
| Lista/estado reportado de cámaras | `GET /api/camaras` | Sin parámetros ni cuerpo | Array de `CameraOut`: `camera_id`, `name`, `ip_address`, `status`, `location_id` | No declarada; confirmar | Implementada y compatible para metadatos/estado reportado |
| Tipos de evento | `GET /api/tipos-evento` | Sin parámetros ni cuerpo | Array `EventTypeOut`: `event_type_id`, `name`, `description`, `severity_level`, `priority` | No declarada; confirmar | Implementada y compatible |
| Ubicaciones | `GET /api/ubicaciones` | Sin parámetros ni cuerpo | Array `LocationOut`: `location_id`, `name`, `description` | No declarada; confirmar | Implementada y compatible |
| Sujetos | `GET /api/sujetos` | Sin parámetros ni cuerpo | Array `SubjectOut`: `subject_id`, `name`, `subject_type`, `description` | No declarada; confirmar | Implementada y compatible |
| Zonas | `GET /api/zonas` | Sin parámetros ni cuerpo | Array `ZoneOut`: `zone_id`, `name`, `description`, `coordinates`, `is_active`, `camera_id` | No declarada; confirmar | Implementada y compatible |
| Actualizar estado reportado por IoT | `PATCH /api/camaras/{camera_id}/estado` | Path `camera_id`; header `X-API-Key`; JSON `{ "status": "active" | "inactive" | "disconnected" | "maintenance" }` | `{ camera_id, status }` | API key del módulo IoT según descripción OpenAPI | Pendiente de confirmar para UI: existe en backend, pero frontend no la invoca; no integrar desde navegador sin contrato/credencial apropiados |
| Ingestar detección IoT | `POST /api/eventos` | JSON `EventIn` (requiere `camera_id`; admite `event_type_id` o `event_type`, `subject_id`, `zone_id`, clase detectada, confianza, URL de evidencia y descripción); header `X-API-Key` descrito para módulo IoT | `201 EventOut`; puede marcar duplicado con `X-Duplicate: true` | API key del módulo IoT según descripción OpenAPI | Pendiente de confirmar para UI: ruta de ingreso IoT, no es endpoint de lectura ni lo usa el frontend |

### Búsqueda, paginación y CSV

La UI presenta búsqueda libre, prioridad, estado y rango de fechas. `camara_id` se admite en el tipo cliente/API, pero no se ofrece actualmente como filtro visible. El paginador envía `limit=50` y modifica `offset`; el frontend asume que `GET /api/eventos` devuelve un array directo, que coincide con OpenAPI.

La exportación CSV no es una llamada API. Serializa `this.events`, aplica escape de comillas y BOM UTF-8, e incluye los filtros aplicados como metadatos. Exporta únicamente los registros cargados en la página actual; el frontend no obtiene más páginas automáticamente para generar un CSV completo.

## Autenticación y cuenta

OpenAPI actual no declara ninguna de estas operaciones ni un esquema de autenticación. No se deben dar por existentes rutas que no estén publicadas.

| Capacidad solicitada | Comprobación en contrato/frontend | Estado |
|---|---|---|
| `POST /api/auth/login` | La operación no está en OpenAPI. No hay llamada de login ni serialización de email/contraseña contra backend. El formulario solo valida campos y, en desarrollo localhost con credenciales Vite presentes, compara localmente. | Pendiente de confirmar / no implementada contra backend |
| `GET /api/auth/me` | No se publica esa ruta ni otra operación GET que describa usuario/sesión actual. El frontend busca dinámicamente en OpenAPI un endpoint con nombre de sesión/perfil/usuario actual y lo consulta solo si encuentra uno; no encuentra contrato en el documento actual. | Pendiente de confirmar / no disponible en contrato actual |
| `POST /api/auth/logout` | No se publica ni se invoca. El cierre de sesión disponible solo elimina la clave de sesión temporal de `sessionStorage` para acceso local. | Pendiente de confirmar / no implementada contra backend |
| Registro por correo y contraseña | No hay operación publicada ni llamada. El botón muestra que el registro no está disponible. | Pendiente de confirmar |
| Verificación de correo | No hay operación ni flujo publicado. | Pendiente de confirmar |
| Inicio de sesión con Google | No hay operación OAuth ni callback publicados. | Pendiente de confirmar |
| Verificación telefónica mediante código | No hay operaciones para emitir/verificar código publicadas. | Pendiente de confirmar |
| Recuperación/restablecimiento de contraseña | No hay operación publicada ni llamada. El botón de recuperación informa que no está disponible. | Pendiente de confirmar |
| Cambio de contraseña autenticado | No hay operación publicada ni llamada. | Pendiente de confirmar |
| Autorización/roles para rutas de datos | No hay `securitySchemes` ni `security` declarados en el OpenAPI revisado. | Pendiente de confirmar |

### Acceso local y persistencia

`frontend/vite.config.ts` aliasa `@safevision/local-dev-access` a `localDevAccess.ts` al ejecutar Vite `serve`, y a `localAccessDisabled.ts` para el resto de comandos (incluida compilación de producción). El módulo de desarrollo lee `VITE_LOCAL_DEV_EMAIL` y `VITE_LOCAL_DEV_PASSWORD`; la app limita el modo a `import.meta.env.DEV` y host `localhost`, `127.0.0.1` o `::1`. La bandera de sesión se guarda en `sessionStorage` y la comparación de credenciales sucede en el navegador. Esto es solo acceso temporal de desarrollo, no autenticación backend; las variables `VITE_*` son visibles para el cliente en el entorno donde se cargan.

No se observa persistencia de token de backend. El cliente manda `credentials: include` para solicitudes HTTP, pero no hay login que establezca una cookie ni contrato para verificarla. El idioma (`safevision-language`), tema (`safevision-theme`) y preferencia de movimiento se guardan en `localStorage`; no son datos de cuenta ni preferencias sincronizadas al backend.

## Cámaras, transmisión e inteligencia artificial

| Necesidad del producto | Lo que existe | Lo que falta / conclusión |
|---|---|---|
| Obtener lista y estado real reportado de cámara | `GET /api/camaras` entrega metadatos y el campo `status`; frontend consulta al entrar a Resumen o Cámaras y representa el valor devuelto. | No hay timestamp/edad de reporte en `CameraOut`; por tanto, no se puede determinar si el estado reportado está actualizado. El endpoint no prueba por sí solo que el vídeo se esté transmitiendo. |
| Actualizar estado de cámara | `PATCH /api/camaras/{camera_id}/estado` existe para el módulo IoT y documenta `X-API-Key` y los valores válidos. | No es llamado desde frontend. No exponer una API key IoT en navegador. |
| Vídeo en directo | No hay ruta de stream ni URL/protocolo en `CameraOut`; no se publican HLS, WebRTC, MJPEG, proxy RTSP ni endpoint equivalente. | Backend debe ofrecer una fuente de reproducción compatible con navegador, autorización, estado de stream y contrato de desconexión/reconexión. El frontend actualmente presenta un reproductor inactivo y no solicita vídeo. |
| Fecha/hora de transmisión | `EventOut` tiene `date` y `time` del evento, no del stream. | Backend debe indicar timestamp de stream con zona horaria/semántica definida; fecha del evento no se puede reutilizar como hora de transmisión. |
| Ingreso de detección de IA/IoT | `POST /api/eventos` existe para que el módulo IoT registre una detección, con `X-API-Key`, y genera/actualiza evento/alerta. | Es entrada IoT, no canal hacia el panel. El frontend no lo llama. |
| Consultar detecciones/alertas recientes | `GET /api/eventos`, `/api/eventos/recientes`, `/api/alertas/pendientes` existen y el frontend los consulta al cargar la vista. | Son consultas HTTP puntuales; OpenAPI no publica WebSocket, SSE ni endpoint de feed en vivo. No se observó sondeo periódico en frontend. Definir si se requiere actualización en vivo o basta con refresco manual/recarga de sección. |
| Marcas de tiempo de eventos | `EventOut` devuelve `date` y `time`; el contrato no especifica zona horaria en la descripción del esquema. | Acordar zona/offset o devolver timestamp ISO 8601 con offset explícito para evitar ambigüedad entre cámaras, backend y navegador. |

## Errores, carga y respuestas vacías

- El cliente diferencia errores de red (`ApiError.status === 0`), HTTP y `204`; para HTTP intenta leer `detail` o `message`, pero FastAPI puede entregar `detail` como lista de validación (caso `422`), que no se muestra como mensaje textual concreto.
- `loadResource` conserva el estado vacío por separado del error: en error registra detalle en consola y presenta mensaje localizado discreto con opción de reintento; mientras carga muestra indicador; arrays vacíos confirmados muestran estado vacío. En Resumen agrupa avisos de recursos que comparten el mismo mensaje para reducir duplicación.
- Si una operación responde `401`, la app limpia datos protegidos y vuelve a la puerta de acceso. Hoy el backend no publica el contrato de sesión requerido para que ese ciclo funcione con autenticación real.
- El estado de cámara deriva del texto `status` retornado. La UI marca `connected`/`conectada` como conectado; el enum del endpoint de actualización documenta `active`, `inactive`, `disconnected`, `maintenance`. Como la lista no define formalmente esos valores en OpenAPI, el mapeo entre `active` y “conectada” necesita confirmarse. La pantalla no afirma que haya stream cuando solo hay estado de inventario.
- El alcance del CSV es local a la página visible, como se detalla arriba; no representa una exportación total salvo que se carguen todos los registros por otro medio.

## Incompatibilidades y decisiones pendientes

1. **Autenticación incompleta:** la UI de login no hace login backend; el build de producción desactiva el acceso local. Sin contrato de login/me no se puede abrir el panel de producción legítimamente.
2. **Autorización no especificada:** OpenAPI no declara controles para consultas o acciones de revisión. Backend debe declarar autenticación, permisos y comportamiento `401/403`.
3. **Estado de cámara ambiguo:** `CameraOut.status` es string abierta, mientras que el endpoint de actualización documenta un enum en inglés. Confirmar valores observados por `GET /api/camaras` y correspondencia visual.
4. **Sin vídeo/IA en vivo:** no hay endpoint/protocolo de streaming, ni canal de eventos en tiempo real, ni timestamps de transmisión.
5. **CSV parcial:** se exporta solo la página actual de datos.
6. **Acciones sin interfaz o contrato de rol:** `markFalseAlarm` existe en cliente y backend, pero no se ofrece como acción visible actualmente. Si se habilita, acordar permisos y resultado de conflictos `409`.
7. **CORS y cookies:** `credentials: include` está preparado en el cliente, pero orígenes permitidos, cookies, `SameSite`, `Secure`, expiración y CSRF no se verifican ni especifican en OpenAPI.

## Prioridades y tareas concretas

### Backend

**P0 — habilitar acceso seguro**

- Publicar contratos OpenAPI para login (`POST /api/auth/login` o ruta acordada), consulta de sesión/identidad, logout, expiración y, si aplica, renovación.
- Definir mecanismo de sesión (recomendado: cookie `HttpOnly`, `Secure`, `SameSite` cuando la topología lo permita), CSRF, CORS con orígenes explícitos, respuestas `401/403` y permisos por rol para lectura/revisión.
- Confirmar si la cuenta requiere verificación de correo y documentar registro, verificación, recuperación y cambio de contraseña. Documentar OAuth Google y SMS solo si son parte del alcance real.
- Proveer procedimiento seguro para cuentas aisladas de QA; no colocar secretos en el frontend ni en variables `VITE_*`.

**P1 — especificar operación de cámara e IA**

- Confirmar valores y frescura de `CameraOut.status`; añadir si hace falta `last_seen_at`/timestamp de estado y documentar su semántica.
- Diseñar fuente de vídeo de navegador (WebRTC/HLS/MJPEG según arquitectura) con acceso autorizado, URL/manifest, timestamp de emisión, salud del stream y reglas de reintento.
- Definir canal de detecciones para UI (SSE/WebSocket o sondeo documentado), esquema, timestamps con zona horaria, orden/duplicados, reconexión y permisos. Mantener separado del `POST /api/eventos` IoT con `X-API-Key`.

**P2 — cerrar contrato de datos y operación**

- Declarar autenticación en OpenAPI para endpoints de datos/acciones, incluyendo el alcance real de `X-API-Key` para IoT.
- Definir formato de fecha/hora y zona horaria de eventos y alertas.
- Confirmar semántica de `PATCH .../vista`, revisión y falsa alarma, errores `409`, idempotencia y permisos.
- Acordar exportación completa: descarga backend o paginación reiterada y límites, si el requisito del producto es exportar todo el historial.

### Frontend

**P0 — autenticación**

- Integrar login, comprobación de sesión y logout únicamente contra contratos confirmados; no habilitar acceso local en producción ni reutilizar el `X-API-Key` IoT.
- Conectar estados de registro/verificación/Google/SMS/recuperación/cambio de contraseña solo tras recibir rutas, payloads, errores y UX acordados. Hasta entonces, indicar que no están disponibles.
- Manejar errores `401/403`, cookies/CSRF y expiración conforme al contrato backend.

**P1 — cámaras y detecciones**

- Implementar el reproductor y su ciclo de reconexión cuando el backend entregue contrato de stream real; detener conexión y reintentos al salir/cerrar sesión.
- Conectar detecciones en vivo al canal confirmado y mostrar timestamps del backend; no inferir detecciones desde el estado de cámara.
- Mapear estados de cámara usando los valores formales confirmados; tratar desconocidos como estado desconocido, no como conexión.

**P2 — datos y exportación**

- Decidir si se añade filtro visual por cámara (el API cliente ya modela `camara_id`).
- Si el CSV debe ser completo, cargar todas las páginas respetando límites o consumir un endpoint de exportación documentado; mantener explícito el alcance si sigue siendo exportación de página actual.
- Mostrar con claridad respuestas vacías frente a errores y mantener mensajes técnicos en consola, conforme al comportamiento actual.

## Fuentes verificadas

- Contrato remoto: [OpenAPI JSON de SafeVision AI](https://safevision-backend-pw6t.onrender.com/openapi.json), consultado el 18 de octubre de 2026.
- Cliente y contratos esperados: `frontend/src/api.ts`.
- Flujo de acceso, vistas, carga, acciones, preferencias y exportación: `frontend/src/main.ts`.
- Separación del modo local entre Vite `serve` y build: `frontend/vite.config.ts`, `frontend/src/localDevAccess.ts`, `frontend/src/localAccessDisabled.ts`.
