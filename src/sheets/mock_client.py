import csv
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from src.core.models import Problem, Student
from src.utils.logger import get_logger


class MockSheetsClient:
    """Mock sheets client that operates on local CSV files for offline testing and dry runs."""

    def __init__(
        self,
        students_csv_path: Path,
        progress_csv_path: Path,
    ) -> None:
        self.students_csv_path = students_csv_path
        self.progress_csv_path = progress_csv_path
        self.logger = get_logger("mock_sheets")

    def connect(self) -> None:
        self.logger.info(f"[Mock] Connected using local CSVs: {self.students_csv_path.name}, {self.progress_csv_path.name}")

    def fetch_students(self) -> List[Student]:
        if not self.students_csv_path.exists():
            self.logger.warning(f"[Mock] Students file not found: {self.students_csv_path}")
            return []

        students: List[Student] = []
        with open(self.students_csv_path, mode="r", encoding="utf-8") as f:
            reader = csv.reader(f)
            rows = list(reader)

        if len(rows) < 2:
            return []

        header = [h.strip().lower() for h in rows[0]]
        def find_idx(keywords: List[str]) -> int:
            for i, h in enumerate(header):
                if any(k in h for k in keywords):
                    return i
            return -1

        stt_idx = find_idx(["stt", "no"])
        name_idx = find_idx(["họ tên", "tên", "name"])
        email_idx = find_idx(["email"])
        cf_idx = find_idx(["codeforces", "cf"])
        vnoi_idx = find_idx(["vnoi"])
        lqdoj_idx = find_idx(["lqdoj", "lqd"])

        for r_idx, row in enumerate(rows[1:], start=2):
            if not row or not any(row):
                continue
            name = row[name_idx].strip() if name_idx != -1 and name_idx < len(row) else ""
            if not name:
                continue

            stt = int(row[stt_idx].strip()) if stt_idx != -1 and row[stt_idx].strip().isdigit() else len(students) + 1
            email = row[email_idx].strip() if email_idx != -1 and email_idx < len(row) else ""
            cf = row[cf_idx].strip() if cf_idx != -1 and cf_idx < len(row) else ""
            vnoi = row[vnoi_idx].strip() if vnoi_idx != -1 and vnoi_idx < len(row) else ""
            lqdoj = row[lqdoj_idx].strip() if lqdoj_idx != -1 and lqdoj_idx < len(row) else ""

            students.append(
                Student(
                    stt=stt,
                    name=name,
                    email=email,
                    cf_handle=cf,
                    vnoi_handle=vnoi,
                    lqdoj_handle=lqdoj,
                )
            )

        self.logger.info(f"[Mock] Loaded {len(students)} students from local CSV.")
        return students

    def fetch_problems_and_grid(self) -> Tuple[List[Problem], Dict[str, int], Dict[Tuple[int, int], str]]:
        if not self.progress_csv_path.exists():
            self.logger.warning(f"[Mock] Progress file not found: {self.progress_csv_path}")
            return [], {}, {}

        with open(self.progress_csv_path, mode="r", encoding="utf-8") as f:
            reader = csv.reader(f)
            rows = list(reader)

        if not rows:
            return [], {}, {}

        header_row = rows[0]
        problems: List[Problem] = []

        for c_idx, cell in enumerate(header_row, start=1):
            cell_clean = cell.strip()
            if not cell_clean:
                continue
            lower = cell_clean.lower()
            if any(lower == x for x in ["stt", "no", "họ tên", "tên", "email", "handles"]):
                continue
            problems.append(Problem.parse_header(cell_clean, c_idx))

        student_row_map: Dict[str, int] = {}
        existing_grid: Dict[Tuple[int, int], str] = {}

        for r_idx, row in enumerate(rows[1:], start=2):
            if not row:
                continue
            name = row[1].strip() if len(row) > 1 and row[1].strip() else row[0].strip()
            if name:
                student_row_map[name.lower()] = r_idx

            for c_idx, val in enumerate(row, start=1):
                existing_grid[(r_idx, c_idx)] = val.strip()

        self.logger.info(f"[Mock] Loaded {len(problems)} tracked problems from local CSV.")
        return problems, student_row_map, existing_grid

    def batch_update_ac(self, updates: List[Tuple[int, int]]) -> int:
        if not updates:
            self.logger.info("[Mock] No new AC updates to write.")
            return 0

        # Read existing CSV
        with open(self.progress_csv_path, mode="r", encoding="utf-8") as f:
            reader = csv.reader(f)
            rows = list(reader)

        # Apply updates
        for r_idx, c_idx in updates:
            # 1-indexed to 0-indexed
            r_0 = r_idx - 1
            c_0 = c_idx - 1
            while len(rows) <= r_0:
                rows.append([])
            while len(rows[r_0]) <= c_0:
                rows[r_0].append("")
            rows[r_0][c_0] = "AC"

        # Write back
        with open(self.progress_csv_path, mode="w", encoding="utf-8", newline="") as f:
            writer = csv.writer(f)
            writer.writerows(rows)

        self.logger.info(f"[Mock] Wrote {len(updates)} 'AC' cells to {self.progress_csv_path.name}.")
        return len(updates)
