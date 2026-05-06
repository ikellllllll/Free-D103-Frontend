# syntax=docker/dockerfile:1

# ──────────────────────────────────────────────────────────
# 1. deps: production dependencies install
# ──────────────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

# yarn v1 기반 프로젝트. package.json + yarn.lock 로 종속성 고정
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --network-timeout 600000

# ──────────────────────────────────────────────────────────
# 2. builder: Next.js standalone 빌드
# ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# deps 스테이지의 node_modules 재사용
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Next.js telemetry 비활성화 + standalone 빌드
ENV NEXT_TELEMETRY_DISABLED=1
RUN yarn build

# ──────────────────────────────────────────────────────────
# 3. runner: 런타임 이미지 (경량)
# ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# 비루트 유저 생성
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

# standalone 출력물 + public + static 복사
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

# Healthcheck: 메인 페이지 200 확인
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1:3000/ || exit 1

CMD ["node", "server.js"]
