"""
CREATE & POPULATE 'Kho Bài Codeforces' TAB IN GOOGLE SHEET
-----------------------------------------------------------
Tạo tab mới 'Kho Bài Codeforces' trong Google Sheet 'Quản lý học sinh'
và nạp 579 bài tập đã phân loại từ tài khoản DeruckLoveNewTechnology mà KHÔNG
chạm vào tab 'Bài Tập' hay bất kỳ tab nào khác đã được người dùng định dạng trước đó.
"""

import os
import sys
import csv
import time

# Reconfigure stdout for utf-8 on Windows
sys.stdout.reconfigure(encoding='utf-8')
os.environ.pop("SSLKEYLOGFILE", None)

_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _PROJECT_ROOT not in sys.path:
    sys.path.insert(0, _PROJECT_ROOT)

import gspread
from google.oauth2.service_account import Credentials
from config.settings import get_settings


def create_and_populate_codeforces_tab(
    csv_path: str = "docs/deruck_solved_cf.csv",
    new_tab_name: str = "Kho Bài Codeforces"
):
    settings = get_settings()
    sheet_id = settings.spreadsheet_id
    if not sheet_id:
        print("❌ Lỗi: Chưa có SPREADSHEET_ID trong .env!")
        return False

    sa_info = settings.get_service_account_dict()
    if not sa_info:
        print("❌ Lỗi: Không tìm thấy thông tin Service Account!")
        return False

    print(f"📡 Đang kết nối tới Google Spreadsheet: {sheet_id}...")
    scopes = [
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive",
    ]
    credentials = Credentials.from_service_account_info(sa_info, scopes=scopes)
    gc = gspread.authorize(credentials)
    sh = gc.open_by_key(sheet_id)
    print(f"📊 Đã mở Google Sheet: '{sh.title}'")

    existing_titles = [ws.title for ws in sh.worksheets()]
    print(f"📋 Các tab hiện có trong Sheet: {existing_titles}")

    # Check if new tab already exists
    ws = None
    if new_tab_name in existing_titles:
        print(f"ℹ️ Tab '{new_tab_name}' đã tồn tại sẵn trong Google Sheet.")
        ws = sh.worksheet(new_tab_name)
    else:
        print(f"✨ Đang tạo tab mới: '{new_tab_name}'...")
        ws = sh.add_worksheet(title=new_tab_name, rows=650, cols=8)
        print(f"✅ Đã tạo tab mới '{new_tab_name}' thành công!")

    # Check existing rows in this new tab
    current_rows = ws.get_all_values()
    existing_pids = set()
    if len(current_rows) > 0:
        for r in current_rows[1:]:
            if r and r[0].strip():
                existing_pids.add(r[0].strip().upper())

    # Read CSV rows
    if not os.path.exists(csv_path):
        print(f"❌ Không tìm thấy file CSV nguồn: {csv_path}")
        return False

    with open(csv_path, "r", encoding="utf-8-sig") as f:
        reader = list(csv.reader(f))

    if not reader:
        print("❌ File CSV rỗng!")
        return False

    header = reader[0]
    data_rows = reader[1:]

    # Add header if worksheet is empty
    if len(current_rows) == 0:
        print("📝 Đang tạo dòng tiêu đề bảng...")
        ws.append_row(header, value_input_option="USER_ENTERED")
        time.sleep(1)

    # Filter out rows already in the tab
    to_add = []
    for r in data_rows:
        if r and r[0].strip() and r[0].strip().upper() not in existing_pids:
            to_add.append(r)
            existing_pids.add(r[0].strip().upper())

    if not to_add:
        print(f"✨ Tab '{new_tab_name}' đã có đủ toàn bộ {len(data_rows)} bài tập, không có bài mới cần nạp thêm.")
    else:
        print(f"🚀 Chuẩn bị nạp {len(to_add)} bài tập vào tab '{new_tab_name}'...")
        batch_size = 100
        for i in range(0, len(to_add), batch_size):
            chunk = to_add[i:i + batch_size]
            ws.append_rows(chunk, value_input_option="USER_ENTERED")
            print(f"   ✅ Đã nạp thành công {min(i + batch_size, len(to_add))}/{len(to_add)} bài...")
            time.sleep(0.5)
        print(f"🎉 NẠP DỮ LIỆU HOÀN TẤT! Đã thêm {len(to_add)} bài vào '{new_tab_name}'.")

    # Format header row (bold, background color, freeze 1st row)
    try:
        sh.batch_update({
            "requests": [
                # Freeze first row
                {
                    "updateSheetProperties": {
                        "properties": {
                            "sheetId": ws.id,
                            "gridProperties": {
                                "frozenRowCount": 1
                            }
                        },
                        "fields": "gridProperties.frozenRowCount"
                    }
                },
                # Format header row: bold, dark slate background, white text
                {
                    "repeatCell": {
                        "range": {
                            "sheetId": ws.id,
                            "startRowIndex": 0,
                            "endRowIndex": 1,
                            "startColumnIndex": 0,
                            "endColumnIndex": 8
                        },
                        "cell": {
                            "userEnteredFormat": {
                                "backgroundColor": {
                                    "red": 0.12,
                                    "green": 0.16,
                                    "blue": 0.23
                                },
                                "textFormat": {
                                    "foregroundColor": {
                                        "red": 1.0,
                                        "green": 1.0,
                                        "blue": 1.0
                                    },
                                    "bold": True,
                                    "fontSize": 10
                                },
                                "horizontalAlignment": "CENTER"
                            }
                        },
                        "fields": "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)"
                    }
                }
            ]
        })
        print("🎨 Đã định dạng hàng tiêu đề đẹp mắt (In đậm, nền xanh đen, cố định dòng đầu)!")
    except Exception as exc:
        print(f"ℹ️ Lưu ý định dạng: {exc}")

    print(f"\n🌟 Kiểm tra lại danh sách các tab hiện thời:")
    for w in sh.worksheets():
        print(f"   • {w.title} ({len(w.get_all_values())} dòng)")

    return True


if __name__ == "__main__":
    create_and_populate_codeforces_tab()
