import os
import sys
import json
import hashlib
import openpyxl
from datetime import datetime, timezone
from typing import List, Dict

# Ensure SSLKEYLOGFILE is safe
_sslkeylogfile = os.environ.get("SSLKEYLOGFILE")
if _sslkeylogfile and not os.path.exists(os.path.dirname(_sslkeylogfile)):
    del os.environ["SSLKEYLOGFILE"]

from src.utils.logger import get_logger

logger = get_logger("sync.excel")


def hash_str(val: str) -> str:
    return hashlib.sha256(val.strip().encode("utf-8")).hexdigest()


def sync(excel_path: str = "Quản lý học sinh.xlsx", json_path: str = "docs/data.json"):
    if not os.path.exists(excel_path):
        logger.error(f"Excel file not found at: {excel_path}")
        return False

    logger.info(f"Opening Excel file: {excel_path}")
    wb = openpyxl.load_workbook(excel_path, data_only=True)

    # Load existing data.json if available to preserve crawled activity / stats
    existing_data = {}
    if os.path.exists(json_path):
        with open(json_path, "r", encoding="utf-8") as f:
            try:
                existing_data = json.load(f)
            except Exception as e:
                logger.warning(f"Could not load existing {json_path}: {e}")

    # Map existing student solved data by handle and name
    existing_students_map = {}
    for st in existing_data.get("students", []):
        if st.get("marisa_handle"):
            existing_students_map[st["marisa_handle"]] = st
        existing_students_map[st.get("name", "")] = st

    # 1. Parse Security / Keys
    auth_tokens = {}
    if "Cấu Hình Bảo Mật" in wb.sheetnames:
        ws_sec = wb["Cấu Hình Bảo Mật"]
        for r in range(2, ws_sec.max_row + 1):
            target_name = ws_sec.cell(r, 1).value
            role = ws_sec.cell(r, 2).value
            key_val = ws_sec.cell(r, 3).value
            if not key_val:
                continue
            key_str = str(key_val).strip()
            h = hash_str(key_str)

            if role == "ADMIN":
                auth_tokens[h] = {
                    "role": "admin",
                    "name": str(target_name or "Giáo viên / Quản trị"),
                    "class": "ALL"
                }
            elif role == "CLASS":
                cls = "C++" if "C++" in str(target_name) else "Python 1-1" if "1-1" in str(target_name) else "Python"
                auth_tokens[h] = {
                    "role": "class",
                    "name": str(target_name),
                    "class": cls
                }

    # 2. Parse Problems
    problems = []
    class_problems_map = {"C++": [], "Python": [], "Python 1-1": []}

    if "Bài Tập" in wb.sheetnames:
        ws_prob = wb["Bài Tập"]
        for r in range(2, ws_prob.max_row + 1):
            pid = ws_prob.cell(r, 1).value
            url = ws_prob.cell(r, 2).value
            pname = ws_prob.cell(r, 3).value
            classes_str = ws_prob.cell(r, 4).value or "Tất cả"
            level = ws_prob.cell(r, 5).value or "1"
            tag = ws_prob.cell(r, 6).value or "Brute Force"
            platform = ws_prob.cell(r, 7).value or "MarisaOJ"

            if not url:
                continue

            c_list = []
            c_str_clean = str(classes_str).strip()
            if "Tất cả" in c_str_clean or "All" in c_str_clean:
                c_list = ["C++", "Python", "Python 1-1"]
            else:
                if "C++" in c_str_clean:
                    c_list.append("C++")
                if "Python 1-1" in c_str_clean or "1-1" in c_str_clean:
                    c_list.append("Python 1-1")
                elif "Python" in c_str_clean:
                    c_list.append("Python")

            plat_str = str(platform).strip()
            plat_lower = plat_str.lower()
            b_color = "purple" if "marisa" in plat_lower else ("amber" if "vnoi" in plat_lower else ("cyan" if "clue" in plat_lower else ("emerald" if "vjudge" in plat_lower else "blue")))
            prob_id = str(pid or f"PROB-{r}").strip()
            problems.append({
                "id": prob_id,
                "name": str(pname or f"Bài tập #{r}").strip(),
                "url": str(url).strip(),
                "platform": plat_str,
                "badge_color": b_color,
                "category": str(tag).strip(),
                "difficulty": f"Level {level} • {tag}",
                "classes": c_list
            })

            for c in c_list:
                if c in class_problems_map:
                    class_problems_map[c].append(prob_id)

    # 3. Parse Lectures
    curriculum = []
    if "Bài Giảng" in wb.sheetnames:
        ws_lec = wb["Bài Giảng"]
        for r in range(2, ws_lec.max_row + 1):
            lid = ws_lec.cell(r, 1).value
            chapter = ws_lec.cell(r, 2).value or ""
            title = ws_lec.cell(r, 3).value
            classes_str = ws_lec.cell(r, 4).value or "Tất cả"
            link = ws_lec.cell(r, 5).value or "#"
            summary = ws_lec.cell(r, 6).value or ""

            if not title:
                continue

            c_list = []
            c_str_clean = str(classes_str).strip()
            if "Tất cả" in c_str_clean or "All" in c_str_clean:
                c_list = ["C++", "Python", "Python 1-1"]
            else:
                if "C++" in c_str_clean:
                    c_list.append("C++")
                if "Python 1-1" in c_str_clean or "1-1" in c_str_clean:
                    c_list.append("Python 1-1")
                elif "Python" in c_str_clean:
                    c_list.append("Python")

            curriculum.append({
                "id": str(lid or f"LEC-{r}").strip(),
                "chapter": str(chapter).strip(),
                "title": str(title).strip(),
                "classes": c_list,
                "url": str(link).strip(),
                "summary": str(summary).strip()
            })

    # 4. Parse Tuition Fees
    tuition_months = []
    tuition_data = {}
    if "Học Phí" in wb.sheetnames:
        ws_fee = wb["Học Phí"]
        for c in range(3, ws_fee.max_column + 1):
            m_val = ws_fee.cell(2, c).value
            if m_val:
                tuition_months.append(str(m_val).strip())
        
        for r in range(3, ws_fee.max_row + 1):
            fee_name = ws_fee.cell(r, 1).value
            if not fee_name or str(fee_name).startswith("="):
                continue
            fee_name_clean = str(fee_name).strip()
            st_fee_map = {}
            for idx, m in enumerate(tuition_months, 3):
                cell_val = ws_fee.cell(r, idx).value
                st_fee_map[m] = True if cell_val and str(cell_val).strip().lower() == "x" else False
            tuition_data[fee_name_clean] = st_fee_map

    # 5. Parse Students
    students = []
    if "Học Sinh" in wb.sheetnames:
        ws_stu = wb["Học Sinh"]
        header_row = [str(ws_stu.cell(1, c).value or "").strip().lower() for c in range(1, ws_stu.max_column + 1)]
        col_map = {}
        for col_idx, col_name in enumerate(header_row, 1):
            if not col_name:
                continue
            if any(k in col_name for k in ["stt", "số thứ tự", "thứ tự", "id"]) and "stt" not in col_map:
                col_map["stt"] = col_idx
            elif any(k in col_name for k in ["họ và tên", "họ tên", "tên học sinh", "tên", "name"]) and "name" not in col_map:
                col_map["name"] = col_idx
            elif any(k in col_name for k in ["lớp", "class"]) and "class" not in col_map:
                col_map["class"] = col_idx
            elif any(k in col_name for k in ["marisa", "moj"]) and "marisa" not in col_map:
                col_map["marisa"] = col_idx
            elif any(k in col_name for k in ["codeforces", "cf"]) and "cf" not in col_map:
                col_map["cf"] = col_idx
            elif any(k in col_name for k in ["vjudge", "vj"]) and "vjudge" not in col_map:
                col_map["vjudge"] = col_idx
            elif any(k in col_name for k in ["vnoi", "vnoj"]) and "vnoi" not in col_map:
                col_map["vnoi"] = col_idx
            elif any(k in col_name for k in ["clue", "clueoj"]) and "clue" not in col_map:
                col_map["clue"] = col_idx
            elif any(k in col_name for k in ["pin", "mật khẩu", "password", "pass"]) and "pin" not in col_map:
                col_map["pin"] = col_idx
            elif any(k in col_name for k in ["trạng thái", "status"]) and "status" not in col_map:
                col_map["status"] = col_idx

        def get_excel_cell(r, key, default_col=-1, default=""):
            col = col_map.get(key, default_col)
            if 1 <= col <= ws_stu.max_column:
                val = ws_stu.cell(r, col).value
                if val is not None and str(val).strip() != "" and str(val).strip() != "None":
                    return str(val).strip()
            return default

        for r in range(2, ws_stu.max_row + 1):
            name_val = get_excel_cell(r, "name", 2, "")
            if not name_val:
                continue

            stt = get_excel_cell(r, "stt", 1, str(r - 1))
            name_str = name_val
            cls_str = get_excel_cell(r, "class", 3, "C++")
            marisa_str = get_excel_cell(r, "marisa", 4, "")
            cf_h = get_excel_cell(r, "cf", 5, "")
            vj_h = get_excel_cell(r, "vjudge", 6, "")
            vnoi_h = get_excel_cell(r, "vnoi", -1, "")
            clue_h = get_excel_cell(r, "clue", -1, "")
            pin = get_excel_cell(r, "pin", 7 if "vnoi" not in col_map and "clue" not in col_map else -1, "")
            status = get_excel_cell(r, "status", 8 if "vnoi" not in col_map and "clue" not in col_map else -1, "Đang học")

            # Preserve crawled solved data from existing_data
            prev_st = existing_students_map.get(marisa_str) or existing_students_map.get(name_str) or {}
            all_solved = prev_st.get("solved", [])
            stats = prev_st.get("stats", {"week": 0, "month": 0, "year": 0, "total": len(all_solved)})
            activity = prev_st.get("activity", {})
            detail_archive = prev_st.get("solved_problems_detail", [])

            # Target problems for this student's class
            class_prob_ids = class_problems_map.get(cls_str, class_problems_map.get("C++", []))
            solved_set = set(all_solved)
            target_solved = [pid for pid in class_prob_ids if pid in solved_set]

            # Match tuition by name or short name
            st_tuition = {}
            for fn, fmap in tuition_data.items():
                if fn.lower() in name_str.lower() or name_str.lower() in fn.lower():
                    st_tuition = fmap
                    break
            if not st_tuition:
                st_tuition = {m: False for m in tuition_months}

            st_idx = int(stt) if stt.isdigit() else len(students) + 1
            students.append({
                "stt": st_idx,
                "name": name_str,
                "class": cls_str,
                "cf_handle": cf_h,
                "vjudge_handle": vj_h,
                "marisa_handle": marisa_str,
                "vnoi_handle": vnoi_h,
                "clue_handle": clue_h,
                "pin": pin,
                "status": status,
                "tuition": st_tuition,
                "solved": all_solved,
                "target_solved": target_solved,
                "target_solved_count": len(target_solved),
                "target_class_total": len(class_prob_ids),
                "total_solved_count": len(all_solved),
                "rating": 0,
                "title": "Newbie",
                "rating_change": "",
                "stats": stats,
                "activity": activity,
                "solved_problems_detail": detail_archive
            })

            # Auth PIN for student
            if pin:
                pin_h = hash_str(pin)
                auth_tokens[pin_h] = {
                    "role": "student",
                    "stt": st_idx,
                    "name": name_str,
                    "class": cls_str
                }

    # 6. Class Config
    class_config = {
        "C++": {
            "name": "Lớp C++",
            "badge_color": "bg-blue-500/15 text-blue-300 border-blue-500/30",
            "total_problems": len(class_problems_map.get("C++", [])),
            "problem_ids": class_problems_map.get("C++", [])
        },
        "Python": {
            "name": "Lớp Python",
            "badge_color": "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
            "total_problems": len(class_problems_map.get("Python", [])),
            "problem_ids": class_problems_map.get("Python", [])
        },
        "Python 1-1": {
            "name": "Lớp Python 1-1",
            "badge_color": "bg-purple-500/15 text-purple-300 border-purple-500/30",
            "total_problems": len(class_problems_map.get("Python 1-1", [])),
            "problem_ids": class_problems_map.get("Python 1-1", [])
        }
    }

    # Build final appData
    final_data = existing_data if existing_data else {}
    final_data["students"] = students
    final_data["problems"] = problems
    final_data["curriculum"] = curriculum
    final_data["class_config"] = class_config
    final_data["auth_tokens"] = auth_tokens
    final_data["tuition_months"] = tuition_months
    final_data["last_updated"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(final_data, f, ensure_ascii=False, indent=2)

    logger.info(f"Sync complete! Updated {json_path} with {len(students)} students, {len(problems)} problems, {len(curriculum)} lectures, and {len(auth_tokens)} auth tokens.")
    return True


def git_push() -> bool:
    import subprocess
    print("\n📤 Đang commit và đẩy lên GitHub Pages...")
    try:
        subprocess.run(["git", "add", "docs/data.json"], check=True)
        res = subprocess.run(["git", "diff", "--staged", "--quiet"])
        if res.returncode != 0:
            subprocess.run(["git", "commit", "-m", "update: sync students, problems and lectures from excel"], check=True)
            subprocess.run(["git", "push", "origin", "master"], check=True)
            print("✅ [HOÀN TẤT] Hệ thống đã được cập nhật trực tuyến trên GitHub Pages!\n")
        else:
            print("ℹ️ Dữ liệu đã mới nhất trên GitHub, không có thay đổi nào cần push.\n")
        return True
    except Exception as e:
        print(f"❌ [LỖI PUSH GITHUB] {e}\n")
        return False


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Sync Excel to Web")
    parser.add_argument("--push", action="store_true", help="Auto push without prompting")
    parser.add_argument("--no-push", action="store_true", help="Skip push without prompting")
    args = parser.parse_args()

    ok = sync()
    if ok:
        if args.push:
            git_push()
        elif not args.no_push:
            try:
                ans = input("\nBạn có muốn tự động PUSH lên GitHub Pages không? (Y/n): ").strip().lower()
                if ans in ["", "y", "yes", "co", "c", "1"]:
                    git_push()
                else:
                    print("ℹ️ [LƯU Ý] Dữ liệu đã lưu ở máy nội bộ (docs/data.json), chưa đẩy lên GitHub.\n")
            except (KeyboardInterrupt, EOFError):
                print("\n")
