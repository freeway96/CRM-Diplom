# CRM-система предприятия

Дипломный проект Лачугина Ивана Дмитриевича, группа ИС(б)-21.

## Описание

CRM-система предприятия - веб-приложение для учета клиентов, сделок, договоров, сроков, сотрудников, табеля, выполненных работ и файлов компании. Интерфейс сделан как единый рабочий кабинет: обзор, CRM-воронка, календарь памяток, файлы, клиенты, сотрудники, учет и табель связаны между собой через общую базу данных.

Проект работает локально без внешних CDN: шрифты, иконки, изображения и favicon находятся в папке `frontend/public/assets`.

## Основные возможности

- Обзор предприятия с ключевыми показателями, ближайшими сроками и статусами сделок.
- CRM-воронка по этапам договора: поступление заказа, формировка договора, получение предоплаты, создание товара, готовность транспортировки, завершение договора.
- Карточки сделок с клиентом, ответственным, суммой, приоритетом, сроком и переходом по этапам.
- Календарь памяток с отметками выполнения и сроками договоров из воронки.
- Раздел файлов компании с загрузкой, поиском, скачиванием и удалением документов.
- Раздел клиентов с открытием истории работ по компании: активные и завершенные сделки.
- Управление сотрудниками, табелем и учетом выполненного.
- Авторизация через backend API и хранение данных в MariaDB.
- Серверная фильтрация по клиентам, сделкам и файлам.
- Минифицированные CSS/JS-файлы для снижения нагрузки на страницу.
- Production-конфигурация Docker без публичного доступа к backend, базе данных и phpMyAdmin.

## Технологии

| Компонент | Технологии |
| --- | --- |
| Frontend | HTML, CSS, JavaScript ES Modules |
| Backend | PHP API |
| База данных | MariaDB |
| Веб-сервер | Nginx |
| Контейнеризация | Docker, Docker Compose |
| Сборка ассетов | terser, clean-css-cli |

## Структура проекта

```text
backend/api/                  Backend API CRM
frontend/public/              Публичные файлы сайта
frontend/public/CRM/          Интерфейс CRM
frontend/public/CRM/js/       Модули dashboard
frontend/public/assets/       Локальные шрифты, изображения и иконки
frontend/nginx/default.conf   Nginx-конфигурация frontend и proxy /api
database/sql/                 SQL-скрипты базы
scripts/build-assets.sh       Сборка минифицированных CSS/JS
docker-compose.yml            Локальный запуск
docker-compose.dev.yml        Режим разработки
docker-compose.prod.yml       Более закрытая production-схема
```

## Запуск локально

```bash
docker compose up -d --build
```

После запуска:

- Сайт: `http://localhost:8080`
- CRM: `http://localhost:8080/CRM/dashboard.html`
- phpMyAdmin: `http://localhost:8081`
- Backend API внутри frontend: `http://localhost:8080/api/crm.php`
- Backend API напрямую в локальном режиме: `http://localhost:8084/api/crm.php`

Проверка контейнеров:

```bash
docker compose ps
```

## Сборка frontend-ассетов

После изменения `dashboard.js`, модулей в `frontend/public/CRM/js/` или `dashboard.css` нужно пересобрать минифицированные файлы:

```bash
./scripts/build-assets.sh
```

Затем перезапустить frontend-контейнер:

```bash
docker compose up -d --build frontend
```

## Режим разработки

```bash
docker compose -f docker-compose.dev.yml up -d
```

Остановить dev-режим:

```bash
docker compose -f docker-compose.dev.yml down
```

## Production-запуск

Для более безопасной выкладки используется `docker-compose.prod.yml`: наружу публикуется только frontend, а backend и база остаются во внутренней Docker-сети.

Перед запуском нужно задать переменные окружения:

```bash
export DB_PASSWORD='your_db_password'
export MARIADB_ROOT_PASSWORD='your_root_password'
docker compose -f docker-compose.prod.yml up -d --build
```

## Контроль качества

Проверка JavaScript:

```bash
node --input-type=module --check < frontend/public/CRM/dashboard.js
node --input-type=module --check < frontend/public/CRM/js/dashboard-data.js
node --input-type=module --check < frontend/public/CRM/js/dashboard-utils.js
node --check frontend/public/CRM/login.js
node --check frontend/public/script.js
```

Проверка PHP внутри контейнера:

```bash
docker compose exec -T backend php -l /var/www/html/api/crm.php
docker compose exec -T backend php -l /var/www/html/api/bootstrap.php
docker compose exec -T backend php -l /var/www/html/api/login.php
```

Проверка Docker-конфигураций:

```bash
docker compose config -q
DB_PASSWORD=123456789 MARIADB_ROOT_PASSWORD=new_password docker compose -f docker-compose.prod.yml config -q
```

## Почему проект имеет практическую ценность

Система закрывает типовой рабочий цикл малого или среднего предприятия: от поступления заказа и формирования договора до контроля предоплаты, готовности товара, транспортировки, архивации договора и хранения файлов. В отличие от универсальных CRM, проект адаптирован под конкретный процесс предприятия и показывает взаимосвязь между воронкой, календарем, клиентами, файлами и отчетными разделами.
