# Stage 1: Build
FROM node:20-alpine as builder

WORKDIR /app

# Copy Client and Build
COPY client/package*.json ./client/
WORKDIR /app/client
RUN npm ci
COPY client/ ./
RUN npm run build

# Copy Server and Build
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci
COPY server/ ./
RUN npm run build

# Stage 2: Run
FROM node:20-alpine

# Install Puppeteer dependencies
# Installs latest Chromium (120+) package.
RUN apk add --no-cache \
      chromium \
      nss \
      freetype \
      harfbuzz \
      ca-certificates \
      ttf-freefont \
      nodejs \
      yarn

# Tell Puppeteer to skip installing Chrome. We'll be using the installed package.
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

WORKDIR /app

# Copy built artifacts from builder
COPY --from=builder /app/client/dist ./client/dist
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/server/package*.json ./server/

# Install ONLY production dependencies for server
WORKDIR /app/server
RUN npm ci --omit=dev

# Verify structure (Debug step, can be removed)
RUN ls -la /app/client/dist && ls -la /app/server/dist

# Expose Port
ENV PORT=3001
EXPOSE 3001

# Start
CMD ["node", "dist/index.js"]
