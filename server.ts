import express from "express";
import { createServer as createViteServer } from "vite";
import sqlite3 from "sqlite3";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import dotenv from "dotenv";
import fs from "fs";
import multer from "multer";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import { fileURLToPath } from "url";
import { dirname } from "path";

import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);
const APP_VERSION = "1.2.0";
const REPO_URL = "https://github.com/Shawon244345/bkash-pay.git";

async function ensureGitRepo() {
  try {
    await execAsync("git status");
    // If it's a repo, ensure origin is correct
    await execAsync(`git remote set-url origin ${REPO_URL} || git remote add origin ${REPO_URL}`);
  } catch (e) {
    // If not a repo, initialize it
    await execAsync("git init");
    await execAsync(`git remote add origin ${REPO_URL}`);
    await execAsync("git fetch origin");
    // We don't want to overwrite local changes immediately, so we just set it up
  }
}

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Database Setup
const dbPath = path.join(process.cwd(), "payments.db");
const dbRaw = new sqlite3.Database(dbPath);

const db = {
  run: (sql: string, ...params: any[]) => new Promise<void>((resolve, reject) => {
    dbRaw.run(sql, params, (err) => err ? reject(err) : resolve());
  }),
  get: (sql: string, ...params: any[]) => new Promise<any>((resolve, reject) => {
    dbRaw.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
  }),
  all: (sql: string, ...params: any[]) => new Promise<any[]>((resolve, reject) => {
    dbRaw.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
  }),
  exec: (sql: string) => new Promise<void>((resolve, reject) => {
    dbRaw.exec(sql, (err) => err ? reject(err) : resolve());
  })
};

const logToFile = async (message: string, data: any, level: string = "INFO") => {
  const logEntry = `[${new Date().toISOString()}] ${message}: ${JSON.stringify(data, null, 2)}\n`;
  fs.appendFileSync(path.join(process.cwd(), "debug.log"), logEntry);
  
  try {
    await db.run("INSERT INTO logs (id, level, message, details) VALUES (?, ?, ?, ?)", uuidv4(), level, message, JSON.stringify(data));
  } catch (e) {
    console.error("Failed to write log to DB", e);
  }
};

const auditLog = async (action: string, user: string, details: any) => {
  try {
    await db.run("INSERT INTO audit_logs (id, action, user, details) VALUES (?, ?, ?, ?)", uuidv4(), action, user, typeof details === 'string' ? details : JSON.stringify(details));
  } catch (e) {
    console.error("Failed to write audit log", e);
  }
};

const initDb = async () => {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      payment_id TEXT,
      trx_id TEXT,
      amount REAL,
      status TEXT,
      customer_msisdn TEXT,
      merchant_invoice TEXT,
      merchant_id TEXT,
      payment_mode TEXT DEFAULT 'GLOBAL',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS refunds (
      id TEXT PRIMARY KEY,
      refund_id TEXT,
      original_trx_id TEXT,
      original_payment_id TEXT,
      amount REAL,
      refund_amount REAL,
      status TEXT,
      reason TEXT,
      sku TEXT,
      refund_execution_time DATETIME,
      response_data TEXT,
      ip_address TEXT,
      initiated_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS logs (
      id TEXT PRIMARY KEY,
      level TEXT,
      message TEXT,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      action TEXT,
      user TEXT,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS merchants (
      id TEXT PRIMARY KEY,
      name TEXT,
      email TEXT UNIQUE,
      payment_mode TEXT DEFAULT 'GLOBAL', -- 'OWN' or 'GLOBAL'
      bkash_app_key TEXT,
      bkash_app_secret TEXT,
      bkash_username TEXT,
      bkash_password TEXT,
      api_key TEXT UNIQUE,
      balance REAL DEFAULT 0,
      status TEXT DEFAULT 'ACTIVE', -- 'ACTIVE', 'INACTIVE'
      kyc_status TEXT DEFAULT 'PENDING', -- 'PENDING', 'SUBMITTED', 'VERIFIED', 'REJECTED'
      kyc_details TEXT, -- JSON: { nid, passport, trade_license, contact_number }
      permissions TEXT, -- JSON array of allowed tabs
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS payout_accounts (
      id TEXT PRIMARY KEY,
      merchant_id TEXT,
      type TEXT, -- 'MFS' or 'BANK'
      provider TEXT, -- 'bKash', 'Nagad', 'Rocket', or Bank Name
      account_number TEXT,
      account_name TEXT,
      bank_branch TEXT,
      routing_number TEXT,
      is_default BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (merchant_id) REFERENCES merchants(id)
    );

    CREATE TABLE IF NOT EXISTS withdrawals (
      id TEXT PRIMARY KEY,
      merchant_id TEXT,
      payout_account_id TEXT,
      amount REAL,
      status TEXT DEFAULT 'PENDING', -- 'PENDING', 'APPROVED', 'REJECTED', 'COMPLETED'
      admin_note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (merchant_id) REFERENCES merchants(id),
      FOREIGN KEY (payout_account_id) REFERENCES payout_accounts(id)
    );

    CREATE TABLE IF NOT EXISTS subscription_plans (
      id TEXT PRIMARY KEY,
      name TEXT,
      description TEXT,
      price REAL,
      duration_days INTEGER,
      features TEXT, -- JSON string
      is_active BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY,
      merchant_id TEXT,
      plan_id TEXT,
      status TEXT DEFAULT 'PENDING', -- 'PENDING', 'ACTIVE', 'EXPIRED', 'CANCELLED'
      payment_id TEXT,
      trx_id TEXT,
      start_date DATETIME,
      end_date DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (merchant_id) REFERENCES merchants(id),
      FOREIGN KEY (plan_id) REFERENCES subscription_plans(id)
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE,
      email TEXT,
      password TEXT,
      role TEXT,
      permissions TEXT,
      avatar TEXT,
      merchant_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (merchant_id) REFERENCES merchants(id)
    );
    CREATE TABLE IF NOT EXISTS login_history (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      username TEXT,
      ip_address TEXT,
      user_agent TEXT,
      status TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS system_versions (
      id TEXT PRIMARY KEY,
      version_name TEXT,
      settings_snapshot TEXT,
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Migration for users table to ensure all columns exist
  try { await db.run("ALTER TABLE users ADD COLUMN email TEXT"); } catch (e) {}
  try { await db.run("ALTER TABLE users ADD COLUMN avatar TEXT"); } catch (e) {}
  try { await db.run("ALTER TABLE users ADD COLUMN merchant_id TEXT"); } catch (e) {}

  // Migration for transactions and refunds to include merchant_id
  try { await db.run("ALTER TABLE transactions ADD COLUMN merchant_id TEXT"); } catch (e) {}
  try { await db.run("ALTER TABLE transactions ADD COLUMN payment_mode TEXT DEFAULT 'GLOBAL'"); } catch (e) {}
  try { await db.run("ALTER TABLE refunds ADD COLUMN merchant_id TEXT"); } catch (e) {}
  try { await db.run("ALTER TABLE merchants ADD COLUMN balance REAL DEFAULT 0"); } catch (e) {}

  // Migration for merchants table
  try { await db.run("ALTER TABLE merchants ADD COLUMN kyc_status TEXT DEFAULT 'PENDING'"); } catch (e) {}
  try { await db.run("ALTER TABLE merchants ADD COLUMN kyc_details TEXT"); } catch (e) {}
  try { await db.run("ALTER TABLE merchants ADD COLUMN permissions TEXT"); } catch (e) {}
  try { await db.run("ALTER TABLE merchants ADD COLUMN status TEXT DEFAULT 'ACTIVE'"); } catch (e) {}

  // Seed default credentials if not present
  const seedSettings = [
    { key: 'BKASH_APP_KEY', value: 'cHDSQ3vX2eDv5ZMAPoPNPlnFtc' },
    { key: 'BKASH_APP_SECRET', value: 'V1hSnG1vAsc79MSjyPUC4K0RdOqWyKv28tZPb1Uol8HSRCvwzF83' },
    { key: 'BKASH_USERNAME', value: '01997473177' },
    { key: 'BKASH_PASSWORD', value: 'V9^@JbA_$6x' },
    { key: 'BKASH_BASE_URL', value: 'https://tokenized.pay.bka.sh/v1.2.0-beta' },
    { key: 'APP_URL', value: process.env.APP_URL || "https://ais-dev-zo4o2htltqug2iq63omyd6-115395507089.asia-east1.run.app" },
    { key: 'ADMIN_USERNAME', value: 'admin' },
    { key: 'ADMIN_PASSWORD', value: 'admin123' }
  ];

  for (const s of seedSettings) {
    await db.run("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)", s.key, s.value);
  }

  // Seed default admin user
  const adminUsername = await getSetting("ADMIN_USERNAME", "admin");
  const adminPassword = await getSetting("ADMIN_PASSWORD", "admin123");
  const hashedAdminPassword = await hashPassword(adminPassword);
  const allPermissions = "dashboard,transactions,search,refunds,logs,audit-logs,settings,profile,analytics,customers,security,user-management,statements,withdrawals,subscriptions";
  
  // Check if admin exists
  const existingAdmin = await db.get("SELECT * FROM users WHERE username = ?", adminUsername);
  if (!existingAdmin) {
    await db.run(
      "INSERT INTO users (id, username, email, password, role, permissions) VALUES (?, ?, ?, ?, ?, ?)",
      uuidv4(),
      adminUsername,
      "mohammadshawon24434@gmail.com",
      hashedAdminPassword,
      "admin",
      allPermissions
    );
  } else {
    // Ensure admin has all permissions and hashed password if it's the default one
    if (existingAdmin.password === adminPassword) {
      await db.run("UPDATE users SET password = ? WHERE username = ?", hashedAdminPassword, adminUsername);
    }
    await db.run("UPDATE users SET permissions = ? WHERE username = ?", allPermissions, adminUsername);
  }

  // Update existing merchants with new permissions
  const merchantPermissions = "dashboard,transactions,search,refunds,profile,analytics,customers,statements,settings,api-docs,withdrawals,subscriptions";
  await db.run("UPDATE users SET permissions = ? WHERE role = 'merchant'", merchantPermissions);

  // Update APP_URL to current environment if possible
  if (process.env.APP_URL) {
    await db.run("UPDATE settings SET value = ? WHERE key = 'APP_URL'", process.env.APP_URL);
  }

  // Seed sample transactions if empty
  const txCount = await db.get("SELECT COUNT(*) as count FROM transactions");
  if (txCount.count === 0) {
    const statuses = ['completed', 'completed', 'completed', 'failed', 'initiated', 'refunded'];
    const amounts = [500, 1200, 2500, 150, 3000, 750];
    const msisdns = ['01712345678', '01987654321', '01811223344', '01555667788', '01612344321', '01311223344'];
    
    for (let i = 0; i < 15; i++) {
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      const amount = amounts[Math.floor(Math.random() * amounts.length)];
      const msisdn = msisdns[Math.floor(Math.random() * msisdns.length)];
      const date = new Date();
      date.setDate(date.getDate() - Math.floor(Math.random() * 7));
      
      await db.run(
        "INSERT INTO transactions (id, payment_id, trx_id, amount, status, customer_msisdn, merchant_invoice, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        uuidv4(),
        `PAY-${uuidv4().slice(0, 8)}`,
        status === 'completed' ? `TRX-${uuidv4().slice(0, 8).toUpperCase()}` : null,
        amount,
        status,
        msisdn,
        `INV-100${i}`,
        date.toISOString()
      );
    }
  }
};

export const app = express();
app.set('trust proxy', 1); // Trust first proxy (Nginx/cPanel)
const PORT = Number(process.env.PORT) || 3000;

// Security Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for development ease, or configure properly
}));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again after 15 minutes",
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Silence the validation warnings since we've set trust proxy
  validate: { xForwardedForHeader: false },
});

