"use client";

import { useEffect, useMemo, useState } from "react";
import type { ChartVariantId, SongChart } from "@/lib/chart/types";
import { OsmdSheetViewer } from "./osmd-sheet-viewer";
import { JianpuPreview } from "./jianpu-preview";

type NotationMode = "staff" | "number";

type ScoreWorkbenchProps = {
  songId: string;
  chart: SongChart;
  defaultVariantId?: ChartVariantId;
  defaultNotation?: NotationMode;
  variantId?: ChartVariantId;
  onVariantChange?: (variantId: ChartVariantId) => void;
  followMeasureIndex?: number | null;
};

const VARIANT_LABELS: Record<ChartVariantId, string> = {
  original: "原谱",
  lv1: "Lv1",
  lv2: "Lv2",
  lv3: "Lv3",
};

export function ScoreWorkbench({
  songId,
  chart,
  defaultVariantId = "lv1",
  defaultNotation = "number",
  variantId: controlledVariantId,
  onVariantChange,
  followMeasureIndex = null,
}: ScoreWorkbenchProps) {
  const [internalVariantId, setInternalVariantId] = useState<ChartVariantId>(defaultVariantId);
  const variantId = controlledVariantId ?? internalVariantId;
  const [notation, setNotation] = useState<NotationMode>(defaultNotation);

  useEffect(() => {
    const savedVariant = localStorage.getItem("pianoease_pref_variant") as ChartVariantId | null;
    if (savedVariant && ["lv1", "lv2", "lv3", "original"].includes(savedVariant)) {
      setInternalVariantId(savedVariant);
      onVariantChange?.(savedVariant);
    }
    
    const savedNotation = localStorage.getItem("pianoease_pref_notation") as NotationMode | null;
    if (savedNotation && ["number", "staff"].includes(savedNotation)) {
      setNotation(savedNotation);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedVariant = useMemo(() => {
    return chart.variants.find((variant) => variant.id === variantId) ?? chart.variants[0];
  }, [chart.variants, variantId]);

  const measureCount = selectedVariant.measures.length;
  const maxMeasureIndex = Math.max(0, measureCount - 1);
  const clampedFollowMeasureIndex =
    followMeasureIndex === null ? null : Math.max(0, Math.min(followMeasureIndex, maxMeasureIndex));
  const activeMeasureIndex = clampedFollowMeasureIndex ?? 0;

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {(["lv1", "lv2", "lv3", "original"] as const).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                localStorage.setItem("pianoease_pref_variant", id);
                if (!controlledVariantId) {
                  setInternalVariantId(id);
                }
                onVariantChange?.(id);
              }}
              className={`rounded-lg px-3 py-1.5 text-sm ${
                variantId === id
                  ? "bg-emerald-600 text-white"
                  : "border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100"
              }`}
            >
              {VARIANT_LABELS[id]}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-zinc-300 p-1">
          <button
            type="button"
            onClick={() => {
              localStorage.setItem("pianoease_pref_notation", "number");
              setNotation("number");
            }}
            className={`rounded-md px-3 py-1 text-sm ${notation === "number" ? "bg-zinc-900 text-white" : "text-zinc-700"}`}
          >
            简谱
          </button>
          <button
            type="button"
            onClick={() => {
              localStorage.setItem("pianoease_pref_notation", "staff");
              setNotation("staff");
            }}
            className={`rounded-md px-3 py-1 text-sm ${notation === "staff" ? "bg-zinc-900 text-white" : "text-zinc-700"}`}
          >
            五线谱
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3 sm:grid-cols-3">
        <div>
          <p className="text-xs text-zinc-500">当前变体</p>
          <p className="mt-1 text-sm font-medium">{selectedVariant.label}</p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">小节数</p>
          <p className="mt-1 text-sm font-medium">{measureCount}</p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">音符事件数</p>
          <p className="mt-1 text-sm font-medium">{selectedVariant.noteEvents.length}</p>
        </div>
      </div>

      <div className="mt-4">
        {notation === "staff" ? (
          <OsmdSheetViewer songId={songId} variantId={selectedVariant.id} />
        ) : (
          <JianpuPreview variant={selectedVariant} currentMeasureIndex={activeMeasureIndex} />
        )}
      </div>
    </section>
  );
}
