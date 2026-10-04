"""
CRAWL & CLASSIFY SOLVED PROBLEMS TO GOOGLE SHEET (ZERO TOKEN AI)
---------------------------------------------------------------
Tự động crawl toàn bộ bài tập bạn đã nộp AC từ các nền tảng (Codeforces, MarisaOJ, ClueOJ...),
tự động phân loại Dạng bài (Algorithm Category) và Độ khó (Level) hoàn toàn bằng thuật toán / API có sẵn
mà KHÔNG TỐN BẤT KỲ TOKEN AI NÀO!

Sau đó, tự động ghi trực tiếp vào Google Sheet tab 'Bài Tập' mà không làm trùng lặp các bài cũ.
"""

import os
import sys
import json
import re
import argparse
import urllib.request
import urllib.parse
from datetime import datetime
from typing import Dict, List, Set, Any, Optional, Tuple

# Reconfigure console encoding on Windows
sys.stdout.reconfigure(encoding='utf-8')

# Ensure SSLKEYLOGFILE doesn't crash on Windows
os.environ.pop("SSLKEYLOGFILE", None)

# Add project root to sys.path
_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _PROJECT_ROOT not in sys.path:
    sys.path.insert(0, _PROJECT_ROOT)

import gspread
from google.oauth2.service_account import Credentials
from config.settings import get_settings


# ==============================================================================
# 1. ZERO-TOKEN ALGORITHM & DIFFICULTY CLASSIFIER (RULE-BASED DICTIONARY)
# ==============================================================================

# Thứ tự ưu tiên phân loại khi 1 bài có nhiều tag
TAG_PRIORITY_ORDER = [
    "dp",
    "graphs",
    "trees",
    "data structures",
    "dsu",
    "shortest paths",
    "flows",
    "string suffix structures",
    "strings",
    "greedy",
    "number theory",
    "combinatorics",
    "binary search",
    "two pointers",
    "geometry",
    "bitmasks",
    "divide and conquer",
    "matrices",
    "games",
    "probabilities",
    "math",
    "sortings",
    "brute force",
    "constructive algorithms",
    "implementation",
]

TAG_VN_MAP: Dict[str, str] = {
    "dp": "Quy hoạch động",
    "dynamic programming": "Quy hoạch động",
    "greedy": "Tham lam (Greedy)",
    "math": "Toán học",
    "number theory": "Số học & Ước số",
    "combinatorics": "Toán tổ hợp",
    "probabilities": "Xác suất & Kỳ vọng",
    "graphs": "Thuật toán Đồ thị",
    "graph matchings": "Đồ thị nâng cao (Matching)",
    "dfs and similar": "Duyệt đồ thị (DFS/BFS)",
    "trees": "Cây & Cấu trúc Cây",
    "shortest paths": "Đường đi ngắn nhất",
    "flows": "Luồng cực đại & Lát cắt",
    "data structures": "Cấu trúc Dữ liệu",
    "dsu": "Cấu trúc DSU",
    "strings": "Xử lý chuỗi",
    "string suffix structures": "Cấu trúc xâu nâng cao",
    "binary search": "Chặt nhị phân",
    "two pointers": "Kỹ thuật Hai con trỏ",
    "sortings": "Sắp xếp",
    "ternary search": "Chặt tam phân",
    "brute force": "Vét cạn / Duyệt toàn bộ",
    "implementation": "Căn bản & Kỹ thuật lập trình",
    "geometry": "Hình học tính toán",
    "constructive algorithms": "Thuật toán Xây dựng",
    "bitmasks": "Xử lý bit (Bitmask)",
    "divide and conquer": "Chia để trị",
    "games": "Lý thuyết trò chơi",
    "matrices": "Ma trận & Lũy thừa ma trận",
    "meet-in-the-middle": "Meet-in-the-middle",
    "interactive": "Bài toán Tương tác",
}


