import os
import sys
import time
import subprocess
from datetime import datetime
from src.sync_excel import sync
from src.utils.logger import get_logger

logger = get_logger("auto.watch")

EXCEL_FILE = "Quản lý học sinh.xlsx"
POLL_INTERVAL = 2  # check every 2 seconds


def run_cmd(cmd: list) -> bool:
    try:
        res = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8")
        if res.returncode != 0:
            if "nothing to commit" in res.stdout or "nothing to commit" in res.stderr:
                return True
            logger.warning(f"Cmd warning ({' '.join(cmd)}): {res.stderr.strip() or res.stdout.strip()}")
            return False
        return True
    except Exception as e:
        logger.error(f"Error running cmd {' '.join(cmd)}: {e}")
        return False


def watch_and_sync():
    print("=" * 60)
    print("  🚀 CHẾ ĐỘ TỰ ĐỘNG ĐỒNG BỘ EXCEL SANG WEB ĐANG CHẠY")
    print("=" * 60)
    print(f"📁 Tệp theo dõi: {EXCEL_FILE}")
    print("💡 Thao tác: Bất cứ khi nào bạn nhấn Ctrl + S trong Excel,")
    print("   hệ thống sẽ TỰ ĐỘNG đồng bộ và đẩy lên GitHub Pages.")
    print("👉 Bạn có thể THU NHỎ cửa sổ này và làm việc bình thường.")
    print("=" * 60)
    print()

    if not os.path.exists(EXCEL_FILE):
        logger.error(f"Không tìm thấy file: {EXCEL_FILE}")
        return

    last_mtime = os.path.getmtime(EXCEL_FILE)
    print(f"[{datetime.now().strftime('%H:%M:%S')}] Đang lắng nghe thay đổi từ {EXCEL_FILE}...")

    while True:
        try:
            time.sleep(POLL_INTERVAL)
            if not os.path.exists(EXCEL_FILE):
                continue

            current_mtime = os.path.getmtime(EXCEL_FILE)
            if current_mtime > last_mtime:
                # File modified! Wait 1.5s for Excel to release lock
                time.sleep(1.5)
                last_mtime = os.path.getmtime(EXCEL_FILE)

                now_str = datetime.now().strftime('%H:%M:%S')
                print()
                print(f"[{now_str}] 🔔 Phát hiện thay đổi trong '{EXCEL_FILE}'! Đang xử lý...")

                # 1. Sync Excel to docs/data.json
                ok = sync(EXCEL_FILE, "docs/data.json")
                if not ok:
                    print(f"[{datetime.now().strftime('%H:%M:%S')}] ❌ Lỗi khi đọc file Excel. Sẽ thử lại lần sau.")
                    continue

                # 2. Git add, commit, push
                print(f"[{datetime.now().strftime('%H:%M:%S')}] 📤 Đang tự động đẩy lên GitHub Pages...")
                run_cmd(["git", "add", "docs/data.json"])
                commit_ok = run_cmd(["git", "commit", "-m", f"auto-sync: update from excel at {now_str}"])
                push_ok = run_cmd(["git", "push", "origin", "master"])

                if push_ok:
                    print(f"[{datetime.now().strftime('%H:%M:%S')}] ✅ [HOÀN TẤT] Website đã được cập nhật thành công lên GitHub Pages!")
                else:
                    print(f"[{datetime.now().strftime('%H:%M:%S')}] ⚠️ Đã lưu vào docs/data.json nhưng chưa thể đẩy lên GitHub. Vui lòng kiểm tra mạng.")

                print(f"[{datetime.now().strftime('%H:%M:%S')}] ⏳ Tiếp tục theo dõi thay đổi...")

        except KeyboardInterrupt:
            print("\nĐã dừng chế độ tự động đồng bộ.")
            sys.exit(0)
        except Exception as e:
            # Ignore transient read locks from Excel
            time.sleep(2)


if __name__ == "__main__":
    watch_and_sync()
