declare module "@safevision/local-dev-access" {
  export interface LocalDevCredentials {
    email: string;
    password: string;
  }

  export function readLocalDevCredentials(): LocalDevCredentials | null;
  export function verifyLocalDevCredentials(email: string, password: string): boolean;
}
