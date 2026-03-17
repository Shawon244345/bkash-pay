# bKash Payment Gateway System (Node.js)

A full-featured, secure, and offline-ready bKash Payment Gateway system designed for easy deployment on cPanel or any Node.js environment.

## Features
- **Secure Payments**: Tokenized bKash checkout integration.
- **Admin Dashboard**: Real-time stats, volume tracking, and transaction history.
- **Refund Management**: Full and partial refund support with audit logs.
- **Offline Ready**: PWA support with IndexedDB for offline transaction viewing and action queuing.
- **System Logs**: Detailed API and system logging for debugging.
- **Easy Deployment**: Optimized for cPanel Node.js 18.x with a simple `server.js` entry point.

## Installation (Zero-Config Auto-Install)

This application is designed for **one-click deployment**. You don't even need to run `npm install` manually if you don't want to!

1. **Upload Files**:
   - Upload the project files (or ZIP) to your cPanel directory (e.g., `public_html/bkash`).
   - If using Git: `git clone https://github.com/yourusername/your-repo.git`

2. **Setup Node.js App**:
   - Go to **Setup Node.js App** in cPanel.
   - Click **Create Application**.
   - **Node.js version**: Select `18.x` or higher.
   - **Application mode**: `production`.
   - **Application root**: Path to your folder.
   - **Application URL**: Your domain (e.g., `bkash.egoluck.com`).
   - **Application startup file**: `server.js`.
   - Click **Create**.

3. **Visit Site & Auto-Install**:
   - Simply visit your domain in the browser.
   - The system will detect missing dependencies and **automatically run `npm install` and `npm run build`** for you.
   - You will see a "Initializing System" progress page.
   - Once finished, you'll be redirected to the **Setup Wizard** automatically!

## Default Credentials
- **Admin Username**: `admin`
- **Admin Password**: `admin123`
*(Change these in the Admin Profile section after first login)*

## Tech Stack
- **Frontend**: React, Tailwind CSS, Framer Motion, Lucide Icons.
- **Backend**: Node.js, Express, SQLite (sqlite3).
- **Database**: SQLite (Zero configuration required).

### 🛠 Troubleshooting (cPanel Errors)

If you encounter errors like `GLIBC_2.29 not found` or `EBADENGINE` during `npm install`:

1.  **Node.js Version**: Ensure you are using **Node.js 18 or 20** in the cPanel Node.js Selector.
2.  **Clear Cache**:
    *   Stop the application in cPanel.
    *   Delete `node_modules` and `package-lock.json` from your file manager.
    *   Remove any modules listed in the "Modules" section of the cPanel Node.js App setup (they should be installed via `package.json` instead).
3.  **SQLite Issues**: If `sqlite3` still fails to install due to `GLIBC` versions, it means your server's operating system is too old for the prebuilt binaries. 
    *   **Solution**: Contact your hosting provider to upgrade the OS, or ask them to install `sqlite3` globally for your Node.js version.
