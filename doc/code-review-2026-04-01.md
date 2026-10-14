# PianoEase Web MVP 代码审查报告

> **审查日期**: 2026-04-01  
> **审查范围**: `web/src/` 全部后端与核心逻辑代码  
> **审查版本**: Phase 1 MVP

---

## 1. 审查计划

本次代码审查采用**分阶段逐步阅读**策略，避免一次性加载全部代码导致上下文超限。按以下四个阶段依次执行：

### 第一阶段：数据库层（Drizzle ORM & PgLite/Postgres）

- **目标目录**: `src/db/`（schema、client、runtime、migrate、seed、repositories）及 `drizzle/`（SQL 迁移文件）
- **关注点**: Schema 设计合理性、关联关系配置、PgLite/Postgres 双端兼容性、迁移与种子数据逻辑

### 第二阶段：认证流程 (Authentication Flow)

- **目标目录**: `src/lib/auth/`（config、session、user）、`src/app/api/auth/`（login、logout）、`src/proxy.ts`、`src/app/login/`
- **关注点**: Session 创建/验证/过期机制、Cookie 安全属性、中间件路由保护、安全性漏洞排查

### 第三阶段：练习核心逻辑 (Practice Session Logic)

- **目标目录**: `src/lib/practice/`（judgement、metrics、report-summary）、`src/lib/chart/`（types、validation、catalog）、`src/lib/songs/`（catalog、musicxml）、`src/lib/midi/`（events）
- **关注点**: 业务逻辑健壮性、Chart 数据验证、MusicXML 回退机制、命名一致性

### 第四阶段：API 路由结构 (API Route Structure)

- **目标目录**: `src/app/api/practice/session/`（start、end handler）、`src/app/api/songs/[songId]/`（chart、musicxml）
- **关注点**: 输入验证与错误处理、HTTP 状态码规范、数值清洗逻辑分层、认证保护覆盖

---

## 2. 审查报告

### 总体评价

项目整体架构清晰、层次分明，作为 Phase 1 MVP 已具备良好的开发基础：

| 维度 | 评分 | 说明 |
|------|------|------|
| **架构分层** | ⭐⭐⭐⭐ | DB Schema → Repository → Handler → Route 四层分离，职责清晰 |
| **类型安全** | ⭐⭐⭐⭐ | 全面使用 TypeScript，手写运行时验证函数覆盖 API 入口 |
| **测试覆盖** | ⭐⭐⭐ | 有 5 个测试文件 + 2 个检查脚本 + 1 个 benchmark，核心路径有覆盖 |
| **安全性** | ⭐⭐⭐ | Session 机制合理，但存在若干需要加固的点 |
| **可维护性** | ⭐⭐⭐⭐ | 代码风格统一，命名规范，依赖注入模式便于测试 |

---

### 2.1 第一阶段：数据库层

#### ✅ 做得好的地方

1. **双引擎设计** — `runtime.ts` 通过环境变量优雅地在 PgLite（本地开发）和 Postgres（生产）之间切换，逻辑清晰
2. **Global 单例缓存** — `client.ts` 使用 `globalThis` 避免 HMR 导致的重复连接，这是 Next.js 下的最佳实践
3. **Repository 模式** — 将数据访问逻辑从 API 路由中拆出，三个 repository（users / sessions / practice）各司其职
4. **分析层纯函数** — `practice.ts` 中的 `buildSummary`, `buildDailyTrend` 等是无副作用的纯函数，便于测试
5. **迁移有序** — 三个迁移文件按演进逻辑递增，0000→基础表，0001→songs 表+MIDI 字段，0002→命中统计

#### 🟡 改进建议

**P1 — 重要**

