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

$stmt = $pdo->prepare("SELECT ID, User, Login, Password FROM login WHERE Login = :login LIMIT 1");
$stmt->execute([":login" => $login]);

$user = $stmt->fetch();

$storedPassword = (string) ($user["Password"] ?? "");
$isPasswordValid = $user && (
    password_verify($password, $storedPassword) ||
    hash_equals($storedPassword, $password)
);

if (!$isPasswordValid) {
    json_response(["ok" => false, "message" => "Неверный логин или пароль."], 401);
}

$needsPasswordRehash = !password_get_info($storedPassword)["algo"] || password_needs_rehash($storedPassword, PASSWORD_DEFAULT);
if ($needsPasswordRehash) {
    $hashStmt = $pdo->prepare("UPDATE login SET Password = :password_hash WHERE ID = :id");
    $hashStmt->execute([
        ":password_hash" => password_hash($password, PASSWORD_DEFAULT),
        ":id" => $user["ID"],
    ]);
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
