/** What the band shows: a title in plain text and a body in markdown. */
export type Gloss = { title: string; body: string }

/** The layout of the prose-width mod, which gloss reads to put the band in the same column. */
export type ProseLayout = { width: number | null; center: boolean }

declare module 'claude-code' {
  interface PluginState {
    gloss: { shown: Gloss | null }
    /** Owned and written by prose-width; gloss only reads it. */
    'prose-width': { layout: ProseLayout }
  }
}
