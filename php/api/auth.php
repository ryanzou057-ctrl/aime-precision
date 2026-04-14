<?php
/**
 * AIME Precision - 认证 API
 * 处理用户注册、登录、Token验证
 */

require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$path = str_replace('/api/auth/', '', $path);

try {
    $db = getDB();

    switch ($path) {
        // ========== 注册 ==========
        case 'register':
            if ($method !== 'POST') sendResponse(['error' => 'Method not allowed'], 405);

            $body = getRequestBody();
            $email = trim($body['email'] ?? '');
            $password = $body['password'] ?? '';
            $name = trim($body['name'] ?? '');

            // 验证
            if (empty($email) || empty($password)) {
                sendResponse(['error' => '邮箱和密码必填'], 400);
            }
            if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
                sendResponse(['error' => '邮箱格式不正确'], 400);
            }
            if (strlen($password) < 6) {
                sendResponse(['error' => '密码至少6位'], 400);
            }

            // 检查邮箱是否已存在
            $stmt = $db->prepare("SELECT id FROM users WHERE email = ?");
            $stmt->execute([$email]);
            if ($stmt->fetch()) {
                sendResponse(['error' => '邮箱已存在'], 409);
            }

            // 创建用户
            $id = generateId();
            $passwordHash = hashPassword($password);
            $role = 'admin'; // 第一个注册的用户是管理员

            $stmt = $db->prepare("INSERT INTO users (id, email, password_hash, name, role, created_at) VALUES (?, ?, ?, ?, ?, NOW())");
            $stmt->execute([$id, $email, $passwordHash, $name, $role]);

            $token = generateToken($id, $email, $role);

            sendResponse([
                'success' => true,
                'token' => $token,
                'user' => [
                    'id' => $id,
                    'email' => $email,
                    'name' => $name,
                    'role' => $role
                ]
            ], 201);
            break;

        // ========== 登录 ==========
        case 'login':
            if ($method !== 'POST') sendResponse(['error' => 'Method not allowed'], 405);

            $body = getRequestBody();
            $email = trim($body['email'] ?? '');
            $password = $body['password'] ?? '';

            if (empty($email) || empty($password)) {
                sendResponse(['error' => '邮箱和密码必填'], 400);
            }

            // 查找用户
            $stmt = $db->prepare("SELECT id, email, password_hash, name, role FROM users WHERE email = ?");
            $stmt->execute([$email]);
            $user = $stmt->fetch();

            if (!$user || !verifyPassword($password, $user['password_hash'])) {
                sendResponse(['error' => '邮箱或密码错误'], 401);
            }

            $token = generateToken($user['id'], $user['email'], $user['role']);

            sendResponse([
                'success' => true,
                'token' => $token,
                'user' => [
                    'id' => $user['id'],
                    'email' => $user['email'],
                    'name' => $user['name'],
                    'role' => $user['role']
                ]
            ]);
            break;

        // ========== 获取当前用户 ==========
        case 'me':
            if ($method !== 'GET') sendResponse(['error' => 'Method not allowed'], 405);

            $user = getAuthUser();
            if (!$user) sendResponse(['error' => '未授权'], 401);

            $stmt = $db->prepare("SELECT id, email, name, role, created_at FROM users WHERE id = ?");
            $stmt->execute([$user['user_id']]);
            $userData = $stmt->fetch();

            if (!$userData) sendResponse(['error' => '用户不存在'], 404);

            sendResponse($userData);
            break;

        // ========== 修改密码 ==========
        case 'change-password':
            if ($method !== 'POST') sendResponse(['error' => 'Method not allowed'], 405);

            $auth = getAuthUser();
            if (!$auth) sendResponse(['error' => '未授权'], 401);

            $body = getRequestBody();
            $oldPassword = $body['old_password'] ?? '';
            $newPassword = $body['new_password'] ?? '';

            if (empty($oldPassword) || empty($newPassword)) {
                sendResponse(['error' => '旧密码和新密码必填'], 400);
            }
            if (strlen($newPassword) < 6) {
                sendResponse(['error' => '新密码至少6位'], 400);
            }

            // 验证旧密码
            $stmt = $db->prepare("SELECT password_hash FROM users WHERE id = ?");
            $stmt->execute([$auth['user_id']]);
            $user = $stmt->fetch();

            if (!$user || !verifyPassword($oldPassword, $user['password_hash'])) {
                sendResponse(['error' => '旧密码错误'], 401);
            }

            // 更新密码
            $newHash = hashPassword($newPassword);
            $stmt = $db->prepare("UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?");
            $stmt->execute([$newHash, $auth['user_id']]);

            sendResponse(['success' => true, 'message' => '密码修改成功']);
            break;

        default:
            sendResponse(['error' => 'API不存在'], 404);
    }
} catch (PDOException $e) {
    sendResponse(['error' => '服务器错误: ' . $e->getMessage()], 500);
}
