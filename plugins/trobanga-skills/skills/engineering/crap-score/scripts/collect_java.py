"""Function records for Java and Kotlin, from a JaCoCo XML report.

JaCoCo gives the first code line of a method and no end line. A method
ends where the next method of the same source file starts, across inner
classes. The last method of a file is open-ended. Lambdas and the
methods of anonymous classes live inside a method and cut no range.

Coverage is the branch coverage of the method. A method without branches
has no BRANCH counter; for it (cc = 1) line coverage is equivalent.

Kotlin adds two rules: a wrapper foo$default merges into foo, and a
source file is found by its package, because its directory may differ.
"""

import re
import subprocess
import xml.etree.ElementTree as ET
from collections import defaultdict

import crap_core


def is_lambda(name):
    # Java: lambda$bar$0; Kotlin: bar$lambda$0
    return name.startswith("lambda$") or "$lambda$" in name


def is_anonymous(cls):
    """Foo$1 (Java), FooKt$bar$r$1 (Kotlin): a class without a name."""
    return any(part.isdigit() for part in cls.split("$")[1:])


def is_nested(entry):
    """A lambda or a method of an anonymous class lives inside a method."""
    _, cls, name, *_ = entry
    return is_lambda(name) or is_anonymous(cls)


def method_entry(m):
    counters = {
        c.get("type"): (int(c.get("missed")), int(c.get("covered")))
        for c in m.findall("counter")
    }
    cc = sum(counters["COMPLEXITY"])
    kind = "branch" if "BRANCH" in counters else "line"
    missed, covered = counters.get("BRANCH", counters["LINE"])
    return int(m.get("line")), m.get("name"), cc, covered / (missed + covered), kind


def fold_defaults(entries):
    """Merge each Kotlin wrapper foo$default into its function foo.

    The wrapper starts at the signature line, the function at its first
    code line. The function takes the start of the wrapper, so an edit of
    a default value maps to it. With overloads, the nearest foo below the
    wrapper is its function.
    """
    defaults = [e for e in entries if e[2].endswith("$default")]
    result = [e for e in entries if not e[2].endswith("$default")]
    for start, cls, name, *_ in defaults:
        base = name[:-len("$default")]
        below = [i for i, e in enumerate(result)
                 if e[1] == cls and e[2] == base and e[0] >= start]
        if below:
            i = min(below, key=lambda i: result[i][0])
            result[i] = (start, *result[i][1:])
    return result


def with_ranges(entries):
    """Attach end = start of the next entry - 1; the last entry is open.

    Entries with the same start (a Kotlin data class gives its constructor
    and its properties one line) share the range up to the next start.
    """
    entries = sorted(entries)
    starts = sorted({e[0] for e in entries})
    following = dict(zip(starts, starts[1:]))
    for entry in entries:
        nxt = following.get(entry[0])
        yield entry, nxt - 1 if nxt is not None else None


PACKAGE = re.compile(r"^\s*package\s+([\w.]+)", re.MULTILINE)


def kotlin_sources():
    """Map every Kotlin source under the working directory to its package."""
    listing = subprocess.run(
        ["git", "ls-files", "-z", "--cached", "--others", "--exclude-standard",
         "--", "*.kt"],
        capture_output=True, text=True)
    # outside a git repository, the records keep the JaCoCo paths
    paths = listing.stdout.split("\0") if listing.returncode == 0 else []
    sources = {}
    for path in filter(None, paths):
        try:
            with open(path, encoding="utf-8", errors="replace") as fh:
                match = PACKAGE.search(fh.read())
        except OSError:
            continue  # tracked, but deleted in the working tree
        sources[path] = match.group(1) if match else ""
    return sources


def source_index(sources):
    """'package/dir/File.kt' -> the one source path, as JaCoCo names it.

    Kotlin lets the directory differ from the package. A key that two
    sources share stays out, the record then keeps the JaCoCo path.
    """
    index = {}
    for path, package in sources.items():
        key = package.replace(".", "/") + "/" + path.rsplit("/", 1)[-1]
        index.setdefault(key, []).append(path)
    return {key: paths[0] for key, paths in index.items() if len(paths) == 1}


def records(report, include_lambdas=False, sources=None):
    """Yield one record per method of the report.

    `sources` maps a Kotlin source path to its package; see source_index.
    """
    index = source_index(sources or {})
    per_file = defaultdict(list)
    for package in ET.parse(report).iter("package"):
        for cls in package.findall("class"):
            key = package.get("name") + "/" + cls.get("sourcefilename")
            key = index.get(key, key)
            for m in cls.findall("method"):
                start, name, cc, coverage, kind = method_entry(m)
                per_file[key].append(
                    (start, cls.get("name"), name, cc, coverage, kind))
    for key, entries in per_file.items():
        entries = fold_defaults(entries)
        named = [e for e in entries if not is_nested(e)]
        lambdas = [e for e in entries if is_nested(e)] if include_lambdas else []
        # a lambda lives inside a named method and must not cut its range
        for group in (named, lambdas):
            for (start, cls, name, cc, coverage, kind), end in with_ranges(group):
                yield {"file": key, "name": f"{cls}.{name}", "start": start,
                       "end": end, "cc": cc, "coverage": coverage, "kind": kind}


def collect(report, include_lambdas=False, **_):
    """The uniform collector interface: a report path -> records."""
    with open(report) as fh:
        return list(records(fh, include_lambdas, kotlin_sources()))


def cli(argv=None):
    import argparse
    import sys

    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("--report", required=True, help="JaCoCo XML report")
    p.add_argument("--include-lambdas", action="store_true")
    a = p.parse_args(argv)
    with open(a.report) as report:
        crap_core.emit(records(report, a.include_lambdas, kotlin_sources()),
                       sys.stdout)
    return 0


if __name__ == "__main__":
    raise SystemExit(cli())
