import net from 'node:net';
import { spawn } from 'node:child_process';

const PORT = 1420;
const HOST = '127.0.0.1';

function isPortOpen(port, host) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;

    const finish = (value) => {
      if (!settled) {
        settled = true;
        socket.destroy();
        resolve(value);
      }
    };

    socket.setTimeout(600);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
    socket.connect(port, host);
  });
}

const occupied = await isPortOpen(PORT, HOST);
if (occupied) {
  console.log(`[tauri:dev] Reusing existing Vite dev server on http://localhost:${PORT}`);
  process.exit(0);
}

const child = process.platform === 'win32'
  ? spawn(
      process.env.ComSpec || 'cmd.exe',
      ['/d', '/s', '/c', `npm run dev -- --host 127.0.0.1 --port ${PORT}`],
      { stdio: 'inherit' }
    )
  : spawn(
      'npm',
      ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(PORT)],
      { stdio: 'inherit' }
    );

const forwardSignal = (signal) => {
  if (!child.killed) {
    child.kill(signal);
  }
};

process.on('SIGINT', () => forwardSignal('SIGINT'));
process.on('SIGTERM', () => forwardSignal('SIGTERM'));

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
