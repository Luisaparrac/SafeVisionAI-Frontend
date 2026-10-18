/** Production replacement for the local development access module. */
export function readLocalDevCredentials(): null {
  return null;
}

export function verifyLocalDevCredentials(_email: string, _password: string): boolean {
  return false;
}
