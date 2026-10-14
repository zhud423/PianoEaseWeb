# PianoEase Web MVP

Next.js + TypeScript + Tailwind 的 Phase 1 Web 实现。

## 本地开发（默认本地数据库）

1. 复制环境变量：

```bash
cp .env.example .env
```

2. 迁移并初始化本地数据库（PGlite）：

```bash
corepack pnpm db:migrate
corepack pnpm db:seed
corepack pnpm chart:generate
corepack pnpm chart:check
```

3. 启动开发服务：

```bash
corepack pnpm dev
```

打开 [http://localhost:3000](http://localhost:3000)。

## 性能压测（Sprint 5）

运行单曲渲染与判定压测：

```bash
corepack pnpm perf:practice
```

可选参数：

```bash
corepack pnpm perf:practice -- --song=friendship-years --variant=lv3 --iterations=32 --frames=2200 --strict
```

- 报告默认输出到 `reports/perf/practice-<song>-<variant>.baseline.json`
- `--strict` 会在性能超过阈值时返回非零退出码，便于后续接入 CI 门禁

内测前一键验收：

```bash
corepack pnpm verify
```

包含：`lint` + `test:core` + `check:practice` + `chart:check` + `build`

若需要附带性能门禁：

```bash
corepack pnpm verify:strict
```

关键逻辑回归检查（判定边界 + 报告聚合）：

```bash
corepack pnpm check:practice
```

核心自动化测试（登录 + chart 解析 + 判定引擎 + 报告聚合）：

```bash
corepack pnpm test:core
```

- 已包含练习会话 API 链路回归：`/api/practice/session/start` → `/api/practice/session/end`（含落库字段校验）

## 自动化测试覆盖与方法

当前自动化验证分为 4 类：

1. 单元/集成测试（`corepack pnpm test:core`）
- 登录鉴权：环境变量凭据回退、会话 hash 依赖密钥、TTL 计算、错误登录重定向。
- chart 校验：合法谱面可解析；缺失变体、非法音符时长会报错。
- 判定引擎：`Perfect/Good/Miss` 边界与得分映射。
- 报告聚合：热力图聚合、薄弱小节、节奏标签。
- API 会话链路：`start -> end`、未登录 401、不存在会话 404、写库字段清洗/截断/取整。

2. 逻辑回归脚本（`corepack pnpm check:practice`）
- 快速校验判定窗口和报告聚合口径，适合每次改判定逻辑后先跑。

3. 谱面资产校验（`corepack pnpm chart:check`）
- 校验每首歌 chart 存在、4 个变体齐全、基础 note 字段合法。

4. 性能基线（`corepack pnpm perf:practice [-- --strict]`）
- 输出渲染与判定链路基线；`--strict` 可作为 CI 门禁。

测试方法说明：
- 测试框架使用 Node 原生 `node:test`（TypeScript 通过 `tsx` 运行）。
- API 回归使用可注入 handler + 本地临时 PGlite 数据库（测试前迁移、测试后清理）。
- API 用例直接断言 HTTP 状态码/响应体，并二次查询数据库断言落库结果。

## 练习指标看板

- 首页支持 `?window=7` 与 `?window=30` 两种时间窗口。
- 展示指标包含：完曲率、模式偏好、难度升级率，以及按曲目/按难度/按日趋势。
- 支持单曲 drill-down：`/analytics/<songId>?window=7|30`，可查看该曲目的难度升级路径。

## 测试登录

- 用户名：`TEST_LOGIN_USERNAME`
- 密码：`TEST_LOGIN_PASSWORD`

默认值在 `.env.example` 中。

## 切换到 Postgres（可选）

在 `.env` 中设置：

```env
DB_DRIVER=postgres
DATABASE_URL=postgres://postgres:postgres@localhost:5432/pianoease
```
