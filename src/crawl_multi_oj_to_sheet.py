"""
MULTI-PLATFORM PROBLEM CRAWLER & CLASSIFIER (ZERO TOKEN AI)
------------------------------------------------------------
Thu thập các bài tập đã làm từ nhiều nền tảng:
- VJudge / VNOJ (130+ bài kinh điển Việt Nam)
- AtCoder (Các bài có chỉ số Rating Kenkoooo chính xác)
- CSES Problem Set (Các bài thuật toán chuẩn quốc tế)
- Chuyên Tin Online Judge (oj.chuyentin.pro)
- ClueOJ (oj.clue.edu.vn)
- VNOI (oj.vnoi.info)

Tự động phân loại theo 10 chủ đề thuật toán Tiếng Việt và xếp loại độ khó Level 1 - 5.
Xuất dữ liệu vào Google Sheet (tạo tab mới 'Kho Bài VNOI & Nền Tảng Khác' mà không chạm
vào tab 'Bài Tập' hay bất kỳ tab nào đã định dạng trước đó).
"""

import os
import sys
import re
import json
import time
import urllib.request
import urllib.parse
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Dict, List, Any, Optional, Tuple

# Windows console UTF-8 & remove SSL log
sys.stdout.reconfigure(encoding='utf-8')
os.environ.pop("SSLKEYLOGFILE", None)

_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _PROJECT_ROOT not in sys.path:
    sys.path.insert(0, _PROJECT_ROOT)

import gspread
from google.oauth2.service_account import Credentials
from config.settings import get_settings


# DICTIONARY: Algorithm tag mapping to Vietnamese categories
CATEGORY_MAP = {
    # Dynamic Programming
    "dp": "Quy hoạch động",
    "dynamic programming": "Quy hoạch động",
    "quy hoạch động": "Quy hoạch động",
    "knapsack": "Quy hoạch động (Cái túi)",
    "bitmask": "Quy hoạch động trạng thái (Bitmask)",
    "lis": "Quy hoạch động (Dãy con tăng)",
    "lcs": "Quy hoạch động (Xâu con chung)",
    "tree dp": "Quy hoạch động trên cây",
    "digit dp": "Quy hoạch động chữ số",

    # Data Structures
    "data structures": "Cấu trúc Dữ liệu",
    "segment tree": "Cấu trúc Dữ liệu (Segment Tree)",
    "interval tree": "Cấu trúc Dữ liệu (Segment Tree)",
    "fenwick": "Cấu trúc Dữ liệu (Fenwick / BIT)",
    "binary indexed tree": "Cấu trúc Dữ liệu (BIT)",
    "dsu": "Cấu trúc Dữ liệu (Disjoint Set Union)",
    "disjoint set": "Cấu trúc Dữ liệu (DSU)",
    "heap": "Cấu trúc Dữ liệu (Heap / Priority Queue)",
    "trie": "Cấu trúc Dữ liệu (Trie)",
    "stack": "Cấu trúc Dữ liệu (Stack / Queue)",
    "deque": "Cấu trúc Dữ liệu (Deque)",

    # Graphs & Trees
    "graphs": "Thuật toán Đồ thị",
    "graph": "Thuật toán Đồ thị",
    "đồ thị": "Thuật toán Đồ thị",
    "dfs": "Duyệt đồ thị (DFS/BFS)",
    "bfs": "Duyệt đồ thị (DFS/BFS)",
    "shortest path": "Đường đi ngắn nhất (Dijkstra/Floyd)",
    "dijkstra": "Đường đi ngắn nhất (Dijkstra)",
    "mst": "Cây khung nhỏ nhất (Kruskal/Prim)",
    "minimum spanning tree": "Cây khung nhỏ nhất",
    "trees": "Thuật toán trên Cây",
    "tree": "Thuật toán trên Cây",
    "lca": "Thuật toán trên Cây (LCA / Nhảy nhị phân)",
    "hld": "Thuật toán trên Cây (Heavy-Light Decomposition)",
    "flow": "Luồng cực đại & Khớp nối",

    # Strings
    "strings": "Xử lý Xâu (String)",
    "xâu": "Xử lý Xâu",
    "hashing": "Xử lý Xâu (String Hashing)",
    "kmp": "Xử lý Xâu (KMP)",
    "aho-corasick": "Xử lý Xâu (Aho-Corasick)",
    "palindrome": "Xử lý Xâu (Palindrome)",

    # Greedy & Pointers
    "greedy": "Tham lam (Greedy)",
    "tham lam": "Tham lam (Greedy)",
    "two pointers": "Hai con trỏ (Two Pointers)",
    "hai con trỏ": "Hai con trỏ",

    # Search & Divide and Conquer
    "binary search": "Chặt nhị phân",
    "chặt nhị phân": "Chặt nhị phân",
    "divide and conquer": "Chia để trị",
    "chia để trị": "Chia để trị",
    "ternary search": "Chặt tam phân",

    # Math
    "math": "Toán học & Số học",
    "toán học": "Toán học & Số học",
    "number theory": "Lý thuyết số",
    "combinatorics": "Tổ hợp & Xác suất",
    "game theory": "Lý thuyết trò chơi (Game Theory)",
    "geometry": "Hình học tính toán",
    "hình học": "Hình học tính toán",

    # Basics
    "brute force": "Vét cạn & Duyệt toàn bộ",
    "vét cạn": "Vét cạn & Duyệt toàn bộ",
    "implementation": "Kỹ thuật lập trình & Cài đặt",
    "cơ bản": "Nhập môn & Cơ bản",
    "ad-hoc": "Tư duy logic (Ad-hoc)"
}


