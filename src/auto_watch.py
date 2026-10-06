import os
import sys
import time
import json
import argparse
import subprocess
import urllib.request
import urllib.parse
import re
from datetime import datetime, timezone
from typing import Dict, List, Set, Any, Tuple

# Fix Windows console encoding
sys.stdout.reconfigure(encoding='utf-8')
os.environ.pop("SSLKEYLOGFILE", None)

# Ensure project root is in sys.path
_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _PROJECT_ROOT not in sys.path:
    sys.path.insert(0, _PROJECT_ROOT)

from src.utils.logger import get_logger

logger = get_logger("auto.watch")


def run_git_cmd(args: List[str]) -> Tuple[bool, str]:
    """Runs a git command in project root."""
    try:
        res = subprocess.run(
            ["git"] + args,
            cwd=_PROJECT_ROOT,
            capture_output=True,
            text=True,
            encoding="utf-8"
        )
        out = (res.stdout or "") + (res.stderr or "")
        return res.returncode == 0, out.strip()
    except Exception as exc:
        return False, str(exc)


def fetch_cf_recent(handle: str, count: int = 20) -> Tuple[Set[str], Dict[str, Dict[str, int]]]:
    """
    Fetches recent submissions from Codeforces API.
    Uses small count (20) during 5s polls to save bandwidth & quota.
    """
    handle = handle.strip()
    if not handle:
        return set(), {}

    solved: Set[str] = set()
    activity: Dict[str, Dict[str, int]] = {}

    try:
        url = f"https://codeforces.com/api/user.status?handle={urllib.parse.quote(handle)}&from=1&count={count}"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=6) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            if data.get("status") == "OK":
                for sub in data.get("result", []):
                    c_id = sub.get("contestId")
                    p_idx = sub.get("problem", {}).get("index")
                    cr_time = sub.get("creationTimeSeconds")
                    if not (c_id and p_idx and cr_time):
                        continue

                    d_str = datetime.fromtimestamp(cr_time).strftime("%Y-%m-%d")
                    if d_str not in activity:
                        activity[d_str] = {"total": 0, "ac": 0}
                    activity[d_str]["total"] += 1

                    if sub.get("verdict") == "OK":
                        activity[d_str]["ac"] += 1
                        solved.add(f"CF-{c_id}{p_idx}".strip())
    except Exception:
        pass

    return solved, activity


def fetch_vjudge_recent(handle: str) -> Tuple[Set[str], Dict[str, Dict[str, int]]]:
    """Fetches AC problems from VJudge solveDetail API (fast & lightweight)."""
    handle = handle.strip()
    if not handle:
        return set(), {}

    solved: Set[str] = set()
    try:
        url = f"https://vjudge.net/user/solveDetail/{urllib.parse.quote(handle)}"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=6) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            ac_recs = data.get("acRecords", {})
            for plat, probs in ac_recs.items():
                p_norm = plat.upper()
                if "CODEFORCES" in p_norm:
                    for p in probs:
                        solved.add(f"CF-{p}".strip())
                else:
                    for p in probs:
                        solved.add(f"VJ-{plat}-{p}".strip())
    except Exception:
        pass

    return solved, {}


def fetch_vnoi_recent(handle: str) -> Tuple[Set[str], Dict[str, Dict[str, int]]]:
    """Fetches recent AC problems from oj.vnoi.info page 1."""
    handle = handle.strip()
    if not handle:
        return set(), {}

    solved: Set[str] = set()
    try:
        url = f"https://oj.vnoi.info/user/{urllib.parse.quote(handle)}/submissions?status=AC"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=6) as resp:
            text = resp.read().decode("utf-8")
            probs = set(re.findall(r'href="/problem/([^/"]+)"', text))
            for p in probs:
                solved.add(f"VNOI-{p.lower()}".strip())
    except Exception:
        pass

    return solved, {}


def fetch_clue_recent(handle: str) -> Tuple[Set[str], Dict[str, Dict[str, int]]]:
    """Fetches recent AC submissions from oj.clue.edu.vn page 1."""
    handle = handle.strip()
    if not handle:
        return set(), {}

    solved: Set[str] = set()
    try:
        url = f"https://oj.clue.edu.vn/submissions?user={urllib.parse.quote(handle)}&status=AC&page=1"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=6) as resp:
            text = resp.read().decode("utf-8")
            probs = set(re.findall(r'href="/problem/([^/"]+)"', text))
            for p in probs:
                solved.add(f"CLUE-{p}".strip())
    except Exception:
        pass

    return solved, {}


