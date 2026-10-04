import urllib.request
import re
import sys
import os

sys.stdout.reconfigure(encoding='utf-8')
os.environ.pop('SSLKEYLOGFILE', None)

docs = [
    ('Row 2', '1vX6b2B-TsjZ7lNSXxAUzVZBSEyQ2mApWNQN6jzk1lGI'),
    ('Row 3', '1t-9f0PrWfJmzZFNirfAbshOjcQksc9OiflD9XCFATSw'),
    ('Row 4', '1P5lW-q-zpx8nrVW-vj_T4wDyI0HzDgnXhLsx2GQl-_c')
]

for label, doc_id in docs:
    url = f"https://docs.google.com/document/d/{doc_id}/export?format=txt"
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req) as resp:
        txt = resp.read().decode('utf-8')
    
    print(f"================ {label} ({doc_id}) ================")
    # Extract links
    raw_links = re.findall(r'https?://[^\s\)]+', txt)
    oj_links = []
    video_links = []
    for l in raw_links:
        l = l.rstrip('.,;:"\'')
        if any(x in l for x in ['marisaoj', 'vjudge', 'codeforces', 'luyencode', 'chuyentin', 'clue', 'vnoi', 'cses', 'atcoder']):
            oj_links.append(l)
        elif any(x in l for x in ['youtu.be', 'youtube.com']):
            video_links.append(l)
            
    print(f"Total OJ Problem links: {len(oj_links)} (Unique: {len(set(oj_links))})")
    for l in sorted(list(set(oj_links)))[:20]:
        print("   [OJ]", l)
        
    print(f"Total Video/Record links: {len(video_links)} (Unique: {len(set(video_links))})")
    for v in list(set(video_links))[:10]:
        print("   [VIDEO]", v)
        
    lines = [l.strip() for l in txt.splitlines() if l.strip()]
    print(f"\nTotal lines: {len(lines)}")
    # Find potential section headings
    print("Potential Headings / Chapters:")
    for line in lines:
        if any(line.lower().startswith(p) for p in ['buổi', 'tuần', 'chương', 'chuyên đề', 'phần', 'record:']):
            print("   ->", line[:80])
    print("\n")
