import { z } from 'zod';
import { MIN_JWT_SECRET_LENGTH } from '@leadforge/shared';

/**
 * Typed environment variable schema.
 * The app refuses to start if any required variable is missing or weak.
 */
export const envSchema = z.object({
  // App
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(4000),
  WEB_URL: z.string().url().default('http://localhost:3000'),
  API_URL: z.string().url().default('http://localhost:4000'),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),

  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // Redis
  REDIS_URL: z.string().min(1, 'REDIS_URL is required').default('redis://localhost:6379'),

  // Auth
  JWT_SECRET: z
    .string()
    .min(MIN_JWT_SECRET_LENGTH, `JWT_SECRET must be at least ${MIN_JWT_SECRET_LENGTH} characters`)
    .refine(
      (val) =>
        !['CHANGE_ME', 'secret', 'jwt_secret', 'your-secret'].some((weak) => val.includes(weak)),
      'JWT_SECRET contains a default/example value — set a strong random secret',
    ),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),

  // OpenAI
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-4o'),
  OPENAI_EMBEDDING_MODEL: z.string().default('text-embedding-3-small'),

  // Gmail OAuth
  GMAIL_CLIENT_ID: z.string().optional(),
  GMAIL_CLIENT_SECRET: z.string().optional(),
  GMAIL_REDIRECT_URI: z.string().optional(),

  // WhatsApp (Feature Flagged)
  WHATSAPP_ENABLED: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
  WHATSAPP_VERIFY_TOKEN: z.string().optional(),
  WHATSAPP_APP_SECRET: z.string().optional(),
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),

  // n8n
  N8N_WEBHOOK_SECRET: z.string().optional(),
  N8N_API_URL: z.string().optional(),
  N8N_API_KEY: z.string().optional(),

  // Encryption
  ENCRYPTION_KEY: z.string().optional(),

  // File Storage
  STORAGE_TYPE: z.enum(['local', 's3']).default('local'),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().default('ap-south-1'),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),

  // Billing (Feature Flagged)
  BILLING_ENABLED: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),

  // Cloudflare Turnstile
  TURNSTILE_SECRET_KEY: z.string().optional(),

  // Email (Dev)
  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: z.coerce.number().int().default(1025),
  SMTP_FROM: z.string().email().default('noreply@example.com'),

  // Logging
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // Trust proxy (for rate limiting behind reverse proxy)
  TRUST_PROXY: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
});

export type EnvConfig = z.infer<typeof envSchema>;

let _validatedEnv: EnvConfig | null = null;

/**
 * Validate and cache environment variables.
 * Throws on invalid config — app will not start.
 */
export function validateEnv(): EnvConfig {
  if (_validatedEnv) return _validatedEnv;

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const formatted = result.error.format();
    const errors = Object.entries(formatted)
      .filter(([key]) => key !== '_errors')
      .map(([key, val]) => {
        const msgs = (val as { _errors?: string[] })?._errors?.join(', ') ?? 'invalid';
        return `  ${key}: ${msgs}`;
      })
      .join('\n');

    throw new Error(
      `\n❌ Environment validation failed:\n${errors}\n\nCheck your .env file against .env.example.\n`,
    );
  }

  // Production-specific checks
  if (result.data.NODE_ENV === 'production') {
    if (!result.data.ENCRYPTION_KEY) {
      throw new Error('ENCRYPTION_KEY is required in production');
    }
    if (result.data.DATABASE_URL.includes('localhost')) {
      throw new Error('DATABASE_URL should not point to localhost in production');
    }
  }

  _validatedEnv = result.data;
  return _validatedEnv;
}
