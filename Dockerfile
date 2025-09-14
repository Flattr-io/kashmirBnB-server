# Stage 1: Build the TypeScript code
FROM node:22 AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY tsconfig.json ./
COPY app.ts ./
COPY src ./src

RUN npm run build


# Stage 2: Run the compiled app
FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --only=production

COPY --from=builder /app/build ./build

EXPOSE 4500

CMD ["node", "build/app.js"]