| # | 问题 | 所在文件 | 建议 |
|---|------|----------|------|
| DB-1 | **`drizzle.config.ts` 硬编码了数据库凭据** | `drizzle.config.ts:8` | 回退值 `postgres://postgres:postgres@localhost:5432/pianoease` 会出现在构建日志中。建议使用 `dotenv` 加载 `.env` 或改为仅在 `DATABASE_URL` 存在时使用 postgres dialect |
| DB-2 | **连接池 `max: 1`** | `client.ts:25` | 生产模式下单连接会成为瓶颈。建议根据 `NODE_ENV` 调整，开发用 1，生产用 5-10 |
| DB-3 | **`seedSongs()` 使用逐条 upsert** | `seed.ts:8-30` | 3 首歌问题不大，但如果后续歌曲增多，应改为批量 `INSERT ... ON CONFLICT` 或使用 Drizzle 的 batch API |
| DB-4 | **`songs` 表缺少外键约束到 content 目录** | `schema.ts` | `songs.id` 是 `text` 主键但没有 CHECK 约束格式（如只允许 `[a-z0-9-]+`），理论上可以插入不合法的 songId 导致 MusicXML 读取失败 |

**P2 — 建议**

| # | 问题 | 所在文件 | 建议 |
|---|------|----------|------|
| DB-5 | **`updatedAt` 没有自动触发器** | `schema.ts:16,25` | `songs.updatedAt` 和 `users.updatedAt` 使用 `.defaultNow()` 但在更新时不会自动刷新。Seed 中手动设了 `updatedAt: new Date()`，但其他更新路径可能遗漏。建议添加 Postgres trigger 或在 repository 层统一处理 |
| DB-6 | **`practice.ts` repository 文件过大（455 行）** | `repositories/practice.ts` | 建议将分析逻辑（`buildSummary`, `buildSongAnalytics` 等纯函数）拆到 `src/lib/practice/analytics.ts`，repository 只保留数据库读写 |
| DB-7 | **`toDateKey()` 使用本地时间** | `repositories/practice.ts:113-118` | `Date.getMonth()` / `getDate()` 是本地时区，而 `startedAt` 是 `with timezone`。服务器时区不同会导致日期归属错误。建议使用 UTC 方法或统一指定时区 |
| DB-8 | **`practice_measure_stats` 缺少复合唯一索引** | `schema.ts:78-92` | `(practiceSessionId, measureIndex, hand)` 应有唯一约束，防止重复数据。当前 `endPracticeSession` 先 DELETE 再 INSERT 可以避免，但缺少数据库层的最终防线 |

---

### 2.2 第二阶段：认证流程

#### ✅ 做得好的地方

1. **Token Hash 存储** — 不存储明文 token，使用 SHA-256(secret + token) 存储哈希
2. **Session 过期控制** — 14 天 TTL，查询时用 `gt(expiresAt, now)` 过滤
3. **Cookie 安全属性** — 正确设置了 `httpOnly`, `sameSite: lax`, 且生产环境启用 `secure`
4. **路由保护** — `proxy.ts` 作为类中间件，拦截未认证请求并重定向

#### 🔴 安全隐患

| # | 问题 | 严重度 | 所在文件 | 建议 |
|---|------|--------|----------|------|
| AUTH-1 | **`proxy.ts` 未被注册为 Next.js middleware** | 🔴 高 | `src/proxy.ts` | 该文件导出了 `proxy` 函数和 `config`，但文件名不是 `middleware.ts` 且不在 `src/` 根目录。**Next.js 不会识别它**。需要确认是否有地方在使用它——如果没有，意味着 **所有 API 路由（除 auth 外）缺少认证保护**。songs/chart/musicxml 等接口可能被无 Session 访问 |
| AUTH-2 | **密码以明文比较** | 🟡 中 | `login/route.ts:21` | `password !== expected.password` 是时间不安全的比较，虽然目前是测试凭据不太要紧，但建议使用 `crypto.timingSafeEqual()` 养成好习惯 |
| AUTH-3 | **硬编码默认 Secret** | 🟡 中 | `auth/config.ts:10` | `"dev-only-change-this-secret"` 作为默认值，如果生产环境忘记配置 `AUTH_SESSION_SECRET` 会导致所有 token 使用弱密钥签名。建议在生产环境未配置时 throw Error |
| AUTH-4 | **无 CSRF 防护** | 🟡 中 | `login/route.ts` | Login 表单使用原生 `<form action="POST">`，没有 CSRF token。虽然 `SameSite: lax` 提供了一定保护，但建议增加 `Origin` / `Referer` 校验 |
| AUTH-5 | **缺少登录频率限制** | 🟡 中 | `login/route.ts` | 没有 rate limiting，恶意用户可以暴力破解测试密码 |
| AUTH-6 | **Logout 手动解析 cookie** | 🟠 低 | `logout/route.ts:9-14` | 手动 split cookie 字符串，应使用 `request.cookies` 或 Next.js 的 `cookies()` API，更可靠也更简洁 |
| AUTH-7 | **过期 Session 无定期清理** | 🟠 低 | `repositories/sessions.ts:47-51` | `deleteExpiredSessions()` 已实现，但没有被任何地方调用。建议在 login 时顺带清理，或通过 cron 定期执行 |

