# Safe Vision AI — frontend

Frontend de Safe Vision AI construido con TypeScript y Vite. La aplicación consulta el backend FastAPI para mostrar métricas, eventos, alertas, cámaras y catálogos. El estado de cámaras es el que reporta la API; el panel no simula transmisiones ni detecciones en vivo.

## Requisitos

- Node.js compatible con Vite 8.
- npm.

## Desarrollo local

Desde la carpeta `frontend`:

```sh
npm install
npm run dev
```

Vite muestra la dirección local al iniciar. `VITE_API_URL` permite seleccionar un backend distinto; si se omite, el cliente usa `https://safevision-backend-pw6t.onrender.com`.

El acceso temporal de desarrollo solo se activa en `localhost` con `VITE_LOCAL_DEV_EMAIL` y `VITE_LOCAL_DEV_PASSWORD` configurados en `.env.local`. No es autenticación FastAPI; no uses credenciales reales. `.env.local` y los demás archivos `.env*` están ignorados por Git. El build de producción sustituye el módulo local por una implementación deshabilitada.

## Validación

```sh
npm test
npm run build
```

## Integración backend

El contrato OpenAPI actual no documenta login/sesión/logout, registro, recuperación de contraseña ni un flujo de vídeo o detecciones en vivo. El login de producción permanece bloqueado hasta que el backend publique autenticación real. Consulta [BACKEND_INTEGRATION_AUDIT.md](../BACKEND_INTEGRATION_AUDIT.md) para endpoints confirmados y tareas pendientes.
