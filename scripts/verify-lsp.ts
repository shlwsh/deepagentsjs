#!/usr/bin/env bun

/**
 * LSP 配置验证脚本
 * 检查 TypeScript 和 Rust LSP 是否正确配置
 */

import { $ } from "bun";
import * as fs from "fs";
import * as path from "path";

interface CheckResult {
  name: string;
  passed: boolean;
  message: string;
}

const results: CheckResult[] = [];

async function checkTypeScriptConfig() {
  console.log("\n🔍 检查 TypeScript 配置...\n");

  // 检查根 tsconfig.json
  const rootTsConfig = path.join(process.cwd(), "tsconfig.json");
  if (fs.existsSync(rootTsConfig)) {
    results.push({
      name: "根 tsconfig.json",
      passed: true,
      message: "✓ 存在",
    });
  } else {
    results.push({
      name: "根 tsconfig.json",
      passed: false,
      message: "✗ 不存在",
    });
  }

  // 检查包级别的 tsconfig.json
  const packages = ["agent-service", "web", "knowledge-service", "file-service"];
  for (const pkg of packages) {
    const pkgTsConfig = path.join(
      process.cwd(),
      "packages",
      pkg,
      "tsconfig.json",
    );
    if (fs.existsSync(pkgTsConfig)) {
      results.push({
        name: `${pkg} tsconfig.json`,
        passed: true,
        message: "✓ 存在",
      });
    } else {
      results.push({
        name: `${pkg} tsconfig.json`,
        passed: false,
        message: "✗ 不存在",
      });
    }
  }

  // 检查 TypeScript 是否可用
  try {
    const result = await $`bunx tsc --version`.quiet();
    results.push({
      name: "TypeScript 编译器",
      passed: true,
      message: `✓ ${result.stdout.toString().trim()}`,
    });
  } catch {
    results.push({
      name: "TypeScript 编译器",
      passed: false,
      message: "✗ 不可用",
    });
  }
}

async function checkRustConfig() {
  console.log("\n🦀 检查 Rust 配置...\n");

  // 检查 Cargo.toml workspace
  const rootCargo = path.join(process.cwd(), "Cargo.toml");
  if (fs.existsSync(rootCargo)) {
    const content = fs.readFileSync(rootCargo, "utf-8");
    if (content.includes("[workspace]")) {
      results.push({
        name: "Cargo workspace",
        passed: true,
        message: "✓ 已配置",
      });
    } else {
      results.push({
        name: "Cargo workspace",
        passed: false,
        message: "✗ 未配置 workspace",
      });
    }
  } else {
    results.push({
      name: "Cargo.toml",
      passed: false,
      message: "✗ 不存在",
    });
  }

  // 检查 rust-toolchain.toml
  const rustToolchain = path.join(process.cwd(), "rust-toolchain.toml");
  if (fs.existsSync(rustToolchain)) {
    results.push({
      name: "rust-toolchain.toml",
      passed: true,
      message: "✓ 存在",
    });
  } else {
    results.push({
      name: "rust-toolchain.toml",
      passed: false,
      message: "✗ 不存在",
    });
  }

  // 检查 Rust 工具链
  try {
    const cargoResult = await $`cargo --version`.quiet();
    results.push({
      name: "Cargo",
      passed: true,
      message: `✓ ${cargoResult.stdout.toString().trim()}`,
    });
  } catch {
    results.push({
      name: "Cargo",
      passed: false,
      message: "✗ 未安装",
    });
  }

  try {
    const rustcResult = await $`rustc --version`.quiet();
    results.push({
      name: "Rustc",
      passed: true,
      message: `✓ ${rustcResult.stdout.toString().trim()}`,
    });
  } catch {
    results.push({
      name: "Rustc",
      passed: false,
      message: "✗ 未安装",
    });
  }

  // 检查 rust-analyzer
  try {
    const raResult = await $`rustup component list | grep rust-analyzer`.quiet();
    if (raResult.stdout.toString().includes("installed")) {
      results.push({
        name: "rust-analyzer",
        passed: true,
        message: "✓ 已安装",
      });
    } else {
      results.push({
        name: "rust-analyzer",
        passed: false,
        message: "✗ 未安装",
      });
    }
  } catch {
    results.push({
      name: "rust-analyzer",
      passed: false,
      message: "✗ 无法检查",
    });
  }
}

