"""
Sync 47 problems from docs/data.json to Google Sheet tab 'Bài Tập'
"""
import sys
import os
import json

sys.stdout.reconfigure(encoding='utf-8')
os.environ.pop("SSLKEYLOGFILE", None)

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

from src.sync_to_gsheet import get_spreadsheet

def sync_catalog_to_sheet():
    json_path = os.path.join(_ROOT, "docs", "data.json")
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    problems = data.get("problems", [])
    print(f"Loaded {len(problems)} problems from docs/data.json")

    sh = get_spreadsheet()
    ws = sh.worksheet("Bài Tập")

    # Header
    header = ['Mã bài', 'Link bài tập', 'Tên bài tập', 'Class', 'Level', 'Dạng bài', 'Nền tảng', 'Ghi chú']

    rows = []
    for p in problems:
        pid = p.get("id", "").strip().upper()
        url = p.get("url", "")
        name = p.get("name", "").strip()
        classes = p.get("classes", ["Tất cả"])
        cls_str = ", ".join(classes) if isinstance(classes, list) else str(classes)
        diff_str = str(p.get("difficulty", "Level 1"))
        level = "1"
        for num in ["1", "2", "3", "4", "5"]:
            if num in diff_str:
                level = num
                break
        category = p.get("category", "Cơ bản")
        platform = p.get("platform", "MarisaOJ")
        notes = p.get("notes", "")
        rows.append([pid, url, name, cls_str, level, category, platform, notes])

    print(f"Prepared {len(rows)} rows for sheet 'Bài Tập'")

    # Clear old rows beyond header
    all_values = ws.get_all_values()
    old_row_count = len(all_values)

    # Update or overwrite range
    ws.update(range_name=f"A1:H1", values=[header], value_input_option="USER_ENTERED")
    ws.update(range_name=f"A2:H{len(rows)+1}", values=rows, value_input_option="USER_ENTERED")

    # If old rows were longer than new rows, clear leftover rows
    if old_row_count > len(rows) + 1:
        clear_range = f"A{len(rows)+2}:H{old_row_count}"
        ws.batch_clear([clear_range])
        print(f"Cleared leftover rows {clear_range}")

    print(f"Successfully synced {len(rows)} problems to Google Sheet 'Bài Tập'!")

if __name__ == "__main__":
    sync_catalog_to_sheet()
