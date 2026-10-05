"""
TWO-WAY SYNC ENGINE: WEB -> GOOGLE SHEETS
-----------------------------------------
Hỗ trợ đồng bộ 2 chiều (Bidirectional Sync) giữa Web và Google Sheet:
- Cập nhật trạng thái đóng Học Phí (Học Phí tab: TRUE / FALSE)
- Cập nhật Trạng thái Học Sinh (Đang học / Tạm nghỉ / Nghỉ học)
- Thêm / Cập nhật Học Sinh mới (Học Sinh tab & Học Phí tab)
- Thêm / Cập nhật Bài Tập mới (Bài Tập tab)
- Thêm / Cập nhật Bài Giảng mới (Bài Giảng tab)
- Chạy đồng bộ tổng thể 2 chiều (Bidirectional Reconciliation)
"""

import os
import sys
import json
import time
from datetime import datetime
from typing import Dict, Any, Optional, List, Tuple

# Reconfigure stdout for utf-8 on Windows
sys.stdout.reconfigure(encoding='utf-8')
os.environ.pop("SSLKEYLOGFILE", None)

_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _PROJECT_ROOT not in sys.path:
    sys.path.insert(0, _PROJECT_ROOT)

import gspread
from google.oauth2.service_account import Credentials
from config.settings import get_settings
from src.utils.logger import get_logger

logger = get_logger("sync.to_gsheet")


def get_spreadsheet():
    settings = get_settings()
    sheet_id = settings.spreadsheet_id
    if not sheet_id:
        raise ValueError("Chưa cấu hình SPREADSHEET_ID trong .env")

    sa_info = settings.get_service_account_dict()
    if not sa_info:
        raise ValueError("Chưa cấu hình Google Service Account credentials")

    scopes = [
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive",
    ]
    credentials = Credentials.from_service_account_info(sa_info, scopes=scopes)
    gc = gspread.authorize(credentials)
    return gc.open_by_key(sheet_id)


def col_idx_to_letter(idx: int) -> str:
    """Converts 0-based column index to A1 notation letter (0 -> 'A', 25 -> 'Z', 26 -> 'AA')."""
    result = ""
    idx += 1
    while idx > 0:
        idx, rem = divmod(idx - 1, 26)
        result = chr(65 + rem) + result
    return result


def find_student_row(rows: List[List[str]], name: str, name_col_idx: int = 0) -> int:
    """Returns 1-based row index for matching student name, or -1 if not found."""
    target = name.strip().lower()
    target_words = target.split()
    for r_idx, row in enumerate(rows, 1):
        if len(row) > name_col_idx:
            row_name = str(row[name_col_idx]).strip().lower()
            if not row_name:
                continue
            if row_name == target:
                return r_idx
            # Fuzzy match: identical given name & subset of words
            row_words = row_name.split()
            if row_words and target_words and row_words[-1] == target_words[-1]:
                if set(row_words).issubset(set(target_words)) or set(target_words).issubset(set(row_words)):
                    return r_idx
    return -1


def update_tuition_in_sheet(student_name: str, month: str, is_paid: bool) -> Dict[str, Any]:
    """Updates a single tuition cell in 'Học Phí' worksheet."""
    try:
        sh = get_spreadsheet()
        ws = sh.worksheet("Học Phí")
        rows = ws.get_all_values()

        # Find header row
        header_row_idx = -1
        for idx, r in enumerate(rows):
            r_str = " ".join([str(c).lower() for c in r])
            if "họ và tên" in r_str and ("tháng" in r_str or "thang" in r_str):
                header_row_idx = idx
                break

        if header_row_idx == -1:
            return {"status": "error", "message": "Không tìm thấy hàng tiêu đề trong tab 'Học Phí'"}

        header = rows[header_row_idx]
        # Find column matching month
        month_col_idx = -1
        m_target = month.strip().lower()
        for c_idx, c_name in enumerate(header):
            c_lower = str(c_name).strip().lower()
            if m_target in c_lower or (c_lower.replace(" ", "") == m_target.replace(" ", "")):
                month_col_idx = c_idx
                break

        if month_col_idx == -1:
            return {"status": "error", "message": f"Không tìm thấy cột tháng '{month}' trong tab 'Học Phí'"}

        # Find student row
        student_row_idx = -1
        for r_idx in range(header_row_idx + 1, len(rows)):
            row = rows[r_idx]
            if not row:
                continue
            r_name = str(row[0]).strip().lower()
            if r_name == student_name.strip().lower():
                student_row_idx = r_idx + 1  # 1-based
                break
            # Fuzzy match
            r_words = r_name.split()
            t_words = student_name.strip().lower().split()
            if r_words and t_words and r_words[-1] == t_words[-1]:
                if set(r_words).issubset(set(t_words)) or set(t_words).issubset(set(r_words)):
                    student_row_idx = r_idx + 1
                    break

        if student_row_idx == -1:
            return {"status": "error", "message": f"Không tìm thấy học sinh '{student_name}' trong tab 'Học Phí'"}

        cell_col_letter = col_idx_to_letter(month_col_idx)
        cell_ref = f"{cell_col_letter}{student_row_idx}"
        val_str = "TRUE" if is_paid else "FALSE"

        ws.update(cell_ref, [[val_str]], value_input_option="USER_ENTERED")
        logger.info(f"Updated tuition for '{student_name}' at {cell_ref} -> {val_str}")
        return {
            "status": "success",
            "student": student_name,
            "month": month,
            "is_paid": is_paid,
            "cell": cell_ref
        }
    except Exception as e:
        logger.error(f"Error updating tuition in sheet: {e}")
        return {"status": "error", "message": str(e)}


