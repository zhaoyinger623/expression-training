# 首次部署：Vercel + IndexedDB

本指南面向首次部署的使用者。完成后，你将有一个 HTTPS 网站：React 和 NestJS 分别运行在两个 Vercel 项目中，练习历史保存在用户当前浏览器，无需开通数据库。代码已适配，尚未执行云部署。

## 1. 准备 GitHub 仓库

1. 登录 [GitHub](https://github.com)，新建 Private 私有仓库，例如 `expression-training`。
2. 创建空仓库，不另外生成 README、license 或 .gitignore。
3. 将本地项目推送到仓库。若仓库尚未关联远程地址，在项目根目录执行下面的命令；将 URL 换成你自己的仓库地址。若已有 origin，用 `git remote -v` 核对后使用原地址，不重复添加。

```bash
git remote add origin https://github.com/你的用户名/expression-training.git
git push -u origin main
```

项目已忽略 `.env` 和旧 SQLite 数据目录。推送前核对 GitHub 上没有真实 Key 和数据文件，不上传本地环境文件。后续每次推送到生产分支，Vercel 会根据项目变更触发部署。

## 2. 登录 Vercel

打开 [Vercel](https://vercel.com)，使用 GitHub 登录，授权访问刚才的仓库。

同一个仓库要导入两次，分别创建后端 `yanxu-api` 和前端 `yanxu-web`。这是 Vercel 支持的 [monorepo 部署方式](https://vercel.com/docs/monorepos)。下面的域名都是示例，以控制台实际分配的地址为准。

## 3. 先创建后端项目

在 Vercel 首页点击 **Add New → Project**，选择仓库旁的 **Import**。

| 设置 | 内容 |
| --- | --- |
| Project Name | `yanxu-api` |
| Root Directory | `apps/api` |
| Framework Preset | NestJS |
| Node.js Version | 建议 22.x；在项目 Settings 中确认 |
| Install Command | 保留自动识别的 pnpm 安装方式 |
| Build / Output 设置 | 保留 NestJS 框架默认值，不设置静态 dist 输出目录 |

由于引用 `packages/shared`，在 Root Directory 设置中允许构建访问根目录外的源文件（如果界面显示该选项）。保留仓库根目录的 `pnpm-lock.yaml`、`pnpm-workspace.yaml` 和 `packageManager` 字段，不能只上传 apps/api。

在 **Environment Variables** 添加以下配置，至少勾选 **Production**。需要预览部署时再为 Preview 配置对应值。

| 变量 | 内容 |
| --- | --- |
| `DASHSCOPE_API_KEY` | 你的阿里云 Key |
| `DASHSCOPE_BASE_URL` | 本地后端 .env 中的同名值 |
| `ASR_MODEL` | `qwen3-asr-flash` |
| `LLM_API_KEY` | 你的 sub2api Key |
| `LLM_BASE_URL` | 本地后端 .env 中的同名值，包含 /v1 |
| `LLM_MODEL` | `gpt-6-luna` |
| `WEB_ORIGIN` | 先填 `http://localhost:5173`；前端部署后替换 |

不配置 SQLITE_PATH，不手动覆盖 Vercel 提供的 PORT，不上传 apps/api/.env。真实 Key 只放后端项目。

点击 **Deploy**，等待状态为 **Ready**。复制固定生产域名，例如 `https://yanxu-api.vercel.app`，打开：

```text
https://你的后端域名/api/health
```

预期显示 `{"status":"ok"}`。健康检查不调用 AI；它成功不代表模型服务已经连通。

仓库的 `apps/api/vercel.json` 仅声明 NestJS 原生框架，由 Vercel 识别 `src/main.ts` 入口并生成函数；不要把该源文件路径写入 `functions` 匹配规则，否则当前部署器可能报 unused_function。执行时限在后端项目 **Settings → Functions → Function Max Duration** 中设置为至少 **180 秒**，保存后重新部署；也可保留 Fluid Compute 的 300 秒默认值。在这里确认 Fluid Compute 已启用，并在部署后函数详情中核对有效时限。转写和评估分别通过 SSE 请求，上游分别限时 90 秒，浏览器单次请求等待上限 120 秒。Vercel 官方支持 [NestJS 入口识别](https://vercel.com/docs/frameworks/backend/nestjs) 和 [函数执行时限配置](https://vercel.com/docs/functions/configuring-functions/duration)。

## 4. 创建前端项目

再次点击 **Add New → Project**，导入同一个仓库。

| 设置 | 内容 |
| --- | --- |
| Project Name | `yanxu-web` |
| Root Directory | `apps/web` |
| Framework Preset | Vite |
| Node.js Version | 建议与后端一致，22.x |
| Install Command | 保留自动识别的 pnpm 安装方式 |
| Build Command | `pnpm build` |
| Output Directory | `dist` |

同样允许访问根目录外的共享包。`apps/web/vercel.json` 已声明框架、构建命令和输出目录。

添加前端环境变量：

```text
VITE_API_BASE_URL=https://你的后端生产域名
```

地址不包含 `/api`。不要配置任何 API Key，所有 VITE_ 变量都会进入浏览器构建文件。

点击 **Deploy**，等待 Ready，复制固定生产域名，例如 `https://yanxu-web.vercel.app`。首次打开页面会自动请求一次论题，可能产生模型费用。

## 5. 回填跨域来源

1. 打开后端 `yanxu-api` 项目，进入 **Settings → Environment Variables**。
2. 将 Production 的 `WEB_ORIGIN` 改成前端固定生产来源，例如 `https://yanxu-web.vercel.app`，不填写页面路径。
3. 进入后端 **Deployments**，重新部署生产版本，让配置生效。

后端将 WEB_ORIGIN 规范化为 URL.origin 后精确匹配。前端预览域名与生产域名不同，默认不会被这个配置允许；首次联调请使用固定生产域名。更换正式域名时同步更新 WEB_ORIGIN，且新域名不会自动获得旧域名的 IndexedDB 历史。

如果前端请求后端时得到 401 或登录页，检查后端的 **Deployment Protection** 是否拦截了生产接口。前后端分开部署时，接口域名必须能被前端请求访问；不要把 Vercel 的绕过密钥写进前端环境变量。当前应用没有账户认证，CORS 也不等于访问鉴权；计划对外公开收费模型接口时，需要先确定访问控制方式。

## 6. 部署后检查

先检查不产生模型费用的健康接口，再按自己的需要进行真实练习。获取论题、提交录音会调用 AI，费用以服务商账单为准。

| 操作 | 预期结果 |
| --- | --- |
| 打开后端 /api/health | 返回 status: ok |
| 打开前端生产地址 | 论题可显示；失败时可回退预置题 |
| 允许麦克风并录制短回答 | 能结束、回听、提交 |
| 提交回答 | 显示转写与反馈，并自动写入当前浏览器 |
| 刷新后打开历史记录 | 能找到刚才的练习并恢复反馈 |
| 对一轮历史继续重答 | 显示两轮对比，历史中仍为同一次练习 |
| 更换浏览器或设备 | 不出现另一浏览器或设备的历史，这是预期行为 |

录音文件上限为 4 MiB，metadata 为 16 KiB，给 Vercel 的整个请求体 4.5 MB 限制预留空间。Base64 发生在后端向 Qwen 发请求时，不扩大浏览器上传的 multipart。[平台请求限制](https://vercel.com/docs/functions/limitations)

IndexedDB 保存失败时，页面会保留反馈并提供“重试保存”，不会重新调用 AI；也可以选择“暂不保存，继续使用”。隐私模式、清除站点数据或存储空间回收可能使历史丢失。原 SQLite 文件仍保留在本地，不自动迁移。

## 7. 遇到问题先看这里

| 现象 | 优先检查 |
| --- | --- |
| TS2688 / 找不到 node 类型 | 使用最新提交；后端 tsconfig 已显式配置 typeRoots，避免 TypeScript 7 临时构建目录改变类型查找位置。无需删除 types: [node] 或关闭类型检查 |
| unused_function / src/main.ts 无匹配 | 确认部署的是修复后的最新提交；apps/api/vercel.json 不应包含 functions.src/main.ts，执行时限改在控制台设置 |
| 构建失败、找不到 @expression/shared | 两个项目的 Root Directory 和根目录外文件访问设置；仓库包含完整 workspace |
| 页面打开但请求 localhost | 前端 VITE_API_BASE_URL 未配置；设置后重新构建部署 |
| 浏览器报 CORS | 后端 WEB_ORIGIN 是否与前端地址的协议、域名、端口一致，是否已重新部署 |
| 后端返回 401 / HTML 登录页 | 检查 Deployment Protection，确认生产接口可访问 |
| 返回 413 | 录音是否超过 4 MiB；平台层的超限响应可能不经过 NestJS 错误处理 |
| 作答等待超时 | 后端 Functions 日志、有效执行时限、AI 服务连通性；健康检查正常不能排除上游失败 |
| API 配置缺失 | Key 和地址应在后端 Production 环境，修改后重新部署 |
| 换域名后历史为空 | IndexedDB 按网站来源隔离；使用固定生产地址 |

查看后端项目的 Logs / Functions 日志定位问题，不要在日志或截图中公开 Key。此文档给出配置和预期结果，不代表已经完成云端验收。

转写日志 `asr_timing` 只包含模型、音频字节数、函数地域及耗时，不包含录音、识别文本或 Key。`headersMs` 是发起上游请求到收到响应头的耗时，`firstTextMs` 是到首段非空文本的耗时，`totalMs` 是整个上游调用耗时（均为毫秒，包含请求传输）。这些指标不包含浏览器上传到后端、函数冷启动的时间；可结合浏览器 Network 的上传和等待阶段判断。若浏览器等待明显长于 `totalMs`，需继续检查上传、冷启动和网络路径；若 `firstTextMs` 接近 `totalMs` 且均较长，等待主要发生在上游返回首段文字之前。

### TypeScript 7 构建兼容说明

后端 `tsconfig.json` 显式设置 `typeRoots: ["./node_modules/@types"]`，相对路径以原 tsconfig 所在目录为基准。Vercel 的 TypeScript 7 适配器通过临时目录中的配置继承项目配置；若仅声明 types: ["node"]，默认类型查找可能从临时目录开始，从而触发 TS2688，即使 apps/api 已安装 @types/node。本地已复现该配置迁移后的编译错误，添加 typeRoots 后同一编译通过。[Vercel 编译器实现](https://github.com/vercel/vercel/blob/main/packages/node/src/typescript.ts)
