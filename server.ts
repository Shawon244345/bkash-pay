import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
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

const logToFile = (message: string, data: any) => {
  const logEntry = `[${new Date().toISOString()}] ${message}: ${JSON.stringify(data, null, 2)}\n`;
  fs.appendFileSync(path.join(__dirname, "debug.log"), logEntry);
};

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Database Setup
const db = new Database(path.join(__dirname, "payments.db"));
db.exec(`
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
`);

// Migration for refunds table to ensure all columns exist
try {
  db.prepare("ALTER TABLE refunds ADD COLUMN refund_execution_time DATETIME").run();
} catch (e) {}
try {
  db.prepare("ALTER TABLE refunds ADD COLUMN ip_address TEXT").run();
} catch (e) {}
try {
  db.prepare("ALTER TABLE refunds ADD COLUMN initiated_by TEXT").run();
} catch (e) {}

// Seed default credentials if not present
const seedSettings = [
  { key: 'BKASH_APP_KEY', value: 'cHDSQ3vX2eDv5ZMAPoPNPlnFtc' },
  { key: 'BKASH_APP_SECRET', value: 'V1hSnG1vAsc79MSjyPUC4K0RdOqWyKv28tZPb1Uol8HSRCvwzF83' },
  { key: 'BKASH_USERNAME', value: '01997473177' },
  { key: 'BKASH_PASSWORD', value: 'V9^@JbA_$6x' },
  { key: 'BKASH_BASE_URL', value: 'https://tokenized.pay.bka.sh/v1.2.0-beta' },
  { key: 'APP_URL', value: process.env.APP_URL || "" },
  { key: 'ADMIN_USERNAME', value: 'admin' },
  { key: 'ADMIN_PASSWORD', value: 'admin123' }
];

const insertSetting = db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)");
seedSettings.forEach(s => insertSetting.run(s.key, s.value));

app.use(express.json());

// bKash Helpers
const getSetting = (key: string, defaultValue: string = "") => {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as any;
  return row ? row.value : (process.env[key] || defaultValue);
};

const getBkashHeaders = async () => {
  const appKey = getSetting("BKASH_APP_KEY");
  const appSecret = getSetting("BKASH_APP_SECRET");
  const username = getSetting("BKASH_USERNAME");
  const password = getSetting("BKASH_PASSWORD");
  const baseUrl = getSetting("BKASH_BASE_URL");

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
  logToFile("bKash Token Response", data);
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
    const baseUrl = getSetting("BKASH_BASE_URL");
    const appUrl = getSetting("APP_URL");
    
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
    logToFile("bKash Create Response", data);

    if (data.paymentID && data.bkashURL) {
      db.prepare("INSERT INTO transactions (id, payment_id, amount, status, merchant_invoice) VALUES (?, ?, ?, ?, ?)")
        .run(uuidv4(), data.paymentID, amount, "initiated", invoice);
      
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
  logToFile("bKash Callback Received", { paymentID, status });

  if (!paymentID) {
    return res.redirect("/payment-failed?error=missing_payment_id");
  }

  if (status === "success") {
    try {
      const headers = await getBkashHeaders();
      const baseUrl = getSetting("BKASH_BASE_URL");
      
      const { data } = await axios.post(
        `${baseUrl}/tokenized/checkout/execute`,
        { paymentID },
        { headers }
      );

      logToFile("bKash Execute Response", data);

      if (data.statusCode === "0000") {
        db.prepare("UPDATE transactions SET status = ?, trx_id = ?, customer_msisdn = ?, updated_at = CURRENT_TIMESTAMP WHERE payment_id = ?")
          .run("completed", data.trxID, data.customerMsisdn, paymentID);
        
        const params = new URLSearchParams({
          trxID: data.trxID,
          amount: data.amount,
          customer: data.customerMsisdn || "",
          invoice: data.merchantInvoiceNumber || "",
          time: data.paymentExecuteTime || new Date().toISOString()
        });
        return res.redirect(`/payment-success?${params.toString()}`);
      } else {
        db.prepare("UPDATE transactions SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE payment_id = ?")
          .run("failed", paymentID);
        return res.redirect("/payment-failed?error=" + (data.statusMessage || "Execution failed"));
      }
    } catch (error: any) {
      logToFile("bKash Execute Error", error.response?.data || error.message);
      return res.redirect("/payment-failed?error=execution_api_error");
    }
  }
  
  // Handle cancel, failure, or other statuses
  db.prepare("UPDATE transactions SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE payment_id = ?")
    .run(status || "failed", paymentID);
    
  res.redirect("/payment-failed?status=" + (status || "unknown"));
});

