import os
import sys
import time
import json
import argparse
import subprocess
import urllib.request
import urllib.parse
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
from src.crawlers.marisaoj import MarisaOJCrawler

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


def fetch_cf_recent(handle: str) -> Tuple[Set[str], Dict[str, Dict[str, int]]]:
    """Fetches recent submissions from Codeforces API."""
    handle = handle.strip()
    if not handle:
        return set(), {}

    solved: Set[str] = set()
    activity: Dict[str, Dict[str, int]] = {}

    try:
        url = f"https://codeforces.com/api/user.status?handle={urllib.parse.quote(handle)}&from=1&count=40"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=8) as resp:
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
                        solved.add(f"CF-{c_id}{p_idx}")
    except Exception:
        pass

    return solved, activity


def fetch_clue_recent(handle: str) -> Tuple[Set[str], Dict[str, Dict[str, int]]]:
    """Fetches recent submissions from ClueOJ API."""
    handle = handle.strip()
    if not handle:
        return set(), {}

    solved: Set[str] = set()
    activity: Dict[str, Dict[str, int]] = {}

    try:
        url = f"https://oj.clue.vn/api/submissions?user={urllib.parse.quote(handle)}&page=1"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            objects = data.get("data", {}).get("objects", [])
            for sub in objects:
                p_code = sub.get("problem")
                created = sub.get("date")
                if not (p_code and created):
                    continue

                d_str = created.split("T")[0]
                if d_str not in activity:
                    activity[d_str] = {"total": 0, "ac": 0}
                activity[d_str]["total"] += 1

                score = str(sub.get("score", ""))
                status = str(sub.get("result", "") or sub.get("status", ""))
                if "100" in score or "AC" in status or "Chấp nhận" in status:
                    activity[d_str]["ac"] += 1
                    solved.add(f"CLUE-{p_code}")
    except Exception:
        pass

    return solved, activity


