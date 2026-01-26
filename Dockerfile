# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build arguments for environment variables (injected at build time)
ARG GEMINI_API_KEY
ARG SUPABASE_URL
ARG SUPABASE_KEY
ARG COMMIT_SHA=dev

# Set environment variables for the build
ENV GEMINI_API_KEY=$GEMINI_API_KEY
ENV SUPABASE_URL=$SUPABASE_URL
ENV SUPABASE_KEY=$SUPABASE_KEY
ENV COMMIT_SHA=$COMMIT_SHA

# Build the application
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy nginx config template (uses envsubst for runtime variable injection)
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy startup script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Expose port 8080 (Cloud Run default)
EXPOSE 8080

# Use custom entrypoint to inject env vars into nginx config
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
