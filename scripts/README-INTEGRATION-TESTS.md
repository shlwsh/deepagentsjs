# 集成测试使用说明

本目录包含三个集成测试脚本，用于验证文件服务与知识库服务的集成功能。

## 测试脚本

### 1. test-file-service-integration.ts

**功能**: 测试文件服务的核心功能和集成

**测试内容**:
- 健康检查
- 文件上传流程
- PageIndex 构建流程
- 获取文档结构
- 文件下载流程
- 文件搜索功能
- 文件删除流程
- 知识库服务集成（可选）

**运行前提**:
- 文件服务必须运行在 http://localhost:8914
- PostgreSQL 数据库必须可用
- 文件服务数据表已创建（运行迁移脚本）

**运行命令**:
```bash
bun run scripts/test-file-service-integration.ts
```

### 2. test-backward-compatibility.ts

**功能**: 验证文件服务集成后的向后兼容性

**测试内容**:
- 知识库服务可用性
- 获取或创建测试知识库
- 文档上传接口格式验证
- 搜索接口格式验证
- PageIndex 查询接口格式验证
- 响应格式一致性验证

**运行前提**:
- 知识库服务必须运行在 http://localhost:8912
- 文件服务必须运行在 http://localhost:8914（用于后端调用）
- PostgreSQL 数据库必须可用

**运行命令**:
```bash
bun run scripts/test-backward-compatibility.ts
```

### 3. test-fallback-mode.ts

**功能**: 测试文件服务不可用时的降级处理

**测试内容**:
- 检查文件服务状态（应该已停止）
- 验证健康检查显示文件服务异常
- 验证知识库服务仍可访问
- 测试降级模式下的文档上传
- 验证错误日志记录

**运行前提**:
- 知识库服务必须运行在 http://localhost:8912
- 文件服务必须**停止**（模拟不可用场景）
- PostgreSQL 数据库必须可用

**运行命令**:
```bash
bun run scripts/test-fallback-mode.ts
```

## 完整测试流程

### 步骤 1: 准备环境

1. 确保 PostgreSQL 数据库运行
2. 运行数据库迁移脚本：
   ```bash
   bun run scripts/migrate-file-service.ts up
   ```

### 步骤 2: 启动服务

使用启动脚本启动所有服务：
```bash
# Windows
start-all.bat

# Linux/Mac
./start-all.sh
```

或者手动启动：
```bash
# 终端 1: 启动知识库服务
cd packages/knowledge-service
bun run dev

# 终端 2: 启动文件服务
cd packages/file-service
bun run dev
```

### 步骤 3: 运行集成测试

等待服务启动完成（约 5-10 秒），然后运行：

```bash
# 测试 1: 文件服务集成测试
bun run scripts/test-file-service-integration.ts

# 测试 2: 向后兼容性测试
bun run scripts/test-backward-compatibility.ts
```

### 步骤 4: 测试降级处理

1. 停止文件服务（关闭文件服务的终端或按 Ctrl+C）
2. 运行降级测试：
   ```bash
   bun run scripts/test-fallback-mode.ts
   ```

## 测试结果说明

### 成功标准

**文件服务集成测试**:
- 所有 8 个测试应该通过
- 文件上传、下载、删除功能正常
- PageIndex 构建和查询功能正常

**向后兼容性测试**:
- 所有 6 个测试应该通过
- API 接口格式保持不变
- 响应数据结构一致

**降级处理测试**:
- 知识库服务仍可访问
- 健康检查显示文件服务异常
- 错误日志正确记录
- 降级模式测试结果取决于配置（FILE_SERVICE_FALLBACK）

### 常见问题

**问题 1: 连接失败**
```
错误: Unable to connect. Is the computer able to access the url?
```
**解决方案**: 确保相应的服务已启动并运行在正确的端口

**问题 2: 数据库连接失败**
```
错误: 数据库连接异常
```
**解决方案**: 
1. 检查 PostgreSQL 是否运行
2. 检查 .env 文件中的数据库配置
3. 运行数据库迁移脚本

**问题 3: 表不存在**
```
错误: relation "files" does not exist
```
**解决方案**: 运行数据库迁移脚本创建表
```bash
bun run scripts/migrate-file-service.ts up
```

**问题 4: 端口被占用**
```
错误: EADDRINUSE: address already in use
```
**解决方案**: 运行端口清理脚本
```bash
# Windows
scripts\cleanup-ports.bat

# Linux/Mac
./scripts/cleanup-ports.sh
```

## 环境变量配置

测试脚本使用以下环境变量（可在 .env 文件中配置）：

```env
# 文件服务
FILE_SERVICE_URL=http://localhost:8914
FILE_SERVICE_PORT=8914

# 知识库服务
KNOWLEDGE_SERVICE_URL=http://localhost:8912
KNOWLEDGE_SERVICE_PORT=8912

# 降级模式（可选）
FILE_SERVICE_FALLBACK=false

# 数据库
DB_HOST=localhost
DB_PORT=5432
DB_NAME=personnel_db
DB_USER=postgres
DB_PASSWORD=postgres
```

## 测试输出示例

### 成功输出

```
============================================================
文件服务集成测试
============================================================

📋 测试 1：健康检查
✅ 健康检查通过
   状态: healthy
   数据库: 正常
   时间戳: 2024-01-01T00:00:00.000Z

📋 测试 2：文件上传流程
✅ 文件上传成功
   文件 ID: 123e4567-e89b-12d3-a456-426614174000
   文件名: test-document.md
   大小: 1234 字节
   MIME 类型: text/markdown

...

============================================================
测试总结
============================================================

总测试数: 8
通过: 8 ✅
失败: 0 ❌
成功率: 100.0%

🎉 所有测试通过！
```

### 失败输出

```
❌ 测试失败: 文件上传流程
   错误: 文件上传失败: HTTP 500

============================================================
测试总结
============================================================

总测试数: 8
通过: 6 ✅
失败: 2 ❌
成功率: 75.0%

⚠️  部分测试失败，请检查错误信息
```

## 注意事项

1. **测试顺序**: 建议按照文档中的顺序运行测试
2. **服务状态**: 确保服务在测试前已完全启动
3. **数据清理**: 测试会创建临时文件和数据，测试完成后会自动清理
4. **日志查看**: 如果测试失败，查看服务日志文件获取详细信息
5. **降级测试**: 降级测试需要停止文件服务，测试完成后记得重新启动

## 持续集成

这些测试脚本可以集成到 CI/CD 流程中：

```yaml
# .github/workflows/integration-tests.yml
name: Integration Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: docker-compose up -d postgres
      - run: bun run scripts/migrate-file-service.ts up
      - run: bun run packages/file-service/src/main.ts &
      - run: bun run packages/knowledge-service/src/main.ts &
      - run: sleep 10
      - run: bun run scripts/test-file-service-integration.ts
      - run: bun run scripts/test-backward-compatibility.ts
```

## 反馈和改进

如果发现测试脚本的问题或有改进建议，请：
1. 查看测试脚本源代码
2. 修改测试逻辑或添加新的测试用例
3. 更新本文档说明

## 相关文档

- [文件服务 API 文档](../packages/file-service/docs/API.md)
- [文件服务集成指南](../docs/FILE_SERVICE_INTEGRATION.md)
- [PageIndex 迁移指南](../docs/PAGEINDEX_MIGRATION.md)
