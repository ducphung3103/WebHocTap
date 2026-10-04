"""
Format Google Sheets tables for 'Bài Tập' and 'Bài Giảng':
1. Expands Google Sheets Table / BandedRange to cover all data rows.
2. Applies consistent table styling matching 'Học Sinh':
   - Font: Quattrocento Sans, size 10 (size 11 bold for headers)
   - Colors: Header dark green (#356854), alternating white & #F6F8F9
   - Borders: Subtle solid grid borders (#E2E8F0)
   - Alignments: Proper center / left alignment per column
   - Links: Formatted clickable hyperlinks with underline
   - Padding & Middle vertical alignment
3. Clears any residual borders on empty rows outside the table.
"""

import sys
import os

sys.stdout.reconfigure(encoding='utf-8')
os.environ.pop('SSLKEYLOGFILE', None)

_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _root not in sys.path:
    sys.path.insert(0, _root)

from src.sync_to_gsheet import get_spreadsheet

def format_tables():
    sh = get_spreadsheet()
    meta = sh.fetch_sheet_metadata()
    sheet_ids = {s['properties']['title']: s['properties']['sheetId'] for s in meta['sheets']}

    bt_id = sheet_ids.get('Bài Tập')
    bg_id = sheet_ids.get('Bài Giảng')

    if not bt_id or not bg_id:
        print("❌ Không tìm thấy sheet 'Bài Tập' hoặc 'Bài Giảng'!")
        return

    ws_bt = sh.worksheet('Bài Tập')
    bt_rows = ws_bt.get_all_values()
    num_bt = len(bt_rows)  # includes header

    ws_bg = sh.worksheet('Bài Giảng')
    bg_rows = ws_bg.get_all_values()
    num_bg = len(bg_rows)  # includes header

    print(f"📊 Đang định dạng Bảng 'Bài Tập': {num_bt} hàng...")
    print(f"📊 Đang định dạng Bảng 'Bài Giảng': {num_bg} hàng...")

    BORDER_COLOR = {"red": 0.8862745, "green": 0.9098039, "blue": 0.9411765}
    HEADER_BG = {"red": 0.20784314, "green": 0.40784314, "blue": 0.32941177}
    HEADER_BORDER = {"red": 0.15686275, "green": 0.30588236, "blue": 0.24705882}
    TEXT_COLOR = {"red": 0.16, "green": 0.16, "blue": 0.16}
    LINK_COLOR = {"red": 0.06666667, "green": 0.33333334, "blue": 0.8}

    requests = []

    # =========================================================================
    # 1. EXPAND BANDED RANGES (NATIVE TABLES)
    # =========================================================================
    # Banded range for 'Bài Tập': bandedRangeId 1553882045
    requests.append({
        "updateBanding": {
            "bandedRange": {
                "bandedRangeId": 1553882045,
                "range": {
                    "sheetId": bt_id,
                    "startRowIndex": 0,
                    "endRowIndex": num_bt,
                    "startColumnIndex": 0,
                    "endColumnIndex": 8
                }
            },
            "fields": "range"
        }
    })

    # Banded range for 'Bài Giảng': bandedRangeId 475098647
    requests.append({
        "updateBanding": {
            "bandedRange": {
                "bandedRangeId": 475098647,
                "range": {
                    "sheetId": bg_id,
                    "startRowIndex": 0,
                    "endRowIndex": num_bg,
                    "startColumnIndex": 0,
                    "endColumnIndex": 6
                }
            },
            "fields": "range"
        }
    })

    # =========================================================================
    # 2. FORMAT HEADER ROWS (ROW 1)
    # =========================================================================
    for s_id, cols in [(bt_id, 8), (bg_id, 6)]:
        requests.append({
            "repeatCell": {
                "range": {
                    "sheetId": s_id,
                    "startRowIndex": 0,
                    "endRowIndex": 1,
                    "startColumnIndex": 0,
                    "endColumnIndex": cols
                },
                "cell": {
                    "userEnteredFormat": {
                        "backgroundColor": HEADER_BG,
                        "horizontalAlignment": "CENTER",
                        "verticalAlignment": "MIDDLE",
                        "padding": {"left": 8, "right": 8, "top": 6, "bottom": 6},
                        "textFormat": {
                            "fontFamily": "Quattrocento Sans",
                            "fontSize": 11,
                            "bold": True,
                            "foregroundColor": {"red": 1, "green": 1, "blue": 1}
                        }
                    }
                },
                "fields": "userEnteredFormat(backgroundColor,horizontalAlignment,verticalAlignment,padding,textFormat)"
            }
        })
        requests.append({
            "updateBorders": {
                "range": {
                    "sheetId": s_id,
                    "startRowIndex": 0,
                    "endRowIndex": 1,
                    "startColumnIndex": 0,
                    "endColumnIndex": cols
                },
                "top": {"style": "SOLID", "width": 1, "color": HEADER_BORDER},
                "bottom": {"style": "SOLID", "width": 1, "color": HEADER_BORDER},
                "left": {"style": "SOLID", "width": 1, "color": HEADER_BORDER},
                "right": {"style": "SOLID", "width": 1, "color": HEADER_BORDER},
                "innerHorizontal": {"style": "SOLID", "width": 1, "color": HEADER_BORDER},
                "innerVertical": {"style": "SOLID", "width": 1, "color": HEADER_BORDER}
            }
        })

    # =========================================================================
    # 3. FORMAT DATA ROWS FOR 'Bài Tập'
    # =========================================================================
    # Base cell styling
    requests.append({
        "repeatCell": {
            "range": {
                "sheetId": bt_id,
                "startRowIndex": 1,
                "endRowIndex": num_bt,
                "startColumnIndex": 0,
                "endColumnIndex": 8
            },
            "cell": {
                "userEnteredFormat": {
                    "verticalAlignment": "MIDDLE",
                    "wrapStrategy": "CLIP",
                    "padding": {"left": 8, "right": 8},
                    "textFormat": {
                        "fontFamily": "Quattrocento Sans",
                        "fontSize": 10,
                        "foregroundColor": TEXT_COLOR
                    }
                }
            },
            "fields": "userEnteredFormat(verticalAlignment,wrapStrategy,padding,textFormat)"
        }
    })

    # Table grid borders
    requests.append({
        "updateBorders": {
            "range": {
                "sheetId": bt_id,
                "startRowIndex": 1,
                "endRowIndex": num_bt,
                "startColumnIndex": 0,
                "endColumnIndex": 8
            },
            "top": {"style": "SOLID", "width": 1, "color": BORDER_COLOR},
            "bottom": {"style": "SOLID", "width": 1, "color": BORDER_COLOR},
            "left": {"style": "SOLID", "width": 1, "color": BORDER_COLOR},
            "right": {"style": "SOLID", "width": 1, "color": BORDER_COLOR},
            "innerHorizontal": {"style": "SOLID", "width": 1, "color": BORDER_COLOR},
            "innerVertical": {"style": "SOLID", "width": 1, "color": BORDER_COLOR}
        }
    })

    # Alignments per column in 'Bài Tập'
    # Col 0: Mã bài -> CENTER
    # Col 1: Link bài tập -> LEFT
    # Col 2: Tên bài tập -> LEFT
    # Col 3: Class -> CENTER
    # Col 4: Level -> CENTER
    # Col 5: Dạng bài -> LEFT
    # Col 6: Nền tảng -> CENTER
    # Col 7: Ghi chú -> LEFT
    bt_alignments = [
        (0, "CENTER"),
        (1, "LEFT"),
        (2, "LEFT"),
        (3, "CENTER"),
        (4, "CENTER"),
        (5, "LEFT"),
        (6, "CENTER"),
        (7, "LEFT")
    ]
    for c_idx, align in bt_alignments:
        requests.append({
            "repeatCell": {
                "range": {
                    "sheetId": bt_id,
                    "startRowIndex": 1,
                    "endRowIndex": num_bt,
                    "startColumnIndex": c_idx,
                    "endColumnIndex": c_idx + 1
                },
                "cell": {
                    "userEnteredFormat": {
                        "horizontalAlignment": align
                    }
                },
                "fields": "userEnteredFormat.horizontalAlignment"
            }
        })

    # =========================================================================
    # 4. FORMAT DATA ROWS FOR 'Bài Giảng'
    # =========================================================================
    # Base cell styling
    requests.append({
        "repeatCell": {
            "range": {
                "sheetId": bg_id,
                "startRowIndex": 1,
                "endRowIndex": num_bg,
                "startColumnIndex": 0,
                "endColumnIndex": 6
            },
            "cell": {
                "userEnteredFormat": {
                    "verticalAlignment": "MIDDLE",
                    "wrapStrategy": "CLIP",
                    "padding": {"left": 8, "right": 8},
                    "textFormat": {
                        "fontFamily": "Quattrocento Sans",
                        "fontSize": 10,
                        "foregroundColor": TEXT_COLOR
                    }
                }
            },
            "fields": "userEnteredFormat(verticalAlignment,wrapStrategy,padding,textFormat)"
        }
    })

    # Table grid borders
    requests.append({
        "updateBorders": {
            "range": {
                "sheetId": bg_id,
                "startRowIndex": 1,
                "endRowIndex": num_bg,
                "startColumnIndex": 0,
                "endColumnIndex": 6
            },
            "top": {"style": "SOLID", "width": 1, "color": BORDER_COLOR},
            "bottom": {"style": "SOLID", "width": 1, "color": BORDER_COLOR},
            "left": {"style": "SOLID", "width": 1, "color": BORDER_COLOR},
            "right": {"style": "SOLID", "width": 1, "color": BORDER_COLOR},
            "innerHorizontal": {"style": "SOLID", "width": 1, "color": BORDER_COLOR},
            "innerVertical": {"style": "SOLID", "width": 1, "color": BORDER_COLOR}
        }
    })

    # Alignments per column in 'Bài Giảng'
    # Col 0: Mã bài giảng -> CENTER
    # Col 1: Chương / Tuần -> CENTER
    # Col 2: Tiêu đề bài giảng -> LEFT
    # Col 3: Lớp áp dụng -> CENTER
    # Col 4: Link bài giảng -> LEFT
    # Col 5: Tóm tắt kiến thức -> LEFT
    bg_alignments = [
        (0, "CENTER"),
        (1, "CENTER"),
        (2, "LEFT"),
        (3, "CENTER"),
        (4, "LEFT"),
        (5, "LEFT")
    ]
    for c_idx, align in bg_alignments:
        requests.append({
            "repeatCell": {
                "range": {
                    "sheetId": bg_id,
                    "startRowIndex": 1,
                    "endRowIndex": num_bg,
                    "startColumnIndex": c_idx,
                    "endColumnIndex": c_idx + 1
                },
                "cell": {
                    "userEnteredFormat": {
                        "horizontalAlignment": align
                    }
                },
                "fields": "userEnteredFormat.horizontalAlignment"
            }
        })

    # =========================================================================
    # 5. FORMAT CLICKABLE HYPERLINKS
    # =========================================================================
    # Link column in 'Bài Tập' is Col B (index 1)
    for r_idx, r in enumerate(bt_rows[1:], 1):
        if len(r) > 1 and r[1].startswith("http"):
            requests.append({
                "repeatCell": {
                    "range": {
                        "sheetId": bt_id,
                        "startRowIndex": r_idx,
                        "endRowIndex": r_idx + 1,
                        "startColumnIndex": 1,
                        "endColumnIndex": 2
                    },
                    "cell": {
                        "userEnteredFormat": {
                            "textFormat": {
                                "fontFamily": "Quattrocento Sans",
                                "fontSize": 10,
                                "underline": True,
                                "foregroundColor": LINK_COLOR,
                                "link": {"uri": r[1].strip()}
                            }
                        }
                    },
                    "fields": "userEnteredFormat.textFormat"
                }
            })

    # Link column in 'Bài Giảng' is Col E (index 4)
    for r_idx, r in enumerate(bg_rows[1:], 1):
        if len(r) > 4 and r[4].startswith("http"):
            requests.append({
                "repeatCell": {
                    "range": {
                        "sheetId": bg_id,
                        "startRowIndex": r_idx,
                        "endRowIndex": r_idx + 1,
                        "startColumnIndex": 4,
                        "endColumnIndex": 5
                    },
                    "cell": {
                        "userEnteredFormat": {
                            "textFormat": {
                                "fontFamily": "Quattrocento Sans",
                                "fontSize": 10,
                                "underline": True,
                                "foregroundColor": LINK_COLOR,
                                "link": {"uri": r[4].strip()}
                            }
                        }
                    },
                    "fields": "userEnteredFormat.textFormat"
                }
            })

    # =========================================================================
    # 6. CLEAR BORDERS ON EMPTY ROWS OUTSIDE TABLE
    # =========================================================================
    requests.append({
        "updateBorders": {
            "range": {
                "sheetId": bt_id,
                "startRowIndex": num_bt,
                "endRowIndex": min(num_bt + 100, 1000),
                "startColumnIndex": 0,
                "endColumnIndex": 8
            },
            "top": {"style": "NONE"},
            "bottom": {"style": "NONE"},
            "left": {"style": "NONE"},
            "right": {"style": "NONE"},
            "innerHorizontal": {"style": "NONE"},
            "innerVertical": {"style": "NONE"}
        }
    })
    requests.append({
        "updateBorders": {
            "range": {
                "sheetId": bg_id,
                "startRowIndex": num_bg,
                "endRowIndex": min(num_bg + 100, 999),
                "startColumnIndex": 0,
                "endColumnIndex": 6
            },
            "top": {"style": "NONE"},
            "bottom": {"style": "NONE"},
            "left": {"style": "NONE"},
            "right": {"style": "NONE"},
            "innerHorizontal": {"style": "NONE"},
            "innerVertical": {"style": "NONE"}
        }
    })

    print(f"🚀 Đang gửi {len(requests)} yêu cầu định dạng tới Google Sheets API...")
    res = sh.batch_update({"requests": requests})
    print("✅ ĐÃ HOÀN TẤT ĐỊNH DẠNG BẢNG CHO 'Bài Tập' VÀ 'Bài Giảng' TRÊN GOOGLE SHEET!")

if __name__ == "__main__":
    format_tables()
