"""
Automated Competitive Programming Problem Classifier (Zero AI Tokens)
Phân loại tự động dạng bài thuật toán và độ khó cho kho bài tập.

Hỗ trợ các nền tảng:
- Codeforces
- VNOI / VNOJ
- AtCoder
- CSES
- oj.chuyentin.pro (ChuyenTinPro)
- oj.clue.edu.vn (ClueOJ)
- MarisaOJ
- DeruckOJ

Các tính năng:
1. Phân loại theo 13 Chủ đề chuẩn thi HSG Quốc gia, Chuyên Tin & Quốc tế.
2. Xếp loại Độ khó chuẩn 5 cấp độ (Level 1 -> Level 5).
3. Đọc và cập nhật trực tiếp lên Google Sheets (tab 'Bài Tập', 'Kho Bài Codeforces', 'Kho Bài VNOI & Nền Tảng Khác').
4. Tạo bảng Dashboard tổng hợp và phân tích phân bố: tab 'Tổng Hợp Phân Loại' trên Google Sheet.
5. Cập nhật đồng bộ vào docs/data.json và xuất báo cáo thống kê ra Terminal.
"""

import os
import sys
import re
import json
import logging
import argparse
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, asdict

# Ensure UTF-8 output on Windows
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

# Ensure project root is in sys.path
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(current_dir)
if project_root not in sys.path:
    sys.path.insert(0, project_root)

# Fix Windows SSL issue if present
os.environ.pop("SSLKEYLOGFILE", None)

logger = logging.getLogger("classify_problems")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")


# ==============================================================================
# 1. TAXONOMY DEFINITION (CHỦ ĐỀ & PHÂN LOẠI CHUẨN)
# ==============================================================================

MAIN_TOPICS = [
    "Quy hoạch động",
    "Lý thuyết Đồ thị",
    "Cấu trúc Dữ liệu",
    "Thuật toán trên Cây",
    "Số học & Toán học",
    "Sắp xếp & Tham lam",
    "Tìm kiếm & Hai con trỏ",
    "Xử lý Chuỗi",
    "Cơ bản & Nhập môn",
    "Duyệt toàn bộ & Quay lui",
    "Hình học tính toán",
    "Lý thuyết Trò chơi",
    "Tư duy Thuật toán & Ad-hoc"
]

LEVEL_DESCRIPTIONS = {
    1: {"name": "Level 1 • Nhập môn", "target": "Làm quen ngôn ngữ, cú pháp, mảng, lặp cơ bản", "cf_range": "< 1100"},
    2: {"name": "Level 2 • Cơ bản", "target": "Đội tuyển cơ sở, THCS, tìm kiếm nhị phân, tham lam", "cf_range": "1100 - 1399"},
    3: {"name": "Level 3 • Nâng cao", "target": "HSG Tỉnh / TP, Chuyên Tin, DP cơ bản, Dijkstra, Segment Tree", "cf_range": "1400 - 1699"},
    4: {"name": "Level 4 • Chuyên sâu", "target": "Đội tuyển Quốc gia (VOI), THT Bảng C, DP Bitmask/Tree, HLD", "cf_range": "1700 - 2099"},
    5: {"name": "Level 5 • Đỉnh cao", "target": "Vòng chọn Tuyển Quốc gia, ICPC Regional/WF, Flow, FFT", "cf_range": ">= 2100"}
}


@dataclass
class ClassificationResult:
    main_topic: str
    sub_topic: str
    level: int
    level_label: str
    difficulty_str: str
    tags: List[str]


# ==============================================================================
# 2. HEURISTIC RULES & KEYWORD MAPPINGS (ZERO AI TOKENS)
# ==============================================================================

