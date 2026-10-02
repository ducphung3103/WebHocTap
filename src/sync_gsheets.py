import os
import sys
import json
import hashlib
from datetime import datetime
from typing import List, Dict, Any, Optional

# Ensure SSLKEYLOGFILE is safe
_sslkeylogfile = os.environ.get("SSLKEYLOGFILE")
if _sslkeylogfile and not os.path.exists(os.path.dirname(_sslkeylogfile)):
    del os.environ["SSLKEYLOGFILE"]

import gspread
from google.oauth2.service_account import Credentials
from config.settings import get_settings
from src.utils.logger import get_logger

logger = get_logger("sync.gsheets")


def hash_str(val: str) -> str:
    return hashlib.sha256(val.strip().encode("utf-8")).hexdigest()


def get_worksheet_by_title(spreadsheet: gspread.Spreadsheet, target_names: List[str]) -> Optional[gspread.Worksheet]:
    try:
        ws_map = {ws.title.strip().lower(): ws for ws in spreadsheet.worksheets()}
        # 1. Exact match
        for name in target_names:
            key = name.strip().lower()
            if key in ws_map:
                return ws_map[key]
        # 2. Fuzzy match
        for ws_title, ws in ws_map.items():
            for name in target_names:
                if name.lower() in ws_title or ws_title in name.lower():
                    return ws
    except Exception:
        pass
    return None


def git_push() -> bool:
    import subprocess
    print("\n📤 Đang commit và đẩy lên GitHub Pages...")
    try:
        subprocess.run(["git", "add", "docs/data.json"], check=True)
        res = subprocess.run(["git", "diff", "--staged", "--quiet"])
        if res.returncode != 0:
            subprocess.run(["git", "commit", "-m", "update: sync data from google sheets"], check=True)
            subprocess.run(["git", "push", "origin", "master"], check=True)
            print("✅ [HOÀN TẤT] Hệ thống đã được cập nhật trực tuyến trên GitHub Pages!\n")
        else:
            print("ℹ️ Dữ liệu đã mới nhất trên GitHub, không có thay đổi nào cần push.\n")
        return True
    except Exception as e:
        print(f"❌ [LỖI PUSH GITHUB] {e}\n")
        return False