def classify_category(text: str, default: str = "Tư duy thuật toán") -> str:
    """Classifies any tag or description text into standard Vietnamese category."""
    if not text:
        return default
    t_lower = text.lower()
    for k, cat in CATEGORY_MAP.items():
        if k in t_lower:
            return cat
    return default


def estimate_difficulty(problem_id: str, platform: str, name: str, cat: str, raw_metric: Optional[Any] = None) -> Tuple[int, str]:
    """
    Estimates level 1-5 and difficulty string based on platform metrics or problem type.
    """
    pid_lower = problem_id.lower()
    name_lower = name.lower()

    # AtCoder rating
    if platform == "AtCoder" and isinstance(raw_metric, (int, float)):
        rating = int(raw_metric)
        if rating < 800:
            return 1, f"Level 1 • Rating {rating}"
        elif rating < 1200:
            return 2, f"Level 2 • Rating {rating}"
        elif rating < 1600:
            return 3, f"Level 3 • Rating {rating}"
        elif rating < 2000:
            return 4, f"Level 4 • Rating {rating}"
        else:
            return 5, f"Level 5 • Rating {rating}"

    # CSES
    if platform == "CSES":
        if pid_lower in ["1099", "1688"]:
            return 3, "Level 3 • CSES Standard"
        elif pid_lower in ["2134"]:
            return 4, "Level 4 • CSES Advanced"
        return 3, "Level 3 • CSES"

    # Known classic level mapping
    if any(k in pid_lower for k in ["aplusb", "helloworld", "dthcn", "sosinh", "bones", "latgach", "nkabd"]):
        return 1, "Level 1 • Cơ bản"
    if any(k in pid_lower for k in ["vmunch", "bwpoints", "twosum", "vcowflix", "gapnhau"]):
        return 2, "Level 2 • Vận dụng"
    if any(k in pid_lower for k in ["segtree_itez1", "qbmst", "vostr", "paliny", "mstick", "nkguard", "voi08_sgame"]):
        return 3, "Level 3 • Nâng cao"
    if any(k in pid_lower for k in ["lubenica", "segtree_itlazy", "segtree_itmed", "segtree_itds1", "qtree3", "area", "voi18_bonus"]):
        return 4, "Level 4 • HSG Tỉnh / Chuyên"
    if any(k in pid_lower for k in ["icpc", "voi", "bedao_oi", "tst"]):
        return 5, "Level 5 • Chuyên sâu / Quốc gia"

    # Category based fallback
    if "hld" in cat.lower() or "lazy" in cat.lower() or "luồng" in cat.lower():
        return 4, "Level 4 • Nâng cao"
    if "cây khung" in cat.lower() or "dijkstra" in cat.lower() or "segment tree" in cat.lower() or "lca" in cat.lower():
        return 3, "Level 3 • Trung bình"
    if "duyệt đồ thị" in cat.lower() or "hai con trỏ" in cat.lower() or "cái túi" in cat.lower():
        return 2, "Level 2 • Cơ bản"

    return 2, "Level 2 • Tiêu chuẩn"