# Priority ordered subtopic matcher
# Structure: (Regex pattern / list of keywords, Main Topic, Subtopic, Minimum Level)
TOPIC_PATTERNS = [
    # --- Quy hoạch động nâng cao ---
    (r"\b(digit dp|dp chữ số|chữ số dp)\b", "Quy hoạch động", "DP Chữ số (Digit DP)", 4),
    (r"\b(bitmask dp|dp bitmask|dp trạng thái|bitmask)\b", "Quy hoạch động", "DP Trạng thái & Bitmask", 4),
    (r"\b(tree dp|dp trên cây|dp tree)\b", "Quy hoạch động", "DP trên Cây (Tree DP)", 4),
    (r"\b(convex hull trick|cht|d&c optimization|chia để trị dp|sos dp)\b", "Quy hoạch động", "DP Tối ưu hóa nâng cao", 5),
    (r"\b(knapsack|balo|cái túi|cai tui)\b", "Quy hoạch động", "DP Balo (Knapsack)", 2),
    (r"\b(lis|dãy con tăng|day con tang|lcs|xâu con chung|xau con chung)\b", "Quy hoạch động", "DP Dãy con (LIS/LCS)", 2),
    (r"\b(latgach|lát gạch|fibonacci dp|coin change|đổi tiền|doi tien)\b", "Quy hoạch động", "DP Cơ bản", 2),
    (r"\b(dp|dynamic programming|quy hoạch động|quy hoach dong)\b", "Quy hoạch động", "Quy hoạch động", 2),

    # --- Cấu trúc dữ liệu (ưu tiên kiểm tra trước Cây tổng quát) ---
    (r"\b(lazy propagation|itlazy|segtree lazy|segment tree lazy)\b", "Cấu trúc Dữ liệu", "Segment Tree (Lazy Propagation)", 4),
    (r"\b(segment tree|segtree|itds|itez|interval tree|cây phân đoạn)\b", "Cấu trúc Dữ liệu", "Cây phân đoạn (Segment Tree)", 3),
    (r"\b(fenwick|binary indexed tree|cây fenwick|bit)\b", "Cấu trúc Dữ liệu", "Cây Fenwick (Binary Indexed Tree)", 3),
    (r"\b(dsu|disjoint set|union find|tập hợp rời rạc)\b", "Cấu trúc Dữ liệu", "Tập hợp rời rạc (DSU)", 3),
    (r"\b(sparse table|rmq|bảng thưa)\b", "Cấu trúc Dữ liệu", "Bảng thưa (Sparse Table / RMQ)", 3),
    (r"\b(trie|cây tiền tố)\b", "Cấu trúc Dữ liệu", "Cây tiền tố (Trie)", 3),
    (r"\b(monotonic stack|ngăn xếp đơn điệu|deque đơn điệu)\b", "Cấu trúc Dữ liệu", "Ngăn xếp / Deque đơn điệu", 3),
    (r"\b(priority queue|heap|hàng đợi ưu tiên)\b", "Cấu trúc Dữ liệu", "Hàng đợi ưu tiên (Heap)", 2),
    (r"\b(stack|queue|deque|ngăn xếp|hàng đợi)\b", "Cấu trúc Dữ liệu", "Ngăn xếp & Hàng đợi (Stack/Queue)", 2),
    (r"\b(data structures|cấu trúc dữ liệu|cau truc du lieu)\b", "Cấu trúc Dữ liệu", "Cấu trúc Dữ liệu", 3),

    # --- Thuật toán trên Cây ---
    (r"\b(hld|heavy light|heavy-light|phân rã cây)\b", "Thuật toán trên Cây", "Phân rã đường đi trên cây (HLD)", 4),
    (r"\b(centroid decomposition|phân rã trọng tâm)\b", "Thuật toán trên Cây", "Phân rã trọng tâm (Centroid)", 5),
    (r"\b(lca|nhảy nhị phân|tổ tiên chung|lowest common ancestor)\b", "Thuật toán trên Cây", "Tổ tiên chung gần nhất (LCA)", 3),
    (r"\b(euler tour|cây và đường kính|diameter of tree)\b", "Thuật toán trên Cây", "Thuật toán trên Cây", 3),
    (r"\b(trees|tree|cây|cay)\b", "Thuật toán trên Cây", "Cây & Cấu trúc Cây", 3),

    # --- Đồ thị ---
    (r"\b(flow|max flow|luồng cực đại|lát cắt|dinic|edmonds-karp)\b", "Lý thuyết Đồ thị", "Luồng cực đại & Lát cắt", 4),
    (r"\b(bipartite matching|ghép cặp|hungarian|hopcroft-karp)\b", "Lý thuyết Đồ thị", "Ghép cặp trên đồ thị hai phía", 4),
    (r"\b(tarjan|scc|strongly connected|liên thông mạnh|2-sat)\b", "Lý thuyết Đồ thị", "Thành phần liên thông mạnh (SCC)", 4),
    (r"\b(bridge|articulation|khớp và cầu|khop|cau|cầu đồ thị)\b", "Lý thuyết Đồ thị", "Khớp và Cầu (Bridges & Articulation)", 4),
    (r"\b(dijkstra|bellman-ford|floyd|đường đi ngắn nhất|shortest path)\b", "Lý thuyết Đồ thị", "Đường đi ngắn nhất (Shortest Path)", 3),
    (r"\b(mst|kruskal|prim|cây khung nhỏ nhất|minimum spanning tree)\b", "Lý thuyết Đồ thị", "Cây khung nhỏ nhất (MST)", 3),
    (r"\b(dfs|bfs|duyệt đồ thị|duyet do thi|dfs and similar|flood fill)\b", "Lý thuyết Đồ thị", "Duyệt đồ thị (BFS / DFS)", 2),
    (r"\b(graphs|graph|đồ thị|do thi)\b", "Lý thuyết Đồ thị", "Lý thuyết Đồ thị", 2),

    # --- Xử lý Chuỗi ---
    (r"\b(suffix automaton|suffix array|mảng hậu tố|tự động hậu tố)\b", "Xử lý Chuỗi", "Cấu trúc xâu nâng cao (Suffix)", 4),
    (r"\b(aho-corasick|aho corasick)\b", "Xử lý Chuỗi", "Thuật toán Aho-Corasick", 4),
    (r"\b(manacher|palindrome|đối xứng|xâu đối xứng)\b", "Xử lý Chuỗi", "Chuỗi đối xứng (Palindrome)", 3),
    (r"\b(string hashing|hashing|băm xâu|băm chuỗi|hash)\b", "Xử lý Chuỗi", "Băm xâu (String Hashing)", 3),
    (r"\b(kmp|z-algorithm|z-algo|so khớp chuỗi|string matching)\b", "Xử lý Chuỗi", "So khớp xâu (KMP / Z-Algo)", 3),
    (r"\b(strings|string|xâu|chuỗi|xau|chuoi)\b", "Xử lý Chuỗi", "Xử lý Chuỗi (String)", 2),

    # --- Tìm kiếm & Hai con trỏ ---
    (r"\b(meet-in-the-middle|gặp nhau ở giữa)\b", "Tìm kiếm & Hai con trỏ", "Gặp nhau ở giữa (Meet-in-the-middle)", 4),
    (r"\b(ternary search|chặt tam phân)\b", "Tìm kiếm & Hai con trỏ", "Chặt tam phân", 3),
    (r"\b(binary search|chặt nhị phân|tìm kiếm nhị phân|tim kiem nhi phan)\b", "Tìm kiếm & Hai con trỏ", "Chặt nhị phân (Binary Search)", 2),
    (r"\b(two pointers|hai con trỏ|sliding window|cửa sổ trượt)\b", "Tìm kiếm & Hai con trỏ", "Hai con trỏ (Two Pointers)", 2),

    # --- Sắp xếp & Tham lam ---
    (r"\b(interval scheduling|lập lịch|sắp xếp đoạn)\b", "Sắp xếp & Tham lam", "Lập lịch & Chọn đoạn", 3),
    (r"\b(greedy|tham lam)\b", "Sắp xếp & Tham lam", "Thuật toán Tham lam (Greedy)", 2),
    (r"\b(sortings|sort|sắp xếp|sap xep)\b", "Sắp xếp & Tham lam", "Sắp xếp & Thứ tự (Sorting)", 2),

    # --- Số học & Toán học ---
    (r"\b(fft|ntt|biến đổi fourier|fourier transform)\b", "Số học & Toán học", "Biến đổi Fourier (FFT / NTT)", 5),
    (r"\b(matrix exponentiation|lũy thừa ma trận|ma trận|matrices)\b", "Số học & Toán học", "Lũy thừa ma trận (Matrix Expo)", 4),
    (r"\b(combinatorics|tổ hợp|chỉnh hợp|catalan|bao hàm loại trừ)\b", "Số học & Toán học", "Toán tổ hợp (Combinatorics)", 3),
    (r"\b(modular inverse|nghịch đảo modulo|euler phi|định lý fermat)\b", "Số học & Toán học", "Đồng dư & Nghịch đảo modulo", 3),
    (r"\b(prime|nguyên tố|nguyen to|sieve|sàng|gcd|ucln|lcm|bcnn|ước số|uoc so|chính phương)\b", "Số học & Toán học", "Số nguyên tố & Ước số", 2),
    (r"\b(probabilities|xác suất|kỳ vọng|probability)\b", "Số học & Toán học", "Xác suất & Kỳ vọng", 3),
    (r"\b(number theory|số học|so hoc|lý thuyết số)\b", "Số học & Toán học", "Lý thuyết Số (Number Theory)", 2),
    (r"\b(math|toán|toan hoc|toan)\b", "Số học & Toán học", "Toán học & Biến đổi số", 2),

    # --- Hình học tính toán ---
    (r"\b(convex hull|bao lồi|sweep line|quét đường)\b", "Hình học tính toán", "Bao lồi & Quét đường (Sweep-line)", 4),
    (r"\b(geometry|hình học|hinh hoc|giao điểm|tích có hướng)\b", "Hình học tính toán", "Hình học tính toán", 3),

    # --- Lý thuyết Trò chơi ---
    (r"\b(sprague-grundy|grundy|nim|trò chơi|game theory|games)\b", "Lý thuyết Trò chơi", "Lý thuyết Trò chơi (Game Theory)", 3),

    # --- Duyệt toàn bộ & Quay lui ---
    (r"\b(backtracking|quay lui|nhánh cận|hoán vị|n quân hậu)\b", "Duyệt toàn bộ & Quay lui", "Quay lui & Nhánh cận (Backtracking)", 2),
    (r"\b(brute force|vét cạn|vet can|duyệt toàn bộ|duyet toan bo)\b", "Duyệt toàn bộ & Quay lui", "Vét cạn & Duyệt toàn bộ", 1),

    # --- Tư duy Thuật toán & Ad-hoc ---
    (r"\b(constructive algorithms|constructive|xây dựng thuật toán)\b", "Tư duy Thuật toán & Ad-hoc", "Thuật toán Xây dựng (Constructive)", 3),
    (r"\b(ad-hoc|tư duy logic|logic)\b", "Tư duy Thuật toán & Ad-hoc", "Tư duy logic (Ad-hoc)", 2),

    # --- Cơ bản & Nhập môn ---
    (r"\b(aplusb|a \+ b|phép cộng|phép tính|nhập xuất|nhap xuat|hello world|chu vi|diện tích|chia hết|chẵn lẻ)\b", "Cơ bản & Nhập môn", "Nhập xuất & Phép toán cơ bản", 1),
    (r"\b(if/else|rẽ nhánh|re nhanh|điều kiện)\b", "Cơ bản & Nhập môn", "Cấu trúc rẽ nhánh if/else", 1),
    (r"\b(vòng lặp|vong lap|for|while|tổng các chữ số|chữ số lớn nhất)\b", "Cơ bản & Nhập môn", "Vòng lặp & Xử lý số nguyên", 1),
    (r"\b(mảng một chiều|mang 1 chieu|mảng 1 chiều|mảng|array)\b", "Cơ bản & Nhập môn", "Mảng & Danh sách cơ bản", 1),
    (r"\b(implementation|căn bản|kỹ thuật lập trình|ky thuat lap trinh)\b", "Cơ bản & Nhập môn", "Căn bản & Cài đặt thuật toán", 1),
]