app.use("/api/", limiter);

const JWT_SECRET = process.env.JWT_SECRET || "bkash-payment-gateway-secret-key-2024";

// Security Helpers
const hashPassword = async (password: string) => {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
};

const comparePassword = async (password: string, hash: string) => {
  return await bcrypt.compare(password, hash);
};

const generateToken = (user: any) => {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role, merchant_id: user.merchant_id },
    JWT_SECRET,
    { expiresIn: "24h" }
  );
};

const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: "Access denied. No token provided." });

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.status(403).json({ error: "Invalid or expired token." });
    req.user = user;
    next();
  });
};

const authorizeRole = (roles: string[]) => {
  return (req: any, res: any, next: any) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Access denied. Insufficient permissions." });
    }
    next();
  };
};

console.log(`Starting server in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);

// Multer Setup for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), "uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

app.use(express.json());
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// Vite setup for development
let vite: any;
if (process.env.NODE_ENV !== "production") {
  const { createServer: createViteServer } = await import("vite");
  vite = await createViteServer({
    root: __dirname,
    server: { 
      middlewareMode: true,
      hmr: false
    },
    appType: "custom",
  });
  app.use(vite.middlewares);
}

// Static fallback for production
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.resolve(process.cwd(), "dist")));
}

// Security API
app.get("/api/admin/security/settings", authenticateToken, async (req, res) => {
  try {
    const twoFactor = await getSetting("SECURITY_2FA_ENABLED", "false");
    const ipWhitelisting = await getSetting("SECURITY_IP_WHITELISTING_ENABLED", "false");
    res.json({
      twoFactor: twoFactor === "true",
      ipWhitelisting: ipWhitelisting === "true"
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch security settings" });
  }
});

app.post("/api/admin/security/settings", authenticateToken, async (req, res) => {
  const { twoFactor, ipWhitelisting } = req.body;
  try {
    if (twoFactor !== undefined) {
      await db.run("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", "SECURITY_2FA_ENABLED", String(twoFactor));
    }
    if (ipWhitelisting !== undefined) {
      await db.run("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", "SECURITY_IP_WHITELISTING_ENABLED", String(ipWhitelisting));
    }
    await auditLog("SECURITY_SETTINGS_UPDATE", (req as any).user.username, { twoFactor, ipWhitelisting });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to update security settings" });
  }
});

app.get("/api/admin/security/logins", authenticateToken, async (req, res) => {
  try {
    const logins = await db.all("SELECT * FROM login_history ORDER BY created_at DESC LIMIT 10");
    res.json(logins);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch login history" });
  }
});

// System Versioning API
app.get("/api/admin/system/versions", authenticateToken, async (req, res) => {
  try {
    const versions = await db.all("SELECT * FROM system_versions ORDER BY created_at DESC");
    res.json(versions);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch system versions" });
  }
});

app.post("/api/admin/system/versions", authenticateToken, async (req, res) => {
  const { name } = req.body;
  try {
    const settings = await db.all("SELECT * FROM settings");
    const snapshot = JSON.stringify(settings);
    const id = uuidv4();
    await db.run(
      "INSERT INTO system_versions (id, version_name, settings_snapshot, created_by) VALUES (?, ?, ?, ?)",
      id, name || `Version ${new Date().toLocaleString()}`, snapshot, (req as any).user.username
    );
    await auditLog("SYSTEM_VERSION_CREATE", (req as any).user.username, { id, name });
    res.json({ success: true, id });
  } catch (error) {
    res.status(500).json({ error: "Failed to create system version" });
  }
});

app.post("/api/admin/system/versions/:id/restore", authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const version = await db.get("SELECT * FROM system_versions WHERE id = ?", id);
    if (!version) return res.status(404).json({ error: "Version not found" });

    const settings = JSON.parse(version.settings_snapshot);
    
    // Begin transaction for safety
    await db.run("BEGIN TRANSACTION");
    try {
      // We don't delete all settings, we update/insert from snapshot
      for (const s of settings) {
        await db.run("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", s.key, s.value);
      }
      await db.run("COMMIT");
      await auditLog("SYSTEM_VERSION_RESTORE", (req as any).user.username, { id, name: version.version_name });
      res.json({ success: true });
    } catch (e) {
      await db.run("ROLLBACK");
      throw e;
    }
  } catch (error) {
    res.status(500).json({ error: "Failed to restore system version" });
  }
});

app.delete("/api/admin/system/versions/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    await db.run("DELETE FROM system_versions WHERE id = ?", id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete system version" });
  }
});

app.get("/api/admin/system/git-log", authenticateToken, async (req, res) => {
  try {
    const { exec } = await import("child_process");
    const { promisify } = await import("util");
    const execAsync = promisify(exec);
    
    const { stdout } = await execAsync('git log -n 10 --pretty=format:"%h - %an, %ar : %s"');
    const logs = stdout.split("\n").filter(Boolean);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch git logs" });
  }
});

// bKash Helpers
const getSetting = async (key: string, defaultValue: string = "") => {
  // Prefer environment variables for easier configuration on platforms like Vercel
  if (process.env[key]) return process.env[key];
  const row = await db.get("SELECT value FROM settings WHERE key = ?", key);
  return row ? row.value : defaultValue;
};

const getBkashHeaders = async (merchantId?: string) => {
  let appKey, appSecret, username, password;

  if (merchantId) {
    const merchant = await db.get("SELECT * FROM merchants WHERE id = ?", merchantId);
    if (merchant && merchant.payment_mode === 'OWN') {
      appKey = merchant.bkash_app_key;
      appSecret = merchant.bkash_app_secret;
      username = merchant.bkash_username;
      password = merchant.bkash_password;
    }
  }

  // Fallback to global settings if not merchant-specific or mode is GLOBAL
  if (!appKey) appKey = await getSetting("BKASH_APP_KEY");
  if (!appSecret) appSecret = await getSetting("BKASH_APP_SECRET");
  if (!username) username = await getSetting("BKASH_USERNAME");
  if (!password) password = await getSetting("BKASH_PASSWORD");

  const baseUrl = await getSetting("BKASH_BASE_URL");

  const { data } = await axios.post(
    `${baseUrl}/tokenized/checkout/token/grant`,
    {
      app_key: appKey,
      app_secret: appSecret,
    },
    {
      headers: {
        username: username,
        password: password,
      },
    }
  );
  await logToFile("bKash Token Response", data);
  return {
    "Content-Type": "application/json",
    Authorization: data.id_token,
    "X-APP-Key": appKey,
  };
};

// API Routes
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", mode: process.env.NODE_ENV || 'development' });
});

app.post("/api/bkash/create-payment", async (req, res) => {
  try {
    const { amount, invoice, merchantId } = req.body;
    const headers = await getBkashHeaders(merchantId);
    const baseUrl = await getSetting("BKASH_BASE_URL");
    const appUrl = await getSetting("APP_URL");
    
    const { data } = await axios.post(
      `${baseUrl}/tokenized/checkout/create`,
      {
        mode: "0011",
        payerReference: invoice || `INV-${Date.now()}`,
        callbackURL: `${appUrl}/api/bkash/callback?mid=${merchantId || ''}`,
        amount: amount.toString(),
        currency: "BDT",
        intent: "sale",
        merchantInvoiceNumber: invoice || `INV-${Date.now()}`,
      },
      { headers }
    );

    console.log("bKash Create Response:", data);
    await logToFile("bKash Create Response", data);

    if (data.paymentID && data.bkashURL) {
      let paymentMode = 'GLOBAL';
      if (merchantId) {
        const merchant = await db.get("SELECT payment_mode FROM merchants WHERE id = ?", merchantId);
        if (merchant) paymentMode = merchant.payment_mode;
      }
      
      await db.run(
        "INSERT INTO transactions (id, payment_id, amount, status, merchant_invoice, merchant_id, payment_mode) VALUES (?, ?, ?, ?, ?, ?, ?)", 
        uuidv4(), data.paymentID, amount, "initiated", invoice, merchantId, paymentMode
      );
      
      res.json({ bkashURL: data.bkashURL });
    } else {
      res.status(400).json({ error: data.statusMessage || "Failed to create payment" });
    }
  } catch (error: any) {
    console.error("bKash Create Error:", error.response?.data || error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/api/bkash/callback", async (req, res) => {
  const { paymentID, status, mid } = req.query;
  const merchantId = mid as string;
  await logToFile("bKash Callback Received", { paymentID, status, merchantId });

  if (!paymentID) {
    return res.redirect("/payment-failed?error=missing_payment_id");
  }

  if (status === "success") {
    try {
      const headers = await getBkashHeaders(merchantId);
      const baseUrl = await getSetting("BKASH_BASE_URL");
      
      const { data } = await axios.post(
        `${baseUrl}/tokenized/checkout/execute`,
        { paymentID },
        { headers }
      );

      await logToFile("bKash Execute Response", data);

      if (data.statusCode === "0000") {
        await db.run("UPDATE transactions SET status = ?, trx_id = ?, customer_msisdn = ?, updated_at = CURRENT_TIMESTAMP WHERE payment_id = ?", "completed", data.trxID, data.customerMsisdn, paymentID);
        
        // Update merchant balance if using GLOBAL mode
        if (merchantId) {
          const merchant = await db.get("SELECT payment_mode FROM merchants WHERE id = ?", merchantId);
          if (merchant && merchant.payment_mode === 'GLOBAL') {
            await db.run("UPDATE merchants SET balance = balance + ? WHERE id = ?", data.amount, merchantId);
            await auditLog("BALANCE_INCREMENT", "system", `Merchant ${merchantId} balance increased by ${data.amount} for payment ${paymentID}`);
          }
        }

        const params = new URLSearchParams({
          trxID: data.trxID,
          amount: data.amount,
          customer: data.customerMsisdn || "",
          invoice: data.merchantInvoiceNumber || "",
          time: data.paymentExecuteTime || new Date().toISOString()
        });
        return res.redirect(`/payment-success?${params.toString()}`);
      } else {
        await db.run("UPDATE transactions SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE payment_id = ?", "failed", paymentID);
        return res.redirect("/payment-failed?error=" + (data.statusMessage || "Execution failed"));
      }
    } catch (error: any) {
      await logToFile("bKash Execute Error", error.response?.data || error.message);
      return res.redirect("/payment-failed?error=execution_api_error");
    }
  }
  
  // Handle cancel, failure, or other statuses
  await db.run("UPDATE transactions SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE payment_id = ?", status || "failed", paymentID);
    
  res.redirect("/payment-failed?status=" + (status || "unknown"));
});

app.post("/api/admin/login", async (req, res) => {
  const { username, password } = req.body;
  
  try {
    const user = await db.get("SELECT * FROM users WHERE username = ? OR email = ?", username, username);

    if (user && await comparePassword(password, user.password)) {
      let merchant = null;
      if (user.merchant_id) {
        merchant = await db.get("SELECT * FROM merchants WHERE id = ?", user.merchant_id);
      }

      const token = generateToken(user);
      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];
      await db.run(
        "INSERT INTO login_history (id, user_id, username, ip_address, user_agent, status) VALUES (?, ?, ?, ?, ?, ?)",
        uuidv4(), user.id, user.username, ip, userAgent, "SUCCESS"
      );
      await auditLog("LOGIN_SUCCESS", user.username, "User logged in successfully");
      res.json({ 
        success: true, 
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          avatar: user.avatar,
          merchant_id: user.merchant_id,
          merchant: merchant,
          permissions: user.permissions.split(",")
        }
      });
    } else {
      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];
      await db.run(
        "INSERT INTO login_history (id, username, ip_address, user_agent, status) VALUES (?, ?, ?, ?, ?)",
        uuidv4(), username, ip, userAgent, "FAILED"
      );
      await auditLog("LOGIN_FAILED", username, "Invalid login attempt");
      res.status(401).json({ error: "Invalid credentials" });
    }
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/user/profile", authenticateToken, async (req: any, res) => {
  try {
    const user = await db.get("SELECT id, username, email, role, permissions, avatar, merchant_id FROM users WHERE id = ?", req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    
    let merchant = null;
    if (user.merchant_id) {
      merchant = await db.get("SELECT * FROM merchants WHERE id = ?", user.merchant_id);
    }
    
    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      merchant_id: user.merchant_id,
      merchant: merchant,
      permissions: user.permissions.split(",")
    });
  } catch (error) {
    console.error("Profile fetch error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/merchant/register", async (req, res) => {
  const { name, email, password } = req.body;
  
  try {
    const existingUser = await db.get("SELECT * FROM users WHERE email = ?", email);
    if (existingUser) {
      return res.status(400).json({ error: "Email already registered" });
    }

    const merchantId = uuidv4();
    const userId = uuidv4();
    const apiKey = `bk_${uuidv4().replace(/-/g, '')}`;
    const hashedPassword = await hashPassword(password);

    await db.run(
      "INSERT INTO merchants (id, name, email, api_key) VALUES (?, ?, ?, ?)",
      merchantId, name, email, apiKey
    );

    const permissions = "dashboard,transactions,search,refunds,profile,analytics,customers,statements,settings,api-docs,withdrawals,subscriptions";
    await db.run(
      "INSERT INTO users (id, username, email, password, role, permissions, merchant_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
      userId, email, email, hashedPassword, "merchant", permissions, merchantId
    );

    res.json({ success: true, message: "Merchant registered successfully" });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/merchant/settings", authenticateToken, authorizeRole(['merchant', 'admin']), async (req: any, res) => {
  const merchantId = req.user.merchant_id;
  if (!merchantId) return res.status(400).json({ error: "Not a merchant account" });
  
  try {
    const merchant = await db.get("SELECT * FROM merchants WHERE id = ?", merchantId);
    res.json(merchant);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch settings" });
  }
});

app.post("/api/merchant/settings", authenticateToken, authorizeRole(['merchant', 'admin']), async (req: any, res) => {
  const merchantId = req.user.merchant_id;
  if (!merchantId) return res.status(400).json({ error: "Not a merchant account" });
  
  const { payment_mode, bkash_app_key, bkash_app_secret, bkash_username, bkash_password } = req.body;
  try {
    await db.run(
      "UPDATE merchants SET payment_mode = ?, bkash_app_key = ?, bkash_app_secret = ?, bkash_username = ?, bkash_password = ? WHERE id = ?",
      payment_mode, bkash_app_key, bkash_app_secret, bkash_username, bkash_password, merchantId
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to update settings" });
  }
});

// Payout Accounts
app.get("/api/merchant/payout-accounts", authenticateToken, authorizeRole(['merchant', 'admin']), async (req: any, res) => {
  const merchantId = req.user.merchant_id;
  if (!merchantId) return res.status(400).json({ error: "Not a merchant account" });

  try {
    const accounts = await db.all("SELECT * FROM payout_accounts WHERE merchant_id = ?", merchantId);
    res.json(accounts);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch payout accounts" });
  }
});

app.post("/api/merchant/payout-accounts", authenticateToken, authorizeRole(['merchant', 'admin']), async (req: any, res) => {
  const merchantId = req.user.merchant_id;
  if (!merchantId) return res.status(400).json({ error: "Not a merchant account" });

  const { type, provider, account_number, account_name, bank_branch, routing_number } = req.body;
  try {
    const id = uuidv4();
    await db.run(
      "INSERT INTO payout_accounts (id, merchant_id, type, provider, account_number, account_name, bank_branch, routing_number) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      id, merchantId, type, provider, account_number, account_name, bank_branch, routing_number
    );
    res.json({ success: true, id });
  } catch (error) {
    res.status(500).json({ error: "Failed to add payout account" });
  }
});

app.delete("/api/merchant/payout-accounts/:id", authenticateToken, authorizeRole(['merchant', 'admin']), async (req: any, res) => {
  const { id } = req.params;
  const merchantId = req.user.merchant_id;
  if (!merchantId) return res.status(400).json({ error: "Not a merchant account" });

  try {
    await db.run("DELETE FROM payout_accounts WHERE id = ? AND merchant_id = ?", id, merchantId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete payout account" });
  }
});

// Withdrawals
app.get("/api/merchant/withdrawals", authenticateToken, authorizeRole(['merchant', 'admin']), async (req: any, res) => {
  const merchantId = req.user.merchant_id;
  if (!merchantId) return res.status(400).json({ error: "Not a merchant account" });

  try {
    const withdrawals = await db.all(
      "SELECT w.*, p.account_number, p.provider FROM withdrawals w JOIN payout_accounts p ON w.payout_account_id = p.id WHERE w.merchant_id = ? ORDER BY w.created_at DESC",
      merchantId
    );
    res.json(withdrawals);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch withdrawals" });
  }
});

app.post("/api/merchant/withdrawals", authenticateToken, authorizeRole(['merchant', 'admin']), async (req: any, res) => {
  const merchantId = req.user.merchant_id;
  if (!merchantId) return res.status(400).json({ error: "Not a merchant account" });

  const { payout_account_id, amount } = req.body;
  try {
    const merchant = await db.get("SELECT balance FROM merchants WHERE id = ?", merchantId);
    if (!merchant || merchant.balance < amount) {
      return res.status(400).json({ error: "Insufficient balance" });
    }
    
    const id = uuidv4();
    await db.exec("BEGIN TRANSACTION");
    try {
      await db.run("UPDATE merchants SET balance = balance - ? WHERE id = ?", amount, merchantId);
      await db.run("INSERT INTO withdrawals (id, merchant_id, payout_account_id, amount) VALUES (?, ?, ?, ?)", id, merchantId, payout_account_id, amount);
      await db.exec("COMMIT");
      res.json({ success: true, id });
    } catch (e) {
      await db.exec("ROLLBACK");
      res.status(500).json({ error: "Withdrawal failed" });
    }
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Admin Withdrawal Management
app.get("/api/admin/withdrawals", authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const withdrawals = await db.all(
      "SELECT w.*, m.name as merchant_name, p.account_number, p.provider, p.type as account_type, p.account_name, p.bank_branch, p.routing_number FROM withdrawals w JOIN merchants m ON w.merchant_id = m.id JOIN payout_accounts p ON w.payout_account_id = p.id ORDER BY w.created_at DESC"
    );
    res.json(withdrawals);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch withdrawals" });
  }
});

app.post("/api/admin/withdrawals/status", authenticateToken, authorizeRole(['admin']), async (req, res) => {
  const { id, status, admin_note } = req.body;
  try {
    const withdrawal = await db.get("SELECT * FROM withdrawals WHERE id = ?", id);
    if (!withdrawal) return res.status(404).json({ error: "Withdrawal not found" });

    if (status === 'REJECTED' && withdrawal.status !== 'REJECTED') {
      // Refund balance to merchant
      await db.run("UPDATE merchants SET balance = balance + ? WHERE id = ?", withdrawal.amount, withdrawal.merchant_id);
    }

    await db.run("UPDATE withdrawals SET status = ?, admin_note = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", status, admin_note, id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to update withdrawal status" });
  }
});

// Subscription Plans
app.get("/api/subscription-plans", async (req, res) => {
  try {
    const plans = await db.all("SELECT * FROM subscription_plans WHERE is_active = 1");
    res.json(plans);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch plans" });
  }
});

app.post("/api/admin/subscription-plans", authenticateToken, authorizeRole(['admin']), async (req, res) => {
  const { name, description, price, duration_days, features } = req.body;
  try {
    const id = uuidv4();
    await db.run(
      "INSERT INTO subscription_plans (id, name, description, price, duration_days, features) VALUES (?, ?, ?, ?, ?, ?)",
      id, name, description, price, duration_days, JSON.stringify(features)
    );
    res.json({ success: true, id });
  } catch (error) {
    res.status(500).json({ error: "Failed to create plan" });
  }
});

// Merchant Subscriptions
app.get("/api/merchant/subscription", authenticateToken, authorizeRole(['merchant', 'admin']), async (req: any, res) => {
  const merchantId = req.user.merchant_id;
  if (!merchantId) return res.status(400).json({ error: "Not a merchant account" });

  try {
    const sub = await db.get(
      "SELECT s.*, p.name as plan_name FROM subscriptions s JOIN subscription_plans p ON s.plan_id = p.id WHERE s.merchant_id = ? AND s.status = 'ACTIVE' ORDER BY s.created_at DESC LIMIT 1",
      merchantId
    );
    res.json(sub || null);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch subscription" });
  }
});

app.post("/api/merchant/subscribe", authenticateToken, authorizeRole(['merchant', 'admin']), async (req: any, res) => {
  const merchantId = req.user.merchant_id;
  if (!merchantId) return res.status(400).json({ error: "Not a merchant account" });

  const { planId } = req.body;
  try {
    const plan = await db.get("SELECT * FROM subscription_plans WHERE id = ?", planId);
    if (!plan) return res.status(404).json({ error: "Plan not found" });

    const headers = await getBkashHeaders(); // Use Super Admin credentials
    const baseUrl = await getSetting("BKASH_BASE_URL");
    const appUrl = await getSetting("APP_URL");
    
    const invoice = `SUB-${Date.now()}`;
    const { data } = await axios.post(
      `${baseUrl}/tokenized/checkout/create`,
      {
        mode: "0011",
        payerReference: merchantId,
        callbackURL: `${appUrl}/api/bkash/subscription-callback?mid=${merchantId}&pid=${planId}`,
        amount: plan.price.toString(),
        currency: "BDT",
        intent: "sale",
        merchantInvoiceNumber: invoice,
      },
      { headers }
    );

    if (data.paymentID && data.bkashURL) {
      await db.run(
        "INSERT INTO subscriptions (id, merchant_id, plan_id, status, payment_id) VALUES (?, ?, ?, ?, ?)",
        uuidv4(), merchantId, planId, 'PENDING', data.paymentID
      );
      res.json({ bkashURL: data.bkashURL });
    } else {
      res.status(400).json({ error: data.statusMessage || "Failed to initiate subscription payment" });
    }
  } catch (error: any) {
    console.error("Subscription Error:", error.response?.data || error.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/bkash/subscription-callback", async (req, res) => {
  const { paymentID, status, mid, pid } = req.query;
  const merchantId = mid as string;
  const planId = pid as string;

  if (status === "success") {
    try {
      const headers = await getBkashHeaders();
      const baseUrl = await getSetting("BKASH_BASE_URL");
      
      const { data } = await axios.post(
        `${baseUrl}/tokenized/checkout/execute`,
        { paymentID },
        { headers }
      );

      if (data.statusCode === "0000") {
        const plan = await db.get("SELECT duration_days FROM subscription_plans WHERE id = ?", planId);
        await db.run(
          "UPDATE subscriptions SET status = 'ACTIVE', trx_id = ?, start_date = CURRENT_TIMESTAMP, end_date = datetime('now', '+' || ? || ' days') WHERE payment_id = ?",
          data.trxID, plan.duration_days, paymentID
        );
        
        await auditLog("SUBSCRIPTION_SUCCESS", merchantId, `Merchant subscribed to plan ${planId}`);
        return res.redirect(`/admin/subscriptions?status=success&plan=${planId}`);
      }
    } catch (error) {
      console.error("Subscription Execution Error:", error);
    }
  }
  
  await db.run("UPDATE subscriptions SET status = 'FAILED' WHERE payment_id = ?", paymentID);
  res.redirect("/admin/subscriptions?status=failed");
});

app.get("/api/admin/merchant-subscriptions", authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const subs = await db.all(
      "SELECT s.*, m.name as merchant_name, m.email as merchant_email, p.name as plan_name, p.price FROM subscriptions s JOIN merchants m ON s.merchant_id = m.id JOIN subscription_plans p ON s.plan_id = p.id ORDER BY s.created_at DESC"
    );
    res.json(subs);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch merchant subscriptions" });
  }
});

app.post("/api/admin/forgot-password", async (req, res) => {
  const { email } = req.body;
  try {
    const user = await db.get("SELECT * FROM users WHERE email = ?", email);
    if (user) {
      // In a real app, send email with a secure token.
      await auditLog("FORGOT_PASSWORD_REQUEST", email, "Password reset requested");
    }
    // Always return the same message to prevent user enumeration
    res.json({ message: "If an account exists with that email, password reset instructions have been sent." });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/admin/update-credentials", authenticateToken, authorizeRole(['admin']), async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required" });
  }

  try {
    const hashedPassword = await hashPassword(password);
    await db.exec("BEGIN TRANSACTION");
    await db.run("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", "ADMIN_USERNAME", username);
    await db.run("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", "ADMIN_PASSWORD", password); // Keep raw in settings for installer/re-init if needed, but users table is hashed
    await db.run("UPDATE users SET username = ?, password = ? WHERE role = 'admin'", username, hashedPassword);
    await db.exec("COMMIT");
    
    await auditLog("CREDENTIALS_UPDATE", username, "Admin credentials updated");
    res.json({ message: "Credentials updated successfully" });
  } catch (e) {
    await db.exec("ROLLBACK");
    res.status(500).json({ error: "Failed to update credentials" });
  }
});

// --- Merchant Management API ---

app.get("/api/admin/merchants", authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const merchants = await db.all("SELECT * FROM merchants ORDER BY created_at DESC");
    res.json(merchants);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch merchants" });
  }
});

app.post("/api/admin/merchants/status", authenticateToken, authorizeRole(['admin']), async (req, res) => {
  const { id, status } = req.body;
  try {
    await db.run("UPDATE merchants SET status = ? WHERE id = ?", status, id);
    await auditLog("MERCHANT_STATUS_UPDATE", "admin", { id, status });
    res.json({ message: "Merchant status updated" });
  } catch (error) {
    res.status(500).json({ error: "Failed to update merchant status" });
  }
});

app.post("/api/admin/merchants/permissions", authenticateToken, authorizeRole(['admin']), async (req, res) => {
  const { id, permissions } = req.body;
  try {
    await db.run("UPDATE merchants SET permissions = ? WHERE id = ?", JSON.stringify(permissions), id);
    // Also update the user permissions for the merchant
    await db.run("UPDATE users SET permissions = ? WHERE merchant_id = ?", permissions.join(','), id);
    await auditLog("MERCHANT_PERMISSIONS_UPDATE", "admin", { id, permissions });
    res.json({ message: "Merchant permissions updated" });
  } catch (error) {
    res.status(500).json({ error: "Failed to update merchant permissions" });
  }
});

app.post("/api/admin/merchants/kyc-verify", authenticateToken, authorizeRole(['admin']), async (req, res) => {
  const { id, status } = req.body;
  try {
    await db.run("UPDATE merchants SET kyc_status = ? WHERE id = ?", status, id);
    await auditLog("MERCHANT_KYC_VERIFY", "admin", { id, status });
    res.json({ message: "Merchant KYC status updated" });
  } catch (error) {
    res.status(500).json({ error: "Failed to update KYC status" });
  }
});

app.get("/api/merchant/kyc", authenticateToken, authorizeRole(['merchant', 'admin']), async (req: any, res) => {
  const merchantId = req.user.merchant_id;
  if (!merchantId) return res.status(400).json({ error: "Not a merchant account" });

  try {
    const merchant = await db.get("SELECT kyc_status, kyc_details FROM merchants WHERE id = ?", merchantId);
    res.json(merchant);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch KYC status" });
  }
});

app.post("/api/merchant/kyc", authenticateToken, authorizeRole(['merchant', 'admin']), async (req: any, res) => {
  const merchantId = req.user.merchant_id;
  if (!merchantId) return res.status(400).json({ error: "Not a merchant account" });

  const { details } = req.body;
  try {
    await db.run("UPDATE merchants SET kyc_status = 'SUBMITTED', kyc_details = ? WHERE id = ?", JSON.stringify(details), merchantId);
    await auditLog("MERCHANT_KYC_SUBMIT", merchantId, details);
    res.json({ message: "KYC submitted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to submit KYC" });
  }
});
app.get("/api/admin/stats", authenticateToken, async (req: any, res) => {
  const { merchantId } = req.query;
  const user = req.user;

  // If merchant, they can only see their own stats
  if (user.role === 'merchant' && merchantId !== user.merchant_id) {
    return res.status(403).json({ error: "Access denied. You can only view your own stats." });
  }

  // If admin, they can see everything, but if they provide a merchantId, it filters
  const effectiveMerchantId = user.role === 'merchant' ? user.merchant_id : merchantId;

  try {
    let volumeQuery = "SELECT SUM(amount) as total FROM transactions WHERE status = 'completed'";
    let successCountQuery = "SELECT COUNT(*) as count FROM transactions WHERE status = 'completed'";
    let failedCountQuery = "SELECT COUNT(*) as count FROM transactions WHERE status = 'FAILED'";
    let totalCountQuery = "SELECT COUNT(*) as count FROM transactions";
    let recentQuery = "SELECT * FROM transactions ORDER BY created_at DESC LIMIT 10";
    let activityQuery = "SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 5";
    const params: any[] = [];

    if (effectiveMerchantId) {
      volumeQuery += " AND merchant_id = ?";
      successCountQuery += " AND merchant_id = ?";
      failedCountQuery += " AND merchant_id = ?";
      totalCountQuery += " WHERE merchant_id = ?";
      recentQuery = "SELECT * FROM transactions WHERE merchant_id = ? ORDER BY created_at DESC LIMIT 10";
      activityQuery = "SELECT * FROM audit_logs WHERE user = ? OR details LIKE ? ORDER BY created_at DESC LIMIT 5";
      params.push(effectiveMerchantId);
    }

    const totalVolume = await db.get(volumeQuery, ...params);
    const successCount = await db.get(successCountQuery, ...params);
    const failedCount = await db.get(failedCountQuery, ...params);
    const totalCount = await db.get(totalCountQuery, ...params);
    const recentTransactions = await db.all(recentQuery, ...params);
    
    let userActivity = [];
    if (merchantId) {
      userActivity = await db.all(activityQuery, merchantId, `%${merchantId}%`);
    } else {
      userActivity = await db.all(activityQuery);
    }

    res.json({
      totalVolume: totalVolume?.total || 0,
      successCount: successCount?.count || 0,
      failedCount: failedCount?.count || 0,
      totalCount: totalCount?.count || 0,
      recentTransactions,
      userActivity
    });
  } catch (error) {
    console.error("Stats Fetch Error:", error);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

app.get("/api/admin/transactions", authenticateToken, async (req: any, res) => {
  const { start_date, end_date, search, merchantId } = req.query;
  const user = req.user;

  if (user.role === 'merchant' && merchantId !== user.merchant_id) {
    return res.status(403).json({ error: "Access denied." });
  }

  const effectiveMerchantId = user.role === 'merchant' ? user.merchant_id : merchantId;

  try {
    let query = "SELECT * FROM transactions WHERE 1=1";
    const params: any[] = [];

    if (effectiveMerchantId) {
      query += " AND merchant_id = ?";
      params.push(effectiveMerchantId);
    }
    if (start_date) {
      query += " AND DATE(created_at) >= DATE(?)";
      params.push(start_date);
    }
    if (end_date) {
      query += " AND DATE(created_at) <= DATE(?)";
      params.push(end_date);
    }
    if (search) {
      query += " AND (trx_id LIKE ? OR merchant_invoice LIKE ? OR customer_msisdn LIKE ?)";
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam, searchParam);
    }

    query += " ORDER BY created_at DESC";
    const transactions = await db.all(query, ...params);
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
});

app.get("/api/admin/refunds", authenticateToken, async (req: any, res) => {
  const { merchantId } = req.query;
  const user = req.user;

  if (user.role === 'merchant' && merchantId && merchantId !== user.merchant_id) {
    return res.status(403).json({ error: "Access denied." });
  }

  const effectiveMerchantId = user.role === 'merchant' ? user.merchant_id : merchantId;

  try {
    let query = "SELECT * FROM refunds WHERE 1=1";
    const params: any[] = [];

    if (effectiveMerchantId) {
      query += " AND merchant_id = ?";
      params.push(effectiveMerchantId);
    }

    query += " ORDER BY refund_execution_time DESC";
    const refunds = await db.all(query, ...params);
    res.json(refunds);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch refunds" });
  }
});

app.get("/api/admin/settings", authenticateToken, authorizeRole(['admin']), async (req, res) => {
  const keys = ["BKASH_APP_KEY", "BKASH_APP_SECRET", "BKASH_USERNAME", "BKASH_PASSWORD", "BKASH_BASE_URL", "APP_URL"];
  const settings: any = {};
  for (const key of keys) {
    settings[key] = await getSetting(key);
  }
  res.json(settings);
});

app.post("/api/admin/settings", authenticateToken, authorizeRole(['admin']), async (req, res) => {
  const settings = req.body;
  
  try {
    await db.exec("BEGIN TRANSACTION");
    for (const [key, value] of Object.entries(settings)) {
      await db.run("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", key, value);
    }
    await db.exec("COMMIT");
    
    await auditLog("SETTINGS_UPDATE", "admin", "System settings updated");
    res.json({ message: "Settings updated successfully" });
  } catch (e) {
    await db.exec("ROLLBACK");
    res.status(500).json({ error: "Failed to update settings" });
  }
});

app.post("/api/bkash/refund", authenticateToken, async (req: any, res) => {
  try {
    const { paymentID, trxID, amount, sku, reason } = req.body;
    const user = req.user;
    const ip = req.ip || req.headers['x-forwarded-for'] || "";
    const initiated_by = user.username;
    
    // Check transaction ownership and mode
    const transaction = await db.get("SELECT merchant_id, payment_mode FROM transactions WHERE trx_id = ?", trxID);
    
    if (!transaction) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    // Strict rule: Super Admin cannot refund ANY transaction belonging to a merchant
    if (user.role === 'admin' && transaction.merchant_id) {
      return res.status(403).json({ 
        error: "Super Admin is restricted from refunding merchant transactions. Merchants must handle their own refunds." 
      });
    }

    // If it's a merchant trying to refund, ensure they own the transaction
    if (user.role === 'merchant' && transaction.merchant_id !== user.merchant_id) {
      return res.status(403).json({ error: "Unauthorized: You can only refund your own transactions." });
    }

    // Check if already refunded
    const existing = await db.get("SELECT * FROM refunds WHERE original_trx_id = ? AND status = 'COMPLETED'", trxID);
    if (existing) {
      return res.status(400).json({ error: "This transaction has already been refunded" });
    }

    const headers = await getBkashHeaders();
    const baseUrl = await getSetting("BKASH_BASE_URL");
    
    let responseData;
    try {
      const { data } = await axios.post(
        `${baseUrl}/tokenized/checkout/payment/refund`,
        {
          paymentID,
          amount: amount.toString(),
          trxID,
          sku: sku || "REFUND",
          reason: reason || "Customer requested refund"
        },
        { headers }
      );
      responseData = data;
    } catch (apiError: any) {
      responseData = apiError.response?.data || { statusMessage: apiError.message };
      await logToFile("bKash Refund API Error", responseData);
    }

    const status = responseData.refundTrxID ? "COMPLETED" : "FAILED";
    const refundID = responseData.refundTrxID || `FAIL-${uuidv4().slice(0, 8)}`;
    const executionTime = responseData.completedTime || null;

    await db.run(`
      INSERT INTO refunds (id, refund_id, original_trx_id, original_payment_id, amount, refund_amount, status, reason, sku, refund_execution_time, response_data, ip_address, initiated_by, merchant_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      uuidv4(),
      refundID,
      trxID,
      paymentID,
      amount,
      responseData.amount || amount,
      status,
      reason,
      sku,
      executionTime,
      JSON.stringify(responseData),
      ip,
      initiated_by,
      transaction.merchant_id
    );

    if (status === "COMPLETED") {
      // Update original transaction status to refunded
      await db.run("UPDATE transactions SET status = 'refunded', updated_at = CURRENT_TIMESTAMP WHERE trx_id = ?", trxID);
      await auditLog("REFUND_SUCCESS", initiated_by, { trxID, amount, refundID });
      res.json({ message: "Refund processed successfully", refundID });
    } else {
      await auditLog("REFUND_FAILED", initiated_by, { trxID, amount, error: responseData.statusMessage });
      res.status(400).json({ error: responseData.statusMessage || "Refund failed" });
    }
  } catch (error: any) {
    console.error("Refund Error:", error.response?.data || error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/api/bkash/search-transaction", authenticateToken, async (req: any, res) => {
  try {
    const { trxID } = req.body;
    const user = req.user;

    if (!trxID) {
      return res.status(400).json({ error: "trxID is required" });
    }

    // If merchant, check ownership
    if (user.role === 'merchant') {
      const transaction = await db.get("SELECT merchant_id FROM transactions WHERE trx_id = ?", trxID);
      if (transaction && transaction.merchant_id !== user.merchant_id) {
        return res.status(403).json({ error: "Access denied." });
      }
    }

    const headers = await getBkashHeaders();
    const baseUrl = await getSetting("BKASH_BASE_URL");

    const { data } = await axios.post(
      `${baseUrl}/tokenized/checkout/general/searchTransaction`,
      { trxID },
      { headers }
    );

    await logToFile("bKash Search Transaction Response", data);
    res.json(data);
  } catch (error: any) {
    console.error("bKash Search Error:", error.response?.data || error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/api/admin/analytics", authenticateToken, async (req: any, res) => {
  const { merchantId } = req.query;
  const user = req.user;

  if (user.role === 'merchant' && merchantId !== user.merchant_id) {
    return res.status(403).json({ error: "Access denied." });
  }

  const effectiveMerchantId = user.role === 'merchant' ? user.merchant_id : merchantId;

  try {
    let last7DaysQuery = `
      SELECT DATE(created_at) as date, SUM(amount) as total, COUNT(*) as count 
      FROM transactions 
      WHERE status = 'completed' AND created_at >= date('now', '-7 days')
    `;
    let statusDistQuery = `
      SELECT status, COUNT(*) as count 
      FROM transactions 
    `;
    let hourlyVolumeQuery = `
      SELECT STRFTIME('%H', created_at) as hour, SUM(amount) as total
      FROM transactions
      WHERE status = 'completed'
    `;
    const params: any[] = [];

    if (effectiveMerchantId) {
      last7DaysQuery += " AND merchant_id = ?";
      statusDistQuery += " WHERE merchant_id = ?";
      hourlyVolumeQuery += " AND merchant_id = ?";
      params.push(effectiveMerchantId);
    }

    last7DaysQuery += " GROUP BY DATE(created_at) ORDER BY date ASC";
    statusDistQuery += " GROUP BY status";
    hourlyVolumeQuery += " GROUP BY hour ORDER BY hour ASC";

    const last7Days = await db.all(last7DaysQuery, ...params);
    const statusDistribution = await db.all(statusDistQuery, ...params);
    const hourlyVolume = await db.all(hourlyVolumeQuery, ...params);

    res.json({ last7Days, statusDistribution, hourlyVolume });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch analytics" });
  }
});

app.get("/api/admin/customers", authenticateToken, async (req: any, res) => {
  const { merchantId } = req.query;
  const user = req.user;

  if (user.role === 'merchant' && merchantId !== user.merchant_id) {
    return res.status(403).json({ error: "Access denied." });
  }

  const effectiveMerchantId = user.role === 'merchant' ? user.merchant_id : merchantId;

  try {
    let query = `
      SELECT 
        customer_msisdn as msisdn, 
        COUNT(*) as total_transactions, 
        SUM(amount) as total_spent,
        MAX(created_at) as last_transaction
      FROM transactions 
      WHERE status = 'completed' AND customer_msisdn IS NOT NULL
    `;
    const params: any[] = [];

    if (effectiveMerchantId) {
      query += " AND merchant_id = ?";
      params.push(effectiveMerchantId);
    }

    query += " GROUP BY customer_msisdn ORDER BY total_spent DESC";
    const customers = await db.all(query, ...params);
    res.json(customers);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch customers" });
  }
});

app.get("/api/admin/statement", authenticateToken, async (req: any, res) => {
  const { from, to, merchantId } = req.query;
  const user = req.user;

  if (user.role === 'merchant' && merchantId !== user.merchant_id) {
    return res.status(403).json({ error: "Access denied." });
  }

  const effectiveMerchantId = user.role === 'merchant' ? user.merchant_id : merchantId;

  try {
    let query = `
      SELECT * FROM transactions 
      WHERE status = 'completed' 
      AND DATE(created_at) >= DATE(?) 
      AND DATE(created_at) <= DATE(?)
    `;
    const params: any[] = [from, to];

    if (effectiveMerchantId) {
      query += " AND merchant_id = ?";
      params.push(effectiveMerchantId);
    }

    query += " ORDER BY created_at ASC";
    const transactions = await db.all(query, ...params);
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: "Failed to generate statement" });
  }
});

