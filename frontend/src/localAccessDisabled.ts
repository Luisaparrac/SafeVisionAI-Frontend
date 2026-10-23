/** Production stub: local development access is never included in production builds. */
export interface LocalDevStatus {
  configured: false;
}

export async function getLocalDevStatus(): Promise<LocalDevStatus> {
  return { configured: false };
}

export async function hasLocalDevSession(): Promise<boolean> {
  return false;
}

export async function loginLocalDev(_email: string, _password: string): Promise<never> {
  throw new Error("Local development access is unavailable in production.");
}

export async function logoutLocalDev(): Promise<void> {}
