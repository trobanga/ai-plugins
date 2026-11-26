import { expect, test } from 'claude-code/testing'

const PARAGRAPH =
  'This is a long test paragraph. It has many words so that it is much wider than seventy-two columns on a wide terminal.'

/**
 * Stands in for the engine: it draws a reply's text as it gets it. Returns the
 * steps a test takes through the plugin.
 */
function engine(on: any, stored: Record<string, unknown> = {}) {
  const disk: Record<string, unknown> = { ...stored }
  on('store.get', (_: any, e: any) => ({ value: disk[e.key] }))
  on('store.set', (_: any, e: any) => {
    disk[e.key] = JSON.parse(JSON.stringify(e.value))
    return { value: undefined }
  })
  on('ui.render', ($: any, e: any) => {
    const { Text } = $.ui.resolve(e)
    return <Text>{e.props.text}</Text>
  })
  on('session.start', (_: any, e: any) => ({ cwd: e.cwd }))
  on('command.register', (_: any, e: any) => ({ value: { command: e.name } }))

  /** Draws a reply on a terminal 200 columns wide and returns the drawn text and the left padding. */
  async function mount($: any, text: string): Promise<{ screen: string; padding: number; boxes: { padding: number; text: string }[] }> {
    const ui = await $.ui.mount({
      plugin: 'prose-width',
      component: 'AssistantMessage',
      requestId: 'm1',
      surface: 'terminal',
      viewport: { columns: 200, rows: 50, isFullscreen: true },
      props: { text, isFirstOfReply: true },
    })
    const screen = (await ui.find({ type: 'Text' }))?.text ?? ''
    const padding = (await ui.find({ type: 'Box' }))?.props?.paddingLeft ?? 0
    const boxes = (await ui.findAll({ type: 'Box' })).map((b: any) => ({ padding: b.props?.paddingLeft ?? 0, text: b.text ?? '' }))
    await ui.unmount()
    return { screen, padding, boxes }
  }

  return {
    /** What the plugin keeps across sessions. */
    disk,
    /** Starts the session, as the engine does before the first reply. */
    async start($: any) {
      await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    },
    /** Runs `/prose-width args` and returns the text it shows. */
    async command($: any, args: string): Promise<string | undefined> {
      const result = await $.command.run({
        command: 'prose-width',
        args,
        origin: { kind: 'composer' },
        presentation: { isFullscreen: true, columns: 200 },
      })
      return result?.text
    },
    /** The text drawn for a reply. */
    draw: async ($: any, text: string) => (await mount($, text)).screen,
    /** The boxes drawn for a reply, with their left padding and text. */
    boxes: async ($: any, text: string) => (await mount($, text)).boxes,
    /** The left padding of a reply's prose. */
    margin: async ($: any, text: string) => (await mount($, text)).padding,
  }
}

/** The width of the widest drawn line. */
const widest = (screen: string) => Math.max(...screen.split('\n').map((l) => l.trimEnd().length))

test('prose wraps at 72 columns by default, and code keeps its width', async ($, on) => {
  const { start, draw } = engine(on)
  await start($)
  const code = '```\n' + 'x'.repeat(120) + '\n```'
  const screen = await draw($, PARAGRAPH + '\n\n' + code)
  expect(screen.split('\n').length).toBeGreaterThan(4)
  expect(screen).toContain('x'.repeat(120))
  expect(widest(screen.replace('x'.repeat(120), ''))).toBeLessThanOrEqual(72)
})

test('/prose-width 50 wraps prose at 50 columns', async ($, on) => {
  const { start, command, draw } = engine(on)
  await start($)
  await command($, '50')
  expect(widest(await draw($, PARAGRAPH))).toBeLessThanOrEqual(50)
})

test('/prose-width with a bad argument shows an error and keeps the width', async ($, on) => {
  const { start, command, draw } = engine(on)
  await start($)
  expect(await command($, 'abc')).toMatch(/expected a number/)
  expect(await command($, '5')).toMatch(/expected a number/)
  expect(widest(await draw($, PARAGRAPH))).toBeLessThanOrEqual(72)
})

test('/prose-width off draws the reply as Claude Code does', async ($, on) => {
  const { start, command, draw } = engine(on)
  await start($)
  await command($, 'off')
  expect(await draw($, PARAGRAPH)).toBe(PARAGRAPH)
})

test('/prose-width left stops the centering, /prose-width center starts it again', async ($, on) => {
  const { start, command, margin } = engine(on)
  await start($)
  expect(await margin($, PARAGRAPH)).toBe(64)
  await command($, 'left')
  expect(await margin($, PARAGRAPH)).toBe(0)
  await command($, 'center')
  expect(await margin($, PARAGRAPH)).toBe(64)
})

test('/prose-width shows the setting', async ($, on) => {
  const { start, command } = engine(on)
  await start($)
  expect(await command($, '')).toBe('prose-width: 72, centered')
  expect(await command($, 'left')).toBe('prose-width: 72')
  expect(await command($, '60')).toBe('prose-width: 60')
  expect(await command($, 'off')).toBe('prose-width: off')
})

test('a new session starts with the stored layout', async ($, on) => {
  const { start, draw, margin } = engine(on, { layout: { width: 50, center: false } })
  await start($)
  expect(widest(await draw($, PARAGRAPH))).toBeLessThanOrEqual(50)
  expect(await margin($, PARAGRAPH)).toBe(0)
})

test('/prose-width --store keeps the layout for new sessions; without it the store stays', async ($, on) => {
  const { start, command, disk } = engine(on)
  await start($)
  expect(await command($, '50 --store')).toBe('prose-width: 50, centered (stored)')
  expect(disk.layout).toEqual({ width: 50, center: true })
  await command($, '60')
  await command($, 'left')
  expect(disk.layout).toEqual({ width: 50, center: true })
  await command($, 'off --store')
  expect(disk.layout).toEqual({ width: null, center: false })
})

/** A table with one header column and one column of the given width. */
const tableOf = (cell: number) => '| Name | ' + 'v'.repeat(cell) + ' |\n| --- | --- |\n| a | 1 |'

/** The left padding of the innermost box that holds the table. */
const tablePadding = (drawn: { padding: number; text: string }[]) =>
  drawn.filter((b) => b.text.includes('| Name |')).at(-1)!.padding

test('a table is centered on the page, and the prose keeps its column', async ($, on) => {
  const { start, boxes } = engine(on)
  await start($)
  // Drawn 51 columns wide: 4 + 40 cells, 3 per column for spaces and borders, 1 border.
  const drawn = await boxes($, 'Intro text.\n\n' + tableOf(40) + '\n\nOutro text.')
  expect(tablePadding(drawn)).toBe(Math.floor((200 - 51) / 2))
  expect(drawn.find((b) => b.text.includes('Intro text.') && !b.text.includes('| Name |'))?.padding).toBe(64)
})

test('a table wider than the terminal starts at the left edge', async ($, on) => {
  const { start, boxes } = engine(on)
  await start($)
  expect(tablePadding(await boxes($, 'Intro.\n\n' + tableOf(250)))).toBe(0)
})

test('the width of a table counts link text, not the link target', async ($, on) => {
  const { start, boxes } = engine(on)
  await start($)
  const table = '| Name | [docs](https://example.com/' + 'x'.repeat(150) + ') |\n| --- | --- |\n| a | 1 |'
  // Drawn 16 columns wide: 4 + 4 cells, 3 per column, 1 border.
  expect(tablePadding(await boxes($, 'Intro.\n\n' + table))).toBe(Math.floor((200 - 16) / 2))
})
