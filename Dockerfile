# Stage 1: bgutil PO Token Provider 공식 docker hub 이미지에서 build 결과만 추출
FROM brainicism/bgutil-ytdlp-pot-provider:latest AS bgutil

# Stage 2: 메인 앱
FROM node:20-slim

# Install yt-dlp, ffmpeg, python3, deno, chromium (puppeteer 의존성)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip ffmpeg curl ca-certificates \
    build-essential python3-setuptools unzip \
    chromium fonts-noto-cjk \
  && curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
  && chmod a+rwx /usr/local/bin/yt-dlp \
  && curl -fsSL https://deno.land/install.sh | DENO_INSTALL=/usr/local sh \
  && pip3 install --break-system-packages bgutil-ytdlp-pot-provider \
  && apt-get purge -y --auto-remove build-essential unzip \
  && rm -rf /var/lib/apt/lists/*

# bgutil sidecar 결과물 복사 (공식 이미지에서 빌드 산출물만 가져옴)
# 공식 이미지의 작업 디렉토리는 /app
COPY --from=bgutil /app /opt/bgutil-server

WORKDIR /app

COPY package.json ./
COPY server/ ./server/

RUN npm install --omit=dev --ignore-scripts \
  && npm rebuild better-sqlite3 \
  && npm rebuild bcrypt

# 환경변수
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV POT_PROVIDER_PORT=4416
ENV POT_PROVIDER_URL=http://127.0.0.1:4416
ENV POT_PROVIDER_SERVER_PATH=/opt/bgutil-server/build/main.js

EXPOSE 8080
ENV NODE_ENV=production
ENV PORT=8080
ENV DATABASE_PATH=/data/promo_insight.db

CMD ["node", "server/index.cjs"]
