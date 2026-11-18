/// <reference types="vite/client" />

/** 由 vite.config.ts define 注入：Edge 语音引擎是否可用（仅 dev server） */
declare const __TTS_EDGE__: boolean;

/** 由 vite.config.ts define 注入：腾讯云语音引擎是否已配置密钥（仅 dev server） */
declare const __TTS_TENCENT__: boolean;