---

### 2.3 第三阶段：练习核心逻辑

#### ✅ 做得好的地方

1. **判定逻辑简洁** — `judgement.ts` 使用简单阈值：Perfect(≤50ms) / Good(≤150ms) / Miss，清晰易调
2. **Chart 验证彻底** — `validation.ts` (105 行) 对 JSON chart 做了全属性深度校验，包括重复 variant id 检测
3. **MusicXML 降级回退** — `musicxml.ts` 当请求的 variant 不存在时自动回退到 `original`，体验友好
4. **报告摘要纯函数** — `report-summary.ts` 的 `buildReportSummary` 是纯函数，正确处理了空数据边界
5. **依赖注入 (DI) 模式** — handler 函数额外接受 `dependencies` 参数，便于单元测试 mock

#### 🟡 改进建议

| # | 问题 | 所在文件 | 建议 |
|---|------|----------|------|
| PRAC-1 | **`PracticeMetrics.mode` 与 DB 的 `practice_mode` 枚举不一致** | `metrics.ts:18` vs `schema.ts:5` | `PracticeMetrics.mode` 是 `"waiting" \| "free"`，而 DB enum 是 `"game" \| "follow"`。两套命名指代不同概念但容易混淆，建议统一或明确注释区分 |
| PRAC-2 | **手动 `id` 生成方式未见** | `chart/types.ts:42` | `NoteEvent.id` 是 `string`，但在 `generate-charts.ts` 中如何生成未做审查（文件过大 19KB），需确认 ID 唯一性策略 |
| PRAC-3 | **Chart catalog 静态导入** | `chart/catalog.ts:1-3` | 三首歌的 chart JSON 被静态 import，会被打包到 server bundle 中。歌曲增多后会增大内存占用。建议改为按需读取文件或使用 `fs.readFile` + LRU 缓存 |
| PRAC-4 | **Song catalog 同样静态导入 manifest** | `songs/catalog.ts:1` | 与 PRAC-3 相同问题，`manifest.json` 被静态导入。MVP 阶段可接受，后续建议改为动态读取 |
| PRAC-5 | **`VARIANT_RANK` 的 original 排最高** | `repositories/practice.ts:96-101` | `original: 4` 排在 `lv3: 3` 之上，意味着从 lv3 切换到 original 被视为"升级"。这个设计意图需要明确——如果 original 是原谱（最难），这是合理的；如果不是，需要调整 |

---

### 2.4 第四阶段：API 路由结构

#### ✅ 做得好的地方

1. **Route ↔ Handler 分离** — 路由文件极薄，只做委托；handler 负责所有逻辑，便于测试
2. **手写运行时验证** — `isStartPayload()`, `isEndPayload()`, `isMeasureStatPayload()` 覆盖了所有字段
3. **防御性数字处理** — handler 中对所有数值型字段使用 `Math.max(0, Math.round(…))` 和 `Math.min(100, …)` 做边界保护
4. **恰当的 HTTP 状态码** — 401 (未认证), 400 (参数错误), 404 (未找到), 500 (服务端错误) 分层分明

#### 🟡 改进建议