# Mapping specific known problem IDs directly to accurate topics
KNOWN_PROBLEM_ID_MAP = {
    "aplusb": ("Cơ bản & Nhập môn", "Nhập xuất & Phép toán cơ bản", 1),
    "helloworld": ("Cơ bản & Nhập môn", "Nhập môn lập trình", 1),
    "dthcn": ("Cơ bản & Nhập môn", "Phép toán & Hình chữ nhật", 1),
    "sosinh": ("Cơ bản & Nhập môn", "Cấu trúc rẽ nhánh if/else", 1),
    "gapnhau": ("Tìm kiếm & Hai con trỏ", "Kỹ thuật Hai con trỏ", 2),
    "pipes": ("Quy hoạch động", "Quy hoạch động trên lưới", 3),
    "seating": ("Sắp xếp & Tham lam", "Tham lam & Sắp xếp", 2),
    "juststall": ("Sắp xếp & Tham lam", "Tham lam & Sắp xếp", 2),
    "marathong": ("Lý thuyết Đồ thị", "Duyệt đồ thị (BFS / DFS)", 3),
    "tht26_kvmn_m2": ("Quy hoạch động", "Quy hoạch động dãy số", 3),
    "voi06_maxseq": ("Tìm kiếm & Hai con trỏ", "Hai con trỏ & Dãy con", 3),
    "voi06_select": ("Quy hoạch động", "DP Trạng thái & Bitmask", 4),
    "voi08_sgame": ("Tìm kiếm & Hai con trỏ", "Hai con trỏ & Chặt nhị phân", 3),
    "voi17_fibseq": ("Số học & Toán học", "Số học & Chu kỳ Modulo", 4),
    "voi18_queue": ("Cấu trúc Dữ liệu", "Cấu trúc Dữ liệu (Segment Tree)", 4),
    "voi21_comnet": ("Thuật toán trên Cây", "Cây khung & LCA", 4),
    "voi26_light": ("Quy hoạch động", "DP Trạng thái & Xử lý Bit", 4),
    "lubenica": ("Thuật toán trên Cây", "Tổ tiên chung gần nhất (LCA)", 4),
    "area": ("Hình học tính toán", "Quét đường & Segment Tree", 4),
    "qtree3": ("Thuật toán trên Cây", "Phân rã đường đi trên cây (HLD)", 4),
    "segtree_itez1": ("Cấu trúc Dữ liệu", "Cây phân đoạn (Segment Tree)", 3),
    "segtree_itez2": ("Cấu trúc Dữ liệu", "Cây phân đoạn (Segment Tree)", 3),
    "segtree_itlazy": ("Cấu trúc Dữ liệu", "Segment Tree (Lazy Propagation)", 4),
    "segtree_itmed": ("Cấu trúc Dữ liệu", "Segment Tree nâng cao", 4),
    "segtree_itds1": ("Cấu trúc Dữ liệu", "Segment Tree lồng DSU", 4),
    "paliny": ("Xử lý Chuỗi", "Chuỗi đối xứng (Manacher / Hash)", 3),
    "vostr": ("Xử lý Chuỗi", "Băm xâu & So khớp (String Hash)", 3),
    "qbmst": ("Lý thuyết Đồ thị", "Cây khung nhỏ nhất (Kruskal)", 3),
    "nkguard": ("Lý thuyết Đồ thị", "Duyệt đồ thị (DFS / BFS)", 3),
    "mstick": ("Quy hoạch động", "DP Dãy con (LIS / Dilworth)", 3),
}


