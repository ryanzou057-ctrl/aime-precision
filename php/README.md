# AIME Precision - PHP Backend

Shopify风格的电商后端API，使用PHP开发。

## 📁 目录结构

```
php/
├── api/
│   ├── index.php      # API路由入口
│   ├── config.php     # 配置文件
│   ├── auth.php       # 认证API
│   ├── products.php   # 产品管理API
│   ├── orders.php     # 订单管理API
│   └── admin.php      # 管理后台API
├── public/
│   ├── .htaccess      # Apache配置
│   └── index.html     # 前端入口
├── database.sql       # 数据库初始化脚本
├── nginx.conf.example # Nginx配置示例
└── api-client.js      # 前端API客户端
```

## 🚀 快速开始

### 1. 环境要求

- PHP 8.0+
- MySQL 5.7+ / MariaDB 10.3+
- Apache (mod_rewrite) 或 Nginx

### 2. 安装步骤

#### 通过宝塔面板安装

1. 创建网站 → 填写域名
2. 上传所有文件到网站目录
3. 导入数据库：
   ```bash
   mysql -u root -p < database.sql
   ```
4. 修改 `api/config.php` 或设置环境变量

#### 手动安装

```bash
# 1. 克隆/下载代码到 /www/wwwroot/aime-precision
cd /www/wwwroot/aime-precision

# 2. 创建数据库
mysql -u root -p
CREATE DATABASE aime_precision CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
EXIT;

# 3. 导入数据库
mysql -u root -p aime_precision < php/database.sql

# 4. 配置环境变量或修改config.php
```

### 3. 配置

编辑 `api/config.php` 或设置环境变量：

```php
// 数据库
DB_HOST=localhost
DB_USER=your_user
DB_PASSWORD=your_password
DB_NAME=aime_precision

// JWT密钥 (非常重要!)
JWT_SECRET=your-super-secret-key-change-in-production
```

## 📡 API 文档

### 认证 API

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | /api/auth/register | 注册 | 否 |
| POST | /api/auth/login | 登录 | 否 |
| GET | /api/auth/me | 获取当前用户 | 是 |
| POST | /api/auth/change-password | 修改密码 | 是 |

### 产品 API

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | /api/products | 获取产品列表 | 否 |
| GET | /api/products/{id} | 获取单个产品 | 否 |
| POST | /api/products | 创建产品 | 是 |
| PUT | /api/products/{id} | 更新产品 | 是 |
| DELETE | /api/products/{id} | 删除产品 | 是 |
| PATCH | /api/products/{id}/status | 更改状态 | 是 |
| POST | /api/products/{id}/publish | 上架 | 是 |
| POST | /api/products/{id}/unpublish | 下架 | 是 |
| POST | /api/products/{id}/archive | 归档 | 是 |
| POST | /api/products/bulk | 批量操作 | 是 |

#### 产品状态

- `draft` - 草稿（未上架）
- `active` - 已上架
- `archived` - 已归档

### 订单 API

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | /api/orders | 获取订单列表 | 是 |
| GET | /api/orders/{id} | 获取单个订单 | 是 |
| POST | /api/orders | 创建订单 | 否 |
| PATCH | /api/orders/{id}/status | 更改状态 | 是 |
| POST | /api/orders/{id}/refund | 退款 | 是 |
| POST | /api/orders/{id}/cancel | 取消订单 | 是 |

#### 订单状态

- `pending` - 待处理
- `processing` - 处理中
- `fulfilled` - 已完成
- `cancelled` - 已取消
- `refunded` - 已退款
- `partially_refunded` - 部分退款

### 管理 API

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | /api/admin/dashboard | 仪表盘统计 | 是(管理员) |
| GET | /api/admin/users | 用户列表 | 是(管理员) |
| POST | /api/admin/users | 创建用户 | 是(管理员) |
| GET | /api/admin/categories | 获取分类 | 是 |
| POST | /api/admin/categories | 创建分类 | 是(管理员) |
| GET | /api/admin/settings | 获取设置 | 是 |
| PUT | /api/admin/settings | 更新设置 | 是(管理员) |

## 🔐 认证

使用 JWT Token 认证。

登录成功后，会返回 `token`。后续请求需要在 Header 中携带：

```
Authorization: Bearer <your_token>
```

## 📝 使用示例

### 登录

```javascript
const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        email: 'admin@aime.com',
        password: 'admin123'
    })
});
const data = await response.json();
console.log(data.token); // 保存token
```

### 创建产品

```javascript
const formData = new FormData();
formData.append('name', '精密轴承');
formData.append('price', '299.00');
formData.append('description', '高精度轴承，适用于工业机械');
formData.append('category', 'precision-parts');
formData.append('status', 'draft');

const response = await fetch('/api/products', {
    method: 'POST',
    headers: {
        'Authorization': 'Bearer ' + token
    },
    body: formData
});
```

### 上架产品

```javascript
await fetch('/api/products/' + productId + '/publish', {
    method: 'POST',
    headers: {
        'Authorization': 'Bearer ' + token
    }
});
```

## 🛠️ 宝塔面板部署

1. **上传文件** → 通过FTP或文件管理器上传到 `/www/wwwroot/aime-precision`

2. **创建数据库** → 宝塔面板 → 数据库 → 添加数据库 → 导入 `php/database.sql`

3. **创建网站** → 宝塔面板 → 网站 → 添加站点
   - 域名：your-domain.com
   - 根目录：选择 `php/public`

4. **设置伪静态** (如果使用Apache，确保.htaccess生效)

5. **配置SSL** (可选但推荐)

## 🔧 故障排除

### 500 错误

1. 检查PHP错误日志
2. 确保数据库连接信息正确
3. 检查 `public/uploads` 目录权限

### 401 未授权

1. 检查Token是否过期
2. 确保请求Header中包含了 `Authorization: Bearer <token>`

### 文件上传失败

1. 检查 `public/uploads` 目录权限 (755)
2. 检查PHP `upload_max_filesize` 配置

## 📄 许可证

MIT License
