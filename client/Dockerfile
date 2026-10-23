# syntax=docker/dockerfile:1

FROM node:22-alpine AS build
WORKDIR /app/client

COPY client/package.json client/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

COPY shared /app/shared
COPY client/ ./
RUN npm run build


FROM nginx:stable-alpine AS runtime

COPY client/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/client/dist /usr/share/nginx/html

ENV API_UPSTREAM=http://api:5000
EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -q --spider http://127.0.0.1/ || exit 1
