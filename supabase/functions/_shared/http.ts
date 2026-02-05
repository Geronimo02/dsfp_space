import { corsHeaders } from "./cors.ts";

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export function jsonResponse(
  body: JsonValue | Record<string, JsonValue>,
  status = 200,
  extraHeaders: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
      ...extraHeaders,
    },
  });
}

export function errorResponse(message: string, status = 400, details?: JsonValue): Response {
  return jsonResponse({ error: message, details: details ?? null }, status);
}

export async function parseJson<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new Error("Invalid JSON body");
  }
}
