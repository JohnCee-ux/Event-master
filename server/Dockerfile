# syntax=docker/dockerfile:1

FROM node:22-alpine AS build
WORKDIR /app

COPY server/package.json server/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

COPY server/tsconfig.json ./
COPY server/src ./src
RUN npm run build && npm prune --omit=dev


FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY server/package.json ./

USER node
EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||5000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/server.js"]
