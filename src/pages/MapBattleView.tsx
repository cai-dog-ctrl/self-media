import { useEffect, useRef, useState } from "react";
import { Map as MlMap, Marker as MlMarker } from "maplibre-gl";
import type { GeoJSONSource, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { GeoBattleScript, PhaseEvent } from "../engine/types";
import { geoUnitPositionAt, traveledPath } from "../engine/geo";
import { usePlayback } from "../engine/playback";
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

/** 语音播报一条战况（Web Speech API，优先中文语音；无语音环境时按字数估算兜底恢复） */
function speakEvent(ev: PhaseEvent, onEnd: () => void): void {
  let done = false;
  let timer = 0;
  const finish = (): void => {
    if (done) return;
    done = true;
    window.clearTimeout(timer);
    onEnd();
  };
  const synth = window.speechSynthesis;
  if (!synth) {
    finish();
    return;
  }
  synth.cancel();
  const utter = new SpeechSynthesisUtterance(`${ev.title}。${ev.detail}`);
  utter.lang = "zh-CN";
  utter.rate = 1;
  const zh = synth.getVoices().find((v) => v.lang.toLowerCase().startsWith("zh"));
  if (zh) utter.voice = zh;
  utter.onend = finish;
  utter.onerror = finish;
  // 兜底：无音频后端/语音加载失败时，超时自动恢复推演
  timer = window.setTimeout(finish, 2500 + (ev.title.length + ev.detail.length) * 260);
  synth.speak(utter);
}

const EMPTY_FC = { type: "FeatureCollection" as const, features: [] };

function makeUnitElement(
  color: string,
  label: string,
  onClick: () => void
): HTMLElement {
  const el = document.createElement("div");
  el.className = "unit-marker";
  const pin = document.createElement("span");
  pin.className = "unit-pin";
  pin.style.background = color;
  pin.style.borderColor = color;
  const tag = document.createElement("span");
  tag.className = "unit-tag";
  tag.style.color = color;
  tag.textContent = label;
  el.appendChild(pin);
  el.appendChild(tag);
  el.addEventListener("click", (e) => {
    e.stopPropagation();
    onClick();
  });
  return el;
}

export default function MapBattleView({ script }: { script: GeoBattleScript }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const markersRef = useRef<Map<string, Marker>>(new Map());
  const [ready, setReady] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const freeCamera = usePlayback((s) => s.freeCamera);
  const voiceOnRef = useRef(voiceOn);
  voiceOnRef.current = voiceOn;

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

    map.on("load", () => {
      // 行军线：已走过的路径
      map.addSource("marches", { type: "geojson", data: EMPTY_FC });
      map.addLayer({
        id: "march-line",
        type: "line",
        source: "marches",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": ["get", "color"],
          "line-width": 3,
          "line-opacity": 0.75,
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
      markersRef.current.forEach((m) => m.remove());
      markersRef.current.clear();
      for (const u of script.units) {
        const color = script.factions[u.faction].color;
        const marker = new MlMarker({
          element: makeUnitElement(color, u.label, () => setSelectedUnitId(u.id)),
        });
        marker.setLngLat(geoUnitPositionAt(u, 0));
        marker.addTo(map);
        markersRef.current.set(u.id, marker);
      }
      setReady(true);
    });

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current.clear();
      map.remove();
      mapRef.current = null;
      setReady(false);
      window.speechSynthesis?.cancel();
    };
  }, [script]);

  // 选中高亮
  useEffect(() => {
    if (!ready) return;
    markersRef.current.forEach((m, id) => {
      m.getElement().classList.toggle("selected", id === selectedUnitId);
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
    const spoken = { index: -1 };

    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const s = usePlayback.getState();
      if (s.playing) s.advance(dt);

      // 事件语音播报：前进越过新事件时播报并自动暂停推演；回拖时静默重置
      const idx = countEventsLE(script.events, s.time);
      if (idx < spoken.index) {
        window.speechSynthesis?.cancel();
        setNarrationHold(false);
      } else if (
        idx > spoken.index &&
        voiceOnRef.current &&
        s.playing &&
        !s.narrationHold
      ) {
        const ev = script.events[Math.max(0, idx - 1)];
        usePlayback.setState({ playing: false, narrationHold: true });
        speakEvent(ev, () => {
          if (usePlayback.getState().narrationHold) {
            usePlayback.setState({ narrationHold: false, playing: true });
          }
        });
      }
      spoken.index = idx;

      // 单位位置与可见性
      for (const u of script.units) {
        const marker = markersRef.current.get(u.id);
        if (!marker) continue;
        const visible = u.appearAfter === undefined || s.time >= u.appearAfter;
        const el = marker.getElement();
        el.style.display = visible ? "" : "none";
        if (visible) marker.setLngLat(geoUnitPositionAt(u, s.time));
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
              properties: { id: u.id, color: script.factions[u.faction].color },
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

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ready, script]);

  const toggleVoice = (): void => {
    setVoiceOn((v) => {
      const next = !v;
      if (!next) {
        window.speechSynthesis?.cancel();
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
      />
    </div>
  );
}
