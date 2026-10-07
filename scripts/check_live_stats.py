import sys
import json
import urllib.request
import urllib.parse
import re

import os
os.environ.pop('SSLKEYLOGFILE', None)
sys.stdout.reconfigure(encoding='utf-8')
with open('data_firebase_backup.json', encoding='utf-8') as f:
    backup = json.load(f)

print(f"{'STT':<3} | {'Tên':<23} | {'DB':<5} | {'CF live':<8} | {'VJ live':<8} | {'VNOI live':<9} | {'Clue live':<9} | {'Marisa (extra+parsed)':<20}")
print("-" * 115)

for s in backup['students']:
    stt = str(s.get('stt'))
    name = s.get('name')
    prev_solved = set(s.get('solved', []))
    
    # CF
    cf_h = s.get('cf_handle', '').strip()
    cf_count = 0
    if cf_h:
        try:
            url = f"https://codeforces.com/api/user.status?handle={urllib.parse.quote(cf_h)}&from=1&count=1000"
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=5) as resp:
                data = json.loads(resp.read().decode('utf-8'))
                if data.get('status') == 'OK':
                    cf_solved = set()
                    for sub in data.get('result', []):
                        if sub.get('verdict') == 'OK':
                            cid = sub.get('contestId')
                            idx = sub.get('problem', {}).get('index')
                            if cid and idx:
                                cf_solved.add(f"{cid}{idx}")
                    cf_count = len(cf_solved)
        except Exception as e:
            cf_count = f"err"

    # VJ
    vj_h = s.get('vjudge_handle', '').strip()
    vj_count = 0
    if vj_h:
        try:
            url = f"https://vjudge.net/user/solveDetail/{urllib.parse.quote(vj_h)}"
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=5) as resp:
                data = json.loads(resp.read().decode('utf-8'))
                vj_solved = set()
                for plat, probs in data.get('acRecords', {}).items():
                    for p in probs:
                        vj_solved.add(f"{plat}-{p}")
                vj_count = len(vj_solved)
        except Exception as e:
            vj_count = f"err"

    # VNOI
    vnoi_h = s.get('vnoi_handle', '').strip()
    vnoi_count = 0
    if vnoi_h:
        try:
            url = f"https://oj.vnoi.info/user/{urllib.parse.quote(vnoi_h)}/submissions?status=AC"
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=5) as resp:
                html = resp.read().decode('utf-8')
                probs = set(re.findall(r'href="/problem/([^/"]+)"', html))
                vnoi_count = len(probs)
        except Exception:
            vnoi_count = "err"

    # Clue
    clue_h = s.get('clue_handle', '').strip()
    clue_count = 0
    if clue_h:
        try:
            url = f"https://oj.clue.edu.vn/submissions?user={urllib.parse.quote(clue_h)}&status=AC&page=1"
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=5) as resp:
                html = resp.read().decode('utf-8')
                probs = set(re.findall(r'href="/problem/([^/"]+)"', html))
                clue_count = len(probs)
        except Exception:
            clue_count = "err"

    # Marisa currently in student's solved list
    marisa_cnt = len([p for p in prev_solved if p.startswith('MARISA-')])
    
    print(f"{stt:<3} | {name:<23} | {len(prev_solved):<5} | {str(cf_count):<8} | {str(vj_count):<8} | {str(vnoi_count):<9} | {str(clue_count):<9} | {str(marisa_cnt):<20}")
