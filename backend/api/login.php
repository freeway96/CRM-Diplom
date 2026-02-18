<?php

declare(strict_types=1);

require __DIR__ . "/bootstrap.php";

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    json_response(["ok" => false, "message" => "Метод не поддерживается."], 405);
}

$input = read_json_body();
$login = trim((string) ($input["login"] ?? ""));
$password = (string) ($input["password"] ?? "");

if ($login === "" || $password === "") {
    json_response(["ok" => false, "message" => "Введите логин и пароль."], 400);
}

$pdo = get_pdo();
ensure_schema($pdo);

$stmt = $pdo->prepare("SELECT ID, User, Login FROM login WHERE Login = :login AND Password = :password LIMIT 1");
$stmt->execute([
    ":login" => $login,
    ":password" => $password,
]);

$user = $stmt->fetch();

if (!$user) {
    json_response(["ok" => false, "message" => "Неверный логин или пароль."], 401);
}

$upd = $pdo->prepare("UPDATE login SET Last_Login = NOW() WHERE ID = :id");
$upd->execute([":id" => $user["ID"]]);

json_response([
    "ok" => true,
    "user" => [
        "id" => (int) $user["ID"],
        "user" => $user["User"],
        "login" => $user["Login"],
    ],
]);

