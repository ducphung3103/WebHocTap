import os
import sys
import json
import urllib.request
import urllib.error
from typing import Dict, Any, Optional
from dotenv import load_dotenv

# Ensure root is in sys.path
_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _root not in sys.path:
    sys.path.insert(0, _root)

if sys.platform.startswith("win"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

load_dotenv(os.path.join(_root, ".env"))

def get_service_account_token() -> Optional[str]:
    """Tự động lấy OAuth2 Bearer token từ service_account.json nếu có."""
    sa_path = os.environ.get("GOOGLE_SERVICE_ACCOUNT_FILE", os.path.join(_root, "service_account.json"))
    if not os.path.isabs(sa_path):
        sa_path = os.path.join(_root, sa_path)
    
    if os.path.exists(sa_path):
        try:
            os.environ.pop("SSLKEYLOGFILE", None)
            from google.oauth2 import service_account
            from google.auth.transport.requests import Request
            
            scopes = [
                "https://www.googleapis.com/auth/userinfo.email",
                "https://www.googleapis.com/auth/firebase.database"
            ]
            creds = service_account.Credentials.from_service_account_file(sa_path, scopes=scopes)
            creds.refresh(Request())
            return creds.token
        except Exception as e:
            # Service account may not have direct Firebase scope, continue to fallback
            pass
    return None

def push_tokens_to_firebase(tokens: Dict[str, Any], db_url: Optional[str] = None) -> bool:
    """
    Đẩy toàn bộ auth_tokens lên Firebase Realtime Database qua REST API.
    Bảo vệ dữ liệu tuyệt đối: Không bao giờ lưu mã PIN dạng text thô.
    """
    os.environ.pop("SSLKEYLOGFILE", None)
    
    # 1. Luôn ghi file backup an toàn (đã được .gitignore chặn commit)
    backup_file = os.path.join(_root, "auth_tokens_for_firebase.json")
    try:
        with open(backup_file, "w", encoding="utf-8") as f:
            json.dump({"auth_tokens": tokens}, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"⚠️ Không thể ghi file backup {backup_file}: {e}")

    # 2. Lấy Database URL từ config hoặc .env
    target_url = (db_url or os.environ.get("FIREBASE_DATABASE_URL", "")).strip().rstrip("/")
    if not target_url or "webhoctap-default-rtdb.firebaseio.com" in target_url:
        print("ℹ️ Chưa cấu hình FIREBASE_DATABASE_URL trong .env. Bạn có thể:")
        print(f"   1. Điền FIREBASE_DATABASE_URL=https://<your-project>-default-rtdb.asia-southeast1.firebasedatabase.app vào file .env")
        print(f"   2. Hoặc mở Firebase Console > Realtime Database > Dấu 3 chấm (⋮) > 'Import JSON' > Chọn file: {backup_file}")
        return False

    endpoint = f"{target_url}/auth_tokens.json"
    
    # Kiểm tra secret auth hoặc OAuth2 token
    db_secret = os.environ.get("FIREBASE_DATABASE_SECRET", "").strip()
    if db_secret:
        endpoint += f"?auth={db_secret}"
        headers = {"Content-Type": "application/json"}
    else:
        oauth_token = get_service_account_token()
        headers = {"Content-Type": "application/json"}
        if oauth_token:
            headers["Authorization"] = f"Bearer {oauth_token}"

    try:
        req_data = json.dumps(tokens, ensure_ascii=False).encode("utf-8")
        req = urllib.request.Request(endpoint, data=req_data, headers=headers, method="PUT")
        with urllib.request.urlopen(req, timeout=15) as resp:
            if resp.status in (200, 204):
                print(f"✅ Đã đồng bộ thành công {len(tokens)} mã PIN & token bảo mật lên Firebase Realtime Database!")
                return True
            else:
                print(f"⚠️ Firebase phản hồi mã HTTP: {resp.status}")
                return False
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode("utf-8", errors="replace")
        print(f"⚠️ Lỗi kết nối Firebase (HTTP {e.code}): {err_msg}")
        print(f"👉 Gợi ý: Hãy kiểm tra Firebase Rules trong firebase_rules.json hoặc nhập thủ công file: {backup_file}")
        return False
    except Exception as e:
        print(f"⚠️ Không thể gửi dữ liệu đến Firebase: {e}")
        return False

def push_full_database_to_firebase(payload: Dict[str, Any], db_url: Optional[str] = None) -> bool:
    """
    Đẩy toàn bộ cây dữ liệu (auth_tokens, students, submissions, metadata) lên Firebase Realtime Database.
    Giải quyết dứt điểm việc lộ dữ liệu tại data.json.
    """
    os.environ.pop("SSLKEYLOGFILE", None)
    target_url = (db_url or os.environ.get("FIREBASE_DATABASE_URL", "")).strip().rstrip("/")
    if not target_url or "webhoctap-default-rtdb.firebaseio.com" in target_url:
        export_file = os.path.join(_root, "firebase_database_export.json")
        print("ℹ️ Chưa cấu hình FIREBASE_DATABASE_URL trong .env. Bạn có thể:")
        print(f"   1. Thêm FIREBASE_DATABASE_URL=https://<your-project>-default-rtdb.asia-southeast1.firebasedatabase.app vào file .env")
        print(f"   2. Hoặc mở Firebase Console > Realtime Database > Dấu 3 chấm (⋮) > 'Import JSON' > Chọn file: {export_file}")
        return False

    endpoint = f"{target_url}/.json"
    db_secret = os.environ.get("FIREBASE_DATABASE_SECRET", "").strip()
    if db_secret:
        endpoint += f"?auth={db_secret}"
        headers = {"Content-Type": "application/json"}
    else:
        oauth_token = get_service_account_token()
        headers = {"Content-Type": "application/json"}
        if oauth_token:
            headers["Authorization"] = f"Bearer {oauth_token}"

    try:
        req_data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        req = urllib.request.Request(endpoint, data=req_data, headers=headers, method="PATCH")
        with urllib.request.urlopen(req, timeout=20) as resp:
            if resp.status in (200, 204):
                print(f"✅ Đã đồng bộ TOÀN BỘ dữ liệu học sinh, học phí và tokens lên Firebase Realtime Database thành công!")
                return True
            else:
                print(f"⚠️ Firebase phản hồi mã HTTP: {resp.status}")
                return False
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode("utf-8", errors="replace")
        print(f"⚠️ Lỗi cập nhật Firebase (HTTP {e.code}): {err_msg}")
        return False
    except Exception as e:
        print(f"⚠️ Không thể gửi dữ liệu toàn phần đến Firebase: {e}")
        return False

def push_students_to_firebase(students: list, db_url: Optional[str] = None) -> bool:
    """Đẩy riêng mảng students lên Firebase /students.json."""
    os.environ.pop("SSLKEYLOGFILE", None)
    target_url = (db_url or os.environ.get("FIREBASE_DATABASE_URL", "")).strip().rstrip("/")
    if not target_url or "webhoctap-default-rtdb.firebaseio.com" in target_url:
        return False

    endpoint = f"{target_url}/students.json"
    db_secret = os.environ.get("FIREBASE_DATABASE_SECRET", "").strip()
    if db_secret:
        endpoint += f"?auth={db_secret}"
        headers = {"Content-Type": "application/json"}
    else:
        oauth_token = get_service_account_token()
        headers = {"Content-Type": "application/json"}
        if oauth_token:
            headers["Authorization"] = f"Bearer {oauth_token}"

    try:
        req_data = json.dumps(students, ensure_ascii=False).encode("utf-8")
        req = urllib.request.Request(endpoint, data=req_data, headers=headers, method="PUT")
        with urllib.request.urlopen(req, timeout=15) as resp:
            return resp.status in (200, 204)
    except Exception as e:
        print(f"⚠️ Lỗi push students lên Firebase: {e}")
        return False

