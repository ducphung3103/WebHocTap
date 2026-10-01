from typing import Any, Dict, List, Optional, Tuple
import gspread
from google.oauth2.service_account import Credentials

from src.core.models import Problem, Student
from src.utils.logger import get_logger


class GoogleSheetsClient:
    """Client for reading student lists and updating exercise progress in Google Sheets."""

    SCOPES = [
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive",
    ]

    def __init__(
        self,
        spreadsheet_id: str,
        service_account_info: Dict[str, Any],
        students_sheet_name: str = "Danh sách Học sinh",
        progress_sheet_name: str = "Theo dõi Bài tập",
    ) -> None:
        self.spreadsheet_id = spreadsheet_id
        self.service_account_info = service_account_info
        self.students_sheet_name = students_sheet_name
        self.progress_sheet_name = progress_sheet_name
        self.logger = get_logger("sheets_client")

        self.client: Optional[gspread.Client] = None
        self.spreadsheet: Optional[gspread.Spreadsheet] = None

    def connect(self) -> None:
        """Authenticates with Google Sheets API using Service Account credentials."""
        self.logger.info("Connecting to Google Sheets API...")
        credentials = Credentials.from_service_account_info(
            self.service_account_info,
            scopes=self.SCOPES,
        )
        self.client = gspread.authorize(credentials)
        self.spreadsheet = self.client.open_by_key(self.spreadsheet_id)
        self.logger.info(f"Connected successfully to spreadsheet: '{self.spreadsheet.title}'")

    def fetch_students(self) -> List[Student]:
        """
        Reads Sheet 1 ('Danh sách Học sinh') and parses student metadata.
        Expected columns: STT, Họ Tên, Email, Codeforces Handle, VNOI Handle, LQDOJ Handle.
        """
        if not self.spreadsheet:
            self.connect()

        sheet = self.spreadsheet.worksheet(self.students_sheet_name)
        rows = sheet.get_all_values()
        if not rows or len(rows) < 2:
            self.logger.warning(f"No student data found in sheet '{self.students_sheet_name}'")
            return []

        header = [h.strip().lower() for h in rows[0]]
        # Find column indexes
        def find_idx(keywords: List[str]) -> int:
            for i, h in enumerate(header):
                if any(k in h for k in keywords):
                    return i
            return -1

        stt_idx = find_idx(["stt", "no", "id"])
        name_idx = find_idx(["họ tên", "tên", "name"])
        email_idx = find_idx(["email"])
        cf_idx = find_idx(["codeforces", "cf"])
        vnoi_idx = find_idx(["vnoi"])
        lqdoj_idx = find_idx(["lqdoj", "lqd"])

        students: List[Student] = []
        for r_idx, row in enumerate(rows[1:], start=2):
            if not row or (name_idx != -1 and not row[name_idx].strip()):
                continue

            stt = int(row[stt_idx].strip()) if stt_idx != -1 and row[stt_idx].strip().isdigit() else len(students) + 1
            name = row[name_idx].strip() if name_idx != -1 and name_idx < len(row) else f"Học sinh {stt}"
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

        self.logger.info(f"Loaded {len(students)} students from '{self.students_sheet_name}'.")
        return students

    def fetch_problems_and_grid(self) -> Tuple[List[Problem], Dict[str, int], Dict[Tuple[int, int], str]]:
        """
        Reads Sheet 2 ('Theo dõi Bài tập').
        Returns:
        1. List of Problem instances (from header columns starting at column 3)
        2. Mapping from student Name/STT to row index (1-indexed)
        3. Existing cell values: (row_idx, col_idx) -> status ("AC", "", etc.)
        """
        if not self.spreadsheet:
            self.connect()

        sheet = self.spreadsheet.worksheet(self.progress_sheet_name)
        rows = sheet.get_all_values()
        if not rows:
            return [], {}, {}

        header_row = rows[0]
        problems: List[Problem] = []

        # Find where problem columns begin (typically col index >= 3, after STT and Name)
        # We parse each header cell
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
            # Assume col 2 is name, or col 1 is name if only 1 col before problems
            name = row[1].strip() if len(row) > 1 and row[1].strip() else row[0].strip()
            if name:
                student_row_map[name.lower()] = r_idx

            for c_idx, val in enumerate(row, start=1):
                existing_grid[(r_idx, c_idx)] = val.strip()

        self.logger.info(f"Loaded {len(problems)} tracked problems from '{self.progress_sheet_name}'.")
        return problems, student_row_map, existing_grid

    def batch_update_ac(self, updates: List[Tuple[int, int]]) -> int:
        """
        Updates given (row, col) coordinates to 'AC' in a single API batch request.
        """
        if not updates:
            self.logger.info("No new AC updates to write.")
            return 0

        if not self.spreadsheet:
            self.connect()

        sheet = self.spreadsheet.worksheet(self.progress_sheet_name)
        data_to_update = []
        for row, col in updates:
            a1_cell = gspread.utils.rowcol_to_a1(row, col)
            data_to_update.append({"range": a1_cell, "values": [["AC"]]})

        self.logger.info(f"Sending batch update of {len(data_to_update)} cells to Google Sheets...")
        sheet.batch_update(data_to_update)
        self.logger.info("Batch update completed successfully.")
        return len(data_to_update)
