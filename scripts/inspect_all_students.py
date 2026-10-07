import sys
import json

sys.stdout.reconfigure(encoding='utf-8')
with open('data_firebase_backup.json', encoding='utf-8') as f:
    d = json.load(f)

print(f"{'STT':<4} | {'Tên':<24} | {'Lớp':<14} | {'Tổng':<5} | {'Marisa':<16} | {'Codeforces':<20} | {'VJudge':<16} | {'VNOI':<15} | {'Clue':<15}")
print("-" * 140)

for s in d['students']:
    stt = str(s.get('stt', ''))
    name = s.get('name', '')
    cls = s.get('class', '')
    total = s.get('total_solved_count', 0)
    marisa = s.get('marisa_handle', '') or '-'
    cf = s.get('cf_handle', '') or '-'
    vj = s.get('vjudge_handle', '') or '-'
    vnoi = s.get('vnoi_handle', '') or '-'
    clue = s.get('clue_handle', '') or '-'
    print(f"{stt:<4} | {name:<24} | {cls:<14} | {total:<5} | {marisa:<16} | {cf:<20} | {vj:<16} | {vnoi:<15} | {clue:<15}")
