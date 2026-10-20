import { Module, Global } from '@nestjs/common';
import { ConfigModule as NestConfigModule, ConfigService } from '@nestjs/config';
import { validateEnv, type EnvConfig } from './env.validation';

/**
 * Loads and validates all environment variables at boot.
 * Registered globally — inject ConfigService anywhere.
 */
@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: () => validateEnv(),
    }),
  ],
  providers: [
    {
      provide: 'ENV_CONFIG',
      useFactory: (): EnvConfig => validateEnv(),
    },
  ],
  exports: [NestConfigModule, 'ENV_CONFIG'],
})
export class AppConfigModule {}

// Helper to get typed config
export function getTypedConfig(configService: ConfigService): EnvConfig {
  return validateEnv();
}
