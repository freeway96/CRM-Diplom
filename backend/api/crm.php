<?php

declare(strict_types=1);

require __DIR__ . "/bootstrap.php";

$pdo = get_pdo();
ensure_schema($pdo);

$method = $_SERVER["REQUEST_METHOD"];
$entity = (string) ($_GET["entity"] ?? "");
$id = isset($_GET["id"]) ? (int) $_GET["id"] : 0;
$attendanceDate = trim((string) ($_GET["attendance_date"] ?? ""));
$productionDate = trim((string) ($_GET["production_date"] ?? ""));
$reportMonth = trim((string) ($_GET["month"] ?? ""));
$calendarMonth = trim((string) ($_GET["calendar_month"] ?? ""));
$userId = isset($_GET["user_id"]) ? (int) $_GET["user_id"] : 0;
$search = trim((string) ($_GET["search"] ?? ""));
$clientSearch = trim((string) ($_GET["client_search"] ?? $search));
$dealSearch = trim((string) ($_GET["deal_search"] ?? $search));
$fileSearch = trim((string) ($_GET["file_search"] ?? $search));
$dealStatus = trim((string) ($_GET["deal_status"] ?? "all"));
$requestedEntities = array_values(array_filter(array_map(
    static fn($item) => trim((string) $item),
    explode(",", (string) ($_GET["entities"] ?? ""))
)));

const UPLOAD_ROOT_PRIMARY = __DIR__ . "/uploads";
const UPLOAD_ROOT_FALLBACK = "/tmp/crm_uploads";

function get_upload_dir(string $subDir): string
{
    $safeSubDir = trim($subDir, "/");
    if ($safeSubDir === "") {
        json_response(["ok" => false, "message" => "Некорректный каталог загрузки."], 500);
    }

    $roots = [UPLOAD_ROOT_PRIMARY, UPLOAD_ROOT_FALLBACK];
    foreach ($roots as $root) {
        $dir = $root . "/" . $safeSubDir;
        if (is_dir($dir)) {
            return $dir;
        }
        if (@mkdir($dir, 0775, true)) {
            return $dir;
        }
    }
    json_response(["ok" => false, "message" => "Сервер не может создать каталог для хранения файлов."], 500);
}

function resolve_uploaded_file_path(string $storedName, string $subDir): string
{
    $safeName = basename($storedName);
    if ($safeName === "") return "";

    $safeSubDir = trim($subDir, "/");
    if ($safeSubDir === "") return "";

    $roots = [UPLOAD_ROOT_PRIMARY, UPLOAD_ROOT_FALLBACK];
    foreach ($roots as $root) {
        $dir = $root . "/" . $safeSubDir;
        $path = $dir . "/" . $safeName;
        if (is_file($path)) {
            return $path;
        }
    }
    return "";
}

function normalize_display_file_name(string $name): string
{
    $clean = trim($name);
    $clean = str_replace(["\\", "/"], "_", $clean);
    $clean = preg_replace('/[\x00-\x1F\x7F]+/u', '', $clean);
    return $clean !== "" ? $clean : "document";
}

function sanitize_file_name(string $name): string
{
    $clean = preg_replace('/[^\p{L}\p{N}._-]+/u', '_', $name);
    $clean = trim((string) $clean, "._-");
    return $clean !== "" ? $clean : "file";
}

function normalize_month_range(string $month): array
{
    if (!preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $month)) {
        return ["", ""];
    }
    $startDate = $month . "-01";
    $endDate = date("Y-m-t", strtotime($startDate));
    return [$startDate, $endDate];
}

function should_load_entity(array $requestedEntities, string $entity): bool
{
    return empty($requestedEntities) || in_array($entity, $requestedEntities, true);
}

