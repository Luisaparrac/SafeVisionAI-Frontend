/**
 * Local-only credentials. This module is dynamically imported only by the
 * Vite development server on localhost; never use it as backend auth.
 */
export interface LocalDevCredentials {
  email: string;
  password: string;
}

export function readLocalDevCredentials(): LocalDevCredentials | null {
  const email = import.meta.env.VITE_LOCAL_DEV_EMAIL;
  const password = import.meta.env.VITE_LOCAL_DEV_PASSWORD;
  return email && password ? { email, password } : null;
}

export function verifyLocalDevCredentials(email: string, password: string): boolean {
  const credentials = readLocalDevCredentials();
  return Boolean(credentials && email.trim().toLowerCase() === credentials.email.trim().toLowerCase() && password === credentials.password);
}