def update_student_status_in_sheet(student_name: str, new_status: str) -> Dict[str, Any]:
    """Updates student status column in 'Học Sinh' worksheet."""
    try:
        sh = get_spreadsheet()
        ws = sh.worksheet("Học Sinh")
        rows = ws.get_all_values()
        if not rows:
            return {"status": "error", "message": "Tab 'Học Sinh' rỗng"}

        header = [str(c).strip().lower() for c in rows[0]]
        status_col_idx = -1
        for c_idx, c_name in enumerate(header):
            if "trạng thái" in c_name or "status" in c_name:
                status_col_idx = c_idx
                break
        if status_col_idx == -1:
            status_col_idx = 9  # default col J

        # Find row by student name (col 1 is Họ và tên)
        target_row_idx = -1
        for r_idx in range(1, len(rows)):
            row = rows[r_idx]
            if len(row) > 1 and row[1].strip().lower() == student_name.strip().lower():
                target_row_idx = r_idx + 1  # 1-based
                break

        if target_row_idx == -1:
            return {"status": "error", "message": f"Không tìm thấy học sinh '{student_name}' trong tab 'Học Sinh'"}

        cell_ref = f"{col_idx_to_letter(status_col_idx)}{target_row_idx}"
        ws.update(cell_ref, [[new_status]], value_input_option="USER_ENTERED")
        logger.info(f"Updated status for '{student_name}' at {cell_ref} -> {new_status}")
        return {
            "status": "success",
            "student": student_name,
            "new_status": new_status,
            "cell": cell_ref
        }
    except Exception as e:
        logger.error(f"Error updating student status in sheet: {e}")
        return {"status": "error", "message": str(e)}


