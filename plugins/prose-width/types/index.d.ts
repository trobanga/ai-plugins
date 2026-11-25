/** How the mod draws prose: wrapped at `width` columns, or as Claude Code draws it when `width` is null. */
export type Layout = {
  width: number | null
  center: boolean
}

declare module 'claude-code' {
  interface PluginState {
    'prose-width': {
      layout: Layout
    }
  }
}
