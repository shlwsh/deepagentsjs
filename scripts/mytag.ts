#!/usr/bin/env bun
/**
 * 自动版本升级、提交代码并创建 Git Tag
 * 集成 AI 生成变更描述
 * 完全不依赖服务，直接操作本地文件
 */

import { upgradeVersion } from "./ai-upgrade-version";

interface MyTagOptions {
  remote?: string;
  skipPush?: boolean;
}

/**
 * 检查 Git 状态
 */
async function checkGitStatus(): Promise<boolean> {
  try {
    const proc = Bun.spawn(["git", "status", "--short"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const status = await new Response(proc.stdout).text();
    return status.trim().length > 0;
  } catch (error: any) {
    console.error(`❌ 检查 Git 状态失败: ${error.message}`);
    return false;
  }
}

/**
 * 提交所有变更
 */
async function commitChanges(message: string): Promise<void> {
  console.log("\n📝 提交代码变更...");

  try {
    // 添加所有变更
    const addProc = Bun.spawn(["git", "add", "-A"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    await addProc.exited;
    console.log("   ✓ 已添加所有变更");

    // 提交变更
    const commitProc = Bun.spawn(["git", "commit", "-m", message], {
      stdout: "pipe",
      stderr: "pipe",
    });

    await commitProc.exited;

    if (commitProc.exitCode !== 0) {
      const stderr = await new Response(commitProc.stderr).text();
      throw new Error(stderr || "提交失败");
    }

    console.log(`   ✓ 已提交: ${message}`);
  } catch (error: any) {
    throw new Error(`提交失败: ${error.message}`);
  }
}

/**
 * 创建 Git Tag
 */
async function createTag(version: string, message: string): Promise<void> {
  console.log("\n🏷️  创建 Git Tag...");

  try {
    // 创建带注释的标签
    const proc = Bun.spawn(["git", "tag", "-a", version, "-m", message], {
      stdout: "pipe",
      stderr: "pipe",
    });

    await proc.exited;

    if (proc.exitCode !== 0) {
      const stderr = await new Response(proc.stderr).text();
      throw new Error(stderr || "创建标签失败");
    }

    console.log(`   ✓ 已创建标签: ${version}`);
  } catch (error: any) {
    throw new Error(`创建标签失败: ${error.message}`);
  }
}

/**
 * 推送到远程仓库
 */
async function pushToRemote(remote: string): Promise<void> {
  console.log("\n🚀 推送到远程仓库...");

  try {
    // 推送代码
    const pushProc = Bun.spawn(["git", "push", remote], {
      stdout: "pipe",
      stderr: "pipe",
    });

    await pushProc.exited;

    if (pushProc.exitCode !== 0) {
      const stderr = await new Response(pushProc.stderr).text();
      throw new Error(stderr || "推送代码失败");
    }

    console.log(`   ✓ 已推送代码到 ${remote}`);

    // 推送标签
    const tagProc = Bun.spawn(["git", "push", remote, "--tags"], {
      stdout: "pipe",
      stderr: "pipe",
    });

    await tagProc.exited;

    if (tagProc.exitCode !== 0) {
      const stderr = await new Response(tagProc.stderr).text();
      throw new Error(stderr || "推送标签失败");
    }

    console.log(`   ✓ 已推送标签到 ${remote}`);
  } catch (error: any) {
    throw new Error(`推送失败: ${error.message}`);
  }
}

/**
 * 执行完整的版本发布流程
 */
async function myTag(options: MyTagOptions = {}) {
  const { remote = "origin", skipPush = false } = options;

  console.log("🎯 开始自动版本发布流程...\n");
  console.log("=".repeat(60));

  try {
    // 1. 检查是否有变更
    console.log("\n📋 检查代码变更...");
    const hasChanges = await checkGitStatus();

    if (!hasChanges) {
      console.log("   ℹ️  没有需要提交的变更");
    } else {
      console.log("   ✓ 发现代码变更");
    }

    // 2. 升级版本（使用 AI 生成描述）
    console.log("\n" + "=".repeat(60));
    const upgradeResult = await upgradeVersion();

    if (!upgradeResult.upgraded) {
      console.log("\n⚠️  版本未升级，流程终止");
      return;
    }

    const { newVersion, description } = upgradeResult;

    // 3. 提交变更（包括版本文件）
    console.log("\n" + "=".repeat(60));
    await commitChanges(`${description} (v${newVersion})`);

    // 4. 创建标签
    console.log("\n" + "=".repeat(60));
    await createTag(newVersion, description);

    // 5. 推送到远程
    if (!skipPush) {
      console.log("\n" + "=".repeat(60));
      await pushToRemote(remote);
    } else {
      console.log("\n⏭️  跳过推送到远程仓库");
    }

    // 6. 完成
    console.log("\n" + "=".repeat(60));
    console.log("\n✨ 版本发布完成！");
    console.log(`   版本号: ${newVersion}`);
    console.log(`   标签: ${newVersion}`);
    console.log(`   描述: ${description}`);

    if (!skipPush) {
      console.log(`   远程: ${remote}`);
    }

    console.log("\n🎉 所有操作已成功完成！");
  } catch (error: any) {
    console.error(`\n❌ 版本发布失败: ${error.message}`);
    console.error("\n💡 提示: 请检查以下内容：");
    console.error("   1. Git 仓库状态是否正常");
    console.error("   2. 是否有权限推送到远程仓库");
    console.error("   3. DASHSCOPE_API_KEY 是否配置正确");
    process.exit(1);
  }
}

/**
 * 显示使用帮助
 */
function showHelp() {
  console.log(`
📖 自动版本发布脚本使用说明

用法:
  bun run mytag [选项]

选项:
  --help, -h              显示帮助信息
  --remote REMOTE         远程仓库名称 (默认: origin)
  --skip-push             跳过推送到远程仓库

示例:
  # 基本用法（自动完成所有步骤）
  bun run mytag

  # 跳过推送到远程
  bun run mytag --skip-push

  # 指定远程仓库
  bun run mytag --remote upstream

功能说明:
  1. 自动分析 Git 变更内容
  2. 使用 DashScope AI 生成简洁的变更描述
  3. 直接操作本地版本文件（不依赖服务）
  4. 自动升级版本号
  5. 提交所有代码变更
  6. 创建 Git Tag（标签名为版本号）
  7. 推送代码和标签到远程仓库

AI 配置:
  - 从 .env 文件读取 DASHSCOPE_API_KEY
  - 从 .env 文件读取 DASHSCOPE_MODEL (默认: deepseek-v3)
  - 从 .env 文件读取 DASHSCOPE_BASE_URL

注意事项:
  - 确保 DASHSCOPE_API_KEY 已配置
  - 确保有 Git 仓库的推送权限
  - 建议在发布前先测试功能
`);
}

/**
 * 解析命令行参数
 */
function parseArgs(args: string[]): MyTagOptions & { help?: boolean } {
  const options: MyTagOptions & { help?: boolean } = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case "--help":
      case "-h":
        options.help = true;
        break;

      case "--remote":
        if (i + 1 < args.length) {
          options.remote = args[++i];
        }
        break;

      case "--skip-push":
        options.skipPush = true;
        break;

      default:
        // 忽略未知参数
        break;
    }
  }

  return options;
}

// 主程序
async function main() {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  if (options.help || args.includes("--help") || args.includes("-h")) {
    showHelp();
    return;
  }

  await myTag(options);
}

// 运行主程序
if (import.meta.main) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

export { myTag };
