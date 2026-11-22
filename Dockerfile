FROM node:24-bookworm-slim

RUN apt-get update && apt-get install -y openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@12.15.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json

RUN pnpm install --frozen-lockfile

COPY apps/api apps/api

# Prisma Client generation
RUN cd apps/api && DATABASE_URL="postgresql://build:build@localhost:5432/build" pnpm exec prisma generate --config prisma7.config.ts

# Compile TypeScript
RUN pnpm --filter api build

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["pnpm", "--filter", "api", "start"]