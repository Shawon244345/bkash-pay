import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// This is the entry point for cPanel's Node.js app.
// It starts the real server using tsx.
const child = spawn('node', ['--import', 'tsx', 'server.ts'], {
  cwd: __dirname,
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'production' }
});

child.on('close', (code) => {
  process.exit(code || 0);
});
