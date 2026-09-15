import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


SCRIPTS_DIR = Path(__file__).resolve().parents[1] / "skills" / "analyze-sessions" / "scripts"
sys.path.insert(0, str(SCRIPTS_DIR))
import sessions  # noqa: E402


class AnalyzeSessionsTest(unittest.TestCase):
    def setUp(self):
        self.tempdir = tempfile.TemporaryDirectory(prefix="pi-session-test-")
        self.sessions_root = Path(self.tempdir.name) / "sessions"
        self.sessions_root.mkdir()
        self.previous_root = sessions.SESSIONS_ROOT
        sessions.SESSIONS_ROOT = self.sessions_root

    def tearDown(self):
        sessions.SESSIONS_ROOT = self.previous_root
        self.tempdir.cleanup()

    def write_session(self, session_id="session-1"):
        session_dir = self.sessions_root / "encoded-project--"
        session_dir.mkdir()
        path = session_dir / "session.jsonl"
        records = [
            {
                "type": "session",
                "id": session_id,
                "cwd": "/tmp/project",
                "timestamp": "2026-01-01T12:00:00Z",
            },
            {"type": "model_change", "provider": "google", "modelId": "gemini-test"},
            {
                "type": "message",
                "message": {
                    "role": "user",
                    "timestamp": 1767268800000,
                    "content": [{"type": "text", "text": "Investigate the API error."}],
                },
            },
            {
                "type": "message",
                "message": {
                    "role": "assistant",
                    "provider": "google",
                    "model": "gemini-test",
                    "usage": {
                        "input": 100,
                        "output": 25,
                        "cacheRead": 10,
                        "cacheWrite": 5,
                        "cost": {
                            "input": 0.10,
                            "output": 0.20,
                            "cacheRead": 0.01,
                            "cacheWrite": 0.02,
                            "total": 0.33,
                        },
                    },
                    "content": [{"type": "text", "text": "I found the failing request."}],
                },
            },
            {
                "type": "message",
                "message": {
                    "role": "toolResult",
                    "toolName": "bash",
                    "isError": True,
                    "content": [{"type": "text", "text": "failed"}],
                },
            },
        ]
        path.write_text("\n".join(json.dumps(record) for record in records) + "\n")
        return path

    def test_summary_aggregates_usage_and_errors(self):
        path = self.write_session()
        summary = sessions.summarize_session(path)

        self.assertIsNotNone(summary)
        self.assertEqual(summary.cwd, "/tmp/project")
        self.assertEqual(summary.models, {"gemini-test"})
        self.assertEqual(summary.providers, {"google"})
        self.assertEqual(summary.cost_total, 0.33)
        self.assertEqual(summary.tok_input, 100)
        self.assertEqual(summary.tok_output, 25)
        self.assertEqual(summary.error_count, 1)

    def test_redaction_hides_common_credentials(self):
        text = (
            "Authorization: Bearer abc.def.ghi api_key=secret-value "
            "password='dont-print' sk-1234567890123456"
        )
        redacted = sessions.redact_text(text)

        self.assertNotIn("abc.def.ghi", redacted)
        self.assertNotIn("secret-value", redacted)
        self.assertNotIn("dont-print", redacted)
        self.assertNotIn("sk-1234567890123456", redacted)
        self.assertGreaterEqual(redacted.count("[REDACTED]"), 4)

    def test_cost_cli_honors_pi_agent_directory(self):
        self.write_session()
        agent_dir = Path(self.tempdir.name) / "agent"
        actual_sessions = agent_dir / "sessions" / "encoded-project--"
        actual_sessions.mkdir(parents=True)
        source = next(self.sessions_root.rglob("*.jsonl"))
        (actual_sessions / source.name).write_text(source.read_text())

        env = os.environ.copy()
        env["PI_CODING_AGENT_DIR"] = str(agent_dir)
        result = subprocess.run(
            [sys.executable, str(SCRIPTS_DIR / "cost.py"), "--since", "2025-01-01", "--by", "total"],
            env=env,
            capture_output=True,
            text=True,
            check=False,
        )

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("$0.33", result.stdout)


if __name__ == "__main__":
    unittest.main()
