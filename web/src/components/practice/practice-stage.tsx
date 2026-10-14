"use client";

import { useState } from "react";
import type { ChartVariantId, SongChart } from "@/lib/chart/types";
import { ScoreWorkbench } from "@/components/sheet/score-workbench";
import { MidiConnectionPanel } from "@/components/midi/midi-connection-panel";
import { WaterfallWaitingPanel } from "./waterfall-waiting-panel";
import type { PracticeMetrics } from "@/lib/practice/metrics";

type PracticeStageProps = {
  songId: string;
  chart: SongChart;
  initialVariantId?: ChartVariantId;
};

export function PracticeStage({ songId, chart, initialVariantId = "lv1" }: PracticeStageProps) {
  const [variantId, setVariantId] = useState<ChartVariantId>(initialVariantId);
  const [metrics, setMetrics] = useState<PracticeMetrics | null>(null);
  const [keyboardSimulationEnabled, setKeyboardSimulationEnabled] = useState(false);
  const scopedMetrics = metrics?.variantId === variantId ? metrics : null;
  const followMeasureIndex = scopedMetrics?.currentMeasureIndex ?? null;

  return (
    <div className="space-y-6">
      <MidiConnectionPanel 
        songId={songId} 
        variantId={variantId} 
        practiceMetrics={scopedMetrics} 
        keyboardSimulationEnabled={keyboardSimulationEnabled} 
      />
      <ScoreWorkbench
        songId={songId}
        chart={chart}
        defaultVariantId={initialVariantId}
        defaultNotation="number"
        variantId={variantId}
        onVariantChange={setVariantId}
        followMeasureIndex={followMeasureIndex}
      />
      <div className="space-y-4">
        <WaterfallWaitingPanel
          key={`waterfall-${variantId}`}
          chart={chart}
          variantId={variantId}
          onMetricsChange={setMetrics}
        />
        
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-zinc-700">未连接兜底：电脑键盘模拟输入</p>
            <button
              type="button"
              onClick={() => setKeyboardSimulationEnabled((current) => !current)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                keyboardSimulationEnabled
                  ? "border border-amber-300 bg-amber-100 text-amber-800 hover:bg-amber-200"
                  : "border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
              }`}
            >
              {keyboardSimulationEnabled ? "关闭模拟" : "开启模拟"}
            </button>
          </div>
          <p className="mt-2 text-xs text-zinc-500">键位映射：A W S E D F T G Y H U J K（C4 到 C5）</p>
        </div>
      </div>
    </div>
  );
}
