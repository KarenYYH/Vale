# Vale 实施计划 — Phase 0 公共核 + Agent 干活引擎

> 版本: v0.1 | 日期: 2026-06-11
> 范围: **Phase 0 公共核全部** + **§3.4/§3.5 Agent 干活引擎(详细主线)**
> 依据: [multi-surface-design.md](multi-surface-design.md) §3、§8 Phase 0、§9 已拍板决策
> 目标: 完成即解锁——手机端(场景一)、小B 云部署(场景二雏形)、**PWA 里"能干活"而非仅检索**

---

## 0. 一句话目标

把当前"有引擎、有 13 个工具,但传输是桩、无人用界面、无鉴权、无干活循环"的代码,补成一个**能 `docker run` 起全栈、手机浏览器能登录搜索、PWA 里能让 AI 真正干活**的最小可用产品。

---

## 1. 起点现状(2026-06-11,基于代码核实)

| 模块 | 现状 | 证据 |
|---|---|---|
| `@vale/core` 引擎 | ✅ 完整(39 源文件,FTS5+向量+linker+lint) | `core/src/**` |
| 13 个 MCP 工具 | ✅ handler 齐全 | `mcp/src/tools/*.ts` |
| 工具注册/中间件 | ✅ `createValeMcpServer` + 5 层中间件 | `mcp/src/server.ts` |
| MCP 传输 | ❌ **桩**:`serve` 只打印一行 JSON 假装初始化 | `cli/src/main.ts:138-149` |
| MCP SDK | ❌ 在 `package.json` 依赖里但 **未安装、从未 import** | `node_modules` 无 |
| REST API | ❌ 无 | — |
| 鉴权 | ❌ 无 | — |
| 干活引擎(agent loop) | ❌ **无**:`run_query` 只组装上下文,答案外包 | `mcp/src/tools/run-query.ts:33` |
| `@vale/web` PWA | ❌ 空壳(仅 App.tsx/main.tsx) | `web/src` 2 文件 |
| CLI | ⚠️ 单文件 278 行,命令多为桩 | `cli/src/main.ts` |
| Docker | ❌ 无 | — |

**可复用的契约(计划据此对齐,不重造):**
- `ToolDefinition { name, description, inputSchema, handler }` + `ok()/err()`(`mcp/src/tools/types.ts`)
- `createValeMcpServer(workspacePath, config) → { tools, executeTool }`(`mcp/src/server.ts`)
- `runQuery(ws, question) → { question, context, matches }`、`saveAnswer(ws, question, answer) → path`(`core/src/query/engine.ts`)
- `ValeConfig`(`shared/src/types/config.ts`),含 `mcp`/`embedding` 段

---

## 2. 工作分解(7 个工作块)

依赖关系:

```
WB1 MCP 传输 ──┐
               ├─► WB3 鉴权 ──► WB4 REST API ──┐
WB2 配置扩展 ──┘                                ├─► WB6 PWA ──► WB7 Docker
               └─► WB5 Agent 干活引擎(主线)────┘
```

WB1/WB2 无前置可并行起步;WB5(Agent 引擎)依赖 WB1(spawn 的 agent 反连本机 MCP)与 WB2(配置)。

---

### WB1 — MCP 传输层接线【解锁:开发者借宿主 agent】

**目标**:把 `serve` 从桩变成真能跑的 stdio + HTTP+SSE 传输,挂上已有的 `createValeMcpServer`。

**任务**
- [ ] 安装并接入 `@modelcontextprotocol/sdk`(已在 `mcp/package.json` 依赖,需 `pnpm install` 落地)
- [ ] 新增 `mcp/src/transports/stdio.ts`:用 SDK `StdioServerTransport`,把 `server.tools` 注册为 SDK tool、`executeTool` 作为 handler
- [ ] 新增 `mcp/src/transports/http.ts`:SDK `StreamableHTTPServerTransport`(或 SSE),绑定 `config.mcp.http.{host,port}`
- [ ] 改写 `cli/src/main.ts` 的 `runServe`:按 `--stdio`/`--http` 选传输,删除假 JSON 打印
- [ ] 把 13 个工具的 `inputSchema`(目前 zod raw shape)适配成 SDK 期望的 JSON Schema

