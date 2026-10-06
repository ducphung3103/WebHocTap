import os
import sys
import json
import time
import urllib.request
import urllib.parse
import re
from datetime import datetime, timezone
from typing import Set, Dict, Tuple

os.environ.pop('SSLKEYLOGFILE', None)
sys.stdout.reconfigure(encoding='utf-8')

_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _PROJECT_ROOT not in sys.path:
    sys.path.insert(0, _PROJECT_ROOT)

from src.sync_firebase import push_students_to_firebase, get_target_url, get_auth_headers_and_param

def fetch_cf_all(handle: str) -> Tuple[Set[str], Dict[str, Dict[str, int]]]:
    handle = handle.strip()
    if not handle:
        return set(), {}
    solved = set()
    activity = {}
    try:
        url = f"https://codeforces.com/api/user.status?handle={urllib.parse.quote(handle)}&from=1&count=5000"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=12) as resp:
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
                        code = f"{c_id}{p_idx}".strip()
                        solved.add(f"CF-{code}")
    except Exception as e:
        print(f"  [CF] {handle} error: {e}")
    return solved, activity

def fetch_vjudge_all(handle: str) -> Tuple[Set[str], Dict[str, Dict[str, int]]]:
    handle = handle.strip()
    if not handle:
        return set(), {}
    solved = set()
    try:
        url = f"https://vjudge.net/user/solveDetail/{urllib.parse.quote(handle)}"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            ac_recs = data.get("acRecords", {})
            for plat, probs in ac_recs.items():
                p_norm = plat.upper()
                if "CODEFORCES" in p_norm:
                    for p in probs:
                        solved.add(f"CF-{p}")
                else:
                    for p in probs:
                        solved.add(f"VJ-{plat}-{p}")
    except Exception as e:
        print(f"  [VJ] {handle} error: {e}")
    return solved, {}

def fetch_vnoi_all(handle: str) -> Tuple[Set[str], Dict[str, Dict[str, int]]]:
    handle = handle.strip()
    if not handle:
        return set(), {}
    solved = set()
    try:
        url = f"https://oj.vnoi.info/user/{urllib.parse.quote(handle)}/submissions?status=AC"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            text = resp.read().decode("utf-8")
            probs = set(re.findall(r'href="/problem/([^/"]+)"', text))
            for p in probs:
                solved.add(f"VNOI-{p.lower()}")
    except Exception as e:
        if "404" not in str(e):
            print(f"  [VNOI] {handle} error: {e}")
    return solved, {}

def fetch_clue_all(handle: str) -> Tuple[Set[str], Dict[str, Dict[str, int]]]:
    handle = handle.strip()
    if not handle:
        return set(), {}
    solved = set()
    for page in range(1, 20):
        url = f"https://oj.clue.edu.vn/submissions?user={urllib.parse.quote(handle)}&status=AC&page={page}"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        try:
            with urllib.request.urlopen(req, timeout=8) as resp:
                html = resp.read().decode("utf-8")
                probs = set(re.findall(r'href="/problem/([^/"]+)"', html))
                if not probs:
                    break
                for p in probs:
                    solved.add(f"CLUE-{p}")
        except Exception:
            break
    return solved, {}

