/**
 * Git 工具函数模块
 */

import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

/**
 * 执行 Git 命令
 */
async function execGit(
  command: string,
  cwd: string = process.cwd(),
): Promise<string> {
  try {
    const { stdout, stderr } = await execAsync(command, { cwd });
    if (stderr && !stderr.includes("warning")) {
      console.warn("Git 警告:", stderr);
    }
    return stdout.trim();
  } catch (error) {
    throw new Error(
      `Git 命令执行失败: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * 获取 Git 状态
 */
export async function getGitStatus(): Promise<{
  modified: string[];
  added: string[];
  deleted: string[];
  untracked: string[];
  hasChanges: boolean;
}> {
  const output = await execGit("git status --porcelain");

  const modified: string[] = [];
  const added: string[] = [];
  const deleted: string[] = [];
  const untracked: string[] = [];

  if (!output) {
    return { modified, added, deleted, untracked, hasChanges: false };
  }

  const lines = output.split("\n");
  for (const line of lines) {
    if (!line) continue;

    const status = line.substring(0, 2);
    const file = line.substring(3);

    if (status.includes("M")) {
      modified.push(file);
    } else if (status.includes("A")) {
      added.push(file);
    } else if (status.includes("D")) {
      deleted.push(file);
    } else if (status === "??") {
      untracked.push(file);
    }
  }

  const hasChanges =
    modified.length > 0 ||
    added.length > 0 ||
    deleted.length > 0 ||
    untracked.length > 0;

  return { modified, added, deleted, untracked, hasChanges };
}

/**
 * 获取文件差异
 * 如果完整 diff 失败（例如二进制文件问题），则返回统计信息
 */
export async function getGitDiff(files?: string[]): Promise<string> {
  try {
    // 检查是否有提交历史
    await execGit("git rev-parse HEAD");
    // 有提交历史,使用 diff HEAD
    let command = "git diff --no-ext-diff HEAD";
    if (files && files.length > 0) {
      command += " " + files.join(" ");
    }

    try {
      return await execGit(command);
    } catch (error) {
      // 如果 diff 失败（可能是二进制文件问题），使用 --stat 获取统计信息
      console.warn("⚠️  完整 diff 获取失败，使用统计信息代替");
      return await execGit(command.replace("git diff", "git diff --stat"));
    }
  } catch {
    // 没有提交历史(新仓库),使用 diff --cached 显示暂存区的内容
    let command = "git diff --no-ext-diff --cached";
    if (files && files.length > 0) {
      command += " " + files.join(" ");
    }

    try {
      return await execGit(command);
    } catch (error) {
      // 如果 diff 失败（可能是二进制文件问题），使用 --stat 获取统计信息
      console.warn("⚠️  完整 diff 获取失败，使用统计信息代替");
      return await execGit(command.replace("git diff", "git diff --stat"));
    }
  }
}

/**
 * 添加文件到暂存区
 */
export async function gitAdd(files: string[] = ["."]): Promise<void> {
  const fileList = files.join(" ");
  await execGit(`git add ${fileList}`);
}

/**
 * 提交代码
 */
export async function gitCommit(message: string): Promise<void> {
  // 转义提交信息中的引号
  const escapedMessage = message.replace(/"/g, '\\"');
  await execGit(`git commit -m "${escapedMessage}"`);
}

/**
 * 推送到远程仓库
 */
export async function gitPush(
  remote: string = "origin",
  branch?: string,
): Promise<void> {
  if (!branch) {
    // 获取当前分支
    branch = await execGit("git rev-parse --abbrev-ref HEAD");
  }
  await execGit(`git push ${remote} ${branch}`);
}

/**
 * 获取远程仓库信息
 */
export async function getRemoteInfo(): Promise<
  { name: string; url: string }[]
> {
  const output = await execGit("git remote -v");
  const remotes: { name: string; url: string }[] = [];

  const lines = output.split("\n");
  const seen = new Set<string>();

  for (const line of lines) {
    if (!line) continue;
    const parts = line.split(/\s+/);
    if (parts.length >= 2) {
      const key = `${parts[0]}-${parts[1]}`;
      if (!seen.has(key)) {
        seen.add(key);
        remotes.push({ name: parts[0], url: parts[1] });
      }
    }
  }

  return remotes;
}

/**
 * 检查是否在 Git 仓库中
 */
export async function isGitRepository(): Promise<boolean> {
  try {
    await execGit("git rev-parse --git-dir");
    return true;
  } catch {
    return false;
  }
}

/**
 * 获取存在冲突的文件列表
 */
export async function getConflictedFiles(): Promise<string[]> {
  try {
    const output = await execGit("git status --porcelain");
    const conflicted: string[] = [];
    const lines = output.split("\n");
    for (const line of lines) {
      if (!line) continue;
      const status = line.substring(0, 2);
      const file = line.substring(3).trim();
      // UU (双方修改), AA (双方添加), DD (双方删除), AU, UA, DU, UD 为常见未合并冲突状态
      if (["UU", "AA", "DD", "AU", "UA", "DU", "UD"].includes(status)) {
        conflicted.push(file);
      }
    }
    return conflicted;
  } catch (error) {
    return [];
  }
}

/**
 * 暂存本地修改
 */
export async function gitStash(
  message: string = "auto stash before smart merge",
): Promise<boolean> {
  try {
    const output = await execGit(`git stash save "${message}"`);
    return !output.includes("No local changes to save");
  } catch (error) {
    console.warn("git stash 失败:", error);
    return false;
  }
}

/**
 * 恢复暂存的修改
 */
export async function gitStashPop(): Promise<boolean> {
  try {
    await execGit("git stash pop");
    return true;
  } catch (error) {
    console.warn("git stash pop 产生冲突或失败:", error);
    return false;
  }
}

/**
 * 拉取远程代码
 */
export async function gitPull(
  rebase: boolean = true,
  remote: string = "origin",
  branch?: string,
): Promise<boolean> {
  if (!branch) {
    try {
      branch = await execGit("git rev-parse --abbrev-ref HEAD");
    } catch {
      branch = "main";
    }
  }
  const command = `git pull ${rebase ? "--rebase" : ""} ${remote} ${branch}`;
  try {
    await execGit(command);
    return true;
  } catch (error) {
    console.warn("git pull 产生冲突或失败:", error);
    return false;
  }
}

/**
 * 取消并终止合并 / rebase (出错时的清理操作)
 */
export async function gitAbort(): Promise<void> {
  try {
    await execGit("git rebase --abort");
  } catch {
    // 忽略
  }
  try {
    await execGit("git merge --abort");
  } catch {
    // 忽略
  }
}
