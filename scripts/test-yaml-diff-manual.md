# YAML 源码对比功能手动测试指南

## 测试前准备

1. 启动所有服务：

   ```bash
   start-all.bat
   ```

2. 打开浏览器开发者工具（F12），切换到 Console 标签页

3. 访问工作流编辑器：http://localhost:8911/workflow-editor

## 测试步骤

### 步骤 1：打开已有工作流

1. 点击"打开"按钮
2. 选择任意一个工作流文件
3. 点击"打开"
4. 观察控制台日志，应该看到：
   ```
   [WorkflowEditorPage] 工作流文件打开成功
   ```

### 步骤 2：点击"源码"按钮

1. 点击顶部工具栏的"源码"按钮
2. 观察控制台日志，应该看到：

   ```
   [WorkflowEditorPage] 打开 YAML 源码对比查看器
   - hasSavedContent: true
   - savedContentLength: xxx
   - editableContentLength: xxx
   - savedPreview: ...
   - editablePreview: ...
   ```

3. 观察对话框中的内容：
   - 左侧应该显示磁盘文件的 YAML 内容
   - 右侧应该显示当前编辑状态的 YAML 内容
   - 如果未修改，左右两侧应该一致

### 步骤 3：检查组件初始化日志

在对话框打开后，应该看到以下日志：

```
[WorkflowYamlDiffViewer] 初始化编辑器
- originalLength: xxx
- modifiedLength: xxx
- originalPreview: ...
- modifiedPreview: ...

[WorkflowYamlDiffViewer] 编辑器初始化完成
- originalModelValue: xxx
- modifiedModelValue: xxx
```

### 步骤 4：检查 props 变化日志

如果看到以下日志，说明 props 在编辑器初始化后才传递：

```
[WorkflowYamlDiffViewer] original 变化
[WorkflowYamlDiffViewer] modified 变化
```

## 问题诊断

### 问题 1：左右两侧都是空白

**可能原因：**

1. props 传递时机问题
2. Monaco Editor 初始化失败
3. 内容为空字符串

**检查方法：**

1. 查看控制台是否有错误信息
2. 检查 `savedContentLength` 和 `editableContentLength` 的值
3. 检查 `originalModelValue` 和 `modifiedModelValue` 的值

### 问题 2：只有右侧有内容，左侧为空

**可能原因：**

1. 这是新建的工作流，还未保存
2. `savedYamlContent` 未正确设置

**检查方法：**

1. 查看 `hasSavedContent` 的值
2. 查看 `savedContentLength` 的值
3. 检查是否是新建工作流

### 问题 3：内容显示但无法编辑右侧

**可能原因：**

1. Monaco Editor 配置问题
2. 事件监听未正确设置

**检查方法：**

1. 尝试在右侧编辑器中输入内容
2. 查看控制台是否有错误

## 预期结果

✅ 左侧显示磁盘文件内容（或为空，如果是新建文件）
✅ 右侧显示当前编辑状态
✅ 可以在右侧编辑 YAML
✅ 点击"应用右侧到设计器"可以更新工作流
✅ 控制台有完整的调试日志

## 如果问题仍然存在

请将以下信息提供给开发者：

1. 完整的控制台日志（从打开工作流到打开源码对比）
2. 浏览器版本
3. 操作步骤
4. 截图
