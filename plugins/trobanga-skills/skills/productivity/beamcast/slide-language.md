# The Beamcast slide language

The complete markup a `.bc` file holds. The parser is the authority; this file follows `Beamcast.SlideLanguage` and `Beamcast.SlideLanguage.Marks`.

The language is a closed set. A mark it does not know is an error with a line number, never printed punctuation. That is the point: a typo stops the save instead of reaching the screen.

## File structure

- A line that is exactly `---` separates slides. A run of such lines is one separator, and a run before the first slide opens no slide: `---`, `A`, `---`, `---`, `B` is two slides. A separator opens a slide when a line follows it. Text that is blank as a whole and holds no separator, and a deck header alone, have no slide, and a deck with no slide cannot be saved.
- If line 1 is `@deck`, everything up to the first `---` is the **deck header**. Otherwise slide 1 starts at the top of the file.
- Inside a slide, a line that starts with `@` opens a **directive block**. The block holds every following line up to the next directive or the slide end.

## Directives

| Directive | Where | Meaning |
|---|---|---|
| `@deck` | line 1 only | Opens the deck header. |
| `@background <path-or-url> [cover\|contain]` | header or slide | The background image and its fit. In the header it is the deck default. |
| `@palette <name>` | header only | `slate`, `ember`, `ocean`, `mono`, a palette of the deck owner's own, or `<handle>/<name>`, one shared with the deck owner through a circle. |
| `@font /f/<slug>` | header only | The font family slides draw their text in. An unknown or deleted family draws the default fonts. |
| `@code-font /f/<slug>` | header only | The font family code is drawn in. |
| `@area x y w h [align=..] [size=..]` | slide | A text area. Marked text follows it. |
| `@poll x y w h [cols=N] [picks=N]` | slide | A question line, then an option list, in `N` columns if `cols=N` is given. A voter picks one option, or up to `N` if `picks=N` is given. |
| `@prompt x y w h [cols=N]` | slide | One line of text that asks the audience for one sentence, which the slide shows live as answers arrive, in `N` columns if `cols=N` is given. |
| `@video x y w h <url>` | slide | A video. Playback is never synced. |
| `@page <url>` | slide | A full-page iframe. The slide's only content. |
| `@qr x y w h` | slide | The audience link as a QR code. Takes no url. |
| `@plot x y w h` | slide | A line, point or bar plot drawn from one JSON object below the line, a strict subset of Vega-Lite. |
| `@notes <text>` | slide | Presenter notes. Never shown to the audience. |

To write a literal `@word` at the start of a line, indent the line or wrap the word in backticks.

## The canvas

Every coordinate lives on a virtual canvas 1920 wide and 1080 high, origin top-left. `x y w h` are bare whole numbers in that fixed order. The renderer scales the whole slide to each screen.

Constraints: `x` and `y` are zero or more, `w` and `h` are positive, `x + w <= 1920`, `y + h <= 1080`.

## Areas

```
@area 120 80 800 400
# Why Elixir?
- processes are cheap
- crashes stay local
```

Two attributes follow the four numbers, and no others:

- `align=left|center|right`. Default `left`.
- `size=<positive number>`. The font scale factor. Default `1`.

A slide holds several areas. There is no slide-title directive: a `#` heading inside an area is the title. The deck title comes from a `#` heading that opens the first area of the first slide, below any `##` lines; never from a `##`.

### The default-area rule

- A slide with **no** area-like directive (`@area`, `@poll`, `@prompt`, `@video`, `@page`, `@qr`, `@plot`) renders as one padded full-canvas area. A one-line slide needs no coordinates.
- A slide **with** one of them must keep all content inside directive blocks. A loose line is an error. This is what catches a misspelled `@area`.

## Block marks

One line is one block. A block mark claims the start of a line and needs the space behind it, so `-5 degrees`, `#hashtag` and `2 > 1` stay plain text.

