// Embedded Canton wallet: an Ed25519 key generated and held in the browser
// (localStorage). The private key NEVER leaves the device — it signs the
// onboarding multiHash and each prepared-transaction hash locally; the backend
// only relays. This is the same external-party signing a Reference Wallet does;
// for production, swap this keyholder for a CIP-0103 wallet (key custody upgrade).
import * as ed from "@noble/ed25519";

const PRIV_KEY = "nelva.wallet.priv"; // hex of the 32-byte Ed25519 secret
const PARTY_KEY = "nelva.wallet.party";
const FP_KEY = "nelva.wallet.fp";
const SESSION_KEY = "nelva.wallet.session"; // "1" while connected (separate from the wallet itself)

// DER X.509 SubjectPublicKeyInfo prefix for an Ed25519 public key.
const ED25519_SPKI = new Uint8Array([
  0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x03, 0x21, 0x00,
]);

const toHex = (b: Uint8Array) =>
  Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
const fromHex = (h: string) => {
  const a = new Uint8Array(h.length / 2);
  for (let i = 0; i < a.length; i++)
    a[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return a;
};
const toB64 = (b: Uint8Array) => {
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s);
};
const fromB64 = (s: string) => {
  const bin = atob(s);
  const a = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
  return a;
};

function secret(): Uint8Array {
  let h = localStorage.getItem(PRIV_KEY);
  if (!h) {
    h = toHex(ed.utils.randomSecretKey());
    localStorage.setItem(PRIV_KEY, h);
  }
  return fromHex(h);
}

/** Public key as DER X.509 SubjectPublicKeyInfo, base64 — the format generate-topology expects. */
export async function publicKeyDerB64(): Promise<string> {
  const pub = await ed.getPublicKeyAsync(secret());
  const der = new Uint8Array(ED25519_SPKI.length + pub.length);
  der.set(ED25519_SPKI);
  der.set(pub, ED25519_SPKI.length);
  return toB64(der);
}

/** Sign a base64 hash (decode → raw Ed25519 sign → base64). Used for multiHash + prepared-tx hash. */
export async function signHashB64(hashB64: string): Promise<string> {
  const sig = await ed.signAsync(fromB64(hashB64), secret());
  return toB64(sig);
}

export const wallet = {
  // the wallet exists once onboarded (key + party persist across disconnect)
  hasWallet: () => Boolean(localStorage.getItem(PARTY_KEY)),
  party: () => localStorage.getItem(PARTY_KEY),
  fingerprint: () => localStorage.getItem(FP_KEY),
  isSessionActive: () => localStorage.getItem(SESSION_KEY) === "1",
  // onboarded (or re-attached): record the party + open a session
  setSession: (party: string, fp: string) => {
    localStorage.setItem(PARTY_KEY, party);
    localStorage.setItem(FP_KEY, fp);
    localStorage.setItem(SESSION_KEY, "1");
  },
  // disconnect = end the session but KEEP the wallet, so reconnecting re-attaches
  // to the SAME party (re-onboarding the same key would fail: party already exists)
  endSession: () => {
    localStorage.removeItem(SESSION_KEY);
  },
  // wipe the key too (full reset / "create a new wallet")
  reset: () => {
    localStorage.removeItem(PRIV_KEY);
    localStorage.removeItem(PARTY_KEY);
    localStorage.removeItem(FP_KEY);
    localStorage.removeItem(SESSION_KEY);
  },
};
