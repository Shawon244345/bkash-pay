import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// This is the entry point for cPanel's Node.js app.
// It starts the real server using tsx.
// Node 18 (cPanel) uses --loader, Node 20+ uses --import.

const nodeVersion = process.versions.node.split('.')[0];
const loaderFlag = parseInt(nodeVersion) >= 20 ? '--import' : '--loader';

console.log(`Starting server with Node ${process.version} using ${loaderFlag} tsx`);

const tsxPath = path.join(__dirname, 'node_modules', 'tsx', 'dist', 'loader.mjs');
const tsxExists = fs.existsSync(tsxPath);

const args = [loaderFlag, 'tsx', 'server.ts'];

// If we are on Node 18 and using --loader, we might need the full path to the loader in some environments
// but usually 'tsx' works if it's in node_modules.

const child = spawn('node', args, {
  cwd: __dirname,
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'production' }
});

child.on('close', (code) => {
  console.log(`Server process exited with code ${code}`);
  process.exit(code || 0);
});

child.on('error', (err) => {
  console.error('Failed to start server process:', err);
  process.exit(1);
});
