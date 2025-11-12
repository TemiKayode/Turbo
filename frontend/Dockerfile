# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
# Copy package.json first for better layer caching
COPY package.json ./
# Install dependencies (npm will work without lock files)
RUN npm i --no-audit --no-fund
COPY . .
RUN npm run build

# Runtime stage
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next /app/.next
COPY --from=builder /app/package.json /app/package.json
COPY --from=builder /app/node_modules /app/node_modules
EXPOSE 3000
CMD ["npm", "start"]


