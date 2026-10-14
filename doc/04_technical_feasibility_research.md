# 轻琴 (PianoEase) — 技术可行性调研

> **日期**：2026-03-26
> **状态**：已更新
> **关联**：02_product_positioning_and_roadmap.md → Phase 0 (POC)

---

## 一、 五线谱图片 → 简谱 → 标准数字谱

### 1.1 技术路径

五线谱图片无法直接转简谱，需要**两步走**：

```
五线谱图片 (PNG/JPG/PDF)
       │
       ▼  [Step 1: OMR 光学乐谱识别]
MusicXML (标准数字化中间格式)
       │
       ▼  [Step 2: 格式转换]
简谱数据 / 标准数字谱
```

### 1.2 Step 1：图片 → MusicXML（OMR 识别）

| 工具 | 类型 | 成熟度 | 特点 |  适用性 |
|---|---|---|---|---|
| **Audiveris** | 开源 (Java) | ⭐⭐⭐⭐ 较成熟 | 最主流的开源 OMR 引擎，支持导出 MusicXML 4.0，有内置编辑器纠正识别错误。附属项目 **Audiforge** 提供 Docker 部署的 Web 版 | ✅ **首选方案** |
| **homr** | 开源 (Python) | ⭐⭐⭐ 活跃开发 | 2026年3月仍在更新，使用 UNet 分割 + Transformer 识别，专门针对手机拍照场景 | ✅ 备选，适合手机拍照场景 |
| **oemer** | 开源 (Python) | ⭐⭐⭐ | 端到端 OMR，支持手机拍照识别，PyPI 可安装 | ✅ 备选 |
| **MuseScore PDF Import** | 免费 | ⭐⭐ 开发中 | MuseScore 内置 PDF 导入功能，可导出 MusicXML | 可用但非 API 友好 |

> ⚠️ **现实预期**：OMR 准确率依赖图片质量。印刷体五线谱准确率可达 85-95%，手写谱或拍照模糊的谱子准确率会显著降低，通常需要人工校正。

### 1.3 Step 2：MusicXML → 简谱

| 工具 | 类型 | 说明 |
|---|---|---|
| **nkufree/xml2jianpu** | 开源 (GitHub) | 专门做 MusicXML → 简谱转换的开源项目 |
| **反谱 (fanpu/serocs.cn)** | 在线服务 | 支持 MIDI/MusicXML → 五线谱/简谱在线预览和下载 |
| **易谱 (Yipu)** | 软件 | 导入 MusicXML 直接生成简谱 |
| **自研转换模块** | 自建 | MusicXML 是结构化 XML，音符信息完整，自行解析映射到简谱并不复杂 |

### 1.4 结论与建议

| 维度 | 结论 |
|---|---|
| **技术可行性** | ✅ 完全可行，开源工具链成熟 |
| **推荐方案** | Audiveris (图片→MusicXML) + 自研转换模块 (MusicXML→简谱数据) |
| **是否 MVP 必需** | ❌ **不是**。MVP 阶段用人工编排的 MusicXML 文件即可。图片 OCR 是 **Phase 3 (P3-5)** 的功能 |
| **风险** | OMR 识别复杂谱面（密集和弦、多声部）会有误差，需要用户校正流程 |

---

## 二、 Yamaha 电钢琴 USB MIDI 连接

### 2.1 硬件连接方式

Yamaha 电钢琴通过 **"USB to Host"** 接口输出 MIDI 信号。连接方式：

| 连接场景 | 线缆/转接 | 说明 |
|---|---|---|
| **钢琴 → 电脑 (PC/Mac)** | USB-A to USB-B 线（"打印机线"） | 即插即用，Mac 免驱，Windows 需装 Yamaha USB-MIDI Driver |
| **钢琴 → iPad (USB-C)** | USB-C to USB-B 线 | 直连即可，支持 MIDI + 部分型号支持数字音频传输 |
| **钢琴 → iPad (Lightning)** | Lightning to USB 相机转换器 + USB-B 线 | 需要苹果官方转接器 |
| **钢琴 → iPad (需充电)** | USB-C Hub (带 PD 充电) + USB-B 线 | 边充电边连琴 |

