const DEFAULT_API_BASE_URL = "http://localhost:8090/api";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE_URL;

export const API_TIMEOUT_MS = 8000;

// Hosted Wallet Gateway URL for the CIP-0103 dApp SDK (RemoteAdapter). When set,
// a real Canton wallet appears in the connect picker alongside the embedded one.
// Unset (e.g. on the sandbox demo) -> only the embedded wallet is offered.
export const CANTON_GATEWAY_URL =
  process.env.NEXT_PUBLIC_CANTON_GATEWAY_URL ?? "";
