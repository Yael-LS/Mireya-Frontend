# Mireya AI — Frontend

Chat biográfico en Next.js con streaming SSE, Markdown, sesiones persistentes y recuerdos dinámicos. La interfaz habla con el backend mediante rutas servidor (`/api/chat` y `/api/backend/*`), manteniendo la API key y las credenciales de Supabase fuera del navegador.

## Desarrollo local

1. Desde `Frontend`, copia `.env.example` como `.env.local`.
2. Si el backend tiene `SERVICE_API_KEY`, escribe el mismo valor en `API_KEY`. Si no la usa, déjalo vacío.
3. Inicia el agente en `cv-agent-main` con `uvicorn app.main:app --reload`.
4. Ejecuta `npm install` y `npm run dev` en esta carpeta.

Por defecto, `API_URL`/`BACKEND_URL` apunta a `http://127.0.0.1:8000`. También se acepta el valor legado terminado en `/v1/responses`; el proxy lo normaliza automáticamente.

## Vercel + Render

Configura estas variables de entorno en Vercel:

| Variable | Valor |
| --- | --- |
| `BACKEND_URL` | URL pública base de Render, por ejemplo `https://mireya-api.onrender.com` |
| `API_KEY` | El mismo valor de `SERVICE_API_KEY` en Render, si se configuró |

En Render, restringe `CORS_ORIGINS` al dominio de Vercel cuando el frontend ya esté desplegado. Aunque esta app usa un proxy servidor y no depende del CORS del navegador, mantener la política restrictiva es recomendable para otros consumidores de la API.
