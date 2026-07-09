// Client-side log of the wallet's on-ledger transactions: every lender/borrower
// action records its committed update id (tx hash) here, and the navbar's tx
// button lists them for one-click copy. localStorage-backed so the history
// survives a refresh; browser-local by design (each wallet sees its own actions).
export type TxEntry = { label: string; txId: string; at: number };

const KEY = "nelva.txlog";
const MAX = 50;
const EVENT = "nelva-txlog";

export function loadTxLog(): TxEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(raw) ? (raw as TxEntry[]) : [];
  } catch {
    return [];
  }
}

export function recordTx(label: string, txId?: string): void {
  if (!txId || typeof window === "undefined") return;
  const list = [{ label, txId, at: Date.now() }, ...loadTxLog()].slice(0, MAX);
  window.localStorage.setItem(KEY, JSON.stringify(list));
  window.dispatchEvent(new Event(EVENT));
}

/** Subscribe to log changes (for useSyncExternalStore). Returns unsubscribe. */
export function subscribeTxLog(cb: () => void): () => void {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}
