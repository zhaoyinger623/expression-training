# R1：后端接口契约与配置

状态：R3 论题接口、R4 独立转写接口及 R5 评估服务已实现；完整作答接口将在 R6 串联。共享类型以 `packages/shared/src/index.ts` 为准。

## 服务与配置

- 转写：阿里云北京地域 `qwen3-asr-flash`，同步调用，使用 `DASHSCOPE_API_KEY`。本地已配置 Key，不代表已验证可调用或存在免费额度。
- 出题与评估：`gpt-6-luna`。`LLM_API_KEY`、`LLM_BASE_URL` 已配置在本地，使用用户提供的 sub2api 接入地址；R3 按 OpenAI 兼容 Chat Completions 格式实现，调用 Base URL 下的 `/chat/completions`；用户提供站点的实际兼容性尚未用真实请求验证。
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
- `excludeTopicId` 如提供，必须为 1–200 字符的非空字符串；重复参数或其他类型返回 HTTP 400。
- AI 请求最多等待 15 秒，不自动重试；响应需为含 title、description 的 JSON 对象，两字段均为非空字符串且分别不超过 200、1000 字符，否则回退。
- 预置题使用固定 ID，AI 题目由服务端生成 UUID；`createdAt` 为 ISO 8601 时间字符串。
- 请求协议参考 [OpenAI Chat Completions](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create)。本阶段使用本地模拟上游验证，不等同于真实服务连通性验证。

## POST /api/transcriptions（R4 独立验收接口）

- 请求为 multipart/form-data：`audio` 是一个非空录音文件，`durationSeconds` 是大于 0 且不超过 180 的数字字符串；只接收一个文件和一个文本字段。
- HTTP 201 返回 `TranscriptionResponse`：`{ "transcript": "转写原文" }`。不生成 Attempt 或评估结果。
- 文件上限为 **6 MiB**，为 Base64 编码（约增大 1/3）预留 Qwen 输入限制所需空间；R1 的 8 MiB 上限据此调整。
- 接收 WebM、MP4/M4A、WAV、MP3 的声明 MIME 类型（包括 audio/webm、video/webm、audio/mp4、video/mp4、audio/m4a、audio/x-m4a、audio/wav、audio/x-wav、audio/mpeg、audio/mp3）。上传边界不做音频解码或时长探测，实际内容由 Qwen 解析；伪造 MIME 的无效内容可能返回 TRANSCRIPTION_FAILED。
- NestJS 默认内存存储接收音频，随后通过 Base64 Data URI 发送给 Qwen；不写临时文件、不使用对象存储、不记录音频或转写内容日志。
- Qwen 采用 Base URL 下 `/chat/completions`，`stream=false`、`asr_options.enable_itn=false`；不额外发送润色提示，不强制 language 以容纳中英混合。关闭 ITN 只控制数字标准化，不保证模型逐字保留所有口头禅。
- 上游调用限时 60 秒，不自动重试。空白转写返回 422 EMPTY_TRANSCRIPT；超时返回 504 UPSTREAM_TIMEOUT；网络、上游非成功状态或无效响应返回 502 TRANSCRIPTION_FAILED；缺少 Key 返回 503 SERVICE_NOT_CONFIGURED。
- 参考 [Qwen-ASR 官方接口](https://help.aliyun.com/zh/model-studio/qwen-asr-api-reference)。当前保留北京地域通用域名配置；如账号要求业务空间专属域名，在 DASHSCOPE_BASE_URL 中替换，不更改代码。
- R6 的作答接口将复用 TranscriptionService，不通过 HTTP 调用此接口，也不重复转写。

## POST /api/attempts

请求使用 `multipart/form-data`，浏览器自动生成 Content-Type boundary：

| 字段 | 形式 | 约束 |
| --- | --- | --- |
| audio | 文件 | 单个非空文件；最大 6 MiB；首版接收 WebM、MP4/M4A、WAV、MP3 |
| metadata | JSON 字符串 | 符合 `SubmitAttemptMetadata`：完整 topic、round、durationSeconds |

- `round` 为 1 或 2；`durationSeconds` 大于 0 且不超过 180 秒。浏览器计时并在 180 秒结束录音；该字段是客户端计时信息，不等同于服务端解析出的音频时长。
- topic 必须包含生成接口返回的字段；title 非空且不超过 200 字符，description 不超过 1000 字符。后端不存储 Topic，因此不能只提交 topicId。
- 上传后同步完成转写和评估，再返回 HTTP 201、`SubmitAttemptResponse`。
- `attempt.topicId` 对应提交的 topic.id；`evaluation.attemptId` 对应返回的 attempt.id；ID 和 createdAt 由服务端生成。
- 转写文本只读；不开放文字替代作答接口。按所选 ASR 能力尽量保留原话，避免额外润色。
- 空白转写返回 `EMPTY_TRANSCRIPT`，不进入评估。失败时不返回伪造评分，浏览器保留本次录音供用户主动重试；重新提交会重新调用转写与评估。
- 同题重答作为独立请求提交 round=2；前端保留两次结果并对比，后端不限制请求次数或维护轮次状态。

## 评估服务（R5）

- 内部调用 `EvaluationService.evaluate(topic, attempt)`，返回 Evaluation；R6 通过模块注入复用，不新增文字作答或独立评估 HTTP 接口。
- 使用 LLM 配置中的模型和 Base URL 下 `/chat/completions`，同步请求，超时 60 秒，不自动重试，不额外调用模型修复格式。
- 论题标题、描述及转写文本作为 JSON 数据传入；不把录音时长作为语速评分依据。系统提示要求立场中立，不根据赞成或反对给分，不能执行回答中夹带的指令。
- 评分参考：0–2 基本未体现、3–4 问题明显、5–6 基本达意但需补充、7–8 清楚且有依据、9–10 充分扎实且边界清楚。此标准约束提示词，不代表评分已通过人工质量校准。
- 模型 JSON 在进入系统时校验一次：三个不同维度、整数分数、非空摘要/依据/建议、字符串列表，以及原文引用。返回时统一维度展示顺序。
- featuredQuote 必须显式为 null 或包含 text、advice 的对象；text 必须为 transcript 中逐字连续片段。缺失字段、重复维度、越界分数、编造引用均返回 502 EVALUATION_FAILED，不伪造反馈补齐。
- attemptId 始终由传入的 Attempt 关联，忽略模型输出中的同名字段。空优点或问题列表合法，避免短回答被强行编造优点。
- 缺配置返回 503 SERVICE_NOT_CONFIGURED，超时返回 504 UPSTREAM_TIMEOUT，其余上游与格式错误返回 502 EVALUATION_FAILED；不暴露上游原始错误或记录回答日志。
- 已通过模拟响应验证模块注入、请求格式、结构与引用校验、失败映射。真实 sub2api 协议兼容性、指令遵循效果及中文反馈质量仍待实际联调。

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

R4 已验证 multipart 传输、声明格式和大小限制；尚未调用真实 Qwen 解码浏览器录音。真实音频兼容性在 R7 联调；如不兼容，先调整录制格式，再考虑是否需要音频转换依赖。
