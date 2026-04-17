/**
 * 测试环境检查脚本
 * 验证集成测试所需的环境是否就绪
 */

// 测试配置
const FILE_SERVICE_URL = process.env.FILE_SERVICE_URL || 'http://localhost:8914';
const KNOWLEDGE_SERVICE_URL = process.env.KNOWLEDGE_SERVICE_URL || 'http://localhost:8912';
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = parseInt(process.env.DB_PORT || '5432');
const DB_NAME = process.env.DB_NAME || 'personnel_db';
const DB_USER = process.env.DB_USER || 'postgres';
const DB_PASSWORD = process.env.DB_PASSWORD || 'postgres';

interface CheckResult {
    name: string;
    status: 'ok' | 'warning' | 'error';
    message: string;
}

const results: CheckResult[] = [];

/**
 * 打印标题
 */
function printHeader(title: string) {
    console.log('\n' + '='.repeat(60));
    console.log(title);
    console.log('='.repeat(60) + '\n');
}

/**
 * 添加检查结果
 */
function addResult(name: string, status: 'ok' | 'warning' | 'error', message: string) {
    results.push({ name, status, message });
    
    const icon = status === 'ok' ? '✅' : status === 'warning' ? '⚠️' : '❌';
    console.log(`${icon} ${name}: ${message}`);
}

/**
 * 检查 1: PostgreSQL 数据库
 */
