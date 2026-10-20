/**
 * Named rate limit policies.
 * Each route can declare its named policy using @RateLimit('auth_login'), etc.
 */
export interface RateLimitPolicy {
  name: string;
  limit: number;
  ttlSeconds: number;
  description: string;
  failClosedOnRedisError: boolean;
}

export const RATE_LIMIT_POLICIES: Record<string, RateLimitPolicy> = {
  // Global baseline (all routes)
  global: {
    name: 'global',
    limit: 100,
    ttlSeconds: 60,
    description: '100 req/min per IP',
    failClosedOnRedisError: false,
  },
  // Authenticated user API
  authenticated_user: {
    name: 'authenticated_user',
    limit: 300,
    ttlSeconds: 60,
    description: '300 req/min per user',
    failClosedOnRedisError: false,
  },
  // Authenticated org-wide limit
  authenticated_org: {
    name: 'authenticated_org',
    limit: 3000,
    ttlSeconds: 60,
    description: '3,000 req/min per org',
    failClosedOnRedisError: false,
  },
  // Auth login - email key
  auth_login_email: {
    name: 'auth_login_email',
    limit: 5,
    ttlSeconds: 900, // 15 mins
    description: '5 attempts / 15 min per email',
    failClosedOnRedisError: true,
  },
  // Auth login - IP key
  auth_login_ip: {
    name: 'auth_login_ip',
    limit: 20,
    ttlSeconds: 900, // 15 mins
    description: '20 attempts / 15 min per IP',
    failClosedOnRedisError: true,
  },
  // Registration
  auth_register: {
    name: 'auth_register',
    limit: 3,
    ttlSeconds: 3600, // 1 hour
    description: '3 registrations / hour per IP',
    failClosedOnRedisError: true,
  },
  // Forgot password
  auth_forgot_password: {
    name: 'auth_forgot_password',
    limit: 3,
    ttlSeconds: 3600,
    description: '3 requests / hour per email & IP',
    failClosedOnRedisError: true,
  },
  // Refresh token rotation
  auth_refresh: {
    name: 'auth_refresh',
    limit: 30,
    ttlSeconds: 3600,
    description: '30 refresh calls / hour per session',
    failClosedOnRedisError: true,
  },
  // Public lead capture form submit
  public_form_submit: {
    name: 'public_form_submit',
    limit: 10,
    ttlSeconds: 60,
    description: '10 submissions / min per IP',
    failClosedOnRedisError: true,
  },
  // Ingestion via API Key
  api_key_ingest: {
    name: 'api_key_ingest',
    limit: 600,
    ttlSeconds: 60,
    description: '600 / min per API key (burst 50)',
    failClosedOnRedisError: true,
  },
  // Inbound webhooks (Gmail, WhatsApp, n8n, Stripe/Razorpay)
  inbound_webhook: {
    name: 'inbound_webhook',
    limit: 300,
    ttlSeconds: 60,
    description: '300 req/min per webhook source',
    failClosedOnRedisError: true,
  },
  // CSV import
  csv_import: {
    name: 'csv_import',
    limit: 5,
    ttlSeconds: 3600,
    description: '5 imports / hour per org',
    failClosedOnRedisError: false,
  },
  // Data export
  data_export: {
    name: 'data_export',
    limit: 10,
    ttlSeconds: 3600,
    description: '10 exports / hour per user',
    failClosedOnRedisError: false,
  },
  // Search & list
  search_list: {
    name: 'search_list',
    limit: 120,
    ttlSeconds: 60,
    description: '120 queries / min per user',
    failClosedOnRedisError: false,
  },
  // AI draft & analysis
  ai_generation: {
    name: 'ai_generation',
    limit: 20,
    ttlSeconds: 60,
    description: '20 requests / min per user',
    failClosedOnRedisError: true,
  },
  // AI assistant conversational turns
  ai_assistant: {
    name: 'ai_assistant',
    limit: 30,
    ttlSeconds: 3600,
    description: '30 messages / hour per user',
    failClosedOnRedisError: true,
  },
  // Document ingestion / embeddings
  document_upload: {
    name: 'document_upload',
    limit: 20,
    ttlSeconds: 3600,
    description: '20 documents / hour per org',
    failClosedOnRedisError: true,
  },
  // Outbound email send
  email_send: {
    name: 'email_send',
    limit: 100,
    ttlSeconds: 86400, // 24 hours
    description: '100 emails / day per user',
    failClosedOnRedisError: true,
  },
  // Admin sensitive operations (role changes, secrets, integrations)
  admin_action: {
    name: 'admin_action',
    limit: 20,
    ttlSeconds: 3600,
    description: '20 sensitive actions / hour per user',
    failClosedOnRedisError: true,
  },
};

export const DEFAULT_POLICY: RateLimitPolicy = {
  name: 'global',
  limit: 100,
  ttlSeconds: 60,
  description: '100 req/min per IP',
  failClosedOnRedisError: false,
};
