import json
import os
import urllib.request
import sys

sys.stdout.reconfigure(encoding='utf-8')
os.environ.pop("SSLKEYLOGFILE", None)

def read_file(path):
    with open(path, 'r', encoding='utf-8', errors='ignore') as f:
        return f.read()

def get_testcases(prob_name, max_tests=20, max_size_bytes=50000):
    p_dir = os.path.join('TEST', 'TEST', prob_name)
    tests = sorted([t for t in os.listdir(p_dir) if os.path.isdir(os.path.join(p_dir, t))])
    testcases = []
    for t in tests:
        t_path = os.path.join(p_dir, t)
        in_files = [f for f in os.listdir(t_path) if f.upper().endswith('.INP')]
        out_files = [f for f in os.listdir(t_path) if f.upper().endswith('.OUT')]
        if not in_files or not out_files:
            continue
        in_path = os.path.join(t_path, in_files[0])
        out_path = os.path.join(t_path, out_files[0])
        in_sz = os.path.getsize(in_path)
        out_sz = os.path.getsize(out_path)
        if in_sz + out_sz > max_size_bytes:
            continue
        in_content = read_file(in_path)
        out_content = read_file(out_path)
        testcases.append({
            "name": f"Test {t}",
            "input": in_content,
            "output": out_content,
            "sample": (t == '01')
        })
        if len(testcases) >= max_tests:
            break
    return testcases

# 1. HSG-NUMBER
number_tests = get_testcases('NUMBER', max_tests=20, max_size_bytes=5000)
number_cpp = read_file('TEST/Code_Mau/001_CPP/number.cpp')
number_py = read_file('TEST/Code_Mau/002_PY/number.py')

prob_number = {
    "id": "HSG-NUMBER",
    "name": "Biến đổi số",
    "platform": "DeruckOJ",
    "url": "#judge-HSG-NUMBER",
    "badge_color": "emerald",
    "category": "Hệ đếm & Toán",
    "difficulty": "Level 2 • Cơ bản",
    "classes": ["C++ cơ bản", "C++ nâng cao", "Python cơ bản", "Python 1-1", "Tất cả"],
    "points": 2.0,
    "time_limit": "1.0s",
    "memory_limit": "256M",
    "author": "Đề chọn Đội tuyển HSG 2026 - 2027 • THCS Nguyễn Bỉnh Khiêm",
    "types": ["Hệ đếm", "Toán học", "Xử lý số"],
    "description": "Cho hai số nguyên dương $n$ và $k$. Tùy thuộc vào giá trị của chỉ số $k$, bạn cần thực hiện phép biến đổi số $n$ theo một trong các quy tắc sau:\n\n• Nếu $k = 0$: Đổi số $n$ từ hệ thập phân (cơ số 10) sang hệ nhị phân (cơ số 2).\n• Nếu $k = 1$: Đổi số $n$ từ hệ thập phân (cơ số 10) sang hệ thập lục phân (cơ số 16), các chữ cái được viết bằng chữ hoa (A, B, C, D, E, F).\n• Nếu $k = 2$: Tính tổng các chữ số của số nguyên $n$.",
    "input_specification": "Gồm một dòng duy nhất chứa hai số nguyên $n$ và $k$ ($1 \\le n \\le 10^{18}, 0 \\le k \\le 2$), các số được cách nhau bởi khoảng trắng.",
    "output_specification": "In ra một dòng duy nhất chứa kết quả của phép biến đổi tương ứng.",
    "constraints": "• $1 \\le n \\le 10^{18}$\n• $0 \\le k \\le 2$\n\n**Subtasks:**\n- Subtask 1 (20% điểm): $k = 2$.\n- Subtask 2 (40% điểm): $k = 1$.\n- Subtask 3 (40% điểm): $k = 0$.",
    "sample_cases": [
        {
            "input": "10 0\n",
            "output": "1010\n",
            "explanation": "Đổi 10 sang hệ nhị phân (cơ số 2) thu được 1010."
        },
        {
            "input": "10 1\n",
            "output": "A\n",
            "explanation": "Đổi 10 sang hệ thập lục phân (cơ số 16) thu được A."
        },
        {
            "input": "1234 2\n",
            "output": "10\n",
            "explanation": "Tổng các chữ số: 1 + 2 + 3 + 4 = 10."
        }
    ],
    "starter_cpp": number_cpp,
    "starter_py": number_py,
    "testcases": number_tests
}

