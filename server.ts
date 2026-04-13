import express from "express";
import type { Request, Response, NextFunction } from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import mysql from "mysql2/promise";
import multer from "multer";
import fs from "fs";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

// 加载环境变量
dotenv.config();

// ================= 配置常量 =================
const uploadDir = path.join(process.cwd(), "public", "uploads");
const MAX_FILE_SIZE = Number(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024;
const REQUEST_TIMEOUT = 30000;
const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === "production";
const JWT_SECRET = process.env.JWT_SECRET || "default-secret-change-me";
const JWT_EXPIRES_IN = "7d";

// ================= 目录初始化 =================
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// ================= Multer 配置 =================
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        const name = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, "_");
        cb(null, name + "-" + uniqueSuffix + ext);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: MAX_FILE_SIZE },
    fileFilter: (req, file, cb) => {
        const allowedMimes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error("Invalid file type. Only images are allowed."));
        }
    }
});

// ================= 数据库连接池配置 =================
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'my_website',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'my_website',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// 测试数据库连接
pool.getConnection()
    .then(conn => {
        console.log("✅ 成功连接到 MySQL 数据库！");
        conn.release();
    })
    .catch(err => {
        console.error("❌ MySQL 连接失败:", err.message);
    });

// ================= 工具函数 =================
const hashPassword = async (password: string): Promise<string> => {
    return bcrypt.hash(password, 12);
};

const comparePassword = async (password: string, hash: string): Promise<boolean> => {
    return bcrypt.compare(password, hash);
};

const generateToken = (userId: string, email: string): string => {
    return jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

const verifyToken = (token: string): { userId: string; email: string } | null => {
    try {
        return jwt.verify(token, JWT_SECRET) as { userId: string; email: string };
    } catch {
        return null;
    }
};

// 中间件：验证JWT
const authenticate = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
        return res.status(401).json({ error: "未授权，请先登录" });
    }
    const token = authHeader.slice(7);
    const decoded = verifyToken(token);
    if (!decoded) {
        return res.status(401).json({ error: "Token无效或已过期" });
    }
    (req as any).user = decoded;
    next();
};

// 中间件：管理员验证
const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
        return res.status(401).json({ error: "未授权" });
    }
    const token = authHeader.slice(7);
    const decoded = verifyToken(token);
    if (!decoded) {
        return res.status(401).json({ error: "Token无效" });
    }
    try {
        const [users]: any = await pool.query("SELECT role FROM users WHERE id = ?", [decoded.userId]);
        if (!users.length || users[0].role !== "admin") {
            return res.status(403).json({ error: "需要管理员权限" });
        }
        (req as any).user = decoded;
        next();
    } catch (error) {
        res.status(500).json({ error: "验证失败" });
    }
};

const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error("Error:", err);
    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({ error: "File size exceeds limit" });
    }
    res.status(500).json({ error: err.message || "Internal server error" });
};

const requestTimeout = (timeout: number) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const timer = setTimeout(() => {
            if (!res.headersSent) res.status(408).json({ error: "Request timeout" });
        }, timeout);
        res.on("finish", () => clearTimeout(timer));
        next();
    };
};

