import unittest
from pathlib import Path
from types import SimpleNamespace

from src.problem_catalog import compare_catalog, read_problem_rows


class ProblemCatalogTests(unittest.TestCase):
    def test_bidirectional_comparison_does_not_modify_inputs(self):
        rows = [["ID", "URL", "Name"], ["P1", "https://example.com/1", "Original"],
                ["P2", "#judge", "Sheet only"]]
        problems = [{"id": "P1", "name": "Wrong", "url": "https://example.com/2"},
                    {"id": "LOCAL", "name": "Keep", "url": "#judge"}]
        report = compare_catalog(rows, problems)
        self.assertEqual(set(report["differences"][0]["changes"]), {"name", "url"})
        self.assertEqual(report["sheet_only"][0]["id"], "P2")
        self.assertEqual(report["web_only"][0]["id"], "LOCAL")
        self.assertEqual(rows[1][2], "Original")
        self.assertEqual(problems[0]["name"], "Wrong")

    def test_duplicate_or_incomplete_source_fails_closed(self):
        for rows in ([["ID"], ["P", "#judge", "A"], ["P", "#judge", "B"]],
                     [["ID"], ["P", "#judge"]]):
            with self.assertRaises(ValueError):
                compare_catalog(rows, [])

    def test_reads_actual_hyperlinks_without_writes(self):
        calls = []
        def fetch_sheet_metadata(params):
            calls.append(params)
            return {"sheets": [{"data": [{"rowData": [
                {"values": [{"formattedValue": "ID"}]},
                {"values": [{"formattedValue": "P"},
                            {"formattedValue": "Open", "hyperlink": "https://example.com/1"},
                            {"formattedValue": "Name"}]},
                {"values": [{"formattedValue": "Q"},
                            {"formattedValue": "Open", "textFormatRuns": [
                                {"format": {"link": {"uri": "https://example.com/2"}}}]}]},
            ]}]}]}
        worksheet = SimpleNamespace(title="Bài Tập", spreadsheet=SimpleNamespace(fetch_sheet_metadata=fetch_sheet_metadata))
        rows = read_problem_rows(worksheet)
        self.assertEqual(rows[1][1], "https://example.com/1")
        self.assertEqual(rows[2][1], "https://example.com/2")
        self.assertEqual(calls[0]["ranges"], "'Bài Tập'!A:H")

    def test_scheduled_sync_cannot_push_to_source(self):
        root = Path(__file__).resolve().parents[1]
        workflow = (root / ".github/workflows/gsheets_sync.yml").read_text(encoding="utf-8")
        sync = (root / "src/sync_gsheets.py").read_text(encoding="utf-8")
        self.assertNotIn("--two-way", workflow)
        self.assertNotIn("sync_all_from_local_json", sync)
        self.assertIn("auth/spreadsheets.readonly", sync)
        server = (root / "src/judge_server.py").read_text(encoding="utf-8")
        self.assertNotIn("sync_to_gsheet.sync_all_from_local_json()", server)


if __name__ == "__main__":
    unittest.main()