def save_student_to_sheet(student_data: Dict[str, Any]) -> Dict[str, Any]:
    """Adds or updates a student in 'Học Sinh' and 'Học Phí' worksheets."""
    try:
        sh = get_spreadsheet()
        ws_stu = sh.worksheet("Học Sinh")
        rows_stu = ws_stu.get_all_values()

        name = student_data.get("name", "").strip()
        if not name:
            return {"status": "error", "message": "Tên học sinh không được để trống"}

        cls_str = student_data.get("class", "C++ nâng cao")
        marisa_h = student_data.get("marisa_handle", "")
        cf_h = student_data.get("cf_handle", "")
        vj_h = student_data.get("vjudge_handle", "")
        vnoi_h = student_data.get("vnoi_handle", "")
        clue_h = student_data.get("clue_handle", "")
        pin = student_data.get("pin", "")
        status = student_data.get("status", "Đang học")
        notes = student_data.get("notes", "")

        # Check if student already exists in 'Học Sinh'
        found_row_idx = -1
        for r_idx in range(1, len(rows_stu)):
            row = rows_stu[r_idx]
            if len(row) > 1 and row[1].strip().lower() == name.lower():
                found_row_idx = r_idx + 1
                break

        if found_row_idx != -1:
            # Update existing student row
            stt = rows_stu[found_row_idx - 1][0] if rows_stu[found_row_idx - 1] else str(found_row_idx - 1)
            existing_row = rows_stu[found_row_idx - 1]
            existing_pin = existing_row[8] if len(existing_row) > 8 else ""
            pin_to_save = pin if pin else existing_pin
            updated_row = [stt, name, cls_str, marisa_h, cf_h, vj_h, vnoi_h, clue_h, pin_to_save, status, notes]
            cell_range = f"A{found_row_idx}:K{found_row_idx}"
            ws_stu.update(cell_range, [updated_row], value_input_option="USER_ENTERED")
            action = "updated"
            # Update Firebase if pin changed
            if pin:
                try:
                    import hashlib
                    from src.sync_firebase import push_tokens_to_firebase
                    h_pin = hashlib.sha256(pin.encode("utf-8")).hexdigest()
                    push_tokens_to_firebase({h_pin: {"role": "student", "name": name, "class": cls_str, "stt": int(stt) if stt.isdigit() else 1}})
                except Exception as fe:
                    logger.warning(f"Could not update Firebase token: {fe}")
        else:
            # Append new student row
            new_stt = str(len(rows_stu))
            new_row = [new_stt, name, cls_str, marisa_h, cf_h, vj_h, vnoi_h, clue_h, pin, status, notes]
            ws_stu.append_row(new_row, value_input_option="USER_ENTERED")
            action = "added"
            if pin:
                try:
                    import hashlib
                    from src.sync_firebase import push_tokens_to_firebase
                    h_pin = hashlib.sha256(pin.encode("utf-8")).hexdigest()
                    push_tokens_to_firebase({h_pin: {"role": "student", "name": name, "class": cls_str, "stt": int(new_stt)}})
                except Exception as fe:
                    logger.warning(f"Could not update Firebase token: {fe}")

            # Also ensure student exists in 'Học Phí'
            try:
                ws_fee = sh.worksheet("Học Phí")
                fee_rows = ws_fee.get_all_values()
                fee_exists = any(len(r) > 0 and r[0].strip().lower() == name.lower() for r in fee_rows[2:])
                if not fee_exists:
                    ws_fee.append_row([name, cls_str, "FALSE", "FALSE", "FALSE", "FALSE"], value_input_option="USER_ENTERED")
            except Exception as fee_err:
                logger.warning(f"Could not append to 'Học Phí': {fee_err}")

        logger.info(f"Student '{name}' {action} in Google Sheet successfully.")
        return {"status": "success", "action": action, "student": name}
    except Exception as e:
        logger.error(f"Error saving student to sheet: {e}")
        return {"status": "error", "message": str(e)}


def save_problem_to_sheet(problem_data: Dict[str, Any]) -> Dict[str, Any]:
    """Adds or updates a problem in 'Bài Tập' worksheet."""
    try:
        sh = get_spreadsheet()
        ws_prob = sh.worksheet("Bài Tập")
        rows = ws_prob.get_all_values()

        pid = problem_data.get("id", "").strip().upper()
        if not pid:
            return {"status": "error", "message": "Mã bài tập không được để trống"}

        name = problem_data.get("name", "").strip()
        url = problem_data.get("url", "")
        classes = problem_data.get("classes", ["Tất cả"])
        cls_str = ", ".join(classes) if isinstance(classes, list) else str(classes)
        diff_str = str(problem_data.get("difficulty", "Level 1"))
        level = "1"
        for num in ["1", "2", "3", "4", "5"]:
            if num in diff_str:
                level = num
                break
        category = problem_data.get("category", "Brute Force")
        platform = problem_data.get("platform", "MarisaOJ")
        notes = problem_data.get("notes", "")

        row_data = [pid, url, name, cls_str, level, category, platform, notes]

        found_idx = -1
        for idx in range(1, len(rows)):
            if len(rows[idx]) > 0 and rows[idx][0].strip().upper() == pid:
                found_idx = idx + 1
                break

        if found_idx != -1:
            ws_prob.update(f"A{found_idx}:H{found_idx}", [row_data], value_input_option="USER_ENTERED")
            action = "updated"
        else:
            ws_prob.append_row(row_data, value_input_option="USER_ENTERED")
            action = "added"

        logger.info(f"Problem '{pid}' {action} in tab 'Bài Tập'.")
        return {"status": "success", "action": action, "problem_id": pid}
    except Exception as e:
        logger.error(f"Error saving problem to sheet: {e}")
        return {"status": "error", "message": str(e)}


