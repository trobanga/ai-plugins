import type { Register } from 'claude-code'
import { atom, read, update } from 'claude-code'
import type { Layout } from '../types'
import { blocks, tableWidth, wrapProse } from './wrap'

const DEFAULT = 72
const MIN = 20

/** The layout of this session; Claude Code keeps it across a reload of the mod. */
const layout = atom({ plugin: 'prose-width', key: 'layout' } as const, { width: DEFAULT, center: true })

/** The change an argument of /prose-width asks for; {} shows the setting, undefined is an error. */
function parse(arg: string): Partial<Layout> | undefined {
  if (arg === '') return {}
  if (arg === 'off') return { width: null }
  if (arg === 'center' || arg === 'left') return { center: arg === 'center' }
  if (/^\d+$/.test(arg) && Number(arg) >= MIN) return { width: Number(arg) }
  return undefined
}

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    const stored = (await $.store.get('layout')) as Layout | undefined
    if (stored) await update($, layout, () => stored)
    await $.command.register({
      name: 'prose-width',
      description: `Wrap prose at N columns (default ${DEFAULT}); "center", "left" or "off"; --store keeps it for new sessions`,
    })
    return started
  })

  on('command.run', { command: 'prose-width' }, async ($, e) => {
    const words = e.args.trim().split(/\s+/).filter(Boolean)
    const store = words.includes('--store')
    const change = parse(words.filter((w) => w !== '--store').join(' '))
    if (!change) return { text: `prose-width: expected a number ≥ ${MIN}, "center", "left" or "off", and --store` }
    const now = await update($, layout, (prev) => ({ ...prev, ...change }))
    if (store) await $.store.set('layout', now)
    return { text: `prose-width: ${now.width ?? 'off'}${now.width && now.center ? ', centered' : ''}${store ? ' (stored)' : ''}` }
  })

  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    const { width, center } = await read($, layout)
    const columns = e.viewport?.columns
    if (e.surface !== 'terminal' || !width || !columns || columns <= width + 4) return next(e)
    const parts = blocks(e.props.text)
    if (!center || !parts.some((p) => p.table)) {
      const node = await next({ ...e, props: { ...e.props, text: wrapProse(e.props.text, width) } })
      if (!center) return node
      const { Box } = $.ui.resolve(e)
      return <Box paddingLeft={Math.floor((columns - width) / 2)}>{node}</Box>
    }
    const { Box } = $.ui.resolve(e)
    const padding = Math.floor((columns - width) / 2)
    // A table is centered on the page; one wider than the terminal starts at the left edge.
    const drawn = []
    for (const [i, part] of parts.entries()) {
      const text = part.table ? part.text : wrapProse(part.text, width)
      const isFirstOfReply = e.props.isFirstOfReply && i === 0
      const child = await next({ ...e, props: { ...e.props, text, isFirstOfReply } })
      drawn.push(<Box key={String(i)} marginTop={i ? 1 : 0} paddingLeft={part.table ? Math.max(0, Math.floor((columns - tableWidth(part.text)) / 2)) : padding}>{child}</Box>)
    }
    return <Box flexDirection="column">{drawn}</Box>
  })

}
