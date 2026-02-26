FROM node:18-alpine

WORKDIR /app

# Install dependencies first for cache layer
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Expose the API port
EXPOSE 5001

# Run the server
CMD ["npm", "start"]
