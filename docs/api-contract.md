# R1：后端接口契约与配置

状态：契约已确定，业务接口尚未实现。共享类型以 `packages/shared/src/index.ts` 为准。

## 服务与配置

- 转写：阿里云北京地域 `qwen3-asr-flash`，同步调用，使用 `DASHSCOPE_API_KEY`。本地已配置 Key，不代表已验证可调用或存在免费额度。
- 出题与评估：`gpt-6-luna`。`LLM_API_KEY`、`LLM_BASE_URL` 已配置在本地，使用用户提供的 sub2api 接入地址；具体接入协议在 R3 核对，不默认第三方服务与官方接口完全一致。
- 配置模板：`apps/api/.env.example`；实际配置：`apps/api/.env`，被 Git 忽略。R2 已实现环境文件加载与配置检查。
- 业务接口缺少对应服务配置时返回 `SERVICE_NOT_CONFIGURED`；健康检查不依赖 AI 配置。
- 不在 R1 调用收费 API。录音、论题与结果均不持久化；当前练习由浏览器维护。

## GET /api/health

保留现有响应：HTTP 200，`{ "status": "ok" }`。

## GET /api/topics/random

- 首次进入或用户换题时调用，每次尝试生成新论题。
- 可选查询参数 `excludeTopicId`：当前题目 ID，预置题回退时避开该题；不保证 AI 生成内容语义上绝不重复。
- HTTP 200：`TopicResponse`，包含 `topic`。
- AI 调用失败、超时或缺少 LLM 配置时回退预置题库，`source` 为 `preset`；成功时为 `ai`。
- `id` 为不透明字符串，`createdAt` 为 ISO 8601 时间字符串。

## POST /api/attempts

请求使用 `multipart/form-data`，浏览器自动生成 Content-Type boundary：

| 字段 | 形式 | 约束 |
| --- | --- | --- |
| audio | 文件 | 单个非空文件；最大 8 MiB；首版接收 WebM、MP4/M4A、WAV、MP3 |
| metadata | JSON 字符串 | 符合 `SubmitAttemptMetadata`：完整 topic、round、durationSeconds |

- `round` 为 1 或 2；`durationSeconds` 大于 0 且不超过 180 秒。浏览器计时并在 180 秒结束录音；该字段是客户端计时信息，不等同于服务端解析出的音频时长。
- topic 必须包含生成接口返回的字段；title 非空且不超过 200 字符，description 不超过 1000 字符。后端不存储 Topic，因此不能只提交 topicId。
- 上传后同步完成转写和评估，再返回 HTTP 201、`SubmitAttemptResponse`。
- `attempt.topicId` 对应提交的 topic.id；`evaluation.attemptId` 对应返回的 attempt.id；ID 和 createdAt 由服务端生成。
- 转写文本只读；不开放文字替代作答接口。按所选 ASR 能力尽量保留原话，避免额外润色。
- 空白转写返回 `EMPTY_TRANSCRIPT`，不进入评估。失败时不返回伪造评分，浏览器保留本次录音供用户主动重试；重新提交会重新调用转写与评估。
- 同题重答作为独立请求提交 round=2；前端保留两次结果并对比，后端不限制请求次数或维护轮次状态。

## 评估结果

- dimensions 固定三个维度：观点与论证、结构与连贯、表达清晰度；每个维度恰好一次，score 为 0–10 整数。
- 每个维度提供 reason 和 suggestion；strengths、issues 为简短字符串列表，nextStep 给出最重要的一条练习建议。
- summary 对应页面反馈标题；featuredQuote 对应引用原文与建议，引用必须来自 transcript，找不到合适引用时为 null。
- 短回答或偏题回答仍给有依据的反馈；不凭文本推断语速、停顿或口音。
- API 请求和 AI 响应分别在进入系统时校验一次，内部使用类型流转。

## 错误约定

失败响应统一为 `ApiErrorResponse`，message 用于向用户解释，不包含密钥或上游原始响应。

| HTTP | code | 含义 |
| --- | --- | --- |
| 404 | NOT_FOUND | 接口不存在 |
| 其他 4xx | HTTP_ERROR | 其他 HTTP 请求错误 |
| 400 | INVALID_REQUEST | metadata、轮次、时长或文件内容不符合要求 |
| 413 | AUDIO_TOO_LARGE | 超过上传大小限制 |
| 415 | UNSUPPORTED_AUDIO_FORMAT | 不支持的音频格式 |
| 422 | EMPTY_TRANSCRIPT | 未识别出可评估的语音 |
| 502 | TRANSCRIPTION_FAILED / EVALUATION_FAILED | 上游服务失败或响应结构无效 |
| 504 | UPSTREAM_TIMEOUT | 上游调用超时 |
| 503 | SERVICE_NOT_CONFIGURED | 作答所需服务配置缺失 |
| 500 | INTERNAL_ERROR | 未预期的服务端错误 |

录音格式和大小在 R4 用真实浏览器样本确认；如不兼容，先调整录制格式，再考虑是否需要音频转换依赖。
