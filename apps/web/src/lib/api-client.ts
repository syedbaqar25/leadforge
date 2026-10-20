const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiRequest<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  // If payload is FormData, let browser set Content-Type with boundary
  if (options.body instanceof FormData) {
    delete headers['Content-Type'];
  }

  // Inject token if stored in memory or storage
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('leadforge_token');
    if (token && !headers['Authorization']) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include', // Include HttpOnly cookies for CSRF and refresh tokens
  });

  if (!response.ok) {
    let errorData: any = {};
    try {
      errorData = await response.json();
    } catch {
      errorData = { message: response.statusText };
    }

    const errorObj = errorData.error || errorData;
    throw new ApiError(
      response.status,
      errorObj.code || 'HTTP_ERROR',
      errorObj.message || 'An unexpected error occurred',
      errorObj.details,
    );
  }

  // Handle empty responses
  if (response.status === 204) {
    return {} as T;
  }

  const json = await response.json();
  // Unwrap envelope if present
  return json.data !== undefined ? json.data : json;
}
