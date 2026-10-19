# Web image (Next.js standalone server). Build from the repository root:
#   docker build -f frontend/Dockerfile --build-arg API_URL=http://api:4100 --build-arg NEXT_PUBLIC_SITE_URL=https://example.com -t gyaan-vidhya-web .
# API_URL is baked into the /api rewrite at build time, so it must be the address the web container uses to reach the API.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY frontend/package.json frontend/
COPY backend/package.json backend/
RUN npm ci --workspace frontend --no-audit --no-fund
COPY frontend ./frontend
ARG API_URL=http://api:4100
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
ENV API_URL=$API_URL NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL NEXT_TELEMETRY_DISABLED=1
RUN npm run build --workspace frontend

FROM node:22-alpine
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000 NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
COPY --from=build --chown=node:node /app/frontend/.next/standalone ./
COPY --from=build --chown=node:node /app/frontend/.next/static ./frontend/.next/static
COPY --from=build --chown=node:node /app/frontend/public ./frontend/public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s CMD wget -qO- http://127.0.0.1:3000/robots.txt >/dev/null || exit 1
CMD ["node", "frontend/server.js"]
