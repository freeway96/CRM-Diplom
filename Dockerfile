FROM nginx:alpine

# Копируем только публичный фронтенд
COPY ./frontend/public/ /usr/share/nginx/html/
COPY ./frontend/nginx/default.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
