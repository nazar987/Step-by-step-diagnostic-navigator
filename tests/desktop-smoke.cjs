const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const testRoot = path.resolve('test-results/electron-profile');
fs.mkdirSync(testRoot, { recursive: true });
app.setPath('userData', testRoot);
app.on('browser-window-created', (_event, win) => win.hide());
require('../electron/main.cjs');
app.whenReady().then(async () => {
  try {
    const win = BrowserWindow.getAllWindows()[0];
    const web = win.webContents;
    if (web.isLoading()) await new Promise((resolve, reject) => {
      web.once('did-finish-load', resolve);
      web.once('did-fail-load', (_event, code, message) => reject(new Error(`${code}: ${message}`)));
    });
    const renderer = await web.executeJavaScript(`new Promise(resolve => {
      function check() {
        if (!document.querySelector('.question-heading')) return setTimeout(check, 50);
        resolve({title: document.title, leds: document.querySelectorAll('.led-panel [role=button]').length, options: document.querySelectorAll('.options button').length, heading: document.querySelector('.question-heading h2').textContent, nodeExposed: typeof window.require !== 'undefined'});
      } check();
    })`);
    assert.equal(renderer.leds, 50);
    assert.equal(renderer.options, 8);
    assert.equal(renderer.heading, 'Что наблюдаете на оборудовании?');
    assert.equal(renderer.nodeExposed, false);
    const preferences = web.getLastWebPreferences();
    assert.equal(preferences.nodeIntegration, false);
    assert.equal(preferences.contextIsolation, true);
    assert.equal(preferences.sandbox, true);
    const report = { passed: true, electron: process.versions.electron, renderer, security: { nodeIntegration: false, contextIsolation: true, sandbox: true } };
    fs.writeFileSync(path.resolve('test-results/desktop-smoke.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
    app.exit(0);
  } catch (error) { console.error(error); app.exit(1); }
});
