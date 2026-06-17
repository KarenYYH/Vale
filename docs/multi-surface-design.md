# Vale 多端知识库 — 场景与架构设计方案

> 版本: 草案 v0.1 | 日期: 2026-06-11
> 目标: 把"手机管理 / 小B云部署 / 入驻OA"三个场景统一到一套架构上

---

## 0. 一句话结论

三个看似不同的需求——**手机操作、小B云部署/ToB VPC、入驻钉钉飞书企微**——本质指向**同一个工程核**:

> **无头知识引擎 + HTTP API + 可插拔鉴权 + 响应式 PWA 前端**

把这个核建出来后:
- 手机端 = 这个 PWA;
- 小B云部署 = 这个核跑在云电脑/云主机上;
- OA 入驻 = 把 PWA 塞进 OA 的 webview + 接免登,机器人复用已有的 MCP 工具。

新版 Vale(`@vale/*` monorepo)的架构方向**完全正确**,但这个核目前**尚未建成**(见 §7 现状核实)。本方案描述要建什么、怎么分期建、以及如何抢救旧版 llm-wiki 里已能跑的代码。

---

## 1. 背景:两版代码的现状

| | llm-wiki(第一代) | Vale(第二代) |
|---|---|---|
| 形态 | Electron 桌面 App | MCP Server + CLI 协议层 |
| 共享内核 | `src/core/`(引擎) | `@vale/core`(同一引擎重构) |
| AI | 自带 Anthropic/OpenAI runtime | 借用宿主 AI(自己不调模型) |
| 已落地的商业化 | `backend/`(CF+Hono+Prisma)+ `src/auth/`(许可证) | 尚无(全是设想) |
| 人机界面 | 完整 React GUI(绑死桌面) | 仅 MCP 工具,**无人用界面** |

**核心矛盾**:能赚钱的代码(市场后端、许可证)在旧版;先进、可云化的架构在新版;而两版都缺"给人用、能远程、能上手机"的接入层。

---

## 2. 统一架构总览

所有场景共享一个中心:**部署在某处的 Vale Server**(云电脑 / 云主机 / 客户 VPC),通过不同"接入面"被访问。

```
                          接入面 (Surfaces)
   ┌──────────────────────────────────────────────────────┐
   │  AI Agent (Claude Code/Cursor)  ──MCP(stdio/HTTP)──┐   │
   │  手机 / 桌面浏览器 (PWA)         ──HTTPS/REST──────┤   │
   │  钉钉/飞书/企微 工作台 H5        ──webview+免登────┤   │
   │  钉钉/飞书/企微 机器人           ──webhook────────┤   │
   └────────────────────────────────────────────────┼───┘
                                                      ▼
                              ┌──────────────────────────────────┐
                              │         Vale Server (无头)         │
                              │  ┌──────────────────────────────┐ │
                              │  │ 接入层: HTTP API + MCP transport│ │
                              │  ├──────────────────────────────┤ │
                              │  │ 鉴权层: 本地账号|OA免登|企业SSO  │ │
                              │  ├──────────────────────────────┤ │
                              │  │ 业务层: 13 MCP 工具 (search/    │ │
                              │  │         query/ingest/lint...)   │ │
                              │  ├──────────────────────────────┤ │
                              │  │ 引擎: @vale/core               │ │
                              │  │  FTS5 + 向量 + linker + lint   │ │
                              │  ├──────────────────────────────┤ │
                              │  │ 存储: SQLite/Postgres + 向量库  │ │
                              │  └──────────────────────────────┘ │
                              └──────────────────────────────────┘
   干活引擎(agent loop): 有宿主→借宿主(MCP) | 无宿主→Server spawn claude/codex(档位2) | 装不了→单轮模型(档位1) | 无模型→检索(档位0)  ▸见 §3.4/§3.5
   LLM(模型,可插): 公有云→云端API(客户填key) | VPC→客户自带(Bedrock/vLLM) | 本机→Ollama
   部署: Docker 镜像 → 云电脑/云主机/客户K8s/VPC
```

