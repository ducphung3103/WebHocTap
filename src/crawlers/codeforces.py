from typing import Dict, Set
from src.crawlers.base import BaseCrawler


class CodeforcesCrawler(BaseCrawler):
    """Crawler for Codeforces using their official public REST API."""

    API_URL = "https://codeforces.com/api/user.status"

    def __init__(self, delay_seconds: float = 1.0, timeout_seconds: int = 15) -> None:
        super().__init__(name="Codeforces", delay_seconds=delay_seconds, timeout_seconds=timeout_seconds)
        self._cache: Dict[str, Set[str]] = {}

    def get_solved_problems(self, handle: str) -> Set[str]:
        handle_clean = handle.strip()
        if not handle_clean:
            return set()

        if handle_clean in self._cache:
            return self._cache[handle_clean]

        self.logger.info(f"[Codeforces] Fetching submissions for handle: {handle_clean}")
        params = {
            "handle": handle_clean,
            "from": 1,
            "count": 5000,
        }

        resp = self.safe_get(self.API_URL, params=params)
        if not resp:
            self.logger.error(f"[Codeforces] Failed to connect to API for {handle_clean}")
            return set()

        if resp.status_code == 400:
            self.logger.warning(f"[Codeforces] Handle not found: {handle_clean}")
            return set()

        if resp.status_code != 200:
            self.logger.warning(f"[Codeforces] API returned status {resp.status_code} for {handle_clean}")
            return set()

        try:
            data = resp.json()
        except Exception as exc:
            self.logger.error(f"[Codeforces] Failed to parse JSON response for {handle_clean}: {exc}")
            return set()

        if data.get("status") != "OK":
            comment = data.get("comment", "Unknown API error")
            self.logger.warning(f"[Codeforces] API error for {handle_clean}: {comment}")
            return set()

        solved: Set[str] = set()
        for sub in data.get("result", []):
            if sub.get("verdict") == "OK":
                prob = sub.get("problem", {})
                contest_id = prob.get("contestId")
                index = prob.get("index")
                if contest_id is not None and index:
                    code = f"{contest_id}{index}".strip()
                    # Store multiple variations for flexible matching
                    solved.add(code.upper())
                    solved.add(code.lower())
                    solved.add(f"CF-{code.upper()}")

        self.logger.info(f"[Codeforces] {handle_clean} has {len(solved) // 3} solved problems.")
        self._cache[handle_clean] = solved
        return solved