def run_recalc():
    backup_file = os.path.join(_PROJECT_ROOT, "data_firebase_backup.json")
    with open(backup_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    with open(os.path.join(_PROJECT_ROOT, "docs", "data.json"), "r", encoding="utf-8") as f:
        catalog_data = json.load(f)
    class_config = catalog_data.get("class_config", {})

    # Load Marisa cached datasets
    marisa_data = {}
    m1_path = os.path.join(_PROJECT_ROOT, "marisa_parsed_ac.json")
    if os.path.exists(m1_path):
        with open(m1_path, "r", encoding="utf-8") as f:
            raw_m1 = json.load(f)
            for h, info in raw_m1.items():
                p_ids = info.get("all_ac_ids", [])
                marisa_data[h] = {f"MARISA-{pid}" for pid in p_ids}

    m2_path = os.path.join(_PROJECT_ROOT, "scripts", "crawled_marisa_extra.json")
    if os.path.exists(m2_path):
        with open(m2_path, "r", encoding="utf-8") as f:
            raw_m2 = json.load(f)
            for h, p_list in raw_m2.items():
                if h not in marisa_data:
                    marisa_data[h] = set()
                marisa_data[h] |= set(p_list)

    students = data.get("students", [])
    now = datetime.now()

    print("=" * 60)
    print("🚀 BẮT ĐẦU CẬP NHẬT TOÀN DIỆN TIẾN ĐỘ BÀI GIẢI CỦA TẤT CẢ HỌC SINH")
    print("=" * 60)

    for s in students:
        stt = s.get("stt")
        name = s.get("name")
        cls = s.get("class", "C++")
        prev_solved = set(s.get("solved", []))
        act_map = dict(s.get("activity", {}))
        
        print(f"\n[STT {stt}] {name} ({cls}):")
        print(f"  • Số bài cũ: {len(prev_solved)}")

        fresh_solved = set(prev_solved)

        # 1. MarisaOJ
        m_handle = s.get("marisa_handle", "").strip()
        if m_handle and m_handle in marisa_data:
            m_set = marisa_data[m_handle]
            fresh_solved |= m_set
            print(f"  • MarisaOJ ({m_handle}): {len(m_set)} bài")

        # 2. Codeforces
        cf_handle = s.get("cf_handle", "").strip()
        if cf_handle:
            cf_set, cf_act = fetch_cf_all(cf_handle)
            fresh_solved |= cf_set
            for d_str, v in cf_act.items():
                if d_str not in act_map:
                    act_map[d_str] = v
                else:
                    act_map[d_str]["total"] = max(act_map[d_str].get("total", 0), v.get("total", 0))
                    act_map[d_str]["ac"] = max(act_map[d_str].get("ac", 0), v.get("ac", 0))
            print(f"  • Codeforces ({cf_handle}): {len(cf_set)} bài")
            time.sleep(0.4)

        # 3. VJudge
        vj_handle = s.get("vjudge_handle", "").strip()
        if vj_handle:
            vj_set, _ = fetch_vjudge_all(vj_handle)
            fresh_solved |= vj_set
            print(f"  • VJudge ({vj_handle}): {len(vj_set)} bài")
            time.sleep(0.4)

        # 4. VNOI
        vnoi_handle = s.get("vnoi_handle", "").strip()
        if vnoi_handle:
            vnoi_set, _ = fetch_vnoi_all(vnoi_handle)
            fresh_solved |= vnoi_set
            print(f"  • VNOI ({vnoi_handle}): {len(vnoi_set)} bài")
            time.sleep(0.4)

        # 5. ClueOJ
        clue_handle = s.get("clue_handle", "").strip()
        if clue_handle:
            clue_set, _ = fetch_clue_all(clue_handle)
            fresh_solved |= clue_set
            print(f"  • ClueOJ ({clue_handle}): {len(clue_set)} bài")
            time.sleep(0.4)

        # Save merged solved
        s["solved"] = sorted(list(fresh_solved))
        total_ac = len(fresh_solved)
        s["total_solved_count"] = total_ac
        s["activity"] = act_map

        # Recalculate stats
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
        cls_prob_ids = class_config.get(cls, {}).get("problem_ids", [])
        target_solved = [pid for pid in cls_prob_ids if pid in fresh_solved]
        s["target_solved"] = target_solved
        s["target_solved_count"] = len(target_solved)
        s["target_class_total"] = len(cls_prob_ids) if cls_prob_ids else 8

        diff_count = total_ac - len(prev_solved)
        print(f"  => KẾT QUẢ MỚI: {total_ac} bài AC (+{diff_count} bài) | Mục tiêu lớp: {len(target_solved)}/{s['target_class_total']}")

    now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    data["last_updated"] = now_iso

    # 1. Save local backup
    with open(backup_file, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"\n💾 Đã lưu dữ liệu vào {backup_file}")

    # 2. Push to Firebase
    print("\n☁️ Đang đồng bộ lên Firebase Realtime Database...")
    fb_ok = push_students_to_firebase(students)
    if fb_ok:
        print("✅ Đã cập nhật thành công toàn bộ danh sách học sinh lên Firebase /students.json!")
        # Update metadata/last_updated on Firebase
        try:
            target_url = get_target_url()
            headers, auth_param = get_auth_headers_and_param(target_url)
            meta_url = f"{target_url}/metadata/last_updated.json{auth_param}"
            m_req = urllib.request.Request(meta_url, data=json.dumps(now_iso).encode("utf-8"), headers=headers, method="PUT")
            with urllib.request.urlopen(m_req, timeout=8) as m_resp:
                pass
            print("✅ Đã cập nhật timestamp metadata/last_updated lên Firebase!")
        except Exception as e:
            print(f"⚠️ Không thể cập nhật metadata/last_updated: {e}")
    else:
        print("⚠️ Không thể đồng bộ Firebase (sẽ kiểm tra lại).")

    # 3. Update docs/data.json sanitized & last_updated
    catalog_data["last_updated"] = now_iso
    catalog_data["students"] = []
    with open(os.path.join(_PROJECT_ROOT, "docs", "data.json"), "w", encoding="utf-8") as f:
        json.dump(catalog_data, f, ensure_ascii=False, indent=2)
    print("✅ Đã cập nhật docs/data.json an toàn (bảo mật tuyệt đối, zero student leak)")

if __name__ == "__main__":
    run_recalc()