def check_and_sync_all(driver=None, marisa_crawler=None) -> bool:
    """
    Scans all students for new submissions.
    If new submissions or ACs are found, updates docs/data.json and pushes to GitHub.
    Returns True if new submissions were found and updated.
    """
    json_path = os.path.join(_PROJECT_ROOT, "docs", "data.json")
    if not os.path.exists(json_path):
        return False

    with open(json_path, "r", encoding="utf-8") as f:
        app_data = json.load(f)

    students = app_data.get("students", [])
    if not students:
        try:
            from src.sync_firebase import fetch_database_from_firebase
            fb_data = fetch_database_from_firebase()
            if fb_data.get("students"):
                students = fb_data["students"]
        except Exception:
            pass

        if not students:
            backup_p = os.path.join(_PROJECT_ROOT, "data_firebase_backup.json")
            if os.path.exists(backup_p):
                try:
                    with open(backup_p, "r", encoding="utf-8") as f_b:
                        b_data = json.load(f_b)
                        students = b_data.get("students", [])
                except Exception:
                    pass

    if not students:
        return False

    now = datetime.now()
    now_str = now.strftime("%H:%M:%S")

    changes_detected = []
    own_driver = False

    try:
        # Check MarisaOJ handles
        marisa_students = [s for s in students if s.get("marisa_handle", "").strip()]
        if marisa_students:
            if marisa_crawler is None:
                marisa_crawler = MarisaOJCrawler(delay_seconds=2.0, headless=False)
            if driver is None:
                driver = marisa_crawler._create_driver()
                own_driver = True

            for s in marisa_students:
                m_handle = s["marisa_handle"].strip()
                prev_solved = set(s.get("solved", []))
                new_solved, page_act = marisa_crawler.crawl_user(m_handle, driver=driver)

                # Merge solved
                fresh_solved = prev_solved | new_solved
                added_count = len(fresh_solved) - len(prev_solved)

                # Merge activity
                act_map = dict(s.get("activity", {}))
                for d_str, v in page_act.items():
                    if d_str not in act_map:
                        act_map[d_str] = v
                    else:
                        act_map[d_str]["total"] = max(act_map[d_str].get("total", 0), v.get("total", 0))
                        act_map[d_str]["ac"] = max(act_map[d_str].get("ac", 0), v.get("ac", 0))

                s["solved"] = sorted(list(fresh_solved))
                s["activity"] = act_map

                if added_count > 0:
                    changes_detected.append(f"{s['name']} (MarisaOJ: +{added_count} AC mới)")

        # Check Codeforces & ClueOJ handles (fast HTTP, no browser needed)
        for s in students:
            cf_h = s.get("cf_handle", "").strip()
            clue_h = s.get("clue_handle", "").strip()

            if cf_h:
                cf_solved, cf_act = fetch_cf_recent(cf_h)
                prev_solved = set(s.get("solved", []))
                fresh_solved = prev_solved | cf_solved
                added = len(fresh_solved) - len(prev_solved)
                if added > 0:
                    changes_detected.append(f"{s['name']} (Codeforces: +{added} AC mới)")
                s["solved"] = sorted(list(fresh_solved))

                # Merge activity
                act_map = dict(s.get("activity", {}))
                for d_str, v in cf_act.items():
                    if d_str not in act_map:
                        act_map[d_str] = v
                    else:
                        act_map[d_str]["total"] = max(act_map[d_str].get("total", 0), v.get("total", 0))
                        act_map[d_str]["ac"] = max(act_map[d_str].get("ac", 0), v.get("ac", 0))
                s["activity"] = act_map

            if clue_h:
                clue_solved, clue_act = fetch_clue_recent(clue_h)
                prev_solved = set(s.get("solved", []))
                fresh_solved = prev_solved | clue_solved
                added = len(fresh_solved) - len(prev_solved)
                if added > 0:
                    changes_detected.append(f"{s['name']} (ClueOJ: +{added} AC mới)")
                s["solved"] = sorted(list(fresh_solved))

                # Merge activity
                act_map = dict(s.get("activity", {}))
                for d_str, v in clue_act.items():
                    if d_str not in act_map:
                        act_map[d_str] = v
                    else:
                        act_map[d_str]["total"] = max(act_map[d_str].get("total", 0), v.get("total", 0))
                        act_map[d_str]["ac"] = max(act_map[d_str].get("ac", 0), v.get("ac", 0))
                s["activity"] = act_map

    finally:
        if own_driver and driver:
            try:
                driver.quit()
            except Exception:
                pass

    # Recalculate stats and target homework for all students
    class_config = app_data.get("class_config", {})
    for s in students:
        solved_set = set(s.get("solved", []))
        total_ac = len(solved_set)
        s["total_solved_count"] = total_ac

        # Activity & stats calculation
        act_map = s.get("activity", {})
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
        s["stats"] = {
            "week": stats_week,
            "month": stats_month,
            "year": stats_year,
            "total": total_ac
        }

        # Homework targets
        s_cls = s.get("class", "C++")
        cls_prob_ids = class_config.get(s_cls, {}).get("problem_ids", [])
        target_solved = [pid for pid in cls_prob_ids if pid in solved_set]
        s["target_solved"] = target_solved
        s["target_solved_count"] = len(target_solved)
        s["target_class_total"] = len(cls_prob_ids) if cls_prob_ids else 8

    # If any new submissions detected, save and git push
    if changes_detected:
        print()
        print(f"[{now_str}] 🔔 PHÁT HIỆN BÀI NỘP MỚI TỪ HỌC SINH:")
        for ch in changes_detected:
            print(f"   ✨ {ch}")

        app_data["last_updated"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

        # 1. Push updated students and activity to Firebase Realtime Database
        try:
            from src.sync_firebase import push_students_to_firebase
            push_students_to_firebase(students)
            print(f"[{now_str}] ☁️ Đã cập nhật tiến độ bài nộp mới lên Firebase Realtime Database thành công!")
        except Exception as fb_err:
            logger.warning(f"Could not push updated students to Firebase: {fb_err}")

        # 2. Update local data backup
        backup_p = os.path.join(_PROJECT_ROOT, "data_firebase_backup.json")
        try:
            if os.path.exists(backup_p):
                with open(backup_p, "r", encoding="utf-8") as f_b:
                    b_data = json.load(f_b)
                b_data["students"] = students
                b_data["last_updated"] = app_data["last_updated"]
                with open(backup_p, "w", encoding="utf-8") as f_b:
                    json.dump(b_data, f_b, ensure_ascii=False, indent=2)
        except Exception:
            pass

        # 3. Sanitize docs/data.json (Zero student leak)
        app_data["students"] = []
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(app_data, f, ensure_ascii=False, indent=2)

        print(f"[{now_str}] 📤 Đang tự động commit và đẩy lên GitHub Pages...")
        run_git_cmd(["add", "docs/data.json"])
        c_msg = f"auto: update new submissions at {now_str}"
        run_git_cmd(["commit", "-m", c_msg])
        push_ok, p_out = run_git_cmd(["push", "origin", "master"])
        if not push_ok:
            run_git_cmd(["pull", "--rebase", "origin", "master"])
            push_ok, p_out = run_git_cmd(["push", "origin", "master"])

        if push_ok:
            print(f"[{now_str}] ✅ [HOÀN TẤT] Website đã được cập nhật trực tuyến thành công!")
        else:
            print(f"[{now_str}] ⚠️ Đã lưu cục bộ nhưng chưa thể đẩy lên GitHub: {p_out}")

        return True
    else:
        print(f"[{now_str}] ⏳ Đã kiểm tra {len(students)} học sinh. Chưa có bài nộp mới.")
        return False


def main_watch_loop(interval_seconds: int = 120):
    """Continuous auto-watch loop."""
    print("=" * 65)
    print("  🚀 HỆ THỐNG TỰ ĐỘNG CẬP NHẬT BÀI NỘP HỌC SINH LIÊN TỤC")
    print("=" * 65)
    print(f"⏱️ Chu kỳ kiểm tra: Mỗi {interval_seconds} giây ({round(interval_seconds / 60, 1)} phút)")
    print("🌐 Các nền tảng theo dõi: MarisaOJ, Codeforces, ClueOJ")
    print("💡 Bất cứ khi nào học sinh nộp bài AC mới, hệ thống sẽ:")
    print("   1. Tự động cộng bài vào hồ sơ cá nhân và bảng xếp hạng.")
    print("   2. Tự động commit và đẩy lên GitHub Pages.")
    print("   3. Web của học sinh/phụ huynh tự động cập nhật ngay lập tức.")
    print("👉 Bạn có thể THU NHỎ cửa sổ này và để máy tính làm việc.")
    print("=" * 65)
    print()

    marisa_crawler = MarisaOJCrawler(delay_seconds=2.0, headless=False)
    driver = None

    try:
        driver = marisa_crawler._create_driver()

        while True:
            try:
                check_and_sync_all(driver=driver, marisa_crawler=marisa_crawler)
            except Exception as e:
                logger.warning(f"Lỗi kiểm tra chu kỳ: {e}")

            time.sleep(interval_seconds)

    except KeyboardInterrupt:
        print("\n👋 Đã dừng chế độ tự động cập nhật liên tục.")
    finally:
        if driver:
            try:
                driver.quit()
            except Exception:
                pass


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Tự động kiểm tra bài nộp học sinh liên tục")
    parser.add_argument("--interval", type=int, default=120, help="Chu kỳ kiểm tra tính bằng giây (mặc định: 120s)")
    parser.add_argument("--once", action="store_true", help="Chỉ kiểm tra một lần rồi thoát")
    args = parser.parse_args()

    if args.once:
        check_and_sync_all()
    else:
        main_watch_loop(interval_seconds=args.interval)
