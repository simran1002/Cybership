/**
 * HTTP client abstraction
 * Allows for easy stubbing in tests
 */

export interface HttpClient {
  post<T>(url: string, body: unknown, headers?: Record<string, string>): Promise<T>;
  get<T>(url: string, headers?: Record<string, string>): Promise<T>;
}

export interface HttpResponse<T> {
  status: number;
  data: T;
  headers: Record<string, string>;
}

/**
 * Default HTTP client implementation using Node.js fetch
 * In a real production environment, you might use axios or node-fetch
 */
export class FetchHttpClient implements HttpClient {
  constructor(private timeout: number = 30000) {}

  async post<T>(
    url: string,
    body: unknown,
    headers: Record<string, string> = {}
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      return await response.json() as T;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timeout after ${this.timeout}ms`);
      }
      throw error;
    }
  }

  async get<T>(
    url: string,
    headers: Record<string, string> = {}
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          ...headers
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      return await response.json() as T;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timeout after ${this.timeout}ms`);
      }
      throw error;
    }
  }
}
