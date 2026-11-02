# 言序 · 表达能力锻炼

单用户表达练习项目，使用 pnpm workspace + Turborepo 管理 React 前端与 NestJS 后端。

## 当前状态

目前提供项目公共基础代码、NestJS 健康检查接口，以及单页练习静态预览。用户可以在三道预置论题之间切换；居中的麦克风用于演示页面状态。回答文字和反馈均为与当前论题对应的示例，真实录音与 AI 评估尚未接入；后端已实现出题与录音转写接口，前端尚未接入。

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

R1 已确定接口契约与共享类型，详见 [docs/api-contract.md](docs/api-contract.md)。R3–R5 已实现论题、独立转写接口及内部评估服务，前端仍使用示例数据。

后端配置模板位于 `apps/api/.env.example`，本地配置保存在 `apps/api/.env`。已有本地配置时保留原文件，按模板补充字段；不要覆盖已有 Key。真实密钥不提交到 Git。

转写使用 Qwen3-ASR-Flash 北京地域；出题与评估使用 GPT-6 Luna，其 API Key 与服务地址仅在本地配置。R2 已完成环境文件读取与统一异常响应，R3 已实现 AI 出题及预置回退，R4 已实现录音上传和 Qwen 转写；R5 已实现评估服务与结果校验，R6 将串联完整作答。

后端会从 `apps/api/.env` 加载配置，不依赖启动目录；系统已有环境变量优先。默认监听 `127.0.0.1:3000`，可通过 `PORT` 修改端口，通过 `WEB_ORIGIN` 指定允许访问的前端来源。端口和已填写的 URL 配置不合法时启动失败；缺少 AI Key 不影响健康检查。未提供本地环境文件时仍可使用默认配置启动健康检查。

获取论题：`GET http://localhost:3000/api/topics/random`；换题时可附加 `?excludeTopicId=当前题目ID`。响应为 `{ topic }`，`topic.source` 为 `ai` 或 `preset`。LLM 配置缺失、调用失败、15 秒超时或结果格式无效时，返回预置论题；真实 sub2api 服务兼容性尚待联调。注意：使用本地真实 LLM 配置访问该接口会发起模型调用，可能产生费用。

独立转写接口（R4）：`POST http://localhost:3000/api/transcriptions`，使用 multipart 字段 `audio`（文件，最大 6 MiB）和 `durationSeconds`（录音秒数，0–180，不含 0），返回 `{ transcript }`。例如：

```bash
curl http://localhost:3000/api/transcriptions \
  -F 'audio=@/absolute/path/recording.webm;type=audio/webm' \
  -F 'durationSeconds=30'
```

使用本地 Qwen 配置执行此请求会调用真实服务并可能计费；本阶段只完成模拟上游验证。真实浏览器音频兼容性及中文识别效果仍待 R7 联调。尚未实现的 `/api/attempts` 不会返回评估结果。

R5 评估服务仅供后端内部调用，输出三维评分、反馈标题、原文引用及练习建议；引用不在原文、维度缺失或评分无效时返回评估失败，不使用示例分数替代。未开放文字作答或独立评估接口，待 R6 与录音转写串联。
