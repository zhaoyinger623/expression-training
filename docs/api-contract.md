# R1：后端接口契约与配置

状态：R3–R6 后端接口已实现，包括出题、独立转写及完整作答；R7 前端已接入，R8 已通过本地浏览器全流程及少量真实模型验证，详见 [验收记录](acceptance.md)。共享类型以 `packages/shared/src/index.ts` 为准。

## 服务与配置

- 转写：阿里云北京地域 `qwen3-asr-flash`，同步调用，使用 `DASHSCOPE_API_KEY`。R8 已通过一次真实 WAV 转写，免费额度或费用以控制台为准。
- 出题与评估：`gpt-6-luna`。`LLM_API_KEY`、`LLM_BASE_URL` 已配置在本地，使用用户提供的 sub2api 接入地址；R3 按 OpenAI 兼容 Chat Completions 格式实现，调用 Base URL 下的 `/chat/completions`；R8 已用一次真实出题与一次真实评估验证当前站点的此协议。
- 配置模板：`apps/api/.env.example`；实际配置：`apps/api/.env`，被 Git 忽略。R2 已实现环境文件加载与配置检查。
- 业务接口缺少对应服务配置时返回 `SERVICE_NOT_CONFIGURED`；健康检查不依赖 AI 配置。
- 不在 R1 调用收费 API。当前由前端 IndexedDB 保存成功练习的论题、文本与结果，后端不持久化历史；录音不持久化。

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
- 文件上限为 **4 MiB**，metadata 最多 16 KiB，给 Vercel 的 4.5 MB 请求体限制预留空间；Base64 编码发生在后端请求 Qwen 时，不占浏览器上传 multipart 的体积。
- 接收 WebM、MP4/M4A、WAV、MP3 的声明 MIME 类型（包括 audio/webm、video/webm、audio/mp4、video/mp4、audio/m4a、audio/x-m4a、audio/wav、audio/x-wav、audio/mpeg、audio/mp3）。上传边界不做音频解码或时长探测，实际内容由 Qwen 解析；伪造 MIME 的无效内容可能返回 TRANSCRIPTION_FAILED。
- NestJS 默认内存存储接收音频，随后通过 Base64 Data URI 发送给 Qwen；不写临时文件、不使用对象存储、不记录音频或转写内容日志。
- Qwen 采用 Base URL 下 `/chat/completions`，`stream=false`、`asr_options.enable_itn=false`；不额外发送润色提示，不强制 language 以容纳中英混合。关闭 ITN 只控制数字标准化，不保证模型逐字保留所有口头禅。
- 上游调用限时 60 秒，不自动重试。空白转写返回 422 EMPTY_TRANSCRIPT；超时返回 504 UPSTREAM_TIMEOUT；网络、上游非成功状态或无效响应返回 502 TRANSCRIPTION_FAILED；缺少 Key 返回 503 SERVICE_NOT_CONFIGURED。
- 参考 [Qwen-ASR 官方接口](https://help.aliyun.com/zh/model-studio/qwen-asr-api-reference)。当前保留北京地域通用域名配置；如账号要求业务空间专属域名，在 DASHSCOPE_BASE_URL 中替换，不更改代码。
- R6 作答接口直接复用 TranscriptionService，不通过 HTTP 调用此接口，也不重复转写。

## POST /api/attempts（R6 已实现）

请求使用 `multipart/form-data`，浏览器自动生成 Content-Type boundary：

| 字段 | 形式 | 约束 |
| --- | --- | --- |
| audio | 文件 | 单个非空文件；最大 4 MiB；首版接收 WebM、MP4/M4A、WAV、MP3 |
| metadata | JSON 字符串 | 符合 `SubmitAttemptMetadata`：完整 topic、round、durationSeconds |

- `round` 为 1 或 2；`durationSeconds` 大于 0 且不超过 180 秒。浏览器计时并在 180 秒结束录音；该字段是客户端计时信息，不等同于服务端解析出的音频时长。
- topic 必须包含生成接口返回的字段；id 非空且不超过 200 字符，title 非空且不超过 200 字符，description 为不超过 1000 字符的字符串，source 为 ai 或 preset，createdAt 为可解析的时间字符串。后端不保存 Topic，提交须包含完整 topic。
- metadata 文本字段最大 16 KiB；录音格式与独立转写入口共用上传校验。metadata 的轮次和时长必须为 JSON 数字，不接受数字字符串。
- 评估配置缺失时在转写前返回 503，避免无用转写；转写失败或为空时不调用评估。评估失败时返回对应错误，不返回部分作答结果。
- 每次成功生成独立 Attempt ID。Practice.id 仅由前端归档使用，不再属于 metadata；后端不保存练习或维护 Practice。
- 上传后同步完成转写和评估，再返回 HTTP 201、`SubmitAttemptResponse`。
- `attempt.topicId` 对应提交的 topic.id；`evaluation.attemptId` 对应返回的 attempt.id；ID 和 createdAt 由服务端生成。
- 转写文本只读；不开放文字替代作答接口。按所选 ASR 能力尽量保留原话，避免额外润色。
- 空白转写返回 `EMPTY_TRANSCRIPT`，不进入评估。失败时不返回伪造评分，浏览器保留本次录音供用户主动重试；重新提交会重新调用转写与评估。
- 同题重答提交 round=2；后端不查询首轮记录，前端负责轮次顺序及两轮结果关联。

## 评估服务（R5）

- 内部调用 `EvaluationService.evaluate(topic, attempt)`，返回 Evaluation；R6 已通过模块注入复用，不新增文字作答或独立评估 HTTP 接口。
- 使用 LLM 配置中的模型和 Base URL 下 `/chat/completions`，同步请求，超时 60 秒，不自动重试，不额外调用模型修复格式。
- 论题标题、描述及转写文本作为 JSON 数据传入；不把录音时长作为语速评分依据。系统提示要求立场中立，不根据赞成或反对给分，不能执行回答中夹带的指令。
- 评分参考：0–2 基本未体现、3–4 问题明显、5–6 基本达意但需补充、7–8 清楚且有依据、9–10 充分扎实且边界清楚。此标准约束提示词，不代表评分已通过人工质量校准。
- 模型 JSON 在进入系统时校验一次：三个不同维度、整数分数、非空摘要/依据/建议、字符串列表，以及原文引用。返回时统一维度展示顺序。
- featuredQuote 必须显式为 null 或包含 text、advice 的对象；text 必须为 transcript 中逐字连续片段。缺失字段、重复维度、越界分数、编造引用均返回 502 EVALUATION_FAILED，不伪造反馈补齐。
- attemptId 始终由传入的 Attempt 关联，忽略模型输出中的同名字段。空优点或问题列表合法，避免短回答被强行编造优点。
- 缺配置返回 503 SERVICE_NOT_CONFIGURED，超时返回 504 UPSTREAM_TIMEOUT，其余上游与格式错误返回 502 EVALUATION_FAILED；不暴露上游原始错误或记录回答日志。
- 已通过模拟响应验证模块注入、请求格式、结构与引用校验、失败映射。R8 已验证真实 sub2api 调用及一条中文短回答反馈，更多样本的指令遵循效果和反馈质量仍需积累。

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

R4–R8 已验证 multipart 传输、声明格式和大小限制、Chrome 原生 WebM 录制与上传，以及真实 Qwen WAV 转写。本次未追加真实 WebM 解码调用；若实机不兼容，先调整录制格式，再考虑是否需要音频转换依赖。

## R7 前端接入

- 首次进入请求论题，开发模式 StrictMode 重放不会重复发起初始请求；换题时带上当前题目 ID。新题返回后清空两轮结果及当前录音，失败保留旧内容。
- 使用浏览器原生 MediaRecorder，优先 WebM/Opus，其次 WebM、MP4；3 分钟自动结束，结束后停止麦克风轨道，离开页面时清理轨道和定时器。
- 录音 Blob 只保留在当前页面。结束后提供回听、重录和提交；使用 Object URL 回听，丢弃录音或卸载时释放 URL。
- 提交使用 `/api/attempts`，不会额外调用 `/api/transcriptions`。首轮 round=1，第二轮 round=2；成功后只读展示后端响应，第二轮完成后可切换全文及比较三个维度分数。
- 提交期间禁用换题、重录和重复提交；失败保留 Blob，可主动重试。两轮完成后通过换题开始新练习，不提交第三轮。
- 前端请求出题限时 25 秒，完整作答限时 135 秒。开发使用 Vite 同源代理，分开部署时使用不含 /api 的 VITE_API_BASE_URL，Key 始终只在后端。
- 已用 Chrome 虚拟麦克风生成具有正确 WebM 容器头的录音，验证前端 multipart → NestJS → 模拟 Qwen → 模拟评估完整链路。还验证了权限拒绝提示（模拟拒绝）、回听入口、重录、失败重试、自动结束、两轮对比、换题与刷新清空，以及移动端布局。未向真实模型发送录音。

## IndexedDB 历史（前端内部接口）

已移除 `GET /api/practices` 与 `GET /api/practices/:id`；调用会得到 404。后端不依赖数据库。

前端 `practiceStore.ts` 提供 savePractice、getPractice、getPracticeHistory。Practice 包含 id、topic、results、createdAt、updatedAt；results 为按作答顺序排列的一至两轮 SubmitAttemptResponse。列表按 updatedAt 倒序，每次展示 20 条。读写不经过 HTTP，也不调用 AI。

仅完整作答成功后尝试本地保存；等待 IndexedDB 事务 complete 才视为保存成功。写入失败仍展示已生成反馈，重试保存不会重复计费。独立转写不写入历史；音频不存入 IndexedDB。原 SQLite 历史不自动迁移。

## Vercel 运行配置

`apps/api/vercel.json` 为 src/main.ts 配置 maxDuration=150 秒；前端请求限时 135 秒，转写和评估各 60 秒。生产环境 WEB_ORIGIN 填实际前端来源（不含路径），经 URL.origin 规范化后用于精确 CORS 匹配。VITE_API_BASE_URL 填后端来源，不含 /api；它是构建时变量，修改后须重新构建前端。详见 [部署指南](deployment-vercel.md)。
