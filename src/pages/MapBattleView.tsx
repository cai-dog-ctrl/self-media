import { useEffect, useRef, useState } from "react";
import { Map as MlMap, Marker as MlMarker, setWorkerUrl } from "maplibre-gl";
import type { GeoJSONSource, Marker } from "maplibre-gl";
// 以资产形式引入 worker，经 setWorkerUrl 显式指定：
// 生产构建下 Rollup 会将其正确产出为 hash 资产文件，避免运行时 URL 落空
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import "maplibre-gl/dist/maplibre-gl.css";
import type { GeoBattleScript, GeoUnit, PhaseEvent } from "../engine/types";
import { geoUnitPositionAt, traveledPath } from "../engine/geo";
import { usePlayback } from "../engine/playback";
import { loadTtsSettings, saveTtsSettings, speakWithCloud, type TtsSettings } from "../engine/voice";
import MapHud from "./MapHud";

/**
 * 底图配置（实测可达性后按国内网络优先排序）。
 * - amap：高德街道图，中文地名、国内最快；注意其为 GCJ-02 坐标，
 *   与 WGS84 单位坐标存在数百米级偏移，在战役推演尺度下可忽略。
 *   通过 raster 图层压饱和度/亮度，使其贴合暗色 UI。
 * - osm：WGS84 无偏移，英文地名。
 */
const BASEMAPS = {
  amap: {
    tiles: [
      "https://webrd01.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=7&x={x}&y={y}&z={z}",
      "https://webrd02.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=7&x={x}&y={y}&z={z}",
      "https://webrd03.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=7&x={x}&y={y}&z={z}",
      "https://webrd04.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=7&x={x}&y={y}&z={z}",
    ],
    attribution: "底图 © 高德地图",
    maxzoom: 17,
    /** 让彩色底图变得低饱和、偏灰，贴近军事态势图观感 */
    paint: {
      "raster-saturation": -0.85,
      "raster-contrast": 0.15,
      "raster-brightness-max": 0.85,
    },
  },
  osm: {
    tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
    attribution: "© OpenStreetMap contributors",
    maxzoom: 18,
    paint: {},
  },
} as const;

const BASEMAP = BASEMAPS.amap;

// 必须在任何 Map 实例创建之前调用
setWorkerUrl(maplibreWorkerUrl);

const countEventsLE = (events: PhaseEvent[], time: number): number => {
  let n = 0;
  while (n < events.length && events[n].t <= time) n++;
  return n;
};

const smoothstep = (p: number): number => p * p * (3 - 2 * p);
const lerp = (a: number, b: number, p: number): number => a + (b - a) * p;

/** 运镜插值：返回当前时刻的相机状态 */
function cameraAt(script: GeoBattleScript, time: number) {
  const kfs = script.camera;
  let i = 0;
  while (i < kfs.length - 1 && kfs[i + 1].t <= time) i++;
  const a = kfs[i];
  const b = kfs[Math.min(i + 1, kfs.length - 1)];
  let p = 1;
  if (b.t > a.t) p = Math.min(1, Math.max(0, (time - a.t) / (b.t - a.t)));
  p = smoothstep(p);
  return {
    center: [lerp(a.center[0], b.center[0], p), lerp(a.center[1], b.center[1], p)] as [
      number,
      number,
    ],
    zoom: lerp(a.zoom, b.zoom, p),
    bearing: lerp(a.bearing, b.bearing, p),
    pitch: lerp(a.pitch, b.pitch, p),
  };
}

/* ---------- 全局声音互斥：同一时刻只允许一个声音在播 ---------- */

let currentAudio: HTMLAudioElement | null = null;
/** 解说会话号：任何停声/重播都会让旧会话的异步回调全部作废 */
let narrationSession = 0;

/** 停掉当前正在播放的云端音频与系统语音，并作废所有在途解说回调 */
function stopCurrentAudio(): void {
  narrationSession += 1;
  if (currentAudio) {
    try {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    } catch {
      // 忽略已失效的音频元素
    }
    currentAudio = null;
  }
  window.speechSynthesis?.cancel();
}