app.post("/api/admin/profile/upload-avatar", authenticateToken, upload.single("avatar"), async (req: any, res) => {
  try {
    const { userId } = req.body;
    const user = req.user;

    // Ensure users can only update their own avatar unless admin
    if (user.role !== 'admin' && user.id !== userId) {
      return res.status(403).json({ error: "Access denied." });
    }

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    const avatarUrl = `/uploads/${req.file.filename}`;
    await db.run("UPDATE users SET avatar = ? WHERE id = ?", avatarUrl, userId);
    res.json({ success: true, url: avatarUrl });
  } catch (error) {
    res.status(500).json({ error: "Failed to upload avatar" });
  }
});

app.post("/api/admin/settings/upload-logo", authenticateToken, authorizeRole(['admin']), upload.single("logo"), async (req: any, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    const logoUrl = `/uploads/${req.file.filename}`;
    await db.run("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", "SITE_LOGO", logoUrl);
    res.json({ success: true, url: logoUrl });
  } catch (error) {
    res.status(500).json({ error: "Failed to upload logo" });
  }
});

app.get("/api/admin/logs", authenticateToken, authorizeRole(['admin']), async (req, res) => {
  const logs = await db.all("SELECT * FROM logs ORDER BY created_at DESC LIMIT 100");
  res.json(logs);
});