| Mark | Block |
|---|---|
| `# ` | Heading. |
| `## ` | Second-level heading: a subtitle, or a heading per column. Smaller than `# `, larger than body text. `### ` is an error. |
| `- ` | Bullet. Adjacent bullets render as one list. |
| `> ` | Quote. |
| `![alt](url)` | Image. It takes the whole line. |
| ```` ``` ```` or ```` ```elixir ```` alone on a line | Opens a code block, which runs to the next line of ```` ``` ```` alone. |
| anything else | A plain line. |

A blank line renders nothing. A gap the slide needs belongs to a second `@area`.

## Inline marks

| Mark | Meaning |
|---|---|
| `*strong*` | Bold. |
| `_emphasis_` | Italic. |
| `` `code` `` | Monospace. No mark applies inside it. |
| ```` ```code``` ```` | Monospace, for code that holds a backtick. |
| `==highlight==` | A coloured fragment. |
| `[text](url)` | A link. |
| `https://example.com` | A bare url is a link to itself. |

A mark closes on the line that opens it. Marks nest properly: `*bold _and slanted_ text*` and `==*both*==` work, and `*a _b* c_`, where one mark opens inside another and closes outside it, is an error. Strong, emphasis and highlight combine freely; code may stand inside each of them and inside a link's text; a link's text may hold every mark but a link. A mark does not nest inside itself.

A delimiter **opens** when the character behind it is not a space and no mark of its kind is open. It **closes** an open mark of its kind when the character in front of it is not a space. Everywhere else it is text, so `2 * 3` and `x == y` need no escape. A mark may open inside a word: `run*ning*` bolds `ning`. A delimiter that opens inside a word and finds no closer is text (`my_file.txt`, `C*-algebra`, `H_2O`); one that opens at the start of a word and finds no closer on its line is an error. A pair inside a word is a mark, so `snake_case_name` slants `case` and `2*3*4` bolds `3`: put such text in backticks or escape it. An in-word opener also gives way: when a mark closes, an in-word opener of another kind still open inside it is text (`*a b_c* d_e_` is bold `a b_c`, then a slanted `e`), and an in-word opener gives way to a word-start one after it (`a_b *c d_e*` is `a_b` and a bold `c d_e`). An empty pair such as `**` writes nothing.

In `` `code` `` the one escape is `` \` ``; every other backslash is a backslash. Three backticks take everything raw up to the next three on the line: ```` ```a`b``` ````. Three backticks alone on a line, with at most a language tag behind them, open a code block instead. The text of a link ends at the first `]` that is not escaped and not inside code, and its url at the `)` that balances its `(`. A bare url ends before a delimiter that closes a mark around it, so `*see https://example.com*` is a bold link; inside a link's text a bare url stays text.

Outside code, a backslash in front of `*`, `_`, `` ` ``, `=`, `!`, `#`, `-`, `>`, `[`, `]` or `\` prints that character and cancels its mark.

## Code blocks

A line of three backticks alone, or with a language tag (`_ + # . -`, letters and digits), opens a code block. The next line of three backticks alone closes it.

````
@area 120 80 800 400
```elixir
Supervisor.start_link(children, strategy: :one_for_one)
```
````

- The fence wins: between the two lines everything is code, including lines that start with `@`, `---`, `--`, `# ` or `- `. A fence that holds a `---` stays in one slide. A merge conflict marker is still an error.
- Code lines are kept raw: indentation, trailing spaces, tabs and blank lines. A code block is one block and one step; `--` inside it is code, and a `--` above it gives it the next step.
- A known tag colours the code, in the palette's colours: `elixir`, `erlang`, `heex`, `javascript`, `typescript`, `python`, `rust`, `go`, `bash`, `json`, `sql`, `html`, `css`, `yaml`, `diff`, and the short forms `ex`, `exs`, `js`, `jsx`, `ts`, `py`, `sh`, `shell`, `zsh`, `yml`, `erl`, `rs`, `golang`, `htm`, `patch`. No tag or an unknown one gives plain monospace and no error. Long lines do not wrap.
- An opener with no closer is an error on its own line and the lines after it keep their ordinary meaning. A fence with no line inside is an error. A line inside a fence that is three backticks and a tag is an error too: the fence above lacks its closer. In a `@poll` or `@notes` no code block is drawn, but an opener with no closer and a tagged line inside a fence are errors there too.

