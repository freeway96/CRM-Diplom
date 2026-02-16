<?php

declare(strict_types=1);

header("Content-Type: application/json; charset=utf-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(204);
    exit;
}

function json_response(array $payload, int $code = 200): void
{
    http_response_code($code);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

function read_json_body(): array
{
    $raw = file_get_contents("php://input");
    if ($raw === false || $raw === "") {
        return [];
    }

    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        json_response(["ok" => false, "message" => "Некорректный JSON в запросе."], 400);
    }

    return $decoded;
}

function get_pdo(): PDO
{
    $host = getenv("DB_HOST") ?: "database";
    $port = getenv("DB_PORT") ?: "3306";
    $name = getenv("DB_NAME") ?: "crm_db";
    $user = getenv("DB_USER") ?: "crm_user";
    $pass = getenv("DB_PASSWORD") ?: "123456789";

    $dsn = "mysql:host={$host};port={$port};dbname={$name};charset=utf8mb4";

    try {
        return new PDO($dsn, $user, $pass, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
    } catch (Throwable $e) {
        json_response(["ok" => false, "message" => "Ошибка подключения к БД."], 500);
    }
}

function ensure_schema(PDO $pdo): void
{
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS login (
            ID INT NOT NULL AUTO_INCREMENT,
            User VARCHAR(50) NOT NULL,
            Login VARCHAR(50) NOT NULL,
            Password VARCHAR(255) NOT NULL,
            Last_Login TIMESTAMP NULL DEFAULT NULL,
            PRIMARY KEY (ID),
            UNIQUE KEY unique_login (Login)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    ");

    $countStmt = $pdo->query("SELECT COUNT(*) AS cnt FROM login");
    $count = (int) ($countStmt->fetch()["cnt"] ?? 0);
    if ($count === 0) {
        $pdo->exec("
            INSERT INTO login (User, Login, Password) VALUES
            ('Иван Иванов', 'user1', 'user1'),
            ('Мария Сидорова', 'user2', 'user2'),
            ('Администратор', 'admin', 'admin')
        ");
    }

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS clients (
            id INT NOT NULL AUTO_INCREMENT,
            name VARCHAR(120) NOT NULL,
            contact VARCHAR(120) NOT NULL,
            phone VARCHAR(40) NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    ");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS workers (
            id INT NOT NULL AUTO_INCREMENT,
            name VARCHAR(120) NOT NULL,
            role VARCHAR(120) NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    ");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS deals (
            id INT NOT NULL AUTO_INCREMENT,
            client_id INT NOT NULL,
            worker_id INT NULL,
            order_name VARCHAR(160) NOT NULL DEFAULT '',
            details TEXT NULL,
            amount DECIMAL(12,2) NOT NULL DEFAULT 0,
            status ENUM('new', 'in_progress', 'won', 'lost') NOT NULL DEFAULT 'new',
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_deals_client (client_id),
            KEY idx_deals_worker (worker_id),
            CONSTRAINT fk_deals_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
            CONSTRAINT fk_deals_worker FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    ");

    $columnOrderName = (int) ($pdo->query("
        SELECT COUNT(*) AS cnt
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'deals' AND COLUMN_NAME = 'order_name'
    ")->fetch()["cnt"] ?? 0);
    if ($columnOrderName === 0) {
        $pdo->exec("ALTER TABLE deals ADD COLUMN order_name VARCHAR(160) NOT NULL DEFAULT '' AFTER worker_id");
    }

    $columnDetails = (int) ($pdo->query("
        SELECT COUNT(*) AS cnt
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'deals' AND COLUMN_NAME = 'details'
    ")->fetch()["cnt"] ?? 0);
    if ($columnDetails === 0) {
        $pdo->exec("ALTER TABLE deals ADD COLUMN details TEXT NULL AFTER order_name");
    }

    $columnWorkerNullable = (int) ($pdo->query("
        SELECT COUNT(*) AS cnt
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'deals' AND COLUMN_NAME = 'worker_id' AND IS_NULLABLE = 'YES'
    ")->fetch()["cnt"] ?? 0);
    if ($columnWorkerNullable === 0) {
        $pdo->exec("ALTER TABLE deals MODIFY worker_id INT NULL");
    }

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS attendance (
            id INT NOT NULL AUTO_INCREMENT,
            worker_id INT NOT NULL,
            work_date DATE NOT NULL,
            status ENUM('present', 'absent', 'sick', 'vacation') NOT NULL DEFAULT 'present',
            overtime_hours DECIMAL(4,2) NOT NULL DEFAULT 0,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uniq_worker_day (worker_id, work_date),
            KEY idx_attendance_date (work_date),
            CONSTRAINT fk_attendance_worker FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    ");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS productions (
            id INT NOT NULL AUTO_INCREMENT,
            worker_id INT NOT NULL,
            product_name VARCHAR(140) NOT NULL,
            quantity INT NOT NULL DEFAULT 0,
            produced_date DATE NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_productions_date (produced_date),
            KEY idx_productions_worker (worker_id),
            CONSTRAINT fk_productions_worker FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    ");
}
