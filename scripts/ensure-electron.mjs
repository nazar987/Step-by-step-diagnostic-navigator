// В Electron 45 npm-пакет и загрузка бинарника разделены. Install.js идемпотентен.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const installer = require.resolve('electron/install.js');
await new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [installer], { stdio: 'inherit' });
  child.on('exit', code => code === 0 ? resolve() : reject(new Error(`Electron installer exited with ${code}`)));
  child.on('error', reject);
});
