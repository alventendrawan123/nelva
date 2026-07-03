# Nelva → DevNet: step konkret (verified dari docs Splice + tes live)

**Status:** SC Nelva (DAR `198e9be8…`) sekarang di `dpm sandbox` (ephemeral, tak konek jaringan). Untuk ke **DevNet Global Synchronizer** butuh **validator node sendiri** yang di-onboard ke jaringan.

**Verdict jujur (terbukti 2x):** satu-satunya blocker = **egress-IP allowlist**. Docs Splice bilang harfiah: *"Provide your sponsoring SV with the egress IP… Wait for super validators to adopt the new IP allowlist. This usually takes between 2-7 days."* Dan tes live kita: GSF DevNet SV balikin **403 di AWS load balancer** untuk IP kita → belum allowlisted. Tak ada bypass; ELB-nya keras.

**Yang BUKAN masalah:** hardware (validator butuh ~6GB app + 1GB DB; laptop 16GB cukup — WSL tinggal dinaikin ke 12GB), tooling (Docker+Compose+jq+curl ada), onboarding secret (self-service, 1 jam). **Tak ada hosted/shared validator publik** — harus jalanin node sendiri.

**Egress IP kita:** `180.242.97.244` (verify ulang tepat sebelum deploy — kalau NAT/IP berubah, allowlist tak cocok).

---

## Ringkas alur

```
[GATE] sponsor SV allowlist IP kita (2-7 hari)  ← blocker, aksi organizer/SV
   │
   ▼
self-gen secret (1 jam) → ./start.sh validator → upload DAR → alokasi party → BE point ke validator
   (semua ini <15 menit sekali IP kebuka)
```

---

## FASE A — Bisa dikerjakan SEKARANG (tanpa allowlist)

Ini prep; tak menyentuh DevNet, jadi tak kena 403.

**A1. Verify egress IP** (harus `180.242.97.244`):
```bash
curl -sSL http://checkip.amazonaws.com
```

**A2. Naikin RAM WSL** (validator tak muat di cap default 7.5GB). ⚠️ `wsl --shutdown` akan **matikan sandbox + BE yang lagi jalan** — lakukan saat tak demo:
```bash
printf '[wsl2]\nmemory=12GB\n' > /mnt/c/Users/ASUS/.wslconfig
wsl --shutdown        # lalu start ulang Docker Desktop
```

**A3. Cek tooling** (butuh Docker Compose ≥ 2.26.0):
```bash
docker compose version && curl --version | head -1 && jq --version
```

**A4. Download + extract bundle validator Splice v0.6.11** (jangan `./start.sh` dulu):
```bash
curl -fSL -o 0.6.11_splice-node.tar.gz \
  https://github.com/digital-asset/decentralized-canton-sync/releases/download/v0.6.11/0.6.11_splice-node.tar.gz
tar xzvf 0.6.11_splice-node.tar.gz
cd splice-node/docker-compose/validator
export IMAGE_TAG=0.6.11
```

**A5. Fix code-gap BE** (nginx validator route by `Host: json-ledger-api.localhost`): `be/src/ledger.canton.ts` `fetch()` (post/get) belum kirim header `Host`. Tambah header itu kalau BE nembak validator docker (atau jalanin BE di dalam network compose). Aku bisa patch ini kapan pun.

---

## FASE B — GATE (aksi organizer / SV operator) — BLOCKER

**B1. Cari sponsoring SV + minta allowlist.** Ini gerbang yang bikin 2-7 hari.
- **Tanya panitia hackathon dulu** (tercepat): *"Tolong add egress IP `180.242.97.244` ke DevNet validator allowlist, sponsored by <SV>. Atau ada shared validator/endpoint DevNet buat peserta?"*
- Kalau tak ada: kontak GSF/SV via `sync.global` + Slack `#gsf-global-synchronizer-appdev`.
- **UNKNOWN:** docs tak sebut SV sponsor DevNet mana yang nerima app-dev + channel kontaknya. **Ini yang kamu harus resolve.**

**B2. SV adopsi IP + propagate ke semua SV** — 2-7 hari. **Tak ada yang bisa jalan sampai ini kelar.**

---

## FASE C — Setelah IP allowlisted (~15 menit, aku bisa scriptkan)

**C0. Ambil MIGRATION_ID + SPONSOR_SV_URL asli** (live):
- MIGRATION_ID: dari https://sync.global/sv-network/ (nilai frozen).
- SPONSOR_SV_URL: bentuk `https://sv.sv-1.<cluster>.global.canton.network.sync.global` (pakai `sv.`, cluster `dev`, **BUKAN** `scan.`). Konfirmasi host GSF DevNet persis ke sponsor.

