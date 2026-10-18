# Safe Vision AI — requisitos pendientes del backend

Verificado contra `https://safevision-backend-pw6t.onrender.com/openapi.json` (OpenAPI 3.1.0, API 2.0.0; consultado el 18 de octubre de 2026).

## Endpoints documentados que consume el frontend

| Uso | Endpoint |
| --- | --- |
| Salud | `GET /health` |
| Disponibilidad con comprobación de base de datos | `GET /health/ready` |
| Métricas | `GET /api/metricas` — `{ total, pendientes, alto }` |
| Historial filtrado | `GET /api/eventos` — `q`, `prioridad`, `estado`, `camara_id`, `desde`, `hasta`, `limit`, `offset` |
| Eventos recientes | `GET /api/eventos/recientes?limit=…` |
| Detalle de evento | `GET /api/eventos/{event_id}` |
| Revisar evento | `PATCH /api/eventos/{event_id}/revisar` |
| Marcar falsa alarma | `PATCH /api/eventos/{event_id}/falsa-alarma` |
| Alertas pendientes | `GET /api/alertas/pendientes?limit=…` |
| Marcar alerta vista | `PATCH /api/alertas/{alert_id}/vista` |
| Cámaras | `GET /api/camaras` |
| Actualizar estado reportado por IoT | `PATCH /api/camaras/{camera_id}/estado` — requiere `X-API-Key` |
| Catálogos | `GET /api/tipos-evento`, `GET /api/ubicaciones`, `GET /api/zonas`, `GET /api/sujetos` |

El cliente tipado está en `frontend/src/api.ts`. Los eventos se exportan como CSV desde la página consultada y conservan los filtros activos en el archivo. La paginación usa `limit/offset` que documenta la API. La interfaz presenta horas del evento como hora de origen; la especificación no entrega una zona horaria.

## Bloqueos para completar el acceso y publicar la aplicación

La especificación consultada no declara operaciones de autenticación ni un esquema de seguridad OpenAPI. No están documentados:

- Inicio de sesión, sesión/usuario actual, cierre de sesión ni expiración/renovación.
- Registro, verificación de correo, recuperación y restablecimiento de contraseña.
- OAuth de Google ni verificación por SMS.
- Autorización por roles/permisos para operaciones y datos.
- Un contrato de cookies HttpOnly/Secure/SameSite o CSRF. El cliente está preparado para enviar credenciales de cookie (`credentials: include`) una vez exista un contrato, pero no guarda tokens ni puede autenticar hoy.

Por ello, el frontend mantiene bloqueado el acceso mediante autenticación backend y no envía credenciales a rutas supuestas. En desarrollo local existe un acceso temporal separado, limitado a `localhost` y a credenciales configuradas en `.env.local`; no valida ni crea una sesión en FastAPI. La configuración de Vite reemplaza ese módulo por una implementación deshabilitada durante el build. Para habilitar acceso real, el backend debe publicar contratos de login y sesión en OpenAPI, definir el formato de respuesta y el mecanismo de cookie/CSRF, permisos, expiración y logout. El inicio de sesión, el registro y la recuperación se integrarán solo después de confirmar ese contrato.

La API sí ofrece `PATCH /api/alertas/{alert_id}/vista` (marca alerta vista) y `PATCH /api/eventos/{event_id}/revisar` (revisa evento). Son operaciones diferentes y se presentan como tales.

## Cámaras y vídeo

`GET /api/camaras` entrega `camera_id`, `name`, `ip_address`, `status` y `location_id`. El campo `status` es el estado reportado por el módulo IoT; `PATCH /api/camaras/{camera_id}/estado` solo actualiza ese campo y requiere `X-API-Key`. No hay una operación de consulta de estado de transmisión ni una URL de vídeo.

El OpenAPI no publica RTSP proxy, HLS, WebRTC, MJPEG ni otro protocolo de vídeo compatible con navegador. Para mostrar vídeo real, el backend debe proporcionar un endpoint o protocolo de reproducción compatible, autenticación/autorización del stream y un contrato de estado/reconexión. Si la Tapo C110 entrega RTSP, hace falta que el backend lo convierta a WebRTC o HLS; no debe exponerse la cámara directamente al navegador.

El flujo `POST /api/eventos` recibe detecciones del módulo IoT y requiere `X-API-Key`; no es un feed de detecciones en tiempo real para el navegador. No hay endpoint de consulta en vivo, WebSocket ni Server-Sent Events en OpenAPI. Para mostrar resultados de IA en vivo, el backend debe especificar uno de esos mecanismos (o una consulta periódica documentada), el esquema de detección y sus marcas de tiempo, y la autorización correspondiente. Hasta que exista ese contrato, el frontend no reproduce vídeo, no muestra detecciones en vivo ni realiza reintentos de transmisión.

## CORS y cuenta temporal de pruebas

Configurar CORS en el backend para el origen de producción de Vercel ya existente y los orígenes locales usados por el equipo; permitir credenciales solo con orígenes explícitos, nunca `*` junto a cookies.

No se creó una cuenta de usuario en el backend. El acceso local temporal usa credenciales de desarrollo en el archivo ignorado `.env.local`; ese mecanismo no debe usarse como autenticación de producción y las variables `VITE_*` no son secretos de backend. Para pruebas de autenticación real, el backend debe crear una cuenta aislada con secretos del entorno de pruebas, contraseña con hash robusto y proceso documentado de baja/eliminación de cuenta, variables y datos de prueba antes de producción. No guardar credenciales reales en este repositorio.

## Ejecución local

Desde `frontend`, ejecutar `npm run dev`. Opcionalmente definir `VITE_API_URL` para apuntar a otro backend; si se omite, se usa la URL de producción existente. El acceso local temporal requiere `VITE_LOCAL_DEV_EMAIL` y `VITE_LOCAL_DEV_PASSWORD` en `.env.local`, solo en `localhost`; no proporciona datos de demostración. La aplicación consulta la API real y muestra errores/vacíos si no hay respuesta. El build de producción no incluye la implementación que verifica esas credenciales.
