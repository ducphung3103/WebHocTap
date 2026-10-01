from typing import Any, List, Set, Tuple
from src.core.models import Platform, Problem, Student, SyncReport
from src.crawlers.registry import CrawlerRegistry
from src.utils.logger import get_logger


class SyncService:
    """Orchestrates syncing student OJ submissions with Google Sheets."""

    def __init__(
        self,
        sheets_client: Any,
        crawler_registry: CrawlerRegistry,
        dry_run: bool = False,
    ) -> None:
        self.sheets_client = sheets_client
        self.registry = crawler_registry
        self.dry_run = dry_run
        self.logger = get_logger("sync_service")

    def run(self) -> SyncReport:
        report = SyncReport()
        self.logger.info("=" * 60)
        self.logger.info("STARTING SYNC: Online Judge Progress -> Google Sheets")
        if self.dry_run:
            self.logger.info("[MODE] DRY RUN ENABLED - No sheets will be modified.")
        self.logger.info("=" * 60)

        # 1. Fetch Students
        students: List[Student] = self.sheets_client.fetch_students()
        report.total_students = len(students)
        if not students:
            self.logger.warning("No students to process. Terminating sync.")
            return report

        # 2. Fetch Tracked Problems and Grid
        problems, student_row_map, existing_grid = self.sheets_client.fetch_problems_and_grid()
        report.total_problems = len(problems)
        if not problems:
            self.logger.warning("No problems tracked in Sheet 2. Terminating sync.")
            return report

        self.logger.info(f"Target: {len(students)} students across {len(problems)} tracked problems.")

        # 3. Categorize problems by platform
        problems_by_platform: dict[Platform, List[Problem]] = {
            Platform.CODEFORCES: [],
            Platform.VNOI: [],
            Platform.LQDOJ: [],
        }
        for p in problems:
            if p.platform in problems_by_platform:
                problems_by_platform[p.platform].append(p)
            else:
                self.logger.warning(f"Unrecognized platform prefix for problem '{p.raw_header}'. Skipping.")

        # 4. Process each student
        updates_to_write: List[Tuple[int, int]] = []

        for student in students:
            name_key = student.name.strip().lower()
            row_idx = student_row_map.get(name_key)
            if not row_idx:
                self.logger.warning(
                    f"Student '{student.name}' not found in Sheet 2 rows. "
                    f"Please ensure their name matches exactly in both sheets."
                )
                continue

            student_ac_count = 0

            # Loop through platforms
            for platform, plat_problems in problems_by_platform.items():
                if not plat_problems:
                    continue

                handle = student.get_handle(platform)
                if not handle:
                    continue

                crawler = self.registry.get_crawler(platform)
                if not crawler:
                    continue

                try:
                    solved_codes = crawler.get_solved_problems(handle)
                except Exception as exc:
                    err_msg = f"Error crawling {platform.value} for {student.name} ({handle}): {exc}"
                    self.logger.error(err_msg)
                    report.errors.append(err_msg)
                    continue

                # Check which tracked problems were solved
                for p in plat_problems:
                    is_solved = (
                        p.code.lower() in solved_codes
                        or p.code.upper() in solved_codes
                        or p.raw_header.lower() in solved_codes
                        or p.raw_header.upper() in solved_codes
                    )

                    if is_solved:
                        student_ac_count += 1
                        current_val = existing_grid.get((row_idx, p.column_index), "")
                        if current_val != "AC":
                            self.logger.info(
                                f"  [+] NEW AC: {student.name} solved {p.raw_header} "
                                f"(Row {row_idx}, Col {p.column_index})"
                            )
                            updates_to_write.append((row_idx, p.column_index))
                            # Update existing grid in memory
                            existing_grid[(row_idx, p.column_index)] = "AC"

            report.student_ac_counts[student.name] = student_ac_count

        # 5. Apply Updates
        report.cells_updated = len(updates_to_write)
        if self.dry_run:
            self.logger.info(f"[DRY-RUN] {len(updates_to_write)} cells would be updated to 'AC'.")
        else:
            if updates_to_write:
                self.sheets_client.batch_update_ac(updates_to_write)
                self.logger.info(f"Successfully committed {len(updates_to_write)} new AC cells.")
            else:
                self.logger.info("All sheet records are up-to-date. No new AC submissions found.")

        self.logger.info("=" * 60)
        self.logger.info("SYNC FINISHED")
        self.logger.info(f"Students processed : {report.total_students}")
        self.logger.info(f"Tracked problems   : {report.total_problems}")
        self.logger.info(f"New AC committed   : {report.cells_updated}")
        if report.errors:
            self.logger.warning(f"Errors encountered : {len(report.errors)}")
        self.logger.info("=" * 60)

        return report
