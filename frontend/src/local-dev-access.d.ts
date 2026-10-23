declare module "@safevision/local-dev-access" {
  export interface LocalDevStatus {
    configured: boolean;
  }

  export function getLocalDevStatus(): Promise<LocalDevStatus>;
  export function hasLocalDevSession(): Promise<boolean>;
  export function loginLocalDev(email: string, password: string): Promise<{ authenticated: boolean }>;
  export function logoutLocalDev(): Promise<void>;
}
