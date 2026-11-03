import { spawn } from 'node:child_process';
await import('./ensure-electron.mjs');
const { default: electron } = await import('electron');
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(electron, ['tests/desktop-smoke.cjs'], { stdio: 'inherit', env });
const timer = setTimeout(() => { child.kill(); console.error('Electron smoke test timed out'); process.exitCode = 1; }, 30000);
child.on('exit', code => { clearTimeout(timer); process.exit(code ?? 1); });
child.on('error', error => { clearTimeout(timer); console.error(error); process.exit(1); });
