/**
 * Git 自动提交脚本
 * 自动检测变更、生成提交信息并推送到远程仓库
 */

import { logger } from "../packages/agent-service/src/config/index";
import {
    isGitRepository,
    getGitStatus,
    getGitDiff,
    gitAdd,
    gitCommit,
    gitPush,
    getRemoteInfo,
} from "./git-utils";
import { generateCommitMessage } from "./commit-message-generator";

async function main() {
    logger.info("=".repeat(60));
    logger.info("Git 自动提交工具启动");
    logger.info("=".repeat(60));

    try {
        // 1. 检查是否在 Git 仓库中
        logger.info("检查 Git 仓库...");
        const isRepo = await isGitRepository();
        if (!isRepo) {
            logger.error("当前目录不是 Git 仓库");
            console.error("❌ 错误: 当前目录不是 Git 仓库");
            process.exit(1);
        }
        logger.debug("Git 仓库检查通过");

        // 2. 获取 Git 状态
        logger.info("获取 Git 状态...");
        const status = await getGitStatus();

        if (!status.hasChanges) {
            logger.info("没有需要提交的变更");
            console.log("✅ 工作区是干净的,没有需要提交的变更");
            return;
        }

        logger.info("检测到文件变更", {
            modified: status.modified.length,
            added: status.added.length,
            deleted: status.deleted.length,
            untracked: status.untracked.length,
        });

        // 显示变更文件
        console.log("\n📝 检测到以下变更:");
        if (status.modified.length > 0) {
            console.log(`  修改: ${status.modified.join(", ")}`);
        }
        if (status.added.length > 0) {
            console.log(`  新增: ${status.added.join(", ")}`);
        }
        if (status.deleted.length > 0) {
            console.log(`  删除: ${status.deleted.join(", ")}`);
        }
        if (status.untracked.length > 0) {
            console.log(`  未跟踪: ${status.untracked.join(", ")}`);
        }
        console.log();

        // 3. 添加所有变更到暂存区
        logger.info("添加文件到暂存区...");
        await gitAdd();
        logger.debug("文件已添加到暂存区");

        // 4. 获取代码差异
        logger.info("获取代码差异...");
        const diff = await getGitDiff();
        logger.debug("代码差异获取完成", { diffLength: diff.length });

        // 5. 生成提交信息
        console.log("🤖 正在使用 AI 生成提交信息...\n");
        const commitMessage = await generateCommitMessage(status, diff);

        console.log("📋 生成的提交信息:");
        console.log("─".repeat(50));
        console.log(commitMessage);
        console.log("─".repeat(50));
        console.log();

        // 6. 提交代码
        logger.info("提交代码...");
        await gitCommit(commitMessage);
        logger.info("代码提交成功");
        console.log("✅ 代码已提交到本地仓库\n");

        // 7. 推送到远程仓库
        logger.info("获取远程仓库信息...");
        const remotes = await getRemoteInfo();

        if (remotes.length === 0) {
            logger.warn("未配置远程仓库");
            console.log("⚠️  未配置远程仓库,跳过推送步骤");
        } else {
            const remote = remotes[0];
            logger.info("推送到远程仓库", { remote: remote.name, url: remote.url });
            console.log(`🚀 正在推送到远程仓库 ${remote.name}...`);

            await gitPush(remote.name);

            logger.info("推送成功");
            console.log("✅ 代码已推送到远程仓库\n");
        }

        logger.info("=".repeat(60));
        logger.info("Git 自动提交完成");
        logger.info("=".repeat(60));

    } catch (error) {
        logger.error("执行失败", {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
        });

        console.error("\n❌ 执行失败:", error instanceof Error ? error.message : String(error));
        process.exit(1);
    }
}

main();
