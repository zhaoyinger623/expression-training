# 言序 · 表达能力锻炼

单用户表达练习项目，使用 pnpm workspace + Turborepo 管理 React 前端与 NestJS 后端。

## 当前状态

目前提供项目公共基础代码、NestJS 健康检查接口，以及单页练习静态预览。用户可以在三道预置论题之间切换；居中的麦克风用于演示页面状态。回答文字和反馈均为与当前论题对应的示例，真实录音、语音转写、AI 出题与评估尚未接入。

## 环境与启动

- Node.js 20.19 或更新版本
- pnpm 10.28

在项目根目录执行：

```bash
pnpm install
pnpm dev
```

前端访问 `http://localhost:5173`，健康检查访问 `http://localhost:3000/api/health`。

构建命令：

```bash
pnpm build
```

项目设计与后续顺序见 [design.md](design.md)，版本状态见 [version.md](version.md)。

## 后端配置与接口

R1 已确定接口契约与共享类型，详见 [docs/api-contract.md](docs/api-contract.md)。业务接口尚未实现，前端仍使用示例数据。

后端配置模板位于 `apps/api/.env.example`，本地配置保存在 `apps/api/.env`。已有本地配置时保留原文件，按模板补充字段；不要覆盖已有 Key。真实密钥不提交到 Git。

转写使用 Qwen3-ASR-Flash 北京地域；出题与评估使用 GPT-6 Luna，其 API Key 与服务地址仅在本地配置。R2 已完成环境文件读取与统一异常响应，R3–R6 实现业务调用。

后端会从 `apps/api/.env` 加载配置，不依赖启动目录；系统已有环境变量优先。默认监听 `127.0.0.1:3000`，可通过 `PORT` 修改端口，通过 `WEB_ORIGIN` 指定允许访问的前端来源。端口和已填写的 URL 配置不合法时启动失败；缺少 AI Key 不影响健康检查。未提供本地环境文件时仍可使用默认配置启动健康检查。
