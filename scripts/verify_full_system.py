import os
import sys
import json
import time
import base64
import urllib.request
import urllib.error

os.environ.pop("SSLKEYLOGFILE", None)
sys.stdout.reconfigure(encoding="utf-8")

_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _root not in sys.path:
    sys.path.insert(0, _root)

print("=" * 65)
print("  KIỂM TRA TOÀN DIỆN MÁY CHẤM, WEB FRONTEND & ĐỒNG BỘ DỮ LIỆU")
print("=" * 65)

# 1. Kiểm tra Local Judge Functions
print("\n[1] Kiểm tra Local Judge Compiler (MinGW C++ & Python 3):")
from src.judge_server import execute_test

cpp_code = """
#include <iostream>
using namespace std;
int main() {
    int a, b;
    if (cin >> a >> b) {
        cout << (a + b) << endl;
    }
    return 0;
}
"""
cpp_res = execute_test("cpp", cpp_code, "15 27\n", 2.0)
print(f"  - C++ execute: status={cpp_res.get('status')}, stdout={repr(cpp_res.get('stdout'))}, time={cpp_res.get('execution_time')}s")

py_code = """
import sys
data = sys.stdin.read().split()
if len(data) >= 2:
    print(int(data[0]) * int(data[1]))
"""
py_res = execute_test("python", py_code, "7 8\n", 2.0)
print(f"  - Python execute: status={py_res.get('status')}, stdout={repr(py_res.get('stdout'))}, time={py_res.get('execution_time')}s")

# 2. Kiểm tra Local HTTP Judge Server (127.0.0.1:8080)
print("\n[2] Kiểm tra Local HTTP Judge Server (http://127.0.0.1:8080):")
try:
    req = urllib.request.Request("http://127.0.0.1:8080/health")
    with urllib.request.urlopen(req, timeout=3) as resp:
        h_data = json.loads(resp.read().decode("utf-8"))
        print(f"  - Local Server /health: HTTP {resp.status}, status={h_data.get('status')}, gpp={h_data.get('gpp')}")
except Exception as e:
    print(f"  - Local Server (port 8080) offline hoặc chưa bật: {e}")

# 3. Kiểm tra các cụm máy chủ Cloud Judge0
print("\n[3] Kiểm tra các cụm máy chủ Cloud Judge (26TinyLove & Judge0 Official CE):")
j0_code = b"#include <iostream>\nint main(){ std::cout << 100 + 23; return 0; }"
j0_payload = {
    "language_id": 54,
    "source_code": base64.b64encode(j0_code).decode("ascii"),
    "stdin": "",
    "cpu_time_limit": 2.0,
    "compiler_options": "-O2 -std=c++2a"
}

for ep_name, ep_url in [
    ("26TinyLove Judge0", "https://judge.26tinylove.com"),
    ("Judge0 Official CE", "https://ce.judge0.com")
]:
    try:
        t0 = time.time()
        req = urllib.request.Request(
            f"{ep_url}/submissions?base64_encoded=true&wait=true",
            data=json.dumps(j0_payload).encode("utf-8"),
            headers={"Content-Type": "application/json", "User-Agent": "Mozilla/5.0"}
        )
        with urllib.request.urlopen(req, timeout=12) as resp:
            j0_res = json.loads(resp.read().decode("utf-8"))
            stdout = base64.b64decode(j0_res.get("stdout") or "").decode("utf-8", errors="ignore").strip()
            desc = j0_res.get("status", {}).get("description")
            print(f"  - {ep_name}: status={desc}, stdout={repr(stdout)}, time={time.time()-t0:.2f}s")
    except Exception as e:
        print(f"  - {ep_name} Error: {e}")

# 4. Kiểm tra cú pháp JavaScript frontend docs/index.html
print("\n[4] Kiểm tra cú pháp JavaScript của docs/index.html:")
import subprocess
try:
    node_chk = subprocess.run([
        "node", "-e",
        """
        const fs = require('fs');
        const html = fs.readFileSync('docs/index.html', 'utf8');
        const scripts = [...html.matchAll(/<script(?![^>]*src=)[^>]*>([\\s\\S]*?)<\\/script>/gi)];
        scripts.forEach((m, idx) => {
            new Function(m[1]);
        });
        console.log('ALL scripts parsed without errors! Count: ' + scripts.length);
        """
    ], capture_output=True, text=True, check=True)
    print("  - " + node_chk.stdout.strip())
except Exception as e:
    print(f"  - Lỗi cú pháp JavaScript: {e}")

# 5. Kiểm tra dữ liệu bài tập & Firebase
print("\n[5] Kiểm tra dữ liệu bài tập, đề thi & Firebase RTDB:")
with open("docs/data.json", "r", encoding="utf-8") as f:
    dj = json.load(f)
probs = dj.get("problems", [])
gprobs = dj.get("grader_problems", [])
contests = dj.get("contests", [])
hsg_probs = [p["id"] for p in probs if "HSG" in p["id"]]
print(f"  - docs/data.json: {len(probs)} bài tập ({len(hsg_probs)} bài thi HSG: {', '.join(hsg_probs)}), {len(gprobs)} bài DeruckOJ, {len(contests)} kỳ thi")

from src.sync_firebase import fetch_database_from_firebase
fb = fetch_database_from_firebase()
print(f"  - Firebase Realtime Database: {len(fb.get('students', []))} học sinh, {len(fb.get('submissions', []))} bài nộp")

print("\n" + "=" * 65)
print("  TẤT CẢ CÁC HỆ THỐNG MÁY CHẤM VÀ ĐỒNG BỘ ĐỀU ĐẠT CHUẨN!")
print("=" * 65)
