FROM node:24-alpine

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm install --legacy-peer-deps

COPY . .

RUN npm run build

CMD ["sh", "-c", "npx prisma db push && node dist/index.js"]
