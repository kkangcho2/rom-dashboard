FROM node:20-slim

# Install yt-dlp, ffmpeg, python3, deno (JS runtime for yt-dlp), unzip
# curl은 런타임에서 yt-dlp 자동 업데이트를 위해 유지
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip ffmpeg curl ca-certificates \
    build-essential python3-setuptools unzip \
  && curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
  && chmod a+rwx /usr/local/bin/yt-dlp \
  && curl -fsSL https://deno.land/install.sh | DENO_INSTALL=/usr/local sh \
  && apt-get purge -y --auto-remove build-essential unzip \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy only server-related files (no frontend)
COPY package.json ./
COPY server/ ./server/

# Install only production dependencies needed for the server
RUN npm install --omit=dev --ignore-scripts \
  && npm rebuild better-sqlite3 \
  && npm rebuild bcrypt

# Expose port
EXPOSE 8080

ENV NODE_ENV=production
ENV PORT=8080
ENV DATABASE_PATH=/data/promo_insight.db

CMD ["node", "server/index.cjs"]
