import { Platform } from 'react-native';

const CONFIGURED_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

// The Android emulator's "localhost" is its own virtual device, not the host
// machine — 10.0.2.2 is the emulator's alias for the host. Only swap when the
// configured URL is still pointing at localhost, so a real device/LAN URL set
// via EXPO_PUBLIC_API_BASE_URL is left untouched.
const API_BASE_URL =
  Platform.OS === 'android' ? CONFIGURED_BASE_URL.replace('localhost', '10.0.2.2') : CONFIGURED_BASE_URL;

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

interface ApiFetchOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  idToken?: string | null;
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.idToken) headers.Authorization = `Bearer ${options.idToken}`;

  const isFormData = options.body instanceof FormData;
  if (options.body !== undefined && !isFormData) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    headers,
    // FormData sets its own multipart boundary — must not be JSON-stringified.
    body: isFormData ? (options.body as FormData) : options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data.error ?? `Request failed (${res.status})`, res.status);
  }
  return data as T;
}
