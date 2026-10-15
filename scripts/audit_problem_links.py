"""Compare the website with authoritative Sheets without any remote writes.

Run: python -m scripts.audit_problem_links
Only public exercise cells are read. The generated audit stays in data/private.
"""
import json
import argparse
import html
import re
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

from config.settings import get_settings
from src.problem_catalog import compare_catalog, read_problem_rows


def check_targets(problems):
    import requests

    def check(problem):
        result = {k: problem[k] for k in ("id", "name", "url")}
        try:
            response = requests.get(problem["url"], timeout=20)
            result["http_status"] = response.status_code
            title = re.search(r"<title[^>]*>(.*?)</title>", response.text, re.I | re.S)
            result["page_title"] = html.unescape(title.group(1).strip()) if title else ""
            result["status"] = "readable" if response.ok and "just a moment" not in result["page_title"].lower() else "unverified"
        except requests.RequestException as error:
            result["status"] = "unverified"
            result["error"] = type(error).__name__
        return result

    external = [p for p in problems if p.get("url", "").startswith("https://")]
    with ThreadPoolExecutor(max_workers=4) as executor:
        return list(executor.map(check, external))


def main():
    import gspread
    from google.oauth2.service_account import Credentials

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check-targets", action="store_true", help="Also read public problem page titles")
    args = parser.parse_args()
    settings = get_settings()
    credentials = Credentials.from_service_account_info(
        settings.get_service_account_dict(),
        scopes=["https://www.googleapis.com/auth/spreadsheets.readonly"],
    )
    client = gspread.authorize(credentials)
    client.set_timeout(25)
    spreadsheet = client.open_by_key(settings.spreadsheet_id)
    worksheet = spreadsheet.worksheet("Bài Tập")
    rows = read_problem_rows(worksheet)
    catalog = json.loads((settings.project_root / "docs/data.json").read_text(encoding="utf-8"))
    report = compare_catalog(rows, catalog["problems"])
    report["grader"] = compare_catalog(rows, catalog.get("grader_problems", []))
    report["checked_at"] = datetime.now(timezone.utc).isoformat()
    report["sheet_rows"] = rows
    if args.check_targets:
        report["targets"] = check_targets(catalog["problems"])
    target = settings.project_root / "data/private/problem-link-audit.json"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({k: v for k, v in report.items() if k != "sheet_rows"}, ensure_ascii=False, indent=2))
    print(f"Read-only audit saved: {target}")


if __name__ == "__main__":
    main()
