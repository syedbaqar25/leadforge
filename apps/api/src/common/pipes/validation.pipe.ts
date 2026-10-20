import {
  ValidationPipe as NestValidationPipe,
  BadRequestException,
  ValidationError,
} from '@nestjs/common';

/**
 * Strict Global Validation Pipe:
 * - whitelist: strips unknown fields
 * - forbidNonWhitelisted: rejects requests containing unknown fields
 * - transform: coerces query/param primitives to matching types
 * - formats field-level validation errors into clean, structured error responses
 */
export const createGlobalValidationPipe = () =>
  new NestValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: {
      enableImplicitConversion: true,
    },
    exceptionFactory: (validationErrors: ValidationError[] = []) => {
      const formattedErrors: Record<string, string[]> = {};

      const extractErrors = (errors: ValidationError[], parentProperty = '') => {
        for (const error of errors) {
          const propName = parentProperty ? `${parentProperty}.${error.property}` : error.property;

          if (error.constraints) {
            formattedErrors[propName] = Object.values(error.constraints);
          }

          if (error.children && error.children.length > 0) {
            extractErrors(error.children, propName);
          }
        }
      };

      extractErrors(validationErrors);

      return new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Invalid request payload or parameters',
        details: formattedErrors,
      });
    },
  });
