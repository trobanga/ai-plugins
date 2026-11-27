/**
 * Finds the item codes that a reply defines, such as `F3 Missing null check: …`, so that a
 * later selection of `F3` can show its title and text.
 */

export interface Definition {
  code: string
  title: string
  text: string
}

/** The indent and the list marker before a definition, if any. */
const ITEM = /^(\s*)(?:(?:[-*+]|\d+[.)])\s+)?/

/**
 * The forms of a definition after the list marker, each giving code, title and text:
 * `**F3 Title.** text` (`.` or `:`), `**F3:** text` with no title, `**F3 — Title**`, `F3 — Title` (`—`, `–` or `-`,
 * with an optional `: text`) and `F3 Title: text`. Each may start a list item, at any depth.
 */
const FORMS = [
  /^\*\*([A-Z]\d+) ([^*:]+?)[.:]\*\*\s+(.*)$/,
  /^\*\*([A-Z]\d+)()[.:]\*\*\s+(.*)$/,
  /^\*\*([A-Z]\d+)\s+[—–-]\s+([^*]+?)[.:]?\*\*(?:\s+(.*))?$/,
  /^([A-Z]\d+)\s+[—–-]\s+([^:]+?)(?::\s+(.*))?$/,
  /^([A-Z]\d+) ([^:]+?):\s+(.*)$/,
]

/** The part of a session message that definitionsOf reads. */
export interface Message {
  role: string
  text: string
}

/**
 * The definitions in the assistant messages, oldest first; a later definition of a code wins.
 * Only the model defines codes: a user message that quotes one does not.
 */
export function definitionsOf(messages: readonly Message[]): Map<string, Definition> {
  const defs = new Map<string, Definition>()
  for (const message of messages) {
    if (message.role !== 'assistant') continue
    for (const [code, def] of extractDefinitions(message.text)) defs.set(code, def)
  }
  return defs
}

/**
 * The definitions in `markdown`. The text of one is what follows its title on the line, then the
 * lines indented below it, such as the items of a nested list.
 */
export function extractDefinitions(markdown: string): Map<string, Definition> {
  const defs = new Map<string, Definition>()
  const lines = markdown.split('\n')
  for (const [i, line] of lines.entries()) {
    const item = ITEM.exec(line)?.[0] ?? ''
    const rest = line.slice(item.length)
    const match = FORMS.map((form) => form.exec(rest)).find(Boolean)
    const [, code, title, text = ''] = match ?? []
    if (!code || title === undefined) continue
    const below = indentedBelow(lines, i, item.length - item.trimStart().length)
    defs.set(code, { code, title, text: [text, below].filter(Boolean).join('\n') })
  }
  return defs
}

/** The lines after line `at` that are indented deeper than `indent`, without their common indent. */
function indentedBelow(lines: readonly string[], at: number, indent: number): string {
  const block: string[] = []
  for (const line of lines.slice(at + 1)) {
    if (line.trim() === '' || line.length - line.trimStart().length <= indent) break
    block.push(line)
  }
  const common = Math.min(...block.map((line) => line.length - line.trimStart().length))
  return block.map((line) => line.slice(common)).join('\n')
}
