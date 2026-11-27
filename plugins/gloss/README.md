# gloss

A Claude Code mod. In fullscreen mode, select a token in the transcript. A band
above the prompt then shows what the token refers to:

| You select | The band shows |
| --- | --- |
| An item code such as `F3` | The title and text of its definition in an earlier reply, and the lines indented below it. |
| `src/a.ts:12` | Lines 7 to 17 of the file, with line numbers, as a code block. |
| `src/a.ts:12-18` | Lines 12 to 18 of the file, at most 40 lines. |
| A commit hash of 7 to 40 hex characters | The subject, author and date of the commit. |

A new selection that matches nothing closes the band. So does a click that
clears the selection.

This is a port of the `gloss` extension in `pi-extensions`.

## Install

```
/plugin install gloss@trobanga
```

## Command

| Command | Effect |
| --- | --- |
| `/gloss F3` | Shows what `F3` refers to, or says that nothing is known about it. |
| `/gloss` | Looks up the current selection. With no selection, closes the band. |

## Definitions

The mod knows these forms of a definition. Each may start a list item.

| Form | Title | Text |
| --- | --- | --- |
| `F3 Title: text` | `Title` | `text` |
| `**F3 Title.** text` or `**F3 Title:** text` | `Title` | `text` |
| `**F3:** text` | none | `text` |
| `**F3 — Title**` | `Title` | the lines indented below |
| `F3 — Title`, with `—`, `–` or `-` | `Title` | the lines indented below |

The lines indented below a definition, such as a nested list, are added to its
text in each form.

## How it works

Claude Code has no event for a new selection. So a timer asks for the
selection (`$.ui.selection()`) every 300 ms. When the selection has changed
and then stayed the same for 500 ms, the mod looks up the text. Without that
wait, a band that opens during a double click moves the transcript under the
pointer. A selection that is empty or holds blanks is no token, and
the mod does no lookup for it.

The resolvers ask, in this order:

1. The item codes in the assistant messages of the transcript, read afresh at
   each lookup. A later definition of a code wins. A user message that quotes
   a definition defines nothing.
2. The file, read with `$.fs.read`. A path is relative to the session's
   directory.
3. `git show`, with a timeout of 2 s.

Claude Code empties the selection after each prompt or command. That does not
close a band that `/gloss` opened.

## Limits

- The band opens 500 to 800 ms after the selection. The timer runs for the whole
  session; each tick is one call to the engine.
- Outside fullscreen mode, Claude Code reports no selection, so only `/gloss`
  works.
- A selection over more than one row usually holds blanks, so it gives no
  match.
- Claude Code also empties the selection when you send a prompt. So a band
  that a selection opened closes then. In pi, it stays.
- The pi panel has a rule above it; the band has none.
- The band has a fixed sage green fill (`#cfe3d3`), made for a light theme.
  It does not follow a change of theme.
- The band takes at most half of the terminal's rows and scrolls past that.
- `prose-width` does not wrap the band, because the band is not a reply. But
  when `prose-width` is loaded, the band takes the same column as the replies:
  the same width, centered or at the left as `/prose-width` sets it. Without
  `prose-width`, the band takes the full width.
- Claude Code draws a `[-]` at the right of the band, which collapses it. A mod
  cannot remove it.
