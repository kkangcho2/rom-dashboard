FROM node:20-slim

# Install yt-dlp, ffmpeg, python3, deno (JS runtime for yt-dlp), unzip
# curl은 런타임에서 yt-dlp 자동 업데이트를 위해 유지
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip ffmpeg curl ca-certificates \
    build-essential python3-setuptools unzip \
  && curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
  && chmod a+rwx /usr/local/bin/yt-dlp \
  && curl -fsSL https://deno.land/install.sh | DENO_INSTALL=/usr/local sh \
  && pip3 install --break-system-packages bgutil-ytdlp-pot-provider \
  && apt-get purge -y --auto-remove build-essential unzip \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy only server-related files (no frontend)
COPY package.json ./
COPY server/ ./server/

# Install only production dependencies needed for the server
# bgutil-pot-provider-server: Node sidecar for PO Token (포함 puppeteer)
RUN npm install --omit=dev --ignore-scripts \
  && npm install bgutil-pot-provider-server --omit=dev \
  && npm rebuild better-sqlite3 \
  && npm rebuild bcrypt

# Pre-download Chromium for puppeteer (bgutil sidecar 의존성)
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=false
RUN node -e "require('puppeteer').default ? require('puppeteer').default.executablePath() : require('puppeteer').executablePath()" 2>/dev/null || true

# Install Chromium dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium fonts-noto-cjk \
  && rm -rf /var/lib/apt/lists/*

# Use system chromium (puppeteer 환경변수)
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV POT_PROVIDER_PORT=4416
ENV POT_PROVIDER_URL=http://127.0.0.1:4416

# Expose port
EXPOSE 8080

ENV NODE_ENV=production
ENV PORT=8080
ENV DATABASE_PATH=/data/promo_insight.db

CMD ["node", "server/index.cjs"]