> ✅ **结论：Yamaha 电钢琴通过 USB to Host 连电脑或 iPad 的硬件链路本身没有问题。**
>
> ⚠️ **但要区分“硬件能连上”与“Web 产品能在浏览器里拿到 MIDI”。** iPad 的问题不在硬件，而在浏览器能力。

### 2.2 Web MIDI API 浏览器兼容性

我们的产品是 Web App，MIDI 通过浏览器的 Web MIDI API 访问钢琴：

| 浏览器 | 支持 Web MIDI API | 备注 |
|---|---|---|
| **Chrome** (v43+) | ✅ 原生支持 | 主力浏览器，延迟低 |
| **Edge** (v79+) | ✅ 原生支持 | Chromium 内核 |
| **Firefox** (v108+) | ✅ 原生支持 | 较新版本已支持 |
| **Opera** (v30+) | ✅ 原生支持 | - |
| **Safari (Mac/iPad)** | ❌ **不支持** | 苹果出于隐私考虑未实现 |

### 2.3 Safari 不支持的应对方案

这是**最关键的产品边界**，因为 iPad 上的浏览器全部基于 WebKit（包括 iPad 上的 Chrome），所以 iPad 上所有浏览器都不支持 Web MIDI API。也就是说，问题不是“换个浏览器试试”，而是 iPad Web 本身就不适合作为正式 MIDI 练琴终端。

| 方案 | 可行性 | 说明 |
|---|---|---|
| **WebMIDIAPIShim (Polyfill)** | ⚠️ 有限 | 依赖 Jazz-Plugin，桌面 Safari 可能可用，iPad Safari 不行 |
| **PWA + Web Bluetooth MIDI** | ❌ 不作为产品方案 | 即使做成 PWA，iPad 端底层仍是 WebKit，无法解决核心问题 |
| **标准 iPad 原生 App** | ✅ **最靠谱** | 用原生 MIDI 能力接入电钢琴，UI 与业务逻辑尽量复用 Web 版 |
| **引导用户用电脑** | ✅ MVP 阶段可行 | Phase 1 先只支持 PC Chrome，Web 跑通后再做标准 iPad App |

### 2.4 结论与建议

| 维度 | 结论 |
|---|---|
| **电脑端** | ✅ **零风险**。Chrome/Edge/Firefox + USB = 完美工作 |
| **iPad Web 端** | ❌ **不作为正式方案**。Safari / WebKit 不支持 Web MIDI API，继续赌纯 Web 不成立 |
| **iPad App 端** | ✅ **可行**。标准原生 App 可以直接处理 MIDI 输入 |
| **MVP 策略** | **Phase 1 先做 PC Web App (Chrome)**，Web 跑通后直接做标准 iPad App |
| **注意事项** | 需要 HTTPS 才能使用 Web MIDI API；需要用户授权 |

### 2.5 iPad 原生 App 的开发与自测边界

如果后续进入 iPad 原生阶段，当前判断如下：

| 事项 | 结论 |
|---|---|
| 开发形态 | 可以先做标准 iPad App，自用与开发测试优先 |
| 设备安装 | 可先满足开发者本人设备安装调试 |
| 测试策略 | 先做本机和自有 iPad 直装测试，再决定是否进入正式分发 |
| 分发边界 | 如后续需要更正式的对外测试或发布，再补齐对应分发方案 |

---

## 三、 音游瀑布流 — 开源项目调研

### 3.1 现有开源项目

