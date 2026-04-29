export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: PaginationMeta;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function successResponse<T>(
  data: T,
  meta?: PaginationMeta
): ApiSuccessResponse<T> {
  const response: ApiSuccessResponse<T> = { success: true, data };
  if (meta) response.meta = meta;
  return response;
}

export function errorResponse(
  code: string,
  message: string,
  details?: unknown
): ApiErrorResponse {
  return {
    success: false,
    error: { code, message, ...(details !== undefined && { details }) },
  };
}
