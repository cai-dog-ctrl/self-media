/**
 * 语音解说引擎：系统语音（Web Speech API）+ 双云端引擎。
 * - edge：微软 Edge 朗读接口（免费、免密钥、神经语音），默认引擎
 * - tencent：腾讯云语音合成（需 .env.local 配置密钥）
 * 云端请求统一走 dev 中间件 /api/tts，前端不接触任何密钥；
 * 未配置或失败时自动回退系统语音。
 */

export type TtsEngine = "system" | "edge" | "tencent";

export interface TtsSettings {
  engine: TtsEngine;
  edgeVoice: string;
  tencentVoice: number;
}

const STORAGE_KEY = "war3d.tts.v1";

const DEFAULT_SETTINGS: TtsSettings = {
  engine: "edge",
  edgeVoice: "zh-CN-YunxiNeural",
  tencentVoice: 111,
};

/** Edge 神经语音音色（zh-CN） */
export const EDGE_VOICES: Array<{ id: string; label: string }> = [
  { id: "zh-CN-YunxiNeural", label: "云希 · 沉稳叙事（男）" },
  { id: "zh-CN-YunyangNeural", label: "云扬 · 新闻解说（男）" },
  { id: "zh-CN-YunjianNeural", label: "云健 · 浑厚磁性（男）" },
  { id: "zh-CN-XiaoxiaoNeural", label: "晓晓 · 温暖亲和（女）" },
  { id: "zh-CN-XiaoyiNeural", label: "晓伊 · 清亮利落（女）" },
];

/** 腾讯云音色列表（基础语音合成，zh-CN） */
export const TENCENT_VOICES: Array<{ id: number; label: string }> = [
  { id: 111, label: "智燕 · 新闻解说（女）" },
  { id: 110, label: "智华 · 通用男声" },
  { id: 104, label: "智云 · 通用男声" },
  { id: 101, label: "智瑜 · 情感女声" },
  { id: 109, label: "智芸 · 知性女声" },
  { id: 106, label: "智言 · 助手女声" },
];

export function loadTtsSettings(): TtsSettings {
  let stored: Partial<TtsSettings> = {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) stored = JSON.parse(raw) as Partial<TtsSettings>;
  } catch {
    // 忽略损坏的本地存储
  }
  const merged: TtsSettings = { ...DEFAULT_SETTINGS, ...stored };
  // 兼容历史版本与脏数据
  if (merged.engine !== "system" && merged.engine !== "edge" && merged.engine !== "tencent") {
    merged.engine = "system";
  }
  return merged;
}

export function saveTtsSettings(settings: TtsSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // 无痕模式等场景忽略
  }
}

/** 引擎当前是否可用（dev server 才有云端中间件） */
export function ttsEngineAvailable(engine: TtsEngine): boolean {
  if (engine === "edge") return __TTS_EDGE__;
  if (engine === "tencent") return __TTS_TENCENT__;
  return true;
}

/** 调用本地中间件合成云端语音，返回 mp3 ArrayBuffer */
export async function synthesizeCloud(
  text: string,
  engine: TtsEngine,
  voice: string
): Promise<ArrayBuffer> {
  const res = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ engine, text, voice }),
  });
  if (!res.ok) {
    throw new Error(`TTS 合成失败: HTTP ${res.status}`);
  }
  return res.arrayBuffer();
}

/** 合成并构建可播放的 Audio 元素（引擎不可用/失败时 reject，由调用方回退系统语音） */
export async function speakWithCloud(
  text: string,
  settings: TtsSettings
): Promise<HTMLAudioElement> {
  const engine = settings.engine;
  if (engine === "system" || !ttsEngineAvailable(engine)) {
    return Promise.reject(new Error("云端语音不可用"));
  }
  const voice = engine === "edge" ? settings.edgeVoice : String(settings.tencentVoice);
  const buffer = await synthesizeCloud(text, engine, voice);
  const blob = new Blob([buffer], { type: "audio/mpeg" });
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  audio.onended = () => URL.revokeObjectURL(url);
  return audio;
}