def classify_tags_to_category(tags: List[str], problem_name: str = "") -> str:
    """Classifies algorithm category using priority tag dictionary without AI tokens."""
    tags_lower = [t.lower().strip() for t in tags]

    # 1. Match based on tag priority
    for prio_tag in TAG_PRIORITY_ORDER:
        if prio_tag in tags_lower:
            return TAG_VN_MAP.get(prio_tag, prio_tag.title())

    # 2. Any other tag
    for t in tags_lower:
        if t in TAG_VN_MAP:
            return TAG_VN_MAP[t]

    # 3. Fallback based on problem name keywords (Vietnamese/English)
    name_lower = problem_name.lower()
    if any(k in name_lower for k in ["prime", "nguyên tố", "gcd", "ước", "lcm", "bội", "modulo", "chia hết"]):
        return "Số học & Ước số"
    if any(k in name_lower for k in ["tổng", "sum", "a + b", "nhập", "xuất", "phép toán"]):
        return "Nhập xuất & Phép toán"
    if any(k in name_lower for k in ["dãy con", "bậc thang", "cái túi", "balo", "lis", "lcs"]):
        return "Quy hoạch động"
    if any(k in name_lower for k in ["chuỗi", "xâu", "string", "palindrome"]):
        return "Xử lý chuỗi"
    if any(k in name_lower for k in ["mảng", "array", "vector"]):
        return "Mảng 1 chiều"
    if any(k in name_lower for k in ["đường đi", "cây", "đồ thị", "graph"]):
        return "Thuật toán Đồ thị"

    return "Căn bản & Duyệt vết"


def rating_to_level(rating: Optional[int], index: str = "") -> int:
    """Converts Codeforces numerical rating or problem index to difficulty Level 1-5."""
    if rating and rating > 0:
        if rating <= 900:
            return 1
        elif rating <= 1200:
            return 2
        elif rating <= 1500:
            return 3
        elif rating <= 1800:
            return 4
        else:
            return 5

    # Heuristic based on problem index (A, B, C, D...)
    idx_letter = index[:1].upper()
    if idx_letter in ["A", "1"]:
        return 1
    elif idx_letter in ["B", "2"]:
        return 2
    elif idx_letter in ["C", "3"]:
        return 3
    elif idx_letter in ["D", "4"]:
        return 4
    elif idx_letter in ["E", "F", "G", "5", "6"]:
        return 5
    return 1


# ==============================================================================
# 2. CRAWL CODEFORCES SOLVED SUBMISSIONS (FREE API)
# ==============================================================================

def crawl_codeforces_solved(handle: str) -> List[Dict[str, Any]]:
    """Crawls all AC submissions for a CF handle via public API."""
    handle = handle.strip()
    if not handle:
        return []

    print(f"📡 Đang kết nối Codeforces API để quét bài nộp của handle '{handle}'...")
    url = f"https://codeforces.com/api/user.status?handle={urllib.parse.quote(handle)}&from=1&count=10000"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})

    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except Exception as exc:
        print(f"❌ Lỗi khi tải dữ liệu từ Codeforces: {exc}")
        return []

    if data.get("status") != "OK":
        print(f"❌ Codeforces API trả về lỗi: {data.get('comment', 'Unknown')}")
        return []

    seen_pids = set()
    solved_problems: List[Dict[str, Any]] = []

    for sub in data.get("result", []):
        if sub.get("verdict") != "OK":
            continue

        prob = sub.get("problem", {})
        cid = prob.get("contestId")
        p_idx = prob.get("index")
        if not (cid and p_idx):
            continue

        pid = f"CF-{cid}{p_idx}"
        if pid in seen_pids:
            continue
        seen_pids.add(pid)

        p_name = prob.get("name", pid)
        rating = prob.get("rating")
        tags = prob.get("tags", [])
        category = classify_tags_to_category(tags, p_name)
        level = rating_to_level(rating, p_idx)

        solved_problems.append({
            "id": pid,
            "name": p_name,
            "platform": "Codeforces",
            "url": f"https://codeforces.com/problemset/problem/{cid}/{p_idx}",
            "level": level,
            "rating": rating,
            "category": category,
            "tags": tags,
            "notes": f"Rating {rating or 'Chưa rank'} • {', '.join(tags[:3]) if tags else 'Cơ bản'}"
        })

    print(f"✅ Codeforces: Đã tìm thấy {len(solved_problems)} bài làm đúng (AC) duy nhất!")
    return solved_problems


# ==============================================================================
# 3. CRAWL CLUEOJ SOLVED SUBMISSIONS
# ==============================================================================

