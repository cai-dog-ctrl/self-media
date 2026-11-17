import { create } from "zustand";

interface PlaybackState {
  /** 时间轴当前时刻（单位：日） */
  time: number;
  playing: boolean;
  speed: number;
  freeCamera: boolean;
  duration: number;
  /** 1x 速度下每秒推进的「日」数（由剧本设定，默认 4） */
  pace: number;
  /** 语音播报进行中自动暂停的推演（播报结束后自动恢复） */
  narrationHold: boolean;
  setDuration: (d: number) => void;
  setPace: (p: number) => void;
  setNarrationHold: (b: boolean) => void;
  togglePlay: () => void;
  setSpeed: (s: number) => void;
  setTime: (t: number) => void;
  advance: (dt: number) => void;
  toggleCamera: () => void;
  restart: () => void;
}

/** 默认时间流速：1x 时每秒推进 4 个"日" */
const DEFAULT_PACE = 4;

export const usePlayback = create<PlaybackState>((set, get) => ({
  time: 0,
  playing: true,
  speed: 1,
  freeCamera: false,
  duration: 180,
  pace: DEFAULT_PACE,
  narrationHold: false,
  setDuration: (d) => set({ duration: d }),
  setPace: (p) => set({ pace: p }),
  setNarrationHold: (b) => set({ narrationHold: b }),
  togglePlay: () =>
    set({ playing: !get().playing, narrationHold: false }),
  setSpeed: (s) => set({ speed: s }),
  setTime: (t) =>
    set({ time: Math.max(0, Math.min(get().duration, t)), narrationHold: false }),
  advance: (dt) => {
    const { time, speed, duration, pace } = get();
    const next = time + dt * speed * pace;
    if (next >= duration) {
      set({ time: duration, playing: false, narrationHold: false });
    } else {
      set({ time: next });
    }
  },
  toggleCamera: () => set({ freeCamera: !get().freeCamera }),
  restart: () => set({ time: 0, playing: true, narrationHold: false }),
}));
