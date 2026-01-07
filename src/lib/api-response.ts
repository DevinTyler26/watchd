import { NextResponse } from "next/server";
import { createRequestId } from "@/lib/request-id";

type JsonResponseOptions = {
  status?: number;
  requestId?: string;
  noStore?: boolean;
  headers?: HeadersInit;
};

export function jsonResponse<T>(
  data: T,
  { status = 200, requestId, noStore = false, headers }: JsonResponseOptions = {}
) {
  const id = requestId ?? createRequestId();
  const mergedHeaders: HeadersInit = {
    "X-Request-Id": id,
    ...(noStore ? { "Cache-Control": "no-store" } : {}),
    ...headers,
  };
  return NextResponse.json(data, { status, headers: mergedHeaders });
}
