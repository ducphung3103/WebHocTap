"""
Rebuilds the problem catalog cleanly based on user requirements:
1. External problems with existing judges (MarisaOJ, Codeforces, CSES) remain external (no testcases, no code mẫu).
2. Internal exercises from the 4 Google Docs that do not have an online judge get DeruckOJ testcases.
3. All code mẫu and templates are completely wiped (starter_cpp = "", starter_py = "") so students code from scratch in an empty editor.
"""

import os
import sys
import json
import math

sys.stdout.reconfigure(encoding='utf-8')
os.environ.pop('SSLKEYLOGFILE', None)

_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_PATH = os.path.join(_root, 'docs', 'data.json')

with open(DATA_PATH, 'r', encoding='utf-8') as f:
    data = json.load(f)

# 1. CATALOG OF 33 EXTERNAL PROBLEMS (EXISTING ONLINE JUDGES)
external_problems = [
    {"id": "MARISA-1", "url": "https://marisaoj.com/problem/1", "name": "A + B", "classes": ["C++ cơ bản", "Python cơ bản"], "difficulty": "Level 1", "category": "Cơ bản", "platform": "MarisaOJ", "notes": "Phép cộng 2 số nguyên trên MarisaOJ"},
    {"id": "MARISA-2", "url": "https://marisaoj.com/problem/2", "name": "Chu vi và diện tích hình chữ nhật", "classes": ["C++ cơ bản", "Python cơ bản"], "difficulty": "Level 1", "category": "Cơ bản", "platform": "MarisaOJ", "notes": "Nhập chiều dài và chiều rộng, tính chu vi và diện tích"},
    {"id": "MARISA-3", "url": "https://marisaoj.com/problem/3", "name": "Phép chia", "classes": ["C++ cơ bản", "Python cơ bản"], "difficulty": "Level 1", "category": "Cơ bản", "platform": "MarisaOJ", "notes": "Tính phần nguyên và phần dư của phép chia 2 số nguyên"},
    {"id": "MARISA-4", "url": "https://marisaoj.com/problem/4", "name": "Ba cạnh tam giác", "classes": ["C++ cơ bản", "Python 1-1"], "difficulty": "Level 1", "category": "Cơ bản", "platform": "MarisaOJ", "notes": "Kiểm tra bất đẳng thức tam giác"},
    {"id": "MARISA-6", "url": "https://marisaoj.com/problem/6", "name": "Chia kẹo", "classes": ["Python 1-1"], "difficulty": "Level 1", "category": "Cơ bản", "platform": "MarisaOJ", "notes": "Tính số kẹo mỗi bạn nhận được và số kẹo còn dư"},
    {"id": "MARISA-7", "url": "https://marisaoj.com/problem/7", "name": "Đổi tiền", "classes": ["Python 1-1"], "difficulty": "Level 1", "category": "Cơ bản", "platform": "MarisaOJ", "notes": "Tính số lượng tờ tiền tối thiểu theo mệnh giá"},
    {"id": "MARISA-8", "url": "https://marisaoj.com/problem/8", "name": "Biểu thức a * b % c", "classes": ["C++ cơ bản"], "difficulty": "Level 1", "category": "Cơ bản", "platform": "MarisaOJ", "notes": "Tính giá trị biểu thức tích chia lấy dư"},
    {"id": "MARISA-10", "url": "https://marisaoj.com/problem/10", "name": "Tổng các chữ số", "classes": ["Python 1-1"], "difficulty": "Level 1", "category": "Cơ bản", "platform": "MarisaOJ", "notes": "Tách từng chữ số của số nguyên và tính tổng"},
    {"id": "MARISA-11", "url": "https://marisaoj.com/problem/11", "name": "Số đảo ngược", "classes": ["Python 1-1"], "difficulty": "Level 1", "category": "Cơ bản", "platform": "MarisaOJ", "notes": "Đảo ngược thứ tự các chữ số của số nguyên dương"},
    {"id": "MARISA-13", "url": "https://marisaoj.com/problem/13", "name": "Đổi ký tự hoa thường", "classes": ["C++ cơ bản", "Python 1-1"], "difficulty": "Level 1", "category": "Cơ bản", "platform": "MarisaOJ", "notes": "Chuyển ký tự hoa thành thường và ngược lại"},
    {"id": "MARISA-14", "url": "https://marisaoj.com/problem/14", "name": "Tìm kiếm ký tự", "classes": ["Python 1-1"], "difficulty": "Level 1", "category": "Cơ bản", "platform": "MarisaOJ", "notes": "Kiểm tra sự xuất hiện của ký tự trong xâu"},
    {"id": "MARISA-15", "url": "https://marisaoj.com/problem/15", "name": "In xâu ký tự", "classes": ["C++ cơ bản", "Python cơ bản"], "difficulty": "Level 1", "category": "Cơ bản", "platform": "MarisaOJ", "notes": "Nhập vào 1 xâu và in ra xâu đó nhiều lần"},
    {"id": "MARISA-16", "url": "https://marisaoj.com/problem/16", "name": "Gấp giấy", "classes": ["Python 1-1"], "difficulty": "Level 1", "category": "Cơ bản", "platform": "MarisaOJ", "notes": "Tính độ dày của tờ giấy sau n lần gấp đôi"},
    {"id": "MARISA-20", "url": "https://marisaoj.com/problem/20", "name": "Đếm số chẵn", "classes": ["C++ cơ bản"], "difficulty": "Level 1", "category": "Mảng", "platform": "MarisaOJ", "notes": "Đếm số lượng các số chẵn trong dãy số nguyên"},
    {"id": "MARISA-42", "url": "https://marisaoj.com/problem/42", "name": "Mảng số nguyên chẵn lẻ", "classes": ["C++ cơ bản"], "difficulty": "Level 1", "category": "Mảng", "platform": "MarisaOJ", "notes": "Thao tác trên mảng một chiều: phân loại phần tử chẵn lẻ"},
    {"id": "MARISA-314", "url": "https://marisaoj.com/problem/314", "name": "Chữ số lớn nhất", "classes": ["C++ cơ bản"], "difficulty": "Level 1", "category": "Vòng lặp", "platform": "MarisaOJ", "notes": "Vòng lặp tách chữ số để tìm chữ số có giá trị lớn nhất"},
    {"id": "MARISA-396", "url": "https://marisaoj.com/problem/396", "name": "Độ độc cây nấm", "classes": ["C++ cơ bản"], "difficulty": "Level 1", "category": "Rẽ nhánh", "platform": "MarisaOJ", "notes": "Kiểm tra điều kiện mức độ độc hại T >= 9.0 (VERY TOXIC)"},
    {"id": "MARISA-397", "url": "https://marisaoj.com/problem/397", "name": "Nghiệm phương trình ax + b = 0", "classes": ["C++ cơ bản"], "difficulty": "Level 1", "category": "Toán học", "platform": "MarisaOJ", "notes": "Biện luận và tìm nghiệm nguyên của phương trình bậc nhất"},
    {"id": "MARISA-401", "url": "https://marisaoj.com/problem/401", "name": "Ăn nấm", "classes": ["Python 1-1"], "difficulty": "Level 1", "category": "Cơ bản", "platform": "MarisaOJ", "notes": "Tính số ngày ăn nấm dựa trên số lượng stems"},
    {"id": "MARISA-402", "url": "https://marisaoj.com/problem/402", "name": "Gấp giấy nâng cao", "classes": ["Python 1-1"], "difficulty": "Level 1", "category": "Vòng lặp", "platform": "MarisaOJ", "notes": "Tính số lần gấp giấy cần thiết để đạt độ dày mong muốn"},
    {"id": "MARISA-405", "url": "https://marisaoj.com/problem/405", "name": "Mảng số nguyên", "classes": ["C++ cơ bản"], "difficulty": "Level 1", "category": "Mảng", "platform": "MarisaOJ", "notes": "Khai báo mảng, nhập xuất mảng và tính toán cơ bản"},
    {"id": "MARISA-416", "url": "https://marisaoj.com/problem/416", "name": "Kiểm tra điều kiện số học", "classes": ["Python 1-1"], "difficulty": "Level 1", "category": "Rẽ nhánh", "platform": "MarisaOJ", "notes": "Cấu trúc rẽ nhánh kiểm tra các tính chất số nguyên"},
    {"id": "MARISA-419", "url": "https://marisaoj.com/problem/419", "name": "Điểm thuộc đoạn thẳng", "classes": ["Python 1-1"], "difficulty": "Level 1", "category": "Hình học", "platform": "MarisaOJ", "notes": "Kiểm tra điểm c có nằm trong đoạn [a, b] hay không"},
    {"id": "MARISA-499", "url": "https://marisaoj.com/problem/499", "name": "Tổng ước số", "classes": ["C++ cơ bản"], "difficulty": "Level 1", "category": "Số học", "platform": "MarisaOJ", "notes": "Duyệt tìm tất cả các ước số của số nguyên N và tính tổng"},
    {"id": "MARISA-535", "url": "https://marisaoj.com/problem/535", "name": "Máy tính đơn giản", "classes": ["C++ cơ bản"], "difficulty": "Level 1", "category": "Rẽ nhánh", "platform": "MarisaOJ", "notes": "Mô phỏng máy tính cầm tay thực hiện phép toán +, -, *, /"},
    {"id": "MARISA-536", "url": "https://marisaoj.com/problem/536", "name": "Số đối xứng", "classes": ["C++ cơ bản"], "difficulty": "Level 1", "category": "Số học", "platform": "MarisaOJ", "notes": "Kiểm tra số nguyên có phải là số Palindrome đối xứng hay không"},
    {"id": "MARISA-537", "url": "https://marisaoj.com/problem/537", "name": "Dãy số", "classes": ["C++ cơ bản"], "difficulty": "Level 1", "category": "Dãy số", "platform": "MarisaOJ", "notes": "Tạo và tính toán các phần tử trong dãy số theo quy luật"},
    {"id": "MARISA-541", "url": "https://marisaoj.com/problem/541", "name": "Số chính phương & Căn bậc hai", "classes": ["C++ cơ bản"], "difficulty": "Level 1", "category": "Số học", "platform": "MarisaOJ", "notes": "Kiểm tra số nguyên có phải là số chính phương hay không"},
    {"id": "MARISA-587", "url": "https://marisaoj.com/problem/587", "name": "Hệ thập phân & Đổi cơ số", "classes": ["C++ cơ bản"], "difficulty": "Level 1", "category": "Cơ số", "platform": "MarisaOJ", "notes": "Chuyển đổi số nguyên giữa hệ thập phân và nhị phân"},
    {"id": "CF-486C", "url": "https://codeforces.com/problemset/problem/486/C", "name": "Palindromic Transformation", "classes": ["C++ nâng cao"], "difficulty": "Level 3", "category": "Tham lam", "platform": "Codeforces", "notes": "Biến đổi xâu đối xứng với số thao tác ít nhất"},
    {"id": "CF-214B", "url": "https://codeforces.com/problemset/problem/214/B", "name": "Hometask", "classes": ["C++ nâng cao"], "difficulty": "Level 3", "category": "Số học", "platform": "Codeforces", "notes": "Tạo số lớn nhất chia hết cho 2, 3, 5 từ tập các chữ số cho trước"},
    {"id": "CF-231C", "url": "https://codeforces.com/problemset/problem/231/C", "name": "To Add or Not to Add", "classes": ["C++ nâng cao"], "difficulty": "Level 4", "category": "Hai con trỏ", "platform": "Codeforces", "notes": "Tăng mảng tối đa k thao tác để số phần tử bằng nhau nhiều nhất"},
    {"id": "CSES-1628", "url": "https://cses.fi/problemset/task/1628", "name": "Meet in the Middle", "classes": ["C++ nâng cao"], "difficulty": "Level 4", "category": "Tìm kiếm", "platform": "CSES", "notes": "Đếm số tập con có tổng bằng M với N <= 40 bằng kỹ thuật Meet-in-the-middle"}
]

