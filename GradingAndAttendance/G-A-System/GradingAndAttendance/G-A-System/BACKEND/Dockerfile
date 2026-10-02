FROM node:22-alpine

WORKDIR /app

COPY BACKEND/package*.json ./
RUN npm ci --omit=dev

COPY BACKEND/server.js ./server.js
COPY attendance.html grades.html index.html reports.html students.html style.css /app/site/

ENV NODE_ENV=production
ENV ROOT_DIR=/app/site

EXPOSE 3000

USER node

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 CMD node -e "require('http').get('http://127.0.0.1:3000/health', (response) => process.exit(response.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "server.js"]