# ==============================================================================
# 3. CORE CLASSIFICATION FUNCTIONS
# ==============================================================================

def extract_rating(p: Dict[str, Any]) -> Optional[int]:
    """Extracts numerical rating from problem data or notes."""
    # Check notes or tags for 'Rating XXXX'
    notes = str(p.get("notes") or "") + " " + str(p.get("difficulty") or "") + " " + " ".join(p.get("tags") or [])
    m = re.search(r"Rating\s*(\d{3,4})", notes, re.IGNORECASE)
    if m:
        try:
            return int(m.group(1))
        except ValueError:
            pass

    # Check for direct rating field
    if "rating" in p and isinstance(p["rating"], (int, float)):
        return int(p["rating"])

    return None


def classify_problem(problem: Dict[str, Any]) -> ClassificationResult:
    """
    Classifies a problem into standard Vietnamese CP topics and Difficulty Level (1-5).
    Zero AI tokens - uses multi-layer heuristic pattern matching.
    """
    pid = str(problem.get("id") or "").strip()
    name = str(problem.get("name") or "").strip()
    platform = str(problem.get("platform") or "").strip()
    existing_cat = str(problem.get("category") or "").strip()
    existing_diff = str(problem.get("difficulty") or "").strip()
    notes = str(problem.get("notes") or "").strip()
    raw_tags = problem.get("tags") or []
    if isinstance(raw_tags, str):
        raw_tags = [t.strip() for t in raw_tags.split(",") if t.strip()]

    # Normalized search string
    text_corpus = f"{pid} {name} {notes} {' '.join(raw_tags)} {existing_cat}".lower()

    # Clean raw pid (e.g. 'VNOI-LUBENICA' -> 'lubenica', 'CF-439D' -> '439D')
    clean_pid = pid.lower()
    for prefix in ["vnoi-", "cf-", "ctoj-", "clue-", "cses-", "marisa-", "deruck-", "atcoder-"]:
        if clean_pid.startswith(prefix):
            clean_pid = clean_pid[len(prefix):]

    # Layer 1: Check known problem ID map
    if clean_pid in KNOWN_PROBLEM_ID_MAP:
        main_topic, sub_topic, min_level = KNOWN_PROBLEM_ID_MAP[clean_pid]
        rating = extract_rating(problem)
        level = calculate_level(rating, min_level, clean_pid, platform, main_topic)
        return build_result(main_topic, sub_topic, level, raw_tags)

    # Layer 2: Match against priority topic patterns
    matched_main = None
    matched_sub = None
    min_level = 1

    for pattern, main_t, sub_t, lvl in TOPIC_PATTERNS:
        if re.search(pattern, text_corpus, re.IGNORECASE):
            matched_main = main_t
            matched_sub = sub_t
            min_level = lvl
            break

    # Layer 3: Fallback based on existing category string if present
    if not matched_main and existing_cat and existing_cat not in ["Brute Force", "Chưa phân loại", "Tư duy thuật toán", "Lập trình thi đấu"]:
        for t in MAIN_TOPICS:
            if t.lower() in existing_cat.lower() or existing_cat.lower() in t.lower():
                matched_main = t
                matched_sub = existing_cat
                break

    # Default topic if nothing matched
    if not matched_main:
        if any(w in text_corpus for w in ["sum", "total", "tính", "đếm", "phép", "số", "cộng", "trừ"]):
            matched_main = "Cơ bản & Nhập môn"
            matched_sub = "Căn bản & Kỹ thuật lập trình"
        else:
            matched_main = "Tư duy Thuật toán & Ad-hoc"
            matched_sub = "Tư duy logic (Ad-hoc)"

    # Compute Level (1 to 5)
    rating = extract_rating(problem)
    final_level = calculate_level(rating, min_level, clean_pid, platform, matched_main)

    return build_result(matched_main, matched_sub, final_level, raw_tags)