**设计原则**:
1. **无头优先(headless-first)** — 引擎和工具不依赖任何 UI,UI 只是客户端。
2. **接入面可插拔** — 新增一个接入面(如企微)不改业务层。
3. **鉴权策略可插拔** — 同一套接口,三种实现(本地账号 / OA 免登 / 企业 SSO)。
4. **AI 可插拔(两层,别混为一谈)** — 必须区分**模型**和**agent loop**:
   - **模型(model)可插** — Server 不打包模型权重/运行时,但**可以调**一个外部模型端点(OpenAI/Anthropic API、客户自带 Bedrock/vLLM、本机 Ollama)。"不内置"指不绑定,不指不能调。
   - **agent loop(干活的循环)从哪来** — 这是"一问一答 RAG"和"能干活的助理"的分水岭。三种来源:**借宿主**(MCP,设备上有 Claude Code/Cursor)、**spawn CLI**(Vale Server 上调起 claude/codex 当引擎)、**自建**(Vale 自己写循环)。**这一层不能凭空消失**——设备上没有宿主 agent 时,必须由 Vale Server 侧补上(spawn 或自建),详见 §3.4 / §3.5。
5. **部署目标无关** — 同一个 Docker 镜像,能跑在云电脑、也能塞进客户 VPC。

---

## 3. 核心层设计(三场景公共底座)

这是必须**最先建**的部分,因为三个场景都依赖它。

### 3.1 HTTP API 层

在现有 `@vale/mcp` 之上(或并列)增加一个面向"人/前端"的 REST API。MCP 是给 Agent 的,REST 是给 PWA / OA H5 的。两者共享同一业务层(13 个工具的 handler)。

最小端点集(MVP):

| 方法 | 端点 | 说明 | 复用的工具 |
|------|------|------|-----------|
| `POST` | `/api/auth/login` | 登录,返回 session/JWT | — |
| `GET`  | `/api/search?q=&mode=` | 搜索(fts/semantic/hybrid) | search_* |
| `POST` | `/api/query` | 结构化问答 + 上下文 | run_query |
| `GET`  | `/api/notes/:path` | 读取笔记 | (core fs) |
| `PUT`  | `/api/notes/:path` | 新建/编辑笔记 | create_note |
| `POST` | `/api/ingest` | 上传/导入文件 | run_ingest |
| `GET`  | `/api/graph` | 知识图谱 JSON | get_graph |
| `GET`  | `/api/health` | 健康/统计 | get_health |
| `GET`  | `/api/lint` | 质量检查 | run_lint |
| `POST` | `/api/oa/:platform/callback` | OA 事件/消息回调 | (机器人) |

技术建议:**复用旧版 `backend/` 的 Hono**(它本身可移植),但运行时从 Cloudflare Workers 换成普通 Node 容器(见 §6.2)。

### 3.2 鉴权层(一套接口,三种实现)

这是把三场景统一起来的**关键抽象**。定义一个 `AuthProvider` 接口,不同部署注入不同实现:

```typescript
interface AuthProvider {
  // 校验请求,返回用户身份(失败抛错)
  authenticate(req: Request): Promise<Principal>;
  // 校验某用户对某资源/操作是否有权限
  authorize(principal: Principal, perm: ValePermission): boolean;
}

interface Principal {
  userId: string;
  displayName: string;
  source: "local" | "oa-dingtalk" | "oa-feishu" | "oa-wework" | "sso-oidc";
  roles: string[];           // RBAC: admin / editor / viewer
  tenantId?: string;         // 多租户/多工作区隔离
}
```

三种实现:
- `LocalAuthProvider` — 用户名密码 + JWT(小B 云部署、个人用)
- `OAAuthProvider` — 对接钉钉/飞书/企微"免登"换取身份(OA 入驻)
- `OidcAuthProvider` — 对接 Okta/Azure AD/Keycloak(企业 VPC SSO)

### 3.4 干活引擎:agent loop 从哪来(从"知识库"到"能干活的助理")

> 这是设计文档原先的**盲区**。原"AI 可插拔"只说了模型可插,默认 agent loop 永远由宿主(Claude Code)提供——一旦设备上没有宿主 agent,这层就凭空消失,产品退化成搜索框。这与"做一个**能干活的 AI 助理**"的初衷冲突,必须显式补上。

