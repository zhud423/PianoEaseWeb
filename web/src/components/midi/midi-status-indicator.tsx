"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  PIANOEASE_MIDI_STATUS_EVENT,
  type PianoEaseMidiStatusDetail,
  type PianoEaseMidiSupportStatus,
} from "@/lib/midi/events";

type BadgeView = {
  label: string;
  dotClassName: string;
  textClassName: string;
};

const INITIAL_STATUS: PianoEaseMidiStatusDetail = {
  status: "idle",
  connected: false,
  connectedInputName: null,
  availableInputCount: 0,
  keyboardSimulationEnabled: false,
  reason: null,
  updatedAt: Date.now(),
};

function toBadgeView(status: PianoEaseMidiStatusDetail): BadgeView {
  if (status.connected) {
    return {
      label: status.connectedInputName ? `MIDI 已连接 · ${status.connectedInputName}` : "MIDI 已连接",
      dotClassName: "bg-emerald-500",
      textClassName: "text-emerald-700",
    };
  }

  if (status.keyboardSimulationEnabled) {
    return {
      label: "键盘模拟输入中",
      dotClassName: "bg-amber-500",
      textClassName: "text-amber-700",
    };
  }

  if (status.status === "blocked") {
    return {
      label: "MIDI 未授权",
      dotClassName: "bg-rose-500",
      textClassName: "text-rose-700",
    };
  }

  if (status.status === "unsupported") {
    return {
      label: "MIDI 不可用",
      dotClassName: "bg-zinc-400",
      textClassName: "text-zinc-600",
    };
  }

  if (status.status === "checking") {
    return {
      label: "MIDI 检测中",
      dotClassName: "bg-sky-500",
      textClassName: "text-sky-700",
    };
  }

  return {
    label: "MIDI 未连接",
    dotClassName: "bg-rose-500",
    textClassName: "text-rose-700",
  };
}

function detectBaseStatus(): PianoEaseMidiStatusDetail {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return INITIAL_STATUS;
  }

  const nav = navigator as Navigator & { requestMIDIAccess?: unknown };
  const hasWebMidi = typeof nav.requestMIDIAccess === "function";
  if (!hasWebMidi) {
    return {
      ...INITIAL_STATUS,
      status: "unsupported",
      reason: "当前浏览器不支持 Web MIDI，建议使用 PC Chrome。",
      updatedAt: Date.now(),
    };
  }

  if (!window.isSecureContext) {
    return {
      ...INITIAL_STATUS,
      status: "unsupported",
      reason: "当前页面不是安全上下文，请使用 localhost 或 HTTPS。",
      updatedAt: Date.now(),
    };
  }

  return {
    ...INITIAL_STATUS,
    status: "idle",
    reason: null,
    updatedAt: Date.now(),
  };
}

export function MidiStatusIndicator() {
  const [status, setStatus] = useState<PianoEaseMidiStatusDetail>(() => detectBaseStatus());

  useEffect(() => {
    const onStatus = (event: Event) => {
      const detail = (event as CustomEvent<PianoEaseMidiStatusDetail>).detail;
      if (!detail) return;
      setStatus(detail);
    };

    window.addEventListener(PIANOEASE_MIDI_STATUS_EVENT, onStatus as EventListener);
    return () => {
      window.removeEventListener(PIANOEASE_MIDI_STATUS_EVENT, onStatus as EventListener);
    };
  }, []);

  const badge = toBadgeView(status);
  const statusText: PianoEaseMidiSupportStatus = status.status;

  return (
    <Link
      href="/practice/friendship-years#midi-panel"
      title={status.reason ?? `状态：${statusText}`}
      className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs hover:bg-zinc-50"
    >
      <span className={`h-2.5 w-2.5 rounded-full ${badge.dotClassName}`} />
      <span className={`font-medium ${badge.textClassName}`}>{badge.label}</span>
    </Link>
  );
}
