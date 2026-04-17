#!/usr/bin/env bun

/**
 * TypeScript LSP 配置验证脚本
 *
 * 此脚本验证 TypeScript LSP 配置是否正确设置
 */

import { existsSync } from 'fs';
import { join } from 'path';

interface CheckResult {
  name: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
}

const results: CheckResult[] = [];

function check(name: string, condition: boolean, passMsg: string, failMsg: string): void {
  results.push({
    name,
    status: condition ? 'pass' : 'fail',
    message: condition ? passMsg : failMsg
  });
}

function warn(name: string, message: string): void {
  results.push({
    name,
    status: 'warning',
    message
  });
}

console.log('🔍 验证 TypeScript LSP 配置...\n');

// 1. 检查 TypeScript 安装
try {
  const proc = Bun.spawnSync(['bunx', 'tsc', '--version']);
  const version = new TextDecoder().decode(proc.stdout).trim();
  check('TypeScript 安装', proc.exitCode === 0, `✓ ${version}`, '✗ TypeScript 未安装');
} catch (e) {
  check('TypeScript 安装', false, '', '✗ TypeScript 未安装');
}

// 2. 检查 vue-tsc 安装
try {
  const proc = Bun.spawnSync(['bunx', 'vue-tsc', '--version'], {
    cwd: join(process.cwd(), 'packages/web')
  });
  const version = new TextDecoder().decode(proc.stdout).trim();
  check('Vue TypeScript 安装', proc.exitCode === 0, `✓ vue-tsc ${version}`, '✗ vue-tsc 未安装');
} catch (e) {
  check('Vue TypeScript 安装', false, '', '✗ vue-tsc 未安装');
}

// 3. 检查配置文件
const configFiles = [
  { path: '.vscode/settings.json', name: 'VSCode 设置' },
  { path: '.vscode/extensions.json', name: 'VSCode 扩展推荐' },
  { path: '.vscode/launch.json', name: 'VSCode 调试配置' },
  { path: '.vscode/tasks.json', name: 'VSCode 任务配置' },
  { path: 'tsconfig.json', name: '根 tsconfig.json' },
  { path: 'packages/agent-service/tsconfig.json', name: 'API tsconfig.json' },
  { path: 'packages/web/tsconfig.json', name: 'Web tsconfig.json' },
];

for (const { path, name } of configFiles) {
  const exists = existsSync(join(process.cwd(), path));
  check(name, exists, `✓ ${path} 存在`, `✗ ${path} 不存在`);
}

// 4. 检查文档
const docFiles = [
  'docs/TYPESCRIPT_LSP_GUIDE.md',
  'docs/TYPESCRIPT_LSP_QUICK_REF.md',
  'docs/TYPESCRIPT_LSP_SETUP_SUMMARY.md',
];

for (const path of docFiles) {
  const exists = existsSync(join(process.cwd(), path));
  check(`文档: ${path}`, exists, `✓ 存在`, `✗ 不存在`);
}

// 5. 检查 TypeScript 编译（API）
console.log('\n📦 检查 API 包类型...');
try {
  const proc = Bun.spawnSync(['bunx', 'tsc', '--noEmit'], {
    cwd: join(process.cwd(), 'packages/agent-service'),
    stderr: 'pipe',
    stdout: 'pipe'
  });
  const output = new TextDecoder().decode(proc.stderr) + new TextDecoder().decode(proc.stdout);
  const errorCount = (output.match(/error TS/g) || []).length;

  if (errorCount === 0) {
    check('API 包类型检查', true, '✓ 无类型错误', '');
  } else {
    warn('API 包类型检查', `⚠ 发现 ${errorCount} 个类型错误（不影响 LSP 功能）`);
  }
} catch (e) {
  warn('API 包类型检查', '⚠ 类型检查失败（不影响 LSP 功能）');
}

// 6. 检查 TypeScript 编译（Web）
console.log('📦 检查 Web 包类型...');
try {
  const proc = Bun.spawnSync(['bunx', 'vue-tsc', '--noEmit'], {
    cwd: join(process.cwd(), 'packages/web'),
    stderr: 'pipe',
    stdout: 'pipe'
  });
  const output = new TextDecoder().decode(proc.stderr) + new TextDecoder().decode(proc.stdout);
  const errorCount = (output.match(/error TS/g) || []).length;

  if (errorCount === 0) {
    check('Web 包类型检查', true, '✓ 无类型错误', '');
  } else {
    warn('Web 包类型检查', `⚠ 发现 ${errorCount} 个类型错误（不影响 LSP 功能）`);
  }
} catch (e) {
  warn('Web 包类型检查', '⚠ 类型检查失败（不影响 LSP 功能）');
}

// 输出结果
console.log('\n' + '='.repeat(60));
console.log('验证结果');
console.log('='.repeat(60) + '\n');

const passed = results.filter(r => r.status === 'pass').length;
const failed = results.filter(r => r.status === 'fail').length;
const warnings = results.filter(r => r.status === 'warning').length;

for (const result of results) {
  const icon = result.status === 'pass' ? '✓' : result.status === 'fail' ? '✗' : '⚠';
  const color = result.status === 'pass' ? '\x1b[32m' : result.status === 'fail' ? '\x1b[31m' : '\x1b[33m';
  console.log(`${color}${icon}\x1b[0m ${result.name}: ${result.message}`);
}

console.log('\n' + '='.repeat(60));
console.log(`总计: ${results.length} 项检查`);
console.log(`\x1b[32m✓ 通过: ${passed}\x1b[0m`);
if (failed > 0) console.log(`\x1b[31m✗ 失败: ${failed}\x1b[0m`);
if (warnings > 0) console.log(`\x1b[33m⚠ 警告: ${warnings}\x1b[0m`);
console.log('='.repeat(60) + '\n');

if (failed === 0) {
  console.log('🎉 TypeScript LSP 配置验证通过！\n');
  console.log('下一步：');
  console.log('1. 在 VSCode 中打开项目');
  console.log('2. 安装推荐的扩展（右下角会提示）');
  console.log('3. 选择工作区 TypeScript 版本（右下角点击版本号）');
  console.log('4. 打开任意 .ts 文件测试 LSP 功能');
  console.log('\n详细文档: docs/TYPESCRIPT_LSP_GUIDE.md');
  console.log('快速参考: docs/TYPESCRIPT_LSP_QUICK_REF.md\n');
  process.exit(0);
} else {
  console.log('❌ 配置验证失败，请检查上述错误\n');
  console.log('故障排查: docs/TYPESCRIPT_LSP_GUIDE.md#故障排查\n');
  process.exit(1);
}
