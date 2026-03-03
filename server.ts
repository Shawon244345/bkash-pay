import express from "express";
import { createServer as createViteServer } from "vite";
import sqlite3 from "sqlite3";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import dotenv from "dotenv";
import fs from "fs";

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
  `);

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
};

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

// bKash Helpers
const getSetting = async (key: string, defaultValue: string = "") => {
  const row = await db.get("SELECT value FROM settings WHERE key = ?", key);
  return row ? row.value : (process.env[key] || defaultValue);
};

const getBkashHeaders = async () => {
  const appKey = await getSetting("BKASH_APP_KEY");
  const appSecret = await getSetting("BKASH_APP_SECRET");
  const username = await getSetting("BKASH_USERNAME");
  const password = await getSetting("BKASH_PASSWORD");
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
app.post("/api/bkash/create-payment", async (req, res) => {
  try {
    const { amount, invoice } = req.body;
    const headers = await getBkashHeaders();
    const baseUrl = await getSetting("BKASH_BASE_URL");
    const appUrl = await getSetting("APP_URL");
    
    const { data } = await axios.post(
      `${baseUrl}/tokenized/checkout/create`,
      {
        mode: "0011",
        payerReference: invoice || `INV-${Date.now()}`,
        callbackURL: `${appUrl}/api/bkash/callback`,
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
      await db.run("INSERT INTO transactions (id, payment_id, amount, status, merchant_invoice) VALUES (?, ?, ?, ?, ?)", uuidv4(), data.paymentID, amount, "initiated", invoice);
      
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
  const { paymentID, status } = req.query;
  await logToFile("bKash Callback Received", { paymentID, status });

  if (!paymentID) {
    return res.redirect("/payment-failed?error=missing_payment_id");
  }

  if (status === "success") {
    try {
      const headers = await getBkashHeaders();
      const baseUrl = await getSetting("BKASH_BASE_URL");
      
      const { data } = await axios.post(
        `${baseUrl}/tokenized/checkout/execute`,
        { paymentID },
        { headers }
      );

      await logToFile("bKash Execute Response", data);

      if (data.statusCode === "0000") {
        await db.run("UPDATE transactions SET status = ?, trx_id = ?, customer_msisdn = ?, updated_at = CURRENT_TIMESTAMP WHERE payment_id = ?", "completed", data.trxID, data.customerMsisdn, paymentID);
        
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
  const dbUsername = await getSetting("ADMIN_USERNAME");
  const dbPassword = await getSetting("ADMIN_PASSWORD");

  if (username === dbUsername && password === dbPassword) {
    await auditLog("LOGIN_SUCCESS", username, "Admin logged in successfully");
    res.json({ success: true });
  } else {
    await auditLog("LOGIN_FAILED", username, "Invalid login attempt");
    res.status(401).json({ error: "Invalid credentials" });
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
  const totalVolume = await db.get("SELECT SUM(amount) as total FROM transactions WHERE status = 'completed'");
  const successCount = await db.get("SELECT COUNT(*) as count FROM transactions WHERE status = 'completed'");
  const recentTransactions = await db.all("SELECT * FROM transactions ORDER BY created_at DESC LIMIT 10");
  
  res.json({
    totalVolume: totalVolume?.total || 0,
    successCount: successCount?.count || 0,
    recentTransactions,
  });
});

app.get("/api/admin/transactions", async (req, res) => {
  const { start_date, end_date, search } = req.query;
  let query = "SELECT * FROM transactions WHERE 1=1";
  const params: any[] = [];

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
