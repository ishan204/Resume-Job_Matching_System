# Multi-stage production build for React / Vite client
FROM node:22-alpine AS builder

WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY shared/package.json shared/
COPY client/package.json client/

RUN pnpm install --frozen-lockfile

COPY shared/ shared/
COPY client/ client/

WORKDIR /app/client
RUN pnpm run build

# Production web server stage
FROM nginx:alpine AS runner

COPY --from=builder /app/client/dist /usr/share/nginx/html
COPY client/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
