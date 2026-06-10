# syntax=docker/dockerfile:1

# ---- Build the Angular bundle ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- Serve via nginx ----
FROM nginx:1.27-alpine AS runtime
# The application builder emits the browser bundle under dist/<project>/browser.
COPY --from=build /app/dist/support-platform-web/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
