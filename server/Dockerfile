# Multi-stage production build for Node.js / Express backend
FROM node:22-alpine AS builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy workspace package manifests
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY shared/package.json shared/
COPY server/package.json server/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source files
COPY shared/ shared/
COPY server/ server/

# Generate Prisma Client & Build Server
WORKDIR /app/server
RUN pnpm exec prisma generate
RUN pnpm run build

# Production runtime stage
FROM node:22-alpine AS runner

WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-workspace.yaml ./
COPY shared/package.json shared/
COPY server/package.json server/

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/server/prisma ./server/prisma
COPY --from=builder /app/server/node_modules ./server/node_modules

WORKDIR /app/server

ENV NODE_ENV=production
ENV PORT=5000

EXPOSE 5000

CMD ["sh", "-c", "npx prisma db push && node dist/server/src/index.js"]