def crawl_clueoj_solved(handle: str, max_pages: int = 15) -> List[Dict[str, Any]]:
    """Crawls AC submissions from ClueOJ."""
    handle = handle.strip()
    if not handle:
        return []

    print(f"📡 Đang quét bài nộp trên ClueOJ của handle '{handle}'...")
    solved_pids: Set[str] = set()
    solved_problems: List[Dict[str, Any]] = []

    for page in range(1, max_pages + 1):
        try:
            url = f"https://oj.clue.edu.vn/submissions/user/{urllib.parse.quote(handle)}/?page={page}"
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=10) as resp:
                html = resp.read().decode("utf-8")

            probs = re.findall(r'href="/problem/([^"/]+)"', html)
            verdicts = re.findall(r'class="status">([^<]+)</span>', html)
            scores = re.findall(r'class="score">([^<]+)</div>', html)

            if not probs:
                break

            for i in range(len(probs)):
                p_code = probs[i]
                score_str = scores[i] if i < len(scores) else ""
                verdict_str = verdicts[i] if i < len(verdicts) else ""
                is_ac = ("100" in score_str or "AC" in verdict_str or "Chấp nhận" in verdict_str)

                if is_ac and p_code not in solved_pids:
                    solved_pids.add(p_code)
                    pid = f"CLUE-{p_code}"
                    p_name = p_code.replace("-", " ").title()
                    solved_problems.append({
                        "id": pid,
                        "name": p_name,
                        "platform": "ClueOJ",
                        "url": f"https://oj.clue.edu.vn/problem/{p_code}",
                        "level": 1,
                        "category": classify_tags_to_category([], p_name),
                        "notes": "ClueOJ Practice"
                    })
        except Exception:
            break

    print(f"✅ ClueOJ: Đã tìm thấy {len(solved_problems)} bài làm đúng (AC) duy nhất!")
    return solved_problems


def crawl_marisaoj_solved(handle: str) -> List[Dict[str, Any]]:
    """Crawls AC submissions from MarisaOJ using MarisaOJCrawler."""
    handle = handle.strip()
    if not handle:
        return []

    print(f"📡 Đang quét bài nộp trên MarisaOJ của handle '{handle}'...")
    try:
        from src.crawlers.marisaoj import MarisaOJCrawler
        crawler = MarisaOJCrawler(headless=True)
        solved_ids, _ = crawler.crawl_user(handle)
        solved_problems = []
        for pid in sorted(list(solved_ids)):
            p_num = pid.replace("MARISA-", "")
            try:
                num_val = int(p_num)
                lvl = 1 if num_val < 30 else (2 if num_val < 150 else 3)
            except Exception:
                lvl = 1

            solved_problems.append({
                "id": pid,
                "name": f"MarisaOJ #{p_num}",
                "platform": "MarisaOJ",
                "url": f"https://marisaoj.com/problem/{p_num}",
                "level": lvl,
                "category": "Căn bản & Luyện tập",
                "notes": "MarisaOJ Solved"
            })
        print(f"✅ MarisaOJ: Đã tìm thấy {len(solved_problems)} bài làm đúng (AC) duy nhất!")
        return solved_problems
    except Exception as exc:
        print(f"❌ Lỗi khi quét MarisaOJ: {exc}")
        return []


# ==============================================================================
# 4. APPEND TO GOOGLE SHEET ("BÀI TẬP" TAB)
# ==============================================================================

