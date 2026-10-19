# API image. Build from the repository root (npm workspaces share one lockfile):
#   docker build -f backend/Dockerfile -t gyaan-vidhya-api .
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci --workspace backend --omit=dev --no-audit --no-fund

FROM node:22-alpine
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4100
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY backend/package.json ./backend/
COPY backend/src ./backend/src
USER node
EXPOSE 4100
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD wget -qO- http://127.0.0.1:4100/api/health || exit 1
CMD ["node", "backend/src/server.js"]