async function checkDatabase(): Promise<void> {
    console.log('\n📊 检查 PostgreSQL 数据库...');
    
    try {
        const { Pool } = await import('pg');
        const pool = new Pool({
            host: DB_HOST,
            port: DB_PORT,
            database: DB_NAME,
            user: DB_USER,
            password: DB_PASSWORD,
        });
        
        const client = await pool.connect();
        
        // 检查连接
        await client.query('SELECT 1');
        addResult('数据库连接', 'ok', '连接成功');
        
        // 检查文件服务表
        const tablesResult = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('files', 'page_index_entries')
            ORDER BY table_name
        `);
        
        const tables = tablesResult.rows.map(r => r.table_name);
        
        if (tables.includes('files') && tables.includes('page_index_entries')) {
            addResult('文件服务数据表', 'ok', '表已创建');
        } else {
            addResult('文件服务数据表', 'error', '表未创建，请运行迁移脚本');
            console.log('   运行: bun run scripts/migrate-file-service.ts up');
        }
        
        client.release();
        await pool.end();
        
    } catch (error: any) {
        addResult('数据库连接', 'error', error.message);
        console.log('   请检查 PostgreSQL 是否运行');
        console.log('   请检查 .env 文件中的数据库配置');
    }
}

/**
 * 检查 2: 文件服务
 */
async function checkFileService(): Promise<void> {
    console.log('\n📁 检查文件服务...');
    
    try {
        const response = await fetch(`${FILE_SERVICE_URL}/health`, {
            signal: AbortSignal.timeout(5000)
        });
        
        if (response.ok) {
            const data = await response.json();
            
            if (data.status === 'healthy' && data.database) {
                addResult('文件服务', 'ok', '运行正常');
            } else {
                addResult('文件服务', 'warning', '服务运行但状态异常');
            }
        } else {
            addResult('文件服务', 'error', `HTTP ${response.status}`);
        }
        
    } catch (error: any) {
        addResult('文件服务', 'error', '服务未运行');
        console.log('   启动命令: cd packages/file-service && bun run dev');
    }
}

/**
 * 检查 3: 知识库服务
 */
async function checkKnowledgeService(): Promise<void> {
    console.log('\n📚 检查知识库服务...');
    
    try {
        const response = await fetch(`${KNOWLEDGE_SERVICE_URL}/health`, {
            signal: AbortSignal.timeout(5000)
        });
        
        if (response.ok) {
            addResult('知识库服务', 'ok', '运行正常');
        } else {
            addResult('知识库服务', 'error', `HTTP ${response.status}`);
        }
        
    } catch (error: any) {
        addResult('知识库服务', 'error', '服务未运行');
        console.log('   启动命令: cd packages/knowledge-service && bun run dev');
    }
}

/**
 * 检查 4: 存储目录
 */
async function checkStorageDirectory(): Promise<void> {
    console.log('\n💾 检查存储目录...');
    
    const storagePath = process.env.STORAGE_ROOT_PATH || './data/uploads';
    
    try {
        const fs = await import('fs');
        const path = await import('path');
        
        const fullPath = path.resolve(storagePath);
        
        if (fs.existsSync(fullPath)) {
            const stats = fs.statSync(fullPath);
            if (stats.isDirectory()) {
                addResult('存储目录', 'ok', `目录存在: ${fullPath}`);
            } else {
                addResult('存储目录', 'error', '路径存在但不是目录');
            }
        } else {
            addResult('存储目录', 'warning', '目录不存在，将自动创建');
        }
        
    } catch (error: any) {
        addResult('存储目录', 'error', error.message);
    }
}

/**
 * 检查 5: 日志目录
 */
async function checkLogDirectory(): Promise<void> {
    console.log('\n📝 检查日志目录...');
    
    const logDirs = [
        'logs',
        'packages/file-service/logs',
        'packages/knowledge-service/logs'
    ];
    
    try {
        const fs = await import('fs');
        const path = await import('path');
        
        let allExist = true;
        
        for (const logDir of logDirs) {
            const fullPath = path.resolve(logDir);
            if (!fs.existsSync(fullPath)) {
                allExist = false;
                console.log(`   ⚠️  目录不存在: ${logDir}`);
            }
        }
        
        if (allExist) {
            addResult('日志目录', 'ok', '所有日志目录存在');
        } else {
            addResult('日志目录', 'warning', '部分日志目录不存在，将自动创建');
        }
        
    } catch (error: any) {
        addResult('日志目录', 'error', error.message);
    }
}

/**
 * 打印总结
 */
function printSummary() {
    printHeader('环境检查总结');
    
    const ok = results.filter(r => r.status === 'ok').length;
    const warning = results.filter(r => r.status === 'warning').length;
    const error = results.filter(r => r.status === 'error').length;
    
    console.log(`检查项目: ${results.length}`);
    console.log(`正常: ${ok} ✅`);
    console.log(`警告: ${warning} ⚠️`);
    console.log(`错误: ${error} ❌`);
    
    console.log('\n' + '='.repeat(60));
    
    if (error === 0 && warning === 0) {
        console.log('🎉 环境检查通过！可以运行集成测试。');
    } else if (error === 0) {
        console.log('⚠️  环境基本就绪，但有一些警告项。');
        console.log('建议解决警告项后再运行测试。');
    } else {
        console.log('❌ 环境检查失败，请解决错误项后再运行测试。');
        console.log('\n常见解决方案:');
        console.log('1. 启动 PostgreSQL 数据库');
        console.log('2. 运行数据库迁移: bun run scripts/migrate-file-service.ts up');
        console.log('3. 启动文件服务: cd packages/file-service && bun run dev');
        console.log('4. 启动知识库服务: cd packages/knowledge-service && bun run dev');
    }
    
    console.log('='.repeat(60));
}

/**
 * 主函数
 */
async function main() {
    printHeader('集成测试环境检查');
    
    console.log('配置信息:');
    console.log(`  文件服务 URL: ${FILE_SERVICE_URL}`);
    console.log(`  知识库服务 URL: ${KNOWLEDGE_SERVICE_URL}`);
    console.log(`  数据库: ${DB_HOST}:${DB_PORT}/${DB_NAME}`);
    
    // 执行所有检查
    await checkDatabase();
    await checkFileService();
    await checkKnowledgeService();
    await checkStorageDirectory();
    await checkLogDirectory();
    
    // 打印总结
    printSummary();
    
    // 设置退出码
    const hasError = results.some(r => r.status === 'error');
    process.exit(hasError ? 1 : 0);
}

// 执行检查
main().catch((error) => {
    console.error('环境检查失败:', error);
    process.exit(1);
});
