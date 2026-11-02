import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';
import { Global, Injectable, Module } from '@nestjs/common';

@Injectable()
export class ApiConfig {
  readonly port: number;
  readonly webOrigin: string;
  readonly asr: { apiKey: string; baseUrl: string; model: string };
  readonly llm: { apiKey: string; baseUrl: string; model: string };

  constructor() {
    const envPath = fileURLToPath(new URL('../.env', import.meta.url));
    if (existsSync(envPath)) loadEnvFile(envPath);

    this.port = Number(process.env.PORT ?? '3000');
    if (!Number.isInteger(this.port) || this.port < 1 || this.port > 65535) {
      throw new Error('PORT 必须为 1–65535 的整数');
    }
    this.webOrigin = process.env.WEB_ORIGIN ?? 'http://localhost:5173';
    this.asr = {
      apiKey: process.env.DASHSCOPE_API_KEY ?? '',
      baseUrl: process.env.DASHSCOPE_BASE_URL ?? 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      model: process.env.ASR_MODEL ?? 'qwen3-asr-flash',
    };
    this.llm = {
      apiKey: process.env.LLM_API_KEY ?? '',
      baseUrl: process.env.LLM_BASE_URL ?? '',
      model: process.env.LLM_MODEL ?? 'gpt-6-luna',
    };

    for (const [name, value] of [
      ['WEB_ORIGIN', this.webOrigin],
      ['DASHSCOPE_BASE_URL', this.asr.baseUrl],
      ['LLM_BASE_URL', this.llm.baseUrl],
    ]) {
      if (!value) continue;
      if (!URL.canParse(value) || !['http:', 'https:'].includes(new URL(value).protocol)) {
        throw new Error(`${name} 必须为有效的 HTTP(S) 地址`);
      }
    }
  }
}

@Global()
@Module({ providers: [ApiConfig], exports: [ApiConfig] })
export class ConfigModule {}