# 1. CRAWL VJUDGE SOLVED LIST
def crawl_vjudge_solved(handle: str = "ducdacoder3103") -> Dict[str, List[str]]:
    """Returns { platform_name: [prob_codes] } from VJudge solveDetail API."""
    print(f"📡 Đang lấy danh sách bài đã giải trên VJudge cho handle '{handle}'...")
    url = f"https://vjudge.net/user/solveDetail/{urllib.parse.quote(handle)}"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            records = data.get("acRecords", {})
            print(f"✅ VJudge trả về bài đã giải từ các nền tảng: {list(records.keys())}")
            return records
    except Exception as e:
        print(f"❌ Lỗi đọc VJudge: {e}")
        return {}


# 2. CRAWL CHUYENTIN.PRO SOLVED LIST
def crawl_chuyentin_solved(handle: str = "ducdacoder3103") -> List[str]:
    """Extracts AC problem codes from oj.chuyentin.pro."""
    print(f"📡 Đang lấy danh sách bài đã giải trên oj.chuyentin.pro cho handle '{handle}'...")
    solved = set()
    for page in range(1, 4):
        url = f"https://oj.chuyentin.pro/submissions?user={urllib.parse.quote(handle)}&page={page}"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
        try:
            with urllib.request.urlopen(req, timeout=8) as resp:
                html = resp.read().decode("utf-8")
                probs = re.findall(r'/problem/([^\x22/]+)', html)
                if not probs:
                    break
                for p in probs:
                    if p.lower() not in ["submit", "status", "user"]:
                        solved.add(p.strip())
        except Exception:
            break
    print(f"✅ oj.chuyentin.pro: tìm thấy {len(solved)} bài: {sorted(list(solved))}")
    return sorted(list(solved))


# 3. CRAWL CLUEOJ SOLVED LIST
def crawl_clue_solved(handle: str = "phungduc3103") -> List[str]:
    """Extracts AC problem codes from oj.clue.edu.vn."""
    print(f"📡 Đang lấy danh sách bài đã giải trên oj.clue.edu.vn cho handle '{handle}'...")
    solved = set()
    url = f"https://oj.clue.edu.vn/submissions/user/{urllib.parse.quote(handle)}/"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
    try:
        with urllib.request.urlopen(req, timeout=8) as resp:
            html = resp.read().decode("utf-8")
            probs = re.findall(r'/problem/([^/\x22]+)', html)
            for p in probs:
                if p.lower() not in ["submit", "user", "status"]:
                    solved.add(p.strip())
    except Exception as e:
        print(f"⚠️ oj.clue.edu.vn: {e}")
    print(f"✅ ClueOJ: tìm thấy {len(solved)} bài: {list(solved)}")
    return sorted(list(solved))


# 4. ENRICH VNOI PROBLEM INFO
def fetch_vnoi_problem_meta(prob_code: str) -> Dict[str, str]:
    """Fetches clean title and Vietnamese tag from oj.vnoi.info."""
    url = f"https://oj.vnoi.info/problem/{prob_code}"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
    try:
        with urllib.request.urlopen(req, timeout=6) as resp:
            html = resp.read().decode("utf-8")
            title_m = re.search(r'<title>([^<]+)</title>', html)
            title = title_m.group(1).split(" - ")[0].strip() if title_m else prob_code
            tag_m = re.search(r'class=\x22toggled\x22>([^<]+)</div>', html)
            tag = tag_m.group(1).strip() if tag_m else ""
            desc_m = re.search(r'property=\x22og:description\x22 content=\x22([^\x22]+)\x22', html)
            desc = desc_m.group(1).strip() if desc_m else ""
            return {"title": title, "tag": tag, "desc": desc}
    except Exception:
        # Fallback to humanized code
        clean_name = prob_code.replace("_", " ").title()
        return {"title": clean_name, "tag": "", "desc": ""}


# 5. ENRICH ATCODER PROBLEM INFO
_ATCODER_MODELS = None
def get_atcoder_models():
    global _ATCODER_MODELS
    if _ATCODER_MODELS is not None:
        return _ATCODER_MODELS
    try:
        url = "https://kenkoooo.com/atcoder/resources/problem-models.json"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=8) as resp:
            _ATCODER_MODELS = json.loads(resp.read().decode("utf-8"))
    except Exception:
        _ATCODER_MODELS = {}
    return _ATCODER_MODELS


