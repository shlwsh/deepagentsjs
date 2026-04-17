/**
 * 智能合并脚本
 * 封装并接管 git pull 流程，在发生冲突时自动接入LLM解决。
 */

import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { logger } from "../packages/agent-service/src/config/index";
import { resolveConflict } from "./conflict-resolver";
import {
    getConflictedFiles,
    getGitStatus,
    gitAdd,
    gitPull,
    gitStash,
    gitStashPop,
    isGitRepository
} from "./git-utils";

async function main() {
  logger.info("=".repeat(60));
  logger.info("Git 智能合并工具启动");
  logger.info("=".repeat(60));

  try {
    console.log("🔍 检查 Git 仓库状态...");
    const isRepo = await isGitRepository();
    if (!isRepo) {
      console.error("❌ 错误: 当前目录不是 Git 仓库");
      process.exit(1);
    }

    const initialStatus = await getGitStatus();
    let stashed = false;

    // 1. 如果工作区存在未提交变更，则进行 Stash 暂存
    if (initialStatus.hasChanges) {
      console.log(
        `📦 检测到工作区有未提交变更，执行 stash 暂存保护本地代码...`,
      );
      stashed = await gitStash("auto stash before smart merge");
      if (stashed) {
        console.log("✅ 工作区变更已暂存。");
      } else {
        console.log("⚠️ 暂存变更失败或无须暂存。");
      }
    }

    // 2. 以 rebase 形式拉取最新的远程代码
    console.log("⬇️ 正在拉取远程代码 (git pull --rebase)...");
    const pullSuccess = await gitPull(true);
    if (pullSuccess) {
      console.log("✅ 成功拉取远端代码并完成快进合并！");
    } else {
      console.log("⚠️ 拉取代码遭遇冲突/错误，转入 LLM 智能冲突分析流程！");
      await handleConflicts("pull");
    }

    // 3. 远端代码拉取/合并完毕后，若有刚才暂存过的修改，尝试 pop
    if (stashed) {
      console.log("📦 正在尝试还原本地暂存记录 (git stash pop)...");
      const popSuccess = await gitStashPop();
      if (popSuccess) {
        console.log("✅ 本地记录还原成功，与最新代码兼容合并。");
      } else {
        console.log("⚠️ 还原记录遭遇冲突，转入 LLM 智能冲突分析流程！");
        await handlePopConflicts();
      }
    }

    console.log(
      "\n🚀 智能合并流程已全部执行完毕！当前代码是最新的稳定混合版本。",
    );
    console.log(
      "💡 建议您检查系统（或可利用 `bun run mygit` 进行智能提交），或使用 `bun tsc` 测试编译。",
    );
  } catch (error) {
    console.error(
      "\n❌ 执行异常:",
      error instanceof Error ? error.message : String(error),
    );
    process.exit(1);
  }
}

/**
 * 专门处理 Rebase 拉取环节引发的冲突（考虑到可能包含多次补丁回放需要连续 --continue）
 */
async function handleConflicts(phase: "pull") {
  console.log(`🤖 开始检测并智能处理 ${phase} 引发的代码冲突...`);
  let loopCount = 0;
  const maxLoops = 15; // 设置最多允许循环的步数以防卡死

  while (loopCount < maxLoops) {
    loopCount++;
    let conflictedFiles = await getConflictedFiles();

    // 若当前循环没有冲突，判断下是否在 rebase 还未完全结束，如果是则尝试推 continue
    if (conflictedFiles.length === 0) {
      const isRebasing = isRebaseInProgress();
      if (isRebasing) {
        try {
          // 没有冲突，但处于 rebase 状态，意味着可以推进，使用 GIT_EDITOR 让它自动接受信息继续
          execSync("git -c core.editor=true rebase --continue", {
            stdio: "pipe",
          });
          continue;
        } catch (e: any) {
          const errMsg = (e.stderr || "").toString();
          if (
            errMsg.includes("No changes") ||
            errMsg.includes("apply changes")
          ) {
            try {
              execSync("git rebase --skip", { stdio: "pipe" });
            } catch {}
            continue;
          }
        }
      }
      break; // 既没冲突也没在 rebase 状态，代表冲突阶段结束
    }

    console.log(
      `[第${loopCount}步合并环节] 等待智能处理冲突文件数：${conflictedFiles.length}`,
    );
    let allResolved = true;

    for (const file of conflictedFiles) {
      console.log(`  - 🧠 正在通过大模型读取分析: ${file}`);
      const resolved = await resolveConflict(file);
      if (resolved) {
        console.log(`  ✔️ 成功生成并覆写合并代码: ${file}`);
        await gitAdd([file]); // ADD 该文件视作已解决
      } else {
        console.log(`  ❌ 智能合并失败，请手动介入！: ${file}`);
        allResolved = false;
      }
    }

    if (!allResolved) {
      console.log(
        "⚠️ 因未能全自动解决所有冲突，请手动检查文件。若想放弃本次合并可执行: `git pull --abort` 或 `git rebase --abort`。",
      );
      process.exit(1);
    }

    console.log(`⏩ 这一补丁的冲突已全部成功处理，推进 rebase 队列下一步...`);
    try {
      execSync("git -c core.editor=true rebase --continue", { stdio: "pipe" });
    } catch (e: any) {
      const errMsg = (e.stderr || "").toString();
      if (errMsg.includes("No changes") || errMsg.includes("apply changes")) {
        try {
          execSync("git rebase --skip", { stdio: "pipe" });
        } catch {}
      }
    }
  }

  if (loopCount >= maxLoops && isRebaseInProgress()) {
    console.log(
      "⚠️ Rebase 冲突补丁层级太深，达到了防护机制上限次数。剩余部分请手动执行 `git rebase --continue`。",
    );
  }
}

/**
 * 专门处理 Stash Pop 引发的冲突处理
 */
async function handlePopConflicts() {
  console.log(`🤖 开始处理 Pop 引入的代码冲突...`);
  let conflictedFiles = await getConflictedFiles();
  if (conflictedFiles.length === 0) {
    // 虽然抛错了，但居然没扫到文件，可能报错并不来自合并文本冲突
    return;
  }

  console.log(`📋 待解决的文件总计：${conflictedFiles.length}`);
  let allPopResolved = true;
  for (const file of conflictedFiles) {
    console.log(`  - 🧠 正在阅读分析冲突: ${file}`);
    const resolved = await resolveConflict(file);
    if (resolved) {
      console.log(`  ✔️ 内容已重组并覆写: ${file}`);
      await gitAdd([file]); // 标记状态为进入暂存
    } else {
      console.log(`  ❌ 无法全自动合并: ${file} 遗留待办！`);
      allPopResolved = false;
    }
  }

  if (allPopResolved) {
    console.log(
      "⏩ Pop 冲突已全面自动解决并且放入 Staging 区缓存！如果希望完全清除这个 Stash 请执行 `git stash drop`。",
    );
  }
}

function isRebaseInProgress(): boolean {
  const cwd = process.cwd();
  return (
    fs.existsSync(path.join(cwd, ".git", "rebase-merge")) ||
    fs.existsSync(path.join(cwd, ".git", "rebase-apply"))
  );
}

main();