def append_problems_to_google_sheet(
    problems: List[Dict[str, Any]],
    spreadsheet_id: Optional[str] = None,
    target_class: str = "Tất cả",
    dry_run: bool = False
) -> int:
    """Appends new unique problems directly into Google Sheet 'Bài Tập'."""
    settings = get_settings()
    sheet_id = spreadsheet_id or settings.spreadsheet_id
    if not sheet_id:
        print("❌ Chưa cấu hình SPREADSHEET_ID trong .env! Vui lòng kiểm tra lại.")
        return 0

    sa_info = settings.get_service_account_dict()
    if not sa_info:
        print("❌ Không tìm thấy thông tin Google Service Account credentials!")
        return 0

    try:
        scopes = [
            "https://www.googleapis.com/auth/spreadsheets",
            "https://www.googleapis.com/auth/drive.readonly",
        ]
        credentials = Credentials.from_service_account_info(sa_info, scopes=scopes)
        gc = gspread.authorize(credentials)
        sh = gc.open_by_key(sheet_id)
        print(f"📊 Đã mở Google Trang Tính: '{sh.title}'")

        # Find or pick worksheet
        ws = None
        for cand in ["Bài Tập", "Bai Tap", "Theo dõi Bài tập", "Problems"]:
            try:
                ws = sh.worksheet(cand)
                if ws:
                    break
            except Exception:
                pass

        if not ws:
            print("❌ Không tìm thấy tab 'Bài Tập' trong Google Sheet! Tạo tab mới...")
            ws = sh.add_worksheet(title="Bài Tập", rows=100, cols=8)
            ws.append_row(["Mã bài", "Link bài tập", "Tên bài tập", "Class", "Level", "Dạng bài", "Nền tảng", "Ghi chú"])

        # Fetch existing problem IDs in Column A
        existing_rows = ws.get_all_values()
        existing_pids: Set[str] = set()
        for r in existing_rows[1:]:
            if r and r[0].strip():
                existing_pids.add(r[0].strip().upper())

        print(f"ℹ️ Sheet hiện đang có {len(existing_pids)} bài tập.")

        # Filter new problems
        new_rows = []
        for p in problems:
            pid = p["id"].strip()
            if pid.upper() in existing_pids:
                continue

            existing_pids.add(pid.upper())
            new_rows.append([
                pid,
                p.get("url", "#"),
                p.get("name", pid),
                target_class,
                str(p.get("level", 1)),
                p.get("category", "Căn bản"),
                p.get("platform", "Codeforces"),
                p.get("notes", "")
            ])

        if not new_rows:
            print("✨ Toàn bộ các bài bạn vừa crawl đều ĐÃ CÓ TRÊN GOOGLE SHEET. Không cần thêm dòng mới nào!")
            return 0

        print(f"\n🚀 Tìm thấy {len(new_rows)} bài MỚI CHƯA CÓ TRÊN SHEET để thêm vào:")
        for r in new_rows[:10]:
            print(f"   ➕ [{r[0]}] {r[2]} ({r[6]} • {r[5]} • Level {r[4]})")
        if len(new_rows) > 10:
            print(f"   ... và {len(new_rows) - 10} bài khác.")

        if dry_run:
            print("\n⚠️ Chế độ xem trước (--dry-run): Không ghi vào Google Sheet.")
            return len(new_rows)

        print(f"\n⏳ Đang ghi {len(new_rows)} bài tập vào Google Sheet theo từng đợt (100 bài/lần)...")
        batch_size = 100
        for i in range(0, len(new_rows), batch_size):
            chunk = new_rows[i:i + batch_size]
            ws.append_rows(chunk, value_input_option="USER_ENTERED")
            print(f"   ✅ Đã nạp thành công {min(i + batch_size, len(new_rows))}/{len(new_rows)} bài vào Sheet...")
        print(f"🎉 THÀNH CÔNG! Đã tự động ghi nhận {len(new_rows)} bài tập vào tab 'Bài Tập' trên Google Sheet!")
        return len(new_rows)

    except Exception as exc:
        print(f"\n❌ Lỗi khi ghi vào Google Sheet: {exc}")
        if "403" in str(exc) or "permission" in str(exc).lower():
            print("\n💡 HƯỚNG DẪN KHẮC PHỤC QUYỀN GHI TRÊN GOOGLE SHEET:")
            print("   Tài khoản dịch vụ (Service Account) hiện tại chỉ được cấp quyền 'Người xem' (Viewer).")
            print("   👉 Thầy chỉ cần mở Google Sheet 'Quản lý học sinh' trên trình duyệt.")
            print("   👉 Bấm nút 'Chia sẻ' (Share) ở góc trên bên phải.")
            print("   👉 Đổi quyền của email sau từ 'Người xem' thành 'Người chỉnh sửa' (Editor):")
            print("      sheet-sync@webhoctap-510409.iam.gserviceaccount.com")
            print("   👉 Bấm 'Lưu' (Save) rồi chạy lại lệnh, toàn bộ bài tập sẽ được tự động ghi vào Sheet!")
        return 0


# ==============================================================================
# 5. CLI ENTRYPOINT
# ==============================================================================

