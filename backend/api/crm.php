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

if ($method === "GET") {
    $clients = $pdo->query("SELECT id, name, contact, phone, created_at FROM clients ORDER BY id DESC")->fetchAll();
    $workers = $pdo->query("SELECT id, name, role, created_at FROM workers ORDER BY id DESC")->fetchAll();
    $deals = $pdo->query("
        SELECT id, client_id, worker_id, order_name, details, amount, status, created_at
        FROM deals
        ORDER BY id DESC
    ")->fetchAll();

    if ($attendanceDate !== "") {
        $stmt = $pdo->prepare("
            SELECT id, worker_id, work_date, status, overtime_hours, created_at
            FROM attendance
            WHERE work_date = :work_date
            ORDER BY id DESC
        ");
        $stmt->execute([":work_date" => $attendanceDate]);
        $attendance = $stmt->fetchAll();
    } else {
        $attendance = $pdo->query("
            SELECT id, worker_id, work_date, status, overtime_hours, created_at
            FROM attendance
            ORDER BY id DESC
        ")->fetchAll();
    }

    if ($productionDate !== "") {
        $stmt = $pdo->prepare("
            SELECT id, worker_id, product_name, quantity, produced_date, created_at
            FROM productions
            WHERE produced_date = :produced_date
            ORDER BY id DESC
        ");
        $stmt->execute([":produced_date" => $productionDate]);
        $productions = $stmt->fetchAll();
    } else {
        $productions = $pdo->query("
            SELECT id, worker_id, product_name, quantity, produced_date, created_at
            FROM productions
            ORDER BY id DESC
        ")->fetchAll();
    }

    json_response([
        "ok" => true,
        "data" => [
            "clients" => $clients,
            "workers" => $workers,
            "deals" => $deals,
            "attendance" => $attendance,
            "productions" => $productions,
        ],
    ]);
}

if ($method === "POST") {
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
        $orderName = trim((string) ($input["orderName"] ?? ""));
        $details = trim((string) ($input["details"] ?? ""));
        $amount = (float) ($input["amount"] ?? 0);
        $status = (string) ($input["status"] ?? "new");
        $allowedStatus = ["new", "in_progress", "won", "lost"];

        if ($clientId <= 0 || $orderName === "" || $amount < 0 || !in_array($status, $allowedStatus, true)) {
            json_response(["ok" => false, "message" => "Некорректные данные сделки."], 400);
        }

        if ($dealId > 0) {
            $stmt = $pdo->prepare("
                UPDATE deals
                SET client_id = :client_id, order_name = :order_name, details = :details, amount = :amount, status = :status
                WHERE id = :id
            ");
            $stmt->execute([
                ":id" => $dealId,
                ":client_id" => $clientId,
                ":order_name" => $orderName,
                ":details" => ($details === "" ? null : $details),
                ":amount" => $amount,
                ":status" => $status,
            ]);
        } else {
            $stmt = $pdo->prepare("
                INSERT INTO deals (client_id, worker_id, order_name, details, amount, status)
                VALUES (:client_id, NULL, :order_name, :details, :amount, :status)
            ");
            $stmt->execute([
                ":client_id" => $clientId,
                ":order_name" => $orderName,
                ":details" => ($details === "" ? null : $details),
                ":amount" => $amount,
                ":status" => $status,
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
        $workerId = (int) ($input["workerId"] ?? 0);
        $productName = trim((string) ($input["productName"] ?? ""));
        $quantity = (int) ($input["quantity"] ?? 0);
        $producedDate = trim((string) ($input["producedDate"] ?? ""));

        if ($workerId <= 0 || $productName === "" || $quantity <= 0 || $producedDate === "") {
            json_response(["ok" => false, "message" => "Некорректные данные по изделиям."], 400);
        }

        $stmt = $pdo->prepare("
            INSERT INTO productions (worker_id, product_name, quantity, produced_date)
            VALUES (:worker_id, :product_name, :quantity, :produced_date)
        ");
        $stmt->execute([
            ":worker_id" => $workerId,
            ":product_name" => $productName,
            ":quantity" => $quantity,
            ":produced_date" => $producedDate,
        ]);
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

    json_response(["ok" => false, "message" => "Неизвестная сущность."], 400);
}

json_response(["ok" => false, "message" => "Метод не поддерживается."], 405);
