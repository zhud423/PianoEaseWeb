# 轻琴 (PianoEase) — Phase 1 技术方案与开发任务拆解

> **版本**：v1.0
> **日期**：2026-03-26
> **状态**：可开工
> **关联文档**：02 产品定位与路线图 / 03 左手伴奏简化规则 / 05 Phase 1 MVP PRD

---

## 一、 已确认的关键决策

1. **MVP 主形态是 Web，但正式练琴终端只定义为 PC Chrome。**
   - Phase 1 用 Web MIDI API 跑通最小闭环。
   - iPad Web 不承担正式 MIDI 练习能力。

2. **框架统一为 Next.js。**
   - 原因不是“技术偏好”，而是 MVP 已明确包含登录和练习记录。
   - Next.js 既能做前端页面，也能承载账号、接口和数据存储。

3. **登录是当前 MVP 基线。**
   - 测试期先做账号密码登录。
   - 后续再扩展手机号登录，不在 Phase 1 首发范围内。

4. **谱面必须有统一运行时格式。**
   - MusicXML 继续作为人工编排和五线谱渲染的来源格式。
   - 运行时统一转换为 `chart JSON`，供瀑布流、判定、报告和简谱共用。

5. **iPad 路线是原生 App，不是继续赌 iPad Web。**
   - Web 跑通后，直接做标准 iPad App。
   - 未来 iPad 侧复用 `chart`、判定和报告聚合逻辑。

---

## 二、 Phase 1 总体架构

```
人工编排 MusicXML
       │
       ▼
Chart 生成脚本
  ├── 原谱 / Lv1 / Lv2 / Lv3
  ├── 简谱视图数据
  └── 运行时 chart JSON
       │
       ▼
Next.js 应用
  ├── 登录页 / 曲库页 / 练习页 / 报告页
  ├── Route Handlers / Server Actions
  ├── 练习记录存储
  └── 静态曲谱资源分发
       │
       ├── PC Chrome: Web MIDI + OSMD + Canvas
       └── 后续 iPad App: 原生 MIDI + 复用业务内核
```

### 2.1 模块划分

| 模块 | 职责 |
|---|---|
| `app/` | 登录、曲库、练习准备、音游、跟谱、报告等页面 |
| `lib/auth` | 测试账号登录、密码校验、session 管理 |
| `lib/chart` | MusicXML 解析结果、运行时 chart 类型、变体切换 |
| `lib/midi` | Web MIDI 设备发现、输入流、Note On/Off 标准化 |
| `lib/judgement` | 音符对齐、判定窗口、Perfect/Good/Miss |
| `lib/reporting` | 练习结果聚合、准确率、错音热力图、小节统计 |
| `content/songs` | 曲目元数据、MusicXML、chart JSON、封面和预览图 |
| `db` | 用户、练习记录、练习会话等持久化模型 |

### 2.2 当前建议技术栈

| 层 | 选型 | 说明 |
|---|---|---|
| 应用框架 | Next.js (App Router) + TypeScript | 页面、接口、鉴权一体化 |
| UI | React + Tailwind CSS | 组件开发效率高，后续可快速做 iPad 适配 |
| 状态管理 | Zustand | 练习页局部状态清晰，避免过重方案 |
| 五线谱 | OpenSheetMusicDisplay | 直接吃 MusicXML，适合练习页和准备页预览 |
| 简谱 | 自研 React/SVG 组件 | 需要按练习场景定制高亮与小节定位 |
| 瀑布流 | Canvas 2D | 性能和可控性足够，MVP 不必先上更重渲染层 |
| MIDI | Web MIDI API + webmidi.js | PC Chrome 路径最短 |
| 音频 | Tone.js | 节拍器、倒计时和预听 |
| 数据库 | 本地开发：PGlite；线上：PostgreSQL | 当前先用本地库跑通，后续可无缝切 Postgres |
| ORM | Drizzle ORM | 轻量、类型清晰、适合 Next.js |
| 密码方案 | Argon2 哈希 | 测试账号也不应明文存储 |
| 会话 | Cookie Session | Web MVP 最直接；后续 iPad 可扩展 token 方案 |

---

## 三、 统一谱面运行时格式

### 3.1 为什么必须先定

如果没有统一格式，会立刻出现三套不同的事实来源：

- OSMD 渲染看的是 MusicXML
- 瀑布流判定看的是另一份 note timeline
- 报告统计又自己按第三套规则聚合

结果就是同一小节在页面、判定、报告里对不上。这个问题不是优化项，而是 Phase 1 的基础设计。

### 3.2 数据分层原则

