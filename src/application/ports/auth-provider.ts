export interface AuthProvider {
  getAuthorizationHeader(): Promise<string>;
  invalidate(): void;
}

