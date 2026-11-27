---
name: beamcast
description: Write, validate and push Beamcast slide decks — `.bc` files in the Beamcast slide language — through the Beamcast JSON API. Use when the user wants to build or edit a talk deck on Beamcast, mentions a `.bc` file or the slide language, asks to push or pull a deck, or wants a picture uploaded into a deck.
---

# Beamcast decks

A Beamcast deck is one `.bc` file in the **slide language**: `@directive` lines and a closed set of text **marks**. The source is the deck, so uploading it and editing it are the same operation — replace the source.

The parser refuses a deck it does not understand and names the line. Never guess at markup: [`slide-language.md`](slide-language.md) holds every directive, mark and rejection rule.

## Setup

`scripts/bc.sh` talks to the API. It needs `curl` and `jq`.

- `BEAMCAST_TOKEN` holds the API token. Without it the script stops before any request.
- `BEAMCAST_HOST` overrides the host. It defaults to `https://beamcast.trobanga.de`.

If `BEAMCAST_TOKEN` is unset, stop and ask the user to export it. Do not read it out of a project file.

## The loop

Write the deck locally, prove it parses, then push it.

1. **Write** the `.bc` file. Consult [`slide-language.md`](slide-language.md) for every directive and mark you are not certain of.
2. **Check** it: `bc.sh check <file>`. This parses without saving and needs no presentation to exist, so it is the cheap gate. It prints `N slides` or names the failing line.
3. **Fix** every line the check names, then check again. The completion criterion is a clean parse, not a plausible-looking file.
4. **Read the warnings.** A deck that parses may carry warnings, which `check`, `push` and `new` print to stderr as `warning: line N: ...` (the API answers them as `warnings: [{line, message}]`). The one kind now says a plot's area is too small for its parts, so it is drawn smaller than the deck's text: give the `@plot` the area the message names, the least on the 1920x1080 slide that shows it at full size (often only higher or only wider), then check again; if it says no area on the slide does, simplify the plot. A warning blocks nothing, but a deck with one does not look as written.
5. **Push** it: `bc.sh push <slug> <file>`. The save applies to a running session at once.

A push of a deck the parser refuses changes nothing and reports the line, so a failed push is safe. Checking first is still cheaper than pushing to find out.

### Commands

| Command | What it does |
|---|---|
| `check <file>` | Parse a deck without saving it. |
| `list` | List your presentations: slug, title, last change. |
| `new <title> [file]` | Create a presentation, optionally with a deck. |
| `pull <slug> [file]` | Download the deck source. |
| `push <slug> <file>` | Upload the deck source. |
| `rename <slug> <title>` | Change the title. |
| `rm <slug>` | Delete a presentation. |
| `images` | List your stored pictures. |
| `image <file>` | Upload a picture and print its `/i/<id>` mark. |
| `rm-image <id>` | Delete a stored picture. |
| `palettes` | List the palettes your decks may name: your own, then those shared with you through circles (`<handle>/<name>`). |
| `pull-palette <name> [file]` | Download a palette as JSON. |
| `push-palette <file>` | Create or replace the palette the JSON file names. |
| `rm-palette <name>` | Delete one of your palettes. |

Ask the user before `rm`, `rm-image` or `rm-palette`. Nothing sweeps and nothing restores.

## Pictures

To put a generated diagram in a deck:

1. Write the SVG or PNG to a file.
2. Run `bc.sh image <file>`. It prints one mark, such as `/i/Jz7qP0aXm2Kd8Rue`.
3. Paste that mark into the deck: `![a coverage curve](/i/Jz7qP0aXm2Kd8Rue)` inside an `@area`, or `@background /i/Jz7qP0aXm2Kd8Rue`.

Every upload mints a new id, so re-uploading a changed picture gives a new mark. Replace the old mark in the source, and delete the old picture if it is now unused.

## Palettes

A palette of your own gives decks a brand's colours. A palette file is JSON:

```json
{
  "name": "kimed",
  "dark": {"stage": "#000a29", "surface": "#001a66", "raise": "#0032cd", "ink": "#ffffff",
           "ink-dim": "#c9d6ff", "accent": "#ff5f1b", "heading": "#ff8a57", "on-accent": "#000a29"},
  "light": {"stage": "#001a66", "surface": "#ffffff", "raise": "#e6ecff", "ink": "#000a29",
            "ink-dim": "#3a4670", "accent": "#0032cd", "heading": "#0032cd", "on-accent": "#ffffff"},
  "dark_background": null,
  "light_background": null
}
```

1. Write the file and run `bc.sh push-palette <file>`. A refusal names each colour pair that is too faint, for example `light heading #ff5f1b on surface #ffffff reads 3.04:1, needs 4.5:1`: darken or lighten one of the two and push again. The floors are ink on surface 7:1, and ink-dim, heading and accent on surface, on-accent on accent and ink on raise 4.5:1.
2. Name it in the deck header: `@palette kimed`.

A background is a picture of yours, `/i/<id>` from `bc.sh image`, one per variant, so a white picture stands behind the light slides and a dark one behind the dark slides. The name never changes.

## Traps

Each of these cost a previous session real time.

- **A deck the parser refuses never reaches the column.** `push` and `new` both parse first. A refusal is the whole story: read the line number it gives you.
- **`rename` changes the title and nothing else.** The endpoint reads the title alone and answers 200 to any other field, having ignored it. To change the deck, push the source.
- **`---` separates slides. `--` is a build mark.** They are different marks and one is not a typo of the other.
- **Every image upload mints a new id.** There is no update-in-place.
- **`/i/<id>` is a path into one Beamcast.** A deck carrying those marks draws nothing on a second instance.
- **Rewording a poll question resets its votes,** because the poll id derives from the question text.
- **`@palette` takes the deck owner's palettes.** Their own, and those shared with them through a circle as `<handle>/<name>`. A deck of someone else's, shared with you, takes its owner's, not yours, so `bc.sh palettes` is the list for your own decks only. A shared palette is read-only to you: `pull-palette`, `push-palette` and `rm-palette` act on your own palettes by plain name.

## Testing the script

`tests/run-tests.sh` runs offline: it points `bc.sh` at a fake curl through `BEAMCAST_CURL` and checks the request that goes out. Run it after any change to `bc.sh`.