## Builds

A line of exactly `--` inside an area body is a **build mark**. It holds back everything below it until the presenter advances.

```
@area 120 80 800 400
# Why Elixir?
- processes are cheap
--
- crashes stay local
```

The slide arrives at step 0 with the heading and the first bullet. One right arrow adds the second bullet. One step counter serves the whole slide, so two areas that each carry a build mark advance together.

Every step holds at least one block: a `--` with nothing below it before the next `--` or the area end is an error, because that keypress would change nothing. A `--` on an area's first line is fine and means the area arrives on the first press.

A held-back block is absent from the page, not hidden in it, so nobody reads ahead in the source. Revealed blocks reflow as they arrive; text that must not move belongs in a second `@area`.

## Polls

```
@poll 240 200 900 500
Which BEAM language do you use?
- Elixir
- Erlang
- Gleam
```

The first non-empty line is the question, then a `-` list of at least two options. Any other non-blank line is an error.

The poll id derives from the question text, lowercased, with every run of other characters turned into a hyphen. Ballots are keyed by that id, so **rewording the question resets the votes**. Two polls whose questions derive the same id are an error.

A poll with many options is clipped at the bottom of its area. Add `cols=N` after the four coordinates to set the options in `N` columns, filled in reading order: `@poll 360 180 1200 720 cols=3` shows nine options as three rows of three. Without it a poll has one column. `N` is a positive whole number, anything else is an error on the directive line.

A voter has one option in a poll. Add `picks=N` (BC-68) to let a voter pick up to `N` options: `@poll 360 180 1200 720 cols=2 picks=2`. The voter presses an option to pick it and presses it again to take the pick back, and at `N` picks the others are disabled until one is taken back. `N` larger than the number of options means any number. `N` is a positive whole number, anything else is an error on the directive line, and `picks=` belongs to `@poll` alone. A poll takes no other attribute.

## Prompts

```beamcast
@prompt 240 200 900 500
Name one thing you expect from this talk.
```

A prompt asks the audience for one sentence. The body is exactly one non-blank line; none, or a second one, is an error on the line at fault. Each listener types one line of at most 120 characters, a later answer replaces their earlier one, and the slide shows the newest 24 answers with a count of the rest. `cols=N` sets the answers in columns as it does for a poll, and a prompt takes no other attribute. The prompt id derives from the text like a poll's, so **rewording the text starts from no answers**, and two prompts whose text derives the same id are an error. A poll and a prompt may share a wording.

## Images and backgrounds

`@background` takes a path or a url, at most once per slide and once in the header. It never takes a prompt: parsing never calls the network.

An optional word after the reference sets the fit: `cover` (the default) fills the slide and crops the picture around its centre, `contain` shows the whole picture and lets the slide colour fill the rest, as in `@background /i/<id> contain`. A slide's own `@background` brings its own fit; a slide with none takes the header's. There is no stretch.

`/i/<id>` names a picture in the store. Upload with `bc.sh image <file>`, then paste the mark it prints into `@background` or into an `![alt](/i/<id>)` line.

- 5 MB per file. png, jpeg, gif, webp, avif and svg.
- The declared content type is discarded; the leading bytes decide the type.
- A picture belongs to the presenter, not to a presentation, so one logo serves four talks.
- Nothing sweeps the store. A slide that stops naming a picture leaves it there, and a deleted picture leaves the slides that name it drawing nothing.
- `/i/<id>` is a path into one Beamcast. The same source on a second Beamcast finds nothing.

## Palette

`@palette` belongs in the deck header alone, at most once, and names one of `slate`, `ember`, `ocean`, `mono`, one of the deck owner's own palettes, or `<handle>/<name>`, a palette shared with the deck owner through a circle, such as `team-a/kimed`; `bc.sh palettes` lists every name your own decks may take beside the built-in ones. Each has a dark and a light variant that the viewer's theme picks between. Without one the presentation keeps the palette set in the editor. A deck whose palette was deleted, or whose owner lost a shared one, draws in `slate` and its next save is refused.

