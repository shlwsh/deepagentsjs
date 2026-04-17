#!/usr/bin/env bun

/**
 * 文件服务数据库迁移脚本
 * 
 * 用法:
 *   bun run scripts/migrate-file-service.ts up    # 向上迁移（创建表）
 *   bun run scripts/migrate-file-service.ts down  # 向下迁移（删除表）
 */

import { spawn } from 'child_process';
import { resolve } from 'path';
import readline from 'readline';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function question(query: string): Promise<string> {
    return new Promise(resolve => rl.question(query, resolve));
}

async function runMigration(direction: 'up' | 'down') {
    console.log('========================================');
    console.log(`文件服务数据库迁移 - ${direction === 'up' ? '向上迁移' : '向下迁移'}`);
    console.log('========================================\n');

    // 向下迁移需要用户确认
    if (direction === 'down') {
        console.log('⚠️  警告：向下迁移将删除以下表：');
        console.log('  - files');
        console.log('  - page_index_entries');
        console.log('  - file_references');
        console.log('  - 所有相关的索引和约束\n');

        const answer = await question('确认要继续吗？(yes/no): ');

        if (answer.toLowerCase() !== 'yes') {
            console.log('\n❌ 迁移已取消');
            rl.close();
            process.exit(0);
        }
        console.log('');
    }

    const migrationPath = resolve(process.cwd(), 'packages/file-service/migrations/migrate.ts');

    console.log(`执行迁移脚本: ${migrationPath}\n`);

    return new Promise<void>((resolve, reject) => {
        const child = spawn('bun', ['run', migrationPath, direction], {
            stdio: 'inherit',
            cwd: process.cwd()
        });

        child.on('close', (code) => {
            rl.close();

            if (code === 0) {
                console.log('\n========================================');
                console.log('✅ 迁移成功完成');
                console.log('========================================\n');
                resolve();
            } else {
                console.log('\n========================================');
                console.log('❌ 迁移失败');
                console.log('========================================\n');
                reject(new Error(`迁移进程退出，代码: ${code}`));
            }
        });

        child.on('error', (error) => {
            rl.close();
            console.error('\n❌ 执行迁移脚本时发生错误:', error.message);
            reject(error);
        });
    });
}

// 主函数
async function main() {
    const command = process.argv[2];

    if (!command || !['up', 'down'].includes(command)) {
        console.error('❌ 无效的命令');
        console.log('\n用法:');
        console.log('  bun run scripts/migrate-file-service.ts up    # 向上迁移（创建表）');
        console.log('  bun run scripts/migrate-file-service.ts down  # 向下迁移（删除表）');
        process.exit(1);
    }

    try {
        await runMigration(command as 'up' | 'down');
        process.exit(0);
    } catch (error: any) {
        console.error('迁移失败:', error.message);
        process.exit(1);
    }
}

main();
