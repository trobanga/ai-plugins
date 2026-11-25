"""The JaCoCo collector on the report of a Kotlin build.

The fixture copies the shapes that Kotlin 2.1 and JaCoCo 0.8.12 write.
"""

import io
import unittest
from textwrap import dedent

import collect_java
import crap_core

REPORT = dedent("""\
    <?xml version="1.0" encoding="UTF-8"?>
    <report name="probe">
      <package name="a/b">
        <class name="a/b/LambdasKt" sourcefilename="Lambdas.kt">
          <method name="keepsLambda" desc="(I)Lkotlin/jvm/functions/Function1;" line="4">
            <counter type="LINE" missed="0" covered="2"/>
            <counter type="COMPLEXITY" missed="0" covered="1"/>
          </method>
          <method name="keepsLambda$lambda$0" desc="(II)I" line="5">
            <counter type="LINE" missed="0" covered="1"/>
            <counter type="BRANCH" missed="1" covered="1"/>
            <counter type="COMPLEXITY" missed="1" covered="1"/>
          </method>
          <method name="anonObject" desc="(I)Ljava/lang/Runnable;" line="11">
            <counter type="LINE" missed="0" covered="2"/>
            <counter type="COMPLEXITY" missed="0" covered="1"/>
          </method>
          <method name="afterAll" desc="(I)I" line="28">
            <counter type="LINE" missed="0" covered="2"/>
            <counter type="BRANCH" missed="1" covered="1"/>
            <counter type="COMPLEXITY" missed="1" covered="1"/>
          </method>
        </class>
        <class name="a/b/ProbeKt" sourcefilename="Probe.kt">
          <method name="withDefault" desc="(II)I" line="6">
            <counter type="LINE" missed="1" covered="1"/>
            <counter type="BRANCH" missed="1" covered="1"/>
            <counter type="COMPLEXITY" missed="1" covered="1"/>
          </method>
          <method name="withDefault$default" desc="(IIILjava/lang/Object;)I" line="5">
            <counter type="LINE" missed="0" covered="1"/>
            <counter type="COMPLEXITY" missed="0" covered="1"/>
          </method>
        </class>
        <class name="a/b/Point" sourcefilename="Point.kt">
          <method name="&lt;init&gt;" desc="(II)V" line="3">
            <counter type="LINE" missed="0" covered="1"/>
            <counter type="COMPLEXITY" missed="0" covered="1"/>
          </method>
          <method name="getX" desc="()I" line="3">
            <counter type="LINE" missed="1" covered="0"/>
            <counter type="COMPLEXITY" missed="1" covered="0"/>
          </method>
          <method name="getY" desc="()I" line="3">
            <counter type="LINE" missed="1" covered="0"/>
            <counter type="COMPLEXITY" missed="1" covered="0"/>
          </method>
          <method name="getSum" desc="()I" line="5">
            <counter type="LINE" missed="0" covered="1"/>
            <counter type="COMPLEXITY" missed="0" covered="1"/>
          </method>
        </class>
        <class name="a/b/LambdasKt$anonObject$r$1" sourcefilename="Lambdas.kt">
          <method name="&lt;init&gt;" desc="(I)V" line="11">
            <counter type="LINE" missed="0" covered="1"/>
            <counter type="COMPLEXITY" missed="0" covered="1"/>
          </method>
          <method name="run" desc="()V" line="13">
            <counter type="LINE" missed="0" covered="2"/>
            <counter type="BRANCH" missed="1" covered="1"/>
            <counter type="COMPLEXITY" missed="1" covered="1"/>
          </method>
        </class>
      </package>
    </report>
    """)


def collect(include_lambdas=False):
    return list(collect_java.records(io.StringIO(REPORT), include_lambdas))


def by_name(records):
    return {r["name"].rsplit(".", 1)[1]: r for r in records}


class KotlinLambdaTest(unittest.TestCase):

    def test_a_kotlin_lambda_does_not_cut_the_function_around_it(self):
        self.assertEqual(10, by_name(collect())["keepsLambda"]["end"])

    def test_an_anonymous_object_does_not_cut_the_function_around_it(self):
        self.assertEqual(27, by_name(collect())["anonObject"]["end"])



