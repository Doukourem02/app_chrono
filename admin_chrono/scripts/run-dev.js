#!/usr/bin/env node
/**
 * Lance Next avec -H 0.0.0.0 (localhost + LAN), et réécrit la ligne
 * « Network: http://0.0.0.0:3000 » en utilisant LAN_DEV_HOST (.env.local).
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const envPath = path.join(root, '.env.local');

function readLanDevHost() {
  if (!fs.existsSync(envPath)) return null;
  const text = fs.readFileSync(envPath, 'utf8');
  const m = text.match(/^LAN_DEV_HOST=(.+)$/m);
  return m ? m[1].trim() : null;
}

const lan = readLanDevHost();
const showLan =
  lan && lan !== '127.0.0.1' && lan !== 'localhost';

function patchChunk(text) {
  if (!showLan) return text;
  return text
    .replace(/http:\/\/0\.0\.0\.0:3000/g, `http://${lan}:3000`)
    .replace(/\b0\.0\.0\.0:3000\b/g, `${lan}:3000`);
}

function pipeWithPatch(src, dest) {
  let buf = '';
  src.on('data', (chunk) => {
    buf += chunk.toString();
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const line of lines) {
      dest.write(patchChunk(line) + '\n');
    }
  });
  src.on('end', () => {
    if (buf) dest.write(patchChunk(buf));
  });
}

const nextBin = path.join(root, 'node_modules', 'next', 'dist', 'bin', 'next');
const child = spawn(
  process.execPath,
  [nextBin, 'dev', '--webpack', '-H', '0.0.0.0'],
  {
    stdio: ['inherit', 'pipe', 'pipe'],
    cwd: root,
    env: {
      ...process.env,
      // Next voit stdout en pipe ; garde les couleurs si le terminal le supporte
      ...(process.stdout.isTTY ? { FORCE_COLOR: process.env.FORCE_COLOR ?? '1' } : {}),
    },
  }
);

pipeWithPatch(child.stdout, process.stdout);
pipeWithPatch(child.stderr, process.stderr);

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
