import { NextResponse } from "next/server";

export type ApiErrorResponse = {
  error: {
    code: string;
    message: string;
  };
};

export type ApiSuccessResponse<T> = {
  data: T;
};

export type ApiPaginatedResponse<T> = {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
};

/**
 * Standard successful JSON response helper
 */
export function ok<T>(data: T, status = 200) {
  return NextResponse.json(
    { data },
    { status }
  );
}

/**
 * Standard paginated successful JSON response helper
 */
export function paginate<T>(data: T[], page: number, limit: number, total: number, status = 200) {
  return NextResponse.json(
    {
      data,
      pagination: {
        page,
        limit,
        total,
      },
    },
    { status }
  );
}

/**
 * Standard error response helper
 */
export function err(code: string, message: string, status = 400) {
  return NextResponse.json(
    {
      error: {
        code,
        message,
      },
    },
    { status }
  );
}
