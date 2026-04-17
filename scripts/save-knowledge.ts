import * as fs from "fs";
import * as path from "path";

const localKnowledgeDir = "C:\\Users\\Administrator\\.gemini\\antigravity\\knowledge";
const projectKnowledgeDir = path.join(process.cwd(), "knowledge");

try {
  console.log("=== 保存知识库内容至项目 ===");
  
  if (!fs.existsSync(projectKnowledgeDir)) {
    fs.mkdirSync(projectKnowledgeDir, { recursive: true });
  }
  
  if (!fs.existsSync(localKnowledgeDir)) {
    console.error(`❌ 本地知识库目录不存在: ${localKnowledgeDir}`);
    process.exit(1);
  }

  console.log(`📥 来源: ${localKnowledgeDir}`);
  console.log(`📤 目标: ${projectKnowledgeDir}`);
  
  fs.cpSync(localKnowledgeDir, projectKnowledgeDir, { recursive: true, force: true });
  
  console.log("✅ 知识库数据保存成功！");
} catch (error) {
  console.error("❌ 保存知识库数据失败:", error);
  process.exit(1);
}
