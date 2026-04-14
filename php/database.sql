-- ============================================
-- AIME Precision - 数据库初始化脚本
-- Shopify风格的电商数据库
-- ============================================

-- 创建数据库
CREATE DATABASE IF NOT EXISTS aime_precision CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE aime_precision;

-- ============================================
-- 用户表
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(32) PRIMARY KEY COMMENT '用户ID',
    email VARCHAR(255) UNIQUE NOT NULL COMMENT '邮箱',
    password_hash VARCHAR(255) NOT NULL COMMENT '密码哈希',
    name VARCHAR(100) DEFAULT '' COMMENT '姓名',
    role ENUM('admin', 'user', 'guest') DEFAULT 'user' COMMENT '角色',
    avatar VARCHAR(500) DEFAULT '' COMMENT '头像URL',
    phone VARCHAR(20) DEFAULT '' COMMENT '电话',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_login DATETIME DEFAULT NULL,
    INDEX idx_email (email),
    INDEX idx_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';

-- ============================================
-- 产品分类表
-- ============================================
CREATE TABLE IF NOT EXISTS categories (
    id VARCHAR(32) PRIMARY KEY,
    name VARCHAR(100) NOT NULL COMMENT '分类名称',
    slug VARCHAR(100) UNIQUE NOT NULL COMMENT 'URL友好名称',
    description TEXT COMMENT '分类描述',
    image_url VARCHAR(500) DEFAULT '' COMMENT '分类图片',
    parent_id VARCHAR(32) DEFAULT NULL COMMENT '父分类ID',
    position INT DEFAULT 0 COMMENT '排序位置',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_slug (slug),
    INDEX idx_parent (parent_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='产品分类表';

-- ============================================
-- 产品表 (Shopify风格)
-- ============================================
CREATE TABLE IF NOT EXISTS products (
    id VARCHAR(32) PRIMARY KEY COMMENT '产品ID',
    name VARCHAR(255) NOT NULL COMMENT '产品名称',
    description TEXT COMMENT '产品描述',
    price DECIMAL(10, 2) NOT NULL DEFAULT 0.00 COMMENT '价格',
    compare_at_price DECIMAL(10, 2) DEFAULT NULL COMMENT '原价(划线价)',
    cost_price DECIMAL(10, 2) DEFAULT NULL COMMENT '成本价',
    category VARCHAR(100) DEFAULT 'general' COMMENT '分类',

    -- Shopify风格状态: draft(草稿), active(已上架), archived(归档)
    status ENUM('draft', 'active', 'archived') DEFAULT 'draft',

    -- SEO相关
    seo_title VARCHAR(255) DEFAULT '' COMMENT 'SEO标题',
    seo_description TEXT COMMENT 'SEO描述',

    -- 产品元数据
    sku VARCHAR(100) DEFAULT '' COMMENT 'SKU编码',
    barcode VARCHAR(100) DEFAULT '' COMMENT '条形码',
    weight DECIMAL(8, 2) DEFAULT NULL COMMENT '重量',
    weight_unit ENUM('kg', 'g', 'lb', 'oz') DEFAULT 'kg' COMMENT '重量单位',

    -- 图片 (主图)
    image_url VARCHAR(500) DEFAULT '' COMMENT '主图URL',

    -- 库存策略
    inventory_policy ENUM('deny', 'continue') DEFAULT 'deny' COMMENT '库存策略',
    inventory_tracked BOOLEAN DEFAULT TRUE COMMENT '是否追踪库存',

    -- Shopify特定字段
    vendor VARCHAR(100) DEFAULT '' COMMENT '供应商/品牌',
    product_type VARCHAR(100) DEFAULT '' COMMENT '产品类型',
    tags TEXT COMMENT '标签(逗号分隔)',

    -- 用户关联
    user_id VARCHAR(32) DEFAULT NULL COMMENT '创建用户ID',

    -- 时间戳
    published_at DATETIME DEFAULT NULL COMMENT '上架时间',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_status (status),
    INDEX idx_category (category),
    INDEX idx_sku (sku),
    INDEX idx_user (user_id),
    INDEX idx_created (created_at),
    FULLTEXT idx_search (name, description)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='产品表';

-- ============================================
-- 产品变体表 (Shopify风格)
-- ============================================
CREATE TABLE IF NOT EXISTS product_variants (
    id VARCHAR(32) PRIMARY KEY COMMENT '变体ID',
    product_id VARCHAR(32) NOT NULL COMMENT '所属产品ID',

    -- 变体信息
    title VARCHAR(255) DEFAULT 'Default' COMMENT '变体标题',
    sku VARCHAR(100) DEFAULT '' COMMENT 'SKU编码',
    barcode VARCHAR(100) DEFAULT '' COMMENT '条形码',

    -- 价格
    price DECIMAL(10, 2) DEFAULT 0.00 COMMENT '售价',
    compare_at_price DECIMAL(10, 2) DEFAULT NULL COMMENT '原价',
    cost_price DECIMAL(10, 2) DEFAULT NULL COMMENT '成本价',

    -- 库存
    inventory_quantity INT DEFAULT 0 COMMENT '库存数量',
    inventory_policy ENUM('deny', 'continue') DEFAULT 'deny' COMMENT '库存策略',

    -- 物流
    weight DECIMAL(8, 2) DEFAULT NULL COMMENT '重量',
    weight_unit ENUM('kg', 'g', 'lb', 'oz') DEFAULT 'kg' COMMENT '重量单位',

    -- 变体属性 (JSON格式存储选项如颜色、尺寸)
    options JSON DEFAULT NULL COMMENT '变体选项',

    -- 排序
    position INT DEFAULT 0 COMMENT '显示顺序',

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    INDEX idx_product (product_id),
    INDEX idx_sku (sku)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='产品变体表';

-- ============================================
-- 产品图片表
-- ============================================
CREATE TABLE IF NOT EXISTS product_images (
    id VARCHAR(32) PRIMARY KEY,
    product_id VARCHAR(32) NOT NULL COMMENT '所属产品ID',
    src VARCHAR(500) NOT NULL COMMENT '图片URL',
    alt_text VARCHAR(255) DEFAULT '' COMMENT 'ALT文字',
    position INT DEFAULT 0 COMMENT '显示顺序',
    width INT DEFAULT NULL COMMENT '图片宽度',
    height INT DEFAULT NULL COMMENT '图片高度',

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    INDEX idx_product (product_id),
    INDEX idx_position (position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='产品图片表';

-- ============================================
-- 客户表
-- ============================================
CREATE TABLE IF NOT EXISTS customers (
    id VARCHAR(32) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL COMMENT '邮箱',
    first_name VARCHAR(50) DEFAULT '' COMMENT '名',
    last_name VARCHAR(50) DEFAULT '' COMMENT '姓',
    name VARCHAR(100) GENERATED ALWAYS AS (CONCAT(first_name, last_name)) STORED COMMENT '全名',
    phone VARCHAR(20) DEFAULT '' COMMENT '电话',

    -- 客户地址
    address JSON DEFAULT NULL COMMENT '地址JSON',

    -- 客户元数据
    accepts_marketing BOOLEAN DEFAULT FALSE COMMENT '是否接受营销',
    tags TEXT COMMENT '标签',

    -- 统计
    total_spent DECIMAL(10, 2) DEFAULT 0.00 COMMENT '累计消费',
    order_count INT DEFAULT 0 COMMENT '订单数',

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_order_at DATETIME DEFAULT NULL COMMENT '最后下单时间',

    INDEX idx_email (email),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='客户表';

-- ============================================
-- 订单表 (Shopify风格)
-- ============================================
CREATE TABLE IF NOT EXISTS orders (
    id VARCHAR(32) PRIMARY KEY COMMENT '订单ID',
    order_number INT UNIQUE NOT NULL AUTO_INCREMENT COMMENT '订单号',

    -- 客户
    customer_id VARCHAR(32) DEFAULT NULL COMMENT '客户ID',
    customer_name VARCHAR(100) GENERATED ALWAYS AS (
        SELECT COALESCE(c.name, 'Guest') FROM customers c WHERE c.id = customer_id
    ) STORED COMMENT '客户名(冗余)',

    -- 金额
    subtotal DECIMAL(10, 2) DEFAULT 0.00 COMMENT '小计',
    shipping_price DECIMAL(10, 2) DEFAULT 0.00 COMMENT '运费',
    tax DECIMAL(10, 2) DEFAULT 0.00 COMMENT '税费',
    discount DECIMAL(10, 2) DEFAULT 0.00 COMMENT '折扣',
    total DECIMAL(10, 2) DEFAULT 0.00 COMMENT '总计',
    refunded_amount DECIMAL(10, 2) DEFAULT 0.00 COMMENT '已退款金额',

    -- 地址
    shipping_address JSON DEFAULT NULL COMMENT '收货地址',
    billing_address JSON DEFAULT NULL COMMENT '账单地址',

    -- Shopify风格状态: pending, processing, fulfilled, cancelled, refunded, partially_refunded
    status ENUM('pending', 'processing', 'fulfilled', 'cancelled', 'refunded', 'partially_refunded')
        DEFAULT 'pending' COMMENT '订单状态',

    -- 支付
    payment_status ENUM('pending', 'paid', 'failed', 'refunded') DEFAULT 'pending' COMMENT '支付状态',
    payment_method VARCHAR(50) DEFAULT '' COMMENT '支付方式',

    -- 备注
    notes TEXT COMMENT '内部备注',
    customer_note TEXT COMMENT '客户备注',

    -- 用户关联
    user_id VARCHAR(32) DEFAULT NULL COMMENT '创建用户ID',

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_order_number (order_number),
    INDEX idx_customer (customer_id),
    INDEX idx_status (status),
    INDEX idx_payment (payment_status),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单表';

-- ============================================
-- 订单商品表
-- ============================================
CREATE TABLE IF NOT EXISTS order_items (
    id VARCHAR(32) PRIMARY KEY,
    order_id VARCHAR(32) NOT NULL COMMENT '订单ID',
    product_id VARCHAR(32) DEFAULT NULL COMMENT '产品ID',
    variant_id VARCHAR(32) DEFAULT NULL COMMENT '变体ID',

    -- 商品信息快照
    product_name VARCHAR(255) DEFAULT '' COMMENT '产品名称快照',
    variant_title VARCHAR(255) DEFAULT '' COMMENT '变体名称快照',
    sku VARCHAR(100) DEFAULT '' COMMENT 'SKU快照',

    -- 数量和价格
    quantity INT NOT NULL DEFAULT 1 COMMENT '数量',
    price DECIMAL(10, 2) NOT NULL DEFAULT 0.00 COMMENT '单价',
    total DECIMAL(10, 2) NOT NULL DEFAULT 0.00 COMMENT '小计',

    -- 退款
    refunded_quantity INT DEFAULT 0 COMMENT '退款数量',

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
    INDEX idx_order (order_id),
    INDEX idx_product (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单商品表';

-- ============================================
-- 订单日志表
-- ============================================
CREATE TABLE IF NOT EXISTS order_logs (
    id VARCHAR(32) PRIMARY KEY,
    order_id VARCHAR(32) NOT NULL COMMENT '订单ID',
    status VARCHAR(50) DEFAULT '' COMMENT '状态',
    message TEXT COMMENT '日志消息',
    actor_id VARCHAR(32) DEFAULT NULL COMMENT '操作人ID',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    INDEX idx_order (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单日志表';

-- ============================================
-- 系统设置表
-- ============================================
CREATE TABLE IF NOT EXISTS settings (
    `key` VARCHAR(100) PRIMARY KEY,
    value TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统设置表';

-- ============================================
-- 插入默认设置
-- ============================================
INSERT INTO settings (`key`, value) VALUES
    ('store_name', 'AIME Precision'),
    ('store_email', 'contact@aime-precision.com'),
    ('currency', 'CNY'),
    ('currency_symbol', '¥'),
    ('tax_rate', '0.00'),
    ('shipping_fee', '0.00')
ON DUPLICATE KEY UPDATE value = VALUES(value);

-- ============================================
-- 初始化管理员账号 (密码: admin123)
-- ============================================
INSERT INTO users (id, email, password_hash, name, role) VALUES
    (MD5('admin@aime.com'), 'admin@aime.com', '$2y$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4p4otLbHPKlCJeHe', '管理员', 'admin')
ON DUPLICATE KEY UPDATE email = VALUES(email);

-- ============================================
-- 插入示例分类
-- ============================================
INSERT INTO categories (id, name, slug, description, position) VALUES
    (MD5('precision-parts'), '精密零件', 'precision-parts', '高精度机械零件', 1),
    (MD5('tools'), '工具', 'tools', '专业工具和夹具', 2),
    (MD5('materials'), '材料', 'materials', '各种工程材料', 3)
ON DUPLICATE KEY UPDATE name = VALUES(name);
