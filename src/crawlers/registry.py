from typing import Dict, Optional
from src.core.models import Platform
from src.crawlers.base import BaseCrawler
from src.crawlers.codeforces import CodeforcesCrawler
from src.crawlers.vnoi import VnoiCrawler
from src.crawlers.lqdoj import LqdojCrawler


class CrawlerRegistry:
    """Registry and factory for platform crawlers."""

    def __init__(self, delay_seconds: float = 1.0, timeout_seconds: int = 15) -> None:
        self.crawlers: Dict[Platform, BaseCrawler] = {
            Platform.CODEFORCES: CodeforcesCrawler(delay_seconds=delay_seconds, timeout_seconds=timeout_seconds),
            Platform.VNOI: VnoiCrawler(delay_seconds=delay_seconds, timeout_seconds=timeout_seconds),
            Platform.LQDOJ: LqdojCrawler(delay_seconds=delay_seconds, timeout_seconds=timeout_seconds),
        }

    def get_crawler(self, platform: Platform) -> Optional[BaseCrawler]:
        return self.crawlers.get(platform)

    def register(self, platform: Platform, crawler: BaseCrawler) -> None:
        self.crawlers[platform] = crawler