## Fonts

`@font /f/<slug>` draws the text of every slide in a font family the presenter uploaded in the editor's Fonts panel, and `@code-font /f/<slug>` draws code in one. Each belongs in the deck header alone, at most once. A family holds a regular file and optionally italic, bold and bold italic ones; a style it lacks is drawn with the closest one it has (italic and bold use regular, bold italic uses bold, then italic, then regular). A well-formed reference that names no family, or a deleted one, draws the default fonts. The source carries the reference, never the font, and the API has no door for fonts.

## Templates

`@template <name> <version>` in the deck header is the stamp of a template the header lines were copied from, for example `@template acme 3`. It is information only: the parser accepts it, draws nothing from it, and checks it against no stored template; the templates page can update a deck whose stamp is behind its template, rewriting the copied lines and the stamp. Leave it where it is, at most once, and never on a slide.

## The invitation

`@qr` draws the presentation's own audience link as a QR code with the link readable under it. It takes no url, because a deck knows nothing of the address the app answers on. A non-blank line below it is an error. The code is dark modules on a light ground in every palette: on the slide colour of a light slide, on a light tile of a dark one, because a scanner reads contrast and some read no light-on-dark code.

## Plots

```beamcast
@plot 240 200 1200 700
{
  "title": "Growth",
  "data": {"values": [{"x": 0, "y": 1}, {"x": 1, "y": 3}, {"x": 2, "y": 2}]},
  "mark": "line",
  "encoding": {
    "x": {"field": "x", "type": "quantitative"},
    "y": {"field": "y", "type": "quantitative", "title": "count", "scale": {"domain": [0, 5]}}
  }
}
```

The body is one JSON object, a strict subset of Vega-Lite 5, and the key list is closed: any other key is an error on its line. The box (`@plot x y w h`) sets the size, so there is no `width`, `height`, `config`, `layer`, `facet`, `aggregate` or `bin`, no `temporal` type, no `data.url` and no stacked bars; a spec copied from Vega-Lite usually needs those keys taken out. Keys:

