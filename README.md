# 🏢 CRM-система

> Дипломный проект Лачугина Ивана Дмитриевича, группа ИС(б)-21

  [![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)](https://developer.mozilla.org/ru/docs/Web/HTML)
  [![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)](https://developer.mozilla.org/ru/docs/Web/CSS)
  [![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/ru/docs/Web/JavaScript)
  [![PHP](https://img.shields.io/badge/PHP-777BB4?style=for-the-badge&logo=php&logoColor=white)](https://www.php.net/)
  [![MariaDB](https://img.shields.io/badge/MariaDB-003545?style=for-the-badge&logo=mariadb&logoColor=white)](https://mariadb.org/)
  [![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
  [![Nginx](https://img.shields.io/badge/Nginx-009639?style=for-the-badge&logo=nginx&logoColor=white)](https://nginx.org/)
  
  [![Build Status](https://github.com/freeway96/CRM-Diplom/actions/workflows/docker-build.yml/badge.svg)](https://github.com/freeway96/CRM-Diplom/actions/workflows/docker-build.yml)
  [![Docker Pulls](https://img.shields.io/badge/docker%20pulls-1.2k-blue)](https://hub.docker.com/r/freeway96/crm-diplom)
---

## 📝 Описание проекта

**CRM-система** — это веб-приложение, разработанное в рамках дипломного проектирования. Система предназначена для автоматизации взаимодействия с клиентами, учёта заказов и ведения базы контрагентов. Проект реализован на чистом **HTML, CSS и JavaScript** (frontend) с контейнеризацией через **Docker** и веб-сервером **Nginx** для раздачи статических файлов.

Основная цель — создать удобный интерфейс для работы с клиентской базой и историей обращений, который может быть легко развёрнут в любой среде благодаря Docker.

---

## ✨ Основные возможности

- 📇 Управление карточками клиентов (добавление, редактирование, удаление)
- 📦 Учёт заказов и сделок
- 📊 Визуализация основных показателей (планируется)
- 🔐 Базовая аутентификация
- 📱 Адаптивный интерфейс для всех устройств

---

## 🛠 Технологии

| Технология | Назначение |
|------------|------------|
| HTML5      | Структура веб-страниц |
| CSS3       | Стилизация и адаптивность |
| JavaScript | Логика фронтенда, взаимодействие с пользователем |
| PHP        | Backend API для CRM |
| SQL (MariaDB/MySQL) | Хранение данных CRM и запросы к БД |
| Docker     | Контейнеризация приложения |
| Nginx      | Веб-сервер для раздачи статических файлов |

---


---

## 🚀 Запуск проекта

### Предварительные требования

- Установленный [Docker](https://www.docker.com/products/docker-desktop)
- Установленный [Git](https://git-scm.com/)

### Инструкция по запуску

1. Клонируйте репозиторий:
   ```bash
   git clone https://github.com/freeway96/CRM-Diplom
   cd CRM-Diplom

2. Запуск репозитория:
    ```bash
    docker compose up -d
    docker compose ps

Все три контейнера должны быть в статусе ``up``

3. Открой браузер и перейди по ссылке 

- Сайт: http://localhost:8080
- phpMyAdmin: http://localhost:8081
- API: http://localhost:8084/api/crm.php

4. Обновление файлов в Docker:
    ```bash 
        docker compose down
        git pull
        docker compose up -d
Все выполняется в папке проекта

5. Режим разработчика:
    ```bash
    docker compose -f docker-compose.dev.yml up -d
    docker compose -f docker-compose.dev.yml down
