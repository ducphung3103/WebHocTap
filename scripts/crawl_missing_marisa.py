import os
import sys
import time
import json
import re
from datetime import datetime

os.environ.pop('SSLKEYLOGFILE', None)
sys.stdout.reconfigure(encoding='utf-8')

_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

from selenium import webdriver
from selenium.webdriver.edge.options import Options as EdgeOptions

options = EdgeOptions()
options.add_experimental_option("excludeSwitches", ["enable-automation"])
options.add_experimental_option("useAutomationExtension", False)
options.add_argument("--disable-blink-features=AutomationControlled")

driver = webdriver.Edge(options=options)
driver.execute_cdp_cmd(
    "Page.addScriptToEvaluateOnNewDocument",
    {"source": "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"}
)

handles_to_check = ['za_pobeda', 'dungle120', 'Finn_213', 'hnhung', 'Thienkim0316', 'ducdacoder3103']
results = {}

try:
    # First, load 1 page and wait for Turnstile to clear
    driver.get(f"https://marisaoj.com/user/{handles_to_check[0]}/submissions")
    print("Initial title:", driver.title)
    for i in range(15):
        time.sleep(1)
        if driver.title and "Just a moment" not in driver.title and "Cloudflare" not in driver.title:
            print(f"Passed Cloudflare in {i+1}s! Title: {driver.title}")
            break
        print(f"[{i+1}s] Waiting... Title: {driver.title}")

    for h in handles_to_check:
        url = f"https://marisaoj.com/user/{h}/submissions"
        print(f"\nCrawling MarisaOJ for '{h}'...")
        driver.get(url)
        time.sleep(2.5)
        if "Just a moment" in driver.title:
            print(f"  Waiting for challenge on {h}...")
            time.sleep(5)
        
        html = driver.page_source
        tr_blocks = re.findall(r'<tr>(.*?)</tr>', html, re.DOTALL)
        solved_ac = set()
        for tr in tr_blocks:
            prob_m = re.search(r'href=["\']/problem/(\d+)["\']', tr)
            if not prob_m:
                continue
            is_ac = ('class="AC"' in tr or "class='AC'" in tr or 'class="ac"' in tr.lower())
            if is_ac:
                solved_ac.add(f"MARISA-{prob_m.group(1)}")
        
        print(f"  Handle {h}: found {len(solved_ac)} AC problems: {list(solved_ac)[:10]}")
        results[h] = sorted(list(solved_ac))

    with open(os.path.join(_PROJECT_ROOT, 'scripts', 'crawled_marisa_extra.json'), 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print("\n✅ Successfully crawled and saved MarisaOJ extra data!")

finally:
    driver.quit()
