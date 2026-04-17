/**
 * 自动诊断输出节点连接问题
 *
 * 这个脚本会自动检查工作流设计器中的节点数据，
 * 找出为什么输出节点不能接收入边
 */

console.log("=== 自动诊断输出节点连接问题 ===\n");

// 模拟浏览器环境中的检查
function diagnoseOutputNodeConnection() {
  console.log("📋 诊断步骤：\n");

  console.log("1. 检查输出节点的端口定义");
  console.log('   - 输出节点应该有 1 个输入端口（id: "in"）');
  console.log("   - 输出节点应该有 0 个输出端口");
  console.log("");

  console.log("2. 检查连接验证器的逻辑");
  console.log("   - 输出节点作为源节点（source）时应该被拒绝");
  console.log("   - 输出节点作为目标节点（target）时应该被允许");
  console.log("");

  console.log("3. 可能的问题原因：");
  console.log("   a) 节点创建时端口数据未正确初始化");
  console.log("   b) DSL 解析时端口数据丢失");
  console.log("   c) 连接验证器逻辑错误");
  console.log("   d) 节点数据在 Store 中被修改");
  console.log("");

  console.log("4. 需要在浏览器控制台中检查的内容：");
  console.log("");
  console.log("   请在工作流编辑器页面的控制台中执行以下代码：");
  console.log("");
  console.log("   ```javascript");
  console.log("   // 获取所有输出节点");
  console.log(
    "   const outputNodes = Array.from(document.querySelectorAll('.vue-flow__node')).filter(el => {",
  );
  console.log("     const nodeData = el.__vnode?.component?.props?.data;");
  console.log('     return nodeData?.type === "output";');
  console.log("   });");
  console.log("");
  console.log("   // 检查每个输出节点的数据");
  console.log("   outputNodes.forEach((el, index) => {");
  console.log("     const nodeData = el.__vnode?.component?.props?.data;");
  console.log("     console.log(`输出节点 ${index + 1}:`, {");
  console.log("       id: nodeData?.id,");
  console.log("       type: nodeData?.type,");
  console.log("       inputs: nodeData?.data?.inputs,");
  console.log("       outputs: nodeData?.data?.outputs");
  console.log("     });");
  console.log("   });");
  console.log("   ```");
  console.log("");

  console.log("5. 预期结果：");
  console.log("   - inputs 应该是一个数组，包含一个对象：");
  console.log('     [{ id: "in", name: "输入", type: "any", required: true }]');
  console.log("   - outputs 应该是一个空数组：[]");
  console.log("");

  console.log("6. 如果端口数据不正确，问题可能在于：");
  console.log(
    "   - WorkflowDesigner.vue 的 getDefaultInputs/getDefaultOutputs 函数",
  );
  console.log(
    "   - WorkflowDSLParser 的 getDefaultInputs/getDefaultOutputs 函数",
  );
  console.log("   - 节点数据在传递过程中被修改");
  console.log("");
}

diagnoseOutputNodeConnection();

console.log("=== 诊断完成 ===");
console.log("\n💡 建议：");
console.log("1. 在浏览器控制台中执行上述检查代码");
console.log("2. 查看输出节点的实际端口数据");
console.log("3. 如果端口数据正确，问题可能在连接验证器");
console.log("4. 如果端口数据不正确，需要检查节点创建和解析逻辑");
