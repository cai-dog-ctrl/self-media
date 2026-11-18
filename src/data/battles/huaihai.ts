import type { GeoBattleScript } from "../../engine/types";
import { parseNarration } from "../../engine/narration";
// 解说词文本源：直接编辑 huaihai-narration.md 即可，保存后页面热更新
import narrationRaw from "./huaihai-narration.md?raw";

const NARRATION_EVENTS = parseNarration(narrationRaw);

/**
 * 淮海战役（1948年11月6日 — 1949年1月10日，66 天）沙盘推演脚本。
 *
 * 全部坐标使用真实经纬度，由 MapLibre 真实底图渲染：
 * 水系、铁路、城镇直接来自底图，无需自绘。
 * 军事部署按公开战史整理至兵团级，行军路线为示意化处理，非精确史实复原。
 */
export const geoScript: GeoBattleScript = {
  schemaVersion: 1,
  id: "huaihai",
  name: "淮海战役",
  era: "解放战争 · 1948年11月6日 — 1949年1月10日",
  summary:
    "六十万人对八十万人，66 天，三个包围圈一个一个吃掉。这一仗打完，长江以北再没什么能挡住解放军。",
  duration: 66,
  startDate: "1948-11-06",
  /** 1x 时每秒推进 1.5 个「日」，全片约 44 秒；语音播报时自动暂停 */
  pace: 1.5,
  factions: {
    pla: { name: "解放军（华野·中野）", color: "#c0392b" },
    kmt: { name: "国民党军（徐州剿总）", color: "#3a6ea5" },
  },
  view: {
    center: [117.1, 33.85],
    zoom: 7.3,
    bearing: 0,
    pitch: 45,
  },
  phases: [
    { label: "PHASE I · 围歼黄百韬", t: 0 },
    { label: "PHASE II · 围歼黄维", t: 17 },
    { label: "PHASE III · 围歼杜聿明", t: 40 },
  ],
  units: [
    // ---------- 解放军 ----------
    {
      id: "pla_assault",
      faction: "pla",
      label: "华野突击集团（1·4·6·8·9纵）",
      size: 1,
      brief:
        "华野头号主力集群。战役发起后自鲁南直插陇海线，先围歼黄百韬兵团于碾庄，随后转用于徐南阻击与陈官庄总攻，是全战役的钢铁主锤。",
      actions: [
        "11.6 自鲁南多路南下，抢占曹八集断敌西撤退路",
        "11.11—11.22 碾庄村落攻坚，歼灭黄百韬兵团",
        "11.30 南下徐南一线组织阻击",
        "12.4 起参加陈官庄合围与总攻",
      ],
      waypoints: [
        { t: 0, lon: 117.6, lat: 34.85 },
        { t: 2, lon: 117.75, lat: 34.6 },
        { t: 4, lon: 117.85, lat: 34.45 },
        { t: 8, lon: 117.8, lat: 34.35 },
        { t: 12, lon: 117.86, lat: 34.35 },
        { t: 16, lon: 117.87, lat: 34.33 },
        { t: 22, lon: 117.5, lat: 33.9 },
        { t: 26, lon: 117.35, lat: 33.6 },
        { t: 30, lon: 116.7, lat: 34.0 },
        { t: 35, lon: 116.45, lat: 33.95 },
        { t: 61, lon: 116.42, lat: 34.0 },
        { t: 66, lon: 116.42, lat: 34.02 },
      ],
    },
    {
      id: "pla_blocking",
      faction: "pla",
      label: "华野阻援集团（7·10·11纵）",
      size: 0.8,
      brief:
        "在大许家一线构筑阻击线，顶住邱清泉、李弥两兵团十余天轮番猛攻，为碾庄攻坚争取了全部时间。",
      actions: [
        "11.13 起徐东阻击，抗击敌东援碾庄",
        "11.22 转兵西进，参加陈官庄方向合围",
      ],
      waypoints: [
        { t: 0, lon: 117.4, lat: 34.5 },
        { t: 6, lon: 117.55, lat: 34.35 },
        { t: 22, lon: 117.6, lat: 34.3 },
        { t: 26, lon: 117.3, lat: 34.1 },
        { t: 32, lon: 116.8, lat: 33.95 },
        { t: 61, lon: 116.5, lat: 33.95 },
        { t: 66, lon: 116.48, lat: 33.97 },
      ],
    },
    {
      id: "pla_subei",
      faction: "pla",
      label: "苏北兵团（2·12纵）",
      size: 0.7,
      brief:
        "自淮海区西进，威胁陇海线东段与徐州东南侧翼，策应主攻方向，战役后期转隶陈官庄围歼。",
      actions: [
        "11.6 西进，威胁两淮与陇海东段",
        "12 月转隶陈官庄方向参加总攻",
      ],
      waypoints: [
        { t: 0, lon: 119.0, lat: 33.7 },
        { t: 6, lon: 118.6, lat: 33.75 },
        { t: 12, lon: 118.2, lat: 33.9 },
        { t: 18, lon: 117.9, lat: 34.0 },
        { t: 28, lon: 117.6, lat: 33.7 },
        { t: 40, lon: 117.2, lat: 33.5 },
        { t: 55, lon: 116.9, lat: 33.8 },
        { t: 66, lon: 116.6, lat: 33.9 },
      ],
    },
    {
      id: "pla_uprising",
      faction: "pla",
      label: "起义部队·第三绥靖区",
      size: 0.5,
      appearAfter: 2,
      brief:
        "第三绥靖区副司令何基沣、张克侠（中共特别党员）率 59、77 军大部起义，台儿庄至贾汪防线洞开，华野三个纵队由此直插陇海线。",
      actions: [
        "11.8 贾汪起义，让开南下通道",
        "随后整编加入华野战斗序列",
      ],
      waypoints: [
        { t: 2, lon: 117.45, lat: 34.45 },
        { t: 6, lon: 117.6, lat: 34.42 },
        { t: 12, lon: 117.8, lat: 34.38 },
        { t: 20, lon: 117.6, lat: 34.3 },
        { t: 30, lon: 117.4, lat: 34.2 },
        { t: 66, lon: 117.2, lat: 34.1 },
      ],
    },
    {
      id: "pla_cyf_main",
      faction: "pla",
      label: "中野主力（1·2·3·4·6纵）",
      size: 1,
      brief:
        "千里东进直插津浦线。袭占宿县掐断徐州陆上补给，是全战役最关键的一步棋；随后独立完成对黄维兵团的合围与歼灭。",
      actions: [
        "11.6 东进破击陇海线",
        "11.16 袭占津浦线重镇宿县",
        "11.25 完成双堆集合围",
        "12.15 歼灭黄维兵团",
      ],
      waypoints: [
        { t: 0, lon: 115.35, lat: 34.35 },
        { t: 6, lon: 116.0, lat: 34.4 },
        { t: 10, lon: 116.5, lat: 34.1 },
        { t: 14, lon: 116.85, lat: 33.75 },
        { t: 16, lon: 116.96, lat: 33.65 },
        { t: 22, lon: 116.8, lat: 33.5 },
        { t: 26, lon: 116.75, lat: 33.45 },
        { t: 30, lon: 116.85, lat: 33.55 },
        { t: 39, lon: 116.87, lat: 33.58 },
        { t: 50, lon: 116.8, lat: 33.55 },
        { t: 66, lon: 116.75, lat: 33.5 },
      ],
    },
    {
      id: "pla_ywwnsu",
      faction: "pla",
      label: "豫皖苏军区部队",
      size: 0.3,
      brief:
        "在涡河、浍河以西广泛破击牵制，阻击黄维、李延年两翼，掩护主力合围态势的完成。",
      actions: ["破击陇海、津浦沿线交通", "阻击西线援敌"],
      waypoints: [
        { t: 0, lon: 115.3, lat: 33.6 },
        { t: 10, lon: 115.8, lat: 33.5 },
        { t: 25, lon: 116.2, lat: 33.45 },
        { t: 40, lon: 116.3, lat: 33.6 },
        { t: 66, lon: 116.35, lat: 33.7 },
      ],
    },
    {
      id: "pla_jluyu",
      faction: "pla",
      label: "冀鲁豫军区部队",
      size: 0.3,
      brief: "自鲁西南南下，破击陇海线黄口—砀山段，牵制商丘方向之敌。",
      actions: ["破击陇海铁路", "牵制商丘守军"],
      waypoints: [
        { t: 0, lon: 115.5, lat: 34.6 },
        { t: 8, lon: 116.0, lat: 34.55 },
        { t: 20, lon: 116.3, lat: 34.5 },
        { t: 35, lon: 116.4, lat: 34.35 },
        { t: 66, lon: 116.42, lat: 34.3 },
      ],
    },
    {
      id: "pla_southgroup",
      faction: "pla",
      label: "华野南集团（3·13纵等）",
      size: 0.8,
      appearAfter: 24,
      brief:
        "战役中期自徐东南下，先增强双堆集方向的突击力量，黄维覆灭后北上参加陈官庄总攻。",
      actions: [
        "11.30 南调，参加双堆集攻坚",
        "12.16 北上，参加陈官庄围困与总攻",
      ],
      waypoints: [
        { t: 24, lon: 117.4, lat: 33.3 },
        { t: 30, lon: 117.1, lat: 33.45 },
        { t: 36, lon: 116.95, lat: 33.55 },
        { t: 45, lon: 116.8, lat: 33.6 },
        { t: 56, lon: 116.7, lat: 33.85 },
        { t: 66, lon: 116.55, lat: 33.95 },
      ],
    },
    // ---------- 国民党军 ----------
    {
      id: "kmt_hbt",
      faction: "kmt",
      label: "黄百韬第7兵团",
      size: 0.95,
      brief:
        "驻新安镇的第 25、44、63、64、100 军。等待 44 军抵达延误两天，西撤运河时架桥不足，退路被截，困守碾庄圩至全军覆灭。",
      actions: [
        "11.6 自新安镇西撤",
        "11.11 被合围于碾庄圩",
        "11.22 兵团覆灭，黄百韬自戕",
      ],
      waypoints: [
        { t: 0, lon: 118.35, lat: 34.37 },
        { t: 3, lon: 118.0, lat: 34.35 },
        { t: 6, lon: 117.87, lat: 34.32 },
        { t: 16, lon: 117.87, lat: 34.31 },
      ],
    },
    {
      id: "kmt_li_mi",
      faction: "kmt",
      label: "李弥第13兵团",
      size: 0.7,
      brief:
        "原驻曹八集一带的第 8、9 军，战役发起后退集徐州；随杜聿明西撤后被围陈官庄，1949 年 1 月 10 日被歼。",
      actions: [
        "11.9 退集徐州",
        "11.13 东援碾庄受挫",
        "11.30 随总部西撤",
        "1949.1.10 于陈官庄被歼",
      ],
      waypoints: [
        { t: 0, lon: 117.75, lat: 34.33 },
        { t: 5, lon: 117.4, lat: 34.32 },
        { t: 24, lon: 117.2, lat: 34.28 },
        { t: 27, lon: 116.9, lat: 34.2 },
        { t: 30, lon: 116.45, lat: 34.05 },
        { t: 66, lon: 116.45, lat: 34.07 },
      ],
    },
    {
      id: "kmt_qiu",
      faction: "kmt",
      label: "邱清泉第2兵团",
      size: 0.9,
      brief:
        "徐州西线机动兵团，蒋系王牌第 5 军所在。东援碾庄十日无功，西撤后被围陈官庄，覆灭时邱清泉毙命。",
      actions: [
        "11.13 东援碾庄，被阻于大许家一线",
        "11.30 随杜聿明西撤",
        "1949.1.10 兵团覆灭，邱清泉毙命",
      ],
      waypoints: [
        { t: 0, lon: 116.6, lat: 34.4 },
        { t: 8, lon: 117.05, lat: 34.3 },
        { t: 12, lon: 117.35, lat: 34.28 },
        { t: 22, lon: 117.4, lat: 34.28 },
        { t: 26, lon: 117.1, lat: 34.25 },
        { t: 29, lon: 116.6, lat: 34.15 },
        { t: 32, lon: 116.42, lat: 34.1 },
        { t: 66, lon: 116.42, lat: 34.08 },
      ],
    },
    {
      id: "kmt_sun",
      faction: "kmt",
      label: "孙元良第16兵团",
      size: 0.6,
      brief:
        "自蒙城北调徐州担任守备的第 41、47 军。12 月 6 日不听杜聿明命令擅自突围，一夜之间溃散被歼。",
      actions: [
        "11.中 自蒙城北调徐州",
        "11.30 随杜聿明西撤",
        "12.6 自行突围，兵团覆灭",
      ],
      waypoints: [
        { t: 0, lon: 116.56, lat: 33.26 },
        { t: 8, lon: 116.8, lat: 33.5 },
        { t: 14, lon: 117.05, lat: 33.9 },
        { t: 22, lon: 117.15, lat: 34.25 },
        { t: 27, lon: 116.9, lat: 34.15 },
        { t: 30, lon: 116.5, lat: 34.0 },
        { t: 36, lon: 116.48, lat: 34.02 },
        { t: 66, lon: 116.48, lat: 34.03 },
      ],
    },
    {
      id: "kmt_hw",
      faction: "kmt",
      label: "黄维第12兵团",
      size: 0.95,
      appearAfter: 3,
      brief:
        "自确山千里东援的第 10、14、18、85 军，以蒋系骨干部队第 18 军为核心。装备重、行军慢，11 月 25 日被围双堆集，12 月 15 日覆灭。",
      actions: [
        "11.8 自确山出发东进",
        "11.25 于双堆集被合围",
        "11.27 突围受挫，110师阵前起义",
        "12.15 兵团覆灭，黄维被俘",
      ],
      waypoints: [
        { t: 3, lon: 115.5, lat: 33.15 },
        { t: 8, lon: 115.7, lat: 33.6 },
        { t: 12, lon: 116.1, lat: 33.5 },
        { t: 15, lon: 116.56, lat: 33.26 },
        { t: 18, lon: 116.8, lat: 33.4 },
        { t: 21, lon: 116.85, lat: 33.56 },
        { t: 39, lon: 116.86, lat: 33.57 },
      ],
    },
    {
      id: "kmt_li_yannian",
      faction: "kmt",
      label: "李延年第6兵团",
      size: 0.6,
      brief: "自蚌埠沿津浦线北援解围，进至固镇以南即被阻，此后再无大的作为。",
      actions: ["11.中 沿津浦线北援", "11.底 受阻，缩回蚌埠一线"],
      waypoints: [
        { t: 0, lon: 117.39, lat: 32.92 },
        { t: 14, lon: 117.35, lat: 33.15 },
        { t: 22, lon: 117.32, lat: 33.3 },
        { t: 35, lon: 117.36, lat: 33.1 },
        { t: 66, lon: 117.39, lat: 32.95 },
      ],
    },
    {
      id: "kmt_liu_ruming",
      faction: "kmt",
      label: "刘汝明第8兵团",
      size: 0.5,
      brief: "原西北军系统，行动消极避战，与李延年兵团一同在蚌埠以北徘徊观望。",
      actions: ["北援迟缓、行动消极", "缩守淮河北岸"],
      waypoints: [
        { t: 0, lon: 116.95, lat: 32.95 },
        { t: 12, lon: 117.1, lat: 33.1 },
        { t: 25, lon: 116.9, lat: 33.2 },
        { t: 40, lon: 116.9, lat: 33.0 },
        { t: 66, lon: 116.95, lat: 32.93 },
      ],
    },
    {
      id: "kmt_garrison",
      faction: "kmt",
      label: "徐州剿总直属部队",
      size: 0.4,
      brief:
        "徐州剿总直属单位与后方机关。11 月 30 日随总部弃城西撤，最终在陈官庄一并被歼。",
      actions: ["11.30 随总部弃徐州西撤", "1949.1.10 于陈官庄被歼"],
      waypoints: [
        { t: 0, lon: 117.18, lat: 34.26 },
        { t: 28, lon: 117.18, lat: 34.26 },
        { t: 32, lon: 116.9, lat: 34.15 },
        { t: 38, lon: 116.6, lat: 34.1 },
        { t: 66, lon: 116.55, lat: 34.1 },
      ],
    },
  ],
  // 解说词来自 huaihai-narration.md（唯一数据源，可直接编辑）
  events: NARRATION_EVENTS,
  clashes: [
    { t: 4, lon: 117.95, lat: 34.35, label: "运河追击" },
    { t: 6, lon: 118.1, lat: 34.32, label: "窑湾歼灭战" },
    { t: 7, lon: 117.55, lat: 34.33, label: "徐东阻击战" },
    { t: 14, lon: 117.87, lat: 34.32, label: "碾庄攻坚" },
    { t: 19, lon: 116.85, lat: 33.56, label: "双堆集合围" },
    { t: 28, lon: 116.45, lat: 34.06, label: "陈官庄合围" },
    { t: 39, lon: 116.86, lat: 33.57, label: "双堆集总攻" },
    { t: 62, lon: 116.45, lat: 34.07, label: "陈官庄总攻" },
  ],
  camera: [
    { t: 0, center: [117.3, 34.1], zoom: 7.6, bearing: 0, pitch: 45 },
    { t: 2, center: [117.5, 34.42], zoom: 8.8, bearing: 0, pitch: 50 },
    { t: 6, center: [117.95, 34.33], zoom: 9.4, bearing: 0, pitch: 50 },
    { t: 12, center: [117.87, 34.32], zoom: 10, bearing: 15, pitch: 55 },
    { t: 16, center: [117.87, 34.32], zoom: 9.3, bearing: 0, pitch: 50 },
    { t: 20, center: [116.9, 33.6], zoom: 8.6, bearing: 0, pitch: 50 },
    { t: 24, center: [116.85, 33.56], zoom: 9.6, bearing: -10, pitch: 50 },
    { t: 28, center: [117.05, 34.2], zoom: 8.6, bearing: 0, pitch: 50 },
    { t: 36, center: [116.45, 34.05], zoom: 9.6, bearing: 10, pitch: 50 },
    { t: 45, center: [116.7, 33.8], zoom: 8.2, bearing: 0, pitch: 45 },
    { t: 61, center: [116.45, 34.05], zoom: 10.2, bearing: -15, pitch: 55 },
    { t: 66, center: [116.8, 33.7], zoom: 7.5, bearing: 0, pitch: 40 },
  ],
};