app.post("/api/admin/login", (req, res) => {
  const { username, password } = req.body;
  const dbUsername = getSetting("ADMIN_USERNAME");
  const dbPassword = getSetting("ADMIN_PASSWORD");

  if (username === dbUsername && password === dbPassword) {
    res.json({ success: true });
  } else {
    res.status(401).json({ error: "Invalid credentials" });
  }
});

app.post("/api/admin/update-credentials", (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required" });
  }

  const stmt = db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)");
  
  db.transaction(() => {
    stmt.run("ADMIN_USERNAME", username);
    stmt.run("ADMIN_PASSWORD", password);
  })();
  
  res.json({ message: "Credentials updated successfully" });
});

app.get("/api/admin/stats", (req, res) => {
  const totalVolume = db.prepare("SELECT SUM(amount) as total FROM transactions WHERE status = 'completed'").get() as any;
  const successCount = db.prepare("SELECT COUNT(*) as count FROM transactions WHERE status = 'completed'").get() as any;
  const recentTransactions = db.prepare("SELECT * FROM transactions ORDER BY created_at DESC LIMIT 10").all();
  
  res.json({
    totalVolume: totalVolume?.total || 0,
    successCount: successCount?.count || 0,
    recentTransactions,
  });
});

app.get("/api/admin/transactions", (req, res) => {
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
  const transactions = db.prepare(query).all(...params);
  res.json(transactions);
});

app.get("/api/admin/settings", (req, res) => {
  const keys = ["BKASH_APP_KEY", "BKASH_APP_SECRET", "BKASH_USERNAME", "BKASH_PASSWORD", "BKASH_BASE_URL", "APP_URL"];
  const settings: any = {};
  keys.forEach(key => {
    settings[key] = getSetting(key);
  });
  res.json(settings);
});

app.post("/api/admin/settings", (req, res) => {
  const settings = req.body;
  const stmt = db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)");
  
  db.transaction(() => {
    for (const [key, value] of Object.entries(settings)) {
      stmt.run(key, value);
    }
  })();
  
  res.json({ message: "Settings updated successfully" });
});

app.post("/api/bkash/refund", async (req, res) => {
  try {
    const { paymentID, trxID, amount, sku, reason } = req.body;
    const ip = req.ip || req.headers['x-forwarded-for'] || "";
    const initiated_by = "admin"; // In a real app, this would come from session
    
    // Check if already refunded
    const existing = db.prepare("SELECT * FROM refunds WHERE original_trx_id = ? AND status = 'COMPLETED'").get(trxID);
    if (existing) {
      return res.status(400).json({ error: "This transaction has already been refunded" });
    }

    const headers = await getBkashHeaders();
    const baseUrl = getSetting("BKASH_BASE_URL");
    
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
      logToFile("bKash Refund API Error", responseData);
    }

    const status = responseData.refundTrxID ? "COMPLETED" : "FAILED";
    const refundID = responseData.refundTrxID || `FAIL-${uuidv4().slice(0, 8)}`;
    const executionTime = responseData.completedTime || null;

    db.prepare(`
      INSERT INTO refunds (id, refund_id, original_trx_id, original_payment_id, amount, refund_amount, status, reason, sku, refund_execution_time, response_data, ip_address, initiated_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
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
      db.prepare("UPDATE transactions SET status = 'refunded', updated_at = CURRENT_TIMESTAMP WHERE trx_id = ?").run(trxID);
      res.json({ message: "Refund processed successfully", refundID });
    } else {
      res.status(400).json({ error: responseData.statusMessage || "Refund failed" });
    }
  } catch (error: any) {
    console.error("Refund Error:", error.response?.data || error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/api/admin/refunds", (req, res) => {
  const refunds = db.prepare("SELECT * FROM refunds ORDER BY created_at DESC").all();
  res.json(refunds);
});

app.get("/api/admin/transaction-search", (req, res) => {
  const { trx_id } = req.query;
  const transaction = db.prepare("SELECT * FROM transactions WHERE trx_id = ?").get(trx_id);
  res.json(transaction || null);
});

// Vite Middleware
async function startServer() {
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
