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

// Reads the NDJSON negotiation stream, reporting each decision as it arrives.
export async function streamNegotiation<TEvent, TDeal>(
  body: unknown,
  onEvent: (e: TEvent) => void,
): Promise<TDeal> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const key = storedKey();
  if (key) headers['x-access-key'] = key;
  const response = await fetch('/api/negotiate/stream', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!response.ok || !response.body) {
    if (response.status === 401) return api<TDeal>('/negotiate', body);
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error ?? 'The negotiation could not start.');
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    let newline: number;
    while ((newline = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (!line) continue;
      const message = JSON.parse(line);
      if (message.type === 'event') onEvent(message.event);
      if (message.type === 'deal') return message.deal as TDeal;
      if (message.type === 'error') throw new Error(message.error);
    }
    if (done) throw new Error('The negotiation stream ended early. Reload to see its state.');
  }
}