# 6. ENRICH CHUYENTIN PROBLEM INFO
def fetch_chuyentin_problem_meta(prob_code: str) -> Dict[str, str]:
    url = f"https://oj.chuyentin.pro/problem/{prob_code}"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    try:
        with urllib.request.urlopen(req, timeout=6) as resp:
            html = resp.read().decode("utf-8")
            title_m = re.search(r'<title>([^<]+)</title>', html)
            title = title_m.group(1).split(" - ")[0].strip() if title_m else prob_code
            tag_m = re.search(r'class=\x22toggled\x22>([^<]+)</div>', html)
            tag = tag_m.group(1).strip() if tag_m else ""
            return {"title": title, "tag": tag}
    except Exception:
        return {"title": prob_code.replace("_", " ").title(), "tag": ""}


def crawl_and_aggregate_all_problems() -> List[Dict[str, Any]]:
    """
    Crawls and enriches problems from VJudge, VNOI, AtCoder, CSES, ChuyenTinPro, ClueOJ.
    Returns list of problem dicts ready for Google Sheets & Web.
    """
    all_problems = []
    seen_ids = set()

    # A. VJudge
    vj_records = crawl_vjudge_solved("ducdacoder3103")
    vnoj_pids = vj_records.get("VNOJ", [])
    atcoder_pids = vj_records.get("AtCoder", [])
    cses_pids = vj_records.get("CSES", [])

    # 1. Process VNOJ problems concurrently (130 items)
    print(f"\n🔄 Đang lấy tiêu đề và dạng bài cho {len(vnoj_pids)} bài VNOJ/VNOI...")
    vnoj_meta = {}
    with ThreadPoolExecutor(max_workers=8) as executor:
        future_to_pid = {executor.submit(fetch_vnoi_problem_meta, pid): pid for pid in vnoj_pids}
        for future in as_completed(future_to_pid):
            pid = future_to_pid[future]
            try:
                vnoj_meta[pid] = future.result()
            except Exception:
                vnoj_meta[pid] = {"title": pid.replace("_", " ").title(), "tag": "", "desc": ""}

    for pid in vnoj_pids:
        meta = vnoj_meta.get(pid, {})
        title = meta.get("title") or pid.replace("_", " ").title()
        raw_tag = meta.get("tag") or meta.get("desc") or ""
        cat = classify_category(raw_tag, default="Thuật toán nâng cao")
        level, diff_str = estimate_difficulty(pid, "VNOI", title, cat)
        full_id = f"VNOI-{pid.upper()}"
        if full_id not in seen_ids:
            seen_ids.add(full_id)
            all_problems.append({
                "id": full_id,
                "url": f"https://oj.vnoi.info/problem/{pid}",
                "name": title,
                "classes": ["Tất cả"],
                "level": str(level),
                "category": cat,
                "platform": "VNOI",
                "notes": f"VNOJ: {pid} • {raw_tag or cat}"
            })

    # 2. Process AtCoder problems
    atcoder_models = get_atcoder_models()
    for pid in atcoder_pids:
        model = atcoder_models.get(pid, {})
        rating = model.get("difficulty")
        contest = pid.split("_")[0] if "_" in pid else "AtCoder"
        title = f"AtCoder {contest.upper()} {pid.split('_')[-1].upper()}"
        cat = "Quy hoạch động" if "dp" in pid or (rating and rating > 1500) else "Tư duy thuật toán"
        level, diff_str = estimate_difficulty(pid, "AtCoder", title, cat, raw_metric=rating)
        full_id = f"ATCODER-{pid.upper()}"
        if full_id not in seen_ids:
            seen_ids.add(full_id)
            all_problems.append({
                "id": full_id,
                "url": f"https://atcoder.jp/contests/{contest}/tasks/{pid}",
                "name": title,
                "classes": ["Tất cả"],
                "level": str(level),
                "category": cat,
                "platform": "AtCoder",
                "notes": f"Rating {rating if rating is not None else 'N/A'}"
            })

    # 3. Process CSES problems
    cses_map = {
        "1099": ("Stair Game", "Lý thuyết trò chơi (Game Theory)", 3),
        "1688": ("Company Queries II", "Thuật toán trên Cây (LCA)", 3),
        "2134": ("Path Queries II", "Cấu trúc Dữ liệu & Cây (HLD)", 4)
    }
    for pid in cses_pids:
        title, cat, level = cses_map.get(pid, (f"CSES Problem {pid}", "Thuật toán chuẩn", 3))
        full_id = f"CSES-{pid}"
        if full_id not in seen_ids:
            seen_ids.add(full_id)
            all_problems.append({
                "id": full_id,
                "url": f"https://cses.fi/problemset/task/{pid}",
                "name": title,
                "classes": ["Tất cả"],
                "level": str(level),
                "category": cat,
                "platform": "CSES",
                "notes": "CSES Problem Set"
            })

    # B. ChuyenTinPro
    ct_pids = crawl_chuyentin_solved("ducdacoder3103")
    for pid in ct_pids:
        meta = fetch_chuyentin_problem_meta(pid)
        title = meta.get("title") or pid
        cat = classify_category(meta.get("tag") or title, default="Lập trình thi đấu")
        level, diff_str = estimate_difficulty(pid, "ChuyenTinPro", title, cat)
        full_id = f"CTOJ-{pid.upper()}"
        if full_id not in seen_ids:
            seen_ids.add(full_id)
            all_problems.append({
                "id": full_id,
                "url": f"https://oj.chuyentin.pro/problem/{pid}",
                "name": title,
                "classes": ["Tất cả"],
                "level": str(level),
                "category": cat,
                "platform": "ChuyenTinPro",
                "notes": "oj.chuyentin.pro"
            })

    # C. ClueOJ
    clue_pids = crawl_clue_solved("phungduc3103")
    for pid in clue_pids:
        full_id = f"CLUE-{pid.upper()}"
        title = "VOI 2026 - Dãy đèn" if pid == "voi26_light" else pid
        cat = "Quy hoạch động & Xử lý bit" if pid == "voi26_light" else "Thuật toán"
        if full_id not in seen_ids:
            seen_ids.add(full_id)
            all_problems.append({
                "id": full_id,
                "url": f"https://oj.clue.edu.vn/problem/{pid}",
                "name": title,
                "classes": ["Tất cả"],
                "level": "3",
                "category": cat,
                "platform": "ClueOJ",
                "notes": "oj.clue.edu.vn"
            })

    print(f"\n🎉 Đã thu thập và phân loại tổng cộng: {len(all_problems)} bài tập mới!")
    return all_problems


