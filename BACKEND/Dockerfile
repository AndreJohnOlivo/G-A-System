FROM node:20-alpine

WORKDIR /app/BACKEND

COPY BACKEND/package*.json ./
RUN npm ci --omit=dev

COPY . /app

EXPOSE 3000

CMD ["npm", "start"]