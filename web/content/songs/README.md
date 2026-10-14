# 曲谱资源目录（Sprint 2）

统一目录结构：

```txt
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

命名规则：

- `song-id` 统一使用 kebab-case，例如 `friendship-years`。
- 运行时统一读取 `chart.v0.json`，不能直接拿 MusicXML 做判定或报告。
- `chart.v0.json` 必须包含 `original/lv1/lv2/lv3` 四个变体。
- `manifest.json` 只做曲库元数据索引，不存判定明细。

生成命令：

```bash
corepack pnpm chart:generate
corepack pnpm chart:check
```
