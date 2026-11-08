// Cross-platform replacement for `env -u ELECTRON_RUN_AS_NODE electron .`
// (VS Code's terminal sets ELECTRON_RUN_AS_NODE, which makes Electron behave like plain Node.)
const { spawn } = require('node:child_process');
const path = require('node:path');
const electronPath = require('electron');

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const child = spawn(electronPath, [path.join(__dirname, '..'), ...process.argv.slice(2)], {
  stdio: 'inherit',
  env
});

child.on('exit', (code, signal) => process.exit(signal ? 1 : code ?? 0));