def save_to_google_sheet_and_local(problems: List[Dict[str, Any]], tab_name: str = "Kho Bài VNOI & Nền Tảng Khác"):
    """
    Creates a new tab in Google Sheet and uploads all problems.
    Does NOT modify 'Bài Tập' or any existing tabs.
    """
    settings = get_settings()
    sheet_id = settings.spreadsheet_id
    sa_info = settings.get_service_account_dict()

    if not sheet_id or not sa_info:
        print("❌ Lỗi cấu hình Google Sheet!")
        return False

    scopes = ["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/drive"]
    creds = Credentials.from_service_account_info(sa_info, scopes=scopes)
    gc = gspread.authorize(creds)
    sh = gc.open_by_key(sheet_id)

    existing_titles = [w.title for w in sh.worksheets()]
    ws = None
    if tab_name in existing_titles:
        print(f"ℹ️ Tab '{tab_name}' đã tồn tại trong Sheet. Đang mở tab...")
        ws = sh.worksheet(tab_name)
    else:
        print(f"✨ Đang tạo tab mới: '{tab_name}'...")
        ws = sh.add_worksheet(title=tab_name, rows=len(problems) + 50, cols=8)
        print(f"✅ Đã tạo tab mới '{tab_name}' thành công!")

    # Prepare rows
    header = ["Mã bài", "Link bài tập", "Tên bài tập", "Class", "Level", "Dạng bài", "Nền tảng", "Ghi chú"]
    rows_to_insert = [header]
    for p in problems:
        rows_to_insert.append([
            p["id"],
            p["url"],
            p["name"],
            ", ".join(p["classes"]),
            p["level"],
            p["category"],
            p["platform"],
            p.get("notes", "")
        ])

    print(f"📝 Đang tải {len(rows_to_insert) - 1} bài tập lên Google Sheet '{tab_name}'...")
    ws.clear()
    ws.update("A1", rows_to_insert, value_input_option="USER_ENTERED")

    # Format header row
    try:
        ws.format("A1:H1", {
            "backgroundColor": {"red": 0.12, "green": 0.16, "blue": 0.23},
            "textFormat": {"bold": True, "foregroundColor": {"red": 1.0, "green": 1.0, "blue": 1.0}},
            "horizontalAlignment": "CENTER"
        })
        ws.freeze(rows=1)
    except Exception:
        pass

    print(f"✅ Đã ghi thành công {len(problems)} bài tập vào tab '{tab_name}' trên Google Sheet!")
    return True


if __name__ == "__main__":
    probs = crawl_and_aggregate_all_problems()
    if probs:
        save_to_google_sheet_and_local(probs)
