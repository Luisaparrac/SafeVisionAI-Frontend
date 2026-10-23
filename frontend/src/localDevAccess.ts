/** Client for the Vite development server's local-only, server-validated login. */
export interface LocalDevStatus {
  configured: boolean;
}

async function localRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/__safevision/local-dev/${path}`, {
    ...init,
    credentials: "same-origin",
    headers: { Accept: "application/json", ...init?.headers },
  });
  const body = response.status === 204 ? undefined : await response.json().catch(() => undefined);
  if (!response.ok) {
    const message = body && typeof body === "object" && "message" in body && typeof body.message === "string"
      ? body.message
      : `Local access returned HTTP ${response.status}.`;
    throw new Error(message);
  }
  return body as T;
}

export function getLocalDevStatus(): Promise<LocalDevStatus> {
  return localRequest("status");
}

export async function hasLocalDevSession(): Promise<boolean> {
  const result = await localRequest<{ authenticated: boolean }>("session");
  return result.authenticated === true;
}

export function loginLocalDev(email: string, password: string): Promise<{ authenticated: boolean }> {
  return localRequest("login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
}

export function logoutLocalDev(): Promise<void> {
  return localRequest("logout", { method: "POST" });
}
