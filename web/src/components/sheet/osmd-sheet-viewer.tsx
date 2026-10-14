"use client";

import { useEffect, useRef, useState } from "react";
import type { ChartVariantId } from "@/lib/chart/types";

type OsmdLoadState = "idle" | "loading" | "ready" | "error";

type OsmdSheetViewerProps = {
  songId: string;
  variantId: ChartVariantId;
  className?: string;
};

type OsmdModule = typeof import("opensheetmusicdisplay");

export function OsmdSheetViewer({ songId, variantId, className }: OsmdSheetViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [loadState, setLoadState] = useState<OsmdLoadState>("idle");
  const [renderedVariant, setRenderedVariant] = useState<string>(variantId);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoadState("loading");
      setError(null);
      setRenderedVariant(variantId);

      try {
        const response = await fetch(`/api/songs/${songId}/musicxml?variant=${variantId}`, {
          method: "GET",
          cache: "no-store",
        });
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error("当前变体暂无五线谱");
          }
          throw new Error(`MusicXML request failed with ${response.status}`);
        }

        const xmlText = await response.text();
        const sourceVariant = response.headers.get("X-PianoEase-MusicXml-Variant") ?? variantId;
        if (cancelled) return;

        const moduleRef: OsmdModule = await import("opensheetmusicdisplay");
        if (cancelled || !containerRef.current) return;

        containerRef.current.innerHTML = "";
        const osmd = new moduleRef.OpenSheetMusicDisplay(containerRef.current, {
          backend: "svg",
          autoResize: true,
          drawTitle: false,
          drawSubtitle: false,
          drawPartNames: false,
          drawMeasureNumbers: true,
          renderSingleHorizontalStaffline: false,
          drawCredits: false,
        });
        await osmd.load(xmlText);
        osmd.render();

        setRenderedVariant(sourceVariant);
        setLoadState("ready");
      } catch (loadError) {
        if (cancelled) return;
        setLoadState("error");
        setError(loadError instanceof Error ? loadError.message : "OSMD 渲染失败");
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [songId, variantId]);

  return (
    <section className={className}>
      <div className="flex items-center justify-between gap-3 text-xs text-zinc-500">
        <span>五线谱渲染：{loadState === "ready" ? "就绪" : loadState === "loading" ? "加载中" : loadState}</span>
        <span>使用变体：{renderedVariant}</span>
      </div>
      <div className="mt-2 min-h-[220px] overflow-x-auto rounded-xl border border-zinc-200 bg-white p-3">
        <div ref={containerRef} />
        {loadState === "loading" ? <p className="text-sm text-zinc-500">正在加载谱面...</p> : null}
        {loadState === "error" ? <p className="text-sm text-rose-600">{error ?? "加载失败"}</p> : null}
      </div>
    </section>
  );
}
