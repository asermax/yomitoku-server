# Use Node.js LTS version
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy source code
COPY . .

# Install dependencies, build TypeScript, and remove devDependencies in a single layer
RUN npm ci && \
    npm run build && \
    npm prune --production

# Expose port (Railway will override with PORT env var)
EXPOSE 3000

# Start the server
CMD ["npm", "start"]
