import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

with open('data_firebase_backup.json', encoding='utf-8') as f:
    d = json.load(f)

for s in d.get('students', []):
    print(f"ID: {s.get('stt')} | Name: {s.get('name')} | Class: {s.get('class')}")
    print(f"   Handles: Marisa='{s.get('marisa_handle')}', CF='{s.get('cf_handle')}', VNOI='{s.get('vnoi_handle')}', VJ='{s.get('vjudge_handle')}', Clue='{s.get('clue_handle')}', CTOJ='{s.get('ctoj_handle')}'")
    solved = s.get('solved', [])
    print(f"   Solved: {len(solved)} | Target: {s.get('target_solved_count')}/{s.get('target_class_total')}")
    print(f"   Target Solved List: {s.get('target_solved', [])}")
    print(f"   Sample Solved: {solved[:10]}")
    print("-" * 50)
