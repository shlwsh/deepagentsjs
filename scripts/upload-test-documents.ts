#!/usr/bin/env bun

/**
 * 上传测试文档脚本
 * 从 uploads 目录上传文档到知识库
 */

import { config } from 'dotenv';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';

config();

const UPLOAD_DIR = '/Users/shihonglei/traework/bun-langgraph/packages/knowledge-service/data/uploads';
const KNOWLEDGE_SERVICE_URL = process.env.KNOWLEDGE_SERVICE_URL || 'http://localhost:8912';
const DATASET_ID = '6276127f-12ef-4b6e-ae5c-3a2c929784f8';

// 选择要上传的文档（选择不同类型的文档）
const TEST_FILES = [
    '1770127292641_112db5a4_test-document.md',
    '1770023988705_5d64ec30_AI技术概述.txt',
    '1770023950899_5d082c57_测试文档.txt',
];

interface UploadResult {
    filename: string;
    success: boolean;
    message: string;
    documentId?: string;
}

/**
 * 上传单个文档
 */
async function uploadDocument(filename: string): Promise<UploadResult> {
    try {
        const filePath = join(UPLOAD_DIR, filename);
        
        console.log(`  上传: ${filename}`);
        
        // 读取文件
        const fileContent = await readFile(filePath);
        const blob = new Blob([fileContent]);
        
        // 创建 FormData
        const formData = new FormData();
        formData.append('files', blob, filename);
        
        // 上传文件
        const response = await fetch(
            `${KNOWLEDGE_SERVICE_URL}/api/datasets/${DATASET_ID}/documents`,
            {
                method: 'POST',
                body: formData,
                signal: AbortSignal.timeout(60000),
            }
        );
        
        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: response.statusText }));
            return {
                filename,
                success: false,
                message: error.error || `HTTP ${response.status}`,
            };
        }
        
        const result = await response.json();
        const doc = result.data?.documents?.[0] || result.data;
        
        return {
            filename,
            success: true,
            message: '上传成功',
            documentId: doc.id,
        };
    } catch (error: any) {
        return {
            filename,
            success: false,
            message: error.message,
        };
    }
}

/**
 * 主函数
 */
async function main() {
    console.log('='.repeat(80));
    console.log('上传测试文档');
    console.log('='.repeat(80) + '\n');
    
    console.log(`知识库服务: ${KNOWLEDGE_SERVICE_URL}`);
    console.log(`数据集ID: ${DATASET_ID}`);
    console.log(`上传目录: ${UPLOAD_DIR}\n`);
    
    console.log(`准备上传 ${TEST_FILES.length} 个文档...\n`);
    
    const results: UploadResult[] = [];
    
    for (const filename of TEST_FILES) {
        const result = await uploadDocument(filename);
        results.push(result);
        
        // 每上传一个文档后暂停一下
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // 打印结果
    console.log('\n' + '='.repeat(80));
    console.log('上传结果');
    console.log('='.repeat(80) + '\n');
    
    const successCount = results.filter(r => r.success).length;
    
    results.forEach((result, index) => {
        const icon = result.success ? '✅' : '❌';
        console.log(`${index + 1}. ${icon} ${result.filename}`);
        console.log(`   ${result.message}`);
        if (result.documentId) {
            console.log(`   文档ID: ${result.documentId}`);
        }
        console.log();
    });
    
    console.log('='.repeat(80));
    console.log(`总计: ${successCount}/${results.length} 成功`);
    console.log('='.repeat(80) + '\n');
    
    if (successCount === results.length) {
        console.log('🎉 所有文档上传成功！');
        console.log('\n现在可以运行验证脚本: bun run scripts/verify-documents-local.ts');
    }
}

main().catch(error => {
    console.error('上传失败:', error);
    process.exit(1);
});
