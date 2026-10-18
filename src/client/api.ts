const KEY = 'deadlock-access-key';
function storedKey(): string | undefined {
  try {
    return sessionStorage.getItem(KEY) ?? undefined;
  } catch {
    return undefined;
  }
}
export async function api<T>(
  path: string,
  body?: unknown,
  method = body === undefined ? 'GET' : 'POST',
  retried = false,
): Promise<T> {
  const key = storedKey();
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (key) headers['x-access-key'] = key;
  const response = await fetch(`/api${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json();
  if (response.status === 401 && !retried) {
    // Protected action: ask once for the workspace access key, keep it for this tab only.
    const entered = window.prompt(`${data.error ?? 'Access key required.'} Enter the access key:`);
    if (entered?.trim()) {
      try {
        sessionStorage.setItem(KEY, entered.trim());
      } catch {}
      return api<T>(path, body, method, true);
    }
  }
  if (response.status === 401) {
    try {
      sessionStorage.removeItem(KEY);
    } catch {}
  }
  if (!response.ok) throw new Error(data.error ?? 'The request failed. Try again.');
  return data as T;
}
