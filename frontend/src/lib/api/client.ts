import type { ZodType } from "zod";
import { API_BASE_URL, API_TIMEOUT_MS } from "@/config/env";

type CallOptions<T> = {
  method?: string;
  party?: string;
  body?: unknown;
  schema?: ZodType<T>;
};

export class ApiError extends Error {}

const STATUS_MESSAGES: Record<number, string> = {
  401: "Connect or pick a party first.",
  403: "This party is not allowed to access that data.",
  409: "The ledger state changed, please try again.",
  502: "The ledger is temporarily unavailable.",
};

export async function call<T>(
  path: string,
  options: CallOptions<T> = {},
): Promise<T> {
  const { method, party, body, schema } = options;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: method ?? (body ? "POST" : "GET"),
      headers: {
        "Content-Type": "application/json",
        ...(party ? { Authorization: `Bearer ${party}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      const serverError =
        typeof payload === "object" && payload && "error" in payload
          ? String((payload as { error: unknown }).error)
          : undefined;
      const message =
        serverError ??
        STATUS_MESSAGES[response.status] ??
        `Request failed (${response.status})`;
      throw new ApiError(message);
    }

    if (!schema) {
      return payload as T;
    }

    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      throw new ApiError("Unexpected response from server.");
    }
    return parsed.data;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiError("The server took too long to respond.");
    }
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError("Could not reach the Nelva backend.");
  } finally {
    clearTimeout(timeout);
  }
}
