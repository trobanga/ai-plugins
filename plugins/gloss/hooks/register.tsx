/**
 * gloss: select a token in fullscreen mode and a band above the prompt tells what it refers to:
 * an item code from an earlier reply (`F3`), a file reference (`src/a.ts:12`, `src/a.ts:12-18`) or
 * a git commit (`a9061ca`). `/gloss <token>` does the same from the keyboard.
 *
 * Claude Code has no event for a new selection, so a timer asks for it every TICK milliseconds.
 * Item codes are read afresh from the transcript at each lookup.
 */

import type { EngineInterface as Engine, Register } from 'claude-code'
import { atom, read, update } from 'claude-code'
import type { Gloss } from '../types'
import { definitionsOf } from './definitions'
import { codes, fileRef, gitObject, lookup, tokenOf } from './resolvers'

/** How often the timer asks for the selection, in milliseconds. */
const TICK = 300
/**
 * How long a selection must stay the same before the mod acts on it, in milliseconds. A band
 * that opens during a double click moves the transcript under the pointer.
 */
const SETTLE = 500

/**
 * The fill of the band: a sage green, darker than the user's messages in the light theme. The
 * theme key `userMessageBackground` follows the theme but is lighter than wanted.
 */
const BACKGROUND = '#cfe3d3'

/** The layout of prose-width; undefined when that mod is not loaded. */
const proseLayout = { plugin: 'prose-width', key: 'layout' } as const

/** What the band shows; Claude Code keeps it across a reload of the mod. */
const shown = atom({ plugin: 'gloss', key: 'shown' } as const, null as Gloss | null)

/** The markdown of the band: the title in bold, then the body. */
export const markdownOf = (gloss: Gloss): string => `**${gloss.title}**\n\n${gloss.body}`

/** What `text` refers to, asked of the transcript, the files and git of the session. */
async function glossOf($: Engine, text: string): Promise<Gloss | undefined> {
  if (!tokenOf(text)) return undefined
  const messages = await $.session.messages()
  const defs = 'deny' in messages ? new Map() : definitionsOf(messages)
  const cwd = await $.session.cwd()
  const readFile = (path: string) => $.fs.read(path) as Promise<string>
  const git = (args: string[]) =>
    $.process.run(['git', ...args], { cwd, timeoutMs: 2000 }).catch(() => ({ stdout: '', exitCode: 1 }))
  return lookup([codes(defs), fileRef(readFile, cwd), gitObject(git)], text).catch(() => undefined)
}

/** The selection the timer acted on last; a reload starts it over, with the timer. */
let seen = ''
/** The selection the timer saw last, and since when, while it waits for it to settle. */
let pending = ''
let pendingSince = 0
/** The timer that asks for the selection; one at a time, also when session.start fires again. */
let timer: { cancel: () => void } | undefined
/** Whether the selection opened the band, so that only the selection's end closes it. */
let isFromSelection = false
/** Whether a lookup of the timer runs, so that a slow one does not pile up behind it. */
let isBusy = false

/** Looks up the selection when it has changed since the last tick. */
async function tick($: Engine) {
  if (isBusy) return
  const text = (await $.ui.selection())?.text ?? ''
  const now = await $.clock.now()
  if (text !== pending) {
    pending = text
    pendingSince = now
    return
  }
  if (text === seen || now - pendingSince < SETTLE) return
  seen = text
  isBusy = true
  try {
    // The selection empties after each prompt or command: that closes no band a command opened.
    if (text === '' && !isFromSelection) return
    const gloss = await glossOf($, text)
    isFromSelection = gloss !== undefined
    await update($, shown, () => gloss ?? null)
  } finally {
    isBusy = false
  }
}

export const register: Register = (on) => {

  on('session.start', async ($, e, next) => {
    const started = await next(e)
    await $.command.register({ name: 'gloss', description: 'Show what an item code, file:line or commit hash refers to' })
    timer?.cancel()
    // A failed call ends this tick only; the next tick asks again.
    timer = $.clock.every(TICK, () => void tick($).catch(() => undefined))
    return started
  })

  on('command.run', { command: 'gloss' }, async ($, e) => {
    const text = e.args.trim() || ((await $.ui.selection())?.text ?? '')
    const gloss = await glossOf($, text)
    isFromSelection = false
    await update($, shown, () => gloss ?? null)
    const token = text.trim()
    return gloss || !token ? {} : { text: `nothing known about ${token}` }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const gloss = await read($, shown)
    if (!gloss || e.props.hasSurvey) return next(e)
    const { Box, Markdown } = $.ui.resolve(e)
    // In the column of prose-width, with the same rule: only on a terminal wider than the limit.
    const { value: layout } = await $.state.get(proseLayout)
    const width = layout?.width
    const columns = e.viewport?.columns
    const isColumn = e.surface === 'terminal' && !!width && !!columns && columns > width + 4
    const column = isColumn ? { width, marginLeft: layout?.center ? Math.floor((columns - width) / 2) : 0 } : {}
    return (
      <Box key="gloss" backgroundColor={BACKGROUND} paddingX={1} {...column}>
        <Markdown text={markdownOf(gloss)} />
      </Box>
    )
  })
}
