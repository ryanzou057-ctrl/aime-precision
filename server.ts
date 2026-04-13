import express from "express";
import type { Request, Response, NextFunction } from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import mysql from "mysql2/promise"; // <--- 换成了 MySQL
import multer from "multer";
import fs from "fs";
import crypto from "crypto";

const uploadDir = path.join(process.cwd(), "public", "uploads");
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const REQUEST_TIMEOUT = 30000;
const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === "production";

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

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

    host: 'localhost',

    user: 'my_website',

    password: 'b8dfNskrJd2E4tiZ',

    database: 'my_website',

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
        console.error("❌ MySQL 连接失败:", err);
        process.exit(1);
    });
// =================================================

const hashPassword = (password: string) => {
    return crypto.createHash("sha256").update(password).digest("hex");
};

const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error("Error:", err);
    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({ error: "File size exceeds 10MB limit" });
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

async function startServer() {
    const app = express();
    app.use(requestTimeout(REQUEST_TIMEOUT));
    app.use(express.json({ limit: "10mb" }));
    app.use(express.urlencoded({ limit: "10mb", extended: true }));

    app.use("/uploads", express.static(path.join(process.cwd(), "public/uploads")));

    // 注册接口 (改写为 MySQL 异步版)
    app.post("/api/auth/register", async (req, res) => {
        try {
            const { email, password, name } = req.body;
            if (!email || !password) return res.status(400).json({ error: "Email and password are required" });

            const id = Date.now().toString();
            const password_hash = hashPassword(password);

            await pool.query(
                "INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)",
                [id, email, password_hash, name || ""]
            );

            res.status(201).json({ success: true, message: "User registered successfully" });
        } catch (error: any) {
            if (error.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "Email already exists" });
            console.error(error);
            res.status(500).json({ error: "Registration failed" });
        }
    });

    // 創建商品介面 (支援動態 Options 和 Variants)
    app.post("/api/products", upload.single("image"), async (req, res) => {
        try {
            // 接收前端傳來的所有新欄位
            const { name, price, dimensions, material, hardware_finishes, description, options, variants } = req.body;
            const id = Date.now().toString();
            const image_url = req.file ? "/uploads/" + req.file.filename : "";

            const optionsJson = options ? options : null;
            const variantsJson = variants ? variants : null;

            // 插入資料庫
            await pool.query(
                "INSERT INTO products (id, name, price, dimensions, material, hardware_finishes, description, image_url, options, variants) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                [id, name, price, dimensions || "", material || "", hardware_finishes || "", description || "", image_url, optionsJson, variantsJson]
            );

            res.status(201).json({ success: true, id, image_url });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: "Failed to create product" });
        }
    });

    // 后台专用：获取所有用户列表
    app.get("/api/admin/users", async (req, res) => {
        try {
            // 注意：为了安全，后台列表通常不返回密码 (password_hash)
            const [users] = await pool.query("SELECT id, email, name, role, created_at FROM users ORDER BY created_at DESC");
            res.json(users);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: "Failed to fetch users" });
        }
    });

    // 获取商品接口
    app.get("/api/products", async (req, res) => {
        try {
            const [products] = await pool.query("SELECT * FROM products ORDER BY created_at DESC");
            res.json(products);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: "Failed to fetch products" });
        }
    });



    // 删除商品接口
    app.delete("/api/products/:id", async (req, res) => {
        try {
            const [result]: any = await pool.query("DELETE FROM products WHERE id = ?", [req.params.id]);
            if (result.affectedRows === 0) return res.status(404).json({ error: "Product not found" });
            res.json({ success: true });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: "Failed to delete product" });
        }
    });

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