def calculate_level(rating: Optional[int], min_level: int, clean_pid: str, platform: str, main_topic: str) -> int:
    """Calculates final level 1-5 considering rating, platform heuristics, and algorithm baseline."""
    # 1. Rating based
    if rating and rating > 0:
        if rating < 1100:
            lvl = 1
        elif rating < 1400:
            lvl = 2
        elif rating < 1700:
            lvl = 3
        elif rating < 2100:
            lvl = 4
        else:
            lvl = 5
        return max(lvl, min_level if rating >= 1400 else 1)

    # 2. Problem letter / index heuristic for Codeforces / AtCoder
    # E.g. CF index 'A' -> 1, 'B' -> 2, 'C' -> 3, 'D' -> 4, 'E' -> 5
    m_idx = re.search(r"[0-9]+([a-z][0-9]?)", clean_pid)
    if m_idx:
        letter = m_idx.group(1)[0].upper()
        if letter in ["A", "1"]:
            return max(1, min_level)
        elif letter in ["B", "2"]:
            return max(2, min_level)
        elif letter in ["C", "3"]:
            return max(3, min_level)
        elif letter in ["D", "4"]:
            return max(4, min_level)
        elif letter in ["E", "F", "G", "5", "6"]:
            return max(5, min_level)

    # 3. National / VOI contest heuristic
    if "voi" in clean_pid or "icpc" in clean_pid or "tst" in clean_pid or "vnoicup" in clean_pid:
        return max(4, min_level)

    # 4. Beginner topics baseline
    if main_topic == "Cơ bản & Nhập môn":
        return 1

    return min_level


def build_result(main_topic: str, sub_topic: str, level: int, tags: List[str]) -> ClassificationResult:
    level = max(1, min(5, level))
    level_label = LEVEL_DESCRIPTIONS[level]["name"]
    diff_str = f"Level {level} • {main_topic}"
    return ClassificationResult(
        main_topic=main_topic,
        sub_topic=sub_topic,
        level=level,
        level_label=level_label,
        difficulty_str=diff_str,
        tags=tags
    )


# ==============================================================================
# 4. GOOGLE SHEETS CLASSIFICATION & UPDATE
# ==============================================================================

def get_connected_sheet():
    """Initializes Google Sheets connection using existing settings."""
    from src.sync_to_gsheet import get_spreadsheet
    return get_spreadsheet()