# Ensure no code mẫu in external problems
for p in external_problems:
    p.pop('starter_cpp', None)
    p.pop('starter_py', None)
    p.pop('testcases', None)

# 2. CATALOG OF INTERNAL EXERCISES (FROM 4 GOOGLE DOCS) NEEDING DERUCKOJ GRADER
# No starter code / code mẫu: starter_cpp = "", starter_py = ""
internal_doc_problems = [
    {
        "id": "CPP-EX-01",
        "name": "Mảng 10 số tự nhiên",
        "classes": ["C++ cơ bản"],
        "difficulty": "Level 1",
        "category": "Mảng",
        "platform": "DeruckOJ",
        "url": "#judge",
        "notes": "Bài tập C++ cơ bản: Nhập vào 10 số tự nhiên và in ra màn hình",
        "description": "Khai báo mảng có độ dài là 10. Nhập vào 10 số tự nhiên bất kỳ cách nhau bởi dấu cách. In ra 10 số tự nhiên đó trên cùng một dòng, cách nhau bởi dấu cách.",
        "input_format": "Một dòng duy nhất gồm 10 số tự nhiên cách nhau bởi dấu cách.",
        "output_format": "In ra 10 số đó trên cùng một dòng, cách nhau bởi dấu cách.",
        "time_limit": 1.0,
        "starter_cpp": "",
        "starter_py": "",
        "testcases": [
            {"input": "1 2 3 4 5 6 7 8 9 10\n", "output": "1 2 3 4 5 6 7 8 9 10\n", "sample": True},
            {"input": "10 9 8 7 6 5 4 3 2 1\n", "output": "10 9 8 7 6 5 4 3 2 1\n", "sample": True},
            {"input": "0 0 0 0 0 0 0 0 0 0\n", "output": "0 0 0 0 0 0 0 0 0 0\n", "sample": False},
            {"input": "5 15 25 35 45 55 65 75 85 95\n", "output": "5 15 25 35 45 55 65 75 85 95\n", "sample": False},
            {"input": "100 200 300 400 500 600 700 800 900 1000\n", "output": "100 200 300 400 500 600 700 800 900 1000\n", "sample": False},
            {"input": "42 17 99 8 23 54 61 72 3 88\n", "output": "42 17 99 8 23 54 61 72 3 88\n", "sample": False}
        ]
    },
    {
        "id": "CPP-EX-02",
        "name": "Phần tử chính giữa mảng",
        "classes": ["C++ cơ bản"],
        "difficulty": "Level 1",
        "category": "Mảng",
        "platform": "DeruckOJ",
        "url": "#judge",
        "notes": "Bài tập C++ cơ bản: Nhập số lẻ n phần tử và in ra phần tử thứ (n + 1) / 2",
        "description": "Cho số nguyên dương lẻ n (1 <= n <= 99). Nhập vào n số nguyên của mảng. Hãy in ra giá trị của phần tử đứng ở vị trí thứ (n + 1) / 2 (chỉ số tính từ 1).",
        "input_format": "Dòng 1 chứa số nguyên lẻ n. Dòng 2 chứa n số nguyên cách nhau bởi dấu cách.",
        "output_format": "In ra một số nguyên duy nhất là giá trị của phần tử chính giữa.",
        "time_limit": 1.0,
        "starter_cpp": "",
        "starter_py": "",
        "testcases": [
            {"input": "5\n10 20 30 40 50\n", "output": "30\n", "sample": True},
            {"input": "3\n7 9 2\n", "output": "9\n", "sample": True},
            {"input": "1\n999\n", "output": "999\n", "sample": False},
            {"input": "7\n1 2 3 100 4 5 6\n", "output": "100\n", "sample": False},
            {"input": "5\n-10 -5 0 5 10\n", "output": "0\n", "sample": False},
            {"input": "9\n8 7 6 5 4 3 2 1 0\n", "output": "4\n", "sample": False}
        ]
    },
    {
        "id": "CPP-EX-03",
        "name": "Kiểm tra chữ hoa thường",
        "classes": ["C++ cơ bản"],
        "difficulty": "Level 1",
        "category": "Rẽ nhánh",
        "platform": "DeruckOJ",
        "url": "#judge",
        "notes": "Bài tập C++ cơ bản: Kiểm tra ký tự hoa hay thường",
        "description": "Cho một ký tự c là chữ cái tiếng Anh. Hãy kiểm tra xem c là chữ cái hoa hay chữ cái thường. Nếu c là chữ cái hoa, in ra 'HOA'. Nếu c là chữ cái thường, in ra 'THUONG'.",
        "input_format": "Một ký tự duy nhất c ('A'..'Z' hoặc 'a'..'z').",
        "output_format": "In ra 'HOA' hoặc 'THUONG'.",
        "time_limit": 1.0,
        "starter_cpp": "",
        "starter_py": "",
        "testcases": [
            {"input": "A\n", "output": "HOA\n", "sample": True},
            {"input": "b\n", "output": "THUONG\n", "sample": True},
            {"input": "Z\n", "output": "HOA\n", "sample": False},
            {"input": "a\n", "output": "THUONG\n", "sample": False},
            {"input": "M\n", "output": "HOA\n", "sample": False},
            {"input": "z\n", "output": "THUONG\n", "sample": False}
        ]
    },
    {
        "id": "CPP-EX-04",
        "name": "Đổi chữ hoa thường",
        "classes": ["C++ cơ bản"],
        "difficulty": "Level 1",
        "category": "Xử lý xâu",
        "platform": "DeruckOJ",
        "url": "#judge",
        "notes": "Bài tập C++ cơ bản: Chuyển hoa sang thường và thường sang hoa",
        "description": "Cho một chữ cái c. Nếu c đang viết hoa thì chuyển về viết thường. Nếu c đang viết thường thì chuyển về viết hoa.",
        "input_format": "Một ký tự duy nhất c ('A'..'Z' hoặc 'a'..'z').",
        "output_format": "In ra ký tự sau khi chuyển đổi.",
        "time_limit": 1.0,
        "starter_cpp": "",
        "starter_py": "",
        "testcases": [
            {"input": "A\n", "output": "a\n", "sample": True},
            {"input": "x\n", "output": "X\n", "sample": True},
            {"input": "B\n", "output": "b\n", "sample": False},
            {"input": "z\n", "output": "Z\n", "sample": False},
            {"input": "M\n", "output": "m\n", "sample": False},
            {"input": "c\n", "output": "C\n", "sample": False}
        ]
    },
    {
        "id": "CPP-EX-05",
        "name": "In số theo chiều ngược lại",
        "classes": ["C++ cơ bản"],
        "difficulty": "Level 1",
        "category": "Vòng lặp",
        "platform": "DeruckOJ",
        "url": "#judge",
        "notes": "Bài tập C++ cơ bản: In các chữ số của n theo chiều ngược lại (số 0 vẫn in)",
        "description": "Cho một số nguyên n (dưới dạng chuỗi hoặc số). Hãy viết chương trình in ra các chữ số của n theo chiều ngược lại (chữ số 0 ở cuối số ban đầu vẫn được in ra khi đảo ngược).",
        "input_format": "Một số nguyên dương n (1 <= n <= 10^18).",
        "output_format": "In ra chuỗi chữ số theo chiều ngược lại.",
        "time_limit": 1.0,
        "starter_cpp": "",
        "starter_py": "",
        "testcases": [
            {"input": "3210\n", "output": "0123\n", "sample": True},
            {"input": "12345\n", "output": "54321\n", "sample": True},
            {"input": "1000\n", "output": "0001\n", "sample": False},
            {"input": "7\n", "output": "7\n", "sample": False},
            {"input": "102030\n", "output": "030201\n", "sample": False},
            {"input": "9876543210\n", "output": "0123456789\n", "sample": False}
        ]
    },
    {
        "id": "PY-EX-01",
        "name": "Chiếc loa phát thanh",
        "classes": ["Python cơ bản"],
        "difficulty": "Level 1",
        "category": "Cơ bản",
        "platform": "DeruckOJ",
        "url": "#judge",
        "notes": "Bài tập Python cơ bản: Lặp lại câu nói được nhập 5 lần",
        "description": "Hãy thiết kế 1 loa phát thanh: Nhập vào một câu nói s từ bàn phím. Loa này sẽ in lặp lại câu nói đó 5 lần, mỗi lần trên 1 dòng riêng biệt.",
        "input_format": "Một dòng chứa câu nói s.",
        "output_format": "In ra 5 dòng, mỗi dòng là câu nói s.",
        "time_limit": 1.0,
        "starter_cpp": "",
        "starter_py": "",
        "testcases": [
            {"input": "Hello\n", "output": "Hello\nHello\nHello\nHello\nHello\n", "sample": True},
            {"input": "Python\n", "output": "Python\nPython\nPython\nPython\nPython\n", "sample": True},
            {"input": "Xin chao Thay Duc\n", "output": "Xin chao Thay Duc\nXin chao Thay Duc\nXin chao Thay Duc\nXin chao Thay Duc\nXin chao Thay Duc\n", "sample": False},
            {"input": "12345\n", "output": "12345\n12345\n12345\n12345\n12345\n", "sample": False}
        ]
    },
    {
        "id": "PY-EX-02",
        "name": "Chú quạ cứng đầu",
        "classes": ["Python cơ bản"],
        "difficulty": "Level 1",
        "category": "Cơ bản",
        "platform": "DeruckOJ",
        "url": "#judge",
        "notes": "Bài tập Python cơ bản: Luôn in ra ToiLaChuQuaCungDau",
        "description": "Hãy tạo ra 1 chú quạ cứng đầu: Kể cả người dùng có nhập vào bất cứ câu gì, chú quạ vẫn chỉ in ra màn hình đúng một câu duy nhất: 'ToiLaChuQuaCungDau'.",
        "input_format": "Một dòng chứa chuỗi ký tự bất kỳ.",
        "output_format": "In ra 'ToiLaChuQuaCungDau'.",
        "time_limit": 1.0,
        "starter_cpp": "",
        "starter_py": "",
        "testcases": [
            {"input": "Xin chao\n", "output": "ToiLaChuQuaCungDau\n", "sample": True},
            {"input": "Ban ten la gi?\n", "output": "ToiLaChuQuaCungDau\n", "sample": True},
            {"input": "123456\n", "output": "ToiLaChuQuaCungDau\n", "sample": False},
            {"input": "Con qua oi\n", "output": "ToiLaChuQuaCungDau\n", "sample": False}
        ]
    },
    {
        "id": "PY-EX-03",
        "name": "Tính số tuổi sau 6 năm",
        "classes": ["Python cơ bản"],
        "difficulty": "Level 1",
        "category": "Toán học",
        "platform": "DeruckOJ",
        "url": "#judge",
        "notes": "Bài tập Python cơ bản: Nhập tuổi x, tính x + 6",
        "description": "Nhập vào số tuổi hiện tại x của 1 bạn học sinh. Hãy tính và in ra số tuổi của bạn đó sau 6 năm nữa.",
        "input_format": "Một số nguyên dương x (1 <= x <= 100).",
        "output_format": "In ra một số nguyên duy nhất là số tuổi sau 6 năm.",
        "time_limit": 1.0,
        "starter_cpp": "",
        "starter_py": "",
        "testcases": [
            {"input": "10\n", "output": "16\n", "sample": True},
            {"input": "15\n", "output": "21\n", "sample": True},
            {"input": "1\n", "output": "7\n", "sample": False},
            {"input": "70\n", "output": "76\n", "sample": False},
            {"input": "25\n", "output": "31\n", "sample": False}
        ]
    },
    {
        "id": "PY-EX-04",
        "name": "In 4 số ngược lại",
        "classes": ["Python cơ bản"],
        "difficulty": "Level 1",
        "category": "Cơ bản",
        "platform": "DeruckOJ",
        "url": "#judge",
        "notes": "Bài tập Python cơ bản: Nhập a, b, c, d và in d c b a",
        "description": "Nhập vào 4 số nguyên a, b, c, d cách nhau bởi dấu cách. In ra 4 số này trên cùng 1 dòng, nhưng theo thứ tự ngược lại (d c b a).",
        "input_format": "Gồm 4 số nguyên a, b, c, d cách nhau bởi dấu cách.",
        "output_format": "In ra 4 số theo thứ tự ngược lại, cách nhau bởi dấu cách.",
        "time_limit": 1.0,
        "starter_cpp": "",
        "starter_py": "",
        "testcases": [
            {"input": "1 2 3 4\n", "output": "4 3 2 1\n", "sample": True},
            {"input": "10 20 30 40\n", "output": "40 30 20 10\n", "sample": True},
            {"input": "-5 0 5 10\n", "output": "10 5 0 -5\n", "sample": False},
            {"input": "7 7 7 7\n", "output": "7 7 7 7\n", "sample": False}
        ]
    },
    {
        "id": "PY-EX-05",
        "name": "Xác định giới tính",
        "classes": ["Python cơ bản"],
        "difficulty": "Level 1",
        "category": "Rẽ nhánh",
        "platform": "DeruckOJ",
        "url": "#judge",
        "notes": "Bài tập Python cơ bản: Rẽ nhánh theo từ nam hoặc nu",
        "description": "Nhập vào một từ s. Nếu s là 'nam', in ra 'Toi la nam'. Nếu s là 'nu', in ra 'Toi la nu'.",
        "input_format": "Một chuỗi ký tự s ('nam' hoặc 'nu').",
        "output_format": "In ra câu thông báo tương ứng.",
        "time_limit": 1.0,
        "starter_cpp": "",
        "starter_py": "",
        "testcases": [
            {"input": "nam\n", "output": "Toi la nam\n", "sample": True},
            {"input": "nu\n", "output": "Toi la nu\n", "sample": True}
        ]
    },
    {
        "id": "PY11-EX-01",
        "name": "Chia nhóm và bạn dư",
        "classes": ["Python 1-1"],
        "difficulty": "Level 1",
        "category": "Toán học",
        "platform": "DeruckOJ",
        "url": "#judge",
        "notes": "Bài tập Python 1-1: Nhập lớp a bạn, nhóm b bạn. In số nhóm và số dư",
        "description": "Một lớp học có a bạn học sinh, được chia đều thành các nhóm, mỗi nhóm có b bạn. Hãy viết chương trình in ra số nhóm chia được và số bạn bị dư (trên cùng 1 dòng cách nhau bởi dấu cách).",
        "input_format": "Hai số nguyên dương a và b cách nhau bởi dấu cách.",
        "output_format": "In ra 2 số nguyên là số nhóm và số bạn dư cách nhau bởi dấu cách.",
        "time_limit": 1.0,
        "starter_cpp": "",
        "starter_py": "",
        "testcases": [
            {"input": "39 10\n", "output": "3 9\n", "sample": True},
            {"input": "50 8\n", "output": "6 2\n", "sample": True},
            {"input": "30 5\n", "output": "6 0\n", "sample": False},
            {"input": "7 10\n", "output": "0 7\n", "sample": False},
            {"input": "100 7\n", "output": "14 2\n", "sample": False}
        ]
    },
    {
        "id": "PY11-EX-02",
        "name": "Quy đổi số ngày ra tuần",
        "classes": ["Python 1-1"],
        "difficulty": "Level 1",
        "category": "Toán học",
        "platform": "DeruckOJ",
        "url": "#judge",
        "notes": "Bài tập Python 1-1: Cho d ngày, hỏi được bao nhiêu tuần, bao nhiêu ngày dư",
        "description": "Cho d ngày. Hãy viết chương trình tính xem d ngày quy đổi được bao nhiêu tuần và bao nhiêu ngày dư (1 tuần = 7 ngày).",
        "input_format": "Một số nguyên không âm d (0 <= d <= 10^9).",
        "output_format": "In ra hai số nguyên cách nhau bởi dấu cách: số tuần và số ngày dư.",
        "time_limit": 1.0,
        "starter_cpp": "",
        "starter_py": "",
        "testcases": [
            {"input": "40\n", "output": "5 5\n", "sample": True},
            {"input": "14\n", "output": "2 0\n", "sample": True},
            {"input": "7\n", "output": "1 0\n", "sample": False},
            {"input": "3\n", "output": "0 3\n", "sample": False},
            {"input": "365\n", "output": "52 1\n", "sample": False},
            {"input": "0\n", "output": "0 0\n", "sample": False}
        ]
    },
    {
        "id": "PY11-EX-03",
        "name": "Tìm căn bậc 3",
        "classes": ["Python 1-1"],
        "difficulty": "Level 1",
        "category": "Toán học",
        "platform": "DeruckOJ",
        "url": "#judge",
        "notes": "Bài tập Python 1-1: Cho a = x^3, tìm số nguyên x",
        "description": "Cho biết x ^ 3 = a. Hãy viết chương trình tìm số nguyên x từ số nguyên a (đảm bảo a là số lập phương của một số nguyên).",
        "input_format": "Một số nguyên a (-10^9 <= a <= 10^9).",
        "output_format": "In ra số nguyên x thỏa mãn x^3 = a.",
        "time_limit": 1.0,
        "starter_cpp": "",
        "starter_py": "",
        "testcases": [
            {"input": "27\n", "output": "3\n", "sample": True},
            {"input": "-8\n", "output": "-2\n", "sample": True},
            {"input": "0\n", "output": "0\n", "sample": False},
            {"input": "1\n", "output": "1\n", "sample": False},
            {"input": "-1\n", "output": "-1\n", "sample": False},
            {"input": "1000000000\n", "output": "1000\n", "sample": False},
            {"input": "-125\n", "output": "-5\n", "sample": False}
        ]
    },
    {
        "id": "26TI-A",
        "name": "Khởi động Contest 26TI",
        "classes": ["C++ nâng cao"],
        "difficulty": "Level 2",
        "category": "Mảng",
        "platform": "DeruckOJ",
        "url": "#judge",
        "notes": "Bài toán khởi động Contest 26TI: Đếm số lượng số chẵn trong mảng n phần tử",
        "description": "Cho số nguyên dương n và một dãy gồm n số nguyên a_1, a_2, ..., a_n. Hãy đếm xem có bao nhiêu số chẵn trong dãy đã cho.",
        "input_format": "Dòng 1 chứa số nguyên n (1 <= n <= 10^5). Dòng 2 chứa n số nguyên a_i (-10^9 <= a_i <= 10^9) cách nhau bởi dấu cách.",
        "output_format": "In ra một số nguyên duy nhất là số lượng số chẵn trong mảng.",
        "time_limit": 1.0,
        "starter_cpp": "",
        "starter_py": "",
        "testcases": [
            {"input": "5\n1 2 3 4 5\n", "output": "2\n", "sample": True},
            {"input": "4\n2 4 6 8\n", "output": "4\n", "sample": True},
            {"input": "3\n1 3 5\n", "output": "0\n", "sample": False},
            {"input": "6\n-2 -4 0 1 3 5\n", "output": "3\n", "sample": False},
            {"input": "1\n0\n", "output": "1\n", "sample": False},
            {"input": "7\n1000000000 999999999 4 8 12 15 17\n", "output": "4\n", "sample": False}
        ]
    }
]

# Combined problem catalog: external (33) + internal doc exercises (14) = 47 problems
all_problems = external_problems + internal_doc_problems
data["problems"] = all_problems
data["grader_problems"] = internal_doc_problems

with open(DATA_PATH, 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f"SUCCESS: Catalog updated with {len(all_problems)} total problems:")
print(f"  - {len(external_problems)} external problems (MarisaOJ, Codeforces, CSES) - NO internal testcases, NO code mẫu.")
print(f"  - {len(internal_doc_problems)} internal doc problems without OJ - DeruckOJ testcases created, NO code mẫu (empty).")