/**
 * 语音播报一条战况。
 * 优先云端神经语音（经 dev 代理）；未配置/失败时回退系统语音。
 * 超时兜底采用「心跳续期」：音频/朗读只要还在推进就不断续期看门狗，
 * 只有真正卡死（长时间无进展）才恢复推演——保证每条内容读完整才进行下一步。
 * 开始前会先停掉上一个声音，保证任意时刻只有一个声音在播。
 */
function speakEvent(
  ev: PhaseEvent,
  settings: TtsSettings,
  onEnd: () => void,
  onBlocked: () => void
): void {
  // 先停掉可能还在播的旧声音（会推进会话号），再接管为新会话
  stopCurrentAudio();

  let done = false;
  let usedSystem = false;
  let timer = 0;
  let ownAudio: HTMLAudioElement | null = null;
  const text = `${ev.title}。${ev.detail}`;
  /** 本条解说所属会话；会话被更新（停声/重播/跳转）后，本条的残余回调一律作废 */
  const session = ++narrationSession;
  const stale = (): boolean => session !== narrationSession;

  /** 音频活跃心跳窗口：播放中事件频繁触发，超过该时长无动静视为卡死 */
  const ALIVE_WINDOW = 6000;

  const stopOwn = (): void => {
    if (ownAudio) {
      try {
        ownAudio.pause();
      } catch {
        // 忽略
      }
      ownAudio = null;
    }
  };

  const finish = (): void => {
    if (done || stale()) return;
    done = true;
    window.clearTimeout(timer);
    stopOwn();
    window.speechSynthesis?.cancel();
    onEnd();
  };
  const armWatchdog = (ms: number): void => {
    window.clearTimeout(timer);
    timer = window.setTimeout(finish, ms);
  };

  const fallbackSystem = (): void => {
    if (done || stale()) return;
    usedSystem = true;
    stopOwn();
    const synth = window.speechSynthesis;
    if (!synth) {
      finish();
      return;
    }
    synth.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "zh-CN";
    utter.rate = 1;
    const zh = synth.getVoices().find((v) => v.lang.toLowerCase().startsWith("zh"));
    if (zh) utter.voice = zh;
    utter.onend = finish;
    utter.onerror = finish;
    // 真正开始朗读后再按宽裕估算续期；朗读中按字界心跳续期
    utter.onstart = () => armWatchdog(10000 + text.length * 400);
    utter.onboundary = () => armWatchdog(ALIVE_WINDOW * 2);
    synth.speak(utter);
    // 4 秒内还没真正开口（被策略/系统静默拦截），快速恢复推演，避免长时间卡顿
    armWatchdog(4000);
  };

  // 合成请求兜底：15 秒还没拿到音频就改用系统语音
  armWatchdog(15000);
  speakWithCloud(text, settings)
    .then((audio) => {
      // 合成期间若有新播报/试听/拖动，会话号已变，本条直接作废（互斥由会话号保证）
      if (done || usedSystem || stale()) return;
      ownAudio = audio;
      currentAudio = audio;
      audio.onended = finish;
      audio.onerror = fallbackSystem;
      // 播放中有进展就持续续期：语音再慢也不会被掐断
      audio.ontimeupdate = () => armWatchdog(ALIVE_WINDOW);
      audio.play().catch((err: unknown) => {
        if ((err as { name?: string } | null)?.name === "NotAllowedError") {
          // 浏览器自动播放策略拦截（如刷新后无用户手势）：跳过本条并提示点击解锁
          onBlocked();
          finish();
          return;
        }
        fallbackSystem();
      });
      armWatchdog(ALIVE_WINDOW);
    })
    .catch(fallbackSystem);
}

const EMPTY_FC = { type: "FeatureCollection" as const, features: [] };

interface UnitMarkerHandle {
  marker: Marker;
  wrap: HTMLElement;
  arrow: SVGElement;
  post: SVGElement;
}

