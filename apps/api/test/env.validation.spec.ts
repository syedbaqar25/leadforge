import { envSchema } from '../src/config/env.validation';

describe('Environment Configuration Validation', () => {
  const baseValidEnv = {
    NODE_ENV: 'development',
    API_PORT: 4000,
    WEB_URL: 'http://localhost:3000',
    API_URL: 'http://localhost:4000',
    DATABASE_URL: 'postgresql://leadforge:fake_test_db_pass@localhost:5432/leadforge', // fake test db
    REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: 'super_secure_random_string_that_is_at_least_32_characters_long_123', // fake test key
  };

  it('passes validation when all required variables are properly provided', () => {
    const result = envSchema.safeParse(baseValidEnv);
    expect(result.success).toBe(true);
  });

  it('refuses to start when DATABASE_URL is missing', () => {
    const { DATABASE_URL, ...invalidEnv } = baseValidEnv;
    const result = envSchema.safeParse(invalidEnv);
    expect(result.success).toBe(false);
  });

  it('refuses to start when JWT_SECRET is shorter than 32 characters', () => {
    const invalidEnv = {
      ...baseValidEnv,
      JWT_SECRET: 'short_secret_123',
    };
    const result = envSchema.safeParse(invalidEnv);
    expect(result.success).toBe(false);
  });

  it('refuses to start when JWT_SECRET contains CHANGE_ME placeholder', () => {
    const invalidEnv = {
      ...baseValidEnv,
      JWT_SECRET: 'CHANGE_ME_super_long_secret_that_has_change_me_in_it_12345',
    };
    const result = envSchema.safeParse(invalidEnv);
    expect(result.success).toBe(false);
  });

  it('refuses invalid NODE_ENV values', () => {
    const invalidEnv = {
      ...baseValidEnv,
      NODE_ENV: 'staging_unknown',
    };
    const result = envSchema.safeParse(invalidEnv);
    expect(result.success).toBe(false);
  });
});
