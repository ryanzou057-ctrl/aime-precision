<?php
/**
 * AIME Precision - API 路由入口
 * 将请求分发到对应的API模块
 */

// 获取请求路径
$requestUri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$requestUri = rtrim($requestUri, '/');

// API基础路径
$basePath = '/api';
$apiPath = str_replace($basePath, '', $requestUri);
$apiPath = trim($apiPath, '/');

// 路由映射
$routes = [
    // 认证
    'auth/register' => 'auth.php',
    'auth/login' => 'auth.php',
    'auth/me' => 'auth.php',
    'auth/change-password' => 'auth.php',

    // 产品
    'products' => 'products.php',
    'products/status' => 'products.php',
    'products/publish' => 'products.php',
    'products/unpublish' => 'products.php',
    'products/archive' => 'products.php',
    'products/bulk' => 'products.php',

    // 订单
    'orders' => 'orders.php',
    'orders/status' => 'orders.php',
    'orders/refund' => 'orders.php',
    'orders/cancel' => 'orders.php',
    'orders/stats' => 'orders.php',

    // 管理
    'admin/dashboard' => 'admin.php',
    'admin/stats' => 'admin.php',
    'admin/users' => 'admin.php',
    'admin/categories' => 'admin.php',
    'admin/settings' => 'admin.php',
];

// 查找匹配的路由
$matchedFile = null;
$matchedPath = '';

foreach ($routes as $route => $file) {
    if (strpos($apiPath, $route) === 0) {
        $matchedFile = $file;
        $matchedPath = $route;
        break;
    }
}

// 处理产品/订单的ID路由 (如 /api/products/xxx/status)
if (!$matchedFile && preg_match('#^(products|orders)(?:/([a-f0-9]{32}))?(?:/.*)?$#', $apiPath, $m)) {
    $matchedFile = $m[1] . '.php';
    $matchedPath = $m[1];
}

// 处理 admin/users/xxx 路由
if (!$matchedFile && preg_match('#^admin/users/([a-f0-9]{32})(?:/.*)?$#', $apiPath, $m)) {
    $matchedFile = 'admin.php';
    $matchedPath = 'admin/users/' . $m[1];
}

// 404
if (!$matchedFile) {
    header('Content-Type: application/json');
    http_response_code(404);
    echo json_encode([
        'error' => 'API不存在',
        'path' => $apiPath,
        'hint' => '请检查API路径是否正确'
    ]);
    exit;
}

// 包含对应的API文件
$apiFile = __DIR__ . '/' . $matchedFile;
if (file_exists($apiFile)) {
    require_once $apiFile;
} else {
    header('Content-Type: application/json');
    http_response_code(500);
    echo json_encode(['error' => 'API文件不存在']);
}
