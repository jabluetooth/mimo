export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

type ApiFetchInit = {
  method?: string;
  headers?: Record<string, string>;
  body?: BodyInit;
  /** Attached as `Authorization: Bearer <token>` when set. */
  token?: string;
};

// Shared interface for every authenticated call to the n8n webhooks: attach
// the bearer token, branch on content-type, and shape a consistent error
// from whatever the workflow responded with. One seam instead of four
// near-identical copies across the pages that call these webhooks.
export async function apiFetch<T>(url: string, init: ApiFetchInit = {}): Promise<T> {
  const headers: Record<string, string> = { ...init.headers };
  if (init.token) headers.Authorization = `Bearer ${init.token}`;

  const response = await fetch(url, {
    method: init.method ?? 'GET',
    headers,
    body: init.body,
  });

  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const payload: unknown = isJson ? await response.json().catch(() => ({})) : await response.text();

  if (!response.ok) {
    const record = isJson && payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : null;
    const message =
      (record && typeof record.error === 'string' && record.error) ||
      (record && typeof record.message === 'string' && record.message) ||
      `HTTP ${response.status}`;
    throw new ApiError(message, response.status);
  }

  return payload as T;
}