- `data.values`: 1 to 2000 flat rows of numbers and strings; a number is 0 or between 1e-15 and 1e15 in size. Or `data.sequence` instead: `start`, `stop` (exclusive), `step` (default 1, not 0), `as` (default `"data"`); 1 to 2000 rows. Or `data.name`, a poll's tally (below).
- `mark`: `"line"`, `"point"`, `"bar"`, or `{"type": "line", "point": true}`.
- `encoding.x` and `encoding.y`: each `field` and `type` (`"quantitative"`, `"nominal"` or `"ordinal"`), an optional `title`, and on a quantitative channel `scale.domain`, two numbers, the lower first. Without a domain the axis runs over the data, extended to zero and rounded out to nice numbers; all values 0 give 0 to 1.
- `encoding.color` (line and point only): `field`, `type` `"nominal"`, optional `title`, optional `legend: {"orient": ...}` with `"right"`, `"bottom"`, `"top-left"`, `"top-right"`, `"bottom-left"` or `"bottom-right"` (any other key or value is an error); at most 4 series. Without `orient` the legend stands right of the plot if the data keeps half the width, else in one row below, else in a corner no datum or line crosses, else right with a data area of at least 104x104. A plot in a box too small for its parts is drawn smaller (every part stays; its text gets smaller than the deck's): make the box larger to get the text sizes of the deck; such a plot gives a warning, `warnings: [{line, message}]` in the API, that names the least area on the 1920x1080 slide which shows it at full size (BC-24), about 270x310 for a line plot with titles and 330x350 or more with a legend.
- `transform`: at most 16 steps in order, each `{"calculate": "<expression>", "as": "<field>"}` or one `{"fold": ["a", "b"], "as": ["key", "value"]}` (the 2000 rows hold after every step; a fold carries at most 16 fields; a name in `as` takes at most 64 characters, and a text in a row is cut at 64).
- `title`, and `$schema` (ignored). An empty title is none.

A line joins the rows in x order and breaks at a row that lacks its y value; a row without x is not drawn. An axis runs over the drawn rows. The y of a line or point is quantitative. A bar has one nominal or ordinal axis (names on x: upright bars, on y: bars lying across) and one quantitative axis from zero (or from the edge of a written `scale.domain` nearest zero), one row per name, and no `color`. Names and series keep the order of their first row. An axis whose tick labels would be longer than 5 characters divides them by a power of ten (a multiple of 3) and writes the factor on the axis, `×10⁹` above the y axis or at the right end of the x axis; the axis title stays as written, and the hover title keeps the exact value. A plot a reader zooms deep into may count its labels from an offset, the leading digits all its ticks share, which stands with the factor above the y axis or at the right end of the x axis, `×10⁻³ +0.99`; a plot shown whole never does, but every quantitative y axis keeps the band above it for that mark. A name, an axis title and the plot title are cut to their room by an estimate: a Chinese, Japanese or Korean letter takes the room of about two Latin ones, so it is cut after fewer letters. The colours and the font are the deck's; the series take the accent, the two code colours and the ink.

An expression is closed: numbers, `datum.<field>`, `+ - * /`, a sign, parentheses, `PI`, `E`, `sin cos tan asin acos atan exp log sqrt abs floor ceil round` (one argument), `atan2` and `pow` (two), `min` and `max` (two or more); at most 200 characters and 32 deep; `^` is an error that names `pow`. A value that is not finite or above 1e15 in size is no value and breaks a line; one below 1e-15 is 0. A deck computes at most 100 000 rows over all its plots, and its plots make at most 20 MB of markup together, by an estimate of each datum with the characters of its texts (a `"` counts 6 bytes) and of the axes and titles (about 140 bytes a point in plain text, 20 to 30 kB a plot). A value in a datum's hover title is cut at 64 characters (code points) and otherwise shows the number exactly; a fold may not name a field twice.

A function from a range and an expression:

```beamcast
@plot 240 200 1200 700
{
  "data": {"sequence": {"start": 0, "stop": 6.3, "step": 0.1, "as": "x"}},
  "transform": [{"calculate": "sin(datum.x)", "as": "y"}],
  "mark": "line",
  "encoding": {
    "x": {"field": "x", "type": "quantitative"},
    "y": {"field": "y", "type": "quantitative", "title": "sin x"}
  }
}
```

A bar chart, one row per name:

```beamcast
@plot 240 200 1200 700
{
  "data": {"values": [{"lang": "Elixir", "n": 42}, {"lang": "Erlang", "n": 17}, {"lang": "Gleam", "n": 9}]},
  "mark": "bar",
  "encoding": {
    "x": {"field": "lang", "type": "nominal"},
    "y": {"field": "n", "type": "quantitative", "title": "users"}
  }
}
```

Two series: put the values in one field and the series name in another, with `color` on the name. With computed rows, `fold` does it; with listed rows, write one row per series and point.

```beamcast
@plot 240 200 1200 700
{
  "data": {"sequence": {"start": 0, "stop": 6.3, "step": 0.1, "as": "x"}},
  "transform": [
    {"calculate": "sin(datum.x)", "as": "sin"},
    {"calculate": "cos(datum.x)", "as": "cos"},
    {"fold": ["sin", "cos"], "as": ["function", "value"]}
  ],
  "mark": "line",
  "encoding": {
    "x": {"field": "x", "type": "quantitative"},
    "y": {"field": "value", "type": "quantitative"},
    "color": {"field": "function", "type": "nominal"}
  }
}
```

The live result of a poll (BC-5): `"data": {"name": "poll:<poll id>"}`, where the poll id is the one the deck derives from the question, and the poll stands on any slide of the deck, before or after the plot. `name` takes no `values` or `sequence` beside it; an id with no poll in the deck is an error on the line of the name. The rows are one for each option in the poll's order, with `option` (the text), `votes` (the voters who picked the option) and `percent` (the option's share of the voters, 0 to 100, one decimal, 0 with no voter; the parts need not sum to exactly 100, and with `picks=` they may sum to more), and `transform` works on them. The plot follows the votes on every open screen. It shows no vote in the editor preview, the slide list, on the print page and in the PDF, and in a published deck read alone. The y axis runs over the data, so its ticks change while votes arrive; write `"scale": {"domain": [0, 100]}` on `percent` to hold it still.

