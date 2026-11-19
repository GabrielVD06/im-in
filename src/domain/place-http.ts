const USER_AGENT = 'Salida/1.0 (Android; Pasto; contacto@salida.app)';

export async function fetchJson(url: string, signal?: AbortSignal, timeoutMs = 8000): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort);
  try {
    return await readJson(url, controller.signal);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}

async function readJson(url: string, signal: AbortSignal): Promise<unknown> {
  const headers = { Accept: 'application/json', 'Accept-Language': 'es' };
  let response: Response;
  try {
    response = await fetch(url, { signal, headers: { ...headers, 'User-Agent': USER_AGENT } });
  } catch (error) {
    if (signal.aborted) {
      throw error;
    }
    response = await fetch(url, { signal, headers });
  }
  if (!response.ok) {
    throw new Error('lookup');
  }
  return response.json() as Promise<unknown>;
}
