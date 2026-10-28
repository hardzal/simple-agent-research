FROM docker.io/library/node:24.14.0-bookworm-slim AS build
WORKDIR /app
RUN npm install --global pnpm@11.22.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN pnpm run build && pnpm prune --prod

FROM docker.io/library/node:24.14.0-bookworm-slim AS runtime
ENV NODE_ENV=production REPORTS_DIR=/app/reports STUDIO_PORT=4021 STUDIO_HOST=0.0.0.0
WORKDIR /app
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json ./package.json
RUN mkdir /app/reports && chown node:node /app/reports
USER node
EXPOSE 4021
CMD ["node", "dist/studio.js"]