**验收**
- `vale serve --stdio` 后,Claude Code `/list-mcp-tools` 能看到 13 个 `vale__` 工具并成功调用 `search_hybrid`
- `vale serve --http --port 4567` 后,MCP over HTTP 客户端能列出并调用工具
- 同步修正 [architecture.md:241-242](architecture.md#L241) 的 ⚠️ 标注

---

### WB2 — 配置扩展

**目标**:`ValeConfig` 增加 `auth`、`agent` 两段,供后续工作块读取。

**任务**
- [ ] `shared/src/types/config.ts` + `shared/src/config/schema.ts`(Zod)新增:
  - `auth: { provider: "local"; jwtSecret?: string; sessionTtl?: number }`
  - `agent: { engine: "auto"|"claude"|"codex"|"api"|"none"; preferredCli?: "claude"|"codex"; apiEndpoint?; apiModel?; keyRef?: string; updateCheck?: { enabled: boolean; intervalHours: number } }`(key 只存引用,不存明文,见 WB5)
- [ ] 内置默认值(**已拍板**):`agent.engine = "auto"`(探测选最高可用档)、`preferredCli = "claude"`(没检测到时默认装 claude)、`updateCheck = { enabled: true, intervalHours: 24 }`
- [ ] 向后兼容:旧配置缺 `auth`/`agent` 段时用默认值填充

**验收**:`vale config show` 输出含新段;旧 `vale.config.json` 不报错。

---

### WB3 — 鉴权层 `AuthProvider` + `LocalAuthProvider`

**目标**:落地 §3.2 的可插拔鉴权抽象 + 本地账号实现。

**任务**
- [ ] 新增 `@vale/auth` 包(或 `mcp/src/auth/`):定义 `AuthProvider`、`Principal`(照 §3.2 接口原文)
- [ ] **JWT 层移植旧版** [`backend/src/routes/auth.ts`](../LLM%20Wiki/llm-wiki/backend/src/routes/auth.ts) 的 `signToken`/`verifyToken`/`authMiddleware`(基于 `jose`,几乎可直接用)
- [ ] `LocalAuthProvider`:用户名密码(bcrypt/argon2)+ JWT 签发/校验;用户存工作区下 `.vale/users.json` 或 SQLite。⚠️ **密码校验需新写**——旧版 `/login` 是 OAuth dev 桩(不验密码,返回硬编码 `dev-user-1`),不可照搬
- [ ] 中间件:REST 与 HTTP MCP 请求经 `authenticate()` → 注入 `Principal` 到 ctx
- [ ] `authorize(principal, perm)`:复用 `mcp/src/middleware/permissions.ts` 已有的工具危险分级(只读 vs 高危)

**验收**:无 token 调 REST 受保护端点返回 401;`POST /api/auth/login` 正确账号返回 JWT;高危工具(create_note 等)需对应角色。

**安全须知(security_awareness)**:HTTP 暴露的服务**默认带鉴权**,不得裸跑;`jwtSecret` 不入库明文,从环境变量/keychain 读。

---

### WB4 — HTTP REST API 层(给 PWA/OA H5 用)

**目标**:在业务层(13 工具 handler)之上加面向"人/前端"的 REST,复用 handler 不重写逻辑。

**任务**
- [ ] 选 Hono(§3.1 建议,旧版 backend 可移植;运行时用 Node adapter 而非 CF Workers)
- [ ] 实现 §3.1 MVP 端点集,每个端点薄封装对应工具/core 函数:

  | 端点 | 复用 |
  |---|---|
  | `POST /api/auth/login` | WB3 |
  | `GET /api/search?q=&mode=` | search_* 工具 |
  | `POST /api/query` | WB5 干活引擎(非裸 run_query,见下) |
  | `GET /api/notes/:path` / `PUT /api/notes/:path` | core fs / create_note |
  | `POST /api/ingest` | run_ingest |
  | `GET /api/graph` / `GET /api/health` / `GET /api/lint` | 对应工具 |
- [ ] 全端点过 WB3 鉴权中间件;`resolveSafePath` 约束文件操作在工作区内(§4.4)

**验收**:curl 带 JWT 能跑通 search/query/notes 读写;路径遍历被拒。

---

### WB5 — Agent 干活引擎【★ 详细主线,§3.4/§3.5】

> 这是把 Vale 从"检索库"变成"能干活助理"的关键件,也是规划新补的核心。分四档,带自动降级。

#### 5.1 干活引擎抽象 + 四档降级链(§3.4)

**目标**:`POST /api/query` 不再裸返回上下文,而是经一个可降级的"答复引擎"。

```typescript
interface AnswerEngine {
  tier: "spawn-cli" | "api-llm" | "retrieval";
  answer(question: string, ctx): Promise<AnswerResult>; // 含答案文本 + 引用 + 用了哪些工具
}
```

降级链(启动时探测一次,运行时按可用性选最高档):

| 档 | 引擎 | 实现要点 | 前置 |
|---|---|---|---|
| 2b spawn-cli(**本期主线**) | `SpawnCliEngine`(§5.3) | spawn claude/codex headless,反连本机 MCP。先探测,没有就安装,配客户 key | WB1 + WB5.2 + 联网 |
| 2a sdk-inproc(**后续**) | `SdkRuntimeEngine`(§5.3) | **进程内**跑 Claude Agent SDK / Vercel AI SDK 多轮 loop。移植旧版 `src/ai/`,但**旧版尚有未解决问题**,待后续完善 | 模型 key + SDK 依赖 + 旧版问题修复 |
| 1 api-llm | `ApiLlmEngine` | 单轮:`runQuery` 组上下文 → 调注入模型 `complete()` → `saveAnswer` | 有模型端点+key |
| 0 retrieval | `RetrievalEngine` | **现状即此档**:直接返回 `runQuery` 的排序上下文+wikilink | 无,永远可用 |

> **【已拍板 2026-06-11】本期走档 2b(探测/安装 CLI),目标先把产品跑起来。** 档 2a(移植旧版 `src/ai/` SDK 内嵌 runtime)虽更轻,但旧版那套尚有未解决问题,搁置待后续完善。因此 **WB5.2 Agent Provider(探测/安装/key)本期必需**,是 2b 的前置。


**任务**
- [ ] 定义 `AnswerEngine` 接口 + 实现(本期:2b spawn-cli + 1 api-llm + 0 retrieval)
- [ ] 启动探测:**默认 `agent.engine = "auto"`(已拍板)**——探测后选最高可用档(2b→1→0);`config.agent.engine` 可强制指定某档
- [ ] `POST /api/query` 接答复引擎,响应体标注 `tier`(前端可提示"AI 生成"vs"检索结果")
- [ ] 降级:高档不可用(CLI 没装/没网/模型 key 缺)→ 自动落到下一档,不报错

**验收**:三档分别可强制跑通;拔网/删 key/卸 CLI 时自动降级且有日志。

#### 5.2 Agent Provider:探测 / 安装 / key(§3.5)

**目标**:落地"检测 claude/codex → 选择安装 → 配客户 key"。

```typescript
interface AgentProvider {
  detect(): Promise<AgentInfo | null>;   // 三关:which → --version → headless dry-run
  install(opts): Promise<AgentInfo>;     // 征得同意,联网拉官方最新版(不 bundle)
  checkUpdate(): Promise<UpdateInfo>;    // 定期:比对已装版本 vs 官方最新
  run(prompt, ctx): Promise<AgentResult>;// WB5.3
}
```

**任务**
- [ ] `detect()`:**仅检测 claude 和 codex**;每个三关校验(装了→版本够→dry-run 出 stdout),任一关失败视为不可用
- [ ] `install()`:都没有时让用户**确认选择** claude 还是 codex(**默认 claude**)→ 跑**官方安装渠道**(官方 install 脚本 / `npm i -g`),**不打包安装包**;给 `--yes` 旁路自动化;装不上自动降级到 WB5.1 档 1/0
- [ ] **`checkUpdate()` 定期检测最新版**(已拍板):后台周期性比对已装版本与官方最新(npm registry / 官方 version 端点);有新版→提示用户,可一键/自动更新。**约束**:① 需联网(与"要求联网"定位一致);② 检测频率可配(默认每日一次),用缓存避免每次启动都打网;③ 更新动作征得同意或走 `--yes`;④ 失败静默降级,不阻塞启动;⑤ 用 `ScheduleWakeup`/cron 思路实现周期任务,见 WB5.2 子任务
- [ ] key 配置:加密落盘(OS keychain/KMS/客户主密钥),`config.agent.keyRef` 只存引用;界面显示 `sk-...****` 不回显
- [ ] 多租户:key 按 `Principal.tenantId`/工作区隔离

**license 合规(§3.5 已核实,硬约束)**
- **不得 bundle claude/codex 安装包**(Claude Code 专有"all rights reserved",禁止 duplicate;Codex 虽 Apache 2.0 可 bundle 但本期统一走官方安装简化)
- 走"引导官方安装 + 客户自己 key"对两者都合规
- 离线 bundle 包(未来)仅 Codex 可做

#### 5.3 干活引擎实现(2b spawn CLI = 本期主线;2a SDK 内嵌 = 后续)

**2b — `SpawnCliEngine`（★ 本期实现）**
- [ ] `child_process.spawn` 起 `claude -p <prompt> --output-format json`(或 codex 等价 headless)
- [ ] 给子进程注入临时 MCP 配置,**指向 Vale 自己的 stdio/HTTP MCP**(WB1),使 agent 能反向调 13 工具 + skills → 闭环
- [ ] key 经**环境变量**注入(`ANTHROPIC_API_KEY=...`),**禁止**进命令行参数(`ps` 可见)或日志
- [ ] 超时(参考 skills runtime 的 30s 量级,可配)、并发上限、工作区隔离、错误捕获→降级
- [ ] 解析 CLI 的 JSON 输出 → 提取答案 + 工具调用轨迹 → 经 `saveAnswer` 落库

**2a — `SdkRuntimeEngine`（后续,暂搁置）**
> 旧版 `src/ai/` 的 SDK 内嵌 runtime 尚有未解决问题,本期不做。后续完善时:
- [ ] 移植旧版 [`src/ai/runtime/`](../LLM%20Wiki/llm-wiki/src/ai/runtime/) 的 `ChatRuntime` 接口 + 两套实现 + `factory.ts`
- [ ] **接线点改造**:in-process MCP 从旧版 `src/ai/mcp/valeServer.ts` 换成新版 `@vale/mcp` 的 `createValeMcpServer`
- [ ] 复用旧版工具权限桥 / 流式事件适配 / skill 注入;去 Electron 化
- [ ] 先排查并修复旧版遗留问题(待具体记录)

**安全须知**:spawn 的 agent 有 Write/Edit 能力,需防 prompt 注入诱导越权;严格隔离工作区;多租户限并发。

**验收(本期 2b)**:PWA 提问 → Vale spawn claude/codex → agent 调 `vale__search_hybrid` 取数 → 多步完成 → 答案回传;用户设备零安装。

---

### WB6 — `@vale/web` PWA(三页 + manifest/SW)

**目标**:把空壳建成可登录、可搜索、可浏览,且能"添加到主屏"的 PWA(§3.3/§4)。

**任务**
- [ ] 三页(P0):登录 / 搜索结果 / 笔记浏览;调 WB4 REST
- [ ] 问答区接 `POST /api/query`,按 `tier` 区分展示"AI 生成答案"或"检索片段"
- [ ] PWA manifest + Service Worker(可安装、基础离线壳)
- [ ] 响应式(手机优先);**不复用旧版 Electron GUI 代码**,仅借鉴交互(§9 决策 4)

**验收**:手机浏览器打开→登录→搜索→看笔记→提问拿到答复;可"添加到主屏"。

---

### WB7 — Docker 镜像(一条 `docker run` 起全栈)

**目标**:§5.1 交付物——单镜像含 core+REST+MCP+PWA 静态资源+嵌入式存储。

**任务**
- [ ] 多阶段 Dockerfile:构建各包 → 运行时 Node slim
- [ ] 一条命令起 REST+MCP+静态 PWA;挂载工作区卷
- [ ] 环境变量注入 `jwtSecret`、agent key;HTTPS 提示(云部署配 Let's Encrypt/平台证书,§4.4)
- [ ] (可选)CLI 在容器内可用,便于 `vale doctor`

**验收**:`docker run -v <ws>:/workspace -p ... vale` 后手机能访问完整 PWA。

---

## 3. 建议实施顺序

1. **WB1 + WB2**(并行)— 先让 `serve` 真能跑,拿到"开发者借宿主"这条最快可用路径,顺带验证工具链。
2. **WB3 → WB4** — 鉴权先行,再上 REST(REST 端点从第一天就带鉴权)。
3. **WB5**(主线,可与 WB4 后段交叠)— 先 5.1 降级链(档 0 现成、档 1 易接),再 5.2/5.3 spawn CLI。**先保证档 0/1 能跑,档 2 是增强**。
4. **WB6 → WB7** — PWA 接上 REST 与答复引擎,最后打包 Docker。

里程碑:
- **M1**(WB1)= Claude Code 能用 Vale 工具。
- **M2**(WB3+WB4+WB5.1 档0/1)= 有鉴权的 REST,PWA 可问答(生成式 RAG)。
- **M3**(WB5.2/5.3)= 无宿主设备也能"真干活"。
- **M4**(WB6+WB7)= `docker run` 起全栈,手机可用。

---

## 4. 跨工作块的硬约束(贯穿)

- **要求联网**(§9 决策 5):本期默认客户机/服务器可出网;断网档退化到 WB5 档 0/1,不做 spawn CLI。
- **不 bundle CLI 安装包**(§9 决策 8、license 已核实):一律官方安装。
- **HTTP 服务默认带鉴权**:不裸暴露端点。
- **key 不落明文 / 不进日志 / 不进命令行参数**:环境变量注入 + 加密引用。
- **文件操作走 `resolveSafePath`**:限制在工作区内。

---

## 5. 本计划暂不含(留待后续 Phase)

- Phase 1:OIDC SSO、RBAC 细粒度、审计日志、离线签名许可证、pgvector/LanceDB、Helm。
- Phase 2:OA 免登/机器人/工作台 H5/ISV 过审。
- Phase 3:消息推送、文档同步、第二三家 OA、Codex 离线包、原生 App。
- 自建多轮 agent loop(§9 决策 6:不早期自建)。
- **档 2a SDK 内嵌 runtime**(移植旧版 `src/ai/`)——旧版尚有未解决问题,搁置待后续完善。

---

## 6. 待你拍板项(开工前)

1. **【已拍板 2026-06-11】WB5.3 走档 2b(探测/安装 CLI)**,目标先把产品跑起来;档 2a(旧版 SDK 内嵌)因遗留问题搁置待后续。→ **WB5.2 Agent Provider 本期必需。**
2. **【已拍板 2026-06-11】没检测到 CLI 时默认装 claude**(`preferredCli="claude"`,配置可改);并**定期检测最新版**(`updateCheck` 默认每日,见 WB5.2 `checkUpdate()`)。
3. **【已拍板 2026-06-11】WB5.1 默认 `agent.engine = "auto"`**——探测后选最高可用档,失败逐级降级。
4. **【待拍板】WB3 用户存储**:`.vale/users.json` 起步 vs 直接 SQLite?

---

## 7. 旧版 llm-wiki 抢救映射(2026-06-11 实地核实)

> 旧仓库 `/Users/macbookpro/Documents/my-project/LLM Wiki/llm-wiki`,授权 **AGPL-3.0 OR Commercial**(双授权)。移植进新版 `@vale/*` 前需统一 monorepo 授权口径(闭源商业化走 Commercial 侧)。

| 旧版模块 | 规模 | 可用性 | 去向 | 注意 |
|---|---|---|---|---|
| `src/ai/runtime/`(2 套 SDK runtime + factory) | ~480 行 | 🟢 金矿,但**搁置** | WB5.3 档 2a **后续** | 旧版尚有未解决问题;本期走 spawn CLI(2b),2a 待后续完善 |
| `src/ai/`(权限桥/事件适配/systemPrompt/skill 注入) | ~300 行 | 🟢 高 | WB5.3 配套移植 | 旧 `src/ai/mcp/` 那套工具**不要**,用新版 13 工具 |
| `backend/src/routes/auth.ts`(jose JWT) | 121 行 | 🟢 JWT 层可用 | WB3 | `/login` 是 OAuth dev 桩,密码校验需新写 |
| `backend/`(Hono auth/license/skills 路由) | ~400 行 | 🟡 逻辑留,运行时换 | WB4 + Phase 1 | CF Workers + D1 + KV → Node 容器 + Postgres |
| `src/auth/license.ts`(tier→features 分层) | 153 行 | 🟡 分层模型可用 | Phase 1 | 纯内存解析,需补离线签名校验(§5.3) |
| `src/core/`(引擎) | — | ⚪ 不用 | — | 新版已重构为 `@vale/core` |
| `src/renderer/`(Electron React GUI) | — | 🔴 仅借鉴交互 | WB6 重写 | §9 决策 4:去 Electron、响应式、PWA |

**关键修正**:WB5 原假设"干活引擎从零建"。实地核实后,旧版 `src/ai/` 已有跑通的多轮 agent loop(`ClaudeAgentSDKRuntime` 用 `@anthropic-ai/claude-agent-sdk`,`maxTurns:25`,in-process 挂 Vale MCP,完整工具权限桥)。**但旧版那套尚有未解决问题——【已拍板】本期先走档 2b(探测/安装 CLI)把产品跑起来,档 2a(移植 SDK 内嵌)留待后续完善**。见 §5.1 表与 §6 决策 1。
