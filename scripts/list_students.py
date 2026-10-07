import urllib.request
import json
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
os.environ.pop('SSLKEYLOGFILE', None)

url = 'https://webhoctap-46912-default-rtdb.asia-southeast1.firebasedatabase.app/students.json'
with urllib.request.urlopen(url) as resp:
    students = json.loads(resp.read().decode('utf-8'))
    print(f'Total students in Firebase: {len(students)}')
    for s in students:
        print(f"STT {s.get('stt')}: {s.get('name')} | Class: {s.get('class')}")