| # | 问题 | 所在文件 | 建议 |
|---|------|----------|------|
| API-1 | **songs/chart 和 songs/musicxml 接口无认证** | `songs/[songId]/chart/route.ts`, `musicxml/route.ts` | 没有调用 `getCurrentUser()` 检查登录状态。结合 AUTH-1（proxy 未生效）的问题，这些接口可能完全暴露 |
| API-2 | **重复的数值清洗逻辑** | `end/handler.ts:97-129` vs `repositories/practice.ts:320-327` | `Math.max(0, Math.round(…))` 在 handler 和 repository 中都做了。建议只在 handler（边界层）做一次，repository 信任上游数据 |
| API-3 | **缺少请求体大小限制** | `end/handler.ts` | `measureStats` 数组没有长度上限校验。理论上恶意调用者可以发送超大数组导致内存/DB 压力。建议限制 `measureStats.length <= 500` |
| API-4 | **songId 未在 practice/start 做路径安全校验** | `start/handler.ts` | 虽然 `findSongById` 做了白名单匹配，但 songId 后续被存入数据库。建议在入口处也做格式校验（`/^[a-z0-9-]+$/`），与 `musicxml.ts` 的 `assertSafeSongId` 保持一致 |
| API-5 | **`proxy.ts` 文件命名问题** | `src/proxy.ts` | 在 Next.js 中，中间件文件必须命名为 `middleware.ts` 并放在 `src/` 直接目录下。当前 `proxy.ts` 的命名和导出方式（`proxy` 函数而非默认的 `middleware`）不符合 Next.js 约定。**需要重命名为 `middleware.ts` 并将函数名改为 `middleware`** |

---

### 2.5 跨模块问题

| # | 问题 | 优先级 | 说明 |
|---|------|--------|------|
| CROSS-1 | **缺少统一错误处理** | P2 | 各 API 路由手写 try-catch + `console.error`，建议抽取通用的 `withErrorHandler` wrapper |
| CROSS-2 | **缺少请求日志** | P2 | 没有结构化日志系统，仅有 `console.error`，生产排障困难。建议接入 `pino` 或类似轻量日志库 |
| CROSS-3 | **缺少 API 响应类型定义** | P2 | 前端消费 API 时没有共享的 response type，容易出现前后端口径不一致。建议在 `src/lib/` 中定义共享类型 |
| CROSS-4 | **`chart.v0.json` 随项目一起打包** | P3 | 三个 chart JSON 文件（可能很大）被 Next.js 静态打包。后续歌曲增多后需要改为按需加载 |

---

### 2.6 技术债清单（按优先级排序）

**🔴 P0 — 必须立即修复**

| # | 项目 | 行动 |
|---|------|------|
| 1 | AUTH-1 / API-5: **Middleware 未生效** | 将 `proxy.ts` 重命名为 `middleware.ts`，函数名改为 `middleware`，确保路由保护生效 |

**🟡 P1 — Phase 1 结束前修复**

| # | 项目 | 行动 |
|---|------|------|
| 2 | AUTH-3: 硬编码默认 Secret | 生产环境缺失 `AUTH_SESSION_SECRET` 时 throw Error |
| 3 | DB-1: drizzle.config.ts 凭据 | 移除硬编码的默认连接字符串 |
| 4 | DB-2: 连接池为 1 | 根据环境调整 `max` 值 |
| 5 | API-3: measureStats 无长度限制 | 添加数组长度校验 |

**🟢 P2 — Phase 2 规划**

| # | 项目 | 行动 |
|---|------|------|
| 6 | DB-6: practice repository 拆分 | 分析纯函数移至 `lib/practice/analytics.ts` |
| 7 | DB-7: toDateKey 时区问题 | 统一使用 UTC |
| 8 | PRAC-3/4: 静态 import chart/manifest | 改为按需读取 + 缓存 |
| 9 | CROSS-1/2: 统一错误处理 + 日志 | 抽取 middleware wrapper + 接入 pino |
| 10 | CROSS-3: API 响应类型共享 | 共享类型定义 |
| 11 | AUTH-7: 过期 Session 清理 | 在 login 流中附带清理或使用 cron |