def classify_google_sheet_problems(sh=None, update: bool = False) -> Dict[str, Any]:
    """
    Reads problem tabs from Google Sheet, classifies all problems,
    and optionally writes the standardized Level and Category back to Google Sheets.
    """
    if sh is None:
        sh = get_connected_sheet()

    target_worksheets = [
        "Bài Tập",
        "Kho Bài Codeforces",
        "Kho Bài VNOI & Nền Tảng Khác"
    ]

    all_classified = []
    tab_reports = {}

    for title in target_worksheets:
        try:
            ws = sh.worksheet(title)
        except Exception:
            logger.warning(f"Không tìm thấy tab '{title}' trên Google Sheet.")
            continue

        rows = ws.get_all_values()
        if len(rows) <= 1:
            continue

        header = rows[0]
        logger.info(f"Đang xử lý tab '{title}' ({len(rows) - 1} dòng bài tập)...")

        # Map column indices
        # Default: 0: Mã bài, 1: Link, 2: Tên bài, 3: Class, 4: Level, 5: Dạng bài, 6: Nền tảng, 7: Ghi chú
        col_level_idx = 4
        col_cat_idx = 5

        updates_to_make = []
        classified_in_tab = []

        for r_idx, r in enumerate(rows[1:], start=2):
            if not r or not r[0].strip():
                continue

            pid = r[0].strip()
            url = r[1].strip() if len(r) > 1 else ""
            name = r[2].strip() if len(r) > 2 else ""
            classes = r[3].strip() if len(r) > 3 else "Tất cả"
            cur_level = r[4].strip() if len(r) > 4 else ""
            cur_cat = r[5].strip() if len(r) > 5 else ""
            platform = r[6].strip() if len(r) > 6 else ""
            notes = r[7].strip() if len(r) > 7 else ""

            p_data = {
                "id": pid,
                "url": url,
                "name": name,
                "classes": classes,
                "level": cur_level,
                "category": cur_cat,
                "platform": platform,
                "notes": notes
            }

            res = classify_problem(p_data)
            classified_in_tab.append({**p_data, "classified": asdict(res)})
            all_classified.append({**p_data, "classified": asdict(res)})

            # Check if update is needed
            new_level_str = str(res.level)
            new_cat_str = res.main_topic
            if (cur_level != new_level_str or cur_cat != new_cat_str) and update:
                updates_to_make.append({
                    "range": f"E{r_idx}:F{r_idx}",
                    "values": [[new_level_str, new_cat_str]]
                })

        if update and updates_to_make:
            logger.info(f"Đang cập nhật {len(updates_to_make)} dòng trên tab '{title}'...")
            try:
                ws.batch_update(updates_to_make, value_input_option="USER_ENTERED")
                logger.info(f"✅ Đã cập nhật thành công {len(updates_to_make)} bài tập trên tab '{title}'!")
            except Exception as e:
                logger.error(f"Lỗi khi batch update tab '{title}': {e}")

        tab_reports[title] = len(classified_in_tab)

    return {
        "total": len(all_classified),
        "problems": all_classified,
        "tab_reports": tab_reports
    }


# ==============================================================================
# 5. CREATE COMPREHENSIVE DASHBOARD TAB ON GOOGLE SHEETS
# ==============================================================================

