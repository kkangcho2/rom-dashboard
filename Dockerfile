FROM node:20-slim

# Install yt-dlp, ffmpeg, python3, deno, chromium for puppeteer
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip ffmpeg curl ca-certificates git \
    build-essential python3-setuptools unzip \
    chromium fonts-noto-cjk \
  && curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
  && chmod a+rwx /usr/local/bin/yt-dlp \
  && curl -fsSL https://deno.land/install.sh | DENO_INSTALL=/usr/local sh \
  && pip3 install --break-system-packages bgutil-ytdlp-pot-provider \
  && rm -rf /var/lib/apt/lists/*

# bgutil PO Token Provider sidecar 빌드 (GitHub source)
RUN git clone --depth 1 https://github.com/Brainicism/bgutil-ytdlp-pot-provider.git /opt/bgutil \
  && cd /opt/bgutil/server \
  && PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true npm install \
  && npm run build \
  && rm -rf /opt/bgutil/.git /opt/bgutil/plugin

# Cleanup build deps after use
RUN apt-get purge -y --auto-remove build-essential unzip git \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy server files
COPY package.json ./
COPY server/ ./server/

RUN npm install --omit=dev --ignore-scripts \
  && npm rebuild better-sqlite3 \
  && npm rebuild bcrypt

# Use system chromium (puppeteer 환경변수)
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV POT_PROVIDER_PORT=4416
ENV POT_PROVIDER_URL=http://127.0.0.1:4416
ENV POT_PROVIDER_SERVER_PATH=/opt/bgutil/server/build/main.js

# Expose port
EXPOSE 8080

ENV NODE_ENV=production
ENV PORT=8080
ENV DATABASE_PATH=/data/promo_insight.db

CMD ["node", "server/index.cjs"]