| 层级 | 格式 | 用途 |
|---|---|---|
| 作者源文件 | `MusicXML` | 人工编排、校谱、五线谱渲染 |
| 运行时标准格式 | `chart JSON` | 瀑布流、判定、报告、简谱共用 |
| 可选导出 | `MIDI` | 回放、调试、参考第三方工具 |

### 3.3 `chart JSON` 最小字段

```ts
type SongChart = {
  songId: string
  title: string
  bpm: number
  ppq: number
  timeSignature: [number, number]
  keySignature: string
  variants: ChartVariant[]
}

type ChartVariant = {
  id: "original" | "lv1" | "lv2" | "lv3"
  label: string
  measures: Measure[]
  noteEvents: NoteEvent[]
  chordSegments: ChordSegment[]
}

type Measure = {
  index: number
  startTick: number
  endTick: number
}

type ChordSegment = {
  measureIndex: number
  startTick: number
  endTick: number
  symbol: string
  leftHandPattern?: string
}

type NoteEvent = {
  id: string
  hand: "left" | "right"
  midi: number
  pitchName: string
  startTick: number
  durationTick: number
  measureIndex: number
  beatInMeasure: number
  voice?: string
  required: boolean
  optional: boolean
  chordSymbol?: string
}
```

### 3.4 运行规则

1. 五线谱继续用 MusicXML 渲染，但所有高亮定位都要能映射回 `chart.noteEvents`。
2. 瀑布流只读取 `chart.noteEvents`，不直接读 MusicXML。
3. 跟谱模式的弹对/弹错/漏弹标记，也基于 `chart.noteEvents`。
4. 报告页按 `measureIndex`、`hand`、`chordSymbol` 聚合，不能重新发明一套统计口径。

### 3.5 资源目录与命名（已落地）

```
content/songs/
  manifest.json
  <song-id>/
    chart.v0.json
    musicxml/
      original.musicxml
      lv1.musicxml
      lv2.musicxml
      lv3.musicxml
```

1. `song-id` 统一使用 kebab-case。
2. 运行时逻辑只读 `chart.v0.json`。
3. `chart.v0.json` 必须包含 `original/lv1/lv2/lv3` 四个变体。
4. `manifest.json` 仅保存曲库元数据索引，不参与判定口径。

---

## 四、 服务端数据模型

### 4.1 Phase 1 需要的核心表

| 表 | 用途 |
|---|---|
| `users` | 测试用户账号 |
| `sessions` | 登录态 |
| `songs` | 曲目元数据 |
| `song_variants` | 原谱 / Lv1 / Lv2 / Lv3 资源索引 |
| `practice_sessions` | 一次完整练习会话 |
| `practice_measure_stats` | 按小节聚合的命中率、错音数、节奏偏差 |

### 4.2 Phase 1 不建议一开始就做的表

| 表 | 原因 |
|---|---|
| `raw_midi_events` | 量大，MVP 先不长期存全量事件 |
| `phone_verification_codes` | 手机号登录不是当前范围 |
| `ugc_upload_jobs` | 曲库上传不是当前范围 |

---

## 五、 开发任务拆解

### 5.1 Sprint 0：工程起步

1. 初始化 Next.js 项目、TypeScript、Tailwind、ESLint、Prettier。
2. 搭建基础路由：登录页、首页、曲目详情页、练习页、报告页。
3. 接入数据库、ORM 和本地开发环境（默认 PGlite）。
4. 建立环境变量规范和部署方式。

### 5.2 Sprint 1：账号与基础壳

1. 实现测试期账号密码登录。
2. 做 session 校验、中间件鉴权和退出登录。
3. 完成应用外壳：顶部导航、用户信息、MIDI 状态位。
4. 打通曲库列表和曲目详情页的静态数据读取。

### 5.3 Sprint 2：曲谱资产与 chart 管线

1. 确定曲目目录结构和命名规范。
2. 写 MusicXML 到 `chart JSON` 的生成脚本。
   - 当前约定命令：`pnpm chart:generate`（输入 `musicxml/original.musicxml`，输出 `chart.v0.json`）。
3. 为第一首歌产出 `original/lv1/lv2/lv3` 四个变体。
4. 接入 OSMD，完成准备页预览和练习页五线谱展示。
   - 当前实现通过 `GET /api/songs/[songId]/musicxml?variant=lv1|lv2|lv3` 提供谱面源。
   - 若对应变体 MusicXML 缺失，暂时回退到 `original.musicxml` 以保证页面可用。
5. 搭建简谱渲染组件，先支持静态展示与当前小节高亮。

### 5.4 Sprint 3：MIDI 与瀑布流

