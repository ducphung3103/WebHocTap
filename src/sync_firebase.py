import os
import sys
import json
import urllib.request
import urllib.error
from typing import Dict, Any, Optional, List
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

# Ensure SSLKEYLOGFILE is safe
_sslkeylogfile = os.environ.get("SSLKEYLOGFILE")
if _sslkeylogfile and not os.path.exists(_sslkeylogfile):
    del os.environ["SSLKEYLOGFILE"]

load_dotenv(os.path.join(_root, ".env"))


def get_service_account_token() -> Optional[str]:
    """Tự động lấy OAuth2 Bearer token từ service_account info nếu có."""
    try:
        os.environ.pop("SSLKEYLOGFILE", None)
        from config.settings import get_settings
        sa_dict = get_settings().get_service_account_dict()
        if sa_dict:
            from google.oauth2 import service_account
            from google.auth.transport.requests import Request
            scopes = [
                "https://www.googleapis.com/auth/userinfo.email",
                "https://www.googleapis.com/auth/firebase.database"
            ]
            creds = service_account.Credentials.from_service_account_info(sa_dict, scopes=scopes)
            creds.refresh(Request())
            return creds.token
    except Exception:
        pass
    return None


DEFAULT_FIREBASE_URL = "https://webhoctap-46912-default-rtdb.asia-southeast1.firebasedatabase.app"


def get_target_url(db_url: Optional[str] = None) -> str:
    url = (db_url or os.environ.get("FIREBASE_DATABASE_URL", "")).strip().rstrip("/")
    if not url or "webhoctap-default-rtdb.firebaseio.com" in url:
        return DEFAULT_FIREBASE_URL
    return url


