# bKash Payment Gateway System (Node.js)

A full-featured, secure, and offline-ready bKash Payment Gateway system designed for easy deployment on cPanel or any Node.js environment.

## Features
- **Secure Payments**: Tokenized bKash checkout integration.
- **Admin Dashboard**: Real-time stats, volume tracking, and transaction history.
- **Refund Management**: Full and partial refund support with audit logs.
- **Offline Ready**: PWA support with IndexedDB for offline transaction viewing and action queuing.
- **System Logs**: Detailed API and system logging for debugging.
- **Easy Deployment**: Optimized for cPanel Node.js 18.x with a simple `server.js` entry point.

## Installation (cPanel)

1. **Upload Files**: Upload all project files to your cPanel directory (e.g., `public_html/bkash-pay`).
2. **Setup Node.js App**:
   - Go to **Setup Node.js App** in cPanel.
   - Click **Create Application**.
   - **Node.js version**: Select `18.x`.
   - **Application mode**: `production`.
   - **Application root**: Path to your files (e.g., `bkash-pay`).
   - **Application URL**: Your subdomain or domain.
   - **Application startup file**: `server.js`.
3. **Install Dependencies**:
   - Click **Run npm install** in the cPanel Node.js app interface.
4. **Environment Variables**:
   - Add these variables in the cPanel interface:
     - `PORT`: `3000`
     - `APP_URL`: `https://yourdomain.com`
     - `BKASH_APP_KEY`: Your bKash App Key
     - `BKASH_APP_SECRET`: Your bKash App Secret
     - `BKASH_USERNAME`: Your bKash Username
     - `BKASH_PASSWORD`: Your bKash Password
     - `BKASH_BASE_URL`: `https://tokenized.pay.bka.sh/v1.2.0-beta` (Sandbox) or Production URL.
5. **Restart**: Click **Restart** on the Node.js app.

## Default Credentials
- **Admin Username**: `admin`
- **Admin Password**: `admin123`
*(Change these in the Admin Profile section after first login)*

## Tech Stack
- **Frontend**: React, Tailwind CSS, Framer Motion, Lucide Icons.
- **Backend**: Node.js, Express, SQLite (better-sqlite3).
- **Database**: SQLite (Zero configuration required).