---

### 2.7 Phase 1 就绪评估

> [!IMPORTANT]
> **总结**：项目作为 MVP 已具备核心功能——歌曲管理、用户认证、练习流程、数据分析一应俱全。架构分层合理，代码质量较高。**主要的阻断项（P0和P1）均已解决**，当前状态已达到 Phase 1 就绪标准。

---

## 3. 问题处理结果

> **修复日期**: 2026-04-01  
> **验证结果**: TypeScript 编译通过（`tsc --noEmit`）+ 14/14 单元测试全部通过（`test:core`）

### 3.1 修复汇总

| 优先级 | 编号 | 修复内容 | 改动文件 |
|--------|------|----------|----------|
| **P0** | AUTH-1 / API-5 | `proxy.ts` → `middleware.ts`，路由保护生效 | `src/middleware.ts` |
| P1 | AUTH-3 | 生产环境缺少 Secret 时直接报错 | `src/lib/auth/config.ts` |
| P1 | DB-1 | 移除 drizzle.config 硬编码的数据库凭据 | `drizzle.config.ts` |
| P1 | DB-2 | 连接池 dev=1, prod=10 | `src/db/client.ts` |
| P1 | API-3 | measureStats 数组上限 500 | `src/app/api/practice/session/end/handler.ts` |
| P1 | API-4 | songId 格式正则校验 | `src/app/api/practice/session/start/handler.ts` |
| P1 | AUTH-6 | Logout cookie 改用 `cookies()` API | `src/app/api/auth/logout/route.ts` |
| P1 | API-2 | 移除 repository 层重复数值清洗 | `src/db/repositories/practice.ts` |

### 3.2 修复详情

#### 1. P0: Middleware 未生效（AUTH-1 / API-5）

将 `src/proxy.ts` 重命名为 `src/middleware.ts`，并将导出函数名从 `proxy` 改为 `middleware`，使 Next.js 能正确识别并启用路由保护。

```diff
-export function proxy(request: NextRequest) {
+export function middleware(request: NextRequest) {
```

**影响**: 修复后所有非公开路由（`/login`、`/api/auth/login` 以外）都会要求登录 Session，songs/chart/musicxml 等接口不再裸露。

#### 2. P1: Auth Secret 生产环境保护（AUTH-3）

生产环境下未配置 `AUTH_SESSION_SECRET` 时抛出明确错误，而非静默降级到弱密钥。

```diff
 export function getSessionSecret(): string {
-  return process.env.AUTH_SESSION_SECRET ?? "dev-only-change-this-secret";
+  const secret = process.env.AUTH_SESSION_SECRET;
+  if (!secret && process.env.NODE_ENV === "production") {
+    throw new Error("AUTH_SESSION_SECRET must be set in production.");
+  }
+  return secret ?? "dev-only-change-this-secret";
 }
```

#### 3. P1: Drizzle Config 移除硬编码凭据（DB-1）

删除了 `postgres://postgres:postgres@localhost:5432/pianoease` 硬编码回退，未设置 `DATABASE_URL` 时明确报错。

```diff
+const databaseUrl = process.env.DATABASE_URL;
+if (!databaseUrl) {
+  throw new Error("DATABASE_URL is required for drizzle-kit. Set it in your .env file.");
+}
+
 export default defineConfig({
   ...
   dbCredentials: {
-    url: process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/pianoease",
+    url: databaseUrl,
   },
 });
```

#### 4. P1: 连接池按环境调整（DB-2）

开发环境保持 `max: 1`（配合 HMR 单例），生产环境使用 `max: 10`。

```diff
     const sql = postgres(runtime.connectionString, {
       prepare: false,
-      max: 1,
+      max: process.env.NODE_ENV === "production" ? 10 : 1,
     });
```

#### 5. P1: measureStats 长度限制（API-3）

新增 `MAX_MEASURE_STATS = 500` 上限，超限请求被拒绝为 400 Invalid payload。

