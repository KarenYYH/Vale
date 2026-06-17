# ── Stage 1: build ───────────────────────────────────────────────
FROM node:20-slim AS builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@9

# Copy manifests first for layer caching
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json   packages/shared/
COPY packages/core/package.json     packages/core/
COPY packages/mcp/package.json      packages/mcp/
COPY packages/auth/package.json     packages/auth/
COPY packages/agent/package.json    packages/agent/
COPY packages/server/package.json   packages/server/
COPY packages/web/package.json      packages/web/
COPY packages/cli/package.json      packages/cli/
COPY packages/skills/package.json   packages/skills/

# Copy tsconfig files
COPY tsconfig.base.json ./
COPY packages/shared/tsconfig.json  packages/shared/
COPY packages/core/tsconfig.json    packages/core/
COPY packages/mcp/tsconfig.json     packages/mcp/
COPY packages/auth/tsconfig.json    packages/auth/
COPY packages/agent/tsconfig.json   packages/agent/
COPY packages/server/tsconfig.json  packages/server/
COPY packages/web/tsconfig.json     packages/web/
COPY packages/cli/tsconfig.json     packages/cli/
COPY packages/skills/tsconfig.json  packages/skills/

# Install all deps
RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/ packages/

# Build in dependency order
RUN pnpm --filter @vale/shared build
RUN pnpm --filter @vale/core   build
RUN pnpm --filter @vale/mcp    build
RUN pnpm --filter @vale/auth   build
RUN pnpm --filter @vale/agent  build
RUN pnpm --filter @vale/server build
RUN pnpm --filter @vale/web    build
RUN pnpm --filter @vale/cli    build
RUN pnpm --filter @vale/skills build

# ── Stage 2: runtime ─────────────────────────────────────────────
FROM node:20-slim AS runtime

WORKDIR /app

RUN npm install -g pnpm@9

# Copy manifests + lockfile for production install
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json   packages/shared/
COPY packages/core/package.json     packages/core/
COPY packages/mcp/package.json      packages/mcp/
COPY packages/auth/package.json     packages/auth/
COPY packages/agent/package.json    packages/agent/
COPY packages/server/package.json   packages/server/
COPY packages/web/package.json      packages/web/
COPY packages/cli/package.json      packages/cli/
COPY packages/skills/package.json   packages/skills/

# Production deps only
RUN pnpm install --frozen-lockfile --prod

# Copy built artifacts from builder
COPY --from=builder /app/packages/shared/dist  packages/shared/dist
COPY --from=builder /app/packages/core/dist    packages/core/dist
COPY --from=builder /app/packages/mcp/dist     packages/mcp/dist
COPY --from=builder /app/packages/auth/dist    packages/auth/dist
COPY --from=builder /app/packages/agent/dist   packages/agent/dist
COPY --from=builder /app/packages/server/dist  packages/server/dist
COPY --from=builder /app/packages/web/dist     packages/web/dist
COPY --from=builder /app/packages/cli/dist     packages/cli/dist
COPY --from=builder /app/packages/skills/dist  packages/skills/dist

# Make CLI executable
RUN chmod +x packages/cli/dist/main.js && \
    ln -s /app/packages/cli/dist/main.js /usr/local/bin/vale

# Workspace data lives in a named volume
VOLUME ["/workspace"]

EXPOSE 4567 4568

ENV NODE_ENV=production \
    VALE_HOST=0.0.0.0 \
    VALE_PORT=4567

CMD ["vale", "web", \
     "--workspace", "/workspace", \
     "--port",      "4567",       \
     "--host",      "0.0.0.0"]
