import os
import sys
import json
import time
import urllib.request
import urllib.parse
import re
from datetime import datetime

os.environ.pop('SSLKEYLOGFILE', None)
sys.stdout.reconfigure(encoding='utf-8')

_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

with open(os.path.join(_PROJECT_ROOT, 'data_firebase_backup.json'), encoding='utf-8') as f:
    backup_data = json.load(f)

students = backup_data.get('students', [])
print(f"Tổng số học sinh: {len(students)}")
for s in students:
    stt = s.get('stt')
    name = s.get('name')
    cls = s.get('class')
    solved = s.get('solved', [])
    print(f"[{stt}] {name} ({cls}): {len(solved)} bài đã giải | CF: '{s.get('cf_handle')}', VJ: '{s.get('vjudge_handle')}', VNOI: '{s.get('vnoi_handle')}', Marisa: '{s.get('marisa_handle')}', Clue: '{s.get('clue_handle')}'")
