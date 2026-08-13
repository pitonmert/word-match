FROM node:24-bookworm-slim AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . ./
RUN npm run build

FROM nginxinc/nginx-unprivileged:alpine AS runtime
USER root
RUN rm /docker-entrypoint.d/10-listen-on-ipv6-by-default.sh
COPY nginx-main.conf /etc/nginx/nginx.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

USER 101
EXPOSE 8080