def create_overview_dashboard_tab(sh=None, tab_name: str = "Tổng Hợp Phân Loại") -> bool:
    """
    Creates or refreshes a beautiful summary dashboard worksheet in Google Sheets.
    Tables:
    1. Thống kê theo Chủ đề (Topic breakdown with count and percentage)
    2. Thống kê theo Độ khó (Level 1 to 5 with target audience)
    3. Thống kê theo Nền tảng (Platform distribution)
    """
    if sh is None:
        sh = get_connected_sheet()

    print(f"\n📊 Đang thu thập và phân loại dữ liệu để tạo tab Dashboard '{tab_name}'...")
    res = classify_google_sheet_problems(sh, update=False)
    problems = res["problems"]
    total_probs = len(problems)

    if total_probs == 0:
        print("❌ Không tìm thấy bài tập nào để thống kê!")
        return False

    # Aggregate by topic
    topic_counts = {t: 0 for t in MAIN_TOPICS}
    topic_level_dist = {t: {1: 0, 2: 0, 3: 0, 4: 0, 5: 0} for t in MAIN_TOPICS}

    # Aggregate by level
    level_counts = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}

    # Aggregate by platform
    platform_counts = {}

    for item in problems:
        c = item["classified"]
        top = c["main_topic"]
        lvl = c["level"]
        plat = item["platform"] or "Khác"

        if top not in topic_counts:
            topic_counts[top] = 0
            topic_level_dist[top] = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
        topic_counts[top] += 1
        topic_level_dist[top][lvl] += 1

        level_counts[lvl] = level_counts.get(lvl, 0) + 1
        platform_counts[plat] = platform_counts.get(plat, 0) + 1

    # Prepare sheet rows
    rows = []
    # Title Header
    rows.append(["📊 BẢNG TỔNG HỢP & PHÂN LOẠI KHO BÀI TẬP (DERUCKOJ & THẦY ĐỨC)", "", "", "", "", "", ""])
    rows.append([f"Tổng số bài tập: {total_probs} bài | Số chủ đề: {len(MAIN_TOPICS)} chủ đề | Phân loại tự động 100% Zero-Token", "", "", "", "", "", ""])
    rows.append(["", "", "", "", "", "", ""])

    # Table 1: Phân bố theo Chủ đề
    rows.append(["1. BẢNG PHÂN BỐ BÀI TẬP THEO CHỦ ĐỀ THUẬT TOÁN", "", "", "", "", "", ""])
    rows.append(["STT", "Chủ đề thuật toán", "Số lượng bài", "Tỷ lệ (%)", "Level 1-2 (Cơ bản)", "Level 3 (Nâng cao)", "Level 4-5 (Chuyên/VOI)"])

    sorted_topics = sorted(topic_counts.items(), key=lambda x: -x[1])
    for idx, (t, cnt) in enumerate(sorted_topics, 1):
        pct = f"{(cnt / total_probs * 100):.1f}%" if total_probs > 0 else "0%"
        l12 = topic_level_dist[t][1] + topic_level_dist[t][2]
        l3 = topic_level_dist[t][3]
        l45 = topic_level_dist[t][4] + topic_level_dist[t][5]
        rows.append([idx, t, cnt, pct, l12, l3, l45])

    rows.append(["", "TỔNG CỘNG", total_probs, "100.0%", sum(level_counts[1] + level_counts[2] for _ in [0]), level_counts[3], level_counts[4] + level_counts[5]])
    rows.append(["", "", "", "", "", "", ""])

    # Table 2: Phân bố theo Độ khó
    rows.append(["2. BẢNG PHÂN BỐ THEO CẤP ĐỘ ĐỘ KHÓ (LEVEL 1 -> LEVEL 5)", "", "", "", "", "", ""])
    rows.append(["Cấp độ", "Tên cấp độ", "Số lượng bài", "Tỷ lệ (%)", "Khoảng Rating tương đương", "Đối tượng & Mục tiêu đào tạo", ""])
    for lvl in range(1, 6):
        cnt = level_counts.get(lvl, 0)
        pct = f"{(cnt / total_probs * 100):.1f}%" if total_probs > 0 else "0%"
        info = LEVEL_DESCRIPTIONS[lvl]
        rows.append([f"Level {lvl}", info["name"], cnt, pct, info["cf_range"], info["target"], ""])

    rows.append(["", "", "", "", "", "", ""])

    # Table 3: Phân bố theo Nền tảng
    rows.append(["3. BẢNG THỐNG KÊ THEO NỀN TẢNG NGUỒN BÀI TẬP", "", "", "", "", "", ""])
    rows.append(["STT", "Nền tảng thi đấu (OJ)", "Số bài đã giải / sưu tầm", "Tỷ lệ (%)", "Ghi chú nguồn", "", ""])
    sorted_plats = sorted(platform_counts.items(), key=lambda x: -x[1])
    for idx, (plat, cnt) in enumerate(sorted_plats, 1):
        pct = f"{(cnt / total_probs * 100):.1f}%" if total_probs > 0 else "0%"
        note = "Nền tảng trực tuyến"
        if plat == "Codeforces":
            note = "Kho bài đã giải từ Codeforces API"
        elif plat == "VNOI":
            note = "Bài tập chuẩn tuyển chọn VNOJ / VNOI Cup"
        elif plat == "AtCoder":
            note = "AtCoder Beginner & Regular Contest"
        elif plat == "CSES":
            note = "CSES Problem Set thuật toán chuẩn"
        elif plat == "ChuyenTinPro":
            note = "oj.chuyentin.pro"
        elif plat == "ClueOJ":
            note = "oj.clue.edu.vn"
        elif plat == "DeruckOJ":
            note = "Trình chấm tự động nội bộ WebHocTap"
        elif plat == "MarisaOJ":
            note = "Bài tập nhập môn MarisaOJ"

        rows.append([idx, plat, cnt, pct, note, "", ""])

    # Check or create worksheet
    existing_titles = [w.title for w in sh.worksheets()]
    ws = None
    if tab_name in existing_titles:
        ws = sh.worksheet(tab_name)
        ws.clear()
    else:
        ws = sh.add_worksheet(title=tab_name, rows=len(rows) + 30, cols=8)

    # Write data
    ws.update(range_name="A1", values=rows, value_input_option="USER_ENTERED")
    print(f"✅ Đã tạo/làm mới thành công bảng Dashboard '{tab_name}' trên Google Sheet ({len(rows)} hàng)!")
    return True


# ==============================================================================
# 6. LOCAL DATA UPDATE (docs/data.json)
# ==============================================================================

def update_local_data_json(json_path: str = "docs/data.json") -> bool:
    """Classifies all problems in docs/data.json and saves the updated categories/levels."""
    if not os.path.exists(json_path):
        print(f"❌ Không tìm thấy file {json_path}")
        return False

    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    problems = data.get("problems", [])
    if not problems:
        print("ℹ️ Danh sách bài tập trong data.json rỗng.")
        return False

    updated_count = 0
    for p in problems:
        res = classify_problem(p)
        p["category"] = res.main_topic
        p["difficulty"] = res.difficulty_str
        updated_count += 1

    data["problems"] = problems
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"✅ Đã phân loại và cập nhật lại {updated_count} bài tập trong '{json_path}'!")
    return True


# ==============================================================================
# 7. CONSOLE SUMMARY REPORTER
# ==============================================================================

