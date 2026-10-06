import os
import sys
import json
import time
import urllib.request
import urllib.parse
import re
from datetime import datetime
from typing import Set, Dict, Tuple

os.environ.pop('SSLKEYLOGFILE', None)
sys.stdout.reconfigure(encoding='utf-8')

_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def fetch_cf(handle: str) -> Tuple[Set[str], Dict[str, Dict[str, int]]]:
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
                        solved.add(f"CF-{c_id}{p_idx}")
    except Exception as e:
        print(f"  [CF] {handle} error: {e}")
    return solved, activity

def fetch_vjudge(handle: str) -> Tuple[Set[str], Dict[str, Dict[str, int]]]:
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

def fetch_vnoi(handle: str) -> Tuple[Set[str], Dict[str, Dict[str, int]]]:
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

def fetch_clue(handle: str) -> Tuple[Set[str], Dict[str, Dict[str, int]]]:
    handle = handle.strip()
    if not handle:
        return set(), {}
    solved = set()
    activity = {}
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
    except Exception as e:
        print(f"  [CLUE] {handle} error: {e}")
    return solved, activity

with open(os.path.join(_PROJECT_ROOT, 'data_firebase_backup.json'), encoding='utf-8') as f:
    backup_data = json.load(f)

students = backup_data.get('students', [])

for s in students:
    stt = s.get('stt')
    name = s.get('name')
    prev_solved = set(s.get('solved', []))
    print(f"\n--- [{stt}] {name} --- (Hiện có: {len(prev_solved)} AC)")
    
    new_found = set()
    
    # 1. CF
    if s.get('cf_handle'):
        cf_s, cf_act = fetch_cf(s['cf_handle'])
        print(f"  CF ({s['cf_handle']}): {len(cf_s)} AC")
        new_found |= cf_s
        time.sleep(0.5)

    # 2. VJudge
    if s.get('vjudge_handle'):
        vj_s, _ = fetch_vjudge(s['vjudge_handle'])
        print(f"  VJ ({s['vjudge_handle']}): {len(vj_s)} AC")
        new_found |= vj_s
        time.sleep(0.5)

    # 3. VNOI
    if s.get('vnoi_handle'):
        vnoi_s, _ = fetch_vnoi(s['vnoi_handle'])
        print(f"  VNOI ({s['vnoi_handle']}): {len(vnoi_s)} AC")
        new_found |= vnoi_s
        time.sleep(0.5)

    # 4. ClueOJ
    if s.get('clue_handle'):
        clue_s, _ = fetch_clue(s['clue_handle'])
        print(f"  Clue ({s['clue_handle']}): {len(clue_s)} AC")
        new_found |= clue_s
        time.sleep(0.5)

    total_combined = prev_solved | new_found
    added = len(total_combined) - len(prev_solved)
    print(f"  => Tổng cộng sau khi gộp: {len(total_combined)} (+{added} bài mới)")
