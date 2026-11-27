/**
 * Resolvers turn a selected token into the content of the gloss band. Each one either claims the
 * token and returns a gloss, or returns undefined so that the next resolver can try.
 */

import type { Gloss } from '../types'
import type { Definition } from './definitions'

export type Resolver = (token: string) => Gloss | undefined | Promise<Gloss | undefined>

/** A code that the session defined, such as `F3`. */
export function codes(defs: ReadonlyMap<string, Definition>): Resolver {
  return (token) => {
    const def = defs.get(token)
    return def && { title: def.title ? `${def.code} ${def.title}` : def.code, body: def.text }
  }
}

/** Runs git with `args` in the session's directory. */
export type Git = (args: string[]) => Promise<{ stdout: string; exitCode: number }>

const HASH = /^[0-9a-f]{7,40}$/

/** A hex string of 7 to 40 characters that names a commit gives its subject, author and date. */
export function gitObject(git: Git): Resolver {
  return async (token) => {
    if (!HASH.test(token)) return undefined
    const { stdout, exitCode } = await git(['show', '-s', '--format=%s%x00%an%x00%ad', '--date=short', `${token}^{commit}`, '--'])
    if (exitCode !== 0) return undefined
    const [subject, author, date] = stdout.trim().split('\0')
    return { title: `${token} ${subject}`, body: `${author}, ${date}` }
  }
}

/** Reads a file of the session by its absolute path; rejects when it cannot. */
export type Read = (path: string) => Promise<string>

/** Lines shown on each side of a single referenced line. */
const CONTEXT = 5
/** The most lines a range shows, so that the band stays within its limits. */
const MAX_LINES = 40
const FILE_REF = /^(.+):(\d+)(?:-(\d+))?$/

/** The fence language of a file, by its extension; '' when the table has none. */
const LANGUAGES: Record<string, string> = {
  ts: 'typescript', tsx: 'tsx', js: 'javascript', jsx: 'jsx', json: 'json', md: 'markdown',
  rs: 'rust', go: 'go', py: 'python', kt: 'kotlin', java: 'java', ex: 'elixir', exs: 'elixir',
  sh: 'bash', zsh: 'bash', toml: 'toml', yaml: 'yaml', yml: 'yaml', wgsl: 'wgsl', gd: 'gdscript',
}
const languageOf = (path: string): string => LANGUAGES[/\.([^./]+)$/.exec(path)?.[1] ?? ''] ?? ''

/**
 * `path:12` gives the lines around line 12 of the file, `path:12-18` gives lines 12 to 18, both with
 * line numbers, as a code block; a range shows at most MAX_LINES lines. The path is relative to `cwd`; a file that cannot be read gives no
 * match.
 */
export function fileRef(read: Read, cwd: string): Resolver {
  return async (token) => {
    const [, file, first, last] = FILE_REF.exec(token) ?? []
    if (!file) return undefined
    const path = file.startsWith('/') ? file : `${cwd}/${file}`
    const text = await read(path).catch(() => undefined)
    if (text === undefined) return undefined
    const all = text.split('\n')
    const start = Number(first)
    const end = last === undefined ? undefined : Number(last)
    const from = Math.max(1, end === undefined ? start - CONTEXT : start)
    const to = Math.min(all.length, end ?? start + CONTEXT, from + MAX_LINES - 1)
    const width = String(to).length
    const shown = all.slice(from - 1, to).map((l, i) => `${String(from + i).padStart(width)}  ${l}`)
    // The fence is longer than any run of backticks in the lines, so the lines cannot close it.
    const runs = shown.join('\n').match(/`{3,}/g) ?? []
    const fence = '`'.repeat(Math.max(3, ...runs.map((run) => run.length + 1)))
    return { title: token, body: [`${fence}${languageOf(file)}`, ...shown, fence].join('\n') }
  }
}

/**
 * Asks each resolver in turn about the selected `text` and returns the first answer. Drops surrounding
 * blanks and backticks; a selection that is empty or holds inner blanks is no token and gives no match.
 */
export async function lookup(resolvers: readonly Resolver[], text: string): Promise<Gloss | undefined> {
  const token = tokenOf(text)
  if (!token) return undefined
  for (const resolve of resolvers) {
    const gloss = await resolve(token)
    if (gloss) return gloss
  }
  return undefined
}

/** The token in a selection, or undefined when it holds none. */
export function tokenOf(text: string): string | undefined {
  const token = text.trim().replace(/^`+|`+$/g, '')
  return token && !/\s/.test(token) ? token : undefined
}
