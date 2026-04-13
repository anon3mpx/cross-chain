FROM node:24-alpine AS base

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY src ./src
COPY config ./config
COPY .env.example ./.env.example

ENV NODE_ENV=production

CMD ["npm", "run", "vps:api"]
