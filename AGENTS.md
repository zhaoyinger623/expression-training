# 项目协作规范

本文件适用于本项目。当前任务的明确要求及更高优先级指令优先。

## 实施原则

1. 防过度防御：几乎不会发生的边界/并发问题，讲清楚概率并经用户确认后再加，严禁为“理论上更稳”私自膨胀代码。
2. 入口单词校验：外部数据只在边界校验一次，内部靠类型系统流转，禁止层层重复判断。
3. 拒绝提前后续：单次使用的逻辑就近内联，不随意提前拆分无意义的helper。
4. 控制复杂度：非必要不用try/catch，能单函数清晰搞定的别硬拆。

## 项目约定

- 使用 pnpm workspace + Turborepo 管理 monorepo；应用为 React 前端和 NestJS 后端。
- 以 `design.md` 记录的方案 A 为实施依据，优先完成单用户可运行的练习闭环。
- 控制改动范围；新增功能先核对 `design.md` 的 P0/P1 边界。
- `version.md` 按阶段记录用户可见的成果；多次小修改合并到同一版本，不逐次增加版本号或记录中间尝试。
- 完成大功能迭代或小功能修复后创建 Git commit；提交前核对实际差异。只有达到新阶段时才新增版本号。

## 文档职责

- `design.md`：产品范围、技术架构、数据模型与视觉设计，不记录开发进度或验收结果。
- `AGENTS.md`：AI 协作规则、代码组织与开发约定，不作为阶段进度表。
- `docs/development-plan.md`：开发顺序、阶段划分及阶段状态；历史计划应明确其适用版本或阶段。
- `docs/acceptance.md`：实际执行的检查、验收结果及未覆盖范围，不把计划写成已验证事实。
- `version.md`：按版本汇总用户可见成果。
- `README.md`：项目介绍、启动使用说明与相关文档入口。

## 前端目录与分层规范

`apps/web/src` 按职责分层，业务代码不得长期平铺在根目录。以下为目标结构，目录按实际需要创建，不建立空目录或占位文件：

```text
apps/web/src/
  main.tsx                    应用挂载、全局样式导入
  App.tsx                     应用壳、全局 Provider 与路由入口
  router/
    index.tsx                 路由配置、页面映射与导航入口
  pages/
    practice/
      index.tsx               练习页面，组织论题、录音、反馈与同题重答
      components/             仅该页面使用的业务组件
      practice.module.less    页面样式
    history/
      index.tsx               历史页面
      history.module.less
  components/                 跨页面复用的 UI 组件，样式与组件就近存放
  hooks/
    useRecorder.ts            可复用的 React Hook
  stores/                     跨组件、跨页面共享的内存状态与更新操作
  api/
    client.ts                 HTTP/SSE 请求、超时与错误处理
    practice.ts               论题、转写与评估接口
  storage/
    practiceStorage.ts        IndexedDB 练习历史读写
  styles/                     全局基础样式与设计变量
  types/                      仅前端使用的共享类型
  utils/                      跨模块复用、无副作用的通用函数
```

### 职责与依赖

- `main.tsx` 只负责启动；`App.tsx` 只负责应用级组装，不堆积录音、请求、历史存储或反馈展示逻辑。
- `router` 集中管理页面映射与导航，不承载页面业务。当前单页阶段可使用简单页面映射；增加 URL 路由时再按需求选择路由方案，不为目录分层单独引入依赖。
- `pages` 负责页面流程和模块组装。页面内部组件放在该页面的 `components` 中；确有跨页面复用时才提升到顶层 `components`，避免提前抽象。
- `stores` 只管理需要共享的内存状态。页面局部状态优先使用 `useState` / `useReducer`，不强制全部进入 store，也不为分层引入状态库。IndexedDB 读写归 `storage`，不能仅因文件名含 Store 就放入 `stores`。
- `api` 统一封装后端调用和网络边界处理；`storage` 封装浏览器持久化。两者不依赖页面或 UI 组件，不处理弹窗、导航等界面行为。
- 页面、业务 Hook 或 store 按需调用 `api` / `storage`；底层模块不得反向导入 `pages`、`router` 或 `App.tsx`，页面之间也不相互导入实现。共享逻辑放入对应职责目录，避免循环依赖。
- 前后端共享契约继续放在 `packages/shared`；`types` 仅收纳前端共享类型，局部类型就近定义。`utils` 只接收确有复用的纯函数，单次使用逻辑保持内联。
- 组件使用 PascalCase，Hook 使用 `useXxx`，普通模块使用 camelCase。组件及页面样式使用 Less Modules 并就近放置，`styles` 只保留全局基础样式与设计变量。

### 现有文件迁移对应

以下为后续整理代码时的落点，本节不表示迁移已经完成。迁移时同步修改导入并运行前端构建，保持现有练习流程和历史恢复行为。

| 当前文件 | 目标位置 / 处理方式 |
| --- | --- |
| `App.tsx` | 练习业务移入 `pages/practice/index.tsx`，应用壳保留在 `App.tsx`，页面选择交由 `router/index.tsx` 管理 |
| `HistoryPanel.tsx` | 历史视图移入 `pages/history/index.tsx`，打开练习的回调与导航由上层组装 |
| `api.ts` | 请求与 SSE 基础逻辑放入 `api/client.ts`，业务接口放入 `api/practice.ts` |
| `practiceStore.ts` | 现有 IndexedDB 逻辑移入 `storage/practiceStorage.ts`；未来需要共享内存状态时再创建 `stores` 模块 |
| `useRecorder.ts` | 移入 `hooks/useRecorder.ts` |
| `styles.module.less` | 按归属拆入页面或组件旁，全局基础样式与变量移入 `styles` |
