import re
from typing import Dict, Set
from src.crawlers.base import BaseCrawler


class LqdojCrawler(BaseCrawler):
    """
    Crawler for Le Quy Don Online Judge (lqdoj.edu.vn).
    Extracts accepted submissions using DMOJ user submissions pagination.
    """

    BASE_URL = "https://lqdoj.edu.vn"

    def __init__(self, delay_seconds: float = 1.0, timeout_seconds: int = 15, max_pages: int = 10) -> None:
        super().__init__(name="LQDOJ", delay_seconds=delay_seconds, timeout_seconds=timeout_seconds)
        self.max_pages = max_pages
        self._cache: Dict[str, Set[str]] = {}

    def get_solved_problems(self, handle: str) -> Set[str]:
        handle_clean = handle.strip()
        if not handle_clean:
            return set()

        if handle_clean in self._cache:
            return self._cache[handle_clean]

        self.logger.info(f"[LQDOJ] Fetching accepted submissions for handle: {handle_clean}")
        solved: Set[str] = set()

        for page in range(1, self.max_pages + 1):
            url = f"{self.BASE_URL}/user/{handle_clean}/submissions?status=AC&page={page}"
            resp = self.safe_get(url)

            # 404 indicates end of pagination or non-existent user
            if not resp or resp.status_code == 404:
                break

            if resp.status_code != 200:
                self.logger.warning(f"[LQDOJ] Received status {resp.status_code} on page {page} for {handle_clean}")
                break

            # Regex search for problem links: href="/problem/<problem_code>"
            found_codes = re.findall(r'href="/problem/([^"/]+)"', resp.text)
            if not found_codes:
                break

            for code in found_codes:
                clean_code = code.strip()
                solved.add(clean_code)
                solved.add(clean_code.lower())
                solved.add(clean_code.upper())
                solved.add(f"LQDOJ-{clean_code.lower()}")
                solved.add(f"LQDOJ-{clean_code.upper()}")

            # If fewer than typical items per page (typically 50), it is likely the last page
            if len(found_codes) < 20:
                break

        unique_count = len({c.lower() for c in solved if not c.startswith("lqdoj-")})
        self.logger.info(f"[LQDOJ] {handle_clean} has {unique_count} solved problems.")
        self._cache[handle_clean] = solved
        return solved