def main():
    default_cf = os.getenv("TEACHER_CF_HANDLE", "DeruckLoveNewTechnology").strip()
    default_clue = os.getenv("TEACHER_CLUE_HANDLE", "phungduc3103").strip()
    default_marisa = os.getenv("TEACHER_MARISA_HANDLE", "ducdacoder3103").strip()

    parser = argparse.ArgumentParser(
        description="Crawl bài tập đã giải và phân loại vào Google Sheet hoàn toàn MIỄN PHÍ KHÔNG TỐN TOKEN AI."
    )
    parser.add_argument("--cf", type=str, default=default_cf, help=f"Handle Codeforces của bạn [Mặc định: {default_cf}]")
    parser.add_argument("--marisa", type=str, default="", help=f"Handle MarisaOJ của bạn (vd: {default_marisa})")
    parser.add_argument("--clue", type=str, default="", help=f"Handle ClueOJ của bạn (vd: {default_clue})")
    parser.add_argument("--class", dest="target_class", type=str, default="Tất cả", help="Lớp áp dụng (vd: 'Tất cả', 'C++ nâng cao', 'Python cơ bản')")
    parser.add_argument("--sheet-id", type=str, default="", help="Mã Google Sheet ID (nếu khác trong .env)")
    parser.add_argument("--dry-run", action="store_true", help="Chỉ xem trước kết quả phân loại, không ghi vào Sheet")
    parser.add_argument("--export-csv", type=str, default="", help="Xuất danh sách bài tập đã phân loại ra file CSV")
    parser.add_argument("--export-json", type=str, default="", help="Xuất danh sách bài tập ra file JSON")

    args = parser.parse_args()

    if not args.cf and not args.marisa and not args.clue:
        print("\n========================================================")
        print("  🎯 CÔNG CỤ CRAWL & TỰ ĐỘNG PHÂN LOẠI BÀI VÀO GOOGLE SHEET")
        print("     (Hoàn toàn Miễn Phí • 0 Token AI • Thuật toán Chuẩn CP)")
        print("========================================================")
        try:
            cf_in = input("Nhập Handle Codeforces của bạn (hoặc bấm Enter để bỏ qua): ").strip()
            marisa_in = input("Nhập Handle MarisaOJ của bạn (hoặc bấm Enter để bỏ qua): ").strip()
            clue_in = input("Nhập Handle ClueOJ của bạn (hoặc bấm Enter để bỏ qua): ").strip()
            cls_in = input("Lớp áp dụng cho các bài này [Mặc định: Tất cả]: ").strip()
            args.cf = cf_in
            args.marisa = marisa_in
            args.clue = clue_in
            if cls_in:
                args.target_class = cls_in
        except (KeyboardInterrupt, EOFError):
            print()
            return

    all_solved: List[Dict[str, Any]] = []

    # 1. Codeforces
    if args.cf:
        cf_probs = crawl_codeforces_solved(args.cf)
        all_solved.extend(cf_probs)

    # 2. MarisaOJ
    if args.marisa:
        marisa_probs = crawl_marisaoj_solved(args.marisa)
        all_solved.extend(marisa_probs)

    # 3. ClueOJ
    if args.clue:
        clue_probs = crawl_clueoj_solved(args.clue)
        all_solved.extend(clue_probs)

    if not all_solved:
        print("⚠️ Không tìm thấy bài tập nào được crawl! Vui lòng kiểm tra lại handle.")
        return

    # Export CSV if requested
    if args.export_csv:
        try:
            import csv
            with open(args.export_csv, "w", encoding="utf-8-sig", newline="") as f:
                writer = csv.writer(f)
                writer.writerow(["Mã bài", "Link bài tập", "Tên bài tập", "Class", "Level", "Dạng bài", "Nền tảng", "Ghi chú"])
                for p in all_solved:
                    writer.writerow([
                        p["id"], p["url"], p["name"], args.target_class, p["level"], p["category"], p["platform"], p.get("notes", "")
                    ])
            print(f"📁 Đã xuất {len(all_solved)} bài tập ra file CSV: {args.export_csv}")
        except Exception as e:
            print(f"❌ Không thể xuất CSV: {e}")

    # Export JSON if requested
    if args.export_json:
        try:
            with open(args.export_json, "w", encoding="utf-8") as f:
                json.dump(all_solved, f, ensure_ascii=False, indent=2)
            print(f"📁 Đã xuất {len(all_solved)} bài tập ra file JSON: {args.export_json}")
        except Exception as e:
            print(f"❌ Không thể xuất JSON: {e}")

    # 3. Append to Google Sheet
    append_problems_to_google_sheet(
        all_solved,
        spreadsheet_id=args.sheet_id,
        target_class=args.target_class,
        dry_run=args.dry_run
    )


if __name__ == "__main__":
    main()
