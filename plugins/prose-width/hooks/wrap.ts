/** Hard break: two spaces and a newline, invisible if the renderer ignores it. */
const BREAK = '  \n'

/** Greedy wrap of words at width; returns lines. */
function words(text: string, width: number): string[] {
  const out: string[] = []
  let line = ''
  for (const w of text.split(/ +/)) {
    if (!w) continue
    if (line && line.length + 1 + w.length > width) { out.push(line); line = w }
    else line = line ? line + ' ' + w : w
  }
  if (line) out.push(line)
  return out
}

/** Wraps one prose line; list items and quotes keep their prefix and indent. */
function wrapLine(line: string, width: number): string {
  if (line.length <= width) return line
  if (/^\s*(#|\||<)/.test(line) || /^( {4}|\t)/.test(line) && !/^\s*([-*+]|\d+[.)]) /.test(line)) return line
  const m = /^(\s*(?:>\s?)*)(\s*(?:[-*+]|\d+[.)])\s+)?/.exec(line)!
  const quote = m[1], marker = m[2] ?? ''
  const head = quote + marker
  const cont = quote + ' '.repeat(marker.length)
  const body = line.slice(head.length)
  const lines = words(body, Math.max(20, width - head.length))
  return lines.map((l, i) => (i ? cont : head) + l).join(BREAK)
}

/** Wraps prose in markdown at width; fenced blocks stay as they are. */
export function wrapProse(text: string, width: number): string {
  let fence: string | undefined
  return text.split('\n').map((line) => {
    const m = /^\s*(`{3,}|~{3,})/.exec(line)
    if (fence) { if (m && line.trim() === fence) fence = undefined; return line }
    if (m) { fence = m[1]; return line }
    return wrapLine(line, width)
  }).join('\n')
}


/** One run of lines of a reply: a top-level table, or everything else. */
export type Block = { table: boolean; text: string }

/** Splits markdown into top-level tables and the rest, in order; fenced blocks are never tables. */
export function blocks(text: string): Block[] {
  const out: Block[] = []
  let fence: string | undefined
  for (const line of text.split('\n')) {
    const m = /^\s*(`{3,}|~{3,})/.exec(line)
    if (fence) { if (m && line.trim() === fence) fence = undefined }
    else if (m) fence = m[1]
    const table = !fence && !m && line.startsWith('|')
    const last = out[out.length - 1]
    if (last && last.table === table) last.text += '\n' + line
    else out.push({ table, text: line })
  }
  return out
    .map((b) => ({ ...b, text: b.text.replace(/^\n+|\n+$/g, '') }))
    .filter((b) => b.text.trim() !== '')
}

/** The visible width of markdown inline text: code ticks, emphasis marks and link targets drawn as nothing. */
function visible(cell: string): number {
  const text = cell
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/`+/g, '')
    .replace(/(\*\*|__|\*|_|~~)(?=\S)|(?<=\S)(\*\*|__|\*|_|~~)/g, '')
    .replace(/\\(.)/g, '$1')
  // Wide characters (CJK, emoji) take two cells.
  return [...text].reduce((n, c) => n + (/[\u{1100}-\u{115F}\u{2E80}-\u{A4CF}\u{AC00}-\u{D7A3}\u{F900}-\u{FAFF}\u{FE30}-\u{FE4F}\u{FF00}-\u{FF60}\u{FFE0}-\u{FFE6}\u{1F300}-\u{1FAFF}]/u.test(c) ? 2 : 1), 0)
}

/**
 * The columns a markdown table takes as Claude Code draws it with box borders:
 * the widest cell of each column, a space each side of it, and a border between
 * and around the columns. The separator row does not count.
 */
export function tableWidth(table: string): number {
  const widths: number[] = []
  for (const line of table.split('\n')) {
    const cells = line.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/)
    if (cells.every((c) => /^\s*:?-+:?\s*$/.test(c))) continue
    cells.forEach((c, i) => { widths[i] = Math.max(widths[i] ?? 0, visible(c.trim())) })
  }
  return widths.reduce((sum, w) => sum + w + 3, 1)
}
