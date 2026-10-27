import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

SCRIPT = Path(__file__).with_name("run_hf_whisper.py")
SPEC = importlib.util.spec_from_file_location("run_hf_whisper", SCRIPT)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(MODULE)


class HuggingFaceRunnerTests(unittest.TestCase):
    def test_transcribe_reads_provider_text(self):
        with tempfile.TemporaryDirectory() as folder:
            audio = Path(folder) / "clip.mp3"
            audio.write_bytes(b"fake audio bytes")
            response = MagicMock()
            response.__enter__.return_value.read.return_value = json.dumps({"text": "Čekaj me noćas"}).encode()
            with patch.object(MODULE.urllib.request, "urlopen", return_value=response) as mocked:
                result = MODULE.transcribe(audio, "https://example.invalid/asr", "test-token", 10, 0)
            self.assertEqual(result, "Čekaj me noćas")
            request = mocked.call_args.args[0]
            self.assertEqual(request.data, b"fake audio bytes")
            self.assertEqual(request.get_header("Authorization"), "Bearer test-token")

    def test_transcribe_rejects_empty_audio(self):
        with tempfile.TemporaryDirectory() as folder:
            audio = Path(folder) / "clip.mp3"
            audio.write_bytes(b"")
            with self.assertRaisesRegex(ValueError, "empty"):
                MODULE.transcribe(audio, "https://example.invalid/asr", "test-token", 10, 0)

    def test_transcribe_rejects_unsupported_extension(self):
        with tempfile.TemporaryDirectory() as folder:
            audio = Path(folder) / "clip.txt"
            audio.write_text("not audio", encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "Unsupported audio extension"):
                MODULE.transcribe(audio, "https://example.invalid/asr", "test-token", 10, 0)


if __name__ == "__main__":
    unittest.main()