# 2. HSG-FACTORIAL
factorial_tests = get_testcases('FACTORIAL', max_tests=12, max_size_bytes=25000)
factorial_cpp = read_file('TEST/Code_Mau/001_CPP/factorial.cpp')
factorial_py = read_file('TEST/Code_Mau/002_PY/factorial.py')

prob_factorial = {
    "id": "HSG-FACTORIAL",
    "name": "Giai thừa",
    "platform": "DeruckOJ",
    "url": "#judge-HSG-FACTORIAL",
    "badge_color": "emerald",
    "category": "Số học & Toán",
    "difficulty": "Level 2 • Trung bình",
    "classes": ["C++ cơ bản", "C++ nâng cao", "Python cơ bản", "Python 1-1", "Tất cả"],
    "points": 2.0,
    "time_limit": "1.5s",
    "memory_limit": "256M",
    "author": "Đề chọn Đội tuyển HSG 2026 - 2027 • THCS Nguyễn Bỉnh Khiêm",
    "types": ["Số học", "Công thức Legendre", "Toán học"],
    "description": "Cho $n$ số nguyên dương. Với mỗi số nguyên dương $x$, hãy đếm số lượng chữ số 0 nằm ở tận cùng của giá trị $x!$.\n\n*Nhắc lại*: $x! = 1 \\times 2 \\times 3 \\times \\dots \\times x$ (tích từ 1 đến $x$).",
    "input_specification": "• Dòng đầu tiên chứa số nguyên dương $n$ ($1 \\le n \\le 10^6$).\n• $n$ dòng tiếp theo, mỗi dòng chứa một số nguyên dương $x$ ($1 \\le x \\le 10^{18}$).",
    "output_specification": "In ra một dòng chứa $n$ số nguyên, mỗi số cách nhau một khoảng trắng là đáp án của từng số nguyên trong dãy.",
    "constraints": "• $1 \\le n \\le 10^6$\n• $1 \\le x \\le 10^{18}$\n\n**Subtasks:**\n- Subtask 1 (20% điểm): $1 \\le x \\le 20$.\n- Subtask 2 (30% điểm): $1 \\le x \\le 10^9$.\n- Subtask 3 (50% điểm): $1 \\le x \\le 10^{18}$.",
    "sample_cases": [
        {
            "input": "2\n5\n10\n",
            "output": "1 2\n",
            "explanation": "5! = 120 có 1 chữ số 0 tận cùng.\n10! = 3628800 có 2 chữ số 0 tận cùng."
        }
    ],
    "starter_cpp": factorial_cpp,
    "starter_py": factorial_py,
    "testcases": factorial_tests
}

# 3. HSG-SEGMENT
segment_tests = get_testcases('SEGMENT', max_tests=8, max_size_bytes=30000)
# Thêm sample case của đề thi nếu chưa có trong tests
sample_seg_in = "5 3\n1 5 3 2 4\n"
sample_seg_out = "9 5 1\n10 5 2\n9 4 2\n"
has_sample = any(t['input'].strip() == sample_seg_in.strip() for t in segment_tests)
if not has_sample:
    segment_tests.insert(0, {
        "name": "Sample Test",
        "input": sample_seg_in,
        "output": sample_seg_out,
        "sample": True
    })

segment_cpp = read_file('TEST/Code_Mau/001_CPP/segment.cpp')
segment_py = read_file('TEST/Code_Mau/002_PY/segment.py')

