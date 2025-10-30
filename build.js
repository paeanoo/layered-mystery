#!/usr/bin/env node
// 构建脚本 - 直接导入并执行 vite CLI
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const require = createRequire(import.meta.url);
const vitePath = resolve(__dirname, 'node_modules', 'vite', 'bin', 'vite.js');

// 直接使用 node 执行 vite
import { spawn } from 'child_process';

const args = ['build', ...process.argv.slice(2).filter(arg => arg !== 'build')];
const child = spawn('node', [vitePath, ...args], {
  stdio: 'inherit',
  cwd: __dirname
});

child.on('error', (error) => {
  console.error('构建失败:', error);
  process.exit(1);
});

child.on('exit', (code) => {
  process.exit(code || 0);
});

