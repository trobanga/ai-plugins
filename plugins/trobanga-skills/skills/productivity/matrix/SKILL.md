---
name: matrix
description: Send messages to Matrix rooms through the matrix MCP server (send_message, list_rooms), with the "[claude]: " prefix on every message. Use before any call to mcp__matrix__send_message, and when the user asks to post, send, notify, report or write something to Matrix, a Matrix room, or a room by its label.
---

# Matrix messages

The `matrix` MCP server has two tools:

- `mcp__matrix__list_rooms` lists the rooms you may send to, one per line as `label = room ID`.
- `mcp__matrix__send_message` sends plain text to one of those rooms, by label or room ID, and returns the event ID.

Only whitelisted rooms accept a message. You cannot send to another room.

## Rules

1. **Start every message with `[claude]: `.** Readers must see at once that Claude wrote the message, not the user. This applies to every message, also to a short reply or a status update.
2. **Name the room by its label.** If the user names no room, run `list_rooms`. If more than one room fits, ask which one.
3. **Send plain text.** The tool sends no Markdown, so do not use headings, tables or code fences. Short lines and `-` lists are fine.
4. **Write for a reader without context.** Put the result first, in one or two sentences. Give links or ids, such as an issue id or a commit SHA, rather than long logs.
5. **Send nothing secret.** Leave out tokens, passwords, the contents of `.env`, and personal data that the user did not ask you to share.
6. **Send once.** A sent message cannot be taken back. Check the text before you send it. If the call fails, read the error before you try again, so that the room does not get the message twice.

## Example

```
mcp__matrix__send_message({
  room: "dev",
  text: "[claude]: EXP-128 is on main (866439b). The Filter button shows a funnel icon, and the word \"Filter\" when the bar is at least 672 px wide."
})
```

After the send, tell the user the room and the event ID in one line.
