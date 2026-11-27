import { expect, mock, test } from 'claude-code/testing'

type World = {
  /** The assistant replies of the session, oldest first. */
  replies?: string[]
  /** The whole transcript, in place of `replies`. */
  messages?: { role: 'user' | 'assistant'; text: string }[]
  /** The files of the session's directory, by absolute path. */
  files?: Record<string, string>
  /** The commits git knows, by full hash: subject, author and date. */
  commits?: Record<string, [string, string, string]>
  /** What the person has selected now; undefined for nothing. */
  selection?: string
  /** How often the mod read the transcript; the stand-in counts it. */
  reads?: number
  /** The layout of prose-width, when that mod is loaded. */
  proseWidth?: { width: number | null; center: boolean }
}

/** Moves the clock past the time a selection must stay the same before the mod acts on it. */
const settle = (clock: { advance: (ms: number) => Promise<void> }) => clock.advance(900)

/** A selection the stand-in refuses to report. */
const FAIL = '<fail>'

/**
 * Stands in for the engine beneath the mod: the transcript, the files, git and
 * the selection. Returns the steps a test takes through the mod.
 */
function engine(on: any, world: World = {}) {
  /** The background color of the band, as the last draw gave it. */
  let fill: string | undefined
  /** The props of the band's Box, as the last draw gave them. */
  let box: any
  on('session.start', (_: any, e: any) => ({ cwd: e.cwd }))
  on('command.register', (_: any, e: any) => ({ value: { command: e.name } }))
  on('session.cwd', () => ({ value: '/repo' }))
  on('session.messages', () => {
    world.reads = (world.reads ?? 0) + 1
    const messages = world.messages ?? (world.replies ?? []).map((text) => ({ role: 'assistant', text }))
    return { value: messages.map((m) => ({ ...m, toolUses: [] })) }
  })
  on('fs.read', (_: any, e: any) => {
    const text = world.files?.[e.path]
    if (text === undefined) throw new Error(`ENOENT: ${e.path}`)
    return { value: text }
  })
  on('process.run', (_: any, e: any) => {
    const ref = e.argv.find((a: string) => a.endsWith('^{commit}'))?.replace('^{commit}', '')
    const hit = e.argv[0] === 'git' && ref && Object.entries(world.commits ?? {}).find(([h]) => h.startsWith(ref))
    return { value: hit ? { exitCode: 0, stdout: `${hit[1].join('\0')}\n`, stderr: '' } : { exitCode: 128, stdout: '', stderr: 'bad' } }
  })
  on('state.get', { plugin: 'prose-width' }, () => ({
    value: world.proseWidth ? { value: world.proseWidth, version: 1 } : { value: undefined, version: 0 },
  }))
  on('ui.selection', () => {
    if (world.selection === FAIL) throw new Error('refused')
    return { value: world.selection === undefined ? undefined : { text: world.selection } }
  })
  on('ui.render', { component: 'AbovePrompt' }, ($: any, e: any) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })

  return {
    fill: () => fill,
    box: () => box,
    async start($: any) {
      await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
    },
    /** Runs `/gloss args` and returns the text it answers. */
    async command($: any, args: string): Promise<string | undefined> {
      const result = await $.command.run({ command: 'gloss', args })
      return result?.text
    },
    /** The text of the band above the prompt, or undefined when the mod draws none. */
    async band($: any): Promise<string | undefined> {
      const ui = await $.ui.mount({
        plugin: 'gloss',
        component: 'AbovePrompt',
        requestId: 'gloss',
        surface: 'terminal',
        viewport: { columns: 120, rows: 40, isFullscreen: true },
        props: { hasSurvey: false },
      })
      const parts = await ui.findAll({ type: 'Markdown' })
      box = (await ui.find({ type: 'Box', key: 'gloss' }))?.props
      fill = box?.backgroundColor
      await ui.unmount()
      return parts.length ? parts.map((p: any) => p.text).join('\n') : undefined
    },
  }
}

test('/gloss F3 shows the title and text of the code an earlier reply defined', async ($, on) => {
  const g = engine(on, { replies: ['F3 Missing null check: `parse` reads `x.y` first.'] })
  await g.start($)
  await g.command($, 'F3')
  expect(await g.band($)).toBe('**F3 Missing null check**\n\n`parse` reads `x.y` first.')
})

test('/gloss F9 that nothing defines closes the band and says so', async ($, on) => {
  const g = engine(on, { replies: ['F3 Missing null check: first.'] })
  await g.start($)
  await g.command($, 'F3')
  expect(await g.command($, 'F9')).toBe('nothing known about F9')
  expect(await g.band($)).toBeUndefined()
})

const THIRTY = Array.from({ length: 30 }, (_, i) => `line ${i + 1}`).join('\n')

