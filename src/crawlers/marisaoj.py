import os
import sys
import time
from typing import Dict, List, Set, Optional

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
        self._cache: Dict[str, Set[str]] = {}

    def _create_driver(self):
        from selenium import webdriver
        from selenium.webdriver.edge.options import Options

        options = Options()
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

    def crawl_students(self, handles: List[str]) -> Dict[str, Set[str]]:
        """
        Crawls a list of student handles from MarisaOJ and returns a dict:
        { handle: Set[problem_id_string] }
        """
        cleaned_handles = [h.strip() for h in handles if h and h.strip()]
        if not cleaned_handles:
            return {}

        results: Dict[str, Set[str]] = {}
        driver = None

        try:
            self.logger.info("[MarisaOJ] Initializing browser session...")
            driver = self._create_driver()

            # Warm-up session by visiting ranking page
            driver.get("https://marisaoj.com/ranking")
            time.sleep(3)

            for handle in cleaned_handles:
                url = f"https://marisaoj.com/user/{handle}/submissions"
                self.logger.info(f"[MarisaOJ] Checking submissions for {handle}...")
                driver.get(url)
                time.sleep(self.delay_seconds)

                rows = driver.find_elements("css selector", "table tbody tr, table tr")
                ac_problem_ids: Set[str] = set()

                for r in rows:
                    cells = [c.text.strip().replace("\n", " ") for c in r.find_elements("tag name", "td")]
                    if len(cells) >= 4:
                        # Find problem link in this row
                        a_tags = r.find_elements("tag name", "a")
                        prob_id = ""
                        for a in a_tags:
                            href = a.get_attribute("href") or ""
                            if "/problem/" in href:
                                prob_id = href.rstrip("/").split("/")[-1]
                                break

                        verdict = cells[-1]
                        is_ac = ("100" in verdict or "AC" in verdict or "Accepted" in verdict or "AC" in r.get_attribute("innerHTML"))

                        if prob_id and is_ac:
                            ac_problem_ids.add(prob_id)

                self.logger.info(f"[MarisaOJ] {handle} solved {len(ac_problem_ids)} problems.")
                results[handle] = ac_problem_ids

        except Exception as exc:
            self.logger.error(f"[MarisaOJ] Error while crawling: {exc}")
        finally:
            if driver:
                try:
                    driver.quit()
                except Exception:
                    pass

        return results
