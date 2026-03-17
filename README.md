# bKash Payment Gateway System (Node.js)

A full-featured, secure, and offline-ready bKash Payment Gateway system designed for easy deployment on cPanel or any Node.js environment.

## Features
- **Secure Payments**: Tokenized bKash checkout integration.
- **Admin Dashboard**: Real-time stats, volume tracking, and transaction history.
- **Refund Management**: Full and partial refund support with audit logs.
- **Offline Ready**: PWA support with IndexedDB for offline transaction viewing and action queuing.
- **System Logs**: Detailed API and system logging for debugging.
- **Easy Deployment**: Optimized for cPanel Node.js 18.x with a simple `server.js` entry point.

## Installation (cPanel Git Workflow)

1. **Clone the Repository**:
   - Open your cPanel Terminal or SSH.
   - Run: `git clone https://github.com/yourusername/your-repo-name.git`
   - Navigate to the folder: `cd your-repo-name`

2. **Install & Build**:
   - Run: `npm install`
   - *Note: The `postinstall` script will automatically run `npm run build` to compile the frontend and backend.*

3. **Setup Node.js App**:
   - Go to **Setup Node.js App** in cPanel.
   - Click **Create Application**.
   - **Node.js version**: Select `18.x` or higher.
   - **Application mode**: `production`.
   - **Application root**: Path to your folder (e.g., `your-repo-name`).
   - **Application URL**: Your domain (e.g., `payments.yourdomain.com`).
   - **Application startup file**: `server.js`.
   - Click **Create**.

4. **Web Setup Wizard**:
   - Visit your Application URL in your browser.
   - You will be automatically redirected to the **Setup Wizard**.
   - Follow the steps to configure your bKash API credentials and Admin account.

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
