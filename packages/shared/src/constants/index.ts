export const APP_NAME = 'Leadforge';
export const APP_SLUG = 'leadforge';
export const DEFAULT_TIMEZONE = 'Asia/Kolkata';
export const DEFAULT_CURRENCY = 'INR';
export const DEFAULT_LOCALE = 'en-IN';
export const MAX_PAGE_SIZE = 100;
export const DEFAULT_PAGE_SIZE = 25;
export const JWT_ACCESS_EXPIRY_DEFAULT = '15m';
export const JWT_REFRESH_EXPIRY_DEFAULT = '7d';
export const MIN_PASSWORD_LENGTH = 10;
export const MAX_PASSWORD_LENGTH = 128;
export const MIN_JWT_SECRET_LENGTH = 32;
export const SCORE_BANDS = {
  HOT: { min: 75, max: 100, label: 'Hot' },
  WARM: { min: 40, max: 74, label: 'Warm' },
  COLD: { min: 0, max: 39, label: 'Cold' },
} as const;
export const RATE_LIMITS = {
  GLOBAL: { limit: 100, ttl: 60 },
  AUTH_LOGIN: { limit: 5, ttl: 900 },
  AUTH_LOGIN_IP: { limit: 20, ttl: 900 },
  AUTH_REGISTER: { limit: 3, ttl: 3600 },
  AUTH_REGISTER_DAILY: { limit: 10, ttl: 86400 },
  AUTH_FORGOT_PASSWORD: { limit: 3, ttl: 3600 },
  AUTH_REFRESH: { limit: 30, ttl: 3600 },
  API_AUTHENTICATED: { limit: 300, ttl: 60 },
  API_ORG: { limit: 3000, ttl: 60 },
  LEAD_FORM: { limit: 10, ttl: 60 },
  LEAD_FORM_DAILY: { limit: 1000, ttl: 86400 },
  LEAD_API_KEY: { limit: 600, ttl: 60 },
  CSV_IMPORT: { limit: 5, ttl: 3600 },
  EXPORT: { limit: 10, ttl: 3600 },
  AI_USER: { limit: 20, ttl: 60 },
  AI_ASSISTANT: { limit: 30, ttl: 3600 },
  EMAIL_SEND_USER: { limit: 100, ttl: 86400 },
  FILE_UPLOAD: { limit: 30, ttl: 3600 },
  WEBHOOK_INBOUND: { limit: 300, ttl: 60 },
  ADMIN_ACTIONS: { limit: 20, ttl: 3600 },
  SOCKET_EVENTS: { limit: 30, ttl: 10 },
  INVITATIONS: { limit: 20, ttl: 86400 },
} as const;
