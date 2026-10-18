FROM node:24-alpine AS base
RUN corepack enable && corepack prepare pnpm@12.9.1 --activate
WORKDIR /app

FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json .npmrc ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter @bayan/api...

FROM deps AS build
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @bayan/shared build \
 && pnpm --filter @bayan/api build

FROM build AS migrator
ENV NODE_ENV=production
WORKDIR /app/apps/api
CMD ["pnpm", "exec", "prisma", "migrate", "deploy"]

FROM node:24-alpine AS deploy
RUN corepack enable && corepack prepare pnpm@12.9.1 --activate
WORKDIR /app
COPY --from=build /app ./
RUN pnpm --filter @bayan/api deploy --prod /out

FROM node:24-alpine AS runner
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=deploy /out ./
EXPOSE 3000
CMD ["node", "dist/main.js"]
