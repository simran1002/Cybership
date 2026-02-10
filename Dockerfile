FROM node:18-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json jest.config.js .eslintrc.json ./
COPY src ./src

RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist

ENV NODE_ENV=production
CMD ["node", "dist/cli/rates-cli.js", "--help"]

