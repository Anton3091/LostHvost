FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN npm install --no-audit --no-fund
COPY . .
ARG VITE_YANDEX_SMARTCAPTCHA_SITE_KEY
ENV VITE_YANDEX_SMARTCAPTCHA_SITE_KEY=$VITE_YANDEX_SMARTCAPTCHA_SITE_KEY
RUN npm run build

FROM node:22-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json ./
COPY --from=build /app/node_modules ./node_modules
RUN npm prune --omit=dev --ignore-scripts --no-audit --no-fund
COPY --from=build /app/dist ./dist
RUN mkdir -p /app/data && chown -R node:node /app
USER node
EXPOSE 3000
CMD ["node", "dist/server.cjs"]
