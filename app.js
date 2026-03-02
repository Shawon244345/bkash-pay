const express = require('express');
const axios = require('axios');
const Database = require('better-sqlite3');
const { v4: uuidv4 } = require('uuid');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Database Setup
const db = new Database('payments.db');
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
`);

app.use(express.json());

// Helper to get settings
const getSetting = (key, defaultValue = "") => {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key);
  return row ? row.value : (process.env[key] || defaultValue);
};

// bKash Auth Header Helper
const getBkashHeaders = async () => {
  const appKey = getSetting("BKASH_APP_KEY");
  const appSecret = getSetting("BKASH_APP_SECRET");
  const username = getSetting("BKASH_USERNAME");
  const password = getSetting("BKASH_PASSWORD");
  const baseUrl = getSetting("BKASH_BASE_URL");

  const { data } = await axios.post(
    `${baseUrl}/tokenized/checkout/token/grant`,
    { app_key: appKey, app_secret: appSecret },
    { headers: { username, password } }
  );

  return {
    "Content-Type": "application/json",
    "Authorization": data.id_token,
    "X-APP-Key": appKey,
  };
};

// --- API Endpoints ---

// 1. Create Payment
app.post('/api/bkash/create-payment', async (req, res) => {
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

    if (data.paymentID && data.bkashURL) {
      db.prepare("INSERT INTO transactions (id, payment_id, amount, status, merchant_invoice) VALUES (?, ?, ?, ?, ?)")
        .run(uuidv4(), data.paymentID, amount, "initiated", invoice);
      
      res.json({ bkashURL: data.bkashURL });
    } else {
      res.status(400).json({ error: data.statusMessage || "Failed to create payment" });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Callback Handler
app.get('/api/bkash/callback', async (req, res) => {
  const { paymentID, status } = req.query;

  if (status === "success") {
    try {
      const headers = await getBkashHeaders();
      const baseUrl = getSetting("BKASH_BASE_URL");
      
      const { data } = await axios.post(
        `${baseUrl}/tokenized/checkout/execute`,
        { paymentID },
        { headers }
      );

      if (data.statusCode === "0000") {
        db.prepare("UPDATE transactions SET status = ?, trx_id = ?, customer_msisdn = ?, updated_at = CURRENT_TIMESTAMP WHERE payment_id = ?")
          .run("completed", data.trxID, data.customerMsisdn, paymentID);
        
        return res.redirect(`/payment-success?trxID=${data.trxID}&amount=${data.amount}`);
      }
    } catch (error) {
      console.error("Execute Error:", error.message);
    }
  }
  
  res.redirect("/payment-failed");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
