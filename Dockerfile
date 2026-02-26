# Stage 1: Build the React Application
FROM node:18-alpine as builder

WORKDIR /app

# Install dependencies first for cache layer
COPY package*.json ./
RUN npm install

# Copy source code and build
COPY . .
RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:alpine

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose the frontend port
EXPOSE 80

# Run nginx in foreground
CMD ["nginx", "-g", "daemon off;"]
