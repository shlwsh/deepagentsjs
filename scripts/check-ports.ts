#!/usr/bin/env bun

/**
 * 检查所有服务的端口配置
 */

import { $ } from 'bun';

console.log('🔍 检查服务端口配置...\n');

// 读取 .env 文件
const envFile = await Bun.file('.env').text();
const envVars: Record<string, string> = {};

envFile.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
            envVars[key.trim()] = valueParts.join('=').trim();
        }
    }
});

const services = [
    { name: 'Agent 服务', port: envVars.API_PORT || '8910' },
    { name: '前端服务', port: envVars.WEB_PORT || '8911' },
    { name: '知识库服务', port: envVars.KNOWLEDGE_PORT || '8912' },
    { name: 'MCP 人事服务', port: envVars.MCP_PERSONNEL_PORT || '8913' },
];

console.log('📋 配置的端口：');
services.forEach(service => {
    console.log(`  ${service.name}: ${service.port}`);
});

console.log('\n🔌 检查端口占用情况：');
for (const service of services) {
    try {
        const result = await $`lsof -i :${service.port} -sTCP:LISTEN`.quiet();
        if (result.exitCode === 0) {
            console.log(`  ✅ ${service.name} (${service.port}) - 正在运行`);
        }
    } catch {
        console.log(`  ⭕ ${service.name} (${service.port}) - 未运行`);
    }
}

console.log('\n✨ 检查完成！');
