import os
import sys
import time
import json
import re
from datetime import datetime, timezone
from typing import Dict, List, Set, Optional, Tuple, Any

from src.utils.logger import get_logger

# Ensure SSLKEYLOGFILE is safe
_sslkeylogfile = os.environ.get("SSLKEYLOGFILE")
if _sslkeylogfile and not os.path.exists(os.path.dirname(_sslkeylogfile)):
    del os.environ["SSLKEYLOGFILE"]


class MarisaOJCrawler:
    """
    Crawler for MarisaOJ (marisaoj.com).
    Uses Edge with CDP options to pass Cloudflare and crawl student submissions.
    """

    def __init__(self, delay_seconds: float = 2.0, headless: bool = False) -> None:
        self.delay_seconds = delay_seconds
        self.headless = headless
        self.logger = get_logger("crawler.marisaoj")

    def _create_driver(self):
        from selenium import webdriver

        # On Linux / GitHub Actions CI, Google Chrome is preinstalled
        if sys.platform.startswith("linux"):
            from selenium.webdriver.chrome.options import Options as ChromeOptions
            options = ChromeOptions()
            options.add_argument("--headless=new")
            options.add_argument("--no-sandbox")
            options.add_argument("--disable-dev-shm-usage")
            options.add_argument("--disable-gpu")
            options.add_argument("--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36")
            options.add_argument("--disable-blink-features=AutomationControlled")
            options.add_experimental_option("excludeSwitches", ["enable-automation"])
            options.add_experimental_option("useAutomationExtension", False)
            driver = webdriver.Chrome(options=options)
            driver.execute_cdp_cmd(
                "Page.addScriptToEvaluateOnNewDocument",
                {"source": "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"}
            )
            return driver

        # On Windows/other, try Edge first, then Chrome fallback
        try:
            from selenium.webdriver.edge.options import Options as EdgeOptions
            options = EdgeOptions()
            if self.headless:
                options.add_argument("--headless=new")
            options.add_experimental_option("excludeSwitches", ["enable-automation"])
            options.add_experimental_option("useAutomationExtension", False)
            options.add_argument("--disable-blink-features=AutomationControlled")
            driver = webdriver.Edge(options=options)
            driver.execute_cdp_cmd(
                "Page.addScriptToEvaluateOnNewDocument",
                {"source": "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"}
            )
            return driver
        except Exception:
            from selenium.webdriver.chrome.options import Options as ChromeOptions
            options = ChromeOptions()
            if self.headless:
                options.add_argument("--headless=new")
            options.add_argument("--no-sandbox")
            options.add_argument("--disable-dev-shm-usage")
            options.add_argument("--disable-blink-features=AutomationControlled")
            driver = webdriver.Chrome(options=options)
            driver.execute_cdp_cmd(
                "Page.addScriptToEvaluateOnNewDocument",
                {"source": "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"}
            )
            return driver

    def crawl_user(self, handle: str, driver=None) -> Tuple[Set[str], Dict[str, Dict[str, int]]]:
        """
        Crawls a single handle's submissions page and returns:
        (solved_problems_set, activity_map)
        where solved_problems_set contains IDs like 'MARISA-1'.
        """
        handle = handle.strip()
        if not handle:
            return set(), {}

        own_driver = False
        if driver is None:
            driver = self._create_driver()
            own_driver = True

        solved_problems: Set[str] = set()
        activity: Dict[str, Dict[str, int]] = {}
        now = datetime.now()

        try:
            url = f"https://marisaoj.com/user/{handle}/submissions"
            self.logger.info(f"[MarisaOJ] Crawling submissions for '{handle}' at {url}...")
            driver.get(url)
            time.sleep(self.delay_seconds)

            if "Just a moment" in driver.title:
                self.logger.info("[MarisaOJ] Cloudflare challenge detected, waiting 4s...")
                time.sleep(4)

            html = driver.page_source
            tr_blocks = re.findall(r'<tr>(.*?)</tr>', html, re.DOTALL)

            for tr in tr_blocks:
                prob_m = re.search(r'href=["\']/problem/(\d+)["\']', tr)
                if not prob_m:
                    continue
                prob_id = f"MARISA-{prob_m.group(1)}"

                date_m = re.search(r'(\d{2})/(\d{2})/(\d{4})', tr)
                if date_m:
                    day, month, year = date_m.group(1), date_m.group(2), date_m.group(3)
                    iso_date = f"{year}-{month}-{day}"
                else:
                    iso_date = now.strftime("%Y-%m-%d")

                is_ac = ('class="AC"' in tr or "class='AC'" in tr or 'class="ac"' in tr.lower())

                if iso_date not in activity:
                    activity[iso_date] = {"total": 0, "ac": 0}
                activity[iso_date]["total"] += 1

                if is_ac:
                    activity[iso_date]["ac"] += 1
                    solved_problems.add(prob_id)

            self.logger.info(f"[MarisaOJ] Found {len(solved_problems)} AC problems for '{handle}'.")

        except Exception as exc:
            self.logger.error(f"[MarisaOJ] Error crawling handle '{handle}': {exc}")
        finally:
            if own_driver and driver:
                try:
                    driver.quit()
                except Exception:
                    pass

        return solved_problems, activity

    def crawl_students(self, handles: List[str]) -> Dict[str, Set[str]]:
        """
        Legacy compatibility method: crawls a list of student handles
        and returns { handle: Set[problem_id] }.
        """
        results: Dict[str, Set[str]] = {}
        cleaned = [h.strip() for h in handles if h and h.strip()]
        if not cleaned:
            return results

        driver = None
        try:
            driver = self._create_driver()
            for h in cleaned:
                solved, _ = self.crawl_user(h, driver=driver)
                results[h] = solved
        finally:
            if driver:
                try:
                    driver.quit()
                except Exception:
                    pass

        return results


