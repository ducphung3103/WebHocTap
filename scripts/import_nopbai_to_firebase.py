import os
import json
import urllib.request
import sys

sys.stdout.reconfigure(encoding='utf-8')
os.environ.pop('SSLKEYLOGFILE', None)

nopbai_dir = os.path.join('TEST', 'NOPBAI')
candidates = sorted(os.listdir(nopbai_dir))

prob_map = {
    'NUMBER': ('HSG-NUMBER', 'Biến đổi số'),
    'FACTORIAL': ('HSG-FACTORIAL', 'Giai thừa'),
    'SEGMENT': ('HSG-SEGMENT', 'Đoạn con'),
    'DIVISOR': ('HSG-DIVISOR', 'Đếm số ước')
}

submissions = []

for c in candidates:
    c_path = os.path.join(nopbai_dir, c)
    if not os.path.isdir(c_path):
        continue
    files = sorted(os.listdir(c_path))
    for f in files:
        f_lower = f.lower()
        matched_key = None
        for k in prob_map:
            if k.lower() in f_lower:
                matched_key = k
                break
        if not matched_key:
            continue

        prob_id, prob_name = prob_map[matched_key]
        full_f_path = os.path.join(c_path, f)
        with open(full_f_path, 'r', encoding='utf-8', errors='ignore') as fp:
            code_content = fp.read()

        lang = 'C++20' if any(f_lower.endswith(ext) for ext in ['.cpp', '.c', '.c++']) else 'Python 3'
        
        # Clean up answer code
        answer_text = code_content.strip()
        if not answer_text.startswith('['):
            answer_text = f"[{lang}]\n{answer_text}"

        sub_id = f"SUB-HSG-{c}-{matched_key}"
        sub_obj = {
            "id": sub_id,
            "submitted_at": "30/09/2026, 16:00:00",
            "student_id": c,
            "student_stt": int(c) if c.isdigit() else 0,
            "student_pin": f"sbd{c}",
            "student_name": f"Thí sinh SBD {c}",
            "class_name": "Đội tuyển HSG",
            "problem_id": prob_id,
            "problem_name": prob_name,
            "type": "essay",
            "submission_type_display": f"Code Thi HSG ({lang})",
            "answer": answer_text,
            "status": "Đã nộp",
            "score": "",
            "feedback": f"Bài thi chính thức SBD {c} - {f}"
        }
        submissions.append(sub_obj)

print(f"Extracted {len(submissions)} student submissions from TEST/NOPBAI.")

# Upload to Firebase Realtime Database
db_url = "https://webhoctap-46912-default-rtdb.asia-southeast1.firebasedatabase.app"
print(f"Uploading {len(submissions)} submissions to Firebase RTDB...")

success_count = 0
for sub in submissions:
    sub_key = urllib.parse.quote(sub['id'])
    url = f"{db_url}/submissions/{sub_key}.json"
    req = urllib.request.Request(
        url,
        data=json.dumps(sub, ensure_ascii=False).encode('utf-8'),
        headers={'Content-Type': 'application/json'},
        method='PUT'
    )
    try:
        with urllib.request.urlopen(req) as resp:
            if resp.status == 200:
                success_count += 1
    except Exception as e:
        print(f"Error uploading {sub['id']}: {e}")

print(f"Successfully uploaded {success_count}/{len(submissions)} submissions to Firebase RTDB!")
