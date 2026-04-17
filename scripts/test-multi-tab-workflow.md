# 工作流编辑器多标签页功能测试

## 功能说明

工作流编辑器现在支持在多个独立的浏览器标签页中同时编辑不同的工作流文件。每个标签页：

- 独立维护自己的工作流状态
- 显示不同的页面标题
- 互不干扰

## 测试前准备

1. 启动所有服务：

   ```bash
   start-all.bat
   ```

2. 确保有多个技能包含工作流文件

## 测试场景

### 场景 1：从技能编辑器打开工作流

1. 访问：http://localhost:8911/skills
2. 点击任意技能进入编辑器
3. 点击"工作流设计器"按钮
4. 观察：
   - ✅ 在新标签页中打开工作流编辑器
   - ✅ 原标签页保持在技能编辑器
   - ✅ 新标签页标题显示工作流名称

### 场景 2：从工作流编辑器打开多个文件

1. 访问：http://localhost:8911/workflow-editor
2. 点击"打开"按钮
3. 选择第一个工作流文件，点击"打开"
4. 观察：
   - ✅ 在新标签页中打开第一个工作流
5. 回到原标签页
6. 再次点击"打开"按钮
7. 选择第二个工作流文件，点击"打开"
8. 观察：
   - ✅ 在另一个新标签页中打开第二个工作流
   - ✅ 现在有 3 个标签页：空白编辑器 + 工作流1 + 工作流2

### 场景 3：直接通过 URL 打开

1. 获取技能 ID（例如：`test-skill-001`）
2. 在新标签页中访问：
   ```
   http://localhost:8911/workflow-editor/test-skill-001/workflow.yaml
   ```
3. 观察：
   - ✅ 直接加载对应的工作流
   - ✅ 页面标题显示工作流名称

### 场景 4：多标签页独立编辑

1. 打开两个不同的工作流（标签页 A 和 B）
2. 在标签页 A 中：
   - 添加一个新节点
   - 观察右上角显示"已修改"状态
3. 切换到标签页 B：
   - 观察：标签页 B 的工作流未受影响
   - 添加一个不同的节点
4. 分别保存两个标签页的工作流
5. 观察：
   - ✅ 两个工作流都正确保存
   - ✅ 互不影响

### 场景 5：页面标题区分

1. 打开 3 个不同的工作流
2. 观察浏览器标签页标题：
   - ✅ 标签页 1：`工作流A - 工作流编辑器 - 智能助手系统`
   - ✅ 标签页 2：`工作流B - 工作流编辑器 - 智能助手系统`
   - ✅ 标签页 3：`工作流C - 工作流编辑器 - 智能助手系统`

### 场景 6：YAML 源码对比在多标签页中

1. 在标签页 A 中打开工作流
2. 修改工作流
3. 点击"源码"按钮
4. 观察：
   - ✅ 左侧显示磁盘版本
   - ✅ 右侧显示当前编辑状态
5. 切换到标签页 B
6. 点击"源码"按钮
7. 观察：
   - ✅ 显示标签页 B 的工作流内容
   - ✅ 与标签页 A 的内容不同

## URL 格式

### 新格式（推荐）

```
/workflow-editor/{skillId}/{fileName}
```

示例：

```
http://localhost:8911/workflow-editor/test-skill-001/workflow.yaml
http://localhost:8911/workflow-editor/my-skill/custom-workflow.yaml
```

### 旧格式（向后兼容）

```
/workflow-editor?skillId={skillId}&fileName={fileName}&skillName={skillName}
```

示例：

```
http://localhost:8911/workflow-editor?skillId=test-skill-001&fileName=workflow.yaml&skillName=测试技能
```

## 预期行为

### ✅ 正确行为

1. 点击"打开"按钮后，在新标签页打开工作流
2. 每个标签页独立维护状态
3. 页面标题显示当前工作流名称
4. 可以同时编辑多个工作流
5. 保存操作只影响当前标签页

### ❌ 错误行为

1. 打开文件时替换当前标签页内容
2. 多个标签页共享状态
3. 所有标签页显示相同的标题
4. 保存时影响其他标签页

## 技术实现

### 路由配置

```typescript
// 新增路由支持路径参数
{
  path: "/workflow-editor/:skillId/:fileName",
  name: "WorkflowEditorWithFile",
  component: WorkflowEditorPage,
}
```

### 页面加载逻辑

```typescript
// 优先使用路由参数，其次使用 query 参数
const routeSkillId = route.params.skillId;
const routeFileName = route.params.fileName;
const skillIdParam = routeSkillId || route.query.skillId;
const fileNameParam = routeFileName || route.query.fileName;
```

### 打开新标签页

```typescript
// 使用 window.open 在新标签页打开
const url = `/workflow-editor/${skillId}/${fileName}`;
window.open(url, "_blank");
```

### 页面标题更新

```typescript
// 加载工作流后更新标题
document.title = `${workflowName} - 工作流编辑器 - 智能助手系统`;
```

## 故障排查

### 问题 1：点击打开后在当前页面替换内容

**原因**：使用了 `router.push` 而不是 `window.open`

**解决**：检查代码是否使用 `window.open(url, '_blank')`

### 问题 2：多个标签页显示相同内容

**原因**：URL 参数未正确传递或解析

**解决**：

1. 检查 URL 格式是否正确
2. 查看浏览器控制台日志
3. 确认路由参数解析逻辑

### 问题 3：页面标题不更新

**原因**：未在加载工作流后更新 `document.title`

**解决**：在 `onMounted` 中加载工作流成功后设置标题

## 开发者注意事项

1. **状态隔离**：每个标签页的 Vue 组件实例是独立的，状态自然隔离
2. **URL 设计**：使用路径参数而非 query 参数，URL 更简洁
3. **向后兼容**：保留 query 参数支持，确保旧链接仍然有效
4. **用户体验**：在新标签页打开，避免丢失当前工作
5. **页面标题**：动态更新标题，方便用户区分标签页

## 未来改进

1. 支持拖拽标签页重新排序
2. 添加"在当前标签页打开"选项
3. 记住用户的标签页偏好设置
4. 支持标签页之间的工作流复制/粘贴
5. 添加标签页管理器，显示所有打开的工作流
