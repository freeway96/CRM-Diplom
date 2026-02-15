<?php

declare(strict_types=1);

require __DIR__ . "/bootstrap.php";

$pdo = get_pdo();
ensure_schema($pdo);

$method = $_SERVER["REQUEST_METHOD"];
$entity = (string) ($_GET["entity"] ?? "");
$id = isset($_GET["id"]) ? (int) $_GET["id"] : 0;

if ($method === "GET") {
    $clients = $pdo->query("SELECT id, name, contact, phone, created_at FROM clients ORDER BY id DESC")->fetchAll();
    $workers = $pdo->query("SELECT id, name, role, created_at FROM workers ORDER BY id DESC")->fetchAll();
    $deals = $pdo->query("
        SELECT id, client_id, worker_id, amount, status, created_at
        FROM deals
        ORDER BY id DESC
    ")->fetchAll();

    json_response([
        "ok" => true,
        "data" => [
            "clients" => $clients,
            "workers" => $workers,
            "deals" => $deals,
        ],
    ]);
}

if ($method === "POST") {
    $input = read_json_body();

    if ($entity === "clients") {
        $name = trim((string) ($input["name"] ?? ""));
        $contact = trim((string) ($input["contact"] ?? ""));
        $phone = trim((string) ($input["phone"] ?? ""));
        if ($name === "" || $contact === "" || $phone === "") {
            json_response(["ok" => false, "message" => "Заполните поля клиента."], 400);
        }

        $stmt = $pdo->prepare("INSERT INTO clients (name, contact, phone) VALUES (:name, :contact, :phone)");
        $stmt->execute([
            ":name" => $name,
            ":contact" => $contact,
            ":phone" => $phone,
        ]);
        json_response(["ok" => true], 201);
    }

    if ($entity === "workers") {
        $name = trim((string) ($input["name"] ?? ""));
        $role = trim((string) ($input["role"] ?? ""));
        if ($name === "" || $role === "") {
            json_response(["ok" => false, "message" => "Заполните поля сотрудника."], 400);
        }

        $stmt = $pdo->prepare("INSERT INTO workers (name, role) VALUES (:name, :role)");
        $stmt->execute([
            ":name" => $name,
            ":role" => $role,
        ]);
        json_response(["ok" => true], 201);
    }

    if ($entity === "deals") {
        $clientId = (int) ($input["clientId"] ?? 0);
        $workerId = (int) ($input["workerId"] ?? 0);
        $amount = (float) ($input["amount"] ?? 0);
        $status = (string) ($input["status"] ?? "new");
        $allowedStatus = ["new", "in_progress", "won", "lost"];

        if ($clientId <= 0 || $workerId <= 0 || $amount < 0 || !in_array($status, $allowedStatus, true)) {
            json_response(["ok" => false, "message" => "Некорректные данные сделки."], 400);
        }

        $stmt = $pdo->prepare("
            INSERT INTO deals (client_id, worker_id, amount, status)
            VALUES (:client_id, :worker_id, :amount, :status)
        ");
        $stmt->execute([
            ":client_id" => $clientId,
            ":worker_id" => $workerId,
            ":amount" => $amount,
            ":status" => $status,
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

    json_response(["ok" => false, "message" => "Неизвестная сущность."], 400);
}

json_response(["ok" => false, "message" => "Метод не поддерживается."], 405);

