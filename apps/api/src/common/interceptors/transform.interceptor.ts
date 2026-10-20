import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { type ApiResponse } from '@leadforge/shared';

/**
 * Standardizes successful API responses into a uniform envelope:
 * {
 *   data: T,
 *   meta?: PaginationMeta
 * }
 */
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiResponse<T> | T> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T> | T> {
    const httpCtx = context.switchToHttp();
    const response = httpCtx.getResponse();

    // Pass through non-HTTP or streaming/file downloads if any
    if (!response || typeof response.status !== 'function') {
      return next.handle();
    }

    return next.handle().pipe(
      map((result: any) => {
        // If the handler already returned an object structured as { data, meta }
        if (
          result !== null &&
          typeof result === 'object' &&
          'data' in result &&
          ('meta' in result || Object.keys(result).length <= 2)
        ) {
          return result as ApiResponse<T>;
        }

        // Otherwise wrap raw data into standard envelope
        return {
          data: result,
        } as ApiResponse<T>;
      }),
    );
  }
}