| 项目 | 技术栈 | Stars | 核心功能 | 与我们的匹配度 |
|---|---|---|---|---|
| **Midiano** | Web (JS) | ⭐⭐⭐ | MIDI 下落式可视化 + 五线谱同步 + MIDI 键盘交互反馈 | ⭐⭐⭐⭐⭐ **最佳参考** |
| **piano-hero** | Web (JS, Web Audio + Web MIDI) | ⭐⭐ | Guitar Hero 风格，MIDI 输入，打分统计，变速 | ⭐⭐⭐⭐ 游戏化参考 |
| **Openthesia** | 跨平台 | ⭐⭐⭐ | Synthesia 开源替代，等待模式、左右手分色、变速 | ⭐⭐⭐⭐ 功能对标 |
| **Neothesia** | Rust + WGPU | ⭐⭐⭐⭐ | 跨平台 MIDI 可视化，MIDI 键盘连接，内置合成器 | ⭐⭐⭐ 非 Web，但渲染参考 |
| **Lumina** | Web (JS) | ⭐⭐ | 2D/3D MIDI 可视化，Web MIDI 输入 | ⭐⭐⭐ 可视化参考 |
| **CanvasMIDI** | Web (Canvas + JS) | ⭐ | 轻量 Canvas MIDI 可视化 | ⭐⭐ 基础参考 |

### 3.2 推荐策略：基于 Midiano 二次开发

**Midiano** 是最匹配的项目：
- ✅ 纯 Web 技术（浏览器直接运行）
- ✅ 已实现 MIDI 下落式音符可视化
- ✅ 已实现 Web MIDI API 键盘输入
- ✅ 已实现五线谱同步显示
- ✅ 开源可修改

**我们需要在其基础上扩展的功能**：

| 基础已有 | 需要新增 |
|---|---|
| MIDI 文件播放 + 下落可视化 | 简谱显示模式 |
| Web MIDI 键盘输入 | 等待模式（弹对才继续） |
| 基础音符颜色 | 左右手分色 + 错音标红 |
| — | 打分系统 (Perfect/Good/Miss + Combo) |
| — | 分级难度切换 (Lv1/Lv2/Lv3) |
| — | 练习报告生成 |

### 3.3 结论

| 维度 | 结论 |
|---|---|
| **是否需要从零造轮子** | ❌ **不需要**。多个成熟开源项目可用 |
| **推荐路径** | 参考 **Midiano** 的核心渲染和 MIDI 逻辑，结合 **piano-hero** 的打分系统 |
| **技术风险** | 🟢 低。Canvas 渲染 + Web MIDI 是成熟技术 |

---

## 四、 POC 技术验证清单（更新版）

基于调研结果，更新 Phase 0 各项的技术评估：

| # | 验证项 | 技术方案 | 风险 | 是否有开源可用 |
|---|---|---|---|---|
| P0-1 | MIDI 接入 | Web MIDI API (Chrome) | 🟢 低。成熟标准 | 不需要，原生 API |
| P0-2 | 曲谱渲染 | OSMD (五线谱) + 自研 (简谱) | 🟡 中。简谱渲染需自建 | OSMD 开源；简谱可参考 xml2jianpu |
| P0-3 | 音符对齐 | DTW 动态时间规整 | 🟡 中。需调参 | dtw-python / JS 实现 |
| P0-4 | 和声分析 | tonal.js + 规则引擎 | 🟡 中。复杂和弦识别 | tonal.js 开源 |
| P0-5 | 瀑布流渲染 | Canvas + 参考 Midiano | 🟢 低。有成熟参考 | Midiano / piano-hero |

### 整体评估

```
技术可行性：✅ Phase 1 Web 路线可行，后续 iPad 原生路线也可行
最大风险点：iPad Web 不支持 Web MIDI API，因此必须避免把 iPad 浏览器当成正式 MIDI 方案
需要自建的部分：简谱渲染引擎 + 统一 chart 数据结构 + 评分/诊断系统
可复用开源的部分：MIDI 接入 / 五线谱渲染 / 瀑布流基础框架
```

---

## 五、 下一步建议

1. **先做 PC Chrome Web MVP**，验证 MIDI、曲谱、瀑布流和报告闭环
2. **优先定义统一 chart 数据结构**，避免渲染、判定、报告各走一套格式
3. **接上 Yamaha 电钢琴用 Chrome 测试**，验证延迟和音符捕获
4. **Web 跑通后再做标准 iPad App**，复用核心业务逻辑和谱面数据
