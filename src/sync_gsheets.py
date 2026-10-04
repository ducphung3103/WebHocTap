import os
import sys
import json
import hashlib
import urllib.request
import re
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional, Tuple

# Ensure root is in sys.path
_root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _root_dir not in sys.path:
    sys.path.insert(0, _root_dir)

# Ensure SSLKEYLOGFILE is safe
_sslkeylogfile = os.environ.get("SSLKEYLOGFILE")
if _sslkeylogfile and not os.path.exists(_sslkeylogfile):
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


def fetch_online_submissions(cf_handle: str = "", clue_handle: str = "", existing_solved: Optional[List[str]] = None, existing_activity: Optional[Dict[str, Any]] = None) -> Tuple[List[str], Dict[str, Any], Dict[str, int]]:
    """Crawls Codeforces and ClueOJ submissions to compute solved problems, heatmap activity, and stats."""
    solved_set = set(existing_solved or [])
    online_activity: Dict[str, Dict[str, int]] = {}

    # Codeforces
    if cf_handle and cf_handle.strip():
        try:
            url = f"https://codeforces.com/api/user.status?handle={cf_handle.strip()}&from=1&count=5000"
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
            with urllib.request.urlopen(req, timeout=6) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                if data.get("status") == "OK":
                    for sub in data.get("result", []):
                        t = sub.get("creationTimeSeconds")
                        if not t:
                            continue
                        dt = datetime.fromtimestamp(t).strftime("%Y-%m-%d")
                        if dt not in online_activity:
                            online_activity[dt] = {"total": 0, "ac": 0}
                        online_activity[dt]["total"] += 1
                        if sub.get("verdict") == "OK":
                            online_activity[dt]["ac"] += 1
                            p = sub.get("problem", {})
                            cid = p.get("contestId")
                            idx = p.get("index")
                            if cid and idx:
                                solved_set.add(f"CF-{cid}{idx}")
        except Exception as e:
            logger.warning(f"Could not fetch CF submissions for {cf_handle}: {e}")

    # ClueOJ
    if clue_handle and clue_handle.strip():
        for page in range(1, 10):
            try:
                url = f"https://oj.clue.edu.vn/submissions/user/{clue_handle.strip()}/?page={page}"
                req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
                with urllib.request.urlopen(req, timeout=6) as resp:
                    html = resp.read().decode("utf-8")
                    probs = re.findall(r'href="/problem/([^"/]+)"', html)
                    dates = re.findall(r'data-iso="(\d{4}-\d{2}-\d{2})', html)
                    verdicts = re.findall(r'class="status">([^<]+)</span>', html)
                    scores = re.findall(r'class="score">([^<]+)</div>', html)
                    if not probs:
                        break
                    for i in range(min(len(probs), len(dates))):
                        p_code = probs[i]
                        d_str = dates[i]
                        score_str = scores[i] if i < len(scores) else ""
                        verdict_str = verdicts[i] if i < len(verdicts) else ""
                        is_ac = ("100" in score_str or "AC" in verdict_str or "Chấp nhận" in verdict_str)
                        if d_str not in online_activity:
                            online_activity[d_str] = {"total": 0, "ac": 0}
                        online_activity[d_str]["total"] += 1
                        if is_ac:
                            online_activity[d_str]["ac"] += 1
                            solved_set.add(f"CLUE-{p_code}")
            except Exception as e:
                break

    # If online activity was successfully fetched, use it; otherwise preserve existing_activity
    activity_map = online_activity if online_activity else dict(existing_activity or {})

    # Stats calculation
    now = datetime.now()
    ac_week = 0
    ac_month = 0
    ac_year = 0
    for d_str, v in activity_map.items():
        try:
            d_obj = datetime.strptime(d_str, "%Y-%m-%d")
            diff = (now - d_obj).days
            ac_cnt = v.get("ac", 0)
            if diff <= 7:
                ac_week += ac_cnt
            if diff <= 30:
                ac_month += ac_cnt
            if d_obj.year == now.year:
                ac_year += ac_cnt
        except Exception:
            pass

    total_ac = len(solved_set)
    stats_year = min(ac_year, total_ac)
    stats_month = min(ac_month, stats_year)
    stats_week = min(ac_week, stats_month)

    stats = {
        "week": stats_week,
        "month": stats_month,
        "year": stats_year,
        "total": total_ac
    }

    return list(solved_set), activity_map, stats


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

    def parse_classes_string(classes_str: str) -> List[str]:
        s = classes_str.strip()
        if not s or "Tất cả" in s or "All" in s or "Public" in s:
            return ["C++ nâng cao", "C++ cơ bản", "Python cơ bản", "Python 1-1"]

        c_list = []
        if "C++ nâng cao" in s or "26TI" in s:
            c_list.append("C++ nâng cao")
        if "C++ cơ bản" in s:
            c_list.append("C++ cơ bản")
        elif "C++" in s and "C++ nâng cao" not in s and "C++ cơ bản" not in s:
            c_list.extend(["C++ nâng cao", "C++ cơ bản"])

        if "Python 1-1" in s or "1-1" in s:
            c_list.append("Python 1-1")
        if "Python cơ bản" in s:
            c_list.append("Python cơ bản")
        elif "Python" in s and "Python 1-1" not in s and "Python cơ bản" not in s:
            c_list.append("Python cơ bản")

        return c_list if c_list else ["C++ cơ bản", "Python cơ bản"]

    # 2. Parse Problems ("Bài Tập")
    def parse_single_problem_row(r):
        if len(r) < 3 or not r[0].strip() or not r[2].strip():
            return None
        pid = r[0].strip()
        link = r[1].strip() if len(r) > 1 else ""
        name = r[2].strip()
        classes_str = r[3].strip() if len(r) > 3 and r[3].strip() else "Tất cả"
        level = r[4].strip() if len(r) > 4 and r[4].strip() else "1"
        tag = r[5].strip() if len(r) > 5 and r[5].strip() else "Brute Force"
        platform = r[6].strip() if len(r) > 6 and r[6].strip() else "MarisaOJ"

        c_list = parse_classes_string(classes_str)

        plat_lower = platform.lower()
        norm_plat = platform
        b_color = "blue"
        if "chuyentin" in plat_lower or "ctoj" in plat_lower or "oj.chuyentin.pro" in plat_lower:
            norm_plat = "ChuyenTinPro"
            b_color = "teal"
        elif "clue" in plat_lower:
            norm_plat = "ClueOJ"
            b_color = "cyan"
        elif "deruck" in plat_lower or "judge" in plat_lower or "nội bộ" in plat_lower:
            norm_plat = "DeruckOJ"
            b_color = "indigo"
        elif "codeforces" in plat_lower or "cf" == plat_lower:
            norm_plat = "Codeforces"
            b_color = "blue"
        elif "vjudge" in plat_lower:
            norm_plat = "VJudge"
            b_color = "emerald"
        elif "marisa" in plat_lower:
            norm_plat = "MarisaOJ"
            b_color = "purple"
        elif "vnoi" in plat_lower or "vnoj" in plat_lower:
            norm_plat = "VNOI"
            b_color = "amber"
        elif "atcoder" in plat_lower:
            norm_plat = "AtCoder"
            b_color = "rose"
        elif "cses" in plat_lower:
            norm_plat = "CSES"
            b_color = "violet"
        elif "kattis" in plat_lower:
            norm_plat = "Kattis"
            b_color = "pink"
        elif "spoj" in plat_lower:
            norm_plat = "SPOJ"
            b_color = "sky"

        return {
            "id": pid,
            "name": name,
            "platform": norm_plat,
            "url": link,
            "badge_color": b_color,
            "category": tag,
            "difficulty": f"Level {level} • {tag}",
            "classes": c_list
        }

    problems = []
    seen_pids = set()
    class_problems_map = {
        "C++ nâng cao": [],
        "C++ cơ bản": [],
        "Python cơ bản": [],
        "Python 1-1": []
    }

    # 2.1 Tab chính: "Bài Tập" (Curated homework tracked for students)
    ws_prob = get_worksheet_by_title(sh, ["Bài Tập", "Bai Tap", "Theo dõi Bài tập", "Problems"])
    if ws_prob:
        prob_rows = ws_prob.get_all_values()
        for r in prob_rows[1:]:
            p_obj = parse_single_problem_row(r)
            if p_obj and p_obj["id"] not in seen_pids:
                seen_pids.add(p_obj["id"])
                problems.append(p_obj)
                for c in p_obj["classes"]:
                    if c in class_problems_map:
                        class_problems_map[c].append(p_obj["id"])
        logger.info(f"Loaded {len(problems)} curated homework problems from tab '{ws_prob.title}'")
    else:
        problems = existing_data.get("problems", [])

    # Preserve testcases for curated DeruckOJ problems if defined
    sheet_pids = {p["id"] for p in problems}
    for ep in existing_data.get("problems", []):
        if ep.get("id") in sheet_pids and "testcases" in ep:
            for p in problems:
                if p["id"] == ep["id"] and "testcases" not in p:
                    p["testcases"] = ep["testcases"]

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

                c_list = parse_classes_string(classes_str)

                curriculum.append({
                    "id": lid,
                    "chapter": chapter,
                    "title": title,
                    "classes": c_list,
                    "url": link,
                    "summary": summary
                })
        logger.info(f"Loaded {len(curriculum)} curriculum lectures from tab '{ws_lec.title}'")
    else:
        curriculum = existing_data.get("curriculum", [])

    # 4. Parse Tuition Fees ("Học Phí")
    tuition_months = []
    tuition_data = {}
    ws_fee = get_worksheet_by_title(sh, ["Học Phí", "Hoc Phi", "Tuition", "Fee"])
    if ws_fee:
        fee_rows = ws_fee.get_all_values()
        if fee_rows:
            # Find the header row containing "Họ và tên" or "Tháng"
            header_row_idx = -1
            for r_idx, r in enumerate(fee_rows):
                r_text = " ".join([str(c).strip().lower() for c in r])
                if "họ và tên" in r_text or "tháng" in r_text or "thang" in r_text:
                    header_row_idx = r_idx
                    break

            if header_row_idx != -1:
                header_row = fee_rows[header_row_idx]
                month_cols = []
                for c_idx, col_name in enumerate(header_row):
                    m_val = str(col_name).strip()
                    if not m_val:
                        continue
                    m_lower = m_val.lower()
                    if "tháng" in m_lower or "thang" in m_lower or "month" in m_lower or any(m_lower.startswith(x) for x in ["t9", "t10", "t11", "t12"]):
                        tuition_months.append(m_val)
                        month_cols.append((m_val, c_idx))
                    elif c_idx >= 2 and "họ" not in m_lower and "lớp" not in m_lower and "stt" not in m_lower:
                        tuition_months.append(m_val)
                        month_cols.append((m_val, c_idx))

                def is_paid_val(val: Any) -> bool:
                    if val is True:
                        return True
                    s = str(val).strip().lower()
                    return s in ["true", "x", "1", "v", "✓", "yes", "co", "c", "đã đóng", "da dong", "ok"]

                for r in fee_rows[header_row_idx + 1:]:
                    if not r:
                        continue
                    fee_name = str(r[0]).strip()
                    if not fee_name or fee_name.startswith("=") or fee_name.isdigit() or fee_name.lower() in ["tổng", "tong", "total", "sum"]:
                        continue
                    st_fee_map = {}
                    for m_name, c_idx in month_cols:
                        c_val = r[c_idx] if c_idx < len(r) else ""
                        st_fee_map[m_name] = is_paid_val(c_val)
                    tuition_data[fee_name] = st_fee_map

    if not tuition_months:
        tuition_months = existing_data.get("tuition_months", ["Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12"])

    # 5. Parse Students ("Học Sinh")
    students = []
    ws_stu = get_worksheet_by_title(sh, ["Học Sinh", "Hoc Sinh", "Danh sách Học sinh", "Danh sach Hoc sinh", "Students"])
    if ws_stu:
        stu_rows = ws_stu.get_all_values()
        if stu_rows:
            header_row = [str(c).strip().lower() for c in stu_rows[0]]
            col_map = {}
            for col_idx, col_name in enumerate(header_row):
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
                elif any(k in col_name for k in ["chuyentin", "chuyên tin", "ctoj", "chuyentinpro"]) and "ctoj" not in col_map:
                    col_map["ctoj"] = col_idx
                elif any(k in col_name for k in ["pin", "mật khẩu", "password", "pass"]) and "pin" not in col_map:
                    col_map["pin"] = col_idx
                elif any(k in col_name for k in ["trạng thái", "status"]) and "status" not in col_map:
                    col_map["status"] = col_idx

            def get_cell(row, key, default_idx=-1, default=""):
                idx = col_map.get(key, default_idx)
                if 0 <= idx < len(row):
                    val = str(row[idx]).strip()
                    if val and val != "None":
                        return val
                return default

            for idx, r in enumerate(stu_rows[1:], 1):
                name_str = get_cell(r, "name", 1, "")
                if not name_str:
                    continue
                stt = get_cell(r, "stt", 0, str(idx))
                cls_str = get_cell(r, "class", 2, "C++")
                marisa_str = get_cell(r, "marisa", 3, "")
                cf_h = get_cell(r, "cf", 4, "")
                vj_h = get_cell(r, "vjudge", 5, "")
                vnoi_h = get_cell(r, "vnoi", -1, "")
                clue_h = get_cell(r, "clue", -1, "")
                ctoj_h = get_cell(r, "ctoj", -1, "")
                pin = get_cell(r, "pin", 6 if "vnoi" not in col_map and "clue" not in col_map and "ctoj" not in col_map else -1, "")
                status = get_cell(r, "status", 7 if "vnoi" not in col_map and "clue" not in col_map and "ctoj" not in col_map else -1, "Đang học")

                # Re-use existing solve cache if available
                existing_st = existing_students.get(name_str, {})
                all_solved = existing_st.get("solved", [])
                st_activity = existing_st.get("activity", {})
                st_stats = existing_st.get("stats", {"week": 0, "month": 0, "year": 0, "total": len(all_solved)})

                # Auto-crawl online submissions for platforms with direct API access (CF, ClueOJ)
                if cf_h or clue_h:
                    all_solved, st_activity, st_stats = fetch_online_submissions(
                        cf_handle=cf_h,
                        clue_handle=clue_h,
                        existing_solved=all_solved,
                        existing_activity=st_activity
                    )

                class_prob_ids = class_problems_map.get(cls_str, [])
                target_solved = [pid for pid in class_prob_ids if pid in set(all_solved)]

                # Tuition matching: exact match or subset words with matching given name
                st_tuition = {}
                name_clean = name_str.lower().strip()
                name_words = name_clean.split()
                # 1. Exact match
                for fn, fmap in tuition_data.items():
                    if fn.lower().strip() == name_clean:
                        st_tuition = fmap
                        break
                # 2. Subset words with identical given name (e.g. "Gia Hưng" in "Trần Gia Hưng", "Huy" in "Nguyễn Đắc Gia Huy")
                if not st_tuition:
                    for fn, fmap in tuition_data.items():
                        fn_words = fn.lower().strip().split()
                        if fn_words and name_words and fn_words[-1] == name_words[-1]:
                            if set(fn_words).issubset(set(name_words)) or set(name_words).issubset(set(fn_words)):
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
                    "vnoi_handle": vnoi_h,
                    "clue_handle": clue_h,
                    "ctoj_handle": ctoj_h,
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
                    "stats": st_stats,
                    "activity": st_activity
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

    class_config = dict(existing_data.get("class_config", {}))
    default_classes = {
        "C++ nâng cao": {"name": "Lớp C++ nâng cao", "badge_color": "bg-blue-500/15 text-blue-300 border-blue-500/30"},
        "C++ cơ bản": {"name": "Lớp C++ cơ bản", "badge_color": "bg-cyan-500/15 text-cyan-300 border-cyan-500/30"},
        "Python cơ bản": {"name": "Lớp Python cơ bản", "badge_color": "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"},
        "Python 1-1": {"name": "Lớp Python 1-1", "badge_color": "bg-purple-500/15 text-purple-300 border-purple-500/30"}
    }
    for c_key, c_info in default_classes.items():
        if c_key not in class_config:
            class_config[c_key] = dict(c_info)
        pids = class_problems_map.get(c_key, [])
        if pids:
            class_config[c_key]["problem_ids"] = pids
            class_config[c_key]["total_problems"] = len(pids)
        elif not class_config[c_key].get("total_problems"):
            class_config[c_key]["total_problems"] = max(1, len(pids))

    final_data = existing_data if existing_data else {}
    grader_problems = existing_data.get("grader_problems", [])
    final_data["grader_problems"] = grader_problems

    final_data["students"] = students
    final_data["problems"] = problems
    final_data["curriculum"] = curriculum
    final_data["class_config"] = class_config
    final_data["auth_tokens"] = auth_tokens
    final_data["tuition_months"] = tuition_months
    final_data["last_updated"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

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
    parser.add_argument("--two-way", action="store_true", help="Perform two-way sync (push local edits to Google Sheet, then pull)")
    parser.add_argument("sheet_id", nargs="?", default=None, help="Google Spreadsheet ID")
    args = parser.parse_args()

    if args.two_way:
        try:
            from src.sync_to_gsheet import sync_all_from_local_json
            print("🔄 [2-WAY SYNC] Đang đối soát và cập nhật dữ liệu từ Web lên Google Sheet...")
            sync_all_from_local_json()
        except Exception as e:
            print(f"⚠️ Cảnh báo 2-way sync: {e}")

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
