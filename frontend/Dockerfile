# ── Stage 1: build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies before copying source so this layer is cached
# as long as package.json / package-lock.json don't change.
COPY package.json package-lock.json ./
RUN npm ci

# VITE_API_BASE_URL is baked into the JS bundle at compile time via
# import.meta.env.  Pass "" (empty string) so every api.ts call produces a
# relative URL (e.g. /auth/login) that nginx then proxies to the backend.
# Override with --build-arg VITE_API_BASE_URL=https://... for other targets.
ARG VITE_API_BASE_URL=""
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

COPY . .
RUN npm run build

# ── Stage 2: serve ────────────────────────────────────────────────────────────
FROM nginx:alpine

# Custom nginx config: reverse-proxy API routes to backend, SPA catch-all
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Compiled React app (includes ONNX/WASM assets from public/)
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
