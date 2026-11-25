import contextlib
import io
import json
import os
import shutil
import subprocess
import tempfile
import unittest

import crap_score


class DetectTest(unittest.TestCase):

    def setUp(self):
        self.dir = tempfile.mkdtemp()
        self.old_cwd = os.getcwd()
        os.chdir(self.dir)

    def tearDown(self):
        os.chdir(self.old_cwd)
        shutil.rmtree(self.dir)

    def marker(self, name):
        open(name, "w").close()

    def test_detects_java_from_pom_xml(self):
        self.marker("pom.xml")
        self.assertEqual("java", crap_score.detect())

    def test_detects_kotlin_from_a_groovy_gradle_build(self):
        self.marker("build.gradle")
        self.assertEqual("kotlin", crap_score.detect())

    def test_detects_go_from_go_mod(self):
        self.marker("go.mod")
        self.assertEqual("go", crap_score.detect())

    def test_detects_rust_from_cargo_toml(self):
        self.marker("Cargo.toml")
        self.assertEqual("rust", crap_score.detect())

    def test_detects_elixir_from_mix_exs(self):
        self.marker("mix.exs")
        self.assertEqual("elixir", crap_score.detect())

    def test_detects_typescript_from_package_json(self):
        self.marker("package.json")
        self.assertEqual("ts", crap_score.detect())

    def test_an_unknown_project_is_refused(self):
        with self.assertRaises(SystemExit):
            crap_score.detect()

    def test_a_javascript_toolchain_beside_a_backend_does_not_win(self):
        # a Go or Java repository often ships a package.json for its frontend
        self.marker("package.json")
        self.marker("go.mod")
        self.assertEqual("go", crap_score.detect())


class KotlinRangeTest(unittest.TestCase):
    """A Kotlin change in a JVM build is scored, not filtered out."""

    def setUp(self):
        self.dir = tempfile.mkdtemp()
        self.old_cwd = os.getcwd()
        os.chdir(self.dir)
        self.git("init", "-q", "-b", "main")
        os.makedirs("src/main/kotlin")
        self.write("src/main/kotlin/Probe.kt", "package a.b\n\nfun f() = 1\n")

    def tearDown(self):
        os.chdir(self.old_cwd)
        shutil.rmtree(self.dir)

    def git(self, *args):
        subprocess.run(
            ["git", *args], check=True, capture_output=True,
            env={**os.environ, "GIT_AUTHOR_NAME": "t", "GIT_AUTHOR_EMAIL": "t@t",
                 "GIT_COMMITTER_NAME": "t", "GIT_COMMITTER_EMAIL": "t@t"})

    def write(self, path, text):
        with open(path, "w") as fh:
            fh.write(text)

    def score(self, marker):
        self.write(marker, "")
        self.git("add", ".")
        self.git("commit", "-q", "-m", "base")
        self.write("src/main/kotlin/Probe.kt",
                   "package a.b\n\nfun f() = 1\nfun g() = 2\n")
        self.git("commit", "-q", "-am", "change")
        self.write("records.jsonl", json.dumps(
            {"file": "src/main/kotlin/Probe.kt", "name": "a/b/ProbeKt.g",
             "start": 4, "end": None, "cc": 1, "coverage": 1.0}) + "\n")
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            crap_score.cli(["--range", "HEAD~1...HEAD",
                            "--records", "records.jsonl"])
        return out.getvalue()

    def test_a_kotlin_change_in_a_maven_build_is_scored(self):
        self.assertIn("1 changed functions", self.score("pom.xml"))

    def test_a_kotlin_change_in_a_gradle_build_is_scored(self):
        self.assertIn("1 changed functions", self.score("build.gradle.kts"))


class LanguageTableTest(unittest.TestCase):

    def test_every_language_names_a_collector_and_a_source_pattern(self):
        for lang, spec in crap_score.LANGUAGES.items():
            self.assertTrue(spec.module, lang)
            self.assertTrue(spec.sources, lang)
            self.assertTrue(spec.report, lang)


if __name__ == "__main__":
    unittest.main()
