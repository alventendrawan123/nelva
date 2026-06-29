# Nelva BE + Canton sandbox in ONE container (Railway: 1 service).
# The BE talks to the sandbox over localhost:7575 (same network namespace),
# so no JSON Ledger API needs to be exposed publicly — only the BE port.
FROM eclipse-temurin:21-jdk

# Node 20 + tools (coreutils gives `timeout`)
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl ca-certificates gnupg coreutils \
 && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
 && apt-get install -y --no-install-recommends nodejs \
 && apt-get clean && rm -rf /var/lib/apt/lists/*

# dpm toolchain — provides `dpm sandbox` (a real single-participant Canton ledger)
RUN curl -fsSL https://get.digitalasset.com/install/install.sh | sh
ENV PATH="/root/.dpm/bin:${PATH}"

WORKDIR /app

# BE deps (tsx runs TS directly — no compile step)
COPY package.json package-lock.json ./
RUN npm ci

# BE source + compiled DAR + entrypoint
COPY tsconfig.json ./
COPY src ./src
COPY nelva-sc-0.1.0.dar ./nelva-sc-0.1.0.dar
COPY entrypoint.sh ./entrypoint.sh
RUN sed -i 's/\r$//' entrypoint.sh && chmod +x entrypoint.sh

ENV LEDGER_MODE=canton \
    JSON_LEDGER_API=http://localhost:7575 \
    NELVA_PACKAGE_ID=2ca7c73857de562d7a62f1550384a577c24fa1c5db614c4fd4028c7ddb1847fe \
    PORT=8090

# Pre-warm Canton artifacts into the image (boot once until ready, then stop) so the
# runtime container starts fast with no first-run download.
RUN bash -c 'dpm sandbox --json-api-port 7575 --dar ./nelva-sc-0.1.0.dar >/tmp/warm.log 2>&1 & P=$!; \
    for i in $(seq 1 240); do curl -sf http://localhost:7575/livez >/dev/null 2>&1 && break; sleep 1; done; \
    kill $P 2>/dev/null || true; sleep 3; echo warmed'

EXPOSE 8090
CMD ["./entrypoint.sh"]