def print_terminal_summary(json_path: str = "docs/data.json"):
    """Prints a beautiful, formatted statistical table in the terminal."""
    if not os.path.exists(json_path):
        print(f"❌ Không tìm thấy file {json_path}")
        return

    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    problems = data.get("problems", [])
    total = len(problems)
    if total == 0:
        print("ℹ️ Không có bài tập nào.")
        return

    topic_counts = {}
    level_counts = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
    platform_counts = {}

    for p in problems:
        res = classify_problem(p)
        t = res.main_topic
        l = res.level
        plat = p.get("platform") or "Khác"

        topic_counts[t] = topic_counts.get(t, 0) + 1
        level_counts[l] = level_counts.get(l, 0) + 1
        platform_counts[plat] = platform_counts.get(plat, 0) + 1

    print("\n" + "=" * 70)
    print("      📊 BÁO CÁO PHÂN LOẠI BÀI TẬP THUẬT TOÁN (TỰ ĐỘNG - ZERO TOKEN)")
    print("=" * 70)
    print(f"  Tổng số bài tập đã phân loại: {total} bài\n")

    # 1. Topics
    print("📌 [1] PHÂN BỐ THEO CHỦ ĐỀ THUẬT TOÁN:")
    print("-" * 70)
    print(f"{'STT':<4} | {'Chủ đề thuật toán':<32} | {'Số lượng':<9} | {'Tỷ lệ %':<8}")
    print("-" * 70)
    sorted_topics = sorted(topic_counts.items(), key=lambda x: -x[1])
    for idx, (t, cnt) in enumerate(sorted_topics, 1):
        pct = f"{(cnt / total * 100):.1f}%"
        print(f"{idx:<4} | {t:<32} | {cnt:<9} | {pct:<8}")
    print("-" * 70)

    # 2. Levels
    print("\n📌 [2] PHÂN BỐ THEO CẤP ĐỘ ĐỘ KHÓ (LEVEL 1 -> LEVEL 5):")
    print("-" * 70)
    print(f"{'Level':<8} | {'Tên cấp độ':<24} | {'Số lượng':<9} | {'Tỷ lệ %':<8} | {'Khoảng Rating'}")
    print("-" * 70)
    for lvl in range(1, 6):
        cnt = level_counts.get(lvl, 0)
        pct = f"{(cnt / total * 100):.1f}%"
        info = LEVEL_DESCRIPTIONS[lvl]
        print(f"Level {lvl:<2} | {info['name']:<24} | {cnt:<9} | {pct:<8} | {info['cf_range']}")
    print("-" * 70)

    # 3. Platforms
    print("\n📌 [3] THỐNG KÊ THEO NỀN TẢNG THI ĐẤU (OJ):")
    print("-" * 70)
    print(f"{'STT':<4} | {'Nền tảng (Platform)':<26} | {'Số bài':<9} | {'Tỷ lệ %'}")
    print("-" * 70)
    sorted_plats = sorted(platform_counts.items(), key=lambda x: -x[1])
    for idx, (plat, cnt) in enumerate(sorted_plats, 1):
        pct = f"{(cnt / total * 100):.1f}%"
        print(f"{idx:<4} | {plat:<26} | {cnt:<9} | {pct:<8}")
    print("=" * 70 + "\n")


# ==============================================================================
# 8. COMMAND LINE INTERFACE
# ==============================================================================

def main():
    parser = argparse.ArgumentParser(description="Phân loại tự động bài tập lập trình thi đấu (Zero AI Token)")
    parser.add_argument("--summary", action="store_true", help="In bảng báo cáo phân loại ra Terminal")
    parser.add_argument("--update-sheet", action="store_true", help="Cập nhật Level và Dạng bài trực tiếp vào các tab Google Sheet")
    parser.add_argument("--create-dashboard-tab", action="store_true", help="Tạo tab 'Tổng Hợp Phân Loại' trực tiếp trên Google Sheet")
    parser.add_argument("--update-local", action="store_true", help="Cập nhật dữ liệu phân loại vào docs/data.json")
    parser.add_argument("--all", action="store_true", help="Thực hiện toàn bộ: phân loại, cập nhật Sheet, tạo Dashboard, cập nhật data.json")
    parser.add_argument("--classify", type=str, help="Kiểm tra phân loại thử 1 bài tập theo tên hoặc từ khóa")

    args = parser.parse_args()

    # Single test mode
    if args.classify:
        test_p = {"id": "TEST-1", "name": args.classify}
        res = classify_problem(test_p)
        print(f"\n🔍 Kết quả phân loại cho: '{args.classify}'")
        print(f"  • Chủ đề chính : {res.main_topic}")
        print(f"  • Dạng chi tiết : {res.sub_topic}")
        print(f"  • Độ khó       : Level {res.level} ({res.level_label})")
        print(f"  • Chuỗi hiển thị: {res.difficulty_str}\n")
        return

    # If no flags passed, run summary by default
    if not (args.summary or args.update_sheet or args.create_dashboard_tab or args.update_local or args.all):
        print_terminal_summary()
        print("💡 Gợi ý lệnh:")
        print("  python src/classify_problems.py --summary              : Xem thống kê phân loại")
        print("  python src/classify_problems.py --create-dashboard-tab : Tạo tab Dashboard trên Google Sheet")
        print("  python src/classify_problems.py --update-sheet         : Cập nhật chuẩn hóa dạng bài vào Google Sheet")
        print("  python src/classify_problems.py --update-local         : Cập nhật docs/data.json")
        print("  python src/classify_problems.py --all                  : Chạy tự động tất cả các bước trên")
        return

    if args.all or args.update_local:
        update_local_data_json()

    if args.all or args.update_sheet:
        print("\n📝 Đang kết nối Google Sheets để cập nhật phân loại vào các tab bài tập...")
        sh = get_connected_sheet()
        classify_google_sheet_problems(sh, update=True)

    if args.all or args.create_dashboard_tab:
        sh = get_connected_sheet()
        create_overview_dashboard_tab(sh)

    if args.all or args.summary:
        print_terminal_summary()


if __name__ == "__main__":
    main()