// ================= API 接口 =================
async function startServer() {
    const app = express();
    app.use(requestTimeout(REQUEST_TIMEOUT));
    app.use(express.json({ limit: "10mb" }));
    app.use(express.urlencoded({ limit: "10mb", extended: true }));
    app.use("/uploads", express.static(path.join(process.cwd(), "public/uploads")));

    // ---------- 认证接口 ----------

    // 注册
    app.post("/api/auth/register", async (req, res) => {
        try {
            const { email, password, name } = req.body;
            if (!email || !password) {
                return res.status(400).json({ error: "邮箱和密码必填" });
            }
            if (password.length < 6) {
                return res.status(400).json({ error: "密码至少6位" });
            }

            const id = Date.now().toString();
            const password_hash = await hashPassword(password);

            await pool.query(
                "INSERT INTO users (id, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?)",
                [id, email, password_hash, name || "", "user"]
            );

            const token = generateToken(id, email);
            res.status(201).json({ success: true, token, user: { id, email, name, role: "user" } });
        } catch (error: any) {
            if (error.code === "ER_DUP_ENTRY") {
                return res.status(409).json({ error: "邮箱已存在" });
            }
            console.error(error);
            res.status(500).json({ error: "注册失败" });
        }
    });

    // 登录
    app.post("/api/auth/login", async (req, res) => {
        try {
            const { email, password } = req.body;
            if (!email || !password) {
                return res.status(400).json({ error: "邮箱和密码必填" });
            }

            const [users]: any = await pool.query("SELECT * FROM users WHERE email = ?", [email]);
            if (!users.length) {
                return res.status(401).json({ error: "邮箱或密码错误" });
            }

            const user = users[0];
            const valid = await comparePassword(password, user.password_hash);
            if (!valid) {
                return res.status(401).json({ error: "邮箱或密码错误" });
            }

            const token = generateToken(user.id, user.email);
            res.json({ success: true, token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: "登录失败" });
        }
    });

    // 获取当前用户
    app.get("/api/auth/me", authenticate, async (req, res) => {
        try {
            const [users]: any = await pool.query(
                "SELECT id, email, name, role, created_at FROM users WHERE id = ?",
                [(req as any).user.userId]
            );
            if (!users.length) {
                return res.status(404).json({ error: "用户不存在" });
            }
            res.json(users[0]);
        } catch (error) {
            res.status(500).json({ error: "获取用户信息失败" });
        }
    });

    // ---------- 产品接口 ----------

    // 获取产品列表 (支持过滤)
    app.get("/api/products", async (req, res) => {
        try {
            const { status, category } = req.query;
            let query = "SELECT * FROM products WHERE 1=1";
            const params: any[] = [];

            if (status) {
                query += " AND status = ?";
                params.push(status);
            }
            if (category) {
                query += " AND category = ?";
                params.push(category);
            }

            query += " ORDER BY created_at DESC";
            const [products] = await pool.query(query, params);
            res.json(products);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: "获取产品列表失败" });
        }
    });

    // 获取单个产品
    app.get("/api/products/:id", async (req, res) => {
        try {
            const [products]: any = await pool.query("SELECT * FROM products WHERE id = ?", [req.params.id]);
            if (!products.length) {
                return res.status(404).json({ error: "产品不存在" });
            }
            res.json(products[0]);
        } catch (error) {
            res.status(500).json({ error: "获取产品失败" });
        }
    });

    // 创建产品 (需要管理员)
    app.post("/api/products", authenticate, upload.single("image"), async (req, res) => {
        try {
            const { name, price, description, category, dimensions, material, status } = req.body;
            if (!name || !price) {
                return res.status(400).json({ error: "产品名称和价格必填" });
            }

            const id = Date.now().toString();
            const image_url = req.file ? "/uploads/" + req.file.filename : "";

            await pool.query(
                `INSERT INTO products (id, name, price, description, category, dimensions, material, image_url, status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [id, name, price, description || "", category || "general", dimensions || "", material || "", image_url, status || "draft"]
            );

            res.status(201).json({ success: true, id, image_url });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: "创建产品失败" });
        }
    });

    // 更新产品 (需要管理员)
    app.put("/api/products/:id", authenticate, upload.single("image"), async (req, res) => {
        try {
            const { name, price, description, category, dimensions, material, status } = req.body;
            const id = req.params.id;

            // 如果有新图片
            if (req.file) {
                await pool.query(
                    `UPDATE products SET name=?, price=?, description=?, category=?, dimensions=?, material=?, image_url=?, status=?, updated_at=NOW() WHERE id=?`,
                    [name, price, description || "", category || "general", dimensions || "", material || "", "/uploads/" + req.file.filename, status || "draft", id]
                );
            } else {
                await pool.query(
                    `UPDATE products SET name=?, price=?, description=?, category=?, dimensions=?, material=?, status=?, updated_at=NOW() WHERE id=?`,
                    [name, price, description || "", category || "general", dimensions || "", material || "", status || "draft", id]
                );
            }

            res.json({ success: true });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: "更新产品失败" });
        }
    });

    // 上架/下架产品
    app.patch("/api/products/:id/status", authenticate, async (req, res) => {
        try {
            const { status } = req.body;
            if (!["active", "draft", "archived"].includes(status)) {
                return res.status(400).json({ error: "无效的状态" });
            }

            const [result]: any = await pool.query(
                "UPDATE products SET status = ?, updated_at = NOW() WHERE id = ?",
                [status, req.params.id]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({ error: "产品不存在" });
            }

            res.json({ success: true, status });
        } catch (error) {
            res.status(500).json({ error: "更新状态失败" });
        }
    });

    // 删除产品 (需要管理员)
    app.delete("/api/products/:id", authenticate, async (req, res) => {
        try {
            const [result]: any = await pool.query("DELETE FROM products WHERE id = ?", [req.params.id]);
            if (result.affectedRows === 0) {
                return res.status(404).json({ error: "产品不存在" });
            }
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({ error: "删除产品失败" });
        }
    });

    // ---------- 管理接口 ----------

    // 获取所有用户 (需要管理员)
    app.get("/api/admin/users", authenticate, requireAdmin, async (req, res) => {
        try {
            const [users] = await pool.query("SELECT id, email, name, role, created_at FROM users ORDER BY created_at DESC");
            res.json(users);
        } catch (error) {
            res.status(500).json({ error: "获取用户列表失败" });
        }
    });

    // 获取统计数据 (需要管理员)
    app.get("/api/admin/stats", authenticate, requireAdmin, async (req, res) => {
        try {
            const [products]: any = await pool.query("SELECT COUNT(*) as total FROM products");
            const [activeProducts]: any = await pool.query("SELECT COUNT(*) as active FROM products WHERE status = 'active'");
            const [draftProducts]: any = await pool.query("SELECT COUNT(*) as draft FROM products WHERE status = 'draft'");
            const [users]: any = await pool.query("SELECT COUNT(*) as total FROM users");

            res.json({
                products: { total: products[0].total, active: activeProducts[0].active, draft: draftProducts[0].draft },
                users: users[0].total
            });
        } catch (error) {
            res.status(500).json({ error: "获取统计数据失败" });
        }
    });

    // ---------- 静态文件服务 ----------
    if (!IS_PROD) {
        const vite = await createViteServer({ server: { middlewareMode: true }, appType: "custom" });
        app.use(vite.middlewares);
        app.use("*", async (req, res, next) => {
            const url = req.originalUrl;
            try {
                let filePath;
                if (url.endsWith(".html")) filePath = path.resolve(process.cwd(), url.slice(1));
                else if (url === "/" || url === "/index") filePath = path.resolve(process.cwd(), "index.html");
                else return next();
                if (fs.existsSync(filePath)) {
                    let template = fs.readFileSync(filePath, "utf-8");
                    template = await vite.transformIndexHtml(url, template);
                    res.status(200).set({ "Content-Type": "text/html" }).end(template);
                } else next();
            } catch (e) { vite.ssrFixStacktrace(e as Error); next(e); }
        });
    } else {
        const distPath = path.join(process.cwd(), "dist");
        app.use(express.static(distPath));
        app.get("/:page.html", (req, res, next) => {
            const filePath = path.join(distPath, req.params.page + ".html");
            if (fs.existsSync(filePath)) res.sendFile(filePath);
            else next();
        });
        app.get("*", (req, res) => res.sendFile(path.join(distPath, "index.html")));
    }

    app.use(errorHandler);
    app.listen(PORT, "0.0.0.0", () => {
        console.log("🚀 Server running on http://localhost:" + PORT + " (" + (IS_PROD ? "production" : "development") + ")");
    });
}

startServer().catch(console.error);