async function checkVSCodeConfig() {
  console.log("\n⚙️  检查 VSCode 配置...\n");

  // 检查 .vscode/settings.json
  const vscodeSettings = path.join(process.cwd(), ".vscode", "settings.json");
  if (fs.existsSync(vscodeSettings)) {
    const content = fs.readFileSync(vscodeSettings, "utf-8");

    // 检查 TypeScript 配置
    if (content.includes("typescript.tsdk")) {
      results.push({
        name: "TypeScript LSP 配置",
        passed: true,
        message: "✓ 已配置",
      });
    } else {
      results.push({
        name: "TypeScript LSP 配置",
        passed: false,
        message: "✗ 缺少配置",
      });
    }

    // 检查 Rust 配置
    if (content.includes("rust-analyzer")) {
      results.push({
        name: "Rust LSP 配置",
        passed: true,
        message: "✓ 已配置",
      });
    } else {
      results.push({
        name: "Rust LSP 配置",
        passed: false,
        message: "✗ 缺少配置",
      });
    }

    // 检查 Vue 配置
    if (content.includes("vue.server.hybridMode")) {
      results.push({
        name: "Vue LSP 配置",
        passed: true,
        message: "✓ 已配置",
      });
    } else {
      results.push({
        name: "Vue LSP 配置",
        passed: false,
        message: "✗ 缺少配置",
      });
    }
  } else {
    results.push({
      name: ".vscode/settings.json",
      passed: false,
      message: "✗ 不存在",
    });
  }

  // 检查 extensions.json
  const extensionsJson = path.join(
    process.cwd(),
    ".vscode",
    "extensions.json",
  );
  if (fs.existsSync(extensionsJson)) {
    results.push({
      name: ".vscode/extensions.json",
      passed: true,
      message: "✓ 存在",
    });
  } else {
    results.push({
      name: ".vscode/extensions.json",
      passed: false,
      message: "✗ 不存在",
    });
  }

  // 检查 tasks.json
  const tasksJson = path.join(process.cwd(), ".vscode", "tasks.json");
  if (fs.existsSync(tasksJson)) {
    results.push({
      name: ".vscode/tasks.json",
      passed: true,
      message: "✓ 存在",
    });
  } else {
    results.push({
      name: ".vscode/tasks.json",
      passed: false,
      message: "✗ 不存在",
    });
  }

  // 检查 launch.json
  const launchJson = path.join(process.cwd(), ".vscode", "launch.json");
  if (fs.existsSync(launchJson)) {
    results.push({
      name: ".vscode/launch.json",
      passed: true,
      message: "✓ 存在",
    });
  } else {
    results.push({
      name: ".vscode/launch.json",
      passed: false,
      message: "✗ 不存在",
    });
  }
}

function printResults() {
  console.log("\n" + "=".repeat(60));
  console.log("📊 LSP 配置检查结果");
  console.log("=".repeat(60) + "\n");

  const maxNameLength = Math.max(...results.map((r) => r.name.length));

  for (const result of results) {
    const paddedName = result.name.padEnd(maxNameLength);
    const icon = result.passed ? "✅" : "❌";
    console.log(`${icon} ${paddedName}  ${result.message}`);
  }

  const passedCount = results.filter((r) => r.passed).length;
  const totalCount = results.length;
  const percentage = ((passedCount / totalCount) * 100).toFixed(1);

  console.log("\n" + "=".repeat(60));
  console.log(
    `总计: ${passedCount}/${totalCount} 通过 (${percentage}%)`,
  );
  console.log("=".repeat(60) + "\n");

  if (passedCount === totalCount) {
    console.log("🎉 所有检查通过！LSP 配置完整。\n");
    process.exit(0);
  } else {
    console.log("⚠️  部分检查未通过，请查看上述结果。\n");
    console.log("💡 提示：运行以下命令修复常见问题：");
    console.log("   - TypeScript: bun install");
    console.log("   - Rust: rustup component add rust-analyzer clippy rustfmt");
    console.log("\n");
    process.exit(1);
  }
}

async function main() {
  console.log("🚀 开始 LSP 配置验证...");

  await checkTypeScriptConfig();
  await checkRustConfig();
  await checkVSCodeConfig();

  printResults();
}

main().catch((error) => {
  console.error("❌ 验证失败:", error);
  process.exit(1);
});