prob_segment = {
    "id": "HSG-SEGMENT",
    "name": "Đoạn con",
    "platform": "DeruckOJ",
    "url": "#judge-HSG-SEGMENT",
    "badge_color": "indigo",
    "category": "Cửa sổ trượt & Deque",
    "difficulty": "Level 3 • Nâng cao",
    "classes": ["C++ nâng cao", "Python 1-1", "Tất cả"],
    "points": 3.0,
    "time_limit": "1.5s",
    "memory_limit": "256M",
    "author": "Đề chọn Đội tuyển HSG 2026 - 2027 • THCS Nguyễn Bỉnh Khiêm",
    "types": ["Sliding Window", "Monotonic Deque", "Cấu trúc dữ liệu"],
    "description": "Cho mảng $A$ gồm $n$ phần tử nguyên dương $A_1, A_2, \\dots, A_n$ và một số nguyên dương $k$ ($k \\le n$). Đoạn con của mảng là một dãy gồm các phần tử liên tiếp nằm trên mảng.\n\n*Yêu cầu*: Xét tất cả các đoạn con có độ dài chính xác bằng $k$ của mảng $A$ (lần lượt từ trái sang phải). Với mỗi đoạn con, hãy tìm và in ra: **Tổng** các phần tử, phần tử **lớn nhất** và phần tử **nhỏ nhất** trong đoạn con đó.",
    "input_specification": "• Dòng đầu tiên chứa hai số nguyên dương $n$ và $k$ ($1 \\le k \\le n \\le 10^6$).\n• Dòng thứ hai chứa $n$ số nguyên dương $A_1, A_2, \\dots, A_n$ ($1 \\le A_i \\le 10^9$), các số cách nhau bởi khoảng trắng.",
    "output_specification": "Gồm $n - k + 1$ dòng. Mỗi dòng chứa 3 số nguyên lần lượt là Tổng, Số lớn nhất, Số bé nhất của đoạn con độ dài $k$ tương ứng (xét từ đoạn con bắt đầu tại phần tử đầu tiên đến đoạn con cuối cùng).",
    "constraints": "• $1 \\le k \\le n \\le 10^6$\n• $1 \\le A_i \\le 10^9$\n\n**Subtasks:**\n- Subtask 1 (10% điểm): $k = n$.\n- Subtask 2 (20% điểm): $n \\le 300$.\n- Subtask 3 (30% điểm): $n \\le 5000$.\n- Subtask 4 (40% điểm): Không có ràng buộc thêm ($n \\le 10^6$).",
    "sample_cases": [
        {
            "input": "5 3\n1 5 3 2 4\n",
            "output": "9 5 1\n10 5 2\n9 4 2\n",
            "explanation": "• Đoạn con 1 {1, 5, 3}: tổng 9, max 5, min 1.\n• Đoạn con 2 {5, 3, 2}: tổng 10, max 5, min 2.\n• Đoạn con 3 {3, 2, 4}: tổng 9, max 4, min 2."
        }
    ],
    "starter_cpp": segment_cpp,
    "starter_py": segment_py,
    "testcases": segment_tests
}

# 4. HSG-DIVISOR
divisor_tests = get_testcases('DIVISOR', max_tests=12, max_size_bytes=25000)
divisor_cpp = read_file('TEST/Code_Mau/001_CPP/divisor.cpp')
divisor_py = read_file('TEST/Code_Mau/002_PY/divisor.py')

