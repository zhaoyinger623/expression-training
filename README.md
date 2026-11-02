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