test('/gloss path:12 shows the five lines on each side, numbered, as a code block', async ($, on) => {
  const g = engine(on, { files: { '/repo/a.ts': THIRTY } })
  await g.start($)
  await g.command($, 'a.ts:12')
  const numbered = Array.from({ length: 11 }, (_, i) => `${String(i + 7).padStart(2)}  line ${i + 7}`)
  expect(await g.band($)).toBe(['**a.ts:12**', '', '```typescript', ...numbered, '```'].join('\n'))
})

test('/gloss path:12-14 shows exactly those lines', async ($, on) => {
  const g = engine(on, { files: { '/repo/a.ts': THIRTY } })
  await g.start($)
  await g.command($, 'a.ts:12-14')
  expect(await g.band($)).toBe('**a.ts:12-14**\n\n```typescript\n12  line 12\n13  line 13\n14  line 14\n```')
})

test('a file that holds a fence gets a longer fence', async ($, on) => {
  const g = engine(on, { files: { '/repo/b.md': '```\nx\n```' } })
  await g.start($)
  await g.command($, 'b.md:1-3')
  expect(await g.band($)).toBe('**b.md:1-3**\n\n````markdown\n1  ```\n2  x\n3  ```\n````')
})

const HASH = 'a9061ca0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6'

test('/gloss of a short commit hash shows its subject, author and date', async ($, on) => {
  const g = engine(on, { commits: { [HASH]: ['Add the engine', 'Ada Lovelace', '2026-11-20'] } })
  await g.start($)
  await g.command($, 'a9061ca')
  expect(await g.band($)).toBe('**a9061ca Add the engine**\n\nAda Lovelace, 2026-11-20')
})

test('a hex string that names no commit gives no match', async ($, on) => {
  const g = engine(on, { commits: { [HASH]: ['Add the engine', 'Ada Lovelace', '2026-11-20'] } })
  await g.start($)
  expect(await g.command($, 'deadbeef')).toBe('nothing known about deadbeef')
})

test('a new selection opens the band at the next tick of the timer', async ($, on) => {
  const clock = mock.clock(on)
  const world: World = { replies: ['F3 Missing null check: first.'] }
  const g = engine(on, world)
  await g.start($)
  world.selection = 'F3'
  await settle(clock)
  expect(await g.band($)).toBe('**F3 Missing null check**\n\nfirst.')
})

test('a new selection that matches nothing closes the band', async ($, on) => {
  const clock = mock.clock(on)
  const world: World = { replies: ['F3 Missing null check: first.'] }
  const g = engine(on, world)
  await g.start($)
  world.selection = 'F3'
  await settle(clock)
  expect(await g.band($)).toBe('**F3 Missing null check**\n\nfirst.')
  world.selection = 'some prose'
  await settle(clock)
  expect(await g.band($)).toBeUndefined()
})

test('a selection that empties after /gloss keeps the band the command opened', async ($, on) => {
  const clock = mock.clock(on)
  const world: World = { replies: ['F3 Missing null check: first.\nK1 Item codes: second.'] }
  const g = engine(on, world)
  await g.start($)
  world.selection = 'F3'
  await settle(clock)
  await g.command($, 'K1')
  world.selection = undefined
  await settle(clock)
  expect(await g.band($)).toBe('**K1 Item codes**\n\nsecond.')
})

test('a click that clears the selection closes the band the selection opened', async ($, on) => {
  const clock = mock.clock(on)
  const world: World = { replies: ['F3 Missing null check: first.'] }
  const g = engine(on, world)
  await g.start($)
  world.selection = 'F3'
  await settle(clock)
  expect(await g.band($)).toBe('**F3 Missing null check**\n\nfirst.')
  world.selection = undefined
  await settle(clock)
  expect(await g.band($)).toBeUndefined()
})

test('/gloss with no token looks up the selected text', async ($, on) => {
  const world: World = { replies: ['F3 Missing null check: first.'], selection: ' `F3` ' }
  const g = engine(on, world)
  await g.start($)
  await g.command($, '')
  expect(await g.band($)).toBe('**F3 Missing null check**\n\nfirst.')
})

test('a bold list item defines a code too', async ($, on) => {
  const g = engine(on, { replies: ['- **K3 File references:** `a.ts:12` gives code.'] })
  await g.start($)
  await g.command($, 'K3')
  expect(await g.band($)).toBe('**K3 File references**\n\n`a.ts:12` gives code.')
})

test('a user message that quotes a definition defines nothing', async ($, on) => {
  const g = engine(on, { messages: [{ role: 'user', text: 'F3 Quoted: no.' }] })
  await g.start($)
  expect(await g.command($, 'F3')).toBe('nothing known about F3')
})

test('a selection of prose does not read the transcript', async ($, on) => {
  const clock = mock.clock(on)
  const world: World = { replies: ['F3 Missing null check: first.'] }
  const g = engine(on, world)
  await g.start($)
  world.selection = 'some prose'
  await settle(clock)
  expect(world.reads ?? 0).toBe(0)
})

