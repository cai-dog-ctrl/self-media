import crypto from "node:crypto";
import { defineConfig, loadEnv, type Connect, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";

// Node < 19 无全局 webcrypto，而 msedge-tts 运行期依赖 globalThis.crypto
if (!globalThis.crypto) {
  (globalThis as unknown as { crypto: Crypto }).crypto = crypto.webcrypto;
}

/**
 * 语音解说本地代理（仅 dev server 生效），双引擎：
 * - edge：微软 Edge 朗读接口（免费、免密钥、神经语音音色），经 WebSocket 合成
 * - tencent：腾讯云语音合成（TC3 签名，密钥存于 .env.local，不进前端代码）
 * 前端 POST /api/tts { engine, text, voice } → 返回 mp3 二进制。
 */

/* ---------------- Edge TTS ---------------- */

async function callEdgeTts(text: string, voice: string): Promise<Buffer> {
  const tts = new MsEdgeTTS();
  try {
    await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
    const { audioStream } = tts.toStream(text.slice(0, 300));
    const chunks: Buffer[] = [];
    for await (const c of audioStream) chunks.push(c as Buffer);
    const audio = Buffer.concat(chunks);
    if (audio.length === 0) throw new Error("Edge TTS 无音频返回");
    return audio;
  } finally {
    tts.close();
  }
}

/* ---------------- 腾讯云 TTS（TC3 签名） ---------------- */

interface TencentTtsConfig {
  secretId: string;
  secretKey: string;
  region: string;
}

async function callTencentTts(
  cfg: TencentTtsConfig,
  text: string,
  voiceType: number
): Promise<Buffer> {
  const host = "tts.tencentcloudapi.com";
  const service = "tts";
  const action = "TextToVoice";
  const version = "2019-08-23";
  const timestamp = Math.floor(Date.now() / 1000);
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10);

  // 基础合成单次上限 150 字符，超出截断（前端文案均远低于此）
  const clipped = text.slice(0, 150);
  const payload = JSON.stringify({
    Text: clipped,
    SessionId: `war3d-${timestamp}`,
    Volume: 0,
    Speed: 0,
    VoiceType: voiceType,
    Codec: "mp3",
    SampleRate: 16000,
  });

  // 组装 TC3 签名
  const contentType = "application/json; charset=utf-8";
  const canonicalHeaders =
    `content-type:${contentType}\nhost:${host}\nx-tc-action:${action.toLowerCase()}\n`;
  const signedHeaders = "content-type;host;x-tc-action";
  const hashedPayload = crypto.createHash("sha256").update(payload).digest("hex");
  const canonicalRequest = [
    "POST",
    "/",
    "",
    canonicalHeaders,
    signedHeaders,
    hashedPayload,
  ].join("\n");
  const credentialScope = `${date}/${service}/tc3_request`;
  const hashedCanonicalRequest = crypto
    .createHash("sha256")
    .update(canonicalRequest)
    .digest("hex");
  const stringToSign = [
    "TC3-HMAC-SHA256",
    String(timestamp),
    credentialScope,
    hashedCanonicalRequest,
  ].join("\n");

  const kDate = crypto.createHmac("sha256", "TC3" + cfg.secretKey).update(date).digest();
  const kService = crypto.createHmac("sha256", kDate).update(service).digest();
  const kSigning = crypto.createHmac("sha256", kService).update("tc3_request").digest();
  const signature = crypto
    .createHmac("sha256", kSigning)
    .update(stringToSign)
    .digest("hex");
  const authorization =
    `TC3-HMAC-SHA256 Credential=${cfg.secretId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const resp = await fetch(`https://${host}`, {
    method: "POST",
    headers: {
      "Content-Type": contentType,
      Authorization: authorization,
      "X-TC-Action": action,
      "X-TC-Timestamp": String(timestamp),
      "X-TC-Version": version,
      "X-TC-Region": cfg.region,
    },
    body: payload,
  });

  const data = (await resp.json()) as {
    Response?: { Audio?: string; Error?: { Code?: string; Message?: string } };
  };
  if (data.Response?.Error || !data.Response?.Audio) {
    const err = data.Response?.Error;
    throw new Error(`腾讯云 TTS 失败: ${err?.Code ?? resp.status} ${err?.Message ?? "无音频返回"}`);
  }
  return Buffer.from(data.Response.Audio, "base64");
}

/* ---------------- 中间件 ---------------- */

function ttsProxyPlugin(tencent: TencentTtsConfig | null): Plugin {
  return {
    name: "tts-proxy",
    configureServer(server) {
      server.middlewares.use(
        "/api/tts",
        (req: Connect.IncomingMessage, res: Connect.ServerResponse) => {
          void (async () => {
            try {
              const chunks: Buffer[] = [];
              for await (const chunk of req) chunks.push(chunk as Buffer);
              const { engine, text, voice } = JSON.parse(
                Buffer.concat(chunks).toString("utf8")
              ) as { engine?: string; text?: string; voice?: string | number };
              if (typeof text !== "string" || !text) throw new Error("缺少 text");

              let audio: Buffer;
              if (engine === "edge") {
                audio = await callEdgeTts(
                  text,
                  typeof voice === "string" && voice ? voice : "zh-CN-YunxiNeural"
                );
              } else {
                if (!tencent) {
                  throw new Error("腾讯云语音未配置密钥（参考 .env.example）");
                }
                audio = await callTencentTts(
                  tencent,
                  text,
                  typeof voice === "number" ? voice : 111
                );
              }

              res.writeHead(200, {
                "Content-Type": "audio/mpeg",
                "Content-Length": audio.length,
              });
              res.end(audio);
            } catch (e) {
              const message = e instanceof Error ? e.message : String(e);
              console.warn("[tts]", message);
              res.writeHead(502, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: message }));
            }
          })();
        }
      );
    },
  };
}

export default defineConfig(({ mode, command }) => {
  // 读取 .env.local 中的腾讯云密钥（不进入前端代码）
  const env = loadEnv(mode, process.cwd(), "");
  const secretId = env.TENCENT_TTS_SECRET_ID;
  const secretKey = env.TENCENT_TTS_SECRET_KEY;
  const region = env.TENCENT_TTS_REGION || "ap-shanghai";
  const tencentReady = command === "serve" && Boolean(secretId && secretKey);

  if (command === "serve" && !secretId) {
    console.warn(
      "[tts] 未配置 TENCENT_TTS_SECRET_ID（参考 .env.example），腾讯云引擎不可用；Edge 引擎免配置可用"
    );
  }

  return {
    plugins: [
      react(),
      ttsProxyPlugin(
        secretId && secretKey ? { secretId, secretKey, region } : null
      ),
    ],
    define: {
      // 前端仅感知各引擎是否可用，不接触密钥
      __TTS_EDGE__: JSON.stringify(command === "serve"),
      __TTS_TENCENT__: JSON.stringify(tencentReady),
    },
    server: {
      host: true,
      port: 5173,
    },
    // maplibre-gl v6 通过 import.meta.url 创建 module worker，
    // 被 Vite 预打包后 worker URL 解析会失败（"Worker failed to load"），必须排除
    optimizeDeps: {
      exclude: ["maplibre-gl"],
    },
  };
});
