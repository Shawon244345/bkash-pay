import { spawn } from 'child_process';
import { existsSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import http from 'http';

const PORT = process.env.PORT || 3000;
const LOCK_FILE = join(process.cwd(), '.installing.lock');
const PROGRESS_FILE = join(process.cwd(), '.install_progress.json');

function updateProgress(step, percent, message) {
  try {
    writeFileSync(PROGRESS_FILE, JSON.stringify({ step, percent, message, timestamp: Date.now() }));
  } catch (e) {}
}

function getProgress() {
  try {
    if (existsSync(PROGRESS_FILE)) {
      return JSON.parse(readFileSync(PROGRESS_FILE, 'utf8'));
    }
  } catch (e) {}
  return { step: 0, percent: 0, message: 'Initializing...' };
}

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
    updateProgress(1, 10, 'Starting installation...');

    if (!existsSync(join(process.cwd(), 'node_modules'))) {
      console.log('node_modules not found. Installing dependencies...');
      updateProgress(2, 30, 'Installing dependencies (npm install)...');
      await runCommand('npm', ['install', '--no-audit', '--no-fund', '--prefer-offline']);
    }

    if (!existsSync(join(process.cwd(), 'dist/server.js'))) {
      console.log('dist/server.js not found. Building application...');
      updateProgress(3, 70, 'Building application (vite build)...');
      await runCommand('npm', ['run', 'build']);
    }

    updateProgress(4, 100, 'Ready! Starting application...');
    console.log('Application is ready.');
  } catch (err) {
    updateProgress(-1, 0, `Error: ${err.message}`);
    console.error('Bootstrap error:', err);
    throw err;
  } finally {
    // We keep the progress file for a few seconds so the UI can see 100%
    setTimeout(() => {
      if (existsSync(LOCK_FILE)) {
        try {
          const { unlinkSync } = await import('fs');
          unlinkSync(LOCK_FILE);
        } catch (e) {}
      }
    }, 2000);
  }
}

const server = http.createServer((req, res) => {
  if (req.url === '/api/progress') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(getProgress()));
    return;
  }

  const progress = getProgress();
  const isError = progress.step === -1;

  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(`
    <html>
      <head>
        <title>Setting up bKash Gateway...</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f9fafb; color: #111827; }
          .card { background: white; padding: 2.5rem; border-radius: 1rem; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1); text-align: center; max-width: 450px; width: 100%; }
          .spinner { border: 3px solid #e5e7eb; border-left-color: #d1126d; border-radius: 50%; width: 48px; height: 48px; animation: spin 1s linear infinite; margin: 0 auto 1.5rem; }
          h1 { font-size: 1.5rem; font-weight: 700; margin-bottom: 0.75rem; color: #d1126d; }
          p { color: #4b5563; line-height: 1.5; margin-bottom: 1.5rem; }
          .progress-container { background: #f3f4f6; border-radius: 999px; height: 12px; width: 100%; margin-bottom: 0.5rem; overflow: hidden; }
          .progress-bar { background: #d1126d; height: 100%; width: 0%; transition: width 0.5s ease; }
          .status-text { font-size: 0.875rem; color: #6b7280; font-weight: 500; }
          .error { color: #ef4444; font-weight: 600; }
          @keyframes spin { to { transform: rotate(360deg); } }
        </style>
      </head>
      <body>
        <div class="card">
          ${isError ? '' : '<div class="spinner"></div>'}
          <h1>${isError ? 'Setup Failed' : 'Initializing System'}</h1>
          <p>${isError ? 'An error occurred during installation. Please check your server logs.' : 'We are setting up your bKash Payment Gateway. This process is automated and will take a moment.'}</p>
          
          <div class="progress-container">
            <div id="bar" class="progress-bar" style="width: ${progress.percent}%"></div>
          </div>
          <div id="status" class="status-text ${isError ? 'error' : ''}">${progress.message}</div>

          <script>
            async function checkProgress() {
              try {
                const res = await fetch('/api/progress');
                const data = await res.json();
                document.getElementById('bar').style.width = data.percent + '%';
                document.getElementById('status').innerText = data.message;
                
                if (data.step === -1) {
                  document.getElementById('status').classList.add('error');
                  return;
                }

                if (data.percent >= 100) {
                  setTimeout(() => window.location.reload(), 2000);
                  return;
                }
                setTimeout(checkProgress, 1000);
              } catch (e) {
                setTimeout(checkProgress, 2000);
              }
            }
            checkProgress();
          </script>
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