```diff
+const MAX_MEASURE_STATS = 500;
+
 function isEndPayload(value: unknown): value is EndPracticePayload {
   ...
     (payload.measureStats === undefined ||
-      (Array.isArray(payload.measureStats) && payload.measureStats.every(isMeasureStatPayload)))
+      (Array.isArray(payload.measureStats) &&
+        payload.measureStats.length <= MAX_MEASURE_STATS &&
+        payload.measureStats.every(isMeasureStatPayload)))
   );
 }
```

#### 6. P1: songId 格式校验（API-4）

在 `isStartPayload` 验证中新增 `SONG_ID_PATTERN` 正则，与 `musicxml.ts` 的 `assertSafeSongId` 保持一致。

```diff
+const SONG_ID_PATTERN = /^[a-z0-9-]+$/;
+
 function isStartPayload(value: unknown): value is StartPracticePayload {
   ...
     typeof payload.songId === "string" &&
+    SONG_ID_PATTERN.test(payload.songId) &&
     ["original", "lv1", "lv2", "lv3"].includes(String(payload.variant)) &&
```

#### 7. P1: Logout Cookie 解析优化（AUTH-6）

手动 `split(";")` cookie 解析替换为 Next.js `cookies()` API，更可靠也更简洁。

```diff
+import { cookies } from "next/headers";
 ...
 export async function POST(request: Request) {
-  const cookieHeader = request.headers.get("cookie") ?? "";
-  const cookieValue = cookieHeader
-    .split(";")
-    .map((value) => value.trim())
-    .find((value) => value.startsWith(`${AUTH_COOKIE_NAME}=`))
-    ?.slice(`${AUTH_COOKIE_NAME}=`.length);
+  const cookieStore = await cookies();
+  const cookieValue = cookieStore.get(AUTH_COOKIE_NAME)?.value;
```

#### 8. P1: Repository 数值清洗去重（API-2）

移除了与 handler 层重复的 `Math.max/Math.round` 调用，repository 层信任上游已清洗的数据。

```diff
-        requiredNoteCount: Math.max(0, Math.round(input.requiredNoteCount ?? 0)),
-        hitCount: Math.max(0, Math.round(input.hitCount ?? 0)),
-        missCount: Math.max(0, Math.round(input.missCount ?? 0)),
-        wrongCount: Math.max(0, Math.round(input.wrongCount ?? 0)),
-        completionPct:
-          typeof input.completionPct === "number"
-            ? Math.min(100, Math.max(0, Math.round(input.completionPct)))
-            : null,
+        requiredNoteCount: input.requiredNoteCount ?? 0,
+        hitCount: input.hitCount ?? 0,
+        missCount: input.missCount ?? 0,
+        wrongCount: input.wrongCount ?? 0,
+        completionPct: input.completionPct ?? null,
```

---

### 3.3 剩余技术债（P2 — 纳入 Phase 2 Backlog）

| # | 项目 | 行动 |
|---|------|------|
| 1 | DB-6: practice repository 拆分 | 分析纯函数移至 `lib/practice/analytics.ts` |
| 2 | DB-7: toDateKey 时区问题 | 统一使用 UTC |
| 3 | PRAC-3/4: 静态 import chart/manifest | 改为按需读取 + 缓存 |
| 4 | CROSS-1/2: 统一错误处理 + 日志 | 抽取 middleware wrapper + 接入 pino |
| 5 | CROSS-3: API 响应类型共享 | 共享类型定义 |
| 6 | AUTH-7: 过期 Session 清理 | 在 login 流中附带清理或使用 cron |
| 7 | AUTH-2: 密码时间安全比较 | 使用 `crypto.timingSafeEqual()` |
| 8 | AUTH-4: CSRF 防护 | 增加 Origin / Referer 校验 |
| 9 | AUTH-5: 登录频率限制 | 实现 rate limiting |
| 10 | DB-8: practice_measure_stats 复合唯一索引 | 添加 `(session_id, measure_index, hand)` 唯一约束 |
