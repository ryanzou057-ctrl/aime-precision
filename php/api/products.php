<?php
/**
 * AIME Precision - 产品管理 API (Shopify风格)
 * 支持产品上架/下架/归档、变体、库存管理
 */

require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$path = str_replace('/api/products/', '', $path);

try {
    $db = getDB();

    // 提取ID (如果有)
    $id = null;
    if (preg_match('#^([a-f0-9]{32})(?:/.*)?$#', $path, $matches)) {
        $id = $matches[1];
        $subPath = isset($matches[2]) ? substr($path, strlen($id) + 1) : '';
    } else {
        $subPath = $path;
    }

    switch ($subPath) {
        // ========== 获取产品列表 ==========
        case '':
        case 'list':
            if ($method !== 'GET') sendResponse(['error' => 'Method not allowed'], 405);

            $params = $_GET;
            $where = [];
            $bindings = [];

            // 按状态过滤 (Shopify: published, draft, archived)
            if (!empty($params['status'])) {
                $where[] = "p.status = ?";
                $bindings[] = $params['status'];
            }

            // 按分类过滤
            if (!empty($params['category'])) {
                $where[] = "p.category = ?";
                $bindings[] = $params['category'];
            }

            // 搜索
            if (!empty($params['search'])) {
                $where[] = "(p.name LIKE ? OR p.description LIKE ?)";
                $bindings[] = '%' . $params['search'] . '%';
                $bindings[] = '%' . $params['search'] . '%';
            }

            $whereClause = $where ? 'WHERE ' . implode(' AND ', $where) : '';

            // 分页
            $page = max(1, (int)($params['page'] ?? 1));
            $limit = min(100, max(1, (int)($params['limit'] ?? 20)));
            $offset = ($page - 1) * $limit;

            // 获取总数
            $countSql = "SELECT COUNT(*) FROM products p $whereClause";
            $stmt = $db->prepare($countSql);
            $stmt->execute($bindings);
            $total = (int)$stmt->fetchColumn();

            // 获取产品列表
            $sql = "SELECT p.*,
                           (SELECT COUNT(*) FROM product_variants pv WHERE pv.product_id = p.id) as variant_count,
                           (SELECT SUM(pv.inventory_quantity) FROM product_variants pv WHERE pv.product_id = p.id) as total_inventory
                    FROM products p
                    $whereClause
                    ORDER BY p.created_at DESC
                    LIMIT ? OFFSET ?";
            $bindings[] = $limit;
            $bindings[] = $offset;

            $stmt = $db->prepare($sql);
            $stmt->execute($bindings);
            $products = $stmt->fetchAll();

            sendResponse([
                'products' => $products,
                'pagination' => [
                    'page' => $page,
                    'limit' => $limit,
                    'total' => $total,
                    'pages' => ceil($total / $limit)
                ]
            ]);
            break;

        // ========== 获取单个产品 ==========
        case '':
            if ($method === 'GET' && $id) {
                $stmt = $db->prepare("SELECT * FROM products WHERE id = ?");
                $stmt->execute([$id]);
                $product = $stmt->fetch();

                if (!$product) sendResponse(['error' => '产品不存在'], 404);

                // 获取变体
                $stmt = $db->prepare("SELECT * FROM product_variants WHERE product_id = ? ORDER BY created_at");
                $stmt->execute([$id]);
                $product['variants'] = $stmt->fetchAll();

                // 获取图片
                $stmt = $db->prepare("SELECT * FROM product_images WHERE product_id = ? ORDER BY position");
                $stmt->execute([$id]);
                $product['images'] = $stmt->fetchAll();

                sendResponse($product);
            }
            sendResponse(['error' => 'Method not allowed'], 405);
            break;

        // ========== 创建产品 ==========
        case '':
            if ($method === 'POST') {
                requireAuth();
                $user = getAuthUser();

                $body = getRequestBody();
                $name = trim($body['name'] ?? '');
                $price = (float)($body['price'] ?? 0);
                $description = $body['description'] ?? '';
                $category = $body['category'] ?? 'general';
                $status = $body['status'] ?? 'draft'; // draft, active, archived

                if (empty($name) || $price <= 0) {
                    sendResponse(['error' => '产品名称和价格必填'], 400);
                }

                $id = generateId();
                $stmt = $db->prepare("INSERT INTO products (id, name, price, description, category, status, user_id, created_at, updated_at)
                                      VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())");
                $stmt->execute([$id, $name, $price, $description, $category, $status, $user['user_id']]);

                // 处理图片上传
                $images = handleImageUpload($id);
                // 处理变体
                $variants = handleVariants($db, $id, $body['variants'] ?? []);

                sendResponse([
                    'success' => true,
                    'product' => [
                        'id' => $id,
                        'name' => $name,
                        'price' => $price,
                        'status' => $status
                    ],
                    'images' => $images,
                    'variants' => $variants
                ], 201);
            }
            sendResponse(['error' => 'Method not allowed'], 405);
            break;

        // ========== 更新产品 ==========
        case '':
            if ($method === 'PUT' && $id) {
                requireAuth();

                $body = getRequestBody();
                $fields = [];
                $bindings = [];

                $allowedFields = ['name', 'price', 'description', 'category', 'status', 'sku', 'barcode', 'weight', 'weight_unit', 'inventory_policy'];

                foreach ($allowedFields as $field) {
                    if (isset($body[$field])) {
                        $fields[] = "$field = ?";
                        $bindings[] = $body[$field];
                    }
                }

                if (!empty($fields)) {
                    $fields[] = 'updated_at = NOW()';
                    $bindings[] = $id;
                    $sql = "UPDATE products SET " . implode(', ', $fields) . " WHERE id = ?";
                    $stmt = $db->prepare($sql);
                    $stmt->execute($bindings);
                }

                // 更新变体
                if (isset($body['variants'])) {
                    handleVariants($db, $id, $body['variants']);
                }

                sendResponse(['success' => true, 'message' => '产品更新成功']);
            }
            sendResponse(['error' => 'Method not allowed'], 405);
            break;

        // ========== 删除产品 ==========
        case '':
            if ($method === 'DELETE' && $id) {
                requireAuth();

                // 删除关联数据
                $db->prepare("DELETE FROM product_images WHERE product_id = ?")->execute([$id]);
                $db->prepare("DELETE FROM product_variants WHERE product_id = ?")->execute([$id]);
                $db->prepare("DELETE FROM products WHERE id = ?")->execute([$id]);

                sendResponse(['success' => true, 'message' => '产品已删除']);
            }
            sendResponse(['error' => 'Method not allowed'], 405);
            break;

        // ========== 更改产品状态 (Shopify风格) ==========
        case 'status':
            if ($method === 'PATCH' && $id) {
                requireAuth();

                $body = getRequestBody();
                $status = $body['status'] ?? '';

                // Shopify风格状态: draft(草稿), active(上架), archived(归档)
                $allowed = ['draft', 'active', 'archived'];
                if (!in_array($status, $allowed)) {
                    sendResponse(['error' => '无效的状态。可选: ' . implode(', ', $allowed)], 400);
                }

                $stmt = $db->prepare("UPDATE products SET status = ?, updated_at = NOW() WHERE id = ?");
                $stmt->execute([$status, $id]);

                if ($stmt->rowCount() === 0) {
                    sendResponse(['error' => '产品不存在'], 404);
                }

                $statusLabels = [
                    'draft' => '草稿',
                    'active' => '已上架',
                    'archived' => '已归档'
                ];

                sendResponse([
                    'success' => true,
                    'id' => $id,
                    'status' => $status,
                    'message' => $statusLabels[$status] ?? '状态已更新'
                ]);
            }
            sendResponse(['error' => 'Method not allowed'], 405);
            break;

        // ========== 发布产品 (上架) ==========
        case 'publish':
            if ($method === 'POST' && $id) {
                requireAuth();

                $stmt = $db->prepare("UPDATE products SET status = 'active', published_at = NOW(), updated_at = NOW() WHERE id = ?");
                $stmt->execute([$id]);

                sendResponse(['success' => true, 'status' => 'active', 'message' => '产品已上架']);
            }
            sendResponse(['error' => 'Method not allowed'], 405);
            break;

        // ========== 下架产品 ==========
        case 'unpublish':
            if ($method === 'POST' && $id) {
                requireAuth();

                $stmt = $db->prepare("UPDATE products SET status = 'draft', updated_at = NOW() WHERE id = ?");
                $stmt->execute([$id]);

                sendResponse(['success' => true, 'status' => 'draft', 'message' => '产品已下架']);
            }
            sendResponse(['error' => 'Method not allowed'], 405);
            break;

        // ========== 归档产品 ==========
        case 'archive':
            if ($method === 'POST' && $id) {
                requireAuth();

                $stmt = $db->prepare("UPDATE products SET status = 'archived', updated_at = NOW() WHERE id = ?");
                $stmt->execute([$id]);

                sendResponse(['success' => true, 'status' => 'archived', 'message' => '产品已归档']);
            }
            sendResponse(['error' => 'Method not allowed'], 405);
            break;

        // ========== 批量操作 ==========
        case 'bulk':
            if ($method === 'POST') {
                requireAuth();

                $body = getRequestBody();
                $action = $body['action'] ?? '';
                $productIds = $body['product_ids'] ?? [];

                if (empty($productIds) || !is_array($productIds)) {
                    sendResponse(['error' => '请选择要操作的产品'], 400);
                }

                $placeholders = implode(',', array_fill(0, count($productIds), '?'));
                $result = ['success' => count($productIds), 'failed' => 0];

                switch ($action) {
                    case 'publish':
                        $stmt = $db->prepare("UPDATE products SET status = 'active', published_at = NOW(), updated_at = NOW() WHERE id IN ($placeholders)");
                        $stmt->execute($productIds);
                        $result['message'] = '已上架 ' . $stmt->rowCount() . ' 个产品';
                        break;

                    case 'unpublish':
                        $stmt = $db->prepare("UPDATE products SET status = 'draft', updated_at = NOW() WHERE id IN ($placeholders)");
                        $stmt->execute($productIds);
                        $result['message'] = '已下架 ' . $stmt->rowCount() . ' 个产品';
                        break;

                    case 'archive':
                        $stmt = $db->prepare("UPDATE products SET status = 'archived', updated_at = NOW() WHERE id IN ($placeholders)");
                        $stmt->execute($productIds);
                        $result['message'] = '已归档 ' . $stmt->rowCount() . ' 个产品';
                        break;

                    case 'delete':
                        foreach ($productIds as $pid) {
                            $db->prepare("DELETE FROM product_images WHERE product_id = ?")->execute([$pid]);
                            $db->prepare("DELETE FROM product_variants WHERE product_id = ?")->execute([$pid]);
                        }
                        $stmt = $db->prepare("DELETE FROM products WHERE id IN ($placeholders)");
                        $stmt->execute($productIds);
                        $result['message'] = '已删除 ' . $stmt->rowCount() . ' 个产品';
                        break;

                    default:
                        sendResponse(['error' => '未知操作'], 400);
                }

                sendResponse($result);
            }
            sendResponse(['error' => 'Method not allowed'], 405);
            break;

        default:
            sendResponse(['error' => 'API不存在'], 404);
    }
} catch (PDOException $e) {
    sendResponse(['error' => '服务器错误: ' . $e->getMessage()], 500);
}

