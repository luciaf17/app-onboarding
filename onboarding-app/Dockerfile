FROM node:18-alpine
WORKDIR /app
COPY package.json .
RUN npm install --production
COPY . .
RUN mkdir -p /data
ENV DATA_DIR=/data
ENV PORT=3000
EXPOSE 3000
CMD ["node", "server.js"]
