import { NextRequest, NextResponse } from 'next/server';

interface RateLimitStore {
  count: number;
  resetTime: number;
}

const store = new Map<string, RateLimitStore>();

/**
 * Simple in-memory rate limiter
 * In production, use Redis or similar
 */
export function rateLimit(options: {
  windowMs: number;
  maxRequests: number;
}) {
  return async (req: NextRequest): Promise<NextResponse | null> => {
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const key = `${ip}:${req.nextUrl.pathname}`;

    const now = Date.now();
    const record = store.get(key);

    if (!record || now > record.resetTime) {
      // Create new record
      store.set(key, {
        count: 1,
        resetTime: now + options.windowMs,
      });
      return null; // Allow request
    }

    if (record.count >= options.maxRequests) {
      // Rate limit exceeded
      return NextResponse.json(
        {
          success: false,
          error: 'Too many requests',
          message: 'Rate limit exceeded. Please try again later.',
        },
        { status: 429 }
      );
    }

    // Increment count
    record.count++;
    return null; // Allow request
  };
}

/**
 * Clean up expired entries periodically
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of store.entries()) {
    if (now > record.resetTime) {
      store.delete(key);
    }
  }
}, 60000); // Clean every minute