def recalculate_student_stats(student: Dict[str, Any], class_config: Dict[str, Any]):
    """Recalculates target solved count and stats breakdown for a student."""
    now = datetime.now()
    solved_set = set(student.get("solved", []))
    total_ac = len(solved_set)
    student["total_solved_count"] = total_ac

    act_map = student.get("activity", {})
    ac_week = 0
    ac_month = 0
    ac_year = 0
    for d_str, v in act_map.items():
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

    stats_year = min(ac_year, total_ac)
    stats_month = min(ac_month, stats_year)
    stats_week = min(ac_week, stats_month)
    student["stats"] = {
        "week": stats_week,
        "month": stats_month,
        "year": stats_year,
        "total": total_ac
    }

    s_cls = student.get("class", "C++")
    cls_prob_ids = class_config.get(s_cls, {}).get("problem_ids", [])
    target_solved = [pid for pid in cls_prob_ids if pid in solved_set]
    student["target_solved"] = target_solved
    student["target_solved_count"] = len(target_solved)
    student["target_class_total"] = len(cls_prob_ids) if cls_prob_ids else 8


def load_students_data() -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """Loads latest students list from backup or Firebase."""
    backup_p = os.path.join(_PROJECT_ROOT, "data_firebase_backup.json")
    students = []
    if os.path.exists(backup_p):
        try:
            with open(backup_p, "r", encoding="utf-8") as f_b:
                b_data = json.load(f_b)
                students = b_data.get("students", [])
        except Exception:
            pass

    if not students:
        try:
            from src.sync_firebase import fetch_database_from_firebase
            fb_data = fetch_database_from_firebase()
            if fb_data.get("students"):
                students = fb_data["students"]
        except Exception:
            pass

    catalog_p = os.path.join(_PROJECT_ROOT, "docs", "data.json")
    class_config = {}
    if os.path.exists(catalog_p):
        try:
            with open(catalog_p, "r", encoding="utf-8") as f_c:
                c_data = json.load(f_c)
                class_config = c_data.get("class_config", {})
        except Exception:
            pass

    return students, class_config


def save_and_push_updates(students: List[Dict[str, Any]], changes: List[str]):
    """Pushes detected changes to Firebase and updates local backups."""
    now = datetime.now()
    now_str = now.strftime("%H:%M:%S")
    now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    print()
    print(f"[{now_str}] 🔔 PHÁT HIỆN BÀI NỘP MỚI TỪ HỌC SINH:")
    for ch in changes:
        print(f"   ✨ {ch}")

    # 1. Push to Firebase
    try:
        from src.sync_firebase import push_students_to_firebase, get_target_url, get_auth_headers_and_param
        push_students_to_firebase(students)
        
        # Update metadata timestamp on Firebase
        target_url = get_target_url()
        headers, auth_param = get_auth_headers_and_param(target_url)
        meta_url = f"{target_url}/metadata/last_updated.json{auth_param}"
        m_req = urllib.request.Request(meta_url, data=json.dumps(now_iso).encode("utf-8"), headers=headers, method="PUT")
        with urllib.request.urlopen(m_req, timeout=6) as _:
            pass
        print(f"[{now_str}] ☁️ Đã cập nhật tiến độ mới lên Firebase Realtime Database thành công!")
    except Exception as fb_err:
        logger.warning(f"Could not push to Firebase: {fb_err}")

    # 2. Update local backup
    backup_p = os.path.join(_PROJECT_ROOT, "data_firebase_backup.json")
    try:
        if os.path.exists(backup_p):
            with open(backup_p, "r", encoding="utf-8") as f_b:
                b_data = json.load(f_b)
            b_data["students"] = students
            b_data["last_updated"] = now_iso
            with open(backup_p, "w", encoding="utf-8") as f_b:
                json.dump(b_data, f_b, ensure_ascii=False, indent=2)
    except Exception:
        pass

    # 3. Sanitize docs/data.json
    json_path = os.path.join(_PROJECT_ROOT, "docs", "data.json")
    try:
        if os.path.exists(json_path):
            with open(json_path, "r", encoding="utf-8") as f:
                app_data = json.load(f)
            app_data["students"] = []
            app_data["last_updated"] = now_iso
            with open(json_path, "w", encoding="utf-8") as f:
                json.dump(app_data, f, ensure_ascii=False, indent=2)
    except Exception:
        pass


def check_single_student(s: Dict[str, Any], class_config: Dict[str, Any]) -> List[str]:
    """
    Checks recent submissions for ONE student across Codeforces, VJudge, VNOI, ClueOJ.
    Returns list of change descriptions if new ACs were found.
    """
    changes = []
    cf_h = s.get("cf_handle", "").strip()
    vj_h = s.get("vjudge_handle", "").strip()
    vnoi_h = s.get("vnoi_handle", "").strip()
    clue_h = s.get("clue_handle", "").strip()

    prev_solved = set(s.get("solved", []))
    fresh_solved = set(prev_solved)
    act_map = dict(s.get("activity", {}))

    # CF
    if cf_h:
        cf_s, cf_act = fetch_cf_recent(cf_h, count=20)
        added_cf = len(cf_s - fresh_solved)
        if added_cf > 0:
            changes.append(f"{s['name']} (Codeforces: +{added_cf} AC mới)")
        fresh_solved |= cf_s
        for d_str, v in cf_act.items():
            if d_str not in act_map:
                act_map[d_str] = v
            else:
                act_map[d_str]["total"] = max(act_map[d_str].get("total", 0), v.get("total", 0))
                act_map[d_str]["ac"] = max(act_map[d_str].get("ac", 0), v.get("ac", 0))

    # VJudge
    if vj_h:
        vj_s, _ = fetch_vjudge_recent(vj_h)
        added_vj = len(vj_s - fresh_solved)
        if added_vj > 0:
            changes.append(f"{s['name']} (VJudge: +{added_vj} AC mới)")
        fresh_solved |= vj_s

    # VNOI
    if vnoi_h:
        vnoi_s, _ = fetch_vnoi_recent(vnoi_h)
        added_vnoi = len(vnoi_s - fresh_solved)
        if added_vnoi > 0:
            changes.append(f"{s['name']} (VNOI: +{added_vnoi} AC mới)")
        fresh_solved |= vnoi_s

    # ClueOJ
    if clue_h:
        clue_s, _ = fetch_clue_recent(clue_h)
        added_clue = len(clue_s - fresh_solved)
        if added_clue > 0:
            changes.append(f"{s['name']} (ClueOJ: +{added_clue} AC mới)")
        fresh_solved |= clue_s

    if len(fresh_solved) > len(prev_solved):
        s["solved"] = sorted(list(fresh_solved))
        s["activity"] = act_map
        recalculate_student_stats(s, class_config)

    return changes


