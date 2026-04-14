<?php
/**
 * AIME Precision - 订单管理 API (Shopify风格)
 * 支持订单创建、状态更新、退款等
 */

require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$path = str_replace('/api/orders/', '', $path);

// 提取ID
$id = null;
if (preg_match('#^([a-f0-9]{32})(?:/.*)?$#', $path, $matches)) {
    $id = $matches[1];
    $subPath = substr($path, strlen($id) + 1);
} else {
    $subPath = $path;
}

try {
    $db = getDB();

    switch ($subPath) {
        // ========== 获取订单列表 ==========
        case '':
        case 'list':
            if ($method !== 'GET') sendResponse(['error' => 'Method not allowed'], 405);

            $params = $_GET;
            $where = [];
            $bindings = [];

            // 状态过滤 (Shopify: pending, processing, fulfilled, cancelled, refunded)
            if (!empty($params['status'])) {
                $where[] = "o.status = ?";
                $bindings[] = $params['status'];
            }

            // 搜索 (订单号、客户名、邮箱)
            if (!empty($params['search'])) {
                $where[] = "(o.order_number LIKE ? OR c.name LIKE ? OR c.email LIKE ?)";
                $bindings[] = '%' . $params['search'] . '%';
                $bindings[] = '%' . $params['search'] . '%';
                $bindings[] = '%' . $params['search'] . '%';
            }

            // 日期范围
            if (!empty($params['created_at_min'])) {
                $where[] = "o.created_at >= ?";
                $bindings[] = $params['created_at_min'];
            }
            if (!empty($params['created_at_max'])) {
                $where[] = "o.created_at <= ?";
                $bindings[] = $params['created_at_max'];
            }

            $whereClause = $where ? 'WHERE ' . implode(' AND ', $where) : '';

            // 分页
            $page = max(1, (int)($params['page'] ?? 1));
            $limit = min(100, max(1, (int)($params['limit'] ?? 20)));
            $offset = ($page - 1) * $limit;

            // 获取总数
            $stmt = $db->prepare("SELECT COUNT(*) FROM orders o LEFT JOIN customers c ON o.customer_id = c.id $whereClause");
            $stmt->execute($bindings);
            $total = (int)$stmt->fetchColumn();

            // 获取订单列表
            $sql = "SELECT o.*, c.name as customer_name, c.email as customer_email
                    FROM orders o
                    LEFT JOIN customers c ON o.customer_id = c.id
                    $whereClause
                    ORDER BY o.created_at DESC
                    LIMIT ? OFFSET ?";
            $bindings[] = $limit;
            $bindings[] = $offset;

            $stmt = $db->prepare($sql);
            $stmt->execute($bindings);
            $orders = $stmt->fetchAll();

            // 获取每个订单的商品
            foreach ($orders as &$order) {
                $stmt = $db->prepare("SELECT oi.*, p.name as product_name, pv.title as variant_title
                                      FROM order_items oi
                                      LEFT JOIN products p ON oi.product_id = p.id
                                      LEFT JOIN product_variants pv ON oi.variant_id = pv.id
                                      WHERE oi.order_id = ?");
                $stmt->execute([$order['id']]);
                $order['items'] = $stmt->fetchAll();
            }

            sendResponse([
                'orders' => $orders,
                'pagination' => [
                    'page' => $page,
                    'limit' => $limit,
                    'total' => $total,
                    'pages' => ceil($total / $limit)
                ]
            ]);
            break;

        // ========== 获取单个订单 ==========
        case '':
            if ($method === 'GET' && $id) {
                $stmt = $db->prepare("SELECT o.*, c.name as customer_name, c.email as customer_email, c.phone as customer_phone
                                      FROM orders o
                                      LEFT JOIN customers c ON o.customer_id = c.id
                                      WHERE o.id = ?");
                $stmt->execute([$id]);
                $order = $stmt->fetch();

                if (!$order) sendResponse(['error' => '订单不存在'], 404);

                // 获取订单商品
                $stmt = $db->prepare("SELECT oi.*, p.name as product_name, pv.title as variant_title, p.image_url
                                      FROM order_items oi
                                      LEFT JOIN products p ON oi.product_id = p.id
                                      LEFT JOIN product_variants pv ON oi.variant_id = pv.id
                                      WHERE oi.order_id = ?");
                $stmt->execute([$id]);
                $order['items'] = $stmt->fetchAll();

                // 获取订单日志
                $stmt = $db->prepare("SELECT * FROM order_logs WHERE order_id = ? ORDER BY created_at DESC");
                $stmt->execute([$id]);
                $order['logs'] = $stmt->fetchAll();

                sendResponse($order);
            }
            sendResponse(['error' => 'Method not allowed'], 405);
            break;

        // ========== 创建订单 ==========
        case '':
            if ($method === 'POST') {
                $body = getRequestBody();

                $customerId = $body['customer_id'] ?? null;
                $items = $body['items'] ?? [];
                $shippingAddress = $body['shipping_address'] ?? [];
                $billingAddress = $body['billing_address'] ?? $shippingAddress;
                $notes = $body['notes'] ?? '';

                if (empty($items)) {
                    sendResponse(['error' => '订单商品不能为空'], 400);
                }

                // 计算金额
                $subtotal = 0;
                $orderItems = [];

                foreach ($items as $item) {
                    $productId = $item['product_id'] ?? '';
                    $variantId = $item['variant_id'] ?? null;
                    $quantity = (int)($item['quantity'] ?? 1);
                    $price = (float)($item['price'] ?? 0);

                    // 如果有variant_id，获取价格
                    if ($variantId) {
                        $stmt = $db->prepare("SELECT price FROM product_variants WHERE id = ?");
                        $stmt->execute([$variantId]);
                        $variant = $stmt->fetch();
                        if ($variant) $price = (float)$variant['price'];
                    }

                    $itemTotal = $price * $quantity;
                    $subtotal += $itemTotal;

                    $orderItems[] = [
                        'product_id' => $productId,
                        'variant_id' => $variantId,
                        'quantity' => $quantity,
                        'price' => $price,
                        'total' => $itemTotal
                    ];
                }

                // 运费
                $shippingPrice = (float)($body['shipping_price'] ?? 0);
                $tax = (float)($body['tax'] ?? 0);
                $discount = (float)($body['discount'] ?? 0);
                $total = $subtotal + $shippingPrice + $tax - $discount;

                // 生成订单号 (Shopify风格)
                $stmt = $db->prepare("SELECT MAX(order_number) as max_order FROM orders");
                $stmt->execute();
                $maxOrder = (int)($stmt->fetch()['max_order'] ?? 1000);
                $orderNumber = $maxOrder + 1;

                // 创建订单
                $orderId = generateId();
                $stmt = $db->prepare("INSERT INTO orders
                    (id, order_number, customer_id, subtotal, shipping_price, tax, discount, total,
                     shipping_address, billing_address, status, notes, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, NOW())");
                $stmt->execute([
                    $orderId,
                    $orderNumber,
                    $customerId,
                    $subtotal,
                    $shippingPrice,
                    $tax,
                    $discount,
                    $total,
                    json_encode($shippingAddress),
                    json_encode($billingAddress),
                    $notes
                ]);

                // 添加订单商品
                foreach ($orderItems as $item) {
                    $stmt = $db->prepare("INSERT INTO order_items
                        (id, order_id, product_id, variant_id, quantity, price, total)
                        VALUES (?, ?, ?, ?, ?, ?, ?)");
                    $stmt->execute([
                        generateId(),
                        $orderId,
                        $item['product_id'],
                        $item['variant_id'],
                        $item['quantity'],
                        $item['price'],
                        $item['total']
                    ]);

                    // 更新库存
                    if ($item['variant_id']) {
                        $db->prepare("UPDATE product_variants SET inventory_quantity = inventory_quantity - ? WHERE id = ?")
                           ->execute([$item['quantity'], $item['variant_id']]);
                    }
                }

                // 添加订单日志
                $stmt = $db->prepare("INSERT INTO order_logs (id, order_id, status, message, created_at) VALUES (?, ?, 'pending', '订单已创建', NOW())");
                $stmt->execute([generateId(), $orderId]);

                sendResponse([
                    'success' => true,
                    'order' => [
                        'id' => $orderId,
                        'order_number' => $orderNumber,
                        'total' => $total,
                        'status' => 'pending'
                    ]
                ], 201);
            }
            sendResponse(['error' => 'Method not allowed'], 405);
            break;

        // ========== 更改订单状态 ==========
        case 'status':
            if ($method === 'PATCH' && $id) {
                requireAuth();

                $body = getRequestBody();
                $status = $body['status'] ?? '';

                // Shopify风格状态
                $allowed = ['pending', 'processing', 'fulfilled', 'cancelled', 'refunded', 'partially_refunded'];
                if (!in_array($status, $allowed)) {
                    sendResponse(['error' => '无效的状态'], 400);
                }

                $stmt = $db->prepare("UPDATE orders SET status = ?, updated_at = NOW() WHERE id = ?");
                $stmt->execute([$status, $id]);

                if ($stmt->rowCount() === 0) {
                    sendResponse(['error' => '订单不存在'], 404);
                }

                // 添加日志
                $statusLabels = [
                    'pending' => '待处理',
                    'processing' => '处理中',
                    'fulfilled' => '已完成',
                    'cancelled' => '已取消',
                    'refunded' => '已退款',
                    'partially_refunded' => '部分退款'
                ];

                $stmt = $db->prepare("INSERT INTO order_logs (id, order_id, status, message, created_at) VALUES (?, ?, ?, ?, NOW())");
                $stmt->execute([generateId(), $id, $status, '状态更新为: ' . ($statusLabels[$status] ?? $status)]);

                sendResponse([
                    'success' => true,
                    'status' => $status,
                    'message' => $statusLabels[$status] ?? '状态已更新'
                ]);
            }
            sendResponse(['error' => 'Method not allowed'], 405);
            break;

        // ========== 退款 ==========
        case 'refund':
            if ($method === 'POST' && $id) {
                requireAuth();

                $body = getRequestBody();
                $amount = (float)($body['amount'] ?? 0);
                $reason = $body['reason'] ?? '';

                // 获取订单
                $stmt = $db->prepare("SELECT * FROM orders WHERE id = ?");
                $stmt->execute([$id]);
                $order = $stmt->fetch();

                if (!$order) sendResponse(['error' => '订单不存在'], 404);

                if ($amount > $order['total']) {
                    sendResponse(['error' => '退款金额不能超过订单总额'], 400);
                }

                // 更新订单状态
                $newStatus = $amount >= $order['total'] ? 'refunded' : 'partially_refunded';
                $stmt = $db->prepare("UPDATE orders SET status = ?, refunded_amount = COALESCE(refunded_amount, 0) + ?, updated_at = NOW() WHERE id = ?");
                $stmt->execute([$newStatus, $amount, $id]);

                // 添加日志
                $stmt = $db->prepare("INSERT INTO order_logs (id, order_id, status, message, created_at) VALUES (?, ?, ?, ?, NOW())");
                $stmt->execute([generateId(), $id, $newStatus, "退款: ¥{$amount}" . ($reason ? " - {$reason}" : '')]);

                sendResponse([
                    'success' => true,
                    'refunded_amount' => $amount,
                    'order_status' => $newStatus,
                    'message' => '退款成功'
                ]);
            }
            sendResponse(['error' => 'Method not allowed'], 405);
            break;

        // ========== 取消订单 ==========
        case 'cancel':
            if ($method === 'POST' && $id) {
                requireAuth();

                $body = getRequestBody();
                $reason = $body['reason'] ?? '';

                // 获取订单商品以恢复库存
                $stmt = $db->prepare("SELECT * FROM order_items WHERE order_id = ?");
                $stmt->execute([$id]);
                $items = $stmt->fetchAll();

                // 恢复库存
                foreach ($items as $item) {
                    if ($item['variant_id']) {
                        $db->prepare("UPDATE product_variants SET inventory_quantity = inventory_quantity + ? WHERE id = ?")
                           ->execute([$item['quantity'], $item['variant_id']]);
                    }
                }

                // 更新状态
                $stmt = $db->prepare("UPDATE orders SET status = 'cancelled', updated_at = NOW() WHERE id = ? AND status IN ('pending', 'processing')");
                $stmt->execute([$id]);

                if ($stmt->rowCount() === 0) {
                    sendResponse(['error' => '订单不存在或无法取消'], 400);
                }

                // 添加日志
                $stmt = $db->prepare("INSERT INTO order_logs (id, order_id, status, message, created_at) VALUES (?, ?, 'cancelled', ?, NOW())");
                $stmt->execute([generateId(), $id, '订单已取消' . ($reason ? ": {$reason}" : '')]);

                sendResponse(['success' => true, 'message' => '订单已取消']);
            }
            sendResponse(['error' => 'Method not allowed'], 405);
            break;

        // ========== 获取订单统计 ==========
        case 'stats':
            if ($method === 'GET') {
                requireAuth();

                $params = $_GET;
                $where = '';
                $bindings = [];

                // 日期过滤
                if (!empty($params['created_at_min'])) {
                    $where = "WHERE created_at >= ?";
                    $bindings[] = $params['created_at_min'];
                }
                if (!empty($params['created_at_max'])) {
                    $where .= ($where ? ' AND ' : 'WHERE ') . "created_at <= ?";
                    $bindings[] = $params['created_at_max'];
                }

                // 各状态订单数
                $stmt = $db->prepare("SELECT status, COUNT(*) as count, SUM(total) as total FROM orders $where GROUP BY status");
                $stmt->execute($bindings);
                $statusStats = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);

                // 总计
                $stmt = $db->prepare("SELECT COUNT(*) as count, SUM(total) as revenue, AVG(total) as average FROM orders $where");
                $stmt->execute($bindings);
                $total = $stmt->fetch();

                sendResponse([
                    'total_orders' => (int)($total['count'] ?? 0),
                    'total_revenue' => (float)($total['revenue'] ?? 0),
                    'average_order_value' => round((float)($total['average'] ?? 0), 2),
                    'by_status' => $statusStats
                ]);
            }
            sendResponse(['error' => 'Method not allowed'], 405);
            break;

        default:
            sendResponse(['error' => 'API不存在'], 404);
    }
} catch (PDOException $e) {
    sendResponse(['error' => '服务器错误: ' . $e->getMessage()], 500);
}