```beamcast
@poll 240 200 900 500
Which BEAM language do you use?
- Elixir
- Erlang
- Gleam
---
@plot 240 200 1200 700
{
  "data": {"name": "poll:which-beam-language-do-you-use"},
  "mark": "bar",
  "encoding": {
    "x": {"field": "option", "type": "nominal", "title": "language"},
    "y": {"field": "percent", "type": "quantitative", "scale": {"domain": [0, 100]}}
  }
}
```

## What the parser refuses

1. An unknown directive.
2. Loose content on a slide that declares an area-like directive.
3. Coordinates off the canvas, or a wrong count of numbers.
4. An unknown `key=value` on `@area`, or an `align` or `size` value off its range.
5. A `@poll` without a question or with fewer than two options.
6. A `@page` that shares its slide with other content.
7. A second `@background` on one slide or in the header.
8. A `@deck` anywhere but line 1, or any line in the header other than `@background`, `@palette`, `@template`, `@font` or `@code-font`.
9. Two polls with the same derived id.
10. A non-blank line below the url line of a `@video`.
11. A line in a `@poll` body that is neither the question nor a `-` option.
12. A heading below the second level, such as `### `, a line that starts with `##` and no space, or a `## ` with no text.
13. An inline mark that opens at the start of a word and never closes on its line, or one that opens inside another mark and closes outside it.
14. A line that starts with `![` and is not a whole `![alt](url)`.
15. A build mark with no block below it.
16. A `@palette` that names neither a built-in palette nor one of the deck owner's nor one shared with the deck owner, a second one, or one on a slide.
17. A non-blank line below a `@qr`.
18. A `@template` without a name and a positive version, a second one in the header, or one on a slide.
19. A word after a `@background` reference other than `cover` or `contain`, or more than one word.
20. A `@font` or `@code-font` that is not `/f/<slug>`, a second one of either in the header, or one on a slide.
21. A code block that opens and never closes, one with no line inside, or one that holds a line of three backticks and a tag.
22. A `@plot` with an empty body, a body that is not one JSON object, a duplicate key, an unknown key, a missing required key, a value of the wrong type, a `field` no row holds, a string in a quantitative field, more than 2000 rows, a `data.name` that is not `poll:` and the id of a poll in the deck or that stands beside `values` or `sequence`, a bar without one name axis and one quantitative axis, a bar with `color`, a repeated name on a bar, a line or point with a y that is not quantitative, a `color` that is not nominal, a fifth series, a `scale` on a name axis, a bad `sequence` or `transform` step, an expression outside the language, an `as` name over 64 characters, or a deck over 100 000 computed rows or 20 MB of markup. Each error names the line of the key or value at fault.
23. A `@prompt` with no text line, a second non-blank line in its body, a `cols` that is not a positive whole number or another attribute, or two prompts of one derived id.
24. A `picks=` or `cols=` on a `@poll` that is not a positive whole number, or a `picks=` on a `@prompt` (BC-68).

## Worked example

```
@deck
@palette mono
@background /i/Jz7qP0aXm2Kd8Rue
---
@area 120 80 1100 400
# Beamcast
One deck. Every screen.
@qr 1400 680 360 340
@notes greet, state the plan
---
@background https://example.com/mountains.png
@area 120 80 800 400
# Why Elixir?
- processes are ==cheap==
--
- crashes stay local, because a `Supervisor` restarts them
@area 1000 700 800 300 align=center size=0.9
> "Let it crash" — _Joe Armstrong_
---
@poll 240 200 900 500
Which BEAM language do you use?
- Elixir
- Erlang
- Gleam
---
@page /course/lesson-1.html
```