class SameFirstLineTest(unittest.TestCase):
    """A data class gives its constructor and its properties one line."""

    def test_methods_with_the_same_first_line_share_the_range(self):
        records = by_name(collect())
        self.assertEqual([4, 4, 4], [records[n]["end"]
                                     for n in ("<init>", "getX", "getY")])



class DefaultArgumentsTest(unittest.TestCase):
    """Kotlin compiles default arguments into a wrapper foo$default."""

    def test_the_wrapper_has_no_record_of_its_own(self):
        self.assertNotIn("withDefault$default", by_name(collect()))

    def test_the_function_starts_at_the_line_of_the_wrapper(self):
        # the wrapper carries the line of the signature, where the
        # default values are
        self.assertEqual(5, by_name(collect())["withDefault"]["start"])



class SourcePathTest(unittest.TestCase):
    """Kotlin lets the directory differ from the package.

    The Kotlin style guide even recommends to omit the common root
    package from the directories.
    """

    DIFF = dedent("""\
        --- a/app/src/main/kotlin/Probe.kt
        +++ b/app/src/main/kotlin/Probe.kt
        @@ -7,0 +8,1 @@
        +    if (x < 0) return 0
        """)

    def test_a_record_names_the_source_file_with_its_package(self):
        records = list(collect_java.records(
            io.StringIO(REPORT),
            sources={"app/src/main/kotlin/Probe.kt": "a.b"}))
        rows = crap_core.score(records, io.StringIO(self.DIFF))
        self.assertEqual(["a/b/ProbeKt.withDefault"], [r[0] for r in rows])

    def test_two_sources_with_the_same_package_and_name_keep_the_report_path(self):
        records = collect_java.records(
            io.StringIO(REPORT),
            sources={"app/src/main/kotlin/Probe.kt": "a.b",
                     "lib/src/main/kotlin/Probe.kt": "a.b"})
        files = {r["file"] for r in records if r["name"].startswith("a/b/ProbeKt")}
        self.assertEqual({"a/b/Probe.kt"}, files)


    def test_outside_a_git_repository_the_report_path_stays(self):
        import os
        import shutil
        import tempfile
        old_cwd, tmp = os.getcwd(), tempfile.mkdtemp()
        try:
            os.chdir(tmp)
            with open("jacoco.xml", "w") as fh:
                fh.write(REPORT)
            files = {r["file"] for r in collect_java.collect("jacoco.xml")}
        finally:
            os.chdir(old_cwd)
            shutil.rmtree(tmp)
        self.assertIn("a/b/Probe.kt", files)



class KotlinSourcesTest(unittest.TestCase):
    """The listing of Kotlin sources in a git repository."""

    def setUp(self):
        import os
        import subprocess
        import tempfile
        self.old_cwd, self.dir = os.getcwd(), tempfile.mkdtemp()
        os.chdir(self.dir)
        self.git = lambda *a: subprocess.run(
            ["git", *a], check=True, capture_output=True,
            env={**os.environ, "GIT_AUTHOR_NAME": "t", "GIT_AUTHOR_EMAIL": "t@t",
                 "GIT_COMMITTER_NAME": "t", "GIT_COMMITTER_EMAIL": "t@t"})
        self.git("init", "-q", "-b", "main")

    def tearDown(self):
        import os
        import shutil
        os.chdir(self.old_cwd)
        shutil.rmtree(self.dir)

    def write(self, path, text):
        with open(path, "w") as fh:
            fh.write(text)

    def test_a_deleted_tracked_file_is_skipped(self):
        import os
        self.write("Gone.kt", "package a.b\n")
        self.write("Kept.kt", "package a.b\n")
        self.git("add", ".")
        self.git("commit", "-q", "-m", "base")
        os.remove("Gone.kt")
        self.assertEqual({"Kept.kt": "a.b"}, collect_java.kotlin_sources())


if __name__ == "__main__":
    unittest.main()
