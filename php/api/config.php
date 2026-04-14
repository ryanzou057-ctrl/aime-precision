<?php
/**
 * AIME Precision - PHP Backend Configuration
 * Shopify风格的电商后端API
 */

// 错误报告
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

// CORS 头
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Content-Type: application/json; charset=utf-8');

// 处理OPTIONS预检请求
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// 配置常量
define('DB_HOST', getenv('DB_HOST') ?: 'localhost');
define('DB_USER', getenv('DB_USER') ?: 'root');
define('DB_PASS', getenv('DB_PASSWORD') ?: '');
define('DB_NAME', getenv('DB_NAME') ?: 'aime_precision');

define('JWT_SECRET', getenv('JWT_SECRET') ?: 'your-super-secret-key-change-in-production');
define('JWT_EXPIRES', 7 * 24 * 60 * 60); // 7天

define('UPLOAD_DIR', __DIR__ . '/../public/uploads');
define('MAX_FILE_SIZE', 10 * 1024 * 1024); // 10MB

// 确保上传目录存在
if (!file_exists(UPLOAD_DIR)) {
    mkdir(UPLOAD_DIR, 0755, true);
}

// 数据库连接
function getDB(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        try {
            $pdo = new PDO(
                "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4",
                DB_USER,
                DB_PASS,
                [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES => false
                ]
            );
        } catch (PDOException $e) {
            sendResponse(['error' => '数据库连接失败: ' . $e->getMessage()], 500);
        }
    }
    return $pdo;
}

// 响应JSON
function sendResponse($data, $code = 200): void {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

// 获取请求体
function getRequestBody(): array {
    $input = file_get_contents('php://input');
    return json_decode($input, true) ?: [];
}

// 生成JWT Token
function generateToken(int $userId, string $email, string $role): string {
    $header = base64_encode(json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
    $payload = base64_encode(json_encode([
        'iss' => 'aime-precision',
        'exp' => time() + JWT_EXPIRES,
        'iat' => time(),
        'user_id' => $userId,
        'email' => $email,
        'role' => $role
    ]));
    $signature = base64_encode(hash_hmac('sha256', "$header.$payload", JWT_SECRET, true));
    return "$header.$payload.$signature";
}

// 验证JWT Token
function verifyToken(string $token): ?array {
    $parts = explode('.', $token);
    if (count($parts) !== 3) return null;

    [$header, $payload, $signature] = $parts;
    $expectedSig = base64_encode(hash_hmac('sha256', "$header.$payload", JWT_SECRET, true));

    if ($signature !== $expectedSig) return null;

    $data = json_decode(base64_decode($payload), true);
    if (!$data || $data['exp'] < time()) return null;

    return $data;
}

// 获取认证用户
function getAuthUser(): ?array {
    $auth = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (!str_starts_with($auth, 'Bearer ')) return null;
    return verifyToken(substr($auth, 7));
}

// 验证管理员权限
function requireAdmin(): void {
    $user = getAuthUser();
    if (!$user || $user['role'] !== 'admin') {
        sendResponse(['error' => '需要管理员权限'], 403);
    }
}

// 验证登录
function requireAuth(): void {
    if (!getAuthUser()) {
        sendResponse(['error' => '未授权，请先登录'], 401);
    }
}

// 密码哈希
function hashPassword(string $password): string {
    return password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
}

// 验证密码
function verifyPassword(string $password, string $hash): bool {
    return password_verify($password, $hash);
}

// 生成唯一ID
function generateId(): string {
    return bin2hex(random_bytes(16));
}
