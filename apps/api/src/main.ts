import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import { validateEnv } from './config/env.validation';
import { createGlobalValidationPipe } from './common/pipes/validation.pipe';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // 1. Validate environment configuration before booting
  const env = validateEnv();

  // 2. Create NestJS application
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
  });

  // 3. Graceful shutdown hooks
  app.enableShutdownHooks();

  // 4. Security Headers (Helmet)
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'blob:'],
          connectSrc: ["'self'"],
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );

  // 5. Cookie Parser for secure HttpOnly cookie auth
  app.use(cookieParser());

  // 6. Request payload size limits
  app.use(json({ limit: '2mb' }));
  app.use(urlencoded({ extended: true, limit: '2mb' }));

  // 7. Echo X-Request-Id in response headers
  app.use((req: any, res: any, next: () => void) => {
    const requestId = req.headers['x-request-id'];
    if (requestId) {
      res.setHeader('X-Request-Id', requestId);
    }
    next();
  });

  // 8. Strict CORS allowlist
  const allowedOrigins = env.CORS_ORIGINS.split(',').map((o) => o.trim());
  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin) || env.NODE_ENV === 'development') {
        return callback(null, true);
      }
      return callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'X-Request-Id',
      'Idempotency-Key',
      'CF-Connecting-IP',
    ],
  });

  // 9. API Versioning prefix /api/v1
  app.setGlobalPrefix('api/v1', {
    exclude: ['health/live', 'health/ready'],
  });

  // 10. Global Validation Pipe
  app.useGlobalPipes(createGlobalValidationPipe());

  // 11. OpenAPI / Swagger Documentation
  if (env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Leadforge API')
      .setDescription('AI Lead Intelligence & Sales Automation Platform REST API')
      .setVersion('1.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT access token',
        },
        'JWT-auth',
      )
      .addApiKey(
        {
          type: 'apiKey',
          name: 'X-API-Key',
          in: 'header',
          description: 'Organization public / webhook API key',
        },
        'APIKey-auth',
      )
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
      },
    });
    logger.log(`OpenAPI documentation initialized at /api/docs`);
  }

  // 12. Start Listening
  await app.listen(env.API_PORT, '0.0.0.0');
  logger.log(`🚀 Leadforge API is running on http://localhost:${env.API_PORT}`);
  logger.log(`🩺 Health check available at http://localhost:${env.API_PORT}/health/live`);
}

bootstrap().catch((err) => {
  console.error('Fatal error during application bootstrap:', err);
  process.exit(1);
});
