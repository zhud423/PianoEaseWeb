"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChartVariantId } from "@/lib/chart/types";
import {
  PIANOEASE_MIDI_EVENT,
  PIANOEASE_MIDI_STATUS_EVENT,
  type PianoEaseMidiEventType,
  type PianoEaseMidiInputSource,
  type PianoEaseMidiStatusDetail,
} from "@/lib/midi/events";
import type { PracticeMetrics } from "@/lib/practice/metrics";

type MidiStatus = "idle" | "checking" | "ready" | "unsupported" | "blocked" | "error";

type MidiInputSummary = {
  id: string;
  name: string;
  manufacturer: string;
  state: string;
};

type MidiEventPreview = {
  label: string;
  at: number;
};

type MidiCounters = {
  midiEventCount: number;
  noteOnCount: number;
  noteOffCount: number;
};

type PersistStatus = "idle" | "starting" | "recording" | "ending" | "saved" | "save_error";

type WebMidiNavigator = Navigator & {
  requestMIDIAccess?: (options?: MIDIOptions) => Promise<MIDIAccess>;
};

type RuntimeSupport = {
  supported: boolean;
  reason: string | null;
};

type RequestErrorResolution = {
  status: MidiStatus;
  message: string;
};

type EmitMidiEventInput = {
  type: PianoEaseMidiEventType;
  note: number;
  velocity: number;
  source: PianoEaseMidiInputSource;
  label: string;
};

const INITIAL_COUNTERS: MidiCounters = {
  midiEventCount: 0,
  noteOnCount: 0,
  noteOffCount: 0,
};

const KEYBOARD_NOTE_MAP: Record<string, number> = {
  a: 60,
  w: 61,
  s: 62,
  e: 63,
  d: 64,
  f: 65,
  t: 66,
  g: 67,
  y: 68,
  h: 69,
  u: 70,
  j: 71,
  k: 72,
};

const KEYBOARD_HINT = "键位映射：A W S E D F T G Y H U J K（C4 到 C5）";

function collectInputs(access: MIDIAccess): MidiInputSummary[] {
  return Array.from(access.inputs.values()).map((input) => ({
    id: input.id,
    name: input.name ?? "Unknown Device",
    manufacturer: input.manufacturer ?? "Unknown Manufacturer",
    state: input.state,
  }));
}

function describeMidiMessage(message: Uint8Array): string {
  const [statusByte = 0, note = 0, velocity = 0] = message;
  const command = statusByte & 0xf0;

  if (command === 0x90 && velocity > 0) {
    return `NoteOn note=${note} velocity=${velocity}`;
  }
  if (command === 0x80 || (command === 0x90 && velocity === 0)) {
    return `NoteOff note=${note}`;
  }
  return `MIDI ${Array.from(message).join(",")}`;
}

function classifyMessage(message: Uint8Array): PianoEaseMidiEventType {
  const [statusByte = 0, , velocity = 0] = message;
  const command = statusByte & 0xf0;

  if (command === 0x90 && velocity > 0) return "note_on";
  if (command === 0x80 || (command === 0x90 && velocity === 0)) return "note_off";
  return "other";
}

function getRuntimeSupport(): RuntimeSupport {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return { supported: false, reason: "浏览器环境不可用。" };
  }

  const nav = navigator as WebMidiNavigator;
  if (!nav.requestMIDIAccess) {
    return { supported: false, reason: "当前浏览器不支持 Web MIDI，请使用 PC Chrome 最新版。" };
  }

  if (!window.isSecureContext) {
    return { supported: false, reason: "当前页面不是安全上下文，请使用 localhost 或 HTTPS 访问。" };
  }

  return { supported: true, reason: null };
}