def save_curriculum_to_sheet(lec_data: Dict[str, Any]) -> Dict[str, Any]:
    """Adds or updates a curriculum / lecture item in 'Bài Giảng' worksheet."""
    try:
        sh = get_spreadsheet()
        ws_lec = sh.worksheet("Bài Giảng")
        rows = ws_lec.get_all_values()

        lid = lec_data.get("id", "").strip().upper()
        if not lid:
            lid = f"LEC-{len(rows)}"

        chapter = lec_data.get("chapter", "Tuần 1")
        title = lec_data.get("title", "").strip()
        classes = lec_data.get("classes", ["Tất cả"])
        cls_str = ", ".join(classes) if isinstance(classes, list) else str(classes)
        url = lec_data.get("url", "#")
        summary = lec_data.get("summary", "")

        row_data = [lid, chapter, title, cls_str, url, summary]

        found_idx = -1
        for idx in range(1, len(rows)):
            if len(rows[idx]) > 0 and rows[idx][0].strip().upper() == lid:
                found_idx = idx + 1
                break

        if found_idx != -1:
            ws_lec.update(f"A{found_idx}:F{found_idx}", [row_data], value_input_option="USER_ENTERED")
            action = "updated"
        else:
            ws_lec.append_row(row_data, value_input_option="USER_ENTERED")
            action = "added"

        logger.info(f"Lecture '{lid}' {action} in tab 'Bài Giảng'.")
        return {"status": "success", "action": action, "lecture_id": lid}
    except Exception as e:
        logger.error(f"Error saving lecture to sheet: {e}")
        return {"status": "error", "message": str(e)}


