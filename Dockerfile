FROM node:20-slim

# Install yt-dlp, ffmpeg, python3
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip ffmpeg curl ca-certificates \
    build-essential python3-setuptools \
  && curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
  && chmod a+rx /usr/local/bin/yt-dlp \
  && apt-get purge -y --auto-remove curl build-essential \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy only server-related files (no frontend)
COPY package.json ./
COPY server/ ./server/

# Install only production dependencies needed for the server
RUN npm install --omit=dev --ignore-scripts \
  && npm rebuild better-sqlite3

# Expose port
EXPOSE 8080

ENV NODE_ENV=production
ENV PORT=8080
ENV DATABASE_PATH=/data/promo_insight.db

CMD ["node", "server/index.cjs"]
