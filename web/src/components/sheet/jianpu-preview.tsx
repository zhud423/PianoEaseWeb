"use client";

import { useEffect, useState } from "react";
import type { ChartVariant } from "@/lib/chart/types";

type JianpuPreviewProps = {
  variant: ChartVariant;
  currentMeasureIndex: number;
};

type RenderState = "idle" | "loading" | "ready" | "error";

export function JianpuPreview({ variant, currentMeasureIndex }: JianpuPreviewProps) {
  const [renderState, setRenderState] = useState<RenderState>("idle");
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadJianpu() {
      setRenderState("loading");
      setError(null);

      try {
        const response = await fetch("/api/render/jianpu", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ variant }),
        });

        if (!response.ok) {
          throw new Error("API request failed");
        }

        const data = await response.json();

        if (cancelled) return;

        if (data.svg) {
          setSvgContent(data.svg);
          setRenderState("ready");
        } else {
          throw new Error(data.error || "Missing SVG content");
        }
      } catch (err) {
        if (cancelled) return;
        setRenderState("error");
        setError(err instanceof Error ? err.message : "简谱后端渲染失败");
      }
    }

    void loadJianpu();

    return () => {
      cancelled = true;
    };
  }, [variant]); // 如果只是展示静态谱，依赖中无需加入 currentMeasureIndex

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3 text-xs text-zinc-500 mb-4">
        <span>双手简谱渲染：{renderState === "ready" ? "后端生成成功" : renderState === "loading" ? "后台算力加载中..." : renderState}</span>
        <span>
          {/* 因为下发的是静态全图 SVG，当前的播放游标联动已临时禁用 */}
          第 {Math.max(1, currentMeasureIndex + 1)} 小节 (静态全谱展示模式)
        </span>
      </div>

      <div className="relative min-h-[220px] rounded-xl border border-zinc-200 bg-[#fbfbfb] p-4 overflow-x-auto flex items-center justify-center">
        {renderState === "loading" && (
          <div className="text-sm text-zinc-500 animate-pulse">正在调用后台渲染引擎生成高清简谱...</div>
        )}
        
        {renderState === "error" && (
          <div className="text-sm text-rose-600">{error ?? "渲染失败"}</div>
        )}

        {renderState === "ready" && svgContent && (
          <div 
            className="w-full max-w-full overflow-x-auto overflow-y-hidden"
            dangerouslySetInnerHTML={{ __html: svgContent }} 
          />
        )}
      </div>
    </section>
  );
}
