#!/usr/bin/env python3
"""
Online Judge Progress Tracker & Synchronizer
Connects Notion/Google Sheets with Codeforces, VNOI, and LQDOJ.
"""
import argparse
import os
import sys
from pathlib import Path

# Ensure project root is in sys.path
PROJECT_ROOT = Path(__file__).resolve().parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from config.settings import get_settings
from src.core.models import Platform
from src.core.sync_service import SyncService
from src.crawlers.registry import CrawlerRegistry
from src.sheets.client import GoogleSheetsClient
from src.sheets.mock_client import MockSheetsClient
from src.utils.logger import get_logger, setup_logger


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Automated Progress Tracker for Competitive Programming Students."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Simulate the crawl and calculation without modifying Google Sheets.",
    )
    parser.add_argument(
        "--mock",
        action="store_true",
        help="Use local CSV mock sheets (templates/sheets/) instead of Google Sheets API.",
    )
    parser.add_argument(
        "--check-handle",
        nargs=2,
        metavar=("PLATFORM", "HANDLE"),
        help="Test crawl a single handle directly (e.g. --check-handle CF tourist or --check-handle VNOI TAQUAN)",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=None,
        help="Delay in seconds between requests (defaults to settings.REQUEST_DELAY_SECONDS)",
    )
    parser.add_argument(
        "-v", "--verbose",
        action="store_true",
        help="Enable DEBUG logging output.",
    )
    return parser.parse_args()


def test_single_handle(platform_str: str, handle: str, delay: float) -> None:
    logger = get_logger("main")
    platform = Platform.from_string(platform_str)
    if platform == Platform.UNKNOWN:
        logger.error(f"Unknown platform '{platform_str}'. Supported: CF, VNOI, LQDOJ.")
        sys.exit(1)

    registry = CrawlerRegistry(delay_seconds=delay)
    crawler = registry.get_crawler(platform)
    if not crawler:
        logger.error(f"No crawler registered for platform {platform}.")
        sys.exit(1)

    logger.info(f"Testing crawler for {platform.value} with handle '{handle}'...")
    solved = crawler.get_solved_problems(handle)
    clean_solved = sorted({s for s in solved if not s.startswith(f"{platform.value}-") and s.islower()})
    logger.info(f"Found {len(clean_solved)} unique solved problems:")
    logger.info(f"Sample: {clean_solved[:15]}...")


def main() -> None:
    args = parse_arguments()
    log_level = "DEBUG" if args.verbose else "INFO"
    setup_logger(level=log_level)
    logger = get_logger("main")

    settings = get_settings()
    delay = args.delay if args.delay is not None else settings.request_delay_seconds

    # Handle quick check command
    if args.check_handle:
        test_single_handle(args.check_handle[0], args.check_handle[1], delay)
        return

    # Initialize Crawler Registry
    registry = CrawlerRegistry(
        delay_seconds=delay,
        timeout_seconds=settings.request_timeout_seconds,
    )

    # Initialize Sheets Client (Mock or Google Sheets API)
    if args.mock:
        logger.info("[INIT] Running with MockSheetsClient using local CSV templates.")
        students_csv = PROJECT_ROOT / "templates" / "sheets" / "students_template.csv"
        progress_csv = PROJECT_ROOT / "templates" / "sheets" / "progress_template.csv"
        sheets_client = MockSheetsClient(
            students_csv_path=students_csv,
            progress_csv_path=progress_csv,
        )
    else:
        logger.info("[INIT] Initializing Google Sheets Client...")
        sa_dict = settings.get_service_account_dict()
        if not sa_dict:
            logger.error(
                "Google Service Account credentials not found!\n"
                "Please configure 'GOOGLE_SERVICE_ACCOUNT_FILE' (or put service_account.json in root), "
                "or set 'GCP_SA_KEY' / 'GOOGLE_SERVICE_ACCOUNT_JSON' environment variable.\n"
                "Tip: To test without Google credentials, run: python main.py --mock"
            )
            sys.exit(1)

        if not settings.spreadsheet_id:
            logger.error(
                "SPREADSHEET_ID is missing from environment variables or .env file.\n"
                "Please set SPREADSHEET_ID=<your-google-sheet-id>.\n"
                "Tip: To test without Google credentials, run: python main.py --mock"
            )
            sys.exit(1)

        sheets_client = GoogleSheetsClient(
            spreadsheet_id=settings.spreadsheet_id,
            service_account_info=sa_dict,
            students_sheet_name=settings.students_sheet_name,
            progress_sheet_name=settings.progress_sheet_name,
        )

    # Run Synchronization
    service = SyncService(
        sheets_client=sheets_client,
        crawler_registry=registry,
        dry_run=args.dry_run,
    )

    report = service.run()

    if report.errors:
        logger.warning(f"Completed with {len(report.errors)} non-fatal warnings.")
        sys.exit(0)
    else:
        logger.info("All operations completed successfully.")
        sys.exit(0)


if __name__ == "__main__":
    main()