**核实(2026-06-11,基于代码):Vale 目前没有任何 agent loop。**
- [`run-query.ts`](../packages/mcp/src/tools/run-query.ts) 只组装上下文,占位符 `"[Answer will be generated by the AI]"` 把答案生成外包给调用方。
- [`run-skill.ts`](../packages/mcp/src/tools/run-skill.ts) / [`skills/src/runtime.ts`](../packages/skills/src/runtime.ts) 注释明说 "returns the skill's prompt … **The AI uses built-in tools (Read/Write/Edit) under the skill's guidance**" —— 即技能只把 prompt 递出去,真正执行多步操作的循环 Vale 自己没有。
- 全仓库无 agent loop / tool-calling 循环 / 子进程 spawn 代码。

**两个必须分清的概念:**

| | 是什么 | 谁拥有 |
|---|---|---|
| **模型 (model)** | 一个 HTTP 端点:prompt 进、文字出 | 可插拔,注入(OpenAI/vLLM/Ollama/客户自带) |
| **agent loop** | 模型↔工具反复调用、规划、token/上下文管理、何时停 | **必须 Vale 侧拥有**(借/spawn/自建,三选一) |

**干活引擎的能力光谱(按"答复质量"递增):**

| 档位 | 干活引擎 | agent loop 来源 | 需联网 | 适合 |
|---|---|---|---|---|
| **0 检索式** | 无模型 | 无 | 否 | 断网兜底;**已实现**(`run_query` 返回排序后的上下文+wikilink) |
| **1 生成式 RAG** | 注入的模型 API(一次性) | 无(单轮 `complete()`) | 看模型在哪 | 通用一问一答 |
| **2 spawn CLI(主推)** | Server 上 spawn `claude`/`codex` | **CLI 自带(最强)** | 是 | 公有云/受控出网,要"真能干活" |
| (开发者) | 用户自己的 Claude Code | 宿主自带 | 看宿主 | 本地开发,走 MCP,Vale 零成本 |

**关键结论:**
- 设备上**有**宿主 agent → 借它(MCP),Vale 一分力气不花,直接拿到 Claude Code 级别的循环。
- 设备上**没有**(手机/PWA/OA 用户)→ 由 **Vale Server 侧** spawn CLI(档位 2)或自调模型(档位 1)补上。**用户设备始终是瘦客户端,不负责"思考",无需安装任何 agent。**
- spawn CLI 起来的 agent 可**反向连 Vale 自己的 MCP server**,从而复用 13 个工具 + skills,形成闭环。
- 诚实代价:Vale **自建**循环(档位 1 多轮版)第一版质量**不会等于** Claude Code;**spawn CLI(档位 2)** 是绕过自建难题、以最小工程量拿到顶级循环的捷径,代价是把云依赖/运维/计费引入 Server 侧(见 §3.5)。

### 3.5 Agent Provider:干活引擎的探测 / 安装 / 接入

把"档位 2(spawn CLI)"做成 **Vale 的默认安装策略**,与 `AuthProvider`、`LlmProvider` 并列的可插拔抽象:

```typescript
interface AgentProvider {
  detect(): Promise<AgentInfo | null>;     // 按能力探测,不只看名字
  install(opts): Promise<AgentInfo>;       // 征得同意后,联网拉官方最新版
  run(prompt, ctx): Promise<AgentResult>;  // spawn 子进程,注入客户 key
}
```

三种实现覆盖全光谱(对应 §3.4 档位):

| 实现 | 行为 | 对应档位 |
|---|---|---|
| `DetectedAgentProvider` | 探测到现成的 claude/codex 就直接用 | 档位 2 / 开发者 |
| `BundledClaudeProvider` | 没有就(选择后)安装,配客户自己的 key | 档位 2(主路径) |
| `ApiLlmProvider`(即 `LlmProvider`) | 连 CLI 都装不了 → 降级单轮模型调用 | 档位 1,兜底 |

**安装与接入流程(本轮敲定):**

