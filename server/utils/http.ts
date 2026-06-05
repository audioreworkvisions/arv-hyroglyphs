import type { Request } from 'express';

export const asNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const toErrorMessage = (error: unknown, fallback = 'An error occurred'): string => {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error.trim().length > 0) return error;
  return fallback;
};

export const buildPublicUrl = (req: Request, pathname: string, port: number): string => {
  const forwardedProtoHeader = req.headers['x-forwarded-proto'];
  const protocol = Array.isArray(forwardedProtoHeader)
    ? forwardedProtoHeader[0]
    : typeof forwardedProtoHeader === 'string'
      ? forwardedProtoHeader.split(',')[0]
      : req.protocol;
  const host = req.get('host') || `localhost:${port}`;
  return `${protocol}://${host}${pathname}`;
};