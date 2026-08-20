// Dev runner: starts the Express API (4100) and the Vite dev server (5173) together,
// with prefixed output. Deliberately dependency-free - no `concurrently` needed.
import { spawn } from 'node:child_process';

const procs = [];
let shuttingDown = false;

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const p of procs) {
    if (p.exitCode === null && !p.killed) p.kill();
  }
  process.exit(code);
}

function run(name, cmd, args, color) {
  const tag = `\x1b[${color}m[${name}]\x1b[0m `;
  const p = spawn(cmd, args, {
    shell: true,
    env: { ...process.env, NODE_ENV: process.env.NODE_ENV ?? 'development', FORCE_COLOR: '1' },
  });

  const pipe = (stream, out) => {
    let buf = '';
    stream.on('data', (d) => {
      buf += d.toString();
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';
      for (const line of lines) out.write(tag + line + '\n');
    });
  };
  pipe(p.stdout, process.stdout);
  pipe(p.stderr, process.stderr);

  p.on('exit', (code) => {
    process.stdout.write(tag + `exited with code ${code}\n`);
    shutdown(code ?? 0);
  });

  procs.push(p);
  return p;
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

run('api', 'node', ['server/src/index.js'], '36');
run('web', 'npm', ['--prefix', 'client', 'run', 'dev'], '35');

process.stdout.write('\nPixel Playground dev: API on http://localhost:4100, app on http://localhost:5173\n\n');
