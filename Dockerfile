# syntax=docker/dockerfile:1
FROM node:24.15.0-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM dependencies AS builder
ENV NEXT_TELEMETRY_DISABLED=1 DATA_BACKEND=postgres NEXT_PUBLIC_DATA_BACKEND=postgres
COPY . .
RUN npm run build
RUN mkdir -p public

FROM node:24.15.0-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 DATA_BACKEND=postgres NEXT_PUBLIC_DATA_BACKEND=postgres
ENV HOSTNAME=0.0.0.0 PORT=3000 LOCAL_STORAGE_PATH=/data/storage
RUN groupadd --system --gid 10001 camms && useradd --system --uid 10001 --gid camms camms \
    && mkdir -p /data/storage /app/.next/cache && chown -R camms:camms /data /app
COPY --from=builder --chown=camms:camms /app/.next/standalone ./
COPY --from=builder --chown=camms:camms /app/.next/static ./.next/static
COPY --from=builder --chown=camms:camms /app/public ./public
COPY --chown=camms:camms deploy/start.mjs deploy/runtime-config.mjs ./deploy/
USER camms
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=8s --start-period=45s --retries=3 CMD node -e "fetch('http://127.0.0.1:3000/api/health/readiness',{signal:AbortSignal.timeout(5000)}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "deploy/start.mjs"]