/** 单位在时刻 t 所在行军段的朝向与机动状态（段内恒定，暂停时也保持箭头） */
function unitMotionAt(u: GeoUnit, time: number): { moving: boolean; bearing: number } {
  const wps = u.waypoints;
  if (wps.length < 2) return { moving: false, bearing: 0 };
  const lastT = wps[wps.length - 1].t;
  if (time >= lastT) return { moving: false, bearing: 0 };
  let i = 0;
  while (i < wps.length - 1 && wps[i + 1].t <= time) i++;
  const a = wps[i];
  const b = wps[i + 1] ?? wps[i];
  const dLon = b.lon - a.lon;
  const dLat = b.lat - a.lat;
  if (Math.abs(dLon) < 1e-6 && Math.abs(dLat) < 1e-6) return { moving: false, bearing: 0 };
  return { moving: true, bearing: (Math.atan2(dLon, dLat) * 180) / Math.PI };
}

/**
 * 单位 DOM 标记：机动时显示朝向箭头（脉冲呼吸），驻守/被歼显示菱形据点；
 * 大小按兵力规模缩放。返回各部件引用供每帧更新朝向与状态。
 */
function makeUnitElement(
  color: string,
  label: string,
  scale: number,
  onClick: () => void
): { el: HTMLElement; wrap: HTMLElement; arrow: SVGElement; post: SVGElement } {
  const el = document.createElement("div");
  el.className = "unit-marker";
  el.style.scale = String(scale);

  const wrap = document.createElement("span");
  wrap.className = "unit-arrow-wrap";

  const arrow = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  arrow.setAttribute("class", "unit-arrow");
  arrow.setAttribute("viewBox", "0 0 22 22");
  arrow.innerHTML =
    `<path d="M11 1.5 L19.5 20 L11 15.5 L2.5 20 Z" fill="${color}" ` +
    `stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/>`;

  const post = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  post.setAttribute("class", "unit-post");
  post.setAttribute("viewBox", "0 0 22 22");
  post.innerHTML =
    `<rect x="5.5" y="5.5" width="11" height="11" rx="1.5" transform="rotate(45 11 11)" ` +
    `fill="${color}" stroke="#fff" stroke-width="1.6"/>`;

  wrap.appendChild(arrow);
  wrap.appendChild(post);

  const tag = document.createElement("span");
  tag.className = "unit-tag";
  tag.style.color = color;
  tag.textContent = label;

  el.appendChild(wrap);
  el.appendChild(tag);
  el.addEventListener("click", (e) => {
    e.stopPropagation();
    onClick();
  });
  return { el, wrap, arrow, post };
}

/** 流动虚线的相位序列（蚂蚁线），按此循环产生「向前行进」的动画 */
const DASH_SEQUENCE: Array<Array<number>> = [
  [0, 4, 1],
  [0.25, 4, 0.75],
  [0.5, 4, 0.5],
  [0.75, 4, 0.25],
  [1, 4, 0],
  [0, 0.25, 4, 0.75],
  [0, 0.5, 4, 0.5],
  [0, 0.75, 4, 0.25],
];

/** 沿线方向箭头图标（白色描边 + 势力色，指向行进方向） */
function makeChevronIcon(color: string): ImageData {
  const c = document.createElement("canvas");
  c.width = 24;
  c.height = 24;
  const ctx = c.getContext("2d")!;
  ctx.beginPath();
  ctx.moveTo(4, 6);
  ctx.lineTo(12, 18);
  ctx.lineTo(20, 6);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = 6;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
  ctx.stroke();
  ctx.lineWidth = 3.4;
  ctx.strokeStyle = color;
  ctx.stroke();
  return ctx.getImageData(0, 0, 24, 24);
}