test('a tick whose call fails leaves the next tick working', async ($, on) => {
  const clock = mock.clock(on)
  const world: World = { replies: ['F3 Missing null check: first.'], selection: FAIL }
  const g = engine(on, world)
  await g.start($)
  await settle(clock)
  world.selection = 'F3'
  await settle(clock)
  expect(await g.band($)).toBe('**F3 Missing null check**\n\nfirst.')
})

test('a range longer than 40 lines shows its first 40 lines', async ($, on) => {
  const long = Array.from({ length: 300 }, (_, i) => `line ${i + 1}`).join('\n')
  const g = engine(on, { files: { '/repo/c.ts': long } })
  await g.start($)
  await g.command($, 'c.ts:101-250')
  const lines = (await g.band($))?.split('\n') ?? []
  expect(lines[3]).toBe('101  line 101')
  expect(lines.at(-2)).toBe('140  line 140')
})

const INSTRUMENTS = [
  'Three invented laboratory instruments',
  '',
  '- I1 — Phase comb',
  '  - Function: It measures the phase difference between two laser beams.',
  '  - Accuracy: 10⁻⁴ rad.',
  '- I3 — Drift monitor',
  '  - Function: It records the change of the magnetic field with time.',
  '  - Sample rate: 1 kHz.',
  '',
  'All three items are invented.',
].join('\n')

test('a dash after the code gives the title, and the indented items below give the text', async ($, on) => {
  const g = engine(on, { replies: [INSTRUMENTS] })
  await g.start($)
  await g.command($, 'I3')
  expect(await g.band($)).toBe(
    '**I3 Drift monitor**\n\n- Function: It records the change of the magnetic field with time.\n- Sample rate: 1 kHz.',
  )
})

test('a bold code with no title defines the code by its text', async ($, on) => {
  const g = engine(on, { replies: ['- **D2:** the band stacks with the progress row.'] })
  await g.start($)
  await g.command($, 'D2')
  expect(await g.band($)).toBe('**D2**\n\nthe band stacks with the progress row.')
})

test('a bold code, dash and title define the code, with the indented items as its text', async ($, on) => {
  const g = engine(on, { replies: ['- **L1 — Lake Verrin**\n  - Depth: 412 m\n  - Liquid: methane'] })
  await g.start($)
  await g.command($, 'L1')
  expect(await g.band($)).toBe('**L1 Lake Verrin**\n\n- Depth: 412 m\n- Liquid: methane')
})

test('the band has a green background of its own', async ($, on) => {
  const g = engine(on, { replies: ['F3 Missing null check: first.'] })
  await g.start($)
  await g.command($, 'F3')
  await g.band($)
  expect(g.fill()).toBe('#cfe3d3')
})

test('the band takes the centered column of prose-width', async ($, on) => {
  const g = engine(on, { replies: ['F3 Missing null check: first.'], proseWidth: { width: 72, center: true } })
  await g.start($)
  await g.command($, 'F3')
  await g.band($)
  expect(g.box()?.width).toBe(72)
  expect(g.box()?.marginLeft).toBe(24)
})

test('without prose-width the band takes the full width', async ($, on) => {
  const g = engine(on, { replies: ['F3 Missing null check: first.'] })
  await g.start($)
  await g.command($, 'F3')
  await g.band($)
  expect(g.box()?.width).toBeUndefined()
  expect(g.box()?.marginLeft).toBeUndefined()
})

test('a selection opens the band only once it has stayed the same for a moment', async ($, on) => {
  const clock = mock.clock(on)
  const world: World = { replies: ['F3 Missing null check: first.'] }
  const g = engine(on, world)
  await g.start($)
  world.selection = 'F3'
  await clock.advance(300)
  expect(await g.band($)).toBeUndefined()
  await settle(clock)
  expect(await g.band($)).toBe('**F3 Missing null check**\n\nfirst.')
})

test('a selection that a double click turns into a paragraph leaves the band open', async ($, on) => {
  const clock = mock.clock(on)
  const world: World = { replies: ['F3 Missing null check: first.'] }
  const g = engine(on, world)
  await g.start($)
  world.selection = 'F3'
  await settle(clock)
  world.selection = 'F3 Missing null check: first.'
  await clock.advance(300)
  expect(await g.band($)).toBe('**F3 Missing null check**\n\nfirst.')
  world.selection = 'F3'
  await settle(clock)
  expect(await g.band($)).toBe('**F3 Missing null check**\n\nfirst.')
})

test('a sentence that starts with a code is no definition', async ($, on) => {
  const g = engine(on, { replies: ['F2 is confirmed: the original query gives [].'] })
  await g.start($)
  expect(await g.command($, 'F2')).toBe('nothing known about F2')
})

test('the first definition of a code wins over a later line with the same code', async ($, on) => {
  const g = engine(on, { replies: ['F2 Missing index: the query scans the table.', 'F2 Confirmed: the original query gives [].'] })
  await g.start($)
  await g.command($, 'F2')
  expect(await g.band($)).toBe('**F2 Missing index**\n\nthe query scans the table.')
})
