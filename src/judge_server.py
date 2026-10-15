"""
Local Judge Server for Deruck's Competitive Programming (WebHocTap)
Provides offline, high-speed code compilation and grading for C++ and Python.
"""
import os
import sys
import json
import time
import shutil
import tempfile
import subprocess
from pathlib import Path
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from typing import Dict, Any

# Fix encoding & sanitize SSL
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
os.environ.pop("SSLKEYLOGFILE", None)

_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _root not in sys.path:
    sys.path.insert(0, _root)

from src.core.submission_store import save_local_submission

PORT = 8080

# Detect local compilers
GCC_PATHS = [
    r"D:\Apps\CodeBlocks\MinGW\bin\g++.exe",
    r"C:\Program Files\CodeBlocks\MinGW\bin\g++.exe",
    r"C:\MinGW\bin\g++.exe",
    r"C:\msys64\mingw64\bin\g++.exe",
    shutil.which("g++") or ""
]
GPP_CMD = next((p for p in GCC_PATHS if p and os.path.exists(p)), "")
PYTHON_CMD = sys.executable


from src.core.judge_engine import execute_tests, result


def execute_test(language, code, stdin_data, time_limit=2.0):
    try:
        return execute_tests(language, code, [stdin_data], time_limit, GPP_CMD, PYTHON_CMD)[0]
    except ValueError as error:
        return result('SE', stderr=str(error))


