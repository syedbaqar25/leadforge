import * as dns from 'dns/promises';
import { BadRequestException } from '@nestjs/common';

const PRIVATE_IP_PATTERNS = [
  /^127\./, // 127.0.0.0/8 (Loopback)
  /^10\./, // 10.0.0.0/8 (Private)
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // 172.16.0.0/12 (Private)
  /^192\.168\./, // 192.168.0.0/16 (Private)
  /^169\.254\./, // 169.254.0.0/16 (Link-local & AWS/GCP Metadata 169.254.169.254)
  /^0\./, // 0.0.0.0/8
  /^localhost$/i,
  /^::1$/,
  /^fc00:/i,
  /^fe80:/i,
];

/**
 * Validates external outbound URLs to prevent Server-Side Request Forgery (SSRF).
 * Rejects private IP ranges, loopback addresses, link-local metadata endpoints,
 * and enforces https (with dev environment exception for local mock webhooks).
 */
export async function validateSafeUrl(
  urlString: string,
  allowLocalInDev = false,
): Promise<{ url: URL; resolvedIp: string }> {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(urlString);
  } catch {
    throw new BadRequestException({
      code: 'INVALID_URL',
      message: 'Supplied webhook URL is not a valid well-formed URL.',
    });
  }

  const isDev = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';

  // 1. Enforce HTTPS in production
  if (!isDev && parsedUrl.protocol !== 'https:') {
    throw new BadRequestException({
      code: 'INSECURE_PROTOCOL',
      message: 'Outbound webhook URLs must use HTTPS.',
    });
  }

  // 2. Allow local loopback only if explicitly enabled in development
  if (
    isDev &&
    allowLocalInDev &&
    (parsedUrl.hostname === 'localhost' || parsedUrl.hostname === '127.0.0.1')
  ) {
    return { url: parsedUrl, resolvedIp: '127.0.0.1' };
  }

  // 3. Reject direct private IP hostnames
  for (const pattern of PRIVATE_IP_PATTERNS) {
    if (pattern.test(parsedUrl.hostname)) {
      throw new BadRequestException({
        code: 'FORBIDDEN_DESTINATION',
        message: 'Outbound webhook destination targets a forbidden private or metadata IP range.',
      });
    }
  }

  // 4. Resolve DNS to protect against DNS rebinding / private IP resolutions
  try {
    const lookup = await dns.lookup(parsedUrl.hostname);
    const resolvedIp = lookup.address;

    for (const pattern of PRIVATE_IP_PATTERNS) {
      if (pattern.test(resolvedIp)) {
        throw new BadRequestException({
          code: 'FORBIDDEN_RESOLVED_IP',
          message: `Hostname ${parsedUrl.hostname} resolved to a forbidden private IP (${resolvedIp}).`,
        });
      }
    }

    return { url: parsedUrl, resolvedIp };
  } catch (err: any) {
    if (err instanceof BadRequestException) throw err;
    throw new BadRequestException({
      code: 'DNS_RESOLUTION_FAILED',
      message: `Failed to resolve webhook domain: ${parsedUrl.hostname}`,
    });
  }
}
