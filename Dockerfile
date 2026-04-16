FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run prisma:generate

RUN mkdir -p /app/data

EXPOSE 3000

CMD ["npm", "run", "docker:start"]
