# 言序 · 表达能力锻炼

单用户中文表达练习项目，使用 pnpm workspace + Turborepo 管理 React 前端与 NestJS 后端。

## 当前状态

R1–R7 已完成实现：获取论题、浏览器录音、回听与重录、自动转写和三维评估、同题两轮回答对比。页面使用后端返回的内容，不再展示静态示例。当前练习只保存在页面状态，刷新后清空，不保存音频或练习历史。

构建和本地模拟模型的浏览器全流程验证已通过。录音成功路径使用 Chrome 原生 MediaRecorder 和虚拟麦克风生成有效 WebM，经真实 NestJS 接口处理；不代表真实人声的中文识别准确度、Qwen 音频解码和 sub2api 模型兼容性已验证。真实模型调用及反馈质量仍待授权后联调。

## 环境与启动

- Node.js 20.19 或更新版本
- pnpm 10.28

后端配置模板位于 `apps/api/.env.example`，实际配置放在 `apps/api/.env`。已有文件时保留原 Key，按模板补充；真实密钥文件被 Git 忽略。

| 配置 | 用途 |
| --- | --- |
| DASHSCOPE_API_KEY / DASHSCOPE_BASE_URL / ASR_MODEL | 北京地域 Qwen3-ASR-Flash 转写 |
| LLM_API_KEY / LLM_BASE_URL / LLM_MODEL | sub2api 接入的 GPT-6 Luna 出题与评估 |
| PORT / WEB_ORIGIN | 后端端口和允许的前端来源，默认 3000 与 http://localhost:5173 |

后端从固定的 `apps/api/.env` 加载配置，不依赖启动目录；系统环境变量优先。端口和已填写的 URL 不合法时启动失败，缺少 AI 配置不影响健康检查。

在项目根目录执行：

```bash
pnpm install
pnpm dev
```

前端访问 `http://localhost:5173`，健康检查访问 `http://localhost:3000/api/health`。Vite 默认将同源 `/api` 请求转发到 `http://127.0.0.1:3000`。

后端端口改变或前后端分开部署时，可参考 `apps/web/.env.example` 配置 `VITE_API_BASE_URL`，并将后端 `WEB_ORIGIN` 设置为实际前端来源。前端变量在构建时写入浏览器文件，禁止放入任何 API Key。生产环境默认需要将同域 `/api` 转发至 NestJS，或在构建时指定后端地址。

```bash
pnpm build
```

使用真实配置打开页面会自动发起一次出题请求；提交录音会调用转写与评估，可能产生费用。无可用 LLM 配置或出题失败时，出题接口会回退预置题库；作答所需配置缺失时返回错误。

## 使用流程

1. 等待论题显示，点击话筒并允许麦克风权限。
2. 作答后点击结束，或等待 3 分钟自动结束；可回听、重录，再提交回答。
3. 等待转写和评估完成，阅读只读回答文本、原文引用、练习建议与三维评分。
4. 点击“同题再答一次”，第二次提交后查看两轮分数变化并切换各自全文与反馈。
5. 点击“换一题”后清空当前练习并获取新题；换题失败时保留原来的练习。

录音限 6 MiB，只通过麦克风作答，无文字输入替代入口。录音需要 localhost 或 HTTPS 以及支持 MediaRecorder 的浏览器；优先录制 WebM/Opus，支持时回退 MP4。已验证 Chrome，其他浏览器仍需实际设备确认。

提交失败时录音留在当前页面，可回听、重录或重试；重试会重新执行模型调用。处理期间禁止重复提交和换题。两次上游调用各限时 60 秒，前端等待上限为 135 秒。

## 后端接口

完整契约见 [docs/api-contract.md](docs/api-contract.md)。

| 接口 | 用途 |
| --- | --- |
| GET /api/health | 健康检查 |
| GET /api/topics/random | 获取论题，可附带 excludeTopicId |
| POST /api/transcriptions | 独立转写验收，multipart 字段 audio、durationSeconds |
| POST /api/attempts | 完整作答，multipart 字段 audio、metadata |

metadata 为 JSON 字符串，包含完整 `topic`、数字 `round`（1 或 2）及数字 `durationSeconds`（大于 0、不超过 180）。成功返回 HTTP 201、`{ attempt, evaluation }`；评估 ID 与作答 ID 由后端关联。主流程直接调用完整作答接口，不先调用独立转写接口。

项目设计与 R1–R8 阶段见 [design.md](design.md)，版本状态见 [version.md](version.md)。