```
vale 安装时
   ├─ 探测:仅检测 claude 和 codex
   │    每个候选三关:which 找到? → --version 够新? → 一次 headless dry-run 能出 stdout?
   │    三关全过才算"可用",否则视为没有
   ├─ 有可用的 → 记录路径,直接接入
   └─ 都没有 → 让用户【确认选择】安装 claude 还是 codex
        └─ 联网执行【官方安装渠道】(官方 install 脚本 / npm i -g),拉【最新版】
   ↓
配置界面:客户填【自己的 AI key】(走自己的额度,解决计费归属)
   ↓
运行时:Vale spawn 选定的 CLI,注入客户 key,当干活引擎
```

**工程现实(规划阶段就堵上,详见各轮讨论):**

1. **探测用能力、不用名字** — 装了 ≠ 能用(可能没登录/版本太老);三关校验后才算可用,否则继续降级。
2. **安装要征得同意 + 必有降级** — 在客户机器上装第三方 CLI 是高风险动作,需"询问+一键"(给 `--yes` 旁路自动化);装不上(无 Node/无 sudo/架构不符/无网)是常态,**必须自动降级到档位 1 或 0**,不可报错卡死。
3. **不 bundle 安装包,改联网拉官方最新版** — 包里塞 claude/codex 安装包会有①**重分发授权风险**②**打包即过期**(守不住"最新版")③**包体积爆炸**(× 5 平台 × 2 agent)④**装好仍需联网登录/调 key,救不了断网**。因此采用"Vale 帮客户跑官方安装命令"而非自带安装包。

   **license 已核实(2026-06-11,基于官方源):**
   - **Codex CLI = Apache 2.0**(仓库根 LICENSE 全文 + NOTICE)→ **允许**商业再分发/bundle,条件:随附 Apache 2.0 全文、保留 NOTICE(含 Ratatui MIT 声明)、标注改动、**不得用 OpenAI/Codex 商标背书**。
   - **Claude Code = 专有**(npm `license` = `"SEE LICENSE IN README.md"`;LICENSE.md = "© Anthropic PBC. All rights reserved. Use is subject to Anthropic's Commercial Terms of Service")→ **禁止再分发/bundle**。商业条款原文:"Customer may not … reverse engineer or **duplicate the Services**; or … support any third party's attempt …";且 "Services … not for consumer use",预期每个最终用户自行与 Anthropic 成立条款关系。
   - **合规结论**:**"引导用户从官方渠道安装 + 用户自己的 key 调用"对两者都安全**(最终用户直接与厂商成立授权,Vale 只触发官方安装,无 duplicate/redistribute)。**只有 Codex 可做离线 bundle 包**;Claude Code 的离线分发需单独向 Anthropic 取得商业授权,否则不做(影响 Phase 3 离线包,见 §9 决策 9)。
   - 断网客户离线包:仅 Codex 可行;Claude Code 走"客户自带本地模型 / 单独授权"。
4. **key 安全** — 加密落盘(OS keychain/KMS/客户主密钥),界面只显示 `sk-...****` 不回显原文;通过**环境变量**注入子进程(`ANTHROPIC_API_KEY=...`),**禁止**写进命令行参数(`ps` 可见)或日志;多租户按 `tenantId`/工作区隔离(复用 §3.2 骨架)。
5. **与断网 VPC 互斥** — 档位 2 整条链路依赖出网,强合规完全断网客户不适用,走档位 0/1(见 §5.3、§9 决策 3)。



### 4.1 部署形态
Vale Server 跑在某处(云电脑/云主机最顺,有公网 IP),手机浏览器访问其地址,"添加到主屏"成为 PWA。

### 4.2 网络可达性(关键)

| 部署位置 | 手机如何连 | 难度 |
|---|---|---|
| 云主机/云电脑(公网 IP) | 直接 HTTPS 访问域名/IP | ✅ 最简单 |
| 家里/公司电脑 | 内网穿透(frp/Tailscale/ngrok)或同 WiFi | ⚠️ 有门槛 |

→ **早期主推"云电脑/云主机部署"**,绕开内网穿透的复杂度。

### 4.3 手机端三条路径(推荐顺序)
1. **PWA(主推)** — 复用 §3.3 前端,零额外平台开发,iOS/Android 通吃。
2. **远程 MCP(增值)** — 手机 AI app 连云端 MCP server。依赖宿主支持、数据要出网,**不适合 VPC**,当锦上添花。
3. **原生/RN App(后期)** — 需离线/推送时再做。