def sync_all_marisaoj(json_path: str = "docs/data.json", delay: float = 2.5) -> bool:
    """
    Utility function to crawl all students with a MarisaOJ handle in docs/data.json
    and update their solved problems, activity, and stats.
    """
    sys.stdout.reconfigure(encoding='utf-8')
    if not os.path.exists(json_path):
        print(f"❌ File {json_path} không tồn tại!")
        return False

    with open(json_path, "r", encoding="utf-8") as f:
        app_data = json.load(f)

    students = app_data.get("students", [])
    marisa_students = [s for s in students if s.get("marisa_handle", "").strip()]

    print(f"📡 Tìm thấy {len(marisa_students)} học sinh có tài khoản MarisaOJ.")
    if not marisa_students:
        return True

    crawler = MarisaOJCrawler(delay_seconds=delay, headless=False)
    driver = crawler._create_driver()
    now = datetime.now()

    try:
        for s in marisa_students:
            handle = s["marisa_handle"].strip()
            print(f"  -> Đang quét học sinh: {s['name']} (handle: {handle})...")
            new_solved, page_activity = crawler.crawl_user(handle, driver=driver)

            # Preserve past solved problems and merge new
            solved_set = set(s.get("solved", [])) | new_solved
            activity_map = dict(s.get("activity", {}))

            # Merge page activity using max to avoid multiplier accumulation
            for d_str, v in page_activity.items():
                if d_str not in activity_map:
                    activity_map[d_str] = v
                else:
                    activity_map[d_str]["total"] = max(activity_map[d_str].get("total", 0), v.get("total", 0))
                    activity_map[d_str]["ac"] = max(activity_map[d_str].get("ac", 0), v.get("ac", 0))

            # Calculate stats with strict logical caps
            ac_week = 0
            ac_month = 0
            ac_year = 0
            for d_str, v in activity_map.items():
                try:
                    d_obj = datetime.strptime(d_str, "%Y-%m-%d")
                    diff = (now - d_obj).days
                    ac_cnt = v.get("ac", 0)
                    if diff <= 7:
                        ac_week += ac_cnt
                    if diff <= 30:
                        ac_month += ac_cnt
                    if d_obj.year == now.year:
                        ac_year += ac_cnt
                except Exception:
                    pass

            total_ac = len(solved_set)
            stats_year = min(ac_year, total_ac)
            stats_month = min(ac_month, stats_year)
            stats_week = min(ac_week, stats_month)

            s["solved"] = sorted(list(solved_set))
            s["total_solved_count"] = total_ac
            s["activity"] = activity_map
            s["stats"] = {
                "week": stats_week,
                "month": stats_month,
                "year": stats_year,
                "total": total_ac
            }

            # Update target solved homework
            cls_prob_ids = app_data.get("class_config", {}).get(s.get("class", "C++"), {}).get("problem_ids", [])
            s["target_solved"] = [pid for pid in cls_prob_ids if pid in solved_set]
            s["target_solved_count"] = len(s["target_solved"])
            s["target_class_total"] = len(cls_prob_ids) if cls_prob_ids else 8

            print(f"     ✅ Tổng AC: {total_ac}, Bài tập lớp: {s['target_solved_count']}/{s['target_class_total']}, Stats: {s['stats']}")

    finally:
        driver.quit()

    app_data["last_updated"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(app_data, f, ensure_ascii=False, indent=2)

    print(f"\n🎉 [HOÀN TẤT] Đã đồng bộ tất cả bài tập MarisaOJ vào {json_path}!")
    return True


if __name__ == "__main__":
    sync_all_marisaoj()
