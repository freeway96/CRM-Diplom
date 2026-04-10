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
            priority ENUM('low', 'medium', 'high', 'critical') NOT NULL DEFAULT 'medium',
            next_action_text VARCHAR(180) NULL,
            next_action_date DATE NULL,
            pipeline_stage ENUM(
                'order_received',
                'contract_preparation',
                'prepayment_received',
                'production_ready',
                'transport_ready_notice',
                'contract_closed'
            ) NOT NULL DEFAULT 'order_received',
            stage_updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            expected_date DATE NULL,
            is_archived TINYINT(1) NOT NULL DEFAULT 0,
            archived_at TIMESTAMP NULL DEFAULT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_deals_client (client_id),
            KEY idx_deals_worker (worker_id),
            KEY idx_deals_stage (pipeline_stage),
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

    $columnPipelineStage = (int) ($pdo->query("
        SELECT COUNT(*) AS cnt
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'deals' AND COLUMN_NAME = 'pipeline_stage'
    ")->fetch()["cnt"] ?? 0);
    if ($columnPipelineStage === 0) {
        $pdo->exec("
            ALTER TABLE deals
            ADD COLUMN pipeline_stage ENUM(
                'order_received',
                'contract_preparation',
                'prepayment_received',
                'production_ready',
                'transport_ready_notice',
                'contract_closed'
            ) NOT NULL DEFAULT 'order_received' AFTER status
        ");
    }

    $columnExpectedDate = (int) ($pdo->query("
        SELECT COUNT(*) AS cnt
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'deals' AND COLUMN_NAME = 'expected_date'
    ")->fetch()["cnt"] ?? 0);
    if ($columnExpectedDate === 0) {
        $pdo->exec("ALTER TABLE deals ADD COLUMN expected_date DATE NULL AFTER pipeline_stage");
    }

    $columnPriority = (int) ($pdo->query("
        SELECT COUNT(*) AS cnt
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'deals' AND COLUMN_NAME = 'priority'
    ")->fetch()["cnt"] ?? 0);
    if ($columnPriority === 0) {
        $pdo->exec("ALTER TABLE deals ADD COLUMN priority ENUM('low', 'medium', 'high', 'critical') NOT NULL DEFAULT 'medium' AFTER status");
    }

    $columnNextActionText = (int) ($pdo->query("
        SELECT COUNT(*) AS cnt
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'deals' AND COLUMN_NAME = 'next_action_text'
    ")->fetch()["cnt"] ?? 0);
    if ($columnNextActionText === 0) {
        $pdo->exec("ALTER TABLE deals ADD COLUMN next_action_text VARCHAR(180) NULL AFTER priority");
    }

    $columnNextActionDate = (int) ($pdo->query("
        SELECT COUNT(*) AS cnt
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'deals' AND COLUMN_NAME = 'next_action_date'
    ")->fetch()["cnt"] ?? 0);
    if ($columnNextActionDate === 0) {
        $pdo->exec("ALTER TABLE deals ADD COLUMN next_action_date DATE NULL AFTER next_action_text");
    }

    $columnStageUpdatedAt = (int) ($pdo->query("
        SELECT COUNT(*) AS cnt
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'deals' AND COLUMN_NAME = 'stage_updated_at'
    ")->fetch()["cnt"] ?? 0);
    if ($columnStageUpdatedAt === 0) {
        $pdo->exec("ALTER TABLE deals ADD COLUMN stage_updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER pipeline_stage");
    }

    $columnIsArchived = (int) ($pdo->query("
        SELECT COUNT(*) AS cnt
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'deals' AND COLUMN_NAME = 'is_archived'
    ")->fetch()["cnt"] ?? 0);
    if ($columnIsArchived === 0) {
        $pdo->exec("ALTER TABLE deals ADD COLUMN is_archived TINYINT(1) NOT NULL DEFAULT 0 AFTER expected_date");
    }

    $columnArchivedAt = (int) ($pdo->query("
        SELECT COUNT(*) AS cnt
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'deals' AND COLUMN_NAME = 'archived_at'
    ")->fetch()["cnt"] ?? 0);
    if ($columnArchivedAt === 0) {
        $pdo->exec("ALTER TABLE deals ADD COLUMN archived_at TIMESTAMP NULL DEFAULT NULL AFTER is_archived");
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
            product_name VARCHAR(140) NOT NULL,
            quantity INT NOT NULL DEFAULT 0,
            produced_date DATE NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_productions_date (produced_date)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    ");

    $productionWorkerColumnExists = (int) ($pdo->query("
        SELECT COUNT(*) AS cnt
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'productions' AND COLUMN_NAME = 'worker_id'
    ")->fetch()["cnt"] ?? 0);
    if ($productionWorkerColumnExists > 0) {
        $fkStmt = $pdo->query("
            SELECT DISTINCT k.CONSTRAINT_NAME
            FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE k
            WHERE k.TABLE_SCHEMA = DATABASE()
              AND k.TABLE_NAME = 'productions'
              AND k.COLUMN_NAME = 'worker_id'
              AND k.REFERENCED_TABLE_NAME IS NOT NULL
        ");
        foreach ($fkStmt->fetchAll(PDO::FETCH_COLUMN) as $constraintName) {
            $safeConstraint = str_replace("`", "``", (string) $constraintName);
            $pdo->exec("ALTER TABLE productions DROP FOREIGN KEY `{$safeConstraint}`");
        }

        $idxStmt = $pdo->query("
            SELECT DISTINCT s.INDEX_NAME
            FROM INFORMATION_SCHEMA.STATISTICS s
            WHERE s.TABLE_SCHEMA = DATABASE()
              AND s.TABLE_NAME = 'productions'
              AND s.COLUMN_NAME = 'worker_id'
              AND s.INDEX_NAME <> 'PRIMARY'
        ");
        foreach ($idxStmt->fetchAll(PDO::FETCH_COLUMN) as $indexName) {
            $safeIndex = str_replace("`", "``", (string) $indexName);
            $pdo->exec("ALTER TABLE productions DROP INDEX `{$safeIndex}`");
        }

        $pdo->exec("ALTER TABLE productions DROP COLUMN worker_id");
    }

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS user_profiles (
            user_id INT NOT NULL,
            avatar_file VARCHAR(255) NULL,
            phone VARCHAR(40) NULL,
            email VARCHAR(160) NULL,
            department VARCHAR(120) NULL,
            position_title VARCHAR(120) NULL,
            bio TEXT NULL,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (user_id),
            CONSTRAINT fk_profiles_user FOREIGN KEY (user_id) REFERENCES login(ID) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    ");

    $profileAvatarColumn = (int) ($pdo->query("
        SELECT COUNT(*) AS cnt
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_profiles' AND COLUMN_NAME = 'avatar_file'
    ")->fetch()["cnt"] ?? 0);
    if ($profileAvatarColumn === 0) {
        $pdo->exec("ALTER TABLE user_profiles ADD COLUMN avatar_file VARCHAR(255) NULL AFTER user_id");
    }

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS calendar_notes (
            id INT NOT NULL AUTO_INCREMENT,
            user_id INT NOT NULL,
            note_date DATE NOT NULL,
            title VARCHAR(180) NOT NULL,
            description TEXT NULL,
            is_done TINYINT(1) NOT NULL DEFAULT 0,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_calendar_user_date (user_id, note_date),
            CONSTRAINT fk_calendar_user FOREIGN KEY (user_id) REFERENCES login(ID) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    ");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS company_files (
            id INT NOT NULL AUTO_INCREMENT,
            uploaded_by INT NOT NULL,
            file_name VARCHAR(255) NOT NULL,
            stored_name VARCHAR(255) NOT NULL,
            mime_type VARCHAR(180) NULL,
            file_size BIGINT NOT NULL DEFAULT 0,
            category VARCHAR(120) NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_company_files_created (created_at),
            CONSTRAINT fk_company_files_user FOREIGN KEY (uploaded_by) REFERENCES login(ID) ON DELETE RESTRICT
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    ");
}