1. 接入 Web MIDI 设备发现、连接和输入监听。
2. 将 MIDI 输入事件标准化为统一内部事件。
3. 基于 `chart.noteEvents` 实现瀑布流可视化。
4. 做等待模式和自由模式的时间轴控制。
5. 实现实时分数、Combo 和基础判定反馈。

当前已落地（2026-03-26）：
- 练习页已接 `chart.noteEvents` 的 Canvas 瀑布流。
- 已实现等待模式判定推进（正确命中后推进到下一目标组）。
- 已提供自由模式时间轴滚动基础能力。
- MIDI 输入已通过统一前端事件总线分发，供瀑布流与写库共用。

### 5.5 Sprint 4：跟谱模式与报告

1. 做跟谱模式的当前小节跟随与实时高亮。
2. 实现弹对、弹错、漏弹标记。
3. 聚合单次练习结果，输出准确率、左右手统计和错音热力图。
4. 报告页支持“再练一次 / 换难度 / 回首页”闭环。

当前已落地（2026-03-26）：
- 练习页已支持按瀑布流进度驱动的小节自动跟随，并可切换手动查看。
- 已按小节输出“弹对 / 错音 / 漏弹”标记，供跟谱与复盘查看。
- 报告页已使用最近一次真实会话数据，并支持按难度快捷“再练一次/换难度”。

### 5.6 Sprint 5：稳定性与内测准备

1. 做 Chrome MIDI 权限引导、未连接状态兜底和异常提示。
2. 压测一首完整曲目的渲染与判定性能。
3. 补关键测试：登录、chart 解析、判定引擎、报告聚合。
4. 埋点完曲率、模式偏好、难度升级率等 MVP 指标。

当前已落地（2026-03-26）：
- 练习页 MIDI 面板已补齐权限拒绝、非安全上下文、无设备场景的分级提示。
- 已提供“电脑键盘模拟输入”作为未连接兜底，支持继续验证判定与写库流程。
- 顶部导航已增加全局 MIDI 状态指示灯，并与练习页连接状态联动。
- 已新增 `pnpm perf:practice` 基准脚本，覆盖单曲瀑布流渲染与判定链路耗时统计，并输出基线报告。
- 已新增 `pnpm check:practice` 逻辑回归脚本，覆盖判定窗口边界和报告聚合规则。
- 已新增 `pnpm test:core` 自动化测试，覆盖登录鉴权、chart 解析、判定窗口和报告聚合四类核心逻辑。
- 已补练习会话 API 链路回归（`start -> end`），覆盖鉴权、参数校验、状态码和关键写库字段。
- 已在首页接入会话 KPI 卡片（完曲率、模式偏好、难度升级率），基于 `practice_sessions` 实时聚合。
- 已支持 7 天/30 天时间窗口，并展示按曲目、按难度、按日维度的趋势指标。
- 已提供单曲 drill-down 页面（`/analytics/:songId`），支持查看单曲难度升级路径与分日趋势。

#### 5.6.1 自动化测试覆盖矩阵（当前实现）

| 类别 | 命令 | 覆盖内容 | 方法 |
| --- | --- | --- | --- |
| 核心逻辑测试 | `pnpm test:core` | 登录鉴权、chart 解析、判定边界、报告聚合、练习会话 API 链路（401/404/写库） | Node `node:test` + `tsx` |
| API 链路回归 | `pnpm test:core` | `/api/practice/session/start` 到 `/api/practice/session/end` 全链路 | 可注入 handler + 临时 PGlite + 迁移后真实写库断言 |
| 逻辑脚本回归 | `pnpm check:practice` | 判定窗口和报告聚合规则的快速回归 | 纯函数脚本断言 |
| 谱面资产校验 | `pnpm chart:check` | chart 存在性、4 变体完整性、基础 note 字段合法性 | 脚本遍历 catalog |
| 性能基线 | `pnpm perf:practice [--strict]` | 渲染 + 判定链路耗时，支持阈值门禁 | 基准脚本 + JSON 报告 |

当前还提供一键验收命令：
- `pnpm verify`：串行执行 `lint + test:core + check:practice + chart:check + build`
- `pnpm verify:strict`：在 `verify` 基础上追加 `perf:practice -- --strict`

---

## 六、 开工顺序建议

最小正确顺序如下：

1. 先把 `Next + 登录 + 曲库页壳子` 搭起来。
2. 紧接着定 `chart JSON` 和曲目目录结构。
3. 再做 OSMD 和简谱预览，确认谱面资产能稳定跑起来。
4. 然后接 Web MIDI 和瀑布流。
5. 最后补报告页和统计。

不能反过来先做瀑布流 Demo，再回头补登录和数据结构；那样最后一定要返工。
