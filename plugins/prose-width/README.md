# prose-width

A Claude Code mod. On a wide terminal, it wraps the prose of Claude's replies
at 72 columns and centers that text column in the terminal. Code fences,
tables and headings keep their width.

Bringhurst gives 45 to 75 characters per line, with 66 as the ideal mean.
WCAG 1.4.8 limits lines to 80. Ragged-right lines that wrap at 72 have a
mean of about 66.

## Install

```
/plugin install prose-width@trobanga
```

## Command

| Command | Effect |
| --- | --- |
| `/prose-width` | Shows the setting. |
| `/prose-width 66` | Wraps prose at 66 columns (20 or more). |
| `/prose-width left` | Stops the centering. |
| `/prose-width center` | Starts the centering again. |
| `/prose-width off` | Removes the limit. |
| `/prose-width 66 --store` | Also keeps the result for new sessions; works with each form above. |

Without `--store`, a change applies to the current session only. A new session
starts with the stored layout, or at 72 and centered if nothing is stored. A
reload of the plugins also goes back to the stored layout.

## How it works

Claude Code has no setting for the width of markdown, and a mod cannot put the
engine's drawing of a reply in a box of fixed width. So the mod's `ui.render`
hook for `AssistantMessage` breaks each long prose line with hard line breaks
before the engine draws it. List items and quotes keep their indent. To center
the text, the hook adds left padding. The stored messages do not change.

The mod changes only the terminal, and only when the terminal is more than
four columns wider than the limit.

## Limits

- A copy of a selection keeps the line breaks that the mod adds.
- The wrap counts the raw markdown characters, so the markup of links, bold
  text and inline code also counts. Lines with much markup look shorter than
  the limit.
- Tables and code fences that are wider than the space right of the padding
  are cut or wrapped by Claude Code. Use `/prose-width left` for wide tables.
