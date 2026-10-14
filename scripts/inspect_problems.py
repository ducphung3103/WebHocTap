import openpyxl
import sys
import json

sys.stdout.reconfigure(encoding='utf-8')

wb = openpyxl.load_workbook("Quản lý học sinh.xlsx", data_only=True)
ws = wb["Bài Tập"]
excel_probs = {}
for row in ws.iter_rows(values_only=True):
    if not row or not row[0]: continue
    pid = str(row[0]).strip()
    if pid.startswith("MARISA-") or pid.startswith("CF-") or pid.startswith("CSES-") or "EX" in pid or "HSG" in pid:
        excel_probs[pid] = {
            "link": row[1],
            "name": row[2],
            "class": row[3],
            "level": row[4],
            "type": row[5]
        }

print(f"Total problems in Excel: {len(excel_probs)}")
for pid, val in excel_probs.items():
    print(f"[{pid}] Excel name: '{val['name']}' | link: {val['link']}")

data = json.load(open('docs/data.json', encoding='utf-8'))
json_probs = {p['id']: p for p in data['problems']}

print("\n--- COMPARISON (Excel vs data.json) ---")
for pid, ex_val in excel_probs.items():
    if pid in json_probs:
        j_name = json_probs[pid]['name']
        if ex_val['name'] != j_name:
            print(f"MISMATCH [{pid}]: Excel='{ex_val['name']}' <---> data.json='{j_name}'")
    else:
        print(f"In Excel but NOT in data.json: [{pid}] '{ex_val['name']}'")
