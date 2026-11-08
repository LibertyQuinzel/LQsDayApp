// Cross-platform replacement for `env -u ELECTRON_RUN_AS_NODE electron .`
// (VS Code's terminal sets ELECTRON_RUN_AS_NODE, which makes Electron behave like plain Node.)
const { spawn } = require('node:child_process');
const path = require('node:path');
const electronPath = require('electron');

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

// An optional first argument that isn't a flag picks a different entry script (e.g. scripts/screenshots.cjs).
const args = process.argv.slice(2);
const entry = args[0] && !args[0].startsWith('-') ? args.shift() : path.join(__dirname, '..');

const child = spawn(electronPath, [entry, ...args], {
  stdio: 'inherit',
  env
});

child.on('exit', (code, signal) => process.exit(signal ? 1 : code ?? 0));
