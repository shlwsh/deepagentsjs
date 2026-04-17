#!/usr/bin/env bun
/**
 * 项目更新工作流脚本
 * 自动总结代码变更并升级版本
 */

// @ts-ignore - Bun shell API
import { ChatOpenAI } from '@langchain/openai';
import { $ } from 'bun';
import * as dotenv from 'dotenv';
import * as path from 'path';

// 加载环境变量
dotenv.config({ path: path.join(__dirname, '../.env') });

interface UpdateSummary {
    summary: string;
    changes: {
        modified: number;
        added: number;
        deleted: number;
    };
}

/**
 * 检查代码变更
 */
async function checkChanges(): Promise<UpdateSummary> {
    console.log('🔍 检查代码变更...');

    try {
        // 获取 git 状态
        const status = await $`git status --short`.text();

        if (!status.trim()) {
            console.log('   ℹ️  没有检测到代码变更');
            return {
                summary: '',
                changes: { modified: 0, added: 0, deleted: 0 }
            };
        }

        // 统计变更
        const lines = status.trim().split('\n');
        const changes = {
            modified: lines.filter((l: string) => l.startsWith(' M')).length,
            added: lines.filter((l: string) => l.startsWith('??') || l.startsWith('A ')).length,
            deleted: lines.filter((l: string) => l.startsWith(' D')).length,
        };

        const total = changes.modified + changes.added + changes.deleted;
        console.log(`   检测到 ${total} 个文件变更`);
        console.log(`   - 修改: ${changes.modified}`);
        console.log(`   - 新增: ${changes.added}`);
        console.log(`   - 删除: ${changes.deleted}`);

        return { summary: status, changes };
    } catch (error: any) {
        console.error(`   ❌ 检查变更失败: ${error.message}`);
        throw error;
    }
}

/**
 * 获取代码差异
 */
async function getCodeDiff(): Promise<string> {
    try {
        // 添加所有变更到暂存区
        await $`git add -A`;

        // 获取差异
        const diff = await $`git diff --cached`.text();

        return diff;
    } catch (error: any) {
        console.error(`   ❌ 获取代码差异失败: ${error.message}`);
        throw error;
    }
}

/**
 * 使用 AI 生成变更总结
 */
async function generateSummary(diff: string, status: string): Promise<string> {
    console.log('\n🤖 生成变更总结...');

    try {
        const model = new ChatOpenAI({
            modelName: process.env.DASHSCOPE_MODEL || 'deepseek-v3',
            temperature: 0.3,
            configuration: {
                baseURL: process.env.DASHSCOPE_BASE_URL,
                apiKey: process.env.DASHSCOPE_API_KEY,
            },
        });

        const prompt = `你是一个专业的技术文档编写助手。请根据以下 Git 代码变更，生成一个简洁的版本升级描述。

要求：
1. 控制在 100 字以内
2. 突出核心功能变更
3. 使用专业术语
4. 格式：<主要功能>，<次要功能>，<其他改进>

Git 状态：
${status}

代码差异（前 5000 字符）：
${diff.substring(0, 5000)}

请直接输出版本描述，不要有任何前缀或解释：`;

        const response = await model.invoke(prompt);
        const summary = response.content.toString().trim();

        console.log(`   总结: ${summary}`);

        return summary;
    } catch (error: any) {
        console.error(`   ❌ 生成总结失败: ${error.message}`);
        throw error;
    }
}

/**
 * 升级版本
 */
async function upgradeVersion(description: string): Promise<void> {
    console.log('\n⬆️  升级版本...');
    console.log(`   描述: ${description}`);

    try {
        const apiUrl = process.env.API_URL || 'http://localhost:8910';

        // 调用版本升级 API
        const response = await fetch(`${apiUrl}/api/version/upgrade`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                description,
                force: false,
            }),
        });

        if (!response.ok) {
            throw new Error(`版本升级请求失败: ${response.statusText}`);
        }

        const result = await response.json();

        if (result.status !== 'success') {
            throw new Error(`版本升级失败: ${result.message}`);
        }

        const data = result.data;

        if (!data.upgraded) {
            console.log('\n   ℹ️  版本未发生变化');
            console.log(`   当前版本: ${data.oldVersion}`);
            console.log(`   原因: ${result.message || '版本已是最新'}`);
            return;
        }

        // 升级成功
        console.log('\n🎉 版本升级成功！');
        console.log(`   旧版本: ${data.oldVersion}`);
        console.log(`   新版本: ${data.newVersion}`);
        console.log(`   升级时间: ${new Date(data.timestamp).toLocaleString('zh-CN')}`);

        if (data.versionInfo?.description) {
            console.log(`   描述: ${data.versionInfo.description}`);
        }

    } catch (error: any) {
        console.error(`   ❌ 版本升级失败: ${error.message}`);
        throw error;
    }
}

/**
 * 主函数
 */
async function main() {
    console.log('='.repeat(60));
    console.log('📦 项目更新工作流');
    console.log('='.repeat(60));

    try {
        // 1. 检查变更
        const updateInfo = await checkChanges();

        if (updateInfo.changes.modified === 0 &&
            updateInfo.changes.added === 0 &&
            updateInfo.changes.deleted === 0) {
            console.log('\n✅ 没有需要更新的内容');
            return;
        }

        // 2. 获取代码差异
        const diff = await getCodeDiff();

        // 3. 生成总结
        const summary = await generateSummary(diff, updateInfo.summary);

        // 4. 升级版本
        await upgradeVersion(summary);

        console.log('\n' + '='.repeat(60));
        console.log('✅ 项目更新完成！');
        console.log('='.repeat(60));

        console.log('\n💡 后续操作建议：');
        console.log('   1. 检查版本信息: cat version.json');
        console.log('   2. 提交代码: bun run mygit');
        console.log('   3. 更新文档: 如有重大功能更新，请更新 README.md');

    } catch (error: any) {
        console.error('\n❌ 项目更新失败:', error.message);
        process.exit(1);
    }
}

// 运行主程序
main().catch(console.error);