def sync_gsheets(spreadsheet_id: Optional[str] = None, json_path: str = "docs/data.json") -> bool:
    settings = get_settings()
    sheet_id = (spreadsheet_id or settings.spreadsheet_id).strip()
    is_ci = os.getenv("CI") == "true" or not sys.stdin.isatty()

    if not sheet_id:
        if is_ci:
            print("ℹ️ SPREADSHEET_ID chưa được cấu hình trong GitHub Secrets. Bỏ qua bước đồng bộ.")
            return True

        print("\n========================================================")
        print("  🔑 CẤU HÌNH LIÊN KẾT GOOGLE SHEETS")
        print("========================================================")
        try:
            val = input("Vui lòng dán link Google Sheet (hoặc mã Spreadsheet ID) của thầy: ").strip()
            if "/d/" in val:
                val = val.split("/d/")[1].split("/")[0]
            sheet_id = val
            if sheet_id:
                with open(".env", "a", encoding="utf-8") as f:
                    f.write(f"\nSPREADSHEET_ID={sheet_id}\n")
                print(f"✅ Đã lưu SPREADSHEET_ID vào .env để sử dụng cho các lần sau!\n")
        except (KeyboardInterrupt, EOFError):
            print()
            return False

    if not sheet_id:
        logger.error("Chưa cung cấp SPREADSHEET_ID!")
        print("❌ Lỗi: Chưa cung cấp SPREADSHEET_ID. Vui lòng thiết lập biến môi trường hoặc trong .env!")
        return False

    sa_info = settings.get_service_account_dict()
    if not sa_info:
        if is_ci:
            print("ℹ️ GCP_SA_KEY chưa được cấu hình trong GitHub Secrets. Bỏ qua bước đồng bộ.")
            return True
        logger.error("Google Service Account credentials not found (checked JSON, env, and service_account.json)!")
        print("❌ Lỗi: Không tìm thấy thông tin xác thực Google Service Account (service_account.json hoặc GCP_SA_KEY)!")
        return False

    try:
        logger.info(f"Authenticating with Google Sheets API for sheet_id: {sheet_id}...")
        scopes = [
            "https://www.googleapis.com/auth/spreadsheets",
            "https://www.googleapis.com/auth/drive.readonly",
        ]
        credentials = Credentials.from_service_account_info(sa_info, scopes=scopes)
        gc = gspread.authorize(credentials)
        sh = gc.open_by_key(sheet_id)
        logger.info(f"Connected to Google Spreadsheet: '{sh.title}'")
        print(f"📡 Đã kết nối thành công tới Google Trang Tính: '{sh.title}'")
    except Exception as e:
        logger.error(f"Failed to connect to Google Sheets: {e}")
        print(f"\n❌ Lỗi kết nối Google Sheets: {e}")
        sa_email = sa_info.get("client_email", "")
        if "403" in str(e) or "permission" in str(e).lower():
            print("\n💡 HƯỚNG DẪN KHẮC PHỤC:")
            print(f"Tài khoản dịch vụ chưa được cấp quyền mở Google Sheet.")
            print(f"👉 Thầy hãy mở Google Sheet, bấm nút 'Chia sẻ' (Share) ở góc trên bên phải.")
            print(f"👉 Dán email sau vào với quyền 'Người xem' (Viewer):\n   {sa_email}\n")
        elif "404" in str(e):
            print("\n💡 HƯỚNG DẪN KHẮC PHỤC:")
            print(f"Không tìm thấy Google Sheet có ID: {sheet_id}")
            print(f"👉 Vui lòng kiểm tra lại đường link hoặc mã Spreadsheet ID trong file .env!\n")
        return False

    # Load existing docs/data.json
    existing_data = {}
    if os.path.exists(json_path):
        try:
            with open(json_path, "r", encoding="utf-8") as f:
                existing_data = json.load(f)
        except Exception:
            existing_data = {}

    existing_students = {s["name"]: s for s in existing_data.get("students", [])}

    # 1. Parse Security Config ("Cấu Hình Bảo Mật")
    auth_tokens = {}
    ws_sec = get_worksheet_by_title(sh, ["Cấu Hình Bảo Mật", "Cau Hinh Bao Mat", "Bảo Mật", "Security"])
    if ws_sec:
        sec_rows = ws_sec.get_all_values()
        for r in sec_rows[1:]:  # skip header
            if len(r) >= 3 and r[2].strip():
                target = r[0].strip()
                role_val = r[1].strip().upper()
                key_str = r[2].strip()
                token_hash = hash_str(key_str)

                if role_val == "ADMIN":
                    auth_tokens[token_hash] = {
                        "role": "admin",
                        "name": target or "Giáo viên (Admin)",
                        "class": "ALL"
                    }
                elif role_val == "CLASS":
                    cls_name = target
                    cls_key = "C++" if "C++" in target else ("Python 1-1" if "1-1" in target else "Python")
                    auth_tokens[token_hash] = {
                        "role": "class",
                        "name": cls_name,
                        "class": cls_key
                    }
    else:
        # Fallback to existing tokens if available
        auth_tokens = existing_data.get("auth_tokens", {})
        if not auth_tokens:
            auth_tokens[hash_str("NgocTrinh3101")] = {"role": "admin", "name": "Giáo viên (Admin)", "class": "ALL"}
            auth_tokens[hash_str("CPP2026")] = {"role": "class", "name": "Lớp C++", "class": "C++"}
            auth_tokens[hash_str("PYTHON2026")] = {"role": "class", "name": "Lớp Python", "class": "Python"}
            auth_tokens[hash_str("VIP11")] = {"role": "class", "name": "Lớp Python 1-1", "class": "Python 1-1"}

    # 2. Parse Problems ("Bài Tập")
    problems = []
    class_problems_map = {"C++": [], "Python": [], "Python 1-1": []}
    ws_prob = get_worksheet_by_title(sh, ["Bài Tập", "Bai Tap", "Theo dõi Bài tập", "Problems"])
    if ws_prob:
        prob_rows = ws_prob.get_all_values()
        for r in prob_rows[1:]:
            if len(r) >= 3 and r[0].strip() and r[2].strip():
                pid = r[0].strip()
                link = r[1].strip() if len(r) > 1 else ""
                name = r[2].strip()
                classes_str = r[3].strip() if len(r) > 3 and r[3].strip() else "Tất cả"
                level = r[4].strip() if len(r) > 4 and r[4].strip() else "1"
                tag = r[5].strip() if len(r) > 5 and r[5].strip() else "Brute Force"
                platform = r[6].strip() if len(r) > 6 and r[6].strip() else "MarisaOJ"

                c_list = []
                if "Tất cả" in classes_str or "All" in classes_str:
                    c_list = ["C++", "Python", "Python 1-1"]
                else:
                    if "C++" in classes_str:
                        c_list.append("C++")
                    if "Python 1-1" in classes_str or "1-1" in classes_str:
                        c_list.append("Python 1-1")
                    elif "Python" in classes_str:
                        c_list.append("Python")

                problems.append({
                    "id": pid,
                    "name": name,
                    "platform": platform,
                    "url": link,
                    "badge_color": "purple" if "marisa" in platform.lower() else "blue",
                    "category": tag,
                    "difficulty": f"Level {level} • {tag}",
                    "classes": c_list
                })

                for c in c_list:
                    if c in class_problems_map:
                        class_problems_map[c].append(pid)

    if not problems:
        problems = existing_data.get("problems", [])

    # 3. Parse Lectures ("Bài Giảng")
    curriculum = []
    ws_lec = get_worksheet_by_title(sh, ["Bài Giảng", "Bai Giang", "Lectures", "Curriculum"])
    if ws_lec:
        lec_rows = ws_lec.get_all_values()
        for idx, r in enumerate(lec_rows[1:], 2):
            if len(r) >= 3 and r[2].strip():
                lid = r[0].strip() if r[0].strip() else f"LEC-{idx}"
                chapter = r[1].strip() if len(r) > 1 else ""
                title = r[2].strip()
                classes_str = r[3].strip() if len(r) > 3 and r[3].strip() else "Tất cả"
                link = r[4].strip() if len(r) > 4 and r[4].strip() else "#"
                summary = r[5].strip() if len(r) > 5 else ""

                c_list = []
                if "Tất cả" in classes_str or "All" in classes_str:
                    c_list = ["C++", "Python", "Python 1-1"]
                else:
                    if "C++" in classes_str:
                        c_list.append("C++")
                    if "Python 1-1" in classes_str or "1-1" in classes_str:
                        c_list.append("Python 1-1")
                    elif "Python" in classes_str:
                        c_list.append("Python")

                curriculum.append({
                    "id": lid,
                    "chapter": chapter,
                    "title": title,
                    "classes": c_list,
                    "url": link,
                    "summary": summary
                })

    if not curriculum:
        curriculum = existing_data.get("curriculum", [])

    # 4. Parse Tuition Fees ("Học Phí")
    tuition_months = []
    tuition_data = {}
    ws_fee = get_worksheet_by_title(sh, ["Học Phí", "Hoc Phi", "Tuition", "Fee"])
    if ws_fee:
        fee_rows = ws_fee.get_all_values()
        if fee_rows:
            header_row = fee_rows[0]
            for c_idx in range(2, len(header_row)):
                m_val = header_row[c_idx].strip()
                if m_val:
                    tuition_months.append(m_val)

            for r in fee_rows[1:]:
                if r and r[0].strip() and not r[0].strip().startswith("="):
                    fee_name = r[0].strip()
                    st_fee_map = {}
                    for idx, m in enumerate(tuition_months, 2):
                        cell_val = r[idx].strip().lower() if idx < len(r) else ""
                        st_fee_map[m] = True if cell_val == "x" else False
                    tuition_data[fee_name] = st_fee_map

    if not tuition_months:
        tuition_months = existing_data.get("tuition_months", ["Tháng 9", "Tháng 10"])

    # 5. Parse Students ("Học Sinh")
    students = []
    ws_stu = get_worksheet_by_title(sh, ["Học Sinh", "Hoc Sinh", "Danh sách Học sinh", "Danh sach Hoc sinh", "Students"])
    if ws_stu:
        stu_rows = ws_stu.get_all_values()
        for idx, r in enumerate(stu_rows[1:], 1):
            if not r or len(r) < 2 or not r[1].strip():
                continue
            stt = r[0].strip() if r[0].strip() else str(idx)
            name_str = r[1].strip()
            cls_str = r[2].strip() if len(r) > 2 and r[2].strip() else "C++"
            marisa_str = r[3].strip() if len(r) > 3 else ""
            cf_h = r[4].strip() if len(r) > 4 else ""
            vj_h = r[5].strip() if len(r) > 5 else ""
            pin = r[6].strip() if len(r) > 6 else ""
            status = r[7].strip() if len(r) > 7 and r[7].strip() else "Đang học"

            # Re-use existing solve cache if available
            existing_st = existing_students.get(name_str, {})
            all_solved = existing_st.get("solved", [])
            class_prob_ids = class_problems_map.get(cls_str, [])
            target_solved = [pid for pid in class_prob_ids if pid in set(all_solved)]

            # Tuition matching
            st_tuition = {}
            for fn, fmap in tuition_data.items():
                if fn.lower() in name_str.lower() or name_str.lower() in fn.lower():
                    st_tuition = fmap
                    break
            if not st_tuition:
                st_tuition = {m: False for m in tuition_months}

            st_idx = int(stt) if stt.isdigit() else idx
            students.append({
                "stt": st_idx,
                "name": name_str,
                "class": cls_str,
                "cf_handle": cf_h,
                "vjudge_handle": vj_h,
                "marisa_handle": marisa_str,
                "pin": pin,
                "status": status,
                "tuition": st_tuition,
                "solved": all_solved,
                "target_solved": target_solved,
                "target_solved_count": len(target_solved),
                "target_class_total": len(class_prob_ids) if class_prob_ids else 8,
                "total_solved_count": len(all_solved),
                "rating": existing_st.get("rating", 0),
                "title": existing_st.get("title", "Newbie"),
                "rating_change": existing_st.get("rating_change", ""),
                "stats": existing_st.get("stats", {"week": 0, "month": 0, "year": 0, "total": len(all_solved)}),
                "activity": existing_st.get("activity", {})
            })

            # Add personal PIN token
            if pin:
                auth_tokens[hash_str(pin)] = {
                    "role": "student",
                    "name": name_str,
                    "class": cls_str
                }

    # SAFETY GUARD: Never wipe out existing student list
    if not students:
        logger.warning("Không tìm thấy học sinh nào từ Google Sheet. Giữ nguyên dữ liệu hiện tại để bảo vệ website.")
        print("⚠️ CẢNH BÁO: Sheet 'Học Sinh' rỗng hoặc chưa khớp cấu trúc. Giữ nguyên danh sách học sinh hiện có!")
        students = existing_data.get("students", [])

    class_config = existing_data.get("class_config", {
        "C++": {
            "name": "Lớp C++",
            "badge_color": "bg-blue-500/15 text-blue-300 border-blue-500/30",
            "total_problems": len(class_problems_map.get("C++", [])) or 8,
            "problem_ids": class_problems_map.get("C++", [])
        },
        "Python": {
            "name": "Lớp Python",
            "badge_color": "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
            "total_problems": len(class_problems_map.get("Python", [])) or 8,
            "problem_ids": class_problems_map.get("Python", [])
        },
        "Python 1-1": {
            "name": "Lớp Python 1-1",
            "badge_color": "bg-purple-500/15 text-purple-300 border-purple-500/30",
            "total_problems": len(class_problems_map.get("Python 1-1", [])) or 8,
            "problem_ids": class_problems_map.get("Python 1-1", [])
        }
    })

    final_data = existing_data if existing_data else {}
    final_data["students"] = students
    final_data["problems"] = problems
    final_data["curriculum"] = curriculum
    final_data["class_config"] = class_config
    final_data["auth_tokens"] = auth_tokens
    final_data["tuition_months"] = tuition_months
    final_data["last_updated"] = datetime.now().isoformat()

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(final_data, f, ensure_ascii=False, indent=2)

    logger.info(f"Google Sheets sync complete! Updated {json_path} with {len(students)} students, {len(problems)} problems, and {len(auth_tokens)} auth tokens.")
    print(f"✅ [THÀNH CÔNG] Đã đồng bộ Google Sheets sang {json_path} ({len(students)} học sinh, {len(problems)} bài tập, {len(curriculum)} bài giảng)!")
    return True


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Sync Google Sheets to Web")
    parser.add_argument("--push", action="store_true", help="Auto push to GitHub")
    parser.add_argument("--no-push", action="store_true", help="Skip push")
    parser.add_argument("sheet_id", nargs="?", default=None, help="Google Spreadsheet ID")
    args = parser.parse_args()

    ok = sync_gsheets(args.sheet_id)
    if ok:
        if args.push:
            git_push()
        elif not args.no_push and sys.stdin.isatty():
            try:
                ans = input("\nBạn có muốn tự động PUSH lên GitHub Pages không? (Y/n): ").strip().lower()
                if ans in ["", "y", "yes", "co", "c", "1"]:
                    git_push()
                else:
                    print("ℹ️ Dữ liệu đã cập nhật vào docs/data.json.\n")
            except (KeyboardInterrupt, EOFError):
                print("\n")
    else:
        sys.exit(1)
