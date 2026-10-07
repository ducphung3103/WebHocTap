import urllib.request
import json
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
os.environ.pop('SSLKEYLOGFILE', None)

url = 'https://webhoctap-46912-default-rtdb.asia-southeast1.firebasedatabase.app/submissions.json'
try:
    with urllib.request.urlopen(url) as resp:
        data = json.loads(resp.read().decode('utf-8'))
        if data:
            subs = list(data.values()) if isinstance(data, dict) else data
            print(f'Total submissions in Firebase: {len(subs)}')
            for s in subs:
                ans = s.get('answer', '')
                print(f"ID: {s.get('id')} | Student: {s.get('student_name')} | Prob: {s.get('problem_id')} | Type: {s.get('type') or s.get('submission_type_display')} | CodeLen: {len(ans)} | CodeStart: {repr(ans[:60])}")
        else:
            print('Firebase returned empty data or None')
except Exception as e:
    print('Error:', e)