// ========== 辅助函数 ==========

/**
 * 处理图片上传
 */
function handleImageUpload(string $productId): array {
    $uploaded = [];

    if (empty($_FILES['images'])) {
        return $uploaded;
    }

    $files = $_FILES['images'];
    $count = count($files['name']);

    for ($i = 0; $i < $count; $i++) {
        if ($files['error'][$i] !== UPLOAD_ERR_OK) continue;

        $ext = pathinfo($files['name'][$i], PATHINFO_EXTENSION);
        $allowed = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
        if (!in_array(strtolower($ext), $allowed)) continue;

        $filename = generateId() . '.' . $ext;
        $path = UPLOAD_DIR . '/' . $filename;

        if (move_uploaded_file($files['tmp_name'][$i], $path)) {
            $stmt = getDB()->prepare("INSERT INTO product_images (id, product_id, src, position) VALUES (?, ?, ?, ?)");
            $imgId = generateId();
            $stmt->execute([$imgId, $productId, '/uploads/' . $filename, $i]);
            $uploaded[] = ['id' => $imgId, 'src' => '/uploads/' . $filename];
        }
    }

    return $uploaded;
}

/**
 * 处理产品变体
 */
function handleVariants(PDO $db, string $productId, array $variants): array {
    // 删除现有变体
    $db->prepare("DELETE FROM product_variants WHERE product_id = ?")->execute([$productId]);

    $created = [];
    foreach ($variants as $variant) {
        $id = generateId();
        $stmt = $db->prepare("INSERT INTO product_variants
            (id, product_id, title, sku, barcode, price, compare_at_price, inventory_quantity, inventory_policy, weight, weight_unit, position)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([
            $id,
            $productId,
            $variant['title'] ?? 'Default',
            $variant['sku'] ?? '',
            $variant['barcode'] ?? '',
            $variant['price'] ?? 0,
            $variant['compare_at_price'] ?? null,
            (int)($variant['inventory_quantity'] ?? 0),
            $variant['inventory_policy'] ?? 'deny',
            $variant['weight'] ?? null,
            $variant['weight_unit'] ?? 'kg',
            $variant['position'] ?? 0
        ]);
        $created[] = ['id' => $id, 'title' => $variant['title'] ?? 'Default'];
    }

    return $created;
}