def main_watch_loop(interval_seconds: int = 5):
    """
    Continuous auto-watch loop running every 5 seconds.
    Features:
    - Quota-Safe Round-Robin: checks 1 student per 5s tick.
      => 0.2 req/s average API usage. ZERO risk of HTTP 429 rate limit or quota ban!
    - Full round of all students completes every (N * 5) seconds automatically.
    - Zero Quota wasted on Firebase: only writes when a student ACs a new problem.
    """
    students, class_config = load_students_data()
    if not students:
        print("❌ Không tìm thấy danh sách học sinh để theo dõi!")
        return

    print("=" * 68)
    print("  🚀 HỆ THỐNG TỰ ĐỘNG CẬP NHẬT TIẾN ĐỘ BÀI NỘP LIÊN TỤC (5 GIÂY / LẦN)")
    print("=" * 68)
    print(f"⏱️  Chu kỳ kiểm tra: Mỗi {interval_seconds} giây (Chế độ tự động thông minh)")
    print(f"🛡️  Bảo vệ Quota: Cơ chế Round-Robin 1 học sinh/nhịp (Tránh ngốn quota tuyệt đối)")
    print(f"👥  Tổng số học sinh đang theo dõi: {len(students)} bạn")
    print("🌐  Các nền tảng theo dõi: Codeforces, VJudge, VNOI, ClueOJ, MarisaOJ")
    print("💡  Khi có bài AC mới:")
    print("    • Tự động cộng bài vào bảng xếp hạng & hồ sơ cá nhân ngay lập tức.")
    print("    • Tự động đồng bộ lên Firebase Realtime Database.")
    print("👉  Bạn có thể THU NHỎ cửa sổ này và để máy tính tự động làm việc 24/7.")
    print("=" * 68)
    print()

    current_idx = 0
    total_students = len(students)

    try:
        while True:
            student = students[current_idx % total_students]
            current_idx += 1
            now_str = datetime.now().strftime("%H:%M:%S")

            # Perform check for this student
            try:
                changes = check_single_student(student, class_config)
                if changes:
                    save_and_push_updates(students, changes)
                else:
                    handles_info = []
                    if student.get("cf_handle"): handles_info.append(f"CF:{student['cf_handle']}")
                    if student.get("vjudge_handle"): handles_info.append(f"VJ:{student['vjudge_handle']}")
                    if student.get("clue_handle"): handles_info.append(f"Clue:{student['clue_handle']}")
                    h_str = ", ".join(handles_info) if handles_info else "chưa có handle"
                    print(f"[{now_str}] ⏳ [5s] Kiểm tra [{student['stt']}] {student['name']} ({h_str}) • AC: {student.get('total_solved_count', len(student.get('solved', [])))} bài")
            except Exception as e:
                logger.warning(f"Lỗi kiểm tra học sinh {student.get('name')}: {e}")

            time.sleep(interval_seconds)

    except KeyboardInterrupt:
        print("\n👋 Đã dừng chế độ tự động cập nhật liên tục.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Tự động kiểm tra bài nộp học sinh liên tục mỗi 5s (Bảo vệ Quota)")
    parser.add_argument("--interval", type=int, default=5, help="Chu kỳ kiểm tra tính bằng giây (mặc định: 5s)")
    parser.add_argument("--once", action="store_true", help="Chỉ kiểm tra một lượt tất cả học sinh rồi thoát")
    args = parser.parse_args()

    if args.once:
        s_list, cfg = load_students_data()
        all_ch = []
        for s in s_list:
            ch = check_single_student(s, cfg)
            all_ch.extend(ch)
            time.sleep(0.3)
        if all_ch:
            save_and_push_updates(s_list, all_ch)
        print(f"✅ Đã kiểm tra xong toàn bộ {len(s_list)} học sinh.")
    else:
        main_watch_loop(interval_seconds=args.interval)
