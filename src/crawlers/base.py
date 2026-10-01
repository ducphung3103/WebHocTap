import abc
import os
import time
from typing import Optional, Set
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from src.utils.logger import get_logger

# Ensure SSLKEYLOGFILE is safe
_sslkeylogfile = os.environ.get("SSLKEYLOGFILE")
if _sslkeylogfile and not os.path.exists(os.path.dirname(_sslkeylogfile)):
    del os.environ["SSLKEYLOGFILE"]


class BaseCrawler(abc.ABC):
    """
    Base class for Online Judge crawlers.
    Provides session management, exponential backoff, rate limiting, and standard error handling.
    """

    def __init__(
        self,
        name: str,
        delay_seconds: float = 1.0,
        timeout_seconds: int = 15,
        max_retries: int = 3,
    ) -> None:
        self.name = name
        self.delay_seconds = delay_seconds
        self.timeout_seconds = timeout_seconds
        self.max_retries = max_retries
        self.logger = get_logger(f"crawler.{name.lower()}")

        self.session = requests.Session()
        retries = Retry(
            total=max_retries,
            backoff_factor=1.0,
            status_forcelist=[429, 500, 502, 503, 504],
            allowed_methods=["GET"],
        )
        adapter = HTTPAdapter(max_retries=retries)
        self.session.mount("https://", adapter)
        self.session.mount("http://", adapter)

        self.session.headers.update({
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36 (StudentProgressBot/1.0)"
            ),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
        })

    def _sleep_throttle(self) -> None:
        """Sleeps to avoid triggering rate limits / IP bans on competitive programming judges."""
        if self.delay_seconds > 0:
            time.sleep(self.delay_seconds)

    def safe_get(self, url: str, params: Optional[dict] = None) -> Optional[requests.Response]:
        """Performs a safe GET request with throttling and exception handling."""
        self._sleep_throttle()
        try:
            resp = self.session.get(url, params=params, timeout=self.timeout_seconds)
            return resp
        except requests.exceptions.Timeout:
            self.logger.warning(f"[{self.name}] Timeout requesting: {url}")
            return None
        except requests.exceptions.RequestException as exc:
            self.logger.warning(f"[{self.name}] Network error requesting {url}: {exc}")
            return None

    @abc.abstractmethod
    def get_solved_problems(self, handle: str) -> Set[str]:
        """
        Retrieves the set of problem codes solved (verdict AC / OK) by the given user handle.
        Codes must be normalized (e.g. lowercase or standard uppercase format).
        """
        pass