export default function MapBattleView({ script }: { script: GeoBattleScript }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const markersRef = useRef<Map<string, UnitMarkerHandle>>(new Map());
  const [ready, setReady] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [needsAudioGesture, setNeedsAudioGesture] = useState(false);
  const [tts, setTts] = useState<TtsSettings>(() => loadTtsSettings());

  // 用户点击页面任意处后，浏览器恢复允许播放声音
  useEffect(() => {
    const clear = (): void => setNeedsAudioGesture(false);
    window.addEventListener("pointerdown", clear);
    return () => window.removeEventListener("pointerdown", clear);
  }, []);
  const freeCamera = usePlayback((s) => s.freeCamera);
  const voiceOnRef = useRef(voiceOn);
  voiceOnRef.current = voiceOn;
  const ttsRef = useRef(tts);
  ttsRef.current = tts;
  // 拖动/跳转进度时短暂禁止触发解说，避免连续触发导致叠音
  const scrubbingRef = useRef(false);
  const scrubTimerRef = useRef(0);
  const seekResumeRef = useRef(false);
  /** 解说暂停锁的起始时间，用于超时保险 */
  const holdSinceRef = useRef(0);

  /**
   * 用户拖动时间轴 / 点击阶段标签：
   * 掐断当前解说 → 暂停自动推进 → 跳转 → 松开 500ms 后按拖动前状态恢复播放。
   */
  const handleSeek = (t: number): void => {
    const st = usePlayback.getState();
    const wasHold = st.narrationHold;
    if (!scrubbingRef.current) {
      // 拖动开始：记住此前是否在推进（含解说暂停态），期间保持暂停
      seekResumeRef.current = st.playing || wasHold;
      if (st.playing) usePlayback.setState({ playing: false });
    }
    scrubbingRef.current = true;
    window.clearTimeout(scrubTimerRef.current);
    scrubTimerRef.current = window.setTimeout(() => {
      scrubbingRef.current = false;
      if (seekResumeRef.current) {
        usePlayback.setState({ playing: true, narrationHold: false });
      }
      seekResumeRef.current = false;
    }, 500);
    stopCurrentAudio();
    st.setTime(t);
  };

  const handleTtsChange = (next: TtsSettings): void => {
    setTts(next);
    saveTtsSettings(next);
  };

  /** 重播：先作废旧解说（含其残余回调），再回到开场 */
  const handleRestart = (): void => {
    stopCurrentAudio();
    usePlayback.getState().restart();
  };

  /** 解说播报中点「暂停」：停止解说并保持暂停（不恢复播放） */
  const handleStopNarration = (): void => {
    stopCurrentAudio();
    usePlayback.setState({ narrationHold: false, playing: false });
  };

  /** 试听当前语音配置（先停掉正在播的解说，避免叠音） */
  const previewVoice = (): void => {
    const text = "淮海战役，作战态势推演。语音解说就绪。";
    // 若解说进行中：切断当前解说并恢复推演，试听成为唯一声音
    if (usePlayback.getState().narrationHold) {
      usePlayback.setState({ narrationHold: false, playing: true });
    }
    stopCurrentAudio();
    speakWithCloud(text, ttsRef.current)
      .then((audio) => {
        // fetch 期间可能又有新的试听/解说开始，播放前再次互斥
        stopCurrentAudio();
        currentAudio = audio;
        audio.play().catch((err: unknown) => {
          if ((err as { name?: string } | null)?.name === "NotAllowedError") {
            setNeedsAudioGesture(true);
          }
        });
      })
      .catch(() => {
        const synth = window.speechSynthesis;
        if (synth) {
          const utter = new SpeechSynthesisUtterance(text);
          utter.lang = "zh-CN";
          synth.speak(utter);
        }
      });
  };

  // 初始化地图与图层
  useEffect(() => {
    if (!containerRef.current) return;
    const map = new MlMap({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          basemap: {
            type: "raster",
            tiles: [...BASEMAP.tiles],
            tileSize: 256,
            attribution: BASEMAP.attribution,
            maxzoom: BASEMAP.maxzoom,
          },
        },
        layers: [
          { id: "basemap", type: "raster", source: "basemap", paint: { ...BASEMAP.paint } },
        ],
      },
      center: script.view.center,
      zoom: script.view.zoom,
      bearing: script.view.bearing,
      pitch: script.view.pitch,
      maxZoom: 13,
    });
    mapRef.current = map;
    // 调试句柄：控制台可直接访问地图实例与播放状态
    (window as unknown as Record<string, unknown>).__warMap = map;
    (window as unknown as Record<string, unknown>).__warPlayback = usePlayback;

    map.on("load", () => {
      // 计划路线：当前位置之后的剩余路径（淡虚线，预示调动方向）
      map.addSource("plans", { type: "geojson", data: EMPTY_FC });
      map.addLayer({
        id: "plan-line",
        type: "line",
        source: "plans",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": ["get", "color"],
          "line-width": 1.6,
          "line-opacity": 0.32,
          "line-dasharray": [0.5, 2.2],
        },
      });
      // 行军线：已走过的路径
      map.addSource("marches", { type: "geojson", data: EMPTY_FC });
      // 底线（弱化）
      map.addLayer({
        id: "march-line",
        type: "line",
        source: "marches",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": ["get", "color"],
          "line-width": 3,
          "line-opacity": 0.4,
        },
      });
      // 流动虚线（蚂蚁线动画，方向即行进方向）
      map.addLayer({
        id: "march-flow",
        type: "line",
        source: "marches",
        paint: {
          "line-color": ["get", "color"],
          "line-width": 2.4,
          "line-opacity": 0.95,
          "line-dasharray": DASH_SEQUENCE[0],
        },
      });
      // 沿途方向箭头
      for (const [key, f] of Object.entries(script.factions)) {
        map.addImage(`chev-${key}`, makeChevronIcon(f.color));
      }
      map.addLayer({
        id: "march-arrow",
        type: "symbol",
        source: "marches",
        layout: {
          "symbol-placement": "line",
          "symbol-spacing": 42,
          "icon-image": ["concat", "chev-", ["get", "faction"]],
          "icon-rotation-alignment": "map",
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
          "icon-size": 0.7,
        },
      });
      // 交战特效：扩散环
      map.addSource("clashes", { type: "geojson", data: EMPTY_FC });
      map.addLayer({
        id: "clash-ring",
        type: "circle",
        source: "clashes",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["get", "progress"], 0, 4, 1, 26],
          "circle-color": "#e8b04b",
          "circle-opacity": ["interpolate", ["linear"], ["get", "progress"], 0, 0.55, 1, 0],
          "circle-stroke-color": "#e8b04b",
          "circle-stroke-width": 2,
          "circle-stroke-opacity": [
            "interpolate",
            ["linear"],
            ["get", "progress"],
            0,
            0.95,
            1,
            0,
          ],
        },
      });

      // 单位 DOM 标记（中文标签无需 glyph 服务），可点击查看详情
      markersRef.current.forEach((h) => h.marker.remove());
      markersRef.current.clear();
      for (const u of script.units) {
        const color = script.factions[u.faction].color;
        const parts = makeUnitElement(
          color,
          u.label,
          0.75 + u.size * 0.55,
          () => setSelectedUnitId(u.id)
        );
        const marker = new MlMarker({ element: parts.el });
        marker.setLngLat(geoUnitPositionAt(u, 0));
        marker.addTo(map);
        markersRef.current.set(u.id, {
          marker,
          wrap: parts.wrap,
          arrow: parts.arrow,
          post: parts.post,
        });
      }
      setReady(true);
    });

    return () => {
      markersRef.current.forEach((h) => h.marker.remove());
      markersRef.current.clear();
      map.remove();
      mapRef.current = null;
      setReady(false);
      stopCurrentAudio();
    };
  }, [script]);

  // 选中高亮
  useEffect(() => {
    if (!ready) return;
    markersRef.current.forEach((h, id) => {
      h.marker.getElement().classList.toggle("selected", id === selectedUnitId);
    });
  }, [selectedUnitId, ready]);

  // 自由视角开关：切换地图交互
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const handlers = [
      "scrollZoom",
      "boxZoom",
      "dragRotate",
      "dragPan",
      "keyboard",
      "doubleClickZoom",
      "touchZoomRotate",
    ] as const;
    for (const h of handlers) {
      if (freeCamera) map[h].enable();
      else map[h].disable();
    }
  }, [freeCamera, ready]);

  // 时间驱动：推进时间轴 → 语音播报 + 单位/行军线/交战环更新 + 运镜
  useEffect(() => {
    if (!ready) return;
    const map = mapRef.current;
    if (!map) return;

    const { restart, setDuration, setPace, setNarrationHold } = usePlayback.getState();
    setPace(script.pace ?? 4);
    setNarrationHold(false);
    restart();
    setDuration(script.duration);
    // 进入后默认暂停，由用户手动点「自动推演」开始
    usePlayback.setState({ playing: false });

    // 每次进入 / 刷新都从头播放（清掉历史保存的播放位置）
    window.sessionStorage.removeItem(`war3d.pos.${script.id}`);

    const spoken = { index: -1 };
    let flowAcc = 0;
    let flowStep = 0;

    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      // rAF 时间戳偶尔早于上一帧记录，钳到非负；上限放宽到 1.5s，
      // 保证定时器兜底（窗口遮挡/后台时 rAF 被浏览器暂停）也能按真实时间推进
      const dt = Math.max(0, Math.min(1.5, (now - last) / 1000));
      last = now;
      const s = usePlayback.getState();
      if (s.playing) s.advance(dt);

      // 解说锁超时保险：异常环境下音频回调可能永不触发，
      // 超过 90 秒仍锁着就强制恢复推演，避免"永远停住"
      if (s.narrationHold && !s.playing) {
        if (holdSinceRef.current === 0) {
          holdSinceRef.current = performance.now();
        } else if (performance.now() - holdSinceRef.current > 90000) {
          usePlayback.setState({ narrationHold: false, playing: true });
          holdSinceRef.current = 0;
        }
      } else {
        holdSinceRef.current = 0;
      }

      // 流动虚线相位推进（暂停时冻结）
      if (s.playing) {
        flowAcc += dt;
        if (flowAcc >= 0.1) {
          flowAcc = 0;
          flowStep = (flowStep + 1) % DASH_SEQUENCE.length;
          map.setPaintProperty("march-flow", "line-dasharray", DASH_SEQUENCE[flowStep]);
        }
      }

      // 事件语音播报：前进越过新事件时播报并自动暂停推演；回拖时静默重置
      const idx = countEventsLE(script.events, s.time);
      if (idx < spoken.index) {
        stopCurrentAudio();
        setNarrationHold(false);
        // 重播/循环/拖回开场时允许重新播报第一条解说；中途回拖则静默
        spoken.index = s.time <= 1 ? -1 : idx;
      } else if (
        idx > spoken.index &&
        voiceOnRef.current &&
        s.playing &&
        !s.narrationHold &&
        !scrubbingRef.current
      ) {
        const ev = script.events[Math.max(0, idx - 1)];
        usePlayback.setState({ playing: false, narrationHold: true });
        speakEvent(
          ev,
          ttsRef.current,
          () => {
            if (usePlayback.getState().narrationHold) {
              usePlayback.setState({ narrationHold: false, playing: true });
            }
          },
          () => setNeedsAudioGesture(true)
        );
        spoken.index = idx;
      } else if (idx > spoken.index && (!voiceOnRef.current || scrubbingRef.current)) {
        // 静音 / 拖动中：静默推进进度，避免之后恢复时补播积压
        spoken.index = idx;
      }
      // 注意：暂停状态（playing=false 且非静音/拖动）不推进 spoken.index，
      // 这样在 D+0 暂停后点播放，会从头播报第一条解说

      // 单位位置、可见性、朝向与机动状态
      for (const u of script.units) {
        const h = markersRef.current.get(u.id);
        if (!h) continue;
        const visible = u.appearAfter === undefined || s.time >= u.appearAfter;
        const el = h.marker.getElement();
        el.style.display = visible ? "" : "none";
        if (!visible) continue;
        h.marker.setLngLat(geoUnitPositionAt(u, s.time));
        const { moving, bearing } = unitMotionAt(u, s.time);
        if (moving) {
          // 箭头随地图朝向补偿，标签始终保持水平
          const eff = bearing - map.getBearing();
          h.wrap.style.transform = `rotate(${eff}deg)`;
        }
        h.arrow.style.display = moving ? "" : "none";
        h.post.style.display = moving ? "none" : "";
      }

      // 计划路线（当前位置 → 剩余路径点）
      const plans = map.getSource("plans") as GeoJSONSource | undefined;
      if (plans) {
        plans.setData({
          type: "FeatureCollection",
          features: script.units
            .filter((u) => u.appearAfter === undefined || s.time >= u.appearAfter)
            .map((u) => {
              const cur = geoUnitPositionAt(u, s.time);
              const pts: Array<[number, number]> = [
                [cur[0], cur[1]],
                ...u.waypoints
                  .filter((w) => w.t > s.time)
                  .map((w) => [w.lon, w.lat] as [number, number]),
              ];
              if (pts.length < 2) return null;
              return {
                type: "Feature" as const,
                geometry: { type: "LineString" as const, coordinates: pts },
                properties: { id: u.id, color: script.factions[u.faction].color },
              };
            })
            .filter((f): f is NonNullable<typeof f> => f !== null),
        });
      }

      // 已走过的行军线
      const marches = map.getSource("marches") as GeoJSONSource | undefined;
      if (marches) {
        marches.setData({
          type: "FeatureCollection",
          features: script.units
            .filter((u) => u.appearAfter === undefined || s.time >= u.appearAfter)
            .filter((u) => traveledPath(u, s.time).length >= 2)
            .map((u) => ({
              type: "Feature" as const,
              geometry: { type: "LineString" as const, coordinates: traveledPath(u, s.time) },
              properties: {
                id: u.id,
                color: script.factions[u.faction].color,
                faction: u.faction,
              },
            })),
        });
      }

      // 交战扩散环
      const clashes = map.getSource("clashes") as GeoJSONSource | undefined;
      if (clashes) {
        clashes.setData({
          type: "FeatureCollection",
          features: script.clashes
            .map((c) => ({ c, p: (s.time - c.t) / 8 }))
            .filter(({ p }) => p >= 0 && p <= 1)
            .map(({ c, p }) => ({
              type: "Feature" as const,
              geometry: { type: "Point" as const, coordinates: [c.lon, c.lat] },
              properties: { id: c.label, progress: p },
            })),
        });
      }

      // 剧情运镜
      if (!s.freeCamera) {
        map.jumpTo(cameraAt(script, s.time));
      }

    };

    // 主循环走 rAF（流畅）；窗口被遮挡或切到后台时浏览器会暂停 rAF，
    // 用心跳定时器兜底，保证推演始终按真实时间推进（录屏时尤其关键）
    const loop = (now: number): void => {
      tick(now);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const heartbeat = window.setInterval(() => {
      if (performance.now() - last > 400) tick(performance.now());
    }, 250);

    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(heartbeat);
    };
  }, [ready, script]);

  const toggleVoice = (): void => {
    setVoiceOn((v) => {
      const next = !v;
      if (!next) {
        stopCurrentAudio();
        if (usePlayback.getState().narrationHold) {
          usePlayback.setState({ narrationHold: false, playing: true });
        }
      }
      return next;
    });
  };

  return (
    <div className="app map-app">
      <div ref={containerRef} className="map-container" />
      <MapHud
        script={script}
        voiceOn={voiceOn}
        onToggleVoice={toggleVoice}
        selectedUnitId={selectedUnitId}
        onSelectUnit={setSelectedUnitId}
        tts={tts}
        onTtsChange={handleTtsChange}
        onPreviewVoice={previewVoice}
        onSeek={handleSeek}
        onRestart={handleRestart}
        onStopNarration={handleStopNarration}
        needsAudioGesture={needsAudioGesture}
      />
    </div>
  );
}
