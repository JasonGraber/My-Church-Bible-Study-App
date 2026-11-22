# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files. The recorder plugin is a local package that package.json points at.
COPY package*.json ./
COPY plugins ./plugins

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build arguments for environment variables (injected at build time)
ARG SUPABASE_URL
ARG SUPABASE_KEY
ARG COMMIT_SHA=dev

# Set environment variables for the build
ENV SUPABASE_URL=$SUPABASE_URL
ENV SUPABASE_KEY=$SUPABASE_KEY
ENV COMMIT_SHA=$COMMIT_SHA

# Build the application and verify output is correct
RUN npm run build && \
    echo "--- Build verification ---" && \
    ls -la dist/ && \
    ls -la dist/assets/ && \
    grep -q '/assets/index-' dist/index.html && \
    echo "Build verified: dist/index.html references bundled JS" || \
    (echo "ERROR: dist/index.html does not reference bundled JS" && cat dist/index.html && exit 1)

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy package files and install production dependencies only
COPY package*.json ./
COPY plugins ./plugins
RUN npm ci --omit=dev

# Copy built frontend assets from builder stage
COPY --from=builder /app/dist ./dist

# Copy Express server
COPY server.js ./

# The server needs these when it runs (set on the Cloud Run service, not baked into the image):
#   GEMINI_API_KEY, SUPABASE_URL, SUPABASE_KEY
ARG COMMIT_SHA=dev
ENV COMMIT_SHA=$COMMIT_SHA

# Expose port 8080 (Cloud Run default)
EXPOSE 8080

# Start the Express server
CMD ["node", "server.js"]
