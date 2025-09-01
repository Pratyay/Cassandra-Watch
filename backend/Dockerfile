FROM node:18-alpine

# Install necessary tools for nodetool operations
RUN apk add --no-cache python3 py3-pip openjdk11-jre bash curl

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY src/ ./src/

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S cassandra-ui -u 1001

# Change ownership of the app directory
RUN chown -R cassandra-ui:nodejs /app
USER cassandra-ui

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

# Start the application
CMD ["node", "src/index.js"]
