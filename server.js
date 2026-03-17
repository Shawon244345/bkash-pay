import { spawn } from 'child_process';
import { existsSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import http from 'http';

const PORT = process.env.PORT || 3000;
const LOCK_FILE = join(process.cwd(), '.installing.lock');

async function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    console.log(`Executing: ${command} ${args.join(' ')}`);
    const child = spawn(command, args, { stdio: 'inherit', shell: true });
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Command ${command} ${args.join(' ')} failed with code ${code}`));
    });
  });
}

async function bootstrap() {
  if (existsSync(LOCK_FILE)) {
    console.log('Installation already in progress, waiting...');
    return;
  }

  try {
    writeFileSync(LOCK_FILE, Date.now().toString());

    if (!existsSync(join(process.cwd(), 'node_modules'))) {
      console.log('node_modules not found. Installing dependencies...');
      await runCommand('npm', ['install']);
    }

    if (!existsSync(join(process.cwd(), 'dist/server.js'))) {
      console.log('dist/server.js not found. Building application...');
      await runCommand('npm', ['run', 'build']);
    }

    console.log('Application is ready.');
  } catch (err) {
    console.error('Bootstrap error:', err);
    throw err;
  } finally {
    if (existsSync(LOCK_FILE)) {
      try {
        const { unlinkSync } = await import('fs');
        unlinkSync(LOCK_FILE);
      } catch (e) {}
    }
  }
}

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(`
    <html>
      <head>
        <title>Setting up bKash Gateway...</title>
        <meta http-equiv="refresh" content="10">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f9fafb; color: #111827; }
          .card { background: white; padding: 2.5rem; border-radius: 1rem; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1); text-align: center; max-width: 400px; width: 100%; }
          .spinner { border: 3px solid #e5e7eb; border-left-color: #d1126d; border-radius: 50%; width: 48px; height: 48px; animation: spin 1s linear infinite; margin: 0 auto 1.5rem; }
          h1 { font-size: 1.5rem; font-weight: 700; margin-bottom: 0.75rem; color: #d1126d; }
          p { color: #4b5563; line-height: 1.5; margin-bottom: 1rem; }
          .status { font-size: 0.875rem; color: #9ca3af; font-style: italic; }
          @keyframes spin { to { transform: rotate(360deg); } }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="spinner"></div>
          <h1>Initializing System</h1>
          <p>We are setting up your bKash Payment Gateway. This includes installing dependencies and building the frontend.</p>
          <p class="status">Please do not close this window. We will redirect you once ready.</p>
        </div>
      </body>
    </html>
  `);
});

const startApp = async () => {
  try {
    await bootstrap();
    console.log('Starting the main application...');
    server.close(() => {
      import('./dist/server.js').catch(err => {
        console.error('Failed to start main app:', err);
        process.exit(1);
      });
    });
  } catch (err) {
    console.error('Critical bootstrap failure:', err);
    // Keep the status server running so the user sees the error? 
    // Or just exit.
  }
};

server.listen(PORT, () => {
  console.log(`Bootstrapper active on port ${PORT}`);
  startApp();
});
