/**
 * 提交信息生成器
 * 使用 LLM 分析代码变更并生成提交信息
 */

import { llm, logger } from "./shim";
import { HumanMessage } from "@langchain/core/messages";

/**
 * 生成提交信息
 */
export async function generateCommitMessage(
    status: {
        modified: string[];
        added: string[];
        deleted: string[];
        untracked: string[];
    },
    diff: string
): Promise<string> {
    logger.info("开始生成提交信息...");

    // 构建提示词
    const prompt = buildPrompt(status, diff);

    try {
        logger.debug("调用 LLM 生成提交信息");
        const response = await llm.invoke([new HumanMessage(prompt)]);
        const commitMessage = extractCommitMessage(response.content.toString());

        logger.info("提交信息生成成功", { length: commitMessage.length });
        return commitMessage;
    } catch (error) {
        logger.error("生成提交信息失败", { error });
        throw new Error(`生成提交信息失败: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * 构建提示词
 */
function buildPrompt(
    status: {
        modified: string[];
        added: string[];
        deleted: string[];
        untracked: string[];
    },
    diff: string
): string {
    const filesSummary = [];

    if (status.added.length > 0) {
        filesSummary.push(`新增文件: ${status.added.join(", ")}`);
    }
    if (status.modified.length > 0) {
        filesSummary.push(`修改文件: ${status.modified.join(", ")}`);
    }
    if (status.deleted.length > 0) {
        filesSummary.push(`删除文件: ${status.deleted.join(", ")}`);
    }
    if (status.untracked.length > 0) {
        filesSummary.push(`未跟踪文件: ${status.untracked.join(", ")}`);
    }

    // 限制 diff 长度,避免超过 token 限制
    const maxDiffLength = 3000;
    const truncatedDiff = diff.length > maxDiffLength
        ? diff.substring(0, maxDiffLength) + "\n...(内容已截断)"
        : diff;

    return `你是一个专业的代码提交信息生成助手。请根据以下代码变更信息,生成一个清晰、简洁的 Git 提交信息。

## 文件变更概况
${filesSummary.join("\n")}

## 代码差异
\`\`\`diff
${truncatedDiff}
\`\`\`

## 要求
1. 使用中文
2. 第一行是简短的标题(不超过50字)
3. 如果需要,可以添加详细说明(空一行后添加)
4. 标题要清晰描述主要变更内容
5. 使用常见的提交类型前缀(如: feat, fix, docs, style, refactor, test, chore)

请直接输出提交信息,不要添加任何解释或额外内容。`;
}

/**
 * 提取提交信息
 */
function extractCommitMessage(content: string): string {
    // 移除可能的 markdown 代码块标记
    let message = content.trim();

    // 移除开头的代码块标记
    message = message.replace(/^```[a-z]*\n/i, "");
    message = message.replace(/\n```$/i, "");

    // 移除可能的引导性文字
    const lines = message.split("\n");
    const filteredLines = lines.filter(line => {
        const lower = line.toLowerCase();
        return !lower.startsWith("提交信息:") &&
            !lower.startsWith("commit message:") &&
            !lower.startsWith("以下是") &&
            !lower.startsWith("here is");
    });

    return filteredLines.join("\n").trim();
}