prob_divisor = {
    "id": "HSG-DIVISOR",
    "name": "Đếm số ước",
    "platform": "DeruckOJ",
    "url": "#judge-HSG-DIVISOR",
    "badge_color": "amber",
    "category": "Sàng nguyên tố & Số học",
    "difficulty": "Level 3 • Nâng cao",
    "classes": ["C++ cơ bản", "C++ nâng cao", "Python cơ bản", "Python 1-1", "Tất cả"],
    "points": 3.0,
    "time_limit": "1.0s",
    "memory_limit": "256M",
    "author": "Đề chọn Đội tuyển HSG 2026 - 2027 • THCS Nguyễn Bỉnh Khiêm",
    "types": ["Sàng Eratosthenes", "Ước số", "Thừa số nguyên tố"],
    "description": "Cho mảng $A$ gồm $n$ phần tử $A_1, A_2, \\dots, A_n$. Với mỗi phần tử $A_i$ trong mảng, nhiệm vụ của bạn là đếm xem số đó có bao nhiêu ước nguyên dương.",
    "input_specification": "• Dòng đầu tiên chứa số nguyên dương $n$.\n• Dòng thứ hai chứa $n$ số nguyên dương $A_1, A_2, \\dots, A_n$, các số cách nhau bởi một khoảng trắng.",
    "output_specification": "In ra một dòng chứa $n$ số nguyên, số thứ $i$ tương ứng là số lượng ước nguyên dương của phần tử $A_i$. Các số cách nhau bởi khoảng trắng.",
    "constraints": "• $1 \\le n \\le 10^6$\n• $1 \\le A_i \\le 10^{12}$\n\n**Subtasks:**\n- Subtask 1 (10% điểm): $n \\le 1000, A_i \\le 1000$.\n- Subtask 2 (20% điểm): $n \\le 1000, A_i \\le 10^9$.\n- Subtask 3 (30% điểm): $n \\le 1000, A_i \\le 10^{12}$.\n- Subtask 4 (40% điểm): $n \\le 10^6, A_i \\le 10^6$.",
    "sample_cases": [
        {
            "input": "5\n15 30 45 60 75\n",
            "output": "4 8 6 12 6\n",
            "explanation": "• Số 15 có 4 ước (1, 3, 5, 15).\n• Số 30 có 8 ước (1, 2, 3, 5, 6, 10, 15, 30).\n• Số 45 có 6 ước (1, 3, 5, 9, 15, 45).\n• Số 60 có 12 ước (1, 2, 3, 4, 5, 6, 10, 12, 15, 20, 30, 60).\n• Số 75 có 6 ước (1, 3, 5, 15, 25, 75)."
        }
    ],
    "starter_cpp": divisor_cpp,
    "starter_py": divisor_py,
    "testcases": divisor_tests
}

# CONTEST OBJECT
exam_contest = {
    "id": "CONTEST-HSG26",
    "title": "Đề Thi Chọn Đội Tuyển HSG 2026 - 2027",
    "type": "internal",
    "platform": "DeruckOJ",
    "status": "active",
    "duration_minutes": 120,
    "total_points": 10.0,
    "start_time": "2026-09-30T07:30:00",
    "end_time": "2026-11-30T23:59:00",
    "problem_ids": ["HSG-NUMBER", "HSG-FACTORIAL", "HSG-SEGMENT", "HSG-DIVISOR"],
    "description": "Đề thi chính thức Kiểm tra chọn Đội tuyển Học sinh giỏi môn Tin học năm học 2026 – 2027, Trường THCS Nguyễn Bỉnh Khiêm (Thời gian làm bài: 120 phút). Thí sinh nộp bài và chấm tự động trực tiếp trên hệ thống DeruckOJ."
}

# Update docs/data.json
with open('docs/data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# Update or insert problems
prob_dict = {p['id']: p for p in data.get('problems', [])}
for p in [prob_number, prob_factorial, prob_segment, prob_divisor]:
    prob_dict[p['id']] = p
data['problems'] = list(prob_dict.values())

# Update or insert contest
contests_dict = {c['id']: c for c in data.get('contests', [])}
contests_dict[exam_contest['id']] = exam_contest
data['contests'] = list(contests_dict.values())

# Save docs/data.json
with open('docs/data.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f"Added {len([prob_number, prob_factorial, prob_segment, prob_divisor])} problems to docs/data.json.")
print(f"Total problems now: {len(data['problems'])}")
print(f"Total contests now: {len(data['contests'])}")

# Sync contests to Firebase Realtime Database
fb_url = "https://webhoctap-46912-default-rtdb.asia-southeast1.firebasedatabase.app/metadata/contests.json"
try:
    req = urllib.request.Request(
        fb_url,
        data=json.dumps(data['contests'], ensure_ascii=False).encode('utf-8'),
        headers={'Content-Type': 'application/json'},
        method='PUT'
    )
    with urllib.request.urlopen(req) as resp:
        print(f"Firebase RTDB /metadata/contests.json updated (HTTP {resp.status})")
except Exception as e:
    print("Firebase sync error:", e)