class JudgeHandler(BaseHTTPRequestHandler):
    def _set_cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.send_header("Access-Control-Allow-Private-Network", "true")

    def do_OPTIONS(self):
        self.send_response(200)
        self._set_cors()
        self.end_headers()

    def do_GET(self):
        if self.path == "/health":
            self.send_response(200)
            self._set_cors()
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            data = {
                "status": "ok",
                "gpp": bool(GPP_CMD),
                "python": bool(PYTHON_CMD),
                "gpp_path": GPP_CMD,
                "python_path": PYTHON_CMD,
                "batch": True,
                "version": 2,
                "sync_enabled": True
            }
            self.wfile.write(json.dumps(data).encode("utf-8"))
        elif self.path == "/api/sheet_status":
            self.send_response(200)
            self._set_cors()
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            try:
                from src.sync_to_gsheet import get_spreadsheet
                sh = get_spreadsheet()
                res = {"status": "ok", "spreadsheet_title": sh.title, "worksheets": [w.title for w in sh.worksheets()]}
            except Exception as e:
                res = {"status": "error", "message": str(e)}
            self.wfile.write(json.dumps(res, ensure_ascii=False).encode("utf-8"))
        else:
            self.send_response(404)
            self._set_cors()
            self.end_headers()

    def do_POST(self):
        if self.path in ["/judge", "/run", "/judge-batch"]:
            try:
                length = int(self.headers.get("Content-Length", 0))
                if not 0 < length <= 16 * 1024 * 1024:
                    raise ValueError("Yêu cầu trống hoặc vượt quá 16 MiB.")
                req_data = json.loads(self.rfile.read(length).decode("utf-8"))
                if not isinstance(req_data, dict):
                    raise ValueError("Yêu cầu phải là một JSON object.")
                inputs = req_data.get("inputs") if self.path == "/judge-batch" else [req_data.get("stdin", req_data.get("stdin_data", ""))]
                results = execute_tests(
                    req_data.get("language") or req_data.get("lang") or "cpp",
                    req_data.get("code", ""), inputs, req_data.get("time_limit", 2), GPP_CMD, PYTHON_CMD,
                )
                response = {"results": results} if self.path == "/judge-batch" else results[0]
                status = 200
            except (ValueError, UnicodeError) as error:
                status, response = 400, result('SE', stderr=str(error))
            except Exception:
                status, response = 500, result('SE', stderr='Máy chấm gặp lỗi nội bộ. Vui lòng thử lại.')
            self.send_response(status)
            self._set_cors()
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(json.dumps(response, ensure_ascii=False).encode("utf-8"))

        elif self.path.startswith("/api/"):
            try:
                length = int(self.headers.get("Content-Length", 0))
                body = self.rfile.read(length).decode("utf-8") if length > 0 else "{}"
                req_data = json.loads(body) if body.strip() else {}

                from src import sync_to_gsheet
                from src.sync_gsheets import sync_gsheets

                api_path = self.path.split("?")[0]
                res = {"status": "error", "message": f"Endpoint không hợp lệ: {api_path}"}

                if api_path == "/api/update_tuition":
                    name = req_data.get("name") or req_data.get("student")
                    month = req_data.get("month")
                    is_paid = bool(req_data.get("is_paid") or req_data.get("paid"))
                    res = sync_to_gsheet.update_tuition_in_sheet(name, month, is_paid)

                elif api_path == "/api/update_student_status":
                    name = req_data.get("name") or req_data.get("student")
                    status = req_data.get("status") or req_data.get("new_status")
                    res = sync_to_gsheet.update_student_status_in_sheet(name, status)

                elif api_path == "/api/save_student":
                    st_data = req_data.get("student") or req_data
                    res = sync_to_gsheet.save_student_to_sheet(st_data)

                elif api_path == "/api/save_problem":
                    p_data = req_data.get("problem") or req_data
                    res = sync_to_gsheet.save_problem_to_sheet(p_data)

                elif api_path == "/api/save_curriculum":
                    c_data = req_data.get("lecture") or req_data.get("curriculum") or req_data
                    res = sync_to_gsheet.save_curriculum_to_sheet(c_data)

                elif api_path == "/api/submit_answer":
                    sub_data = req_data.get("submission") or req_data
                    save_local_submission(Path(_root), sub_data)

                    # Push to Google Sheet
                    res = sync_to_gsheet.save_submission_to_sheet(sub_data)

                elif api_path == "/api/grade_submission":
                    sub_id = req_data.get("id") or req_data.get("submission_id")
                    status_val = req_data.get("status", "Đã chấm")
                    score_val = str(req_data.get("score", ""))
                    fb_val = req_data.get("feedback", "")
                    
                    save_local_submission(Path(_root), {
                        "id": sub_id, "status": status_val,
                        "score": score_val, "feedback": fb_val,
                    })

                    # Push to Google Sheet
                    res = sync_to_gsheet.grade_submission_in_sheet(sub_id, status_val, score_val, fb_val)

                elif api_path in ("/api/sync_two_way", "/api/sync_from_sheet"):
                    # Sheets is authoritative. Keep the legacy route read-only too.
                    sync_pull = sync_gsheets(no_push=True)
                    res = {
                        "status": "success" if sync_pull else "error",
                        "pull_success": sync_pull,
                        "message": "Đã đồng bộ từ Google Sheet, không ghi đè dữ liệu gốc." if sync_pull else "Không đọc được Google Sheet."
                    }

                self.send_response(200)
                self._set_cors()
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.end_headers()
                self.wfile.write(json.dumps(res, ensure_ascii=False).encode("utf-8"))
            except Exception as e:
                self.send_response(500)
                self._set_cors()
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "message": str(e)}, ensure_ascii=False).encode("utf-8"))
        else:
            self.send_response(404)
            self._set_cors()
            self.end_headers()

    def log_message(self, format, *args):
        # Clean logging
        pass


def main():
    print("=" * 60)
    print("  🚀 TRÌNH CHẤM LOCAL (LOCAL JUDGE SERVER) - DERUCK CP")
    print("=" * 60)
    print(f"📡 Đang lắng nghe tại: http://127.0.0.1:{PORT}")
    print(f"🔧 G++ C++: {GPP_CMD or 'Chưa cài g++; hãy chọn máy chấm cloud trên web'}")
    print(f"🐍 Python:  {PYTHON_CMD}")
    print("💡 Giữ cửa sổ này mở để chấm bài cực nhanh (sub-second offline)!")
    print("=" * 60)

    server = ThreadingHTTPServer(("127.0.0.1", PORT), JudgeHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nĐã dừng Local Judge Server.")
        server.server_close()


if __name__ == "__main__":
    main()
