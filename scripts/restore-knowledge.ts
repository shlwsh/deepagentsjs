import * as fs from "fs";
import * as path from "path";

const localKnowledgeDir = "C:\\Users\\Administrator\\.gemini\\antigravity\\knowledge";
const projectKnowledgeDir = path.join(process.cwd(), "knowledge");

try {
  console.log("=== 恢复知识库内容至本地系统 ===");
  
  if (!fs.existsSync(localKnowledgeDir)) {
    fs.mkdirSync(localKnowledgeDir, { recursive: true });
  }

  if (!fs.existsSync(projectKnowledgeDir)) {
    console.error(`❌ 项目知识库备份目录不存在: ${projectKnowledgeDir}`);
    process.exit(1);
  }

  console.log(`📥 来源: ${projectKnowledgeDir}`);
  console.log(`📤 目标: ${localKnowledgeDir}`);
  
  fs.cpSync(projectKnowledgeDir, localKnowledgeDir, { recursive: true, force: true });
  
  console.log("✅ 知识库数据恢复成功！");
} catch (error) {
  console.error("❌ 恢复知识库数据失败:", error);
  process.exit(1);
}
