import json
import sys

sys.stdout.reconfigure(encoding='utf-8')
data = json.load(open("docs/data.json", encoding="utf-8"))

for pid in ["HSG-NUMBER", "HSG-FACTORIAL", "HSG-SEGMENT", "HSG-DIVISOR"]:
    p = next((x for x in data["problems"] if x["id"] == pid), None)
    print(f"Problem: {p['id']} - {p['name']} | tests: {len(p.get('testcases', []))} | starter_cpp: {len(p.get('starter_cpp', ''))} chars")

c = next((x for x in data["contests"] if x["id"] == "CONTEST-HSG26"), None)
print(f"Contest: {c['id']} - {c['title']} | problems: {c['problem_ids']}")
