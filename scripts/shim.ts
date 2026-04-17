import { ChatOpenAI } from "@langchain/openai";
import { config as dotenvConfig } from "dotenv";
import * as path from "path";

dotenvConfig({ path: path.resolve(process.cwd(), "services", "agent-platform", ".env") });

export const logger = {
    info: (msg: string, meta?: any) => console.log(`[INFO] ${msg}`, meta ? JSON.stringify(meta) : ''),
    debug: (msg: string, meta?: any) => { /* console.log(`[DEBUG] ${msg}`) */ },
    error: (msg: string, meta?: any) => console.error(`[ERROR] ${msg}`, meta ? JSON.stringify(meta) : ''),
    warn: (msg: string, meta?: any) => console.warn(`[WARN] ${msg}`, meta ? JSON.stringify(meta) : '')
};

export const llm = new ChatOpenAI({
    modelName: process.env.DASHSCOPE_MODEL || process.env.OPENAI_API_MODEL || process.env.MODEL_NAME || "gpt-3.5-turbo",
    temperature: 0.1,
    apiKey: process.env.DASHSCOPE_API_KEY || process.env.OPENAI_API_KEY,
    configuration: {
        baseURL: process.env.DASHSCOPE_BASE_URL || process.env.OPENAI_API_BASE || process.env.OPENAI_BASE_URL,
    }
});

export const getLocalISOTime = () => new Date().toISOString();

export const config = {
    API_PORT: process.env.API_PORT || 3000
};