if ($method === "GET") {
    if ($entity === "attendance_report") {
        if (!preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $reportMonth)) {
            json_response(["ok" => false, "message" => "Некорректный месяц. Используйте формат ГГГГ-ММ."], 400);
        }

        $startDate = $reportMonth . "-01";
        $endDate = date("Y-m-t", strtotime($startDate));

        $stmt = $pdo->prepare("
            SELECT
                w.name AS worker_name,
                COALESCE(SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END), 0) AS present_days,
                COALESCE(SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END), 0) AS absent_days,
                COALESCE(SUM(CASE WHEN a.status = 'sick' THEN 1 ELSE 0 END), 0) AS sick_days,
                COALESCE(SUM(CASE WHEN a.status = 'vacation' THEN 1 ELSE 0 END), 0) AS vacation_days,
                COALESCE(SUM(a.overtime_hours), 0) AS overtime_hours,
                COALESCE(SUM(CASE WHEN a.status = 'present' THEN 8 ELSE 0 END + a.overtime_hours), 0) AS worked_hours
            FROM workers w
            LEFT JOIN attendance a
              ON a.worker_id = w.id
             AND a.work_date BETWEEN :start_date AND :end_date
            GROUP BY w.id, w.name
            ORDER BY w.name ASC
        ");
        $stmt->execute([
            ":start_date" => $startDate,
            ":end_date" => $endDate,
        ]);
        $rows = $stmt->fetchAll();

        header("Content-Type: text/csv; charset=utf-8");
        header("Content-Disposition: attachment; filename=\"attendance_report_{$reportMonth}.csv\"");
        $output = fopen("php://output", "wb");
        if ($output === false) {
            json_response(["ok" => false, "message" => "Не удалось сформировать файл отчета."], 500);
        }

        fwrite($output, "\xEF\xBB\xBF");
        fputcsv($output, [
            "Сотрудник",
            "Месяц",
            "Дней на смене",
            "Дней отсутствовал",
            "Дней больничный",
            "Дней отпуск",
            "Сверхурочно (ч)",
            "Отработано (ч)",
        ], ";");

        foreach ($rows as $row) {
            fputcsv($output, [
                (string) ($row["worker_name"] ?? ""),
                $reportMonth,
                (string) (int) ($row["present_days"] ?? 0),
                (string) (int) ($row["absent_days"] ?? 0),
                (string) (int) ($row["sick_days"] ?? 0),
                (string) (int) ($row["vacation_days"] ?? 0),
                number_format((float) ($row["overtime_hours"] ?? 0), 2, ".", ""),
                number_format((float) ($row["worked_hours"] ?? 0), 2, ".", ""),
            ], ";");
        }

        fclose($output);
        exit;
    }

    if ($entity === "company_file_download") {
        if ($id <= 0) {
            json_response(["ok" => false, "message" => "Некорректный id файла."], 400);
        }

        $stmt = $pdo->prepare("SELECT id, file_name, stored_name, mime_type FROM company_files WHERE id = :id LIMIT 1");
        $stmt->execute([":id" => $id]);
        $file = $stmt->fetch();
        if (!$file) {
            json_response(["ok" => false, "message" => "Файл не найден."], 404);
        }

        $storedName = (string) ($file["stored_name"] ?? "");
        if ($storedName === "") {
            json_response(["ok" => false, "message" => "Файл поврежден."], 500);
        }

        $path = resolve_uploaded_file_path($storedName, "company_disk");
        if ($path === "") {
            json_response(["ok" => false, "message" => "Файл отсутствует на сервере."], 404);
        }

        $downloadName = (string) ($file["file_name"] ?? "document");
        $mime = (string) ($file["mime_type"] ?? "application/octet-stream");

        header("Content-Type: " . $mime);
        header("Content-Disposition: attachment; filename*=UTF-8''" . rawurlencode($downloadName));
        header("Content-Length: " . (string) filesize($path));
        readfile($path);
        exit;
    }

    $responseData = [];

    if (should_load_entity($requestedEntities, "clients")) {
        if ($clientSearch !== "") {
            $stmt = $pdo->prepare("
                SELECT id, name, contact, phone, created_at
                FROM clients
                WHERE name LIKE :search OR contact LIKE :search OR phone LIKE :search
                ORDER BY id DESC
            ");
            $stmt->execute([":search" => "%" . $clientSearch . "%"]);
            $responseData["clients"] = $stmt->fetchAll();
        } else {
            $responseData["clients"] = $pdo->query("SELECT id, name, contact, phone, created_at FROM clients ORDER BY id DESC")->fetchAll();
        }
    }

    if (should_load_entity($requestedEntities, "workers")) {
        $responseData["workers"] = $pdo->query("SELECT id, name, role, created_at FROM workers ORDER BY id DESC")->fetchAll();
    }

    if (should_load_entity($requestedEntities, "deals")) {
        $dealSql = "
            SELECT d.id, d.client_id, d.worker_id, d.order_name, d.details, d.amount, d.status, d.priority, d.next_action_text, d.next_action_date, d.pipeline_stage, d.stage_updated_at, d.expected_date, d.is_archived, d.archived_at, d.created_at
            FROM deals d
            LEFT JOIN clients c ON c.id = d.client_id
        ";
        $dealWhere = [];
        $dealParams = [];

        if ($dealSearch !== "") {
            $dealWhere[] = "(d.order_name LIKE :deal_search OR d.details LIKE :deal_search OR c.name LIKE :deal_search)";
            $dealParams[":deal_search"] = "%" . $dealSearch . "%";
        }

        if (in_array($dealStatus, ["new", "in_progress", "won", "lost"], true)) {
            $dealWhere[] = "d.status = :deal_status";
            $dealParams[":deal_status"] = $dealStatus;
        }

        if (!empty($dealWhere)) {
            $dealSql .= " WHERE " . implode(" AND ", $dealWhere);
        }
        $dealSql .= " ORDER BY d.id DESC";

        $stmt = $pdo->prepare($dealSql);
        $stmt->execute($dealParams);
        $responseData["deals"] = $stmt->fetchAll();
    }

    if (should_load_entity($requestedEntities, "attendance")) {
        if ($attendanceDate !== "") {
            $stmt = $pdo->prepare("
                SELECT id, worker_id, work_date, status, overtime_hours, created_at
                FROM attendance
                WHERE work_date = :work_date
                ORDER BY id DESC
            ");
            $stmt->execute([":work_date" => $attendanceDate]);
            $responseData["attendance"] = $stmt->fetchAll();
        } else {
            $responseData["attendance"] = $pdo->query("
                SELECT id, worker_id, work_date, status, overtime_hours, created_at
                FROM attendance
                ORDER BY id DESC
            ")->fetchAll();
        }
    }

    if (should_load_entity($requestedEntities, "productions")) {
        if ($productionDate !== "") {
            $stmt = $pdo->prepare("
                SELECT id, product_name, quantity, produced_date, created_at
                FROM productions
                WHERE produced_date = :produced_date
                ORDER BY id DESC
            ");
            $stmt->execute([":produced_date" => $productionDate]);
            $responseData["productions"] = $stmt->fetchAll();
        } else {
            $responseData["productions"] = $pdo->query("
                SELECT id, product_name, quantity, produced_date, created_at
                FROM productions
                ORDER BY id DESC
            ")->fetchAll();
        }
    }

    if (should_load_entity($requestedEntities, "calendar_notes")) {
        $calendarSql = "
            SELECT id, user_id, note_date, title, description, is_done, created_at
            FROM calendar_notes
        ";
        $calendarParams = [];
        $calendarWhere = [];

        if ($userId > 0) {
            $calendarWhere[] = "user_id = :calendar_user_id";
            $calendarParams[":calendar_user_id"] = $userId;
        }

        if ($calendarMonth !== "") {
            [$calendarStart, $calendarEnd] = normalize_month_range($calendarMonth);
            if ($calendarStart === "" || $calendarEnd === "") {
                json_response(["ok" => false, "message" => "Некорректный месяц календаря."], 400);
            }
            $calendarWhere[] = "note_date BETWEEN :calendar_start AND :calendar_end";
            $calendarParams[":calendar_start"] = $calendarStart;
            $calendarParams[":calendar_end"] = $calendarEnd;
        }

        if (!empty($calendarWhere)) {
            $calendarSql .= " WHERE " . implode(" AND ", $calendarWhere);
        }
        $calendarSql .= " ORDER BY note_date ASC, id DESC";

        $calendarStmt = $pdo->prepare($calendarSql);
        $calendarStmt->execute($calendarParams);
        $responseData["calendar_notes"] = $calendarStmt->fetchAll();
    }

    if (should_load_entity($requestedEntities, "company_files")) {
        if ($fileSearch !== "") {
            $stmt = $pdo->prepare("
                SELECT f.id, f.uploaded_by, l.User AS uploaded_by_name, f.file_name, f.stored_name, f.mime_type, f.file_size, f.category, f.created_at
                FROM company_files f
                JOIN login l ON l.ID = f.uploaded_by
                WHERE f.file_name LIKE :search OR f.category LIKE :search OR f.mime_type LIKE :search
                ORDER BY f.id DESC
            ");
            $stmt->execute([":search" => "%" . $fileSearch . "%"]);
            $responseData["company_files"] = $stmt->fetchAll();
        } else {
            $responseData["company_files"] = $pdo->query("
                SELECT f.id, f.uploaded_by, l.User AS uploaded_by_name, f.file_name, f.stored_name, f.mime_type, f.file_size, f.category, f.created_at
                FROM company_files f
                JOIN login l ON l.ID = f.uploaded_by
                ORDER BY f.id DESC
            ")->fetchAll();
        }
    }

    json_response([
        "ok" => true,
        "data" => $responseData,
    ]);
}

if ($method === "POST") {

    if ($entity === "company_files") {
        $uploadedBy = isset($_POST["uploadedBy"]) ? (int) $_POST["uploadedBy"] : 0;
        $category = trim((string) ($_POST["category"] ?? ""));

        if ($uploadedBy <= 0) {
            json_response(["ok" => false, "message" => "Не указан пользователь загрузки."], 400);
        }

        if (!isset($_FILES["file"]) || !is_array($_FILES["file"])) {
            json_response(["ok" => false, "message" => "Файл не загружен."], 400);
        }

        $file = $_FILES["file"];
        if ((int) ($file["error"] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
            json_response(["ok" => false, "message" => "Ошибка загрузки файла."], 400);
        }

        $tmpName = (string) ($file["tmp_name"] ?? "");
        if ($tmpName === "" || !is_uploaded_file($tmpName)) {
            json_response(["ok" => false, "message" => "Некорректный файл загрузки."], 400);
        }

        $displayName = normalize_display_file_name((string) ($file["name"] ?? "document"));
        $safeFileName = sanitize_file_name($displayName);
        $mimeType = trim((string) ($file["type"] ?? "application/octet-stream"));
        $fileSize = (int) ($file["size"] ?? 0);

        if ($fileSize <= 0 || $fileSize > 25 * 1024 * 1024) {
            json_response(["ok" => false, "message" => "Допустимый размер файла: от 1 байта до 25 МБ."], 400);
        }

        $uploadDir = get_upload_dir("company_disk");
        $storedName = date("Ymd_His") . "_" . bin2hex(random_bytes(6)) . "_" . $safeFileName;
        $destination = $uploadDir . "/" . $storedName;

        if (!move_uploaded_file($tmpName, $destination)) {
            json_response(["ok" => false, "message" => "Не удалось сохранить файл на сервере."], 500);
        }

        $stmt = $pdo->prepare("
            INSERT INTO company_files (uploaded_by, file_name, stored_name, mime_type, file_size, category)
            VALUES (:uploaded_by, :file_name, :stored_name, :mime_type, :file_size, :category)
        ");
        $stmt->execute([
            ":uploaded_by" => $uploadedBy,
            ":file_name" => $displayName,
            ":stored_name" => $storedName,
            ":mime_type" => ($mimeType !== "" ? $mimeType : "application/octet-stream"),
            ":file_size" => $fileSize,
            ":category" => ($category !== "" ? $category : null),
        ]);

        json_response(["ok" => true], 201);
    }

    $input = read_json_body();

    if ($entity === "clients") {
        $clientId = (int) ($input["clientId"] ?? 0);
        $name = trim((string) ($input["name"] ?? ""));
        $contact = trim((string) ($input["contact"] ?? ""));
        $phone = trim((string) ($input["phone"] ?? ""));
        if ($name === "" || $contact === "" || $phone === "") {
            json_response(["ok" => false, "message" => "Заполните поля клиента."], 400);
        }

        if ($clientId > 0) {
            $stmt = $pdo->prepare("
                UPDATE clients
                SET name = :name, contact = :contact, phone = :phone
                WHERE id = :id
            ");
            $stmt->execute([
                ":id" => $clientId,
                ":name" => $name,
                ":contact" => $contact,
                ":phone" => $phone,
            ]);
        } else {
            $stmt = $pdo->prepare("INSERT INTO clients (name, contact, phone) VALUES (:name, :contact, :phone)");
            $stmt->execute([
                ":name" => $name,
                ":contact" => $contact,
                ":phone" => $phone,
            ]);
        }
        json_response(["ok" => true], 201);
    }

    if ($entity === "workers") {
        $workerId = (int) ($input["workerId"] ?? 0);
        $name = trim((string) ($input["name"] ?? ""));
        $role = trim((string) ($input["role"] ?? ""));
        if ($name === "" || $role === "") {
            json_response(["ok" => false, "message" => "Заполните поля сотрудника."], 400);
        }

        if ($workerId > 0) {
            $stmt = $pdo->prepare("
                UPDATE workers
                SET name = :name, role = :role
                WHERE id = :id
            ");
            $stmt->execute([
                ":id" => $workerId,
                ":name" => $name,
                ":role" => $role,
            ]);
        } else {
            $stmt = $pdo->prepare("INSERT INTO workers (name, role) VALUES (:name, :role)");
            $stmt->execute([
                ":name" => $name,
                ":role" => $role,
            ]);
        }
        json_response(["ok" => true], 201);
    }

    if ($entity === "deals") {
        $dealId = (int) ($input["dealId"] ?? 0);
        $clientId = (int) ($input["clientId"] ?? 0);
        $workerId = (int) ($input["workerId"] ?? 0);
        $orderName = trim((string) ($input["orderName"] ?? ""));
        $details = trim((string) ($input["details"] ?? ""));
        $amount = (float) ($input["amount"] ?? 0);
        $status = (string) ($input["status"] ?? "new");
        $priority = (string) ($input["priority"] ?? "medium");
        $pipelineStage = (string) ($input["pipelineStage"] ?? "order_received");
        $expectedDateRaw = trim((string) ($input["expectedDate"] ?? ""));
        $isArchived = (int) ($input["isArchived"] ?? 0) === 1 ? 1 : 0;
        $allowedStatus = ["new", "in_progress", "won", "lost"];
        $allowedPriority = ["low", "medium", "high", "critical"];
        $allowedStage = [
            "order_received",
            "contract_preparation",
            "prepayment_received",
            "production_ready",
            "transport_ready_notice",
            "contract_closed",
        ];

        if ($clientId <= 0 || $orderName === "" || $amount < 0 || !in_array($status, $allowedStatus, true)) {
            json_response(["ok" => false, "message" => "Некорректные данные сделки."], 400);
        }

        if (!in_array($pipelineStage, $allowedStage, true)) {
            json_response(["ok" => false, "message" => "Некорректный этап сделки."], 400);
        }

        if (!in_array($priority, $allowedPriority, true)) {
            json_response(["ok" => false, "message" => "Некорректный приоритет сделки."], 400);
        }

        $expectedDate = null;
        if ($expectedDateRaw !== "") {
            if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $expectedDateRaw)) {
                json_response(["ok" => false, "message" => "Некорректная дата сделки."], 400);
            }
            $expectedDate = $expectedDateRaw;
        }

        if ($dealId > 0) {
            $currentStageStmt = $pdo->prepare("SELECT pipeline_stage, stage_updated_at, is_archived, archived_at FROM deals WHERE id = :id LIMIT 1");
            $currentStageStmt->execute([":id" => $dealId]);
            $currentDeal = $currentStageStmt->fetch();
            if (!$currentDeal) {
                json_response(["ok" => false, "message" => "Сделка не найдена."], 404);
            }
            $stageUpdatedAt = (string) ($currentDeal["pipeline_stage"] ?? "") !== $pipelineStage
                ? date("Y-m-d H:i:s")
                : (string) ($currentDeal["stage_updated_at"] ?? date("Y-m-d H:i:s"));
            $archivedAt = $isArchived === 1
                ? ((int) ($currentDeal["is_archived"] ?? 0) === 1
                    ? ((string) ($currentDeal["archived_at"] ?? "") !== "" ? (string) $currentDeal["archived_at"] : date("Y-m-d H:i:s"))
                    : date("Y-m-d H:i:s"))
                : null;

            $stmt = $pdo->prepare("
                UPDATE deals
                SET
                    client_id = :client_id,
                    worker_id = :worker_id,
                    order_name = :order_name,
                    details = :details,
                    amount = :amount,
                    status = :status,
                    priority = :priority,
                    pipeline_stage = :pipeline_stage,
                    stage_updated_at = :stage_updated_at,
                    expected_date = :expected_date,
                    is_archived = :is_archived,
                    archived_at = :archived_at
                WHERE id = :id
            ");
            $stmt->execute([
                ":id" => $dealId,
                ":client_id" => $clientId,
                ":worker_id" => ($workerId > 0 ? $workerId : null),
                ":order_name" => $orderName,
                ":details" => ($details === "" ? null : $details),
                ":amount" => $amount,
                ":status" => $status,
                ":priority" => $priority,
                ":pipeline_stage" => $pipelineStage,
                ":stage_updated_at" => $stageUpdatedAt,
                ":expected_date" => $expectedDate,
                ":is_archived" => $isArchived,
                ":archived_at" => $archivedAt,
            ]);
        } else {
            $stmt = $pdo->prepare("
                INSERT INTO deals (client_id, worker_id, order_name, details, amount, status, priority, pipeline_stage, stage_updated_at, expected_date, is_archived, archived_at)
                VALUES (:client_id, :worker_id, :order_name, :details, :amount, :status, :priority, :pipeline_stage, NOW(), :expected_date, :is_archived, :archived_at)
            ");
            $stmt->execute([
                ":client_id" => $clientId,
                ":worker_id" => ($workerId > 0 ? $workerId : null),
                ":order_name" => $orderName,
                ":details" => ($details === "" ? null : $details),
                ":amount" => $amount,
                ":status" => $status,
                ":priority" => $priority,
                ":pipeline_stage" => $pipelineStage,
                ":expected_date" => $expectedDate,
                ":is_archived" => $isArchived,
                ":archived_at" => ($isArchived === 1 ? date("Y-m-d H:i:s") : null),
            ]);
        }
        json_response(["ok" => true], 201);
    }

    if ($entity === "attendance") {
        $workerId = (int) ($input["workerId"] ?? 0);
        $workDate = trim((string) ($input["workDate"] ?? ""));
        $status = (string) ($input["status"] ?? "present");
        $overtimeHours = (float) ($input["overtimeHours"] ?? 0);
        $allowedStatus = ["present", "absent", "sick", "vacation"];

        if ($workerId <= 0 || $workDate === "" || !in_array($status, $allowedStatus, true) || $overtimeHours < 0) {
            json_response(["ok" => false, "message" => "Некорректные данные табеля."], 400);
        }

        $stmt = $pdo->prepare("
            INSERT INTO attendance (worker_id, work_date, status, overtime_hours)
            VALUES (:worker_id, :work_date, :status, :overtime_hours)
            ON DUPLICATE KEY UPDATE
              status = VALUES(status),
              overtime_hours = VALUES(overtime_hours)
        ");
        $stmt->execute([
            ":worker_id" => $workerId,
            ":work_date" => $workDate,
            ":status" => $status,
            ":overtime_hours" => $overtimeHours,
        ]);
        json_response(["ok" => true], 201);
    }

    if ($entity === "productions") {
        $productName = trim((string) ($input["productName"] ?? ""));
        $quantity = (int) ($input["quantity"] ?? 0);
        $producedDate = trim((string) ($input["producedDate"] ?? ""));

        if ($productName === "" || $quantity <= 0 || $producedDate === "") {
            json_response(["ok" => false, "message" => "Некорректные данные по изделиям."], 400);
        }

        $stmt = $pdo->prepare("
            INSERT INTO productions (product_name, quantity, produced_date)
            VALUES (:product_name, :quantity, :produced_date)
        ");
        $stmt->execute([
            ":product_name" => $productName,
            ":quantity" => $quantity,
            ":produced_date" => $producedDate,
        ]);
        json_response(["ok" => true], 201);
    }

    if ($entity === "calendar_notes") {
        $noteId = (int) ($input["noteId"] ?? 0);
        $noteUserId = (int) ($input["userId"] ?? 0);
        $noteDate = trim((string) ($input["noteDate"] ?? ""));
        $title = trim((string) ($input["title"] ?? ""));
        $description = trim((string) ($input["description"] ?? ""));
        $isDone = (int) ($input["isDone"] ?? 0) === 1 ? 1 : 0;

        if ($noteUserId <= 0 || $noteDate === "" || $title === "") {
            json_response(["ok" => false, "message" => "Заполните обязательные поля памятки."], 400);
        }

        if ($noteId > 0) {
            $stmt = $pdo->prepare("
                UPDATE calendar_notes
                SET note_date = :note_date, title = :title, description = :description, is_done = :is_done
                WHERE id = :id AND user_id = :user_id
            ");
            $stmt->execute([
                ":id" => $noteId,
                ":user_id" => $noteUserId,
                ":note_date" => $noteDate,
                ":title" => $title,
                ":description" => ($description !== "" ? $description : null),
                ":is_done" => $isDone,
            ]);
        } else {
            $stmt = $pdo->prepare("
                INSERT INTO calendar_notes (user_id, note_date, title, description, is_done)
                VALUES (:user_id, :note_date, :title, :description, :is_done)
            ");
            $stmt->execute([
                ":user_id" => $noteUserId,
                ":note_date" => $noteDate,
                ":title" => $title,
                ":description" => ($description !== "" ? $description : null),
                ":is_done" => $isDone,
            ]);
        }

        json_response(["ok" => true], 201);
    }

    json_response(["ok" => false, "message" => "Неизвестная сущность."], 400);
}

if ($method === "DELETE") {
    if ($id <= 0) {
        json_response(["ok" => false, "message" => "Некорректный id."], 400);
    }

    if ($entity === "clients") {
        $stmt = $pdo->prepare("DELETE FROM clients WHERE id = :id");
        $stmt->execute([":id" => $id]);
        json_response(["ok" => true]);
    }

    if ($entity === "workers") {
        $stmt = $pdo->prepare("DELETE FROM workers WHERE id = :id");
        $stmt->execute([":id" => $id]);
        json_response(["ok" => true]);
    }

    if ($entity === "deals") {
        $stmt = $pdo->prepare("DELETE FROM deals WHERE id = :id");
        $stmt->execute([":id" => $id]);
        json_response(["ok" => true]);
    }

    if ($entity === "attendance") {
        $stmt = $pdo->prepare("DELETE FROM attendance WHERE id = :id");
        $stmt->execute([":id" => $id]);
        json_response(["ok" => true]);
    }

    if ($entity === "productions") {
        $stmt = $pdo->prepare("DELETE FROM productions WHERE id = :id");
        $stmt->execute([":id" => $id]);
        json_response(["ok" => true]);
    }

    if ($entity === "calendar_notes") {
        $noteUserId = isset($_GET["user_id"]) ? (int) $_GET["user_id"] : 0;
        if ($noteUserId <= 0) {
            json_response(["ok" => false, "message" => "Не указан пользователь."], 400);
        }
        $stmt = $pdo->prepare("DELETE FROM calendar_notes WHERE id = :id AND user_id = :user_id");
        $stmt->execute([
            ":id" => $id,
            ":user_id" => $noteUserId,
        ]);
        json_response(["ok" => true]);
    }

    if ($entity === "company_files") {
        $stmt = $pdo->prepare("SELECT stored_name FROM company_files WHERE id = :id LIMIT 1");
        $stmt->execute([":id" => $id]);
        $file = $stmt->fetch();
        if (!$file) {
            json_response(["ok" => false, "message" => "Файл не найден."], 404);
        }

        $pdo->prepare("DELETE FROM company_files WHERE id = :id")->execute([":id" => $id]);

        $storedName = basename((string) ($file["stored_name"] ?? ""));
        if ($storedName !== "") {
            $path = resolve_uploaded_file_path($storedName, "company_disk");
            if ($path !== "") {
                @unlink($path);
            }
        }

        json_response(["ok" => true]);
    }

    json_response(["ok" => false, "message" => "Неизвестная сущность."], 400);
}

json_response(["ok" => false, "message" => "Метод не поддерживается."], 405);