def fetch_database_from_firebase(db_url: Optional[str] = None) -> Dict[str, Any]:
    """Tải dữ liệu học sinh, bài nộp và metadata mới nhất từ Firebase Realtime Database."""
    os.environ.pop("SSLKEYLOGFILE", None)
    target_url = get_target_url(db_url)
    result = {"students": [], "submissions": [], "metadata": {}}

    # 1. Fetch Students
    try:
        req = urllib.request.Request(f"{target_url}/students.json", headers={"Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=12) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            if isinstance(data, list):
                result["students"] = [s for s in data if s]
            elif isinstance(data, dict):
                result["students"] = list(data.values())
    except Exception as e:
        print(f"ℹ️ Không thể tải /students từ Firebase ({e}), sẽ dùng dữ liệu cục bộ.")

    # 2. Fetch Submissions
    try:
        req = urllib.request.Request(f"{target_url}/submissions.json", headers={"Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=12) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            if isinstance(data, list):
                result["submissions"] = [s for s in data if s]
            elif isinstance(data, dict):
                result["submissions"] = list(data.values())
    except Exception:
        pass

    # 3. Fetch Metadata
    try:
        req = urllib.request.Request(f"{target_url}/metadata.json", headers={"Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            if isinstance(data, dict):
                result["metadata"] = data
    except Exception:
        pass

    return result


def get_auth_headers_and_param(target_url: str) -> tuple[Dict[str, str], str]:
    db_secret = os.environ.get("FIREBASE_DATABASE_SECRET", "").strip()
    headers = {"Content-Type": "application/json"}
    auth_param = ""
    if db_secret:
        auth_param = f"?auth={db_secret}"
    else:
        try:
            from config.settings import get_settings
            sa_dict = get_settings().get_service_account_dict()
            if sa_dict and sa_dict.get("project_id") and sa_dict.get("project_id") in target_url:
                oauth_token = get_service_account_token()
                if oauth_token:
                    headers["Authorization"] = f"Bearer {oauth_token}"
        except Exception:
            pass
    return headers, auth_param


def push_tokens_to_firebase(tokens: Dict[str, Any], db_url: Optional[str] = None) -> bool:
    """
    Đẩy auth_tokens lên Firebase Realtime Database qua REST API.
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

    target_url = get_target_url(db_url)
    headers, auth_param = get_auth_headers_and_param(target_url)
    endpoint = f"{target_url}/auth_tokens.json{auth_param}"

    # Try bulk PUT /auth_tokens.json
    try:
        req_data = json.dumps(tokens, ensure_ascii=False).encode("utf-8")
        req = urllib.request.Request(endpoint, data=req_data, headers=headers, method="PUT")
        with urllib.request.urlopen(req, timeout=15) as resp:
            if resp.status in (200, 204):
                print(f"✅ Đã đồng bộ thành công {len(tokens)} mã PIN & token bảo mật lên Firebase Realtime Database!")
                return True
    except Exception:
        pass

    # Fallback: Try individual token PUT /auth_tokens/{hash}.json
    success_count = 0
    for thash, tdata in tokens.items():
        try:
            t_url = f"{target_url}/auth_tokens/{thash}.json{auth_param}"
            t_data = json.dumps(tdata, ensure_ascii=False).encode("utf-8")
            req = urllib.request.Request(t_url, data=t_data, headers=headers, method="PUT")
            with urllib.request.urlopen(req, timeout=5) as resp:
                if resp.status in (200, 204):
                    success_count += 1
        except Exception:
            pass

    if success_count > 0:
        print(f"✅ Đã lưu {success_count}/{len(tokens)} mã token bảo mật lên Firebase!")
        return True

    return False


def push_students_to_firebase(students: list, db_url: Optional[str] = None) -> bool:
    """Đẩy trực tiếp danh sách students lên Firebase /students.json (được phép ghi qua Rules)."""
    os.environ.pop("SSLKEYLOGFILE", None)
    target_url = get_target_url(db_url)
    headers, auth_param = get_auth_headers_and_param(target_url)
    endpoint = f"{target_url}/students.json{auth_param}"

    try:
        req_data = json.dumps(students, ensure_ascii=False).encode("utf-8")
        req = urllib.request.Request(endpoint, data=req_data, headers=headers, method="PUT")
        with urllib.request.urlopen(req, timeout=15) as resp:
            return resp.status in (200, 204)
    except Exception as e:
        print(f"⚠️ Lỗi push students lên Firebase: {e}")
        return False


def push_full_database_to_firebase(payload: Dict[str, Any], db_url: Optional[str] = None) -> bool:
    """
    Đẩy toàn bộ dữ liệu học sinh, học phí, bài nộp lên Firebase Realtime Database.
    Hỗ trợ cơ chế ghi trực tiếp từng endpoint (/students, /metadata, /submissions)
    nếu quyền ở root (/) bị giới hạn.
    """
    os.environ.pop("SSLKEYLOGFILE", None)
    target_url = get_target_url(db_url)

    students = payload.get("students", [])
    submissions = payload.get("submissions", [])
    metadata = payload.get("metadata", {})
    if not metadata:
        metadata = {
            "last_updated": os.environ.get("LAST_UPDATED", ""),
            "data_source": "firebase"
        }

    safe_payload = {
        "students": students,
        "submissions": submissions,
        "metadata": metadata
    }

    db_secret = os.environ.get("FIREBASE_DATABASE_SECRET", "").strip()
    headers = {"Content-Type": "application/json"}
    auth_param = ""
    if db_secret:
        auth_param = f"?auth={db_secret}"
    else:
        # Only attach OAuth token if service account project matches Firebase project
        try:
            from config.settings import get_settings
            sa_dict = get_settings().get_service_account_dict()
            if sa_dict and sa_dict.get("project_id") and sa_dict.get("project_id") in target_url:
                oauth_token = get_service_account_token()
                if oauth_token:
                    headers["Authorization"] = f"Bearer {oauth_token}"
        except Exception:
            pass

    # Step 1: Thử cập nhật tổng thể qua PATCH root
    patch_success = False
    try:
        endpoint = f"{target_url}/.json{auth_param}"
        req_data = json.dumps(safe_payload, ensure_ascii=False).encode("utf-8")
        req = urllib.request.Request(endpoint, data=req_data, headers=headers, method="PATCH")
        with urllib.request.urlopen(req, timeout=20) as resp:
            if resp.status in (200, 204):
                patch_success = True
    except Exception:
        patch_success = False

    # Step 2: Nếu PATCH root không được (ví dụ do Rules chặn root), ghi trực tiếp từng nhánh
    if not patch_success:
        ok_students = False
        try:
            ep_stu = f"{target_url}/students.json{auth_param}"
            req_stu = urllib.request.Request(ep_stu, data=json.dumps(students, ensure_ascii=False).encode("utf-8"), headers=headers, method="PUT")
            with urllib.request.urlopen(req_stu, timeout=15) as resp:
                ok_students = resp.status in (200, 204)
        except Exception as e:
            print(f"⚠️ Lỗi cập nhật /students.json: {e}")

        try:
            ep_meta = f"{target_url}/metadata.json{auth_param}"
            req_meta = urllib.request.Request(ep_meta, data=json.dumps(metadata, ensure_ascii=False).encode("utf-8"), headers=headers, method="PUT")
            with urllib.request.urlopen(req_meta, timeout=10) as resp:
                pass
        except Exception:
            pass

        if submissions:
            try:
                ep_sub = f"{target_url}/submissions.json{auth_param}"
                req_sub = urllib.request.Request(ep_sub, data=json.dumps(submissions, ensure_ascii=False).encode("utf-8"), headers=headers, method="PUT")
                with urllib.request.urlopen(req_sub, timeout=15) as resp:
                    pass
            except Exception:
                pass

        if not ok_students:
            print("❌ Không thể đồng bộ danh sách học sinh lên Firebase. Vui lòng kiểm tra kết nối mạng hoặc Firebase Rules!")
            return False

    print(f"✅ Đã đồng bộ thành công {len(students)} học sinh và học phí lên Firebase Realtime Database!")

    # Step 3: Đồng bộ auth_tokens nếu có
    if payload.get("auth_tokens"):
        push_tokens_to_firebase(payload["auth_tokens"], target_url)

    return True