### 4.4 安全
- 必须 HTTPS(云部署配 Let's Encrypt 或平台证书)。
- 必须鉴权(§3.2 `LocalAuthProvider` 起步)。
- 文件操作仍走 `resolveSafePath` 限制在工作区内。

---

## 5. 场景二:小B云部署 → ToB / VPC

### 5.1 交付物 = Docker 镜像(不是 SaaS)
产品形态变成 `docker run` / `helm install`,客户在自己的云电脑/云主机/K8s/VPC 起。
镜像内含:core 引擎 + HTTP API + MCP + PWA 静态资源 + 嵌入式存储。

### 5.2 部署光谱与商业分层

| 客户 | 部署 | 鉴权 | LLM | 商业层级 |
|---|---|---|---|---|
| 个人/小B | 云电脑单机 | 本地账号 | 自填 API key / 无 | 免费/低价 |
| 团队 | 云主机 | 本地账号 + 角色 | 自填 / 团队共享 | 按席位 |
| 企业 VPC | 客户 K8s,受控/无出网 | 企业 SSO(OIDC/SAML) | 客户自带(Bedrock/vLLM) | 年度 license,高客单价 |

### 5.3 VPC 关键约束(从第一天满足)
1. **零外网依赖可运行** — embedding 本地化(已是 `Xenova/all-MiniLM`);LLM 由客户自带,Server 不内置模型。MCP 解耦让"AI 大脑"留在客户侧。
2. **放弃 Cloudflare Workers** — 改 Node 容器(见 §6.2)。
3. **向量库选自托管友好型** — `pgvector` 或 `LanceDB`(嵌入式),不用托管服务。新版 LanceDB"待集成"的优先级要提前。
4. **离线许可证** — 签名密钥(私钥签/产品内置公钥验),**不可 call-home**。旧版 `license.ts` 若是联网校验需重做。
5. **无自动更新** — 改客户拉镜像;提供"support bundle 导出"供脱敏排障(你进不去客户环境)。

### 5.4 高客单价来源
不是引擎(开源免费),而是:**SSO/SAML、细粒度 RBAC、审计日志、SLA、私有部署、合规、技术支持**。这层现在两版都为零,是 ToB 投入重点。

---

## 6. 场景三:入驻 OA(钉钉 / 飞书 / 企业微信)

### 6.1 入驻 ≠ 一件事,是 4 种接入

| 接入形态 | 说明 | 复用什么 | 价值 |
|---|---|---|---|
| **工作台 H5 应用** | 工作台点开,OA webview 加载你的 H5 | **= §3.3 的 PWA** + OA 免登 | ⭐⭐⭐ |
| **机器人** | 群/单聊 @ 提问,查库回答 | **= 已有 13 个 MCP 工具** + LLM | ⭐⭐⭐ |
| **消息推送** | 周报/断链报告推到 OA | `agent` 类型 Skill(cron) | ⭐⭐ |
| **文档同步** | 与飞书/钉钉文档双向同步 | `connector` 类型 Skill | ⭐⭐ |

**核心洞察:工作台 H5 就是手机 PWA。** 做完 §3 的核,OA 入驻主要剩:注册应用 + 接免登 + 各平台适配。**不是新项目,是 §3 的延伸。**

### 6.2 云 vs 断网的矛盾(必须正视)
钉钉/飞书/企微都是**公有云**,免登换 token、机器人回调都需要 OA 云能访问你的 Server / 你能出网调它的 OpenAPI。这与"完全断网 VPC"**互斥**。光谱化解决:

| 客户 | OA 用法 | 出网 | OA 集成 |
|---|---|---|---|
| 小B | 公有云 OA | 允许出网 | ✅ 容易 |
| 中B | 公有云 OA | 受控出网(DMZ 白名单到 OA 域名) | ⚠️ 中等 |
| 大B 强合规 | 专有钉钉/私有化飞书 | 完全断网 | ❌ 需专有 OA |

→ **早期拥抱"允许受控出网"这条线**(小B/多数中B 可接受),完全断网+专有OA 留给极少数大客户单独报价。

### 6.3 集成层要建什么(在 §3 核之上的增量)
- **各平台适配器**:钉钉/飞书/企微的 OpenAPI、免登流程、机器人协议**各不相同,分别写**。
- **公网可达的回调端点**:`POST /api/oa/:platform/callback` 接事件/消息。
- **机器人需 LLM**:公有云用云端模型;VPC 用客户自带模型(MCP 解耦受益)。
- **OAAuthProvider**:把 OA 免登身份映射到 `Principal`。

### 6.4 战略红利:OA 应用市场 = ToB 获客渠道
钉钉应用市场/飞书应用目录/企微服务商,是**中国中小企业采购软件的主入口**,直接服务"高客单价 ToB"目标。
代价:ISV 认证、审核、可能分成、三家分别开发过审、平台规则会变。
→ **别三家齐上,先选一家**(看目标客户更集中在钉钉还是飞书)。

---

## 7. 现状核实(2026-06-11,基于代码)

| 能力 | 新版 Vale | 旧版 llm-wiki |
|---|---|---|
| core 引擎 | ✅ 完整(~7000 行) | ✅ 同源 |
| 13 个 MCP 工具 | ✅ 有 | ✅ 11 个 |
| MCP stdio/HTTP 传输 | ✅ **已实现**(StdioServerTransport + StreamableHTTPServerTransport,`packages/mcp/src/transports/`) | ❌ 进程内 MCP,无网络 |
| HTTP REST API | ❌ 无 | ⚠️ backend 有(但 CF Workers) |
| Web/PWA 前端 | ❌ **空壳**(仅 App.tsx/main.tsx) | ✅ 有 React GUI(绑死桌面) |
| 鉴权 | ❌ 无 | ⚠️ auth/ 有许可证(可能联网) |
| **agent loop / 干活引擎** | ❌ **无**(`run_query` 只组装上下文外包答案;`run-skill`/`runtime` 只递 prompt;无 spawn/循环代码)→ 见 §3.4/§3.5 | ⚠️ 自带 Anthropic/OpenAI runtime(绑死桌面) |
| 市场后端 | ❌ 无 | ✅ backend/(CF+Hono+Prisma) |
| CLI | ⚠️ 278 行分发器(命令多为空) | — |

**抢救清单(从旧版移植到新版)**:
- `backend/` 业务逻辑(auth/license/skills 路由)→ Hono 可留,运行时 CF Workers → Node 容器,D1/KV → Postgres。
- `src/auth/license.ts` → 改造为离线签名许可证。
- 旧版 React GUI 的组件 → 可作 PWA 前端的参考/部分复用(但要去 Electron 化、改响应式)。

---

## 8. 分期实施路线

### Phase 0 — 公共核(三场景的地基)【最高优先级】
- [ ] `@vale/mcp` 实现 HTTP transport(补上注释里承诺的能力)
- [ ] **MCP stdio transport 真正接线**(SDK 已在依赖,但 `serve` 仅桩;接好即解锁"开发者借宿主 agent"路径)
- [ ] 新增 HTTP REST API 层(Hono,复用工具 handler)
- [ ] 鉴权抽象 `AuthProvider` + `LocalAuthProvider`(JWT)
- [ ] **`AgentProvider` 抽象 + `DetectedAgentProvider`/`BundledClaudeProvider`(§3.5)**:探测 claude/codex → 选择安装(联网拉官方最新版)→ 配客户 key → spawn 干活
- [ ] **干活引擎降级链(§3.4)**:档位 2(spawn CLI)→ 档位 1(`LlmProvider` 单轮)→ 档位 0(检索)自动降级
- [ ] `@vale/web` 建 PWA:登录/搜索/浏览三页(P0)+ manifest/SW
- [ ] Docker 镜像:一条 `docker run` 起全栈

→ **完成即同时解锁**:手机端(场景一)、小B云部署(场景二雏形)、**PWA 里"能干活"而非仅检索**。

### Phase 1 — ToB 治理层(高客单价)
- [ ] `OidcAuthProvider`(SSO)+ RBAC 角色
- [ ] 审计日志
- [ ] 离线签名许可证(移植改造旧版)
- [ ] pgvector / LanceDB 后端(替换 memory,撑企业规模)
- [ ] **`ApiLlmProvider` 接客户自带模型(Bedrock/vLLM)** + 断网档干活引擎(档位 1,无 spawn 依赖)
- [ ] Helm chart + support bundle 导出

### Phase 2 — OA 入驻(选一家先做)
- [ ] `OAAuthProvider` + 选定平台免登
- [ ] 工作台 H5(复用 PWA)+ 应用注册
- [ ] 机器人:回调端点 + 复用干活引擎(§3.4,公有云走 spawn CLI / VPC 走 `LlmProvider`)+ 复用 query 工具
- [ ] 申请 ISV、过审、上应用市场

### Phase 3 — 增强
- [ ] 消息推送(agent Skill)/ 文档同步(connector Skill)
- [ ] 第二、三家 OA 平台
- [ ] 远程 MCP / 原生 App(按需)
- [ ] **断网客户可选离线安装包(仅 Codex)**:Codex=Apache 2.0 可 bundle;Claude Code 专有禁止再分发,断网客户走"客户自带本地模型"或单独取得 Anthropic 授权(见 §9 决策 9)

---

## 9. 关键决策点(待拍板 / 已拍板)

1. **Phase 0 后先做哪个?** 场景一(手机/小B,快速有可用品)还是直奔 Phase 1(企业治理,够付费客户)。
2. **OA 先接哪家?** 取决于目标客户集中在钉钉还是飞书。
3. **完全断网 VPC 是否早期就支持?** 建议否——早期押"受控出网",断网+专有OA 单独报价。
4. **旧版 GUI 复用程度?** 参考逻辑 vs 重写——建议重写前端(去 Electron、响应式、PWA),仅借鉴交互。
5. **【已拍板】早期要求客户机器/服务器可出网(可受控/白名单)。** 换取架构大幅简化——直接启用 §3.5 spawn CLI 方案(检测/安装 claude·codex、配 key、spawn 干活)。代价:早期跳过"完全断网强合规"客户(§0/§5.4 押注的高客单价来源)。**只作早期默认,不写死为永久约束**——断网档作为未来单独报价项保留(与决策 3 一致)。
6. **【已拍板】干活引擎选型** = "有宿主借宿主(MCP)/ 无宿主在 Server 侧 spawn CLI(档位 2)/ 装不了再降级单轮模型(档位 1)/ 全无模型退检索(档位 0)"。**不早期自建 agent loop**(质量打不过 Claude Code,投入大)。
7. **【已拍板】干活引擎只检测 claude 和 codex**;都没有时由用户**确认选择**安装其一。
8. **【已拍板】不在安装包内 bundle claude/codex 安装包**,改为联网拉**官方最新版**(理由见 §3.5 工程现实 3:重分发授权风险 / 打包即过期 / 体积 / 装好仍需联网)。
9. **【已核实 2026-06-11】claude / codex 的 license 是否允许商业再分发** —— **Codex = Apache 2.0(允许 bundle,需署名+保留 NOTICE+不用商标);Claude Code = 专有"all rights reserved",禁止 bundle/duplicate**(LICENSE.md + Anthropic 商业条款)。结论:**"引导官方安装+客户自己 key"对两者都合规**;**离线 bundle 包仅 Codex 可做**,Claude Code 离线分发需单独向 Anthropic 取商业授权,否则 Phase 3 离线包只覆盖 Codex。详见 §3.5 工程现实 3。
10. **【待拍板】是否把 Claude Code 设为"没检测到时的默认安装项"**(开箱即用 vs 绑定 Anthropic CLI);建议默认 Claude Code,但探测优先级与默认项都做成配置。

---

## 附:三场景如何共用一个核(收敛图)

```
        建一次                     三处复用
   ┌──────────────┐
   │ HTTP API     │──┬─► 场景一: 手机浏览器/PWA 直连
   │ + 鉴权(可插)│  ├─► 场景二: 跑在客户云电脑/VPC
   │ + PWA 前端   │  └─► 场景三: 塞进 OA webview + 免登
   └──────────────┘
   ┌──────────────┐
   │ 13 MCP 工具  │────► 场景三机器人 / AI Agent 直接调
   └──────────────┘
```