app.get("/api/admin/audit-logs", authenticateToken, authorizeRole(['admin']), async (req, res) => {
  const logs = await db.all("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 100");
  res.json(logs);
});

app.post("/api/admin/test-bkash", authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const headers = await getBkashHeaders();
    res.json({ success: true, message: "Connection successful", token: headers.Authorization.substring(0, 10) + "..." });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.response?.data || error.message });
  }
});

app.get("/api/admin/transaction-search", authenticateToken, async (req: any, res) => {
  const { trx_id } = req.query;
  const user = req.user;

  try {
    const transaction = await db.get("SELECT * FROM transactions WHERE trx_id = ?", trx_id);
    
    if (transaction && user.role === 'merchant' && transaction.merchant_id !== user.merchant_id) {
      return res.status(403).json({ error: "Access denied." });
    }

    res.json(transaction || null);
  } catch (error) {
    res.status(500).json({ error: "Search failed" });
  }
});

// User Management Routes
app.get("/api/admin/users", authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const users = await db.all("SELECT id, username, email, role, permissions, avatar, created_at FROM users");
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

app.post("/api/admin/users", authenticateToken, authorizeRole(['admin']), async (req, res) => {
  const { username, email, password, role, permissions } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }
  try {
    const id = uuidv4();
    const hashedPassword = await hashPassword(password);
    await db.run(
      "INSERT INTO users (id, username, email, password, role, permissions) VALUES (?, ?, ?, ?, ?, ?)",
      id, username, email, hashedPassword, role, permissions.join(",")
    );
    await auditLog("USER_CREATED", "admin", { username, role });
    res.json({ success: true, id });
  } catch (error) {
    res.status(500).json({ error: "Failed to create user" });
  }
});