**C1. Cek IP sudah lolos** (tak 403 lagi):
```bash
curl -sS https://scan.sv-1.<dev-cluster>.global.canton.network.sync.global/api/scan/v0/dso  # dari IP 180.242.97.244
```

**C2. Self-gen onboarding secret** (valid 1 JAM — bikin persis sebelum start):
```bash
curl -X POST "$SPONSOR_SV_URL/api/sv/v0/devnet/onboard/validator/prepare"
# inspect body -> ambil field secret-nya (schema respons belum terdokumentasi; lihat live)
```

**C3. Start validator** (auth on). `party_hint` **PERMANEN**, format `<org>-<function>-<enum>`:
```bash
export IMAGE_TAG=0.6.11
./start.sh -s "$SPONSOR_SV_URL" -o "$ONBOARDING_SECRET" -p "nelva-validator-1" -m "$MIGRATION_ID" -w -a
# restart nanti: -o wajib tetap ada, pakai -o ""
```
Port (semua `.localhost:80`): Wallet UI `wallet.localhost` · CNS UI `ans.localhost` · **JSON Ledger API `json-ledger-api.localhost`** · gRPC `grpc-ledger-api.localhost`.

**C4. Upload DAR Nelva** (octet-stream, bukan JSON/multipart; sukses = body `{}`):
```bash
curl -X POST http://json-ledger-api.localhost/v2/packages \
  -H "Host: json-ledger-api.localhost" \
  -H "Content-Type: application/octet-stream" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  --data-binary @d:/nelva/be/nelva-sc-0.1.0.dar
# ADMIN_TOKEN dari Keycloak/OIDC validator (client_credentials); realm/audience baca dari config validator
```

**C5. Alokasi party** (verify path via `GET /v2/openapi.json` dulu — docs beda `/v2/parties` vs `/v2/parties/allocate`):
```bash
curl -X POST http://json-ledger-api.localhost/v2/parties \
  -H "Host: json-ledger-api.localhost" -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" -d '{"partyIdHint":"nelva-operator"}'
# ulangi: Operator, Auditor, Custodian, Oracle, LenderA/B, Borrower
# party id balik = <hint>::<fingerprint> — catat buat konfigurasi BE
```

**C6. Point BE ke validator** (BE **sudah support** OAuth — tinggal env):
```bash
JSON_LEDGER_API=http://json-ledger-api.localhost
NELVA_PACKAGE_ID=198e9be8837647ec88bec2e2b7d636977bb2ed1e4e0b7e51d481073d626e98585
AUTH_TOKEN_URL=<keycloak-token-endpoint>
AUTH_CLIENT_ID=<...>  AUTH_CLIENT_SECRET=<...>  AUTH_SCOPE=<...>  AUTH_AUDIENCE=<...>
# + pastikan fetch() kirim Host: json-ledger-api.localhost (fix A5)
```

---

## UNKNOWN yang harus dikonfirmasi live (jangan hardcode)
- Host GSF DevNet SPONSOR_SV_URL persis (docs cuma kasih placeholder `unknown_cluster`).
- Nilai MIGRATION_ID (baca live sync.global/sv-network).
- Field JSON buat ekstrak secret dari respons `/prepare`.
- `aud`/`scope` yang JSON Ledger API validator harapkan (baca Keycloak config validator).
- Path alokasi party (`/v2/parties` vs `/v2/parties/allocate`) — cek openapi.json validator.
- SV sponsor DevNet mana + channel kontaknya (resolve via organizer).

---

## Rekomendasi

1. **Hari ini**: tanya panitia — shared validator? atau minta allowlist IP `180.242.97.244`. Ini yang mulai jam 2-7 hari; makin cepat makin baik (finale ~13 Juli).
2. **Host finale**: pakai **cloud VM** (IP stabil, always-on), jangan laptop rumah (IP bisa ganti → allowlist tak cocok; uptime rapuh buat demo dinilai). VM IP di-allowlist sekali.
3. **Kalau DevNet tak kelar tepat waktu**: demo tetap kuat di sandbox — nilai jual (sealed-bid privacy + auditor GREEN/RED) tak butuh shared network. DevNet = bonus "real network", bukan syarat.

Sumber: [Validator Onboarding](https://docs.dev.sync.global/validator_operator/validator_onboarding.html) · [Docker Compose Validator](https://docs.dev.sync.global/validator_operator/validator_compose.html) · [Hardware Req](https://docs.dev.sync.global/validator_operator/validator_hardware_requirements.html) · tes live 403 (awselb) 2026-07-04.