function resolveRequestError(requestError: unknown): RequestErrorResolution {
  if (requestError instanceof DOMException) {
    if (requestError.name === "NotAllowedError") {
      return {
        status: "blocked",
        message: "MIDI 权限被拒绝，请在 Chrome 地址栏站点设置中允许 MIDI 设备访问后重试。",
      };
    }
    if (requestError.name === "SecurityError") {
      return {
        status: "unsupported",
        message: "当前环境不满足 Web MIDI 安全要求，请切换到 localhost 或 HTTPS。",
      };
    }
  }

  if (requestError instanceof Error) {
    return { status: "error", message: requestError.message };
  }

  return { status: "error", message: "未知 Web MIDI 错误，请重试。" };
}



function isEditableElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

type MidiConnectionPanelProps = {
  songId: string;
  variantId?: ChartVariantId;
  practiceMetrics?: PracticeMetrics | null;
  keyboardSimulationEnabled: boolean;
};

export function MidiConnectionPanel({ songId, variantId = "lv1", practiceMetrics = null, keyboardSimulationEnabled }: MidiConnectionPanelProps) {
  const runtimeSupport = getRuntimeSupport();

  const [status, setStatus] = useState<MidiStatus>(runtimeSupport.supported ? "idle" : "unsupported");
  const [error, setError] = useState<string | null>(null);
  const [supportReason, setSupportReason] = useState<string | null>(runtimeSupport.reason);
  const [midiAccess, setMidiAccess] = useState<MIDIAccess | null>(null);
  const [inputs, setInputs] = useState<MidiInputSummary[]>([]);
  const [selectedInputId, setSelectedInputId] = useState<string>("");
  const [connectedInputId, setConnectedInputId] = useState<string>("");
  const [lastEvent, setLastEvent] = useState<MidiEventPreview | null>(null);
  const [persistStatus, setPersistStatus] = useState<PersistStatus>("idle");
  const [activeSessionId, setActiveSessionId] = useState<string>("");
  const [midiCounters, setMidiCounters] = useState<MidiCounters>(INITIAL_COUNTERS);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const pressedKeyboardKeysRef = useRef<Set<string>>(new Set());
  const connectedInputName = inputs.find((item) => item.id === connectedInputId)?.name ?? null;
  const effectiveReason = error ?? supportReason;

  let permissionLabel = "待检测";
  let permissionColor = "text-zinc-600";
  if (status === "unsupported") {
    permissionLabel = "当前环境不支持";
    permissionColor = "text-amber-600";
  } else if (status === "blocked") {
    permissionLabel = "已被浏览器拒绝";
    permissionColor = "text-rose-600";
  } else if (status === "ready") {
    permissionLabel = "已授权允许访问";
    permissionColor = "text-emerald-600";
  } else if (status === "checking") {
    permissionLabel = "授权检测中...";
    permissionColor = "text-sky-600";
  }

  let deviceStatusLabel = "未连接";
  let deviceStatusColor = "text-zinc-600";
  if (connectedInputId && connectedInputName) {
    deviceStatusLabel = `已连接：${connectedInputName}`;
    deviceStatusColor = "text-emerald-600";
  } else if (inputs.length > 0) {
    deviceStatusLabel = `发现 ${inputs.length} 台可用设备，待选中连接`;
    deviceStatusColor = "text-amber-600";
  } else if (status === "ready" && inputs.length === 0) {
    deviceStatusLabel = "未检测到外部接入设备";
    deviceStatusColor = "text-zinc-600";
  } else if (status === "unsupported" || status === "blocked") {
    deviceStatusLabel = "因为权限或环境受阻，无法检测";
    deviceStatusColor = "text-zinc-400";
  }

  const emitMidiEvent = useCallback(({ type, note, velocity, source, label }: EmitMidiEventInput) => {
    setMidiCounters((current) => ({
      midiEventCount: current.midiEventCount + 1,
      noteOnCount: current.noteOnCount + (type === "note_on" ? 1 : 0),
      noteOffCount: current.noteOffCount + (type === "note_off" ? 1 : 0),
    }));
    setLastEvent({
      label,
      at: Date.now(),
    });

    window.dispatchEvent(
      new CustomEvent(PIANOEASE_MIDI_EVENT, {
        detail: {
          type,
          note,
          velocity,
          at: Date.now(),
          source,
        },
      })
    );
  }, []);

  useEffect(() => {
    return () => {
      if (!midiAccess || !connectedInputId) return;
      const connectedInput = midiAccess.inputs.get(connectedInputId);
      if (connectedInput) connectedInput.onmidimessage = null;
      midiAccess.onstatechange = null;
    };
  }, [midiAccess, connectedInputId]);

  useEffect(() => {
    if (!keyboardSimulationEnabled) return;
    const pressedKeys = pressedKeyboardKeysRef.current;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || isEditableElement(event.target)) return;
      const key = event.key.toLowerCase();
      const note = KEYBOARD_NOTE_MAP[key];
      if (typeof note !== "number") return;
      if (pressedKeys.has(key)) return;
      pressedKeys.add(key);
      event.preventDefault();
      emitMidiEvent({
        type: "note_on",
        note,
        velocity: 100,
        source: "keyboard",
        label: `[键盘] NoteOn note=${note}`,
      });
    };

    const onKeyUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const note = KEYBOARD_NOTE_MAP[key];
      if (typeof note !== "number") return;
      if (!pressedKeys.has(key)) return;
      pressedKeys.delete(key);
      event.preventDefault();
      emitMidiEvent({
        type: "note_off",
        note,
        velocity: 0,
        source: "keyboard",
        label: `[键盘] NoteOff note=${note}`,
      });
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      pressedKeys.clear();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [emitMidiEvent, keyboardSimulationEnabled]);

  useEffect(() => {
    const detail: PianoEaseMidiStatusDetail = {
      status,
      connected: Boolean(connectedInputId),
      connectedInputName,
      availableInputCount: inputs.length,
      keyboardSimulationEnabled,
      reason: effectiveReason ?? null,
      updatedAt: Date.now(),
    };

    window.dispatchEvent(new CustomEvent(PIANOEASE_MIDI_STATUS_EVENT, { detail }));
  }, [connectedInputId, connectedInputName, effectiveReason, inputs.length, keyboardSimulationEnabled, status]);

  async function requestMidiAccess() {
    const support = getRuntimeSupport();
    if (!support.supported) {
      setStatus("unsupported");
      setSupportReason(support.reason);
      setError(support.reason);
      return;
    }

    const nav = navigator as WebMidiNavigator;
    try {
      setStatus("checking");
      setError(null);
      setSupportReason(null);

      const access = await nav.requestMIDIAccess?.({ sysex: false });
      if (!access) {
        throw new Error("requestMIDIAccess 返回为空。");
      }

      const nextInputs = collectInputs(access);
      setMidiAccess(access);
      setInputs(nextInputs);
      setStatus("ready");

      const firstId = nextInputs[0]?.id ?? "";
      setSelectedInputId((current) => (current && nextInputs.some((item) => item.id === current) ? current : firstId));
      setConnectedInputId((current) => (current && nextInputs.some((item) => item.id === current) ? current : ""));

      access.onstatechange = () => {
        const refreshed = collectInputs(access);
        setInputs(refreshed);
        setSelectedInputId((current) => (current && refreshed.some((item) => item.id === current) ? current : refreshed[0]?.id ?? ""));
        setConnectedInputId((current) => (current && refreshed.some((item) => item.id === current) ? current : ""));
      };
    } catch (requestError) {
      const resolved = resolveRequestError(requestError);
      setStatus(resolved.status);
      setError(resolved.message);
      if (resolved.status === "unsupported") {
        setSupportReason(resolved.message);
      }
    }
  }

  function disconnectInput() {
    if (!midiAccess || !connectedInputId) return;
    const connectedInput = midiAccess.inputs.get(connectedInputId);
    if (connectedInput) {
      connectedInput.onmidimessage = null;
    }
    setConnectedInputId("");
  }

  function connectInput() {
    if (!midiAccess || !selectedInputId) return;
    disconnectInput();

    const selectedInput = midiAccess.inputs.get(selectedInputId);
    if (!selectedInput) {
      setError("所选 MIDI 设备不可用，请重新检测。");
      return;
    }

    setError(null);
    setConnectedInputId(selectedInput.id);
    setIsCollapsed(true);
    selectedInput.onmidimessage = (event) => {
      if (!event.data) return;
      const [, note = 0, velocity = 0] = event.data;
      const eventType = classifyMessage(event.data);
      emitMidiEvent({
        type: eventType,
        note,
        velocity,
        source: "device",
        label: `[MIDI] ${describeMidiMessage(event.data)}`,
      });
    };
  }

  async function startRecording() {
    if (!connectedInputId && !keyboardSimulationEnabled) {
      setError("请先连接 MIDI 设备，或启用电脑键盘模拟输入。");
      return;
    }

    try {
      setError(null);
      setPersistStatus("starting");
      setMidiCounters(INITIAL_COUNTERS);

      const response = await fetch("/api/practice/session/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          songId,
          variant: variantId,
          mode: "game",
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? `Start failed with status ${response.status}`);
      }

      const payload = (await response.json()) as { sessionId: string };
      setActiveSessionId(payload.sessionId);
      setPersistStatus("recording");
    } catch (persistError) {
      setPersistStatus("save_error");
      setError(persistError instanceof Error ? persistError.message : "无法创建练习会话");
    }
  }

  async function endRecording() {
    if (!activeSessionId) return;

    try {
      setPersistStatus("ending");
      const requiredNoteCount = practiceMetrics?.totalRequiredNotes ?? 0;
      const hitCount = practiceMetrics?.hitCount ?? 0;
      const missCount = practiceMetrics?.missCount ?? 0;
      const wrongCount = practiceMetrics?.wrongCount ?? 0;
      const completionPct =
        requiredNoteCount > 0 ? Math.min(100, Math.round(((hitCount + missCount) / requiredNoteCount) * 100)) : 0;
      const response = await fetch("/api/practice/session/end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: activeSessionId,
          score: practiceMetrics?.score ?? midiCounters.noteOnCount * 2,
          midiEventCount: midiCounters.midiEventCount,
          noteOnCount: midiCounters.noteOnCount,
          noteOffCount: midiCounters.noteOffCount,
          rightAccuracyPct: practiceMetrics?.rightAccuracyPct ?? null,
          leftAccuracyPct: practiceMetrics?.leftAccuracyPct ?? null,
          requiredNoteCount,
          hitCount,
          missCount,
          wrongCount,
          completionPct,
          measureStats: practiceMetrics?.measureStats ?? [],
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? `End failed with status ${response.status}`);
      }

      setPersistStatus("saved");
      setActiveSessionId("");
    } catch (persistError) {
      setPersistStatus("save_error");
      setError(persistError instanceof Error ? persistError.message : "无法结束练习会话");
    }
  }

  return (
    <section id="midi-panel" className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">MIDI 连接状态 {connectedInputId && <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">已连接</span>}</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-300 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 transition-colors"
            title={isCollapsed ? "展开配置" : "收起配置"}
          >
            {isCollapsed ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6"/></svg>
            )}
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <div className="mt-4 space-y-4">

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs text-zinc-500">浏览器设备访问权限</p>
            <p className={`mt-1 text-sm font-medium ${permissionColor}`}>{permissionLabel}</p>
          </div>
          {status === "ready" && <div className="h-2 w-2 rounded-full bg-emerald-500"></div>}
          {status === "blocked" && <div className="h-2 w-2 rounded-full bg-rose-500"></div>}
        </div>
        
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs text-zinc-500">外接 MIDI 设备状态</p>
            <p className={`mt-1 text-sm font-medium ${deviceStatusColor}`}>{deviceStatusLabel}</p>
          </div>
          {connectedInputId && <div className="h-2 w-2 rounded-full bg-emerald-500"></div>}
        </div>
      </div>

      {status === "unsupported" ? (
        <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <p className="font-medium">当前环境无法启用 Web MIDI。</p>
          <p className="mt-1">{effectiveReason ?? "请切换到 PC Chrome，并通过 localhost 或 HTTPS 打开页面。"}</p>
        </div>
      ) : null}

      {status === "blocked" ? (
        <div className="mt-4 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          <p className="font-medium">MIDI 权限被拒绝。</p>
          <p className="mt-1">处理步骤：1) 地址栏站点设置允许 MIDI；2) 刷新页面；3) 重新点击“检测 MIDI 设备”。</p>
        </div>
      ) : null}



      <div className="mt-5 grid gap-3 sm:grid-cols-[auto_1fr_auto_auto] items-center">
        <button
          type="button"
          onClick={requestMidiAccess}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-100 disabled:opacity-60"
          disabled={status === "checking"}
        >
          {status === "checking" ? "检测中..." : "检测 MIDI 设备"}
        </button>

        <select
          value={selectedInputId}
          onChange={(event) => setSelectedInputId(event.target.value)}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-emerald-300/60 focus:ring-2"
          disabled={inputs.length === 0 || status === "unsupported"}
        >
          {inputs.length === 0 ? (
            <option value="">暂无设备</option>
          ) : (
            inputs.map((input) => (
              <option key={input.id} value={input.id}>
                {input.name} · {input.manufacturer}
              </option>
            ))
          )}
        </select>

        <button
          type="button"
          onClick={connectInput}
          disabled={!selectedInputId || status === "unsupported" || status === "blocked"}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
        >
          连接
        </button>

        <button
          type="button"
          onClick={disconnectInput}
          disabled={!connectedInputId}
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-100 disabled:opacity-60"
        >
          断开
        </button>
      </div>

      {error ? <p className="mt-4 rounded-lg bg-rose-100 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

      <div className="mt-4 grid gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 sm:grid-cols-4">
        <div>
          <p className="text-xs text-zinc-500">写库状态</p>
          <p className="mt-1 text-sm font-medium">{persistStatus}</p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">MIDI 总事件</p>
          <p className="mt-1 text-sm font-medium">{midiCounters.midiEventCount}</p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">Note On</p>
          <p className="mt-1 text-sm font-medium">{midiCounters.noteOnCount}</p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">Note Off</p>
          <p className="mt-1 text-sm font-medium">{midiCounters.noteOffCount}</p>
        </div>
      </div>

      <p className="mt-3 text-xs text-zinc-500">当前写库变体：{variantId}</p>
      {practiceMetrics ? (
        <div className="mt-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
          <p>
            判定统计：Perfect {practiceMetrics.perfectCount} / Good {practiceMetrics.goodCount} / Wrong{" "}
            {practiceMetrics.wrongCount} / Miss {practiceMetrics.missCount}
          </p>
          <p className="mt-1">
            预计写入分数：{practiceMetrics.score}，右手 {practiceMetrics.rightAccuracyPct}% ，左手 {practiceMetrics.leftAccuracyPct}%
          </p>
        </div>
      ) : null}

      <div className="mt-4 flex gap-3">
        <button
          type="button"
          onClick={startRecording}
          disabled={persistStatus === "starting" || persistStatus === "recording" || (!connectedInputId && !keyboardSimulationEnabled)}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60"
        >
          {persistStatus === "starting" ? "创建中..." : "开始写库"}
        </button>
        <button
          type="button"
          onClick={endRecording}
          disabled={persistStatus !== "recording"}
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-100 disabled:opacity-60"
        >
          {persistStatus === "ending" ? "结束中..." : "结束并保存"}
        </button>
      </div>

      <p className="mt-4 text-sm text-zinc-600">
        {lastEvent
          ? `最近消息：${lastEvent.label} · ${new Date(lastEvent.at).toLocaleTimeString("zh-CN", {
              hour12: false,
            })}`
          : "尚未收到 MIDI 消息。"}
      </p>
        </div>
      )}
    </section>
  );
}
