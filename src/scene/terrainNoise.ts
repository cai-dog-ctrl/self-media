/**
 * 程序化地形高度场（确定性伪随机）。
 * 地形网格与军队落点共用同一函数，保证贴地一致。
 */

const hash = (x: number, z: number): number => {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

const smooth = (t: number): number => t * t * (3 - 2 * t);

const valueNoise = (x: number, z: number): number => {
  const xi = Math.floor(x);
  const zi = Math.floor(z);
  const xf = x - xi;
  const zf = z - zi;
  const a = hash(xi, zi);
  const b = hash(xi + 1, zi);
  const c = hash(xi, zi + 1);
  const d = hash(xi + 1, zi + 1);
  const u = smooth(xf);
  const v = smooth(zf);
  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
};

export const terrainHeight = (x: number, z: number): number => {
  let h = valueNoise(x * 0.018, z * 0.018) * 10;
  h += valueNoise(x * 0.045 + 7.3, z * 0.045 + 2.1) * 4;
  h += valueNoise(x * 0.11 + 13.7, z * 0.11 + 9.2) * 1.2;
  h -= 6;
  // 谷地（示意河流）
  const valley = Math.exp(-Math.pow((z - x * 0.15) / 16, 2)) * 5;
  h -= valley;
  // 主战场平坦化
  const flat = Math.exp(-(Math.pow((x - 20) / 70, 2) + Math.pow(z / 55, 2)));
  h *= 1 - 0.55 * flat;
  return h;
};
