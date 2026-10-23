// Acceso al backend FastAPI desde las rutas del servidor (la API key nunca llega al navegador).

export function backendApiUrl(path: string) {
  const base = process.env.BACKEND_URL ?? process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";
  return `${base.replace(/\/$/, "").replace(/\/v1\/responses$/, "")}/api/${path}`;
}

export function backendHeaders(): Record<string, string> {
  const apiKey = process.env.SERVICE_API_KEY ?? process.env.API_KEY;
  return { "Content-Type": "application/json", ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) };
}
