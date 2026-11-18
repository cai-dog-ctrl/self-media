import type { PhaseEvent } from "./types";

/**
 * 解析解说词 Markdown（战役文本的单一数据源，可直接用编辑器修改）。
 *
 * 格式：
 *   ## D+<天数> · <日期> · <标题>
 *   <正文，可多行，空行会被忽略并合并为一段>
 *
 * 解析失败（一段都没找到）会抛错，构建/启动时即暴露。
 */
export function parseNarration(raw: string): PhaseEvent[] {
  const headerRe = /^##\s*D\+([\d.]+)\s*[·・]\s*(.+?)\s*[·・]\s*(.+)$/;
  const events: PhaseEvent[] = [];
  let current: PhaseEvent | null = null;
  const body: string[] = [];

  const flush = (): void => {
    if (current) {
      current.detail = body.join("").trim();
      events.push(current);
    }
    body.length = 0;
    current = null;
  };

  for (const line of raw.split(/\r?\n/)) {
    const m = line.trim().match(headerRe);
    if (m) {
      flush();
      current = {
        t: Number(m[1]),
        date: m[2].trim(),
        title: m[3].trim(),
        detail: "",
      };
    } else if (current) {
      const text = line.trim();
      if (text) body.push(text);
    }
  }
  flush();

  if (events.length === 0) {
    throw new Error(
      "解说词解析失败：未找到任何 '## D+N · 日期 · 标题' 段落，请检查 Markdown 格式"
    );
  }
  return events;
}
