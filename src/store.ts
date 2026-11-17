import { create } from "zustand";

interface PlaybackState {
  /** 时间轴当前时刻（单位：日） */
  time: number;
  playing: boolean;
  speed: number;
  freeCamera: boolean;
  duration: number;
  setDuration: (d: number) => void;
  togglePlay: () => void;
  setSpeed: (s: number) => void;
  setTime: (t: number) => void;
  advance: (dt: number) => void;
  toggleCamera: () => void;
  restart: () => void;
}

/** 时间流速：1x 时每秒推进 4 个"日" */
const DAYS_PER_SECOND = 4;

export const usePlayback = create<PlaybackState>((set, get) => ({
  time: 0,
  playing: true,
  speed: 1,
  freeCamera: false,
  duration: 180,
  setDuration: (d) => set({ duration: d }),
  togglePlay: () => set({ playing: !get().playing }),
  setSpeed: (s) => set({ speed: s }),
  setTime: (t) => set({ time: Math.max(0, Math.min(get().duration, t)) }),
  advance: (dt) => {
    const { time, speed, duration } = get();
    const next = time + dt * speed * DAYS_PER_SECOND;
    if (next >= duration) {
      set({ time: duration, playing: false });
    } else {
      set({ time: next });
    }
  },
  toggleCamera: () => set({ freeCamera: !get().freeCamera }),
  restart: () => set({ time: 0, playing: true }),
}));
