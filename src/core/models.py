from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional, Set


class Platform(str, Enum):
    CODEFORCES = "CF"
    VNOI = "VNOI"
    LQDOJ = "LQDOJ"
    UNKNOWN = "UNKNOWN"

    @classmethod
    def from_string(cls, val: str) -> "Platform":
        val_clean = val.strip().upper()
        if "CODEFORCES" in val_clean or val_clean == "CF":
            return cls.CODEFORCES
        if "VNOI" in val_clean:
            return cls.VNOI
        if "LQDOJ" in val_clean:
            return cls.LQDOJ
        return cls.UNKNOWN


@dataclass
class Problem:
    """Represents a competitive programming problem tracked in Sheet 2."""
    raw_header: str
    platform: Platform
    code: str
    column_index: int  # 1-indexed for Sheets

    @classmethod
    def parse_header(cls, header: str, col_idx: int) -> "Problem":
        clean = header.strip()
        # Common patterns: CF-71A, VNOI-nklineup, LQDOJ-cses1617
        if "-" in clean:
            prefix, code = clean.split("-", 1)
            plat = Platform.from_string(prefix)
            if plat != Platform.UNKNOWN:
                return cls(raw_header=clean, platform=plat, code=code.strip(), column_index=col_idx)

        # Alternative colon pattern: CF:71A, vnoi:nklineup
        if ":" in clean:
            prefix, code = clean.split(":", 1)
            plat = Platform.from_string(prefix)
            if plat != Platform.UNKNOWN:
                return cls(raw_header=clean, platform=plat, code=code.strip(), column_index=col_idx)

        # Fallback: check prefix directly
        lower = clean.lower()
        if lower.startswith("cf_") or lower.startswith("cf"):
            return cls(raw_header=clean, platform=Platform.CODEFORCES, code=clean[2:].lstrip("-_"), column_index=col_idx)
        if lower.startswith("vnoi_") or lower.startswith("vnoi"):
            return cls(raw_header=clean, platform=Platform.VNOI, code=clean[4:].lstrip("-_"), column_index=col_idx)
        if lower.startswith("lqdoj_") or lower.startswith("lqdoj"):
            return cls(raw_header=clean, platform=Platform.LQDOJ, code=clean[5:].lstrip("-_"), column_index=col_idx)

        # Default fallback: unknown platform, keep code
        return cls(raw_header=clean, platform=Platform.UNKNOWN, code=clean, column_index=col_idx)


@dataclass
class Student:
    """Represents a student enrolled in the class."""
    stt: int
    name: str
    email: str
    cf_handle: str = ""
    vnoi_handle: str = ""
    clue_handle: str = ""
    ctoj_handle: str = ""
    lqdoj_handle: str = ""
    row_index: int = 0  # Row index in Sheet 2 (2-indexed or determined dynamically)
    status: str = "Active"

    def get_handle(self, platform: Platform) -> str:
        if platform == Platform.CODEFORCES:
            return self.cf_handle.strip()
        if platform == Platform.VNOI:
            return self.vnoi_handle.strip()
        if platform == Platform.LQDOJ:
            return self.lqdoj_handle.strip()
        return ""


@dataclass
class SyncReport:
    """Aggregated stats after a sync run."""
    total_students: int = 0
    total_problems: int = 0
    cells_updated: int = 0
    errors: List[str] = field(default_factory=list)
    student_ac_counts: Dict[str, int] = field(default_factory=dict)
