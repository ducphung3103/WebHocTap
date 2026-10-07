import os
import sys
import time
import json
import re

os.environ.pop('SSLKEYLOGFILE', None)
sys.stdout.reconfigure(encoding='utf-8', line_buffering=True)

_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _PROJECT_ROOT not in sys.path:
    sys.path.insert(0, _PROJECT_ROOT)

from selenium import webdriver
from selenium.webdriver.edge.options import Options as EdgeOptions
from selenium.webdriver.common.action_chains import ActionChains

options = EdgeOptions()
options.add_experimental_option("excludeSwitches", ["enable-automation"])
options.add_experimental_option("useAutomationExtension", False)
options.add_argument("--disable-blink-features=AutomationControlled")

driver = webdriver.Edge(options=options)
driver.execute_cdp_cmd(
    "Page.addScriptToEvaluateOnNewDocument",
    {"source": "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"}
)

def wait_and_pass_turnstile(max_wait=30):
    if "Just a moment" not in driver.title and driver.title:
        return True
    print("  [Cloudflare] Đang chờ xác minh bảo mật (Turnstile)...")
    for sec in range(1, max_wait + 1):
        time.sleep(1)
        if "Just a moment" not in driver.title and driver.title:
            print(f"  🎉 Đã qua Cloudflare ở giây thứ {sec}! Title: {driver.title}")
            return True
            
        # Thử tự động click ở giây thứ 8 và 14
        if sec in (8, 14):
            try:
                dpr = driver.execute_script("return window.devicePixelRatio || 1")
                css_x = int(109 / dpr)
                css_y = int(420 / dpr)
                print(f"  [Cloudflare] Thử click tự động tại ({css_x}, {css_y})...")
                ac = ActionChains(driver)
                body = driver.find_element("tag name", "body")
                ac.move_to_element_with_offset(body, css_x, css_y).click().perform()
            except Exception:
                pass

        if sec % 3 == 0:
            print(f"  [{sec}s] Chờ Cloudflare duyệt... Title: '{driver.title}'")

    return "Just a moment" not in driver.title and driver.title

# Load students
backup_file = os.path.join(_PROJECT_ROOT, "data_firebase_backup.json")
with open(backup_file, encoding="utf-8") as f:
    backup_data = json.load(f)

students = backup_data.get("students", [])
marisa_students = [s for s in students if s.get("marisa_handle", "").strip()]

extra_file = os.path.join(_PROJECT_ROOT, "scripts", "crawled_marisa_extra.json")
extra_data = {}
if os.path.exists(extra_file):
    try:
        with open(extra_file, "r", encoding="utf-8") as f_ex:
            extra_data = json.load(f_ex)
    except Exception:
        pass

# Đảm bảo dphatdzvl có 66 bài
dp_file = os.path.join(_PROJECT_ROOT, "marisa_full_dphatdzvl.json")
if os.path.exists(dp_file):
    try:
        with open(dp_file, "r", encoding="utf-8") as f_dp:
            dp_obj = json.load(f_dp)
            extra_data["dphatdzvl"] = dp_obj.get("solved", [])
    except Exception:
        pass

try:
    print("=" * 65)
    print("🚀 BẮT ĐẦU CÀO TOÀN DIỆN CÁC TRANG BÀI NỘP MARISAOJ CHO TẤT CẢ HỌC SINH")
    print("=" * 65)
    
    first_url = "https://marisaoj.com/user/dphatdzvl/submissions"
    print(f"Mở trình duyệt: {first_url}...")
    driver.get(first_url)
    
    if not wait_and_pass_turnstile(max_wait=25):
        print("⚠️ Chưa vượt qua được Cloudflare tự động.")
    else:
        print("✅ Đã vượt qua Cloudflare thành công!")

    for s in marisa_students:
        handle = s["marisa_handle"].strip()
        name = s["name"]
        stt = s.get("stt")
        
        print(f"\n-------------------------------------------------------")
        print(f"🔍 [STT {stt}] {name} (handle: '{handle}'):")
        
        # Nếu là dphatdzvl, đã quét đủ 66 bài ở 4 trang
        if handle == "dphatdzvl" and len(extra_data.get("dphatdzvl", [])) >= 66:
            print(f"  • Đã có đầy đủ 66 bài AC xác thực (4 trang) -> Bỏ qua.")
            continue
            
        all_solved = set(extra_data.get(handle, []))
        total_subs = 0
        page = 1
        
        while page <= 50:
            page_url = f"https://marisaoj.com/user/{handle}/submissions/{page}"
            driver.get(page_url)
            time.sleep(1.2)
            
            if "Just a moment" in driver.title:
                wait_and_pass_turnstile(max_wait=15)
                
            html = driver.page_source
            tr_blocks = re.findall(r'<tr>(.*?)</tr>', html, re.DOTALL)
            
            subs_on_page = 0
            ac_on_page = 0
            for tr in tr_blocks:
                prob_m = re.search(r'href=[\'"]/problem/(\d+)[\'"]', tr)
                if not prob_m:
                    continue
                subs_on_page += 1
                total_subs += 1
                pid = prob_m.group(1)

                is_ac = ('class="AC"' in tr or "class='AC'" in tr or 'class="ac"' in tr.lower() or 'score_100' in tr.lower())
                if is_ac:
                    ac_on_page += 1
                    all_solved.add(f"MARISA-{pid}")

            if subs_on_page == 0:
                print(f"  • Trang {page}: 0 bài nộp -> Kết thúc.")
                break

            print(f"  • Trang {page}: {subs_on_page} bài nộp ({ac_on_page} AC) -> Tích lũy: {len(all_solved)} bài AC.")

            next_button = f'/user/{handle}/submissions/{page + 1}'
            if next_button not in html:
                print(f"  • Không còn trang tiếp theo -> Hoàn tất.")
                break

            page += 1

        print(f"  => TỔNG KẾT '{handle}': {total_subs} lần nộp, {len(all_solved)} bài AC duy nhất!")
        extra_data[handle] = sorted(list(all_solved))
        
        with open(extra_file, "w", encoding="utf-8") as f_ex:
            json.dump(extra_data, f_ex, ensure_ascii=False, indent=2)

    print("\n🎉 ĐÃ CẬP NHẬT XONG TOÀN BỘ MARISAOJ CHO TẤT CẢ HỌC SINH!")

finally:
    try:
        driver.quit()
    except Exception:
        pass

# Tự động tính toán lại và đồng bộ Firebase
print("\n" + "=" * 65)
print("🚀 ĐỒNG BỘ TOÀN BỘ DỮ LIỆU LÊN FIREBASE REALTIME DATABASE...")
print("=" * 65)

from scripts.recalculate_all_students import run_recalc
run_recalc()
