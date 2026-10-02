import os
import sys
import json
import openpyxl
from typing import List, Dict

# Ensure SSLKEYLOGFILE is safe
_sslkeylogfile = os.environ.get("SSLKEYLOGFILE")
if _sslkeylogfile and not os.path.exists(os.path.dirname(_sslkeylogfile)):
    del os.environ["SSLKEYLOGFILE"]

from src.utils.logger import get_logger
from src.crawlers.marisaoj import MarisaOJCrawler

logger = get_logger("sync.excel")


def sync(excel_path: str = "Quản lý học sinh.xlsx", json_path: str = "docs/data.json"):
    if not os.path.exists(excel_path):
        logger.error(f"Excel file not found at: {excel_path}")
        return

    logger.info(f"Opening Excel file: {excel_path}")
    wb = openpyxl.load_workbook(excel_path, data_only=True)

    # 1. Read Students (Sheet 0: 'Học Sinh')
    sheet_students = wb.worksheets[0]
    students_raw = []
    marisa_handles = []

    for r in range(3, sheet_students.max_row + 1):
        name = sheet_students.cell(r, 1).value
        if not name:
            continue
        cls_name = sheet_students.cell(r, 2).value or ""
        marisa_h = sheet_students.cell(r, 3).value or ""
        cf_h = sheet_students.cell(r, 4).value or ""
        vj_h = sheet_students.cell(r, 5).value or ""

        marisa_h_clean = str(marisa_h).strip()
        if marisa_h_clean:
            marisa_handles.append(marisa_h_clean)

        students_raw.append({
            "stt": len(students_raw) + 1,
            "name": str(name).strip(),
            "class": str(cls_name).strip(),
            "marisa_handle": marisa_h_clean,
            "cf_handle": str(cf_h).strip() if cf_h else "",
            "vjudge_handle": str(vj_h).strip() if vj_h else ""
        })

    logger.info(f"Loaded {len(students_raw)} students from Excel.")

    # 2. Read Problems (Sheet 2: 'Bài Tập')
    sheet_problems = wb.worksheets[2] if len(wb.worksheets) > 2 else None
    problems = []
    target_pids = set()

    if sheet_problems:
        for r in range(3, sheet_problems.max_row + 1):
            url = sheet_problems.cell(r, 1).value
            if not url:
                continue
            url_str = str(url).strip()
            level = sheet_problems.cell(r, 2).value or "1"
            tag = sheet_problems.cell(r, 3).value or "Brute Force"

            pid = url_str.rstrip("/").split("/")[-1]
            target_pids.add(pid)

            problems.append({
                "id": f"MARISA-{pid}",
                "name": f"Bài tập #{pid}",
                "platform": "MarisaOJ",
                "badge_color": "purple",
                "category": "MarisaOJ",
                "url": url_str,
                "difficulty": f"Level {level} • {tag}"
            })
    logger.info(f"Loaded {len(problems)} problems from Excel.")

    # 3. Crawl submissions from MarisaOJ
    logger.info("Crawling submission status from MarisaOJ...")
    crawler = MarisaOJCrawler(delay_seconds=2.0, headless=False)
    crawl_results = crawler.crawl_students(marisa_handles)

    # 4. Build final students list with ACs and Ratings
    students = []
    for s in students_raw:
        h = s["marisa_handle"]
        ac_ids = crawl_results.get(h, set())
        
        all_solved = [f"MARISA-{pid}" for pid in sorted(list(ac_ids))]
        target_solved = [f"MARISA-{pid}" for pid in sorted(list(ac_ids.intersection(target_pids)))]

        # Base rating calculation: 1200 base + 20 points per target AC + 10 points per extra AC
        extra_count = max(0, len(all_solved) - len(target_solved))
        rating = 1200 + (len(target_solved) * 50) + (extra_count * 10)
        rating_change = f"+{len(target_solved) * 10}" if target_solved else ""

        students.append({
            "stt": s["stt"],
            "name": s["name"],
            "class": s["class"],
            "cf_handle": s["cf_handle"],
            "vjudge_handle": s["vjudge_handle"],
            "marisa_handle": s["marisa_handle"],
            "solved": all_solved,
            "target_solved": target_solved,
            "target_solved_count": len(target_solved),
            "total_solved_count": len(all_solved),
            "rating": rating,
            "rating_change": rating_change
        })

    # Sort students by rating descending
    students.sort(key=lambda x: (x["rating"], len(x["solved"])), reverse=True)
    for idx, st in enumerate(students, 1):
        st["stt"] = idx

    # 5. Save to docs/data.json
    if os.path.exists(json_path):
        with open(json_path, "r", encoding="utf-8") as f:
            app_data = json.load(f)
    else:
        app_data = {}

    app_data["students"] = students
    if problems:
        app_data["problems"] = problems

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(app_data, f, ensure_ascii=False, indent=2)

    logger.info(f"Sync complete! Updated {json_path} with {len(students)} students and {len(problems)} problems.")


if __name__ == "__main__":
    sync()
