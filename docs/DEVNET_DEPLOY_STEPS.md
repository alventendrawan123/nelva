# Nelva → DevNet: cara yang TERBUKTI jalan (5N shared validator via Seaport)

**Status: SELESAI & terverifikasi live (2026-07-05).** SC Nelva jalan penuh di DevNet.
Full lifecycle **bid → match → accept → repay** sukses di ledger 5N — REPAID, tier Bronze→Silver.

**Ledger:** `https://ledger-api.validator.devnet.sandbox.fivenorth.io` (5N hosted shared validator, DevNet global synchronizer).
**Package id (vetted, live):** `198e9be837647ec88bec2e2b7d636977bb2ed1e4e0b7e51d481073d626e98585` (64 hex — WAJIB 64, bukan 65).

> **Kenapa cara lama (self-host validator + allowlist IP 2-7 hari) tidak dipakai:** panitia
> (Jatin, Canton Foundation) kasih **Seaport + 5N hosted validator** — self-service, tak perlu
> onboard node sendiri, tak perlu allowlist. Itu jalur yang benar & jauh lebih cepat.

---

## Alur singkat (yang benar-benar dilakukan)

```
1. Seaport (devnet.seaport.to) → login Loop wallet → Validator Settings
2. Upload DAR (be/nelva-sc-0.1.0.dar) → deploy → "success: true"
   → package id ke-vet otomatis di global synchronizer (muncul di /v2/packages)
3. Ambil M2M credential (client_credentials) dari 5N → simpan secret DI LUAR repo
4. Wire BE env → LEDGER_MODE=canton + JSON_LEDGER_API 5N + AUTH_* + NELVA_PARTY_PREFIX=nelva-
5. Jalankan BE → seed jalan → flow settle sendiri
```

---

## 1. Deploy DAR (Seaport)

- Buka **https://devnet.seaport.to**, login pakai **Loop wallet** (devnet.cantonloop.com).
- **Validator Settings → Upload DAR** → pilih `be/nelva-sc-0.1.0.dar` → deploy.
- Sukses = `{"success": true}`. Package id ke-vet di jaringan (butuh beberapa saat propagasi).

**Cek DAR ke-vet** (pakai M2M token, lihat §2):
```
GET https://ledger-api.validator.devnet.sandbox.fivenorth.io/v2/packages
# 198e9be837647ec88bec2e2b7d636977bb2ed1e4e0b7e51d481073d626e98585 harus ada di packageIds
```

> ⚠️ **Gotcha package id:** id Daml = **tepat 64 hex**. Draft awal sempat salah tulis 65 char
> (ada `8` dobel: `198e9be88…` ✗). Yang benar `198e9be83…` ✓. Verify dari DAR:
> `unzip -l nelva-sc-0.1.0.dar` → nama folder/main .dalf = package id asli.

## 2. M2M credential (OAuth2 client_credentials)

5N kasih client_credentials M2M (Authentik). **Simpan secret di luar repo — JANGAN commit.**

Token endpoint (WAJIB trailing slash):
```
POST https://auth.sandbox.fivenorth.io/application/o/token/
  grant_type=client_credentials
  client_id=validator-devnet-m2m
  client_secret=<secret-kamu>
  audience=validator-devnet-m2m
  scope=daml_ledger_api
```
Token JWT: `sub` = userId (mis. `6`) — dipakai jadi `userId` waktu submit command.

## 3. Model auth di shared validator (PENTING)

Ini yang bikin submit pertama 403 sampai di-handle:

- **Namespace di-share.** Semua party lahir di namespace participant `1220a14ca128…`.
  Party hint bare "Operator" bisa **tabrakan** dengan tim lain → pakai prefix `nelva-`.
- **Alokasi party ≠ hak actAs.** Setelah `POST /v2/parties`, user token BELUM punya
  `CanActAs` atas party itu → submit `actAs` → **403 PERMISSION_DENIED**. Harus grant:
  ```
  POST /v2/users/{sub}/rights
    { "userId":"{sub}", "rights":[{"kind":{"CanActAs":{"value":{"party":"<pid>"}}}}] }
  ```
  `CanActAs` sudah mencakup read. BE lakukan ini otomatis di `ensureParty` (env-gated).
- **userId waktu submit = `sub` token**, bukan nama app. BE ambil dari JWT otomatis.

Ketiga hal ini sudah di-handle di [be/src/ledger.canton.ts](../be/src/ledger.canton.ts)
(`hintOf` prefix, `grantActAs`, `ledgerUserId`). Aktif hanya kalau `AUTH_TOKEN_URL` diset.

## 4. Wire BE ke 5N

Env (lihat [be/.env.example](../be/.env.example) blok "5N DevNet"):
```
LEDGER_MODE=canton
JSON_LEDGER_API=https://ledger-api.validator.devnet.sandbox.fivenorth.io
NELVA_PACKAGE_ID=198e9be837647ec88bec2e2b7d636977bb2ed1e4e0b7e51d481073d626e98585
NELVA_PARTY_PREFIX=nelva-
AUTH_TOKEN_URL=https://auth.sandbox.fivenorth.io/application/o/token/
AUTH_CLIENT_ID=validator-devnet-m2m
AUTH_CLIENT_SECRET=<secret — dari file di luar repo>
AUTH_SCOPE=daml_ledger_api
AUTH_AUDIENCE=validator-devnet-m2m
```
Jalankan: `cd be && npm run start` (seed jalan otomatis, auto-matcher tiap 20s).

## 5. Verifikasi (yang sudah lulus)

```
GET  /api/config                      → packageId + parties nelva-Operator/Auditor/Custodian::…
GET  /api/status                      → openBids, proposals, activeLoans
GET  /api/proposals  (Bearer Borrower)→ proposal hasil match (ticks per-lender)
POST /api/proposals/{id}/accept       → Loan ACTIVE
POST /api/loans/{id}/repay            → REPAID, newTier Silver
```
Semua di atas sudah **200 OK di ledger 5N nyata** (2026-07-05).

---

## Catatan

- Secret M2M 5N disimpan di `C:\Users\ASUS\nelva-5n-devnet.env` (DI LUAR repo). Jangan commit.
- Kalau demo finale butuh IP stabil / always-on, host BE di cloud VM + isi env yang sama.
- Sandbox `dpm` lokal tetap jadi fallback (unset `AUTH_TOKEN_URL` + `NELVA_PARTY_PREFIX`).
