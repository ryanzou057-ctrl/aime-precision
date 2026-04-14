<?php
/**
 * AIME Precision - 管理后台 API
 * 统计数据、用户管理、系统设置
 */

require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$path = str_replace('/api/admin/', '', $path);

try {
    $db = getDB();

    switch ($path) {
        // ========== 仪表盘统计 ==========
        case 'dashboard':
        case 'stats':
            if ($method !== 'GET') sendResponse(['error' => 'Method not allowed'], 405);
            requireAuth();

            // 产品统计
            $stmt = $db->query("SELECT
                COUNT(*) as total,
                SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
                SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft,
                SUM(CASE WHEN status = 'archived' THEN 1 ELSE 0 END) as archived
                FROM products");
            $products = $stmt->fetch();

            // 用户统计
            $stmt = $db->query("SELECT COUNT(*) as total FROM users");
            $users = $stmt->fetch();

            // 订单统计
            $stmt = $db->query("SELECT
                COUNT(*) as total_orders,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing,
                SUM(CASE WHEN status = 'fulfilled' THEN 1 ELSE 0 END) as fulfilled,
                SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
                SUM(total) as total_revenue,
                SUM(CASE WHEN status = 'refunded' THEN refunded_amount ELSE 0 END) as total_refunded
                FROM orders");
            $orders = $stmt->fetch();

            // 库存预警 (库存 < 10的产品)
            $stmt = $db->query("SELECT COUNT(*) as low_stock FROM product_variants WHERE inventory_quantity < 10 AND inventory_quantity > 0");
            $lowStock = $stmt->fetch();

            $stmt = $db->query("SELECT COUNT(*) as out_of_stock FROM product_variants WHERE inventory_quantity <= 0");
            $outOfStock = $stmt->fetch();

            // 最近订单
            $stmt = $db->query("SELECT o.id, o.order_number, o.total, o.status, o.created_at, c.name as customer_name
                                FROM orders o
                                LEFT JOIN customers c ON o.customer_id = c.id
                                ORDER BY o.created_at DESC LIMIT 5");
            $recentOrders = $stmt->fetchAll();

            sendResponse([
                'products' => [
                    'total' => (int)$products['total'],
                    'active' => (int)$products['active'],
                    'draft' => (int)$products['draft'],
                    'archived' => (int)$products['archived']
                ],
                'users' => (int)$users['total'],
                'orders' => [
                    'total' => (int)$orders['total_orders'],
                    'pending' => (int)$orders['pending'],
                    'processing' => (int)$orders['processing'],
                    'fulfilled' => (int)$orders['fulfilled'],
                    'cancelled' => (int)$orders['cancelled'],
                    'revenue' => (float)($orders['total_revenue'] ?? 0),
                    'refunded' => (float)($orders['total_refunded'] ?? 0),
                    'net_revenue' => (float)($orders['total_revenue'] ?? 0) - (float)($orders['total_refunded'] ?? 0)
                ],
                'inventory' => [
                    'low_stock' => (int)$lowStock['low_stock'],
                    'out_of_stock' => (int)$outOfStock['out_of_stock']
                ],
                'recent_orders' => $recentOrders
            ]);
            break;

        // ========== 用户列表 ==========
        case 'users':
            if ($method === 'GET') {
                requireAuth();

                $stmt = $db->query("SELECT id, email, name, role, created_at, last_login FROM users ORDER BY created_at DESC");
                $users = $stmt->fetchAll();

                sendResponse(['users' => $users]);
            }

            // 创建用户
            if ($method === 'POST') {
                requireAdmin();

                $body = getRequestBody();
                $email = trim($body['email'] ?? '');
                $password = $body['password'] ?? '';
                $name = trim($body['name'] ?? '');
                $role = $body['role'] ?? 'user';

                if (empty($email) || empty($password)) {
                    sendResponse(['error' => '邮箱和密码必填'], 400);
                }

                // 检查邮箱是否存在
                $stmt = $db->prepare("SELECT id FROM users WHERE email = ?");
                $stmt->execute([$email]);
                if ($stmt->fetch()) {
                    sendResponse(['error' => '邮箱已存在'], 409);
                }

                $id = generateId();
                $stmt = $db->prepare("INSERT INTO users (id, email, password_hash, name, role, created_at) VALUES (?, ?, ?, ?, ?, NOW())");
                $stmt->execute([$id, $email, hashPassword($password), $name, $role]);

                sendResponse([
                    'success' => true,
                    'user' => ['id' => $id, 'email' => $email, 'name' => $name, 'role' => $role]
                ], 201);
            }

            sendResponse(['error' => 'Method not allowed'], 405);
            break;

        // ========== 更新用户 ==========
        case (preg_match('#^users/([a-f0-9]{32})$#', $path, $m) ? true : false):
            if ($method === 'PUT' || $method === 'PATCH') {
                requireAdmin();
                $userId = $m[1];

                $body = getRequestBody();
                $fields = [];
                $bindings = [];

                if (!empty($body['name'])) {
                    $fields[] = 'name = ?';
                    $bindings[] = $body['name'];
                }
                if (!empty($body['role'])) {
                    $fields[] = 'role = ?';
                    $bindings[] = $body['role'];
                }
                if (!empty($body['password'])) {
                    $fields[] = 'password_hash = ?';
                    $bindings[] = hashPassword($body['password']);
                }

                if (!empty($fields)) {
                    $fields[] = 'updated_at = NOW()';
                    $bindings[] = $userId;
                    $stmt = $db->prepare("UPDATE users SET " . implode(', ', $fields) . " WHERE id = ?");
                    $stmt->execute($bindings);
                }

                sendResponse(['success' => true, 'message' => '用户已更新']);
            }
            sendResponse(['error' => 'Method not allowed'], 405);
            break;

        // ========== 删除用户 ==========
        case (preg_match('#^users/([a-f0-9]{32})/delete$#', $path, $m) ? true : false):
            if ($method === 'DELETE') {
                requireAdmin();
                $userId = $m[1];

                // 不能删除自己
                $auth = getAuthUser();
                if ($auth['user_id'] === $userId) {
                    sendResponse(['error' => '不能删除自己'], 400);
                }

                $stmt = $db->prepare("DELETE FROM users WHERE id = ?");
                $stmt->execute([$userId]);

                sendResponse(['success' => true, 'message' => '用户已删除']);
            }
            sendResponse(['error' => 'Method not allowed'], 405);
            break;

        // ========== 分类管理 ==========
        case 'categories':
            if ($method === 'GET') {
                $stmt = $db->query("SELECT * FROM categories ORDER BY position, name");
                sendResponse(['categories' => $stmt->fetchAll()]);
            }

            if ($method === 'POST') {
                requireAdmin();
                $body = getRequestBody();

                $id = generateId();
                $stmt = $db->prepare("INSERT INTO categories (id, name, slug, description, position) VALUES (?, ?, ?, ?, ?)");
                $stmt->execute([
                    $id,
                    $body['name'] ?? '',
                    $body['slug'] ?? '',
                    $body['description'] ?? '',
                    (int)($body['position'] ?? 0)
                ]);

                sendResponse(['success' => true, 'id' => $id], 201);
            }
            sendResponse(['error' => 'Method not allowed'], 405);
            break;

        // ========== 系统设置 ==========
        case 'settings':
            if ($method === 'GET') {
                requireAuth();
                $stmt = $db->query("SELECT key, value FROM settings");
                $settings = [];
                while ($row = $stmt->fetch()) {
                    $settings[$row['key']] = $row['value'];
                }
                sendResponse($settings);
            }

            if ($method === 'PUT') {
                requireAdmin();
                $body = getRequestBody();

                foreach ($body as $key => $value) {
                    $stmt = $db->prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = ?");
                    $stmt->execute([$key, $value, $value]);
                }

                sendResponse(['success' => true, 'message' => '设置已保存']);
            }
            sendResponse(['error' => 'Method not allowed'], 405);
            break;

        default:
            sendResponse(['error' => 'API不存在'], 404);
    }
} catch (PDOException $e) {
    sendResponse(['error' => '服务器错误: ' . $e->getMessage()], 500);
}
