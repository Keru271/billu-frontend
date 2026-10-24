// API Client for BillDesk Retail POS

export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ||
  'https://83cju1xtab.execute-api.ap-south-1.amazonaws.com'
).replace(/\/$/, '');

export function getApiUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${cleanPath}`;
}

export interface UserPermissions {
  discountLimit?: number; // max % discount, e.g. 10
  priceChange?: boolean;
  stockAdjust?: boolean;
  cancelBills?: boolean;
  reports?: boolean;
  export?: boolean;
  deleteProducts?: boolean;
  credit?: boolean;
  teamManage?: boolean;
  settingsManage?: boolean;
}

export interface TenantInfo {
  id: string;
  name: string;
  phone?: string | null;
  address?: string | null;
  upiId?: string | null;
  upiName?: string | null;
  gstin?: string | null;
  defaultTax?: number;
  defaultDiscount?: number;
  allowProductGstOverride?: boolean;
  allowProductDiscount?: boolean;
  priceIncludesTax?: boolean;
  invoicePrefix?: string;
  roundOff?: boolean;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: 'OWNER' | 'MEMBER';
  permissions?: UserPermissions | null;
  tenant: TenantInfo;
}

let cachedToken: string | null = null;

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  if (!cachedToken) {
    cachedToken = localStorage.getItem('billdesk_token');
  }
  return cachedToken;
}

export function setToken(token: string): void {
  cachedToken = token;
  if (typeof window !== 'undefined') {
    localStorage.setItem('billdesk_token', token);
  }
}

export function clearToken(): void {
  cachedToken = null;
  if (typeof window !== 'undefined') {
    localStorage.removeItem('billdesk_token');
    window.dispatchEvent(new CustomEvent('billdesk:auth-changed', { detail: { user: null } }));
  }
}

export async function login(
  email: string,
  password: string
): Promise<{ success: boolean; data?: { token: string; user: AuthUser }; error?: { message: string } }> {
  try {
    const res = await fetch(getApiUrl('/api/auth/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), password }),
    });

    const json = await res.json();
    if (res.ok && json.success && json.data?.token) {
      setToken(json.data.token);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('billdesk:auth-changed', { detail: { user: json.data.user } })
        );
      }
      return json;
    }

    return {
      success: false,
      error: { message: json.error?.message || 'Invalid email or password' },
    };
  } catch (err: any) {
    return {
      success: false,
      error: { message: err?.message || 'Login network error' },
    };
  }
}

export async function logout(): Promise<void> {
  clearToken();
}

export interface RegisterPayload {
  shopName: string;
  name: string;
  email: string;
  password: string;
  phone?: string;
}

export async function register(
  payload: RegisterPayload
): Promise<{ success: boolean; data?: { token: string; user: AuthUser }; error?: { message: string } }> {
  try {
    const res = await fetch(getApiUrl('/api/auth/register'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shopName: payload.shopName.trim(),
        name: payload.name.trim(),
        email: payload.email.trim(),
        password: payload.password,
        phone: payload.phone?.trim() || undefined,
      }),
    });

    const json = await res.json();
    if (res.ok && json.success && json.data?.token) {
      setToken(json.data.token);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('billdesk:auth-changed', { detail: { user: json.data.user } })
        );
      }
      return json;
    }

    return {
      success: false,
      error: { message: json.error?.message || 'Registration failed' },
    };
  } catch (err: any) {
    return {
      success: false,
      error: { message: err?.message || 'Registration network error' },
    };
  }
}

let activeMePromise: Promise<AuthUser | null> | null = null;

export async function fetchCurrentUser(): Promise<AuthUser | null> {
  const token = getToken();
  if (!token) return null;

  if (activeMePromise) {
    return activeMePromise;
  }

  activeMePromise = (async () => {
    try {
      const res = await fetch(getApiUrl('/api/auth/me'), {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.status === 401) {
        clearToken();
        return null;
      }

      const json = await res.json();
      if (json.success && json.data) {
        if (typeof window !== 'undefined') {
          localStorage.setItem('billdesk_user', JSON.stringify(json.data));
        }
        return json.data as AuthUser;
      }
      return null;
    } catch (err) {
      console.warn('Network offline or error fetching current user, reading from cache:', err);
      if (typeof window !== 'undefined') {
        const cached = localStorage.getItem('billdesk_user');
        if (cached) {
          try {
            return JSON.parse(cached) as AuthUser;
          } catch {
            // ignore
          }
        }
      }
      return null;
    } finally {
      activeMePromise = null;
    }
  })();

  return activeMePromise;
}

export async function ensureAuth(): Promise<string> {
  return getToken() || '';
}

const inFlightGetRequests = new Map<string, Promise<any>>();

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ success: boolean; data?: T; error?: { message: string }; fromCache?: boolean }> {
  const token = getToken();
  const isGet = !options.method || options.method.toUpperCase() === 'GET';

  // Invalidate in-flight / cached GET if a mutation occurs on this resource
  if (!isGet) {
    inFlightGetRequests.delete(endpoint);
  } else {
    // Deduplicate identical in-flight and rapid-fire (<200ms) GET requests
    const existing = inFlightGetRequests.get(endpoint);
    if (existing) {
      return existing;
    }
  }

  const run = async () => {
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
    };

    if (
      options.body &&
      !headers['Content-Type'] &&
      !(typeof FormData !== 'undefined' && options.body instanceof FormData)
    ) {
      headers['Content-Type'] = 'application/json';
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // If navigator is explicitly offline and it's a GET request, serve immediately from cache!
    if (typeof window !== 'undefined' && !navigator.onLine && isGet) {
      const cached = localStorage.getItem(`billo_cache_${endpoint}`);
      if (cached) {
        try {
          return { success: true, data: JSON.parse(cached), fromCache: true };
        } catch (e) {
          // ignore
        }
      }
    }

    try {
      const res = await fetch(getApiUrl(endpoint), {
        ...options,
        headers,
      });

      // Handle 401 Unauthorized (expired or invalid token)
      if (res.status === 401) {
        clearToken();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('billdesk:unauthorized'));
        }
        return {
          success: false,
          error: { message: 'Session expired. Please log in again.' },
        };
      }

      const json = await res.json();
      if (res.ok && json.success && json.data && isGet && typeof window !== 'undefined') {
        try {
          localStorage.setItem(`billo_cache_${endpoint}`, JSON.stringify(json.data));
        } catch {
          // quota limit
        }
      }
      return json;
    } catch (err: any) {
      // If GET request failed due to offline/network error, fallback to cache
      if (isGet && typeof window !== 'undefined') {
        const cached = localStorage.getItem(`billo_cache_${endpoint}`);
        if (cached) {
          try {
            return { success: true, data: JSON.parse(cached), fromCache: true };
          } catch {
            // ignore
          }
        }
      }

      return {
        success: false,
        error: { message: err?.message || 'Network request failed' },
      };
    } finally {
      if (isGet) {
        // Retain for 200ms to absorb simultaneous/microtask double triggers before clearing
        setTimeout(() => {
          inFlightGetRequests.delete(endpoint);
        }, 200);
      }
    }
  };

  const reqPromise = run();
  if (isGet) {
    inFlightGetRequests.set(endpoint, reqPromise);
  }

  return reqPromise;
}

export interface UploadResult {
  url: string;
  publicId: string;
  format?: string;
  width?: number;
  height?: number;
  bytes?: number;
}

export async function uploadImage(
  file: File | Blob | string,
  folder: 'products' | 'categories' | 'general' = 'products'
): Promise<{ success: boolean; data?: UploadResult; error?: { message: string } }> {
  if (typeof file === 'string') {
    return apiRequest<UploadResult>('/api/upload', {
      method: 'POST',
      body: JSON.stringify({ file, folder }),
    });
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('folder', folder);

  return apiRequest<UploadResult>('/api/upload', {
    method: 'POST',
    body: formData,
  });
}

export async function getUploadConfig(): Promise<{
  success: boolean;
  data?: { isConfigured: boolean; cloudName?: string };
}> {
  return apiRequest<{ isConfigured: boolean; cloudName?: string }>('/api/upload/config');
}

export async function deleteUploadedImage(publicId: string): Promise<{ success: boolean; error?: { message: string } }> {
  return apiRequest('/api/upload', {
    method: 'DELETE',
    body: JSON.stringify({ publicId }),
  });
}

