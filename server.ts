import express from "express";
import { createServer as createViteServer } from "vite";
import sqlite3 from "sqlite3";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import dotenv from "dotenv";
import fs from "fs";
import multer from "multer";

import { fileURLToPath } from "url";
import { dirname } from "path";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Database Setup
const dbRaw = new sqlite3.Database(path.join(__dirname, "payments.db"));

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
  fs.appendFileSync(path.join(__dirname, "debug.log"), logEntry);
  
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
      status TEXT DEFAULT 'ACTIVE',
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

  // Migration for refunds table to ensure all columns exist
  try { await db.run("ALTER TABLE refunds ADD COLUMN refund_execution_time DATETIME"); } catch (e) {}
  try { await db.run("ALTER TABLE refunds ADD COLUMN ip_address TEXT"); } catch (e) {}
  try { await db.run("ALTER TABLE refunds ADD COLUMN initiated_by TEXT"); } catch (e) {}

  // Seed default credentials if not present
  const seedSettings = [
    { key: 'BKASH_APP_KEY', value: 'cHDSQ3vX2eDv5ZMAPoPNPlnFtc' },
    { key: 'BKASH_APP_SECRET', value: 'V1hSnG1vAsc79MSjyPUC4K0RdOqWyKv28tZPb1Uol8HSRCvwzF83' },
    { key: 'BKASH_USERNAME', value: '01997473177' },
    { key: 'BKASH_PASSWORD', value: 'V9^@JbA_$6x' },
    { key: 'BKASH_BASE_URL', value: 'https://tokenized.pay.bka.sh/v1.2.0-beta' },
    { key: 'APP_URL', value: process.env.APP_URL || "https://bkash.egoluck.com" },
    { key: 'ADMIN_USERNAME', value: 'admin' },
    { key: 'ADMIN_PASSWORD', value: 'admin123' }
  ];

  for (const s of seedSettings) {
    await db.run("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)", s.key, s.value);
  }

  // Seed default admin user
  const adminUsername = await getSetting("ADMIN_USERNAME", "admin");
  const adminPassword = await getSetting("ADMIN_PASSWORD", "admin123");
  const allPermissions = "dashboard,transactions,search,refunds,logs,audit-logs,settings,profile,analytics,customers,security,user-management,statements,withdrawals,subscriptions";
  
  // Check if admin exists
  const existingAdmin = await db.get("SELECT * FROM users WHERE username = ?", adminUsername);
  if (!existingAdmin) {
    await db.run(
      "INSERT INTO users (id, username, email, password, role, permissions) VALUES (?, ?, ?, ?, ?, ?)",
      uuidv4(),
      adminUsername,
      "admin@bkash-pay.com",
      adminPassword,
      "admin",
      allPermissions
    );
  } else {
    // Ensure admin has all permissions
    await db.run("UPDATE users SET permissions = ? WHERE username = ?", allPermissions, adminUsername);
  }

  // Update existing merchants with new permissions
  const merchantPermissions = "dashboard,transactions,search,refunds,profile,analytics,customers,statements,settings,api-docs,withdrawals,subscriptions";
  await db.run("UPDATE users SET permissions = ? WHERE role = 'merchant'", merchantPermissions);
};

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Multer Setup for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "uploads");
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
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// bKash Helpers
const getSetting = async (key: string, defaultValue: string = "") => {
  const row = await db.get("SELECT value FROM settings WHERE key = ?", key);
  return row ? row.value : (process.env[key] || defaultValue);
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
app.use((req, res, next) => {
  if (req.url.endsWith('.js') || req.url.endsWith('.ts') || req.url.endsWith('.tsx')) {
    res.type('application/javascript');
  }
  next();
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
    const user = await db.get("SELECT * FROM users WHERE (username = ? OR email = ?) AND password = ?", username, username, password);

    if (user) {
      let merchant = null;
      if (user.merchant_id) {
        merchant = await db.get("SELECT * FROM merchants WHERE id = ?", user.merchant_id);
      }

      await auditLog("LOGIN_SUCCESS", user.username, "User logged in successfully");
      res.json({ 
        success: true, 
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
      await auditLog("LOGIN_FAILED", username, "Invalid login attempt");
      res.status(401).json({ error: "Invalid credentials" });
    }
  } catch (error) {
    console.error("Login error:", error);
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

    await db.run(
      "INSERT INTO merchants (id, name, email, api_key) VALUES (?, ?, ?, ?)",
      merchantId, name, email, apiKey
    );

    const permissions = "dashboard,transactions,search,refunds,profile,analytics,customers,statements,settings,api-docs,withdrawals,subscriptions";
    await db.run(
      "INSERT INTO users (id, username, email, password, role, permissions, merchant_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
      userId, email, email, password, "merchant", permissions, merchantId
    );

    res.json({ success: true, message: "Merchant registered successfully" });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/merchant/settings", async (req, res) => {
  const { merchantId } = req.query;
  try {
    const merchant = await db.get("SELECT * FROM merchants WHERE id = ?", merchantId);
    res.json(merchant);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch settings" });
  }
});

app.post("/api/merchant/settings", async (req, res) => {
  const { merchantId, payment_mode, bkash_app_key, bkash_app_secret, bkash_username, bkash_password } = req.body;
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
app.get("/api/merchant/payout-accounts", async (req, res) => {
  const { merchantId } = req.query;
  try {
    const accounts = await db.all("SELECT * FROM payout_accounts WHERE merchant_id = ?", merchantId);
    res.json(accounts);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch payout accounts" });
  }
});

app.post("/api/merchant/payout-accounts", async (req, res) => {
  const { merchantId, type, provider, account_number, account_name, bank_branch, routing_number } = req.body;
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

app.delete("/api/merchant/payout-accounts/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await db.run("DELETE FROM payout_accounts WHERE id = ?", id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete payout account" });
  }
});

// Withdrawals
app.get("/api/merchant/withdrawals", async (req, res) => {
  const { merchantId } = req.query;
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

app.post("/api/merchant/withdrawals", async (req, res) => {
  const { merchantId, payout_account_id, amount } = req.body;
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
app.get("/api/admin/withdrawals", async (req, res) => {
  try {
    const withdrawals = await db.all(
      "SELECT w.*, m.name as merchant_name, p.account_number, p.provider, p.type as account_type, p.account_name, p.bank_branch, p.routing_number FROM withdrawals w JOIN merchants m ON w.merchant_id = m.id JOIN payout_accounts p ON w.payout_account_id = p.id ORDER BY w.created_at DESC"
    );
    res.json(withdrawals);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch withdrawals" });
  }
});

app.post("/api/admin/withdrawals/status", async (req, res) => {
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

app.post("/api/admin/subscription-plans", async (req, res) => {
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
app.get("/api/merchant/subscription", async (req, res) => {
  const { merchantId } = req.query;
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

app.post("/api/merchant/subscribe", async (req, res) => {
  const { merchantId, planId } = req.body;
  try {
    const plan = await db.get("SELECT * FROM subscription_plans WHERE id = ?", planId);
    if (!plan) return res.status(404).json({ error: "Plan not found" });

    // In a real app, this would initiate a bKash payment using SUPER ADMIN credentials
    // For this demo, we'll simulate the payment initiation
    const id = uuidv4();
    await db.run(
      "INSERT INTO subscriptions (id, merchant_id, plan_id, status, start_date, end_date) VALUES (?, ?, ?, 'ACTIVE', CURRENT_TIMESTAMP, datetime('now', '+' || ? || ' days'))",
      id, merchantId, planId, plan.duration_days
    );
    res.json({ success: true, id });
  } catch (error) {
    res.status(500).json({ error: "Failed to subscribe" });
  }
});

app.get("/api/admin/merchant-subscriptions", async (req, res) => {
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
      // In a real app, send email. Here we just return success.
      await auditLog("FORGOT_PASSWORD_REQUEST", email, "Password reset requested");
      res.json({ message: "Password reset instructions sent to your email." });
    } else {
      res.status(404).json({ error: "Email not found" });
    }
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/admin/update-credentials", async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required" });
  }

  try {
    await db.exec("BEGIN TRANSACTION");
    await db.run("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", "ADMIN_USERNAME", username);
    await db.run("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", "ADMIN_PASSWORD", password);
    await db.exec("COMMIT");
    
    await auditLog("CREDENTIALS_UPDATE", username, "Admin credentials updated");
    res.json({ message: "Credentials updated successfully" });
  } catch (e) {
    await db.exec("ROLLBACK");
    res.status(500).json({ error: "Failed to update credentials" });
  }
});

app.get("/api/admin/stats", async (req, res) => {
  const { merchantId } = req.query;
  try {
    let volumeQuery = "SELECT SUM(amount) as total FROM transactions WHERE status = 'completed'";
    let successCountQuery = "SELECT COUNT(*) as count FROM transactions WHERE status = 'completed'";
    let failedCountQuery = "SELECT COUNT(*) as count FROM transactions WHERE status = 'FAILED'";
    let totalCountQuery = "SELECT COUNT(*) as count FROM transactions";
    let recentQuery = "SELECT * FROM transactions ORDER BY created_at DESC LIMIT 10";
    let activityQuery = "SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 5";
    const params: any[] = [];

    if (merchantId) {
      volumeQuery += " AND merchant_id = ?";
      successCountQuery += " AND merchant_id = ?";
      failedCountQuery += " AND merchant_id = ?";
      totalCountQuery += " WHERE merchant_id = ?";
      recentQuery = "SELECT * FROM transactions WHERE merchant_id = ? ORDER BY created_at DESC LIMIT 10";
      activityQuery = "SELECT * FROM audit_logs WHERE user = ? OR details LIKE ? ORDER BY created_at DESC LIMIT 5";
      params.push(merchantId);
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

app.get("/api/admin/transactions", async (req, res) => {
  const { start_date, end_date, search, merchantId } = req.query;
  try {
    let query = "SELECT * FROM transactions WHERE 1=1";
    const params: any[] = [];

    if (merchantId) {
      query += " AND merchant_id = ?";
      params.push(merchantId);
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

app.get("/api/admin/settings", async (req, res) => {
  const keys = ["BKASH_APP_KEY", "BKASH_APP_SECRET", "BKASH_USERNAME", "BKASH_PASSWORD", "BKASH_BASE_URL", "APP_URL"];
  const settings: any = {};
  for (const key of keys) {
    settings[key] = await getSetting(key);
  }
  res.json(settings);
});

app.post("/api/admin/settings", async (req, res) => {
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

app.post("/api/bkash/refund", async (req, res) => {
  try {
    const { paymentID, trxID, amount, sku, reason } = req.body;
    const ip = req.ip || req.headers['x-forwarded-for'] || "";
    const initiated_by = "admin"; // In a real app, this would come from session
    
    // Check transaction mode
    const transaction = await db.get("SELECT payment_mode FROM transactions WHERE trx_id = ?", trxID);
    if (transaction && transaction.payment_mode === 'OWN') {
      return res.status(403).json({ error: "Refunds for 'Own API' transactions must be handled via the merchant's own bKash panel. Super Admin can only refund Global API payments." });
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
      INSERT INTO refunds (id, refund_id, original_trx_id, original_payment_id, amount, refund_amount, status, reason, sku, refund_execution_time, response_data, ip_address, initiated_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      initiated_by
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

app.post("/api/bkash/search-transaction", async (req, res) => {
  try {
    const { trxID } = req.body;
    if (!trxID) {
      return res.status(400).json({ error: "trxID is required" });
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

app.get("/api/admin/analytics", async (req, res) => {
  try {
    const last7Days = await db.all(`
      SELECT DATE(created_at) as date, SUM(amount) as total, COUNT(*) as count 
      FROM transactions 
      WHERE status = 'completed' AND created_at >= date('now', '-7 days')
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `);

    const statusDistribution = await db.all(`
      SELECT status, COUNT(*) as count 
      FROM transactions 
      GROUP BY status
    `);

    const hourlyVolume = await db.all(`
      SELECT STRFTIME('%H', created_at) as hour, SUM(amount) as total
      FROM transactions
      WHERE status = 'completed'
      GROUP BY hour
      ORDER BY hour ASC
    `);

    res.json({ last7Days, statusDistribution, hourlyVolume });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch analytics" });
  }
});

app.get("/api/admin/customers", async (req, res) => {
  try {
    const customers = await db.all(`
      SELECT 
        customer_msisdn as msisdn, 
        COUNT(*) as total_transactions, 
        SUM(amount) as total_spent,
        MAX(created_at) as last_transaction
      FROM transactions 
      WHERE status = 'completed' AND customer_msisdn IS NOT NULL
      GROUP BY customer_msisdn
      ORDER BY total_spent DESC
    `);
    res.json(customers);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch customers" });
  }
});

app.get("/api/admin/statement", async (req, res) => {
  const { from, to } = req.query;
  try {
    const transactions = await db.all(`
      SELECT * FROM transactions 
      WHERE status = 'completed' 
      AND DATE(created_at) >= DATE(?) 
      AND DATE(created_at) <= DATE(?)
      ORDER BY created_at ASC
    `, from, to);
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: "Failed to generate statement" });
  }
});

app.post("/api/admin/profile/upload-avatar", upload.single("avatar"), async (req: any, res) => {
  try {
    const { userId } = req.body;
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

app.post("/api/admin/settings/upload-logo", upload.single("logo"), async (req: any, res) => {
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

app.get("/api/admin/logs", async (req, res) => {
  const logs = await db.all("SELECT * FROM logs ORDER BY created_at DESC LIMIT 100");
  res.json(logs);
});

app.get("/api/admin/audit-logs", async (req, res) => {
  const logs = await db.all("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 100");
  res.json(logs);
});

app.post("/api/admin/test-bkash", async (req, res) => {
  try {
    const headers = await getBkashHeaders();
    res.json({ success: true, message: "Connection successful", token: headers.Authorization.substring(0, 10) + "..." });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.response?.data || error.message });
  }
});

app.get("/api/admin/transaction-search", async (req, res) => {
  const { trx_id } = req.query;
  const transaction = await db.get("SELECT * FROM transactions WHERE trx_id = ?", trx_id);
  res.json(transaction || null);
});

// User Management Routes
app.get("/api/admin/users", async (req, res) => {
  try {
    const users = await db.all("SELECT id, username, role, permissions, created_at FROM users");
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

app.post("/api/admin/users", async (req, res) => {
  const { username, email, password, role, permissions } = req.body;
  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }
  try {
    const id = uuidv4();
    await db.run(
      "INSERT INTO users (id, username, email, password, role, permissions) VALUES (?, ?, ?, ?, ?, ?)",
      id, username, email, password, role, permissions.join(",")
    );
    await auditLog("USER_CREATED", "admin", { username, role });
    res.json({ success: true, id });
  } catch (error) {
    res.status(500).json({ error: "Failed to create user" });
  }
});

app.put("/api/admin/users/:id", async (req, res) => {
  const { id } = req.params;
  const { username, email, password, role, permissions } = req.body;
  try {
    if (password) {
      await db.run(
        "UPDATE users SET username = ?, email = ?, password = ?, role = ?, permissions = ? WHERE id = ?",
        username, email, password, role, permissions.join(","), id
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

app.delete("/api/admin/users/:id", async (req, res) => {
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

// Vite Middleware
async function startServer() {
  await initDb();

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.resolve(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
