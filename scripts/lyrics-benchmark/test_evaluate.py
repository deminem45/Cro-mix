import importlib.util
import unittest
from pathlib import Path

SCRIPT = Path(__file__).with_name("evaluate.py")
SPEC = importlib.util.spec_from_file_location("lyrics_benchmark_evaluate", SCRIPT)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(MODULE)


class LyricsBenchmarkTests(unittest.TestCase):
    def test_identical_transcript_has_zero_error(self):
        metrics = MODULE.score("Čekaj me noćas", "Čekaj me noćas", "hr", True)
        self.assertEqual(metrics["WER"], 0)
        self.assertEqual(metrics["CER"], 0)

    def test_single_word_substitution(self):
        metrics = MODULE.score("volim te jako", "volim te malo", "hr", True)
        self.assertAlmostEqual(metrics["WER"], 1 / 3)

    def test_serbian_cyrillic_and_latin_are_equivalent_by_default(self):
        metrics = MODULE.score("Љубав је", "Ljubav je", "sr", True)
        self.assertEqual(metrics["WER"], 0)

    def test_serbian_script_can_be_scored_separately(self):
        metrics = MODULE.score("Љубав је", "Ljubav je", "sr", False)
        self.assertGreater(metrics["WER"], 0)

    def test_diacritics_are_not_removed(self):
        metrics = MODULE.score("čeka", "ceka", "hr", True)
        self.assertGreater(metrics["CER"], 0)


if __name__ == "__main__":
    unittest.main()
