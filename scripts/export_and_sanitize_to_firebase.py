#!/usr/bin/env python3
"""
scripts/export_and_sanitize_to_firebase.py
1. Xuất toàn bộ dữ liệu học sinh, học phí, bài nộp sang tệp firebase_database_export.json
2. Làm sạch (sanitize) file docs/data.json để TUYỆT ĐỐI KHÔNG còn họ tên, tài khoản, học phí học sinh trong data.json công khai.
3. Đẩy toàn bộ dữ liệu lên Firebase Realtime Database nếu có URL cấu hình.
"""
import os
import sys
import json
from datetime import datetime, timezone

_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _root not in sys.path:
    sys.path.insert(0, _root)

if sys.platform.startswith("win"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

from src.sync_firebase import push_full_database_to_firebase

def main():
    print("=" * 70)
    print("🔥 CHUYỂN DỮ LIỆU HỌC SINH SANG FIREBASE & LÀM SẠCH DATA.JSON")
    print("=" * 70)

    data_json_path = os.path.join(_root, "docs", "data.json")
    if not os.path.exists(data_json_path):
        print(f"❌ Không tìm thấy file {data_json_path}")
        return

    with open(data_json_path, "r", encoding="utf-8") as f:
        full_data = json.load(f)

    # 1. Nạp auth_tokens
    auth_tokens = {}
    tokens_file = os.path.join(_root, "auth_tokens_for_firebase.json")
    if os.path.exists(tokens_file):
        try:
            with open(tokens_file, "r", encoding="utf-8") as tf:
                td = json.load(tf)
                auth_tokens = td.get("auth_tokens", {})
        except Exception as e:
            print(f"⚠️ Lỗi đọc {tokens_file}: {e}")

    students = full_data.get("students", [])
    submissions = full_data.get("submissions", [])
    if not students:
        # Check existing backup or export if data.json was already sanitized
        for fallback_f in ["data_firebase_backup.json", "firebase_database_export.json"]:
            fb_path = os.path.join(_root, fallback_f)
            if os.path.exists(fb_path):
                try:
                    with open(fb_path, "r", encoding="utf-8") as f_fb:
                        fb_d = json.load(f_fb)
                        st_list = fb_d.get("students", [])
                        if st_list:
                            students = st_list
                            if not submissions:
                                submissions = fb_d.get("submissions", [])
                            print(f"ℹ️ Đã lấy {len(students)} học sinh từ file lưu trữ {fallback_f}")
                            break
                except Exception:
                    pass
    tuition_months = full_data.get("tuition_months", ["Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12"])
    
    print(f"📦 Dữ liệu hiện tại:")
    print(f"   - Số lượng học sinh: {len(students)}")
    print(f"   - Số lượng bài nộp: {len(submissions)}")
    print(f"   - Số lượng auth_tokens: {len(auth_tokens)}")

    # 2. Tạo cây dữ liệu Firebase chuẩn
    firebase_payload = {
        "auth_tokens": auth_tokens,
        "students": students,
        "submissions": submissions,
        "metadata": {
            "last_updated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "tuition_months": tuition_months,
            "data_source": "firebase",
            "security_status": "Dữ liệu được bảo vệ an toàn trên Firebase Realtime Database"
        }
    }

    # 3. Ghi file xuất Firebase & backup nội bộ
    export_path = os.path.join(_root, "firebase_database_export.json")
    backup_path = os.path.join(_root, "data_firebase_backup.json")

    with open(export_path, "w", encoding="utf-8") as f:
        json.dump(firebase_payload, f, ensure_ascii=False, indent=2)

    with open(backup_path, "w", encoding="utf-8") as f:
        json.dump(full_data, f, ensure_ascii=False, indent=2)

    print(f"\n💾 Đã tạo tệp Import Firebase tại: {export_path}")
    print(f"💾 Đã tạo tệp Backup nội bộ tại: {backup_path}")

    # 4. Làm sạch docs/data.json
    sanitized_data = dict(full_data)
    sanitized_data["students"] = [] # Xóa sạch học sinh khỏi data.json công khai
    sanitized_data["submissions"] = [] # Xóa sạch bài nộp khỏi data.json
    sanitized_data.pop("auth_tokens", None)
    sanitized_data["data_source"] = "firebase"
    sanitized_data["security_status"] = "Dữ liệu học sinh, điểm danh và học phí đã được chuyển sang Firebase Realtime Database để bảo mật tuyệt đối, không lưu trong data.json"
    sanitized_data["last_updated"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    with open(data_json_path, "w", encoding="utf-8") as f:
        json.dump(sanitized_data, f, ensure_ascii=False, indent=2)

    print(f"🛡️ ĐÃ LÀM SẠCH: docs/data.json hiện CHỈ chứa danh mục bài tập, lý thuyết, kỳ thi công khai.")
    print(f"   Toàn bộ thông tin học sinh, số tiền học phí và mã PIN đã được LOẠI BỎ khỏi data.json!")

    # 5. Đẩy lên Firebase nếu có cấu hình URL
    db_url = sys.argv[1] if len(sys.argv) > 1 else None
    push_full_database_to_firebase(firebase_payload, db_url=db_url)

if __name__ == "__main__":
    main()
