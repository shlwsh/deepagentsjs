/**
 * 冲突解决处理模块
 * 使用模型自动读取被包含冲突标记的文件并将其解决后反馈写入
 */

import { HumanMessage } from "@langchain/core/messages";
import * as fs from "fs/promises";
import * as path from "path";
import { logger, llm } from "./shim";

/**
 * 解决给定文件中的冲突
 * 读取带有 `<<<<<<< HEAD` 冲突标识的文件，交给LLM解决并覆写结果。
 */
export async function resolveConflict(filePath: string): Promise<boolean> {
  logger.info(`开始分析并解决冲突: ${filePath}`);
  try {
    const absolutePath = path.resolve(process.cwd(), filePath);
    const fileContent = await fs.readFile(absolutePath, "utf-8");

    // 如果文件中没有冲突标记，可能结构上已经是某种有效解决（或者传入了错的文件）
    if (!fileContent.includes("<<<<<<<")) {
      logger.info(`${filePath} 中未找到标准的 conflict 标记，跳过。`);
      return true;
    }

    const prompt = `你是一个高级代码合并专家。以下文件由于拉取远程代码或者 stash pop 时产生了 Git 冲突。
冲突块包含了 \`<<<<<<< HEAD\` 到 \`=======\` 和 \`>>>>>>>\` 的内容。
你的任务是阅读并理解冲突前后的代码逻辑，智能地将多方修改融合成一段逻辑正确、无语法错误的代码。
特别注意：如果两边修改了同一块代码，请根据合理的业务逻辑合并它们，保留所有正确的逻辑。如果你发现一方是新加包引用，一方是删除无用库那就合并引用。

返回要求：
1. 只返回解决完冲突后的"完整文件合并代码内容"。
2. 使用 Markdown 的 \`\`\` 语法包裹返回的代码。例如 \`\`\`typescript 整体代码 \`\`\`，语言标识可以省略只需用 \`\`\` 包裹即可。
3. 绝对不要在最终代码里包含任何 \`<<<<<<<\`、\`=======\`、\`>>>>>>>\` 这样的 Git 冲突标记。
4. 不要添加任何分析或解答说明，只输出代码，因为我将直接提取代码块的内容覆写原文件。

以下引发冲突的相对路径文件名是： ${filePath}

该文件的完整内容如下：
\`\`\`
${fileContent}
\`\`\`

请输出解决冲突后合并得到的文件完整内容：
`;

    logger.debug(`调用 LLM 解决冲突: ${filePath}`);
    const response = await llm.invoke([new HumanMessage(prompt)]);
    const resolvedContent = extractCodeBlock(response.content.toString());

    if (resolvedContent && !resolvedContent.includes("<<<<<<<")) {
      await fs.writeFile(absolutePath, resolvedContent, "utf-8");
      logger.info(`${filePath} 冲突解决成功。`);
      return true;
    } else {
      logger.error(
        `${filePath} 冲突解决失败：模型返回结果依然包含冲突标记或无法提取。`,
      );
      return false;
    }
  } catch (error) {
    logger.error(`解决冲突出错 [${filePath}]:`, { error });
    return false;
  }
}

/**
 * 提取 markdown 代码块内容
 */
function extractCodeBlock(content: string): string {
  const match = content.match(/```[a-zA-Z]*\n([\s\S]*?)```/);
  if (match && match[1]) {
    return match[1].trim();
  }
  // 回退获取全部
  return content.trim();
}
