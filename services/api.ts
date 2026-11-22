import { supabase } from './supabaseClient';
import { API_BASE } from './platform';

/** Calls our server as the signed-in user. Throws an Error with a message fit to show. */
export async function apiFetch<T>(path: string, options: { method?: string; body?: unknown; timeoutMs?: number } = {}): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Please sign in again.');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 60000);
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: options.method || (options.body ? 'POST' : 'GET'),
      headers: { Authorization: `Bearer ${token}`, ...(options.body ? { 'Content-Type': 'application/json' } : {}) },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
  } catch (e: any) {
    throw new Error(e?.name === 'AbortError'
      ? 'That took too long. Please try again.'
      : 'Could not reach the server. Check your connection and try again.');
  } finally {
    clearTimeout(timer);
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error || 'Something went wrong. Please try again.');
  return payload as T;
}
