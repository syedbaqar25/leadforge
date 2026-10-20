import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { tenantStorage } from '../tenant';

interface ErrorResponse {
  error: {
    code: string;
    message: string;
    requestId: string;
    details?: Record<string, unknown>;
  };
}

/**
 * Global exception filter that:
 * - Returns consistent error envelope { error: { code, message, requestId, details? } }
 * - Logs detailed errors server-side (without PII or secrets)
 * - Returns safe generic messages for 5xx errors
 * - Includes request ID for tracing
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const tenantCtx = tenantStorage.getStore();
    const requestId =
      tenantCtx?.requestId || (request.headers['x-request-id'] as string) || 'unknown';

    let status: number;
    let code: string;
    let message: string;
    let details: Record<string, unknown> | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        code = this.statusToCode(status);
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        const resp = exceptionResponse as Record<string, unknown>;
        code = (resp.code as string) || this.statusToCode(status);
        message = (resp.message as string) || exception.message;

        // Include validation details for 400s
        if (status === HttpStatus.BAD_REQUEST && resp.message && Array.isArray(resp.message)) {
          details = { validation: resp.message };
          message = 'Validation failed';
        }
      } else {
        code = this.statusToCode(status);
        message = exception.message;
      }
    } else if (exception instanceof Error) {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      code = 'INTERNAL_ERROR';
      // Never expose internal error details to clients
      message = 'An unexpected error occurred';

      // Log the full error server-side
      this.logger.error(
        {
          requestId,
          path: request.url,
          method: request.method,
          error: exception.message,
          stack: exception.stack,
          userId: tenantCtx?.userId || undefined,
          orgId: tenantCtx?.organizationId || undefined,
        },
        `Unhandled exception: ${exception.message}`,
      );
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      code = 'INTERNAL_ERROR';
      message = 'An unexpected error occurred';

      this.logger.error({ requestId, exception: String(exception) }, 'Unknown exception type');
    }

    // Log 4xx errors at warn level (except 404s which are normal)
    if (status >= 400 && status < 500 && status !== 404) {
      this.logger.warn(
        {
          requestId,
          path: request.url,
          method: request.method,
          status,
          code,
          userId: tenantCtx?.userId || undefined,
        },
        `Client error: ${code}`,
      );
    }

    const errorResponse: ErrorResponse = {
      error: {
        code,
        message,
        requestId,
        ...(details ? { details } : {}),
      },
    };

    response.status(status).json(errorResponse);
  }

  private statusToCode(status: number): string {
    const codeMap: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'UNPROCESSABLE_ENTITY',
      429: 'RATE_LIMITED',
      500: 'INTERNAL_ERROR',
      502: 'BAD_GATEWAY',
      503: 'SERVICE_UNAVAILABLE',
    };
    return codeMap[status] || 'ERROR';
  }
}
