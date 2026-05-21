FROM node:24-alpine

WORKDIR /app

ENV NODE_ENV=production \
    NPM_CONFIG_UPDATE_NOTIFIER=false

COPY config/docker/package.json config/docker/package-lock.json ./

RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund \
    && npm cache clean --force

COPY src/vps ./src/vps

USER node

CMD ["npm", "run", "vps:api"]
