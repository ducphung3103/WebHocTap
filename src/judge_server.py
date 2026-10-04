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
from http.server import HTTPServer, BaseHTTPRequestHandler
from typing import Dict, Any

# Fix encoding & sanitize SSL
sys.stdout.reconfigure(encoding='utf-8')
os.environ.pop("SSLKEYLOGFILE", None)

PORT = 8080

# Detect local compilers
GCC_PATHS = [
    r"D:\Apps\CodeBlocks\MinGW\bin\g++.exe",
    r"C:\MinGW\bin\g++.exe",
    r"C:\msys64\mingw64\bin\g++.exe",
    shutil.which("g++") or ""
]
GPP_CMD = next((p for p in GCC_PATHS if p and os.path.exists(p)), "")
PYTHON_CMD = sys.executable


def execute_test(language: str, code: str, stdin_data: str, time_limit: float = 2.0) -> Dict[str, Any]:
    """Compiles and executes code against stdin within time_limit."""
    time_limit = max(0.5, min(time_limit, 5.0))
    temp_dir = tempfile.mkdtemp(prefix="judge_")

    try:
        if language in ["cpp", "c++"]:
            if not GPP_CMD:
                return {
                    "status": "CE",
                    "error": "Không tìm thấy g++.exe trên máy tính. Vui lòng cài đặt MinGW/CodeBlocks hoặc sử dụng trình chấm trực tuyến Wandbox!"
                }

            src_file = os.path.join(temp_dir, "solution.cpp")
            exe_file = os.path.join(temp_dir, "solution.exe")

            with open(src_file, "w", encoding="utf-8") as f:
                f.write(code)

            # Compile step with C++20 (fallback C++17) and -O2 optimization
            compile_cmd = [GPP_CMD, "-O2", "-std=c++20", src_file, "-o", exe_file]
            compile_proc = subprocess.run(compile_cmd, capture_output=True, text=True, timeout=20)
            if compile_proc.returncode != 0:
                # Try fallback to c++17 if c++20 flag is not supported
                compile_cmd = [GPP_CMD, "-O2", "-std=c++17", src_file, "-o", exe_file]
                compile_proc = subprocess.run(compile_cmd, capture_output=True, text=True, timeout=20)
                if compile_proc.returncode != 0:
                    err_msg = compile_proc.stderr or compile_proc.stdout or "Compilation Error"
                    return {
                        "status": "CE",
                        "error": err_msg,
                        "compile_error": err_msg
                    }

            # Run step
            start_t = time.perf_counter()
            try:
                run_proc = subprocess.run(
                    [exe_file],
                    input=stdin_data,
                    capture_output=True,
                    text=True,
                    timeout=time_limit
                )
                dur = round(time.perf_counter() - start_t, 3)
                if run_proc.returncode != 0:
                    return {
                        "status": "RTE",
                        "error": run_proc.stderr or f"Runtime error (exit code {run_proc.returncode})",
                        "time": dur,
                        "execution_time": dur,
                        "output": run_proc.stdout,
                        "stdout": run_proc.stdout
                    }
                return {
                    "status": "OK",
                    "output": run_proc.stdout,
                    "stdout": run_proc.stdout,
                    "time": dur,
                    "execution_time": dur
                }
            except subprocess.TimeoutExpired:
                return {
                    "status": "TLE",
                    "error": f"Quá thời gian cho phép ({time_limit}s)",
                    "time": time_limit,
                    "execution_time": time_limit
                }

        elif language in ["python", "python3", "py"]:
            src_file = os.path.join(temp_dir, "solution.py")
            with open(src_file, "w", encoding="utf-8") as f:
                f.write(code)

            # Python gets an adaptive multiplier (min 2.5s) to ensure fair grading
            py_time_limit = max(float(time_limit) * 2.0, 2.5)
            py_env = {**os.environ, "PYTHONIOENCODING": "utf-8", "PYTHONUNBUFFERED": "1"}

            start_t = time.perf_counter()
            try:
                run_proc = subprocess.run(
                    [PYTHON_CMD, "-u", src_file],
                    input=stdin_data,
                    capture_output=True,
                    text=True,
                    timeout=py_time_limit,
                    env=py_env
                )
                dur = round(time.perf_counter() - start_t, 3)
                if run_proc.returncode != 0:
                    return {
                        "status": "RTE",
                        "error": run_proc.stderr or f"Runtime error (exit code {run_proc.returncode})",
                        "time": dur,
                        "execution_time": dur,
                        "output": run_proc.stdout,
                        "stdout": run_proc.stdout
                    }
                return {
                    "status": "OK",
                    "output": run_proc.stdout,
                    "stdout": run_proc.stdout,
                    "time": dur,
                    "execution_time": dur
                }
            except subprocess.TimeoutExpired:
                return {
                    "status": "TLE",
                    "error": f"Quá thời gian cho phép ({py_time_limit}s)",
                    "time": py_time_limit,
                    "execution_time": py_time_limit
                }

        else:
            return {"status": "CE", "error": f"Ngôn ngữ không được hỗ trợ: {language}", "compile_error": f"Ngôn ngữ không được hỗ trợ: {language}"}

    except Exception as exc:
        return {"status": "RTE", "error": str(exc), "compile_error": str(exc)}
    finally:
        try:
            shutil.rmtree(temp_dir, ignore_errors=True)
        except Exception:
            pass


class JudgeHandler(BaseHTTPRequestHandler):
    def _set_cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")

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
        if self.path in ["/judge", "/run"]:
            try:
                length = int(self.headers.get("Content-Length", 0))
                body = self.rfile.read(length).decode("utf-8")
                req_data = json.loads(body)

                lang = req_data.get("language") or req_data.get("lang") or "cpp"
                code = req_data.get("code", "")
                stdin_data = req_data.get("stdin", "")
                time_limit = float(req_data.get("time_limit", 2.0))

                res = execute_test(lang, code, stdin_data, time_limit)

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
                self.wfile.write(json.dumps({"status": "RTE", "error": str(e)}).encode("utf-8"))

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

                elif api_path == "/api/sync_two_way":
                    reconcile_res = sync_to_gsheet.sync_all_from_local_json()
                    sync_pull = sync_gsheets(no_push=True)
                    res = {
                        "status": "success",
                        "reconcile": reconcile_res,
                        "pull_success": sync_pull,
                        "message": "Đã hoàn thành đồng bộ 2 chiều (Web ⇄ Google Sheet)!"
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
    print(f"🔧 G++ C++: {GPP_CMD or 'Không tìm thấy (sẽ dùng Wandbox online)'}")
    print(f"🐍 Python:  {PYTHON_CMD}")
    print("💡 Giữ cửa sổ này mở để chấm bài cực nhanh (sub-second offline)!")
    print("=" * 60)

    server = HTTPServer(("127.0.0.1", PORT), JudgeHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nĐã dừng Local Judge Server.")
        server.server_close()


if __name__ == "__main__":
    main()