app.put("/api/admin/users/:id", authenticateToken, authorizeRole(['admin']), async (req, res) => {
  const { id } = req.params;
  const { username, email, password, role, permissions } = req.body;
  try {
    if (password) {
      const hashedPassword = await hashPassword(password);
      await db.run(
        "UPDATE users SET username = ?, email = ?, password = ?, role = ?, permissions = ? WHERE id = ?",
        username, email, hashedPassword, role, permissions.join(","), id
      );
    } else {
      await db.run(
        "UPDATE users SET username = ?, email = ?, role = ?, permissions = ? WHERE id = ?",
        username, email, role, permissions.join(","), id
      );
    }
    await auditLog("USER_UPDATED", "admin", { username, role });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to update user" });
  }
});

app.delete("/api/admin/users/:id", authenticateToken, authorizeRole(['admin']), async (req, res) => {
  const { id } = req.params;
  try {
    const user = await db.get("SELECT username FROM users WHERE id = ?", id);
    await db.run("DELETE FROM users WHERE id = ?", id);
    await auditLog("USER_DELETED", "admin", { username: user?.username });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete user" });
  }
});

app.get("/api/admin/system/version", authenticateToken, (req, res) => {
  res.json({ version: APP_VERSION });
});

app.get("/api/admin/system/check-update", authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    await ensureGitRepo();
    
    await execAsync("git fetch origin");
    
    let local = "";
    try {
      const { stdout } = await execAsync("git rev-parse HEAD");
      local = stdout.trim();
    } catch (e) {
      // HEAD doesn't exist, likely a fresh repo
      local = "NONE";
    }

    const { stdout: remote } = await execAsync("git rev-parse origin/main || git rev-parse origin/master");
    const remoteHash = remote.trim();

    if (local === remoteHash) {
      return res.json({ updateAvailable: false, currentVersion: APP_VERSION });
    }

    const logCmd = local === "NONE" 
      ? "git log origin/main --oneline || git log origin/master --oneline"
      : "git log HEAD..origin/main --oneline || git log HEAD..origin/master --oneline";
    
    const { stdout: log } = await execAsync(logCmd);
    res.json({ 
      updateAvailable: true, 
      currentVersion: APP_VERSION,
      latestCommit: remoteHash.slice(0, 7),
      changes: log.trim().split('\n')
    });
  } catch (error: any) {
    console.error("Update Check Error:", error);
    res.status(500).json({ error: "Could not check for updates. Ensure Git is configured correctly on the server." });
  }
});

