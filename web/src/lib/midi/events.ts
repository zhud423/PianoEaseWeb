export const PIANOEASE_MIDI_EVENT = "pianoease:midi-message";
export const PIANOEASE_MIDI_STATUS_EVENT = "pianoease:midi-status";

export type PianoEaseMidiEventType = "note_on" | "note_off" | "other";
export type PianoEaseMidiInputSource = "device" | "keyboard";
export type PianoEaseMidiSupportStatus = "idle" | "checking" | "ready" | "unsupported" | "blocked" | "error";

export type PianoEaseMidiEventDetail = {
  type: PianoEaseMidiEventType;
  note: number;
  velocity: number;
  at: number;
  source: PianoEaseMidiInputSource;
};

export type PianoEaseMidiStatusDetail = {
  status: PianoEaseMidiSupportStatus;
  connected: boolean;
  connectedInputName: string | null;
  availableInputCount: number;
  keyboardSimulationEnabled: boolean;
  reason: string | null;
  updatedAt: number;
};
