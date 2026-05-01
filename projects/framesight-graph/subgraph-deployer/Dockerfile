FROM node:18-alpine

WORKDIR /app

# Install graph-cli
RUN npm install -g @graphprotocol/graph-cli

# Copy deployment script
COPY deploy.sh /app/deploy.sh
RUN chmod +x /app/deploy.sh

ENTRYPOINT ["/app/deploy.sh"]
