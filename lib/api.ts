import { NextResponse } from 'next/server';
import { ApiResponse } from '@/types';

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json<ApiResponse<T>>({ success: true, data }, init);
}

export function created<T>(data: T, message?: string) {
  return NextResponse.json<ApiResponse<T>>(
    { success: true, data, message },
    { status: 201 }
  );
}

export function fail(status: number, error: string, message?: string) {
  return NextResponse.json<ApiResponse<never>>(
    { success: false, error, message },
    { status }
  );
}

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}