def sync_all_from_local_json(json_path: str = "docs/data.json") -> Dict[str, Any]:
    """
    Two-way reconciler:
    Fetches the latest student, tuition, status, and submission data from Firebase Realtime Database
    (where the Web UI saves updates) and reconciles changes back into Google Sheets.
    """
    students = []
    submissions = []

    # 1. First priority: Fetch live data from Firebase Realtime Database
    try:
        from src.sync_firebase import fetch_database_from_firebase
        fb_data = fetch_database_from_firebase()
        if fb_data.get("students"):
            students = fb_data["students"]
        if fb_data.get("submissions"):
            submissions = fb_data["submissions"]
        if students:
            logger.info(f"Retrieved {len(students)} students and {len(submissions)} submissions from Firebase for 2-way reconciliation.")
    except Exception as e:
        logger.warning(f"Could not fetch Firebase data for 2-way sync: {e}")

    # 2. Second priority: Fallback to local backup
    if not students:
        backup_path = os.path.join(_PROJECT_ROOT, "data_firebase_backup.json")
        if os.path.exists(backup_path):
            try:
                with open(backup_path, "r", encoding="utf-8") as f_b:
                    b_data = json.load(f_b)
                    students = b_data.get("students", [])
                    submissions = b_data.get("submissions", [])
            except Exception:
                pass

    # 3. Third priority: Fallback to docs/data.json
    if not students and os.path.exists(json_path):
        try:
            with open(json_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                students = data.get("students", [])
        except Exception as e:
            logger.warning(f"Could not read {json_path}: {e}")

    if not students:
        return {"status": "error", "message": "Không có dữ liệu học sinh nào từ Firebase hoặc file cục bộ để đối soát"}

    try:
        sh = get_spreadsheet()
        summary = {
            "status": "success",
            "updated_tuition_cells": 0,
            "updated_student_statuses": 0,
            "new_students_added": 0,
            "new_submissions_added": 0
        }

        # A. Đối soát Học Phí (Worksheet "Học Phí")
        ws_fee = get_worksheet_by_title(sh, ["Học Phí", "Hoc Phi", "Tuition", "Fee"])
        if ws_fee:
            fee_rows = ws_fee.get_all_values()
            h_idx = -1
            for idx, r in enumerate(fee_rows):
                r_str = " ".join([str(c).lower() for c in r])
                if "họ và tên" in r_str and ("tháng" in r_str or "thang" in r_str):
                    h_idx = idx
                    break

            if h_idx != -1:
                header = fee_rows[h_idx]
                month_map = {}
                for c_idx, c_name in enumerate(header):
                    m_str = str(c_name).strip()
                    if "tháng" in m_str.lower() or "thang" in m_str.lower() or any(m_str.lower().startswith(x) for x in ["t9", "t10", "t11", "t12"]):
                        month_map[m_str] = c_idx

                updates = []
                for st in students:
                    st_name = st.get("name", "").strip().lower()
                    st_tuition = st.get("tuition", {})
                    if not st_tuition:
                        continue

                    for r_idx in range(h_idx + 1, len(fee_rows)):
                        r_name = str(fee_rows[r_idx][0]).strip().lower() if len(fee_rows[r_idx]) > 0 else ""
                        if r_name == st_name:
                            for m_name, c_idx in month_map.items():
                                cur_val = str(fee_rows[r_idx][c_idx]).strip().upper() if c_idx < len(fee_rows[r_idx]) else "FALSE"
                                desired_bool = bool(st_tuition.get(m_name, False))
                                desired_str = "TRUE" if desired_bool else "FALSE"
                                if cur_val != desired_str:
                                    cell_ref = f"{col_idx_to_letter(c_idx)}{r_idx + 1}"
                                    updates.append({"range": cell_ref, "values": [[desired_str]]})
                            break

                if updates:
                    ws_fee.batch_update(updates, value_input_option="USER_ENTERED")
                    summary["updated_tuition_cells"] = len(updates)
                    logger.info(f"Batch updated {len(updates)} tuition cells in 'Học Phí'.")

        # B. Đối soát Trạng thái & Học sinh mới (Worksheet "Học Sinh")
        ws_stu = get_worksheet_by_title(sh, ["Học Sinh", "Hoc Sinh", "Danh sách Học sinh", "Students"])
        if ws_stu:
            stu_rows = ws_stu.get_all_values()
            if stu_rows:
                header = [str(c).strip().lower() for c in stu_rows[0]]
                name_col_idx = 1
                status_col_idx = -1
                for c_idx, c_name in enumerate(header):
                    if any(k in c_name for k in ["họ và tên", "họ tên", "tên"]):
                        name_col_idx = c_idx
                    elif any(k in c_name for k in ["trạng thái", "status"]):
                        status_col_idx = c_idx

                if status_col_idx == -1:
                    status_col_idx = 9

                sheet_names = {}
                for r_idx in range(1, len(stu_rows)):
                    row = stu_rows[r_idx]
                    if len(row) > name_col_idx:
                        s_name = str(row[name_col_idx]).strip().lower()
                        if s_name:
                            sheet_names[s_name] = r_idx + 1  # 1-based row index

                status_updates = []
                for st in students:
                    st_name = st.get("name", "").strip().lower()
                    if not st_name:
                        continue
                    fb_status = st.get("status", "Đang học")

                    # Check if student exists in sheet
                    if st_name in sheet_names:
                        target_r = sheet_names[st_name]
                        cur_status = stu_rows[target_r - 1][status_col_idx] if status_col_idx < len(stu_rows[target_r - 1]) else ""
                        if cur_status.strip().lower() != fb_status.strip().lower() and fb_status:
                            cell_ref = f"{col_idx_to_letter(status_col_idx)}{target_r}"
                            status_updates.append({"range": cell_ref, "values": [[fb_status]]})
                    else:
                        # Student exists in Firebase but not in Google Sheet! Add to Google Sheet!
                        try:
                            save_student_to_sheet(st)
                            summary["new_students_added"] += 1
                            logger.info(f"Reconciled new student from Web/Firebase to Sheet: {st.get('name')}")
                        except Exception as add_err:
                            logger.warning(f"Could not add student {st.get('name')} to sheet: {add_err}")

                if status_updates:
                    ws_stu.batch_update(status_updates, value_input_option="USER_ENTERED")
                    summary["updated_student_statuses"] = len(status_updates)
                    logger.info(f"Updated {len(status_updates)} student statuses in 'Học Sinh'.")

        # C. Đối soát Bài Nộp (Worksheet "Bài Nộp")
        if submissions:
            ws_sub = get_worksheet_by_title(sh, ["Bài Nộp", "Bai Nop", "Nộp Bài", "Submissions"])
            if ws_sub:
                sub_rows = ws_sub.get_all_values()
                sheet_sub_ids = {str(r[0]).strip() for r in sub_rows[1:] if r}
                new_subs = 0
                for sub in submissions:
                    s_id = str(sub.get("id", "")).strip()
                    if s_id and s_id not in sheet_sub_ids:
                        try:
                            save_submission_to_sheet(sub)
                            sheet_sub_ids.add(s_id)
                            new_subs += 1
                        except Exception:
                            pass
                summary["new_submissions_added"] = new_subs

        print(f"✅ Đối soát 2 chiều hoàn tất: Cập nhật {summary['updated_tuition_cells']} ô học phí, {summary['updated_student_statuses']} trạng thái, thêm {summary['new_students_added']} học sinh mới.")
        return summary

    except Exception as e:
        logger.error(f"Error during two-way sync: {e}")
        return {"status": "error", "message": str(e)}


def get_worksheet_by_title(sh, titles: List[str]):
    for t in titles:
        try:
            return sh.worksheet(t)
        except Exception:
            continue
    return None


def save_submission_to_sheet(sub_data: Dict[str, Any]) -> Dict[str, Any]:
    """Appends or updates a student submission in worksheet 'Bài Nộp'."""
    try:
        sh = get_spreadsheet()
        ws_sub = get_worksheet_by_title(sh, ["Bài Nộp", "Bai Nop", "Nộp Bài", "Nop Bai", "Submissions", "Bài Làm"])
        
        headers = ["Mã bài nộp", "Thời gian", "Họ và tên", "Lớp", "Mã bài", "Tên bài", "Hình thức", "Bài làm / Đáp án", "Trạng thái", "Điểm", "Nhận xét của Thầy"]
        
        if not ws_sub:
            ws_sub = sh.add_worksheet(title="Bài Nộp", rows=500, cols=11)
            ws_sub.append_row(headers, value_input_option="USER_ENTERED")

        sub_id = sub_data.get("id") or f"SUB-{int(time.time() * 1000)}"
        sub_time = sub_data.get("submitted_at") or datetime.now().strftime("%d/%m/%Y %H:%M:%S")
        stu_name = sub_data.get("student_name", "").strip()
        cls_name = sub_data.get("class_name", "").strip()
        prob_id = sub_data.get("problem_id", "").strip()
        prob_name = sub_data.get("problem_name", "").strip()
        sub_type = sub_data.get("submission_type_display") or ("Tự luận" if sub_data.get("type") == "essay" else "Điền đáp án")
        answer = sub_data.get("answer", "").strip()
        status = sub_data.get("status", "Đã nộp")
        score = str(sub_data.get("score", ""))
        feedback = sub_data.get("feedback", "")

        row_vals = [sub_id, sub_time, stu_name, cls_name, prob_id, prob_name, sub_type, answer, status, score, feedback]

        rows = ws_sub.get_all_values()
        found_idx = -1
        for r_idx in range(1, len(rows)):
            if len(rows[r_idx]) > 0 and rows[r_idx][0].strip() == sub_id:
                found_idx = r_idx + 1
                break

        if found_idx != -1:
            ws_sub.update(f"A{found_idx}:K{found_idx}", [row_vals], value_input_option="USER_ENTERED")
            action = "updated"
        else:
            ws_sub.append_row(row_vals, value_input_option="USER_ENTERED")
            action = "created"

        logger.info(f"Submission {sub_id} by '{stu_name}' for '{prob_id}' {action} in 'Bài Nộp'.")
        return {"status": "success", "action": action, "id": sub_id}
    except Exception as e:
        logger.error(f"Error saving submission to sheet: {e}")
        return {"status": "error", "message": str(e)}


def grade_submission_in_sheet(sub_id: str, status: str, score: str = "", feedback: str = "") -> Dict[str, Any]:
    """Updates grading result (status, score, feedback) for a submission in 'Bài Nộp'."""
    try:
        sh = get_spreadsheet()
        ws_sub = get_worksheet_by_title(sh, ["Bài Nộp", "Bai Nop", "Nộp Bài", "Nop Bai", "Submissions", "Bài Làm"])
        if not ws_sub:
            return {"status": "error", "message": "Không tìm thấy tab 'Bài Nộp'"}

        rows = ws_sub.get_all_values()
        found_idx = -1
        for r_idx in range(1, len(rows)):
            if len(rows[r_idx]) > 0 and rows[r_idx][0].strip() == sub_id:
                found_idx = r_idx + 1
                break

        if found_idx == -1:
            return {"status": "error", "message": f"Không tìm thấy bài nộp có mã {sub_id}"}

        # Columns: I = Status (col 9), J = Score (col 10), K = Feedback (col 11)
        ws_sub.update(f"I{found_idx}:K{found_idx}", [[status, score, feedback]], value_input_option="USER_ENTERED")
        logger.info(f"Graded submission {sub_id} in sheet: status={status}, score={score}")
        return {"status": "success", "id": sub_id, "status_val": status, "score": score, "feedback": feedback}
    except Exception as e:
        logger.error(f"Error grading submission in sheet: {e}")
        return {"status": "error", "message": str(e)}


if __name__ == "__main__":
    print("Testing two-way sync connection...")
    res = sync_all_from_local_json()
    print("Result:", res)
