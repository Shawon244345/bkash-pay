# bKash Payment Gateway System (Node.js)

A full-featured, secure, and offline-ready bKash Payment Gateway system designed for easy deployment on cPanel or any Node.js environment.

## 🚀 Deployment Guide (cPanel)

There are two ways to deploy this project. Choose the one that fits you best.

### Option 1: The One-Click Way (Easiest)

This method uses our built-in **Auto-Bootstrapper**. You just upload the files, and the server handles the rest!

1.  **Upload Files**:
    *   ZIP the entire project folder (excluding `node_modules` if it exists).
    *   Upload and Extract it in your cPanel File Manager (e.g., in `public_html/bkash`).
2.  **Setup Node.js App**:
    *   Go to **Setup Node.js App** in cPanel.
    *   Click **Create Application**.
    *   **Node.js version**: Select `18.x` or `20.x`.
    *   **Application mode**: `production`.
    *   **Application root**: The folder where you extracted the files.
    *   **Application URL**: Your domain/subdomain.
    *   **Application startup file**: `server.js`.
    *   Click **Create** and then **Run JS Script** (or just Start the app).
3.  **Visit & Wait**:
    *   Open your domain in the browser.
    *   You will see an **"Initializing System"** page.
    *   The server is automatically running `npm install` and `npm run build` for you.
    *   Once finished (usually 1-2 minutes), the app will start automatically!

---

### Option 2: The Manual Way (Faster Startup)

If your cPanel has low RAM or CPU limits, it's better to "process" (build) the project on your computer before uploading.

1.  **Process (Build) Locally**:
    *   Open a terminal in the project folder on your computer.
    *   Run: `npm install`
    *   Run: `npm run build`
    *   This creates a `dist/` folder containing the compiled application.
2.  **Prepare for Upload**:
    *   Create a ZIP containing only these files/folders:
        *   `dist/`
        *   `package.json`
        *   `package-lock.json`
        *   `.env.example` (Rename to `.env` after upload)
        *   `server.js` (Required for cPanel startup)
3.  **Upload & Start**:
    *   Upload and Extract the ZIP to cPanel.
    *   Setup the Node.js App as described in Option 1.
    *   Click **Run NPM Install** in the Node.js App interface.
    *   **Restart** the application.

---

## ⚙️ Configuration (.env)

After uploading, make sure to configure your `.env` file with your database and bKash credentials:

```env
PORT=3000
JWT_SECRET=your_secret_key

# Database (MySQL)
DB_HOST=localhost
DB_USER=your_cpanel_db_user
DB_PASSWORD=your_cpanel_db_password
DB_NAME=your_cpanel_db_name

# bKash API (Sandbox or Live)
BKASH_APP_KEY=...
BKASH_APP_SECRET=...
BKASH_USERNAME=...
BKASH_PASSWORD=...
BKASH_BASE_URL=https://checkout.sandbox.bka.sh/v1.2.0-beta
APP_URL=https://yourdomain.com
```

## 🔑 Default Credentials
- **Admin Username**: `admin`
- **Admin Password**: `admin123`
*(Change these in the Admin Profile section after first login)*

## 🛠 Troubleshooting

1.  **"Production build not found"**: This means `npm run build` failed or wasn't run. Use Option 2 to build locally and upload the `dist` folder.
2.  **Database Connection Error**: Double-check your MySQL credentials in `.env`. Ensure the database user has all privileges.
3.  **Permissions**: Ensure the `uploads/` folder and `payments.db` (if using SQLite) have write permissions (755 or 777).
4.  **Node.js Version**: Always use **Node.js 18 or 20**. Older versions will cause errors.

---

## Features
- **Secure Payments**: Tokenized bKash checkout integration.
- **Admin Dashboard**: Real-time stats, volume tracking, and transaction history.
- **Refund Management**: Full and partial refund support with audit logs.
- **Offline Ready**: PWA support with IndexedDB for offline transaction viewing.
- **System Logs**: Detailed API and system logging for debugging.
