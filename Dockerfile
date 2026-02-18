FROM nginx:alpine

# Копируем только публичный фронтенд
COPY ./frontend/public/ /usr/share/nginx/html/

EXPOSE 80
