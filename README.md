# trobanga marketplace

A [Claude Code](https://docs.claude.com/en/docs/claude-code) plugin marketplace.
It holds two plugins: a set of engineering and gamedev skills, and a progress mod for the
`implement` workflow.

## Install

Add the marketplace, then install the plugins you want:

```
/plugin marketplace add trobanga/claude-plugins
/plugin install trobanga-skills@trobanga
/plugin install trobanga-progress@trobanga
```

Claude Code reads the plugins from the default branch. To get updates, run
`/plugin marketplace update trobanga`.

### pi

The repository is also a [pi](https://pi.dev) package. It gives the skills of
`trobanga-skills` and, with the `pi-subagents` package, its agents:

```
pi install git:github.com/trobanga/claude-plugins
```

`trobanga-progress` is a Claude Code mod and does not run in pi.

## Plugins

| Plugin | Version | What it does |
| --- | --- | --- |
| [trobanga-skills](plugins/trobanga-skills) | 0.1.0 | 30+ skills: TDD, coverage, CRAP score, mutation testing, architecture review, Bevy, Godot, Unity, writing. |
| [trobanga-progress](plugins/trobanga-progress) | 0.1.0 | Mod: progress bar for `implement` and a live panel of subagents. |

## Hooks and safety

`trobanga-skills` installs no hooks.

`trobanga-progress` is a mod: it installs function hooks. They observe subagent
spawns, model steps and turn ends to count tokens, and they draw UI. They do not
change or block any tool call, and they make no network, file or process calls.
The two tools that it registers (`progress`, `step`) only change its own panel
state, and they type-check and clamp their input.

## Repository layout

```
.claude-plugin/marketplace.json     the marketplace manifest
plugins/<name>/.claude-plugin/      the plugin manifest
plugins/<name>/skills/              skills
plugins/<name>/agents/              subagents (generated, see below)
plugins/<name>/pi/agents/           the same subagents for pi (generated)
src/agents/                         the source of each subagent
package.json                        the pi package manifest
plugins/<name>/hooks/hooks.json     hook registration
plugins/<name>/scripts/             hook scripts
```

## Contributing

Open an issue or a pull request. When you change a plugin, bump the `version` in
both `plugins/<name>/.claude-plugin/plugin.json` and the matching entry in
`.claude-plugin/marketplace.json`. CI checks that the two agree.

Edit an agent in `src/agents/`, not in `plugins/`. Then run
`python3 scripts/gen_agents.py`, which writes the Claude Code and the pi version.
A source uses harness-neutral tool names (`shell`, `read`, `edit`, `write`,
`search`, `find`) and the model alias `sonnet`. CI fails when a generated file
is out of date.

## Credits

> "Good coders copy, great coders steal."
>
> — attributed to Pablo Picasso

Fourteen skills in `trobanga-skills` are derived from
[mattpocock/skills](https://github.com/mattpocock/skills) by Matt Pocock. Some
are close to the original, some are rewritten, all started there:

`conformance-review`, `domain-modeling`, `grill-with-docs`, `grilling`,
`handoff`, `improve-codebase-architecture`, `prototype`, `reflect`, `research`,
`tdd`, `teach`, `to-spec`, `to-tickets`, `wayfinder`.

That work is MIT licensed. The notice is at
[plugins/trobanga-skills/LICENSES/mattpocock-skills-MIT.txt](plugins/trobanga-skills/LICENSES/mattpocock-skills-MIT.txt),
and it governs those skills.

Two skills are derived from
[humanlayer/skills](https://github.com/humanlayer/skills) by Dex Horthy at
HumanLayer: `show-me`, close to the original, and `pr`, which builds on it. That
work is MIT licensed. The notice is at
[plugins/trobanga-skills/LICENSES/humanlayer-skills-MIT.txt](plugins/trobanga-skills/LICENSES/humanlayer-skills-MIT.txt),
and it governs those two skills.

`trobanga-progress` is derived from `savvy-progress` 1.2.0 in
[johnnyvizz/claude-kit](https://github.com/johnnyvizz/claude-kit) by johnnyvizz.
That work is MIT licensed, and so is this plugin. The notice is at
[plugins/trobanga-progress/LICENSE](plugins/trobanga-progress/LICENSE).

`reverse-engineer-anything` is the REA skill from
[morluto/rea](https://github.com/morluto/rea) by morluto. That work is MIT
licensed. The notice is at
[plugins/trobanga-skills/LICENSES/rea-MIT.txt](plugins/trobanga-skills/LICENSES/rea-MIT.txt),
and it governs that skill.

Everything else here is Apache-2.0.

`improve-codebase-architecture` also draws on "Design It Twice" from John
Ousterhout, *A Philosophy of Software Design*.

## License

Apache-2.0, except the work credited above. See [LICENSE](LICENSE). Each plugin
carries the MIT notices that govern its derived parts, so the notices ship with
an install: [plugins/trobanga-skills/LICENSES/](plugins/trobanga-skills/LICENSES)
and [plugins/trobanga-progress/LICENSE](plugins/trobanga-progress/LICENSE).
