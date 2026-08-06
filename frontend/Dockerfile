# ============================================================
# Frontend Dockerfile — Vite + React (Portfolio Manager)
# Place this file inside the /frontend folder
# ============================================================

# ---- Stage 1: Build ----
FROM node:20-alpine AS build
WORKDIR /app

# Copy package files first, install, THEN copy source — same caching trick
# as the backend: dependency install layer only re-runs when package.json
# actually changes, not on every source edit.
COPY package*.json ./
RUN npm ci

COPY . .

# Vite reads VITE_-prefixed env vars at BUILD time and bakes them into the
# static bundle — this is why it's declared as an ARG here rather than only
# a runtime env var (unlike the backend, which reads config at startup).
ARG VITE_API_BASE_URL=http://localhost:8080
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN npm run build

# ---- Stage 2: Serve ----
# The built output is just static HTML/JS/CSS — nginx is a lightweight,
# standard way to serve that, no Node needed in the final image at all.
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]