import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

d = json.load(open('docs/data.json', encoding='utf-8'))
print('Number of problems:', len(d.get('problems', [])))
for p in d.get('problems', []):
    print(f"{p.get('id')}: {p.get('name')} | Plat: {p.get('platform')} | Classes: {p.get('classes')}")

print('\nNumber of grader_problems:', len(d.get('grader_problems', [])))
for p in d.get('grader_problems', []):
    print(f"{p.get('id')}: {p.get('name')} | Tests: {len(p.get('testcases', []))}")