app.post("/api/admin/system/update", authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    await auditLog("SYSTEM_UPDATE_STARTED", (req as any).user.username, {});
    
    // 0. Ensure git is ready
    await ensureGitRepo();
    
    // 1. Fetch and Reset to latest remote commit (force sync)
    await execAsync("git fetch origin");
    await execAsync("git reset --hard origin/main || git reset --hard origin/master");
    
    // 2. Install dependencies
    await execAsync("npm install --no-audit --no-fund --prefer-offline");
    
    // 3. Build application
    await execAsync("npm run build");

    await auditLog("SYSTEM_UPDATE_COMPLETED", (req as any).user.username, {});
    
    res.json({ success: true, message: "Update completed. System will restart shortly." });

    // Graceful restart (process manager like PM2 or our bootstrapper will handle this)
    setTimeout(() => {
      process.exit(0);
    }, 2000);
  } catch (error: any) {
    console.error("System Update Error:", error);
    res.status(500).json({ error: "Update failed: " + error.message });
  }
});

// Vite Middleware
async function startServer() {
  await initDb();

  // SPA fallback
  app.get("*", async (req, res, next) => {
    if (req.originalUrl.startsWith('/api')) return next();
    
    if (process.env.NODE_ENV !== "production" && vite) {
      const url = req.originalUrl;
      try {
        let template = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    } else if (process.env.NODE_ENV === "production") {
      res.sendFile(path.resolve(process.cwd(), "dist", "index.html"));
    } else {
      next();
    }
  });

  if (!process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
}

export default app;

startServer();
