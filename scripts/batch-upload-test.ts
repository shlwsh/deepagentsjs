#!/usr/bin/env bun

/**
 * 批量上传测试脚本
 * 用于验证文档处理流程的完整性
 */

import { readdirSync, statSync, readFileSync } from "fs";
import { join } from "path";

const API_BASE = "http://localhost:8912/api";
const UPLOAD_DIR = "/Users/shihonglei/tmp/files";
const DATASET_NAME = `批量测试-${Date.now()}`;

// 颜色输出
const colors = {
  reset: "\x1b[0m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  magenta: "\x1b[35m",
  blue: "\x1b[34m",
};

function log(message: string, color: keyof typeof colors = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * 格式化文件大小
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + " KB";
  return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}

/**
 * 获取或创建知识库
 */
async function getOrCreateDataset(): Promise<string> {
  try {
    log("\n📚 检查知识库...", "cyan");

    // 查找现有知识库
    const listResponse = await fetch(`${API_BASE}/datasets`);
    const listData = await listResponse.json();
    const datasets =
      listData?.data?.datasets || listData?.datasets || [];
    const existingDataset = datasets.find(
      (ds: any) => ds.name === DATASET_NAME
    );

    if (existingDataset) {
      log(`✓ 使用现有知识库: ${DATASET_NAME} (ID: ${existingDataset.id})`, "green");
      return existingDataset.id;
    }

    // 创建新知识库
    log(`创建新知识库: ${DATASET_NAME}`, "yellow");
    const createResponse = await fetch(`${API_BASE}/datasets`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: DATASET_NAME,
        description: "批量上传验证测试知识库",
        indexingConfig: {
          chunkSize: 1000,
          chunkOverlap: 200,
          enableVector: true,
          enablePageIndex: true,
        },
      }),
    });

    const createData = await createResponse.json();
    const datasetId = createData?.data?.id || createData?.id;
    log(`✓ 知识库创建成功 (ID: ${datasetId})`, "green");
    return datasetId;
  } catch (error: any) {
    log(`✗ 知识库操作失败: ${error.message}`, "red");
    throw error;
  }
}

/**
 * 上传单个文件
 */
async function uploadFile(
  filePath: string,
  datasetId: string
): Promise<{ success: boolean; error?: string; stats?: any; documentId?: string }> {
  const fileName = filePath.split("/").pop() || "";

  try {
    const fileBuffer = readFileSync(filePath);
    const fileSize = statSync(filePath).size;

    log(`\n📤 上传: ${fileName} (${formatFileSize(fileSize)})`, "cyan");

    const formData = new FormData();
    const blob = new Blob([fileBuffer]);
    formData.append("files", blob, fileName);

    const response = await fetch(`${API_BASE}/datasets/${datasetId}/documents`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    const data = await response.json();
    const documentId = data?.data?.documents?.[0]?.id || data?.documents?.[0]?.id;
    
    log(`✓ 上传成功，等待处理...`, "green");

    // 等待文档处理完成（最多等待 30 秒）
    let attempts = 0;
    const maxAttempts = 30;
    let docStatus: any = null;

    while (attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      
      const statusResponse = await fetch(`${API_BASE}/documents/${documentId}`);
      const statusData = await statusResponse.json();
      docStatus = statusData?.data;

      if (docStatus?.processingStatus === "completed") {
        break;
      } else if (docStatus?.processingStatus === "failed") {
        throw new Error(docStatus.processingError || "处理失败");
      }

      attempts++;
    }

    if (docStatus?.processingStatus === "completed") {
      log(`✓ 处理完成`, "green");
      log(`  - 向量分片: ${docStatus.chunkCount || 0} chunks`, "blue");
      log(`  - 文档语言: ${docStatus.extractedMetadata?.language || "未知"}`, "blue");
      log(`  - 字数统计: ${docStatus.extractedMetadata?.wordCount || 0}`, "blue");
    } else {
      log(`⚠ 处理超时（仍在处理中）`, "yellow");
    }

    return { success: true, stats: docStatus, documentId };
  } catch (error: any) {
    log(`✗ 失败: ${error.message}`, "red");
    return { success: false, error: error.message };
  }
}

/**
 * 主函数
 */
async function main() {
  log("=".repeat(60), "magenta");
  log("批量上传验证测试", "magenta");
  log("=".repeat(60), "magenta");

  // 检查目录
  try {
    const files = readdirSync(UPLOAD_DIR).filter((file) => {
      const filePath = join(UPLOAD_DIR, file);
      return statSync(filePath).isFile();
    });

    if (files.length === 0) {
      log(`\n✗ 目录为空: ${UPLOAD_DIR}`, "red");
      process.exit(1);
    }

    log(`\n📁 目录: ${UPLOAD_DIR}`, "cyan");
    log(`📊 文件数量: ${files.length}`, "cyan");

    // 获取或创建知识库
    const datasetId = await getOrCreateDataset();

    // 统计信息
    const results = {
      total: files.length,
      success: 0,
      failed: 0,
      errors: [] as string[],
    };

    // 批量上传
    log("\n" + "=".repeat(60), "magenta");
    log("开始批量上传", "magenta");
    log("=".repeat(60), "magenta");

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const filePath = join(UPLOAD_DIR, file);

      log(`\n[${i + 1}/${files.length}]`, "yellow");

      const result = await uploadFile(filePath, datasetId);

      if (result.success) {
        results.success++;
      } else {
        results.failed++;
        results.errors.push(`${file}: ${result.error}`);
      }

      // 短暂延迟，避免过载
      if (i < files.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    // 输出总结
    log("\n" + "=".repeat(60), "magenta");
    log("上传完成", "magenta");
    log("=".repeat(60), "magenta");

    log(`\n📊 统计信息:`, "cyan");
    log(`  总计: ${results.total}`, "cyan");
    log(`  成功: ${results.success}`, "green");
    log(`  失败: ${results.failed}`, results.failed > 0 ? "red" : "green");

    if (results.errors.length > 0) {
      log(`\n❌ 失败详情:`, "red");
      results.errors.forEach((error) => {
        log(`  - ${error}`, "red");
      });
    }

    log("\n" + "=".repeat(60), "magenta");

    // 如果有失败，退出码为 1
    if (results.failed > 0) {
      process.exit(1);
    }
  } catch (error: any) {
    log(`\n✗ 执行失败: ${error.message}`, "red");
    process.exit(1);
  }
}

// 执行主函数
main().catch((error) => {
  log(`\n✗ 未捕获的错误: ${error.message}`, "red");
  process.exit(1);
});
