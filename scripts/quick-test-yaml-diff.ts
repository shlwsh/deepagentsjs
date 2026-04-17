/**
 * 快速测试 YAML 源码对比功能
 */

console.log("=".repeat(60));
console.log("YAML 源码对比功能快速测试");
console.log("=".repeat(60));

console.log("\n修复内容：");
console.log("1. 添加详细的调试日志到组件和页面");
console.log("2. 确保 props 传递时机正确（使用 nextTick）");
console.log("3. 修复对话框高度问题");
console.log("4. 改进 watch 函数的日志输出");

console.log("\n测试步骤：");
console.log("1. 启动服务：start-all.bat");
console.log("2. 访问：http://localhost:8911/workflow-editor");
console.log("3. 打开任意工作流文件");
console.log('4. 点击"源码"按钮');
console.log("5. 打开浏览器控制台（F12）查看日志");

console.log("\n预期看到的日志：");
console.log("");
console.log("[WorkflowEditorPage] 打开 YAML 源码对比查看器");
console.log("  - hasSavedContent: true");
console.log("  - savedContentLength: xxx");
console.log("  - editableContentLength: xxx");
console.log('  - savedPreview: version: "1.0"...');
console.log('  - editablePreview: version: "1.0"...');
console.log("");
console.log("[WorkflowYamlDiffViewer] 初始化编辑器");
console.log("  - originalLength: xxx");
console.log("  - modifiedLength: xxx");
console.log('  - originalPreview: version: "1.0"...');
console.log('  - modifiedPreview: version: "1.0"...');
console.log("");
console.log("[WorkflowYamlDiffViewer] 编辑器初始化完成");
console.log("  - originalModelValue: xxx");
console.log("  - modifiedModelValue: xxx");

console.log("\n如果左右两侧仍然为空：");
console.log("1. 检查 savedContentLength 和 editableContentLength 是否为 0");
console.log("2. 检查 originalModelValue 和 modifiedModelValue 是否为 0");
console.log("3. 检查是否有 JavaScript 错误");
console.log("4. 尝试刷新页面重新测试");

console.log("\n" + "=".repeat(60));
console.log("详细测试指南：scripts/test-yaml-diff-manual.md");
console.log("=".repeat(60));
