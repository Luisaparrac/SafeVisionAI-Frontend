# Safe Vision AI frontend

TypeScript and Vite frontend for the Safe Vision AI monitoring dashboard.

## Local development

1. Copy `.env.example` to `.env.local`.
2. Set `SAFEVISION_LOCAL_DEV_EMAIL` and `SAFEVISION_LOCAL_DEV_PASSWORD` in `.env.local` to local-only values. The Vite development server validates these values; they are not placed in the browser bundle. Do not reuse production credentials.
3. Set `VITE_API_URL` if the FastAPI backend is not at the default URL.
4. Run `npm install`, then `npm run dev` from this directory.

Local sign-in is available only on loopback hosts while Vite is serving the app. It uses an in-memory development session and is not an authentication mechanism for the backend. Restarting Vite clears these sessions.

## FastAPI integration

The frontend uses the documented FastAPI cookie-session contract: `POST /api/auth/login`, `GET /api/auth/me`, and `POST /api/auth/logout`. Requests include browser credentials so the backend's HttpOnly session cookie remains in the browser. The UI stays behind the backend session gate; the local development session does not authenticate against FastAPI. Production builds replace the local development access module with a disabled stub.

Camera records, event history, and pending alerts come from `/api/camaras`, `/api/eventos`, and `/api/alertas/pendientes`. The browser never connects to the camera or PostgreSQL. Real-time alerts use a ticket from `/api/auth/ws-ticket` with `/ws/alertas`; WebSocket notifications trigger a REST refresh, which reconciles updates without duplicating events or alerts. If the backend deployment is unavailable, data requests show an error and can be retried; no detections or camera status are synthesized.

## Local IoT verification

1. Start the redeployed FastAPI service and configure its allowed frontend origin and authentication using the backend's documented deployment settings.
2. Configure the IoT application's `.env` in the IoT repository with `BACKEND_URL`, its private `IOT_API_KEY`, and the matching `CAMERA_ID` (plus the camera's RTSP URL if testing a physical camera). Never put these values in this frontend's `.env.local`.
3. Run this frontend locally, sign in with either the configured local development gate (for UI-only use) or a valid FastAPI user session (for API data), then open Cameras, Event history, and Alerts.
4. In the IoT repository, run its documented `send-test-event --type "Caída"` command with the configured camera and a matching backend event type. The event and generated pending alert should appear after the frontend's REST refresh or alert WebSocket notification.
5. To verify camera status, start the IoT monitor with `run --no-ai`; the API status changes only when the IoT monitor reports frames or a failed camera connection. A physical RTSP camera is required to verify the connected/active path. If the backend is still redeploying, frontend end-to-end verification must wait until its health, auth, and IoT routes are reachable.

## Commands

- `npm run dev` — start the Vite development server.
- `npm run build` — type-check and create a production build.
- `npm test` — run the existing Node test suite.
- `npm run preview` — preview the production build locally.
