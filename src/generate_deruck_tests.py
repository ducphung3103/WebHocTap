"""
Automated Testcase & DeruckOJ Problem Generator (WebHocTap)
Generates comprehensive test suites (sample + hidden edge cases: 0, negative, boundary, large values)
for all 34 curated coding problems in the curriculum.
"""

import os
import sys
import json
import random
import math

sys.stdout.reconfigure(encoding='utf-8')

_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_PATH = os.path.join(_root, 'docs', 'data.json')

def generate_all_deruck_problems():
    """Generates complete problem specs with testcases for all 34 coding exercises."""
    
    problems_spec = {}

    # 1. MARISA-1: A + B
    def solve_marisa_1(inp):
        tokens = inp.split()
        return str(int(tokens[0]) + int(tokens[1]))

    tests_1 = [
        {"input": "2 3\n", "is_sample": True, "explain": "2 + 3 = 5"},
        {"input": "-10 15\n", "is_sample": True, "explain": "(-10) + 15 = 5"},
        {"input": "0 0\n", "is_sample": False},
        {"input": "1000000000 2000000000\n", "is_sample": False},
        {"input": "-1000000000 -1000000000\n", "is_sample": False},
        {"input": "999999999 -999999999\n", "is_sample": False},
        {"input": "42 -42\n", "is_sample": False},
        {"input": "123456789 987654321\n", "is_sample": False},
    ]
    for t in tests_1: t["output"] = solve_marisa_1(t["input"]) + "\n"

    problems_spec["MARISA-1"] = {
        "description": "Cho hai số nguyên A và B. Hãy tính và in ra giá trị của tổng A + B.",
        "input_format": "Gồm một dòng chứa hai số nguyên A và B cách nhau bởi dấu cách (-10^9 <= A, B <= 10^9).",
        "output_format": "In ra một số nguyên duy nhất là giá trị của A + B.",
        "starter_cpp": "#include <iostream>\nusing namespace std;\n\nint main() {\n    long long a, b;\n    if (cin >> a >> b) {\n        cout << a + b << \"\\n\";\n    }\n    return 0;\n}",
        "starter_py": "import sys\n\ndef main():\n    data = sys.stdin.read().split()\n    if len(data) >= 2:\n        print(int(data[0]) + int(data[1]))\n\nif __name__ == '__main__':\n    main()",
        "testcases": tests_1
    }

    # 2. MARISA-2: Chu vi và diện tích hình chữ nhật
    def solve_marisa_2(inp):
        tokens = inp.split()
        a, b = int(tokens[0]), int(tokens[1])
        return f"{(a + b) * 2} {a * b}"

    tests_2 = [
        {"input": "3 4\n", "is_sample": True, "explain": "Chu vi = (3+4)*2 = 14, diện tích = 3*4 = 12"},
        {"input": "10 20\n", "is_sample": True, "explain": "Chu vi = (10+20)*2 = 60, diện tích = 10*20 = 200"},
        {"input": "1 1\n", "is_sample": False},
        {"input": "100 50\n", "is_sample": False},
        {"input": "100000 200000\n", "is_sample": False},
        {"input": "1000000 1000000\n", "is_sample": False},
        {"input": "7 13\n", "is_sample": False},
    ]
    for t in tests_2: t["output"] = solve_marisa_2(t["input"]) + "\n"

    problems_spec["MARISA-2"] = {
        "description": "Cho chiều dài và chiều rộng của một hình chữ nhật là hai số nguyên dương a và b. Hãy tính chu vi và diện tích của hình chữ nhật đó.",
        "input_format": "Gồm một dòng chứa hai số nguyên dương a và b (1 <= a, b <= 10^9).",
        "output_format": "In ra hai số nguyên cách nhau một khoảng trắng lần lượt là chu vi và diện tích của hình chữ nhật.",
        "starter_cpp": "#include <iostream>\nusing namespace std;\n\nint main() {\n    long long a, b;\n    if (cin >> a >> b) {\n        cout << (a + b) * 2 << \" \" << a * b << \"\\n\";\n    }\n    return 0;\n}",
        "starter_py": "a, b = map(int, input().split())\nprint(f\"{(a + b) * 2} {a * b}\")",
        "testcases": tests_2
    }

    # 3. MARISA-3: Phép chia
    def solve_marisa_3(inp):
        tokens = inp.split()
        a, b = int(tokens[0]), int(tokens[1])
        return f"{a // b} {a % b}"

    tests_3 = [
        {"input": "10 3\n", "is_sample": True, "explain": "10 chia 3 được 3 dư 1"},
        {"input": "20 5\n", "is_sample": True, "explain": "20 chia 5 được 4 dư 0"},
        {"input": "7 10\n", "is_sample": False},
        {"input": "100 7\n", "is_sample": False},
        {"input": "1000000000 3\n", "is_sample": False},
        {"input": "999999999 999999998\n", "is_sample": False},
        {"input": "1 2\n", "is_sample": False},
    ]
    for t in tests_3: t["output"] = solve_marisa_3(t["input"]) + "\n"

    problems_spec["MARISA-3"] = {
        "description": "Cho hai số nguyên dương a và b. Hãy tìm thương nguyên và số dư của phép chia a cho b.",
        "input_format": "Gồm hai số nguyên dương a và b (1 <= a, b <= 10^18).",
        "output_format": "In ra hai số nguyên cách nhau một khoảng trắng lần lượt là thương nguyên và số dư.",
        "starter_cpp": "#include <iostream>\nusing namespace std;\n\nint main() {\n    long long a, b;\n    if (cin >> a >> b) {\n        cout << a / b << \" \" << a % b << \"\\n\";\n    }\n    return 0;\n}",
        "starter_py": "a, b = map(int, input().split())\nprint(f\"{a // b} {a % b}\")",
        "testcases": tests_3
    }

    # 4. MARISA-4: Ba cạnh tam giác
    def solve_marisa_4(inp):
        tokens = inp.split()
        a, b, c = int(tokens[0]), int(tokens[1]), int(tokens[2])
        if a + b > c and a + c > b and b + c > a:
            return "YES"
        return "NO"

    tests_4 = [
        {"input": "3 4 5\n", "is_sample": True, "explain": "Tam giác vuông thỏa mãn bất đẳng thức tam giác"},
        {"input": "1 2 3\n", "is_sample": True, "explain": "1 + 2 = 3 (không lớn hơn 3) nên không tạo thành tam giác"},
        {"input": "5 5 5\n", "is_sample": False},
        {"input": "10 2 3\n", "is_sample": False},
        {"input": "1000000 1000000 1000000\n", "is_sample": False},
        {"input": "7 10 5\n", "is_sample": False},
        {"input": "1 1 2\n", "is_sample": False},
    ]
    for t in tests_4: t["output"] = solve_marisa_4(t["input"]) + "\n"

    problems_spec["MARISA-4"] = {
        "description": "Cho ba số nguyên dương a, b, c. Hãy kiểm tra xem ba số đó có thể là độ dài ba cạnh của một tam giác hay không.",
        "input_format": "Gồm ba số nguyên dương a, b, c (1 <= a, b, c <= 10^9).",
        "output_format": "In ra \"YES\" nếu tạo thành tam giác, ngược lại in \"NO\".",
        "starter_cpp": "#include <iostream>\nusing namespace std;\n\nint main() {\n    long long a, b, c;\n    if (cin >> a >> b >> c) {\n        if (a + b > c && a + c > b && b + c > a) cout << \"YES\\n\";\n        else cout << \"NO\\n\";\n    }\n    return 0;\n}",
        "starter_py": "a, b, c = map(int, input().split())\nprint(\"YES\" if a + b > c and a + c > b and b + c > a else \"NO\")",
        "testcases": tests_4
    }

    # 5. MARISA-6: Chia kẹo
    def solve_marisa_6(inp):
        tokens = inp.split()
        n, m = int(tokens[0]), int(tokens[1])
        return f"{n // m} {n % m}"

    tests_6 = [
        {"input": "10 3\n", "is_sample": True, "explain": "Mỗi bạn được 3 cái kẹo, còn dư 1 cái"},
        {"input": "15 5\n", "is_sample": True, "explain": "Chia đều mỗi bạn 3 cái kẹo, dư 0"},
        {"input": "1 10\n", "is_sample": False},
        {"input": "100 6\n", "is_sample": False},
        {"input": "1000000000 7\n", "is_sample": False},
        {"input": "50 1\n", "is_sample": False},
    ]
    for t in tests_6: t["output"] = solve_marisa_6(t["input"]) + "\n"

    problems_spec["MARISA-6"] = {
        "description": "Có n chiếc kẹo chia đều cho m bạn học sinh. Hãy tính số kẹo mỗi bạn nhận được và số kẹo còn dư.",
        "input_format": "Gồm hai số nguyên dương n và m (1 <= n, m <= 10^18).",
        "output_format": "In ra hai số nguyên cách nhau một khoảng trắng: số kẹo mỗi bạn nhận được và số kẹo dư.",
        "starter_cpp": "#include <iostream>\nusing namespace std;\n\nint main() {\n    long long n, m;\n    if (cin >> n >> m) cout << n / m << \" \" << n % m << \"\\n\";\n    return 0;\n}",
        "starter_py": "n, m = map(int, input().split())\nprint(f\"{n // m} {n % m}\")",
        "testcases": tests_6
    }

    # 6. MARISA-7: Đổi tiền
    def solve_marisa_7(inp):
        n = int(inp.strip())
        denoms = [500, 200, 100, 50, 20, 10, 5, 2, 1]
        cnt = 0
        for d in denoms:
            cnt += n // d
            n %= d
        return str(cnt)

    tests_7 = [
        {"input": "125\n", "is_sample": True, "explain": "125 = 100 + 20 + 5 -> 3 tờ"},
        {"input": "543\n", "is_sample": True, "explain": "500 + 20 + 20 + 2 + 1 -> 5 tờ"},
        {"input": "1\n", "is_sample": False},
        {"input": "500\n", "is_sample": False},
        {"input": "999\n", "is_sample": False},
        {"input": "1000000\n", "is_sample": False},
        {"input": "8888\n", "is_sample": False},
    ]
    for t in tests_7: t["output"] = solve_marisa_7(t["input"]) + "\n"

    problems_spec["MARISA-7"] = {
        "description": "Có các tờ tiền mệnh giá 500, 200, 100, 50, 20, 10, 5, 2, 1. Cần đổi số tiền N sao cho số tờ tiền nhận được là ít nhất.",
        "input_format": "Một số nguyên dương N (1 <= N <= 10^9).",
        "output_format": "In ra số tờ tiền tối thiểu cần dùng.",
        "starter_cpp": "#include <iostream>\nusing namespace std;\n\nint main() {\n    long long n; cin >> n;\n    int a[] = {500, 200, 100, 50, 20, 10, 5, 2, 1};\n    long long res = 0;\n    for (int x : a) {\n        res += n / x;\n        n %= x;\n    }\n    cout << res << \"\\n\";\n    return 0;\n}",
        "starter_py": "n = int(input())\na = [500, 200, 100, 50, 20, 10, 5, 2, 1]\nans = 0\nfor x in a:\n    ans += n // x\n    n %= x\nprint(ans)",
        "testcases": tests_7
    }

    # 7. MARISA-8: Biểu thức a * b % c
    def solve_marisa_8(inp):
        tokens = inp.split()
        a, b, c = int(tokens[0]), int(tokens[1]), int(tokens[2])
        return str((a * b) % c)

    tests_8 = [
        {"input": "3 4 5\n", "is_sample": True, "explain": "(3 * 4) % 5 = 12 % 5 = 2"},
        {"input": "10 20 7\n", "is_sample": True, "explain": "(10 * 20) % 7 = 200 % 7 = 4"},
        {"input": "100 100 10\n", "is_sample": False},
        {"input": "999999 999999 1000000\n", "is_sample": False},
        {"input": "12345 67890 100\n", "is_sample": False},
        {"input": "0 5 10\n", "is_sample": False},
    ]
    for t in tests_8: t["output"] = solve_marisa_8(t["input"]) + "\n"

    problems_spec["MARISA-8"] = {
        "description": "Cho ba số nguyên a, b, c (c > 0). Hãy tính giá trị của biểu thức (a * b) % c.",
        "input_format": "Gồm ba số nguyên a, b, c (-10^9 <= a, b <= 10^9; 1 <= c <= 10^9).",
        "output_format": "In ra kết quả của biểu thức.",
        "starter_cpp": "#include <iostream>\nusing namespace std;\n\nint main() {\n    long long a, b, c;\n    if (cin >> a >> b >> c) {\n        cout << (a * b) % c << \"\\n\";\n    }\n    return 0;\n}",
        "starter_py": "a, b, c = map(int, input().split())\nprint((a * b) % c)",
        "testcases": tests_8
    }

    # 8. MARISA-10: Tổng các chữ số
    def solve_marisa_10(inp):
        n = inp.strip()
        return str(sum(int(ch) for ch in n if ch.isdigit()))

    tests_10 = [
        {"input": "12345\n", "is_sample": True, "explain": "1 + 2 + 3 + 4 + 5 = 15"},
        {"input": "900\n", "is_sample": True, "explain": "9 + 0 + 0 = 9"},
        {"input": "7\n", "is_sample": False},
        {"input": "999999999\n", "is_sample": False},
        {"input": "1000000000\n", "is_sample": False},
        {"input": "8274619\n", "is_sample": False},
    ]
    for t in tests_10: t["output"] = solve_marisa_10(t["input"]) + "\n"

    problems_spec["MARISA-10"] = {
        "description": "Cho một số nguyên dương N. Hãy tính tổng tất cả các chữ số của N.",
        "input_format": "Một số nguyên dương N (1 <= N <= 10^18).",
        "output_format": "In ra tổng các chữ số của N.",
        "starter_cpp": "#include <iostream>\n#include <string>\nusing namespace std;\n\nint main() {\n    string s; cin >> s;\n    long long sum = 0;\n    for (char c : s) sum += c - '0';\n    cout << sum << \"\\n\";\n    return 0;\n}",
        "starter_py": "s = input().strip()\nprint(sum(int(c) for c in s))",
        "testcases": tests_10
    }

    # 9. MARISA-11: Số đảo ngược
    def solve_marisa_11(inp):
        n = inp.strip()
        rev = n[::-1].lstrip('0')
        return rev if rev else "0"

    tests_11 = [
        {"input": "12345\n", "is_sample": True, "explain": "Đảo ngược thành 54321"},
        {"input": "1200\n", "is_sample": True, "explain": "Đảo ngược là 0021, bỏ số 0 đầu được 21"},
        {"input": "5\n", "is_sample": False},
        {"input": "100000\n", "is_sample": False},
        {"input": "102030405\n", "is_sample": False},
        {"input": "99999\n", "is_sample": False},
    ]
    for t in tests_11: t["output"] = solve_marisa_11(t["input"]) + "\n"

    problems_spec["MARISA-11"] = {
        "description": "Cho một số nguyên dương N. Hãy in ra số đảo ngược của N (bỏ qua các chữ số 0 ở đầu nếu có).",
        "input_format": "Gồm một số nguyên dương N (1 <= N <= 10^18).",
        "output_format": "In ra số đảo ngược.",
        "starter_cpp": "#include <iostream>\n#include <string>\n#include <algorithm>\nusing namespace std;\n\nint main() {\n    string s; cin >> s;\n    reverse(s.begin(), s.end());\n    int i = 0;\n    while (i < s.size() - 1 && s[i] == '0') i++;\n    cout << s.substr(i) << \"\\n\";\n    return 0;\n}",
        "starter_py": "s = input().strip()[::-1].lstrip('0')\nprint(s if s else '0')",
        "testcases": tests_11
    }

    # 10. MARISA-13: Đổi ký tự hoa thường
    def solve_marisa_13(inp):
        ch = inp.strip()[0]
        if ch.islower(): return ch.upper()
        if ch.isupper(): return ch.lower()
        return ch

    tests_13 = [
        {"input": "a\n", "is_sample": True, "explain": "'a' thường đổi thành 'A' hoa"},
        {"input": "Z\n", "is_sample": True, "explain": "'Z' hoa đổi thành 'z' thường"},
        {"input": "m\n", "is_sample": False},
        {"input": "K\n", "is_sample": False},
        {"input": "b\n", "is_sample": False},
        {"input": "X\n", "is_sample": False},
    ]
    for t in tests_13: t["output"] = solve_marisa_13(t["input"]) + "\n"

    problems_spec["MARISA-13"] = {
        "description": "Cho một ký tự chữ cái. Nếu là chữ thường hãy đổi thành chữ hoa, nếu là chữ hoa hãy đổi thành chữ thường.",
        "input_format": "Một ký tự chữ cái duy nhất.",
        "output_format": "In ra ký tự sau khi chuyển đổi.",
        "starter_cpp": "#include <iostream>\nusing namespace std;\n\nint main() {\n    char c; cin >> c;\n    if (c >= 'a' && c <= 'z') c = c - 32;\n    else if (c >= 'A' && c <= 'Z') c = c + 32;\n    cout << c << \"\\n\";\n    return 0;\n}",
        "starter_py": "c = input().strip()\nprint(c.swapcase())",
        "testcases": tests_13
    }

    # 11. MARISA-14: Tìm kiếm ký tự
    def solve_marisa_14(inp):
        lines = inp.strip().split('\n')
        s = lines[0].strip()
        c = lines[1].strip()[0]
        return "YES" if c in s else "NO"

    tests_14 = [
        {"input": "deruck\nr\n", "is_sample": True, "explain": "Ký tự 'r' có trong xâu 'deruck'"},
        {"input": "hello\nz\n", "is_sample": True, "explain": "Ký tự 'z' không có trong 'hello'"},
        {"input": "marisaoj\nm\n", "is_sample": False},
        {"input": "python\nn\n", "is_sample": False},
        {"input": "vietnam\na\n", "is_sample": False},
        {"input": "abcdef\nx\n", "is_sample": False},
    ]
    for t in tests_14: t["output"] = solve_marisa_14(t["input"]) + "\n"

    problems_spec["MARISA-14"] = {
        "description": "Cho xâu ký tự s và một ký tự c. Hãy kiểm tra xem ký tự c có xuất hiện trong xâu s hay không.",
        "input_format": "Dòng 1 chứa xâu s. Dòng 2 chứa ký tự c.",
        "output_format": "In ra \"YES\" nếu ký tự c có trong s, ngược lại in \"NO\".",
        "starter_cpp": "#include <iostream>\n#include <string>\nusing namespace std;\n\nint main() {\n    string s; char c;\n    if (cin >> s >> c) {\n        if (s.find(c) != string::npos) cout << \"YES\\n\";\n        else cout << \"NO\\n\";\n    }\n    return 0;\n}",
        "starter_py": "s = input().strip()\nc = input().strip()\nprint(\"YES\" if c in s else \"NO\")",
        "testcases": tests_14
    }

    # 12. MARISA-15: In xâu ký tự
    def solve_marisa_15(inp):
        tokens = inp.split()
        s = tokens[0]
        k = int(tokens[1])
        return " ".join([s] * k)

    tests_15 = [
        {"input": "Code 3\n", "is_sample": True, "explain": "In 'Code' 3 lần"},
        {"input": "Deruck 2\n", "is_sample": True, "explain": "In 'Deruck' 2 lần"},
        {"input": "Hello 1\n", "is_sample": False},
        {"input": "OJ 5\n", "is_sample": False},
        {"input": "C++ 4\n", "is_sample": False},
    ]
    for t in tests_15: t["output"] = solve_marisa_15(t["input"]) + "\n"

    problems_spec["MARISA-15"] = {
        "description": "Cho một xâu ký tự s và số nguyên dương k. Hãy in ra xâu s lặp lại k lần trên một dòng, cách nhau bởi dấu cách.",
        "input_format": "Một dòng gồm xâu s và số nguyên k (1 <= k <= 100).",
        "output_format": "In ra xâu s lặp lại k lần.",
        "starter_cpp": "#include <iostream>\n#include <string>\nusing namespace std;\n\nint main() {\n    string s; int k;\n    if (cin >> s >> k) {\n        for (int i = 0; i < k; ++i) cout << s << (i == k - 1 ? \"\" : \" \");\n        cout << \"\\n\";\n    }\n    return 0;\n}",
        "starter_py": "s, k = input().split()\nprint(' '.join([s] * int(k)))",
        "testcases": tests_15
    }

    # 13. MARISA-16: Gấp giấy
    def solve_marisa_16(inp):
        n = int(inp.strip())
        return str(2 ** n)

    tests_16 = [
        {"input": "3\n", "is_sample": True, "explain": "2^3 = 8"},
        {"input": "0\n", "is_sample": True, "explain": "2^0 = 1"},
        {"input": "1\n", "is_sample": False},
        {"input": "10\n", "is_sample": False},
        {"input": "20\n", "is_sample": False},
        {"input": "30\n", "is_sample": False},
    ]
    for t in tests_16: t["output"] = solve_marisa_16(t["input"]) + "\n"

    problems_spec["MARISA-16"] = {
        "description": "Một tờ giấy ban đầu có độ dày là 1 đơn vị. Mỗi lần gấp đôi, độ dày tờ giấy tăng gấp đôi. Hỏi sau n lần gấp đôi, độ dày tờ giấy là bao nhiêu?",
        "input_format": "Một số nguyên không âm n (0 <= n <= 60).",
        "output_format": "In ra độ dày của tờ giấy sau n lần gấp (giá trị 2^n).",
        "starter_cpp": "#include <iostream>\nusing namespace std;\n\nint main() {\n    int n; cin >> n;\n    cout << (1ULL << n) << \"\\n\";\n    return 0;\n}",
        "starter_py": "n = int(input())\nprint(2 ** n)",
        "testcases": tests_16
    }

    # 14. MARISA-20: Đếm số chẵn
    def solve_marisa_20(inp):
        tokens = inp.split()
        n = int(tokens[0])
        nums = [int(x) for x in tokens[1:n+1]]
        return str(sum(1 for x in nums if x % 2 == 0))

    tests_20 = [
        {"input": "5\n1 2 3 4 5\n", "is_sample": True, "explain": "Có 2 số chẵn là 2 và 4"},
        {"input": "4\n1 3 5 7\n", "is_sample": True, "explain": "Không có số chẵn nào"},
        {"input": "6\n2 4 6 8 10 12\n", "is_sample": False},
        {"input": "1\n0\n", "is_sample": False},
        {"input": "5\n-2 -4 3 5 0\n", "is_sample": False},
    ]
    for t in tests_20: t["output"] = solve_marisa_20(t["input"]) + "\n"

    problems_spec["MARISA-20"] = {
        "description": "Cho dãy gồm n số nguyên. Hãy đếm xem có bao nhiêu số chẵn trong dãy.",
        "input_format": "Dòng 1 chứa số n (1 <= n <= 10^5). Dòng 2 chứa n số nguyên.",
        "output_format": "In ra số lượng số chẵn.",
        "starter_cpp": "#include <iostream>\nusing namespace std;\n\nint main() {\n    int n; cin >> n;\n    int cnt = 0;\n    for (int i = 0; i < n; ++i) {\n        long long x; cin >> x;\n        if (x % 2 == 0) cnt++;\n    }\n    cout << cnt << \"\\n\";\n    return 0;\n}",
        "starter_py": "n = int(input())\narr = list(map(int, input().split()))\nprint(sum(1 for x in arr if x % 2 == 0))",
        "testcases": tests_20
    }

    # 15. MARISA-42: Mảng số nguyên chẵn lẻ
    def solve_marisa_42(inp):
        tokens = inp.split()
        n = int(tokens[0])
        nums = [int(x) for x in tokens[1:n+1]]
        evens = [str(x) for x in nums if x % 2 == 0]
        odds = [str(x) for x in nums if x % 2 != 0]
        return " ".join(evens + odds)

    tests_42 = [
        {"input": "5\n1 2 3 4 5\n", "is_sample": True, "explain": "Số chẵn: 2 4, số lẻ: 1 3 5"},
        {"input": "4\n8 6 4 2\n", "is_sample": True, "explain": "Toàn bộ là số chẵn"},
        {"input": "3\n1 3 5\n", "is_sample": False},
        {"input": "6\n9 4 7 2 5 8\n", "is_sample": False},
    ]
    for t in tests_42: t["output"] = solve_marisa_42(t["input"]) + "\n"

    problems_spec["MARISA-42"] = {
        "description": "Cho mảng n số nguyên. Hãy sắp xếp và in ra tất cả các số chẵn trước, sau đó in các số lẻ theo thứ tự xuất hiện ban đầu.",
        "input_format": "Dòng 1 chứa n (1 <= n <= 10^5). Dòng 2 chứa n số nguyên.",
        "output_format": "In ra các số chẵn rồi đến các số lẻ cách nhau bởi dấu cách.",
        "starter_cpp": "#include <iostream>\n#include <vector>\nusing namespace std;\n\nint main() {\n    int n; cin >> n;\n    vector<int> e, o;\n    for (int i = 0; i < n; ++i) {\n        int x; cin >> x;\n        if (x % 2 == 0) e.push_back(x);\n        else o.push_back(x);\n    }\n    for (int x : e) cout << x << \" \";\n    for (int x : o) cout << x << \" \";\n    cout << \"\\n\";\n    return 0;\n}",
        "starter_py": "n = int(input())\narr = list(map(int, input().split()))\ne = [str(x) for x in arr if x % 2 == 0]\no = [str(x) for x in arr if x % 2 != 0]\nprint(' '.join(e + o))",
        "testcases": tests_42
    }

    # 16. MARISA-314: Chữ số lớn nhất
    def solve_marisa_314(inp):
        s = inp.strip()
        digits = [int(c) for c in s if c.isdigit()]
        return str(max(digits)) if digits else "0"

    tests_314 = [
        {"input": "38291\n", "is_sample": True, "explain": "Chữ số lớn nhất là 9"},
        {"input": "111\n", "is_sample": True, "explain": "Chữ số lớn nhất là 1"},
        {"input": "700\n", "is_sample": False},
        {"input": "90284\n", "is_sample": False},
        {"input": "5\n", "is_sample": False},
    ]
    for t in tests_314: t["output"] = solve_marisa_314(t["input"]) + "\n"

    problems_spec["MARISA-314"] = {
        "description": "Cho một số nguyên dương N. Hãy tìm chữ số có giá trị lớn nhất trong số N.",
        "input_format": "Một số nguyên dương N (1 <= N <= 10^18).",
        "output_format": "In ra chữ số lớn nhất.",
        "starter_cpp": "#include <iostream>\n#include <string>\n#include <algorithm>\nusing namespace std;\n\nint main() {\n    string s; cin >> s;\n    char mx = '0';\n    for (char c : s) mx = max(mx, c);\n    cout << mx << \"\\n\";\n    return 0;\n}",
        "starter_py": "s = input().strip()\nprint(max(s))",
        "testcases": tests_314
    }

    # 17. MARISA-396: Độ độc cây nấm
    def solve_marisa_396(inp):
        val = float(inp.strip())
        return "VERY TOXIC" if val >= 9.0 else "NORMAL"

    tests_396 = [
        {"input": "9.5\n", "is_sample": True, "explain": "9.5 >= 9.0 -> Rất độc"},
        {"input": "8.9\n", "is_sample": True, "explain": "8.9 < 9.0 -> Bình thường"},
        {"input": "9.0\n", "is_sample": False},
        {"input": "0.0\n", "is_sample": False},
        {"input": "12.4\n", "is_sample": False},
    ]
    for t in tests_396: t["output"] = solve_marisa_396(t["input"]) + "\n"

    problems_spec["MARISA-396"] = {
        "description": "Một loại nấm có chỉ số độc hại T (số thực). Nếu T >= 9.0, nấm được coi là cực độc (\"VERY TOXIC\"). Ngược lại, nấm ở mức bình thường (\"NORMAL\").",
        "input_format": "Một số thực T (0.0 <= T <= 20.0).",
        "output_format": "In ra \"VERY TOXIC\" hoặc \"NORMAL\".",
        "starter_cpp": "#include <iostream>\nusing namespace std;\n\nint main() {\n    double t; cin >> t;\n    if (t >= 9.0) cout << \"VERY TOXIC\\n\";\n    else cout << \"NORMAL\\n\";\n    return 0;\n}",
        "starter_py": "t = float(input())\nprint(\"VERY TOXIC\" if t >= 9.0 else \"NORMAL\")",
        "testcases": tests_396
    }

    # 18. MARISA-397: Nghiệm phương trình ax + b = 0
    def solve_marisa_397(inp):
        tokens = inp.split()
        a, b = int(tokens[0]), int(tokens[1])
        if a == 0:
            return "VOSONGHIEM" if b == 0 else "VONGHIEM"
        ans = -b / a
        return f"{ans:.2f}"

    tests_397 = [
        {"input": "2 -4\n", "is_sample": True, "explain": "2x - 4 = 0 -> x = 2.00"},
        {"input": "0 5\n", "is_sample": True, "explain": "0x + 5 = 0 -> Vô nghiệm"},
        {"input": "0 0\n", "is_sample": False},
        {"input": "3 1\n", "is_sample": False},
        {"input": "-5 10\n", "is_sample": False},
    ]
    for t in tests_397: t["output"] = solve_marisa_397(t["input"]) + "\n"

    problems_spec["MARISA-397"] = {
        "description": "Giải phương trình bậc nhất ax + b = 0 với các hệ số nguyên a và b.",
        "input_format": "Gồm hai số nguyên a và b (-10^4 <= a, b <= 10^4).",
        "output_format": "Nếu vô số nghiệm in \"VOSONGHIEM\". Nếu vô nghiệm in \"VONGHIEM\". Nếu có nghiệm duy nhất in nghiệm làm tròn 2 chữ số thập phân.",
        "starter_cpp": "#include <iostream>\n#include <iomanip>\nusing namespace std;\n\nint main() {\n    double a, b;\n    if (cin >> a >> b) {\n        if (a == 0) {\n            if (b == 0) cout << \"VOSONGHIEM\\n\";\n            else cout << \"VONGHIEM\\n\";\n        } else {\n            cout << fixed << setprecision(2) << -b / a << \"\\n\";\n        }\n    }\n    return 0;\n}",
        "starter_py": "a, b = map(float, input().split())\nif a == 0:\n    print(\"VOSONGHIEM\" if b == 0 else \"VONGHIEM\")\nelse:\n    print(f\"{-b / a:.2f}\")",
        "testcases": tests_397
    }

    # 19. MARISA-401: Ăn nấm
    def solve_marisa_401(inp):
        tokens = inp.split()
        n, k = int(tokens[0]), int(tokens[1])
        # n stems, eat 1 per day, k stems make 1 new mushroom
        days = n
        stems = n
        while stems >= k:
            new_m = stems // k
            days += new_m
            stems = (stems % k) + new_m
        return str(days)

    tests_401 = [
        {"input": "4 2\n", "is_sample": True, "explain": "Ăn 4 nấm có 4 cuống, đổi 2 nấm mới, rồi đổi thêm 1 -> tổng 7 ngày"},
        {"input": "10 3\n", "is_sample": True, "explain": "10 nấm đổi dần được 14 ngày"},
        {"input": "5 5\n", "is_sample": False},
        {"input": "100 2\n", "is_sample": False},
        {"input": "1 2\n", "is_sample": False},
    ]
    for t in tests_401: t["output"] = solve_marisa_401(t["input"]) + "\n"

    problems_spec["MARISA-401"] = {
        "description": "Bạn có n cây nấm. Mỗi ngày bạn ăn 1 cây và giữ lại 1 cuống nấm. Cứ có k cuống nấm bạn có thể đổi lấy 1 cây nấm mới. Hỏi bạn có thể ăn nấm trong bao nhiêu ngày?",
        "input_format": "Hai số nguyên n và k (1 <= n <= 10^6, 2 <= k <= 10^6).",
        "output_format": "In ra số ngày tối đa ăn được nấm.",
        "starter_cpp": "#include <iostream>\nusing namespace std;\n\nint main() {\n    long long n, k;\n    if (cin >> n >> k) {\n        long long days = n, stems = n;\n        while (stems >= k) {\n            long long new_m = stems / k;\n            days += new_m;\n            stems = (stems % k) + new_m;\n        }\n        cout << days << \"\\n\";\n    }\n    return 0;\n}",
        "starter_py": "n, k = map(int, input().split())\ndays = stems = n\nwhile stems >= k:\n    new_m = stems // k\n    days += new_m\n    stems = (stems % k) + new_m\nprint(days)",
        "testcases": tests_401
    }

    # 20. MARISA-402: Gấp giấy nâng cao
    def solve_marisa_402(inp):
        tokens = inp.split()
        a, b = int(tokens[0]), int(tokens[1])
        if a >= b: return "0"
        cnt = 0
        cur = a
        while cur < b:
            cur *= 2
            cnt += 1
        return str(cnt)

    tests_402 = [
        {"input": "1 8\n", "is_sample": True, "explain": "1 -> 2 -> 4 -> 8 (3 lần gấp)"},
        {"input": "5 10\n", "is_sample": True, "explain": "5 -> 10 (1 lần gấp)"},
        {"input": "10 5\n", "is_sample": False},
        {"input": "1 1000\n", "is_sample": False},
        {"input": "3 100\n", "is_sample": False},
    ]
    for t in tests_402: t["output"] = solve_marisa_402(t["input"]) + "\n"

    problems_spec["MARISA-402"] = {
        "description": "Một tờ giấy ban đầu có độ dày là a. Mỗi lần gấp đôi độ dày sẽ tăng lên gấp đôi. Hỏi cần gấp ít nhất bao nhiêu lần để độ dày đạt tối thiểu là b?",
        "input_format": "Hai số nguyên dương a và b (1 <= a, b <= 10^18).",
        "output_format": "In ra số lần gấp tối thiểu.",
        "starter_cpp": "#include <iostream>\nusing namespace std;\n\nint main() {\n    long long a, b; cin >> a >> b;\n    int cnt = 0;\n    while (a < b) { a *= 2; cnt++; }\n    cout << cnt << \"\\n\";\n    return 0;\n}",
        "starter_py": "a, b = map(int, input().split())\ncnt = 0\nwhile a < b:\n    a *= 2\n    cnt += 1\nprint(cnt)",
        "testcases": tests_402
    }

    # 21. MARISA-405: Mảng số nguyên
    def solve_marisa_405(inp):
        tokens = inp.split()
        n = int(tokens[0])
        nums = [int(x) for x in tokens[1:n+1]]
        return str(sum(nums))

    tests_405 = [
        {"input": "4\n1 2 3 4\n", "is_sample": True, "explain": "Tổng 1 + 2 + 3 + 4 = 10"},
        {"input": "3\n-5 10 -2\n", "is_sample": True, "explain": "Tổng (-5) + 10 + (-2) = 3"},
        {"input": "1\n100\n", "is_sample": False},
        {"input": "5\n0 0 0 0 0\n", "is_sample": False},
        {"input": "6\n1000000 2000000 3000000 4000000 5000000 6000000\n", "is_sample": False},
    ]
    for t in tests_405: t["output"] = solve_marisa_405(t["input"]) + "\n"

    problems_spec["MARISA-405"] = {
        "description": "Cho mảng gồm n số nguyên. Hãy tính và in ra tổng của tất cả các phần tử trong mảng.",
        "input_format": "Dòng 1 chứa số nguyên n (1 <= n <= 10^5). Dòng 2 chứa n số nguyên.",
        "output_format": "In ra tổng các phần tử.",
        "starter_cpp": "#include <iostream>\nusing namespace std;\n\nint main() {\n    int n; cin >> n;\n    long long sum = 0;\n    for (int i = 0; i < n; ++i) {\n        long long x; cin >> x;\n        sum += x;\n    }\n    cout << sum << \"\\n\";\n    return 0;\n}",
        "starter_py": "n = int(input())\narr = list(map(int, input().split()))\nprint(sum(arr))",
        "testcases": tests_405
    }

    # 22. MARISA-416: Kiểm tra điều kiện số học
    def solve_marisa_416(inp):
        n = int(inp.strip())
        return "YES" if (n % 2 == 0 and n % 3 == 0) else "NO"

    tests_416 = [
        {"input": "6\n", "is_sample": True, "explain": "6 chia hết cho cả 2 và 3 -> YES"},
        {"input": "8\n", "is_sample": True, "explain": "8 không chia hết cho 3 -> NO"},
        {"input": "12\n", "is_sample": False},
        {"input": "9\n", "is_sample": False},
        {"input": "60\n", "is_sample": False},
    ]
    for t in tests_416: t["output"] = solve_marisa_416(t["input"]) + "\n"

    problems_spec["MARISA-416"] = {
        "description": "Cho số nguyên n. Hãy kiểm tra xem n có đồng thời chia hết cho cả 2 và 3 hay không.",
        "input_format": "Một số nguyên n (-10^9 <= n <= 10^9).",
        "output_format": "In ra \"YES\" nếu thỏa mãn, ngược lại in \"NO\".",
        "starter_cpp": "#include <iostream>\nusing namespace std;\n\nint main() {\n    long long n; cin >> n;\n    if (n % 6 == 0) cout << \"YES\\n\";\n    else cout << \"NO\\n\";\n    return 0;\n}",
        "starter_py": "n = int(input())\nprint(\"YES\" if n % 6 == 0 else \"NO\")",
        "testcases": tests_416
    }

    # 23. MARISA-419: Điểm thuộc đoạn thẳng
    def solve_marisa_419(inp):
        tokens = inp.split()
        a, b, c = int(tokens[0]), int(tokens[1]), int(tokens[2])
        mn, mx = min(a, b), max(a, b)
        return "YES" if mn <= c <= mx else "NO"

    tests_419 = [
        {"input": "1 5 3\n", "is_sample": True, "explain": "3 nằm trong đoạn [1, 5] -> YES"},
        {"input": "1 5 7\n", "is_sample": True, "explain": "7 nằm ngoài đoạn [1, 5] -> NO"},
        {"input": "5 1 3\n", "is_sample": False},
        {"input": "2 2 2\n", "is_sample": False},
        {"input": "-10 10 0\n", "is_sample": False},
    ]
    for t in tests_419: t["output"] = solve_marisa_419(t["input"]) + "\n"

    problems_spec["MARISA-419"] = {
        "description": "Cho ba số nguyên a, b, c. Hãy kiểm tra xem điểm c có thuộc đoạn thẳng [min(a, b), max(a, b)] hay không.",
        "input_format": "Gồm ba số nguyên a, b, c (-10^9 <= a, b, c <= 10^9).",
        "output_format": "In ra \"YES\" nếu c thuộc đoạn, ngược lại in \"NO\".",
        "starter_cpp": "#include <iostream>\n#include <algorithm>\nusing namespace std;\n\nint main() {\n    long long a, b, c; cin >> a >> b >> c;\n    if (c >= min(a, b) && c <= max(a, b)) cout << \"YES\\n\";\n    else cout << \"NO\\n\";\n    return 0;\n}",
        "starter_py": "a, b, c = map(int, input().split())\nprint(\"YES\" if min(a, b) <= c <= max(a, b) else \"NO\")",
        "testcases": tests_419
    }

    # 24. MARISA-499: Tổng ước số
    def solve_marisa_499(inp):
        n = int(inp.strip())
        s = 0
        for i in range(1, int(math.isqrt(n)) + 1):
            if n % i == 0:
                s += i
                if i * i != n:
                    s += n // i
        return str(s)

    tests_499 = [
        {"input": "6\n", "is_sample": True, "explain": "Ước của 6 là 1, 2, 3, 6 -> tổng = 12"},
        {"input": "12\n", "is_sample": True, "explain": "Ước của 12: 1 + 2 + 3 + 4 + 6 + 12 = 28"},
        {"input": "1\n", "is_sample": False},
        {"input": "13\n", "is_sample": False},
        {"input": "36\n", "is_sample": False},
        {"input": "100000\n", "is_sample": False},
    ]
    for t in tests_499: t["output"] = solve_marisa_499(t["input"]) + "\n"

    problems_spec["MARISA-499"] = {
        "description": "Cho số nguyên dương N. Hãy tính tổng tất cả các ước số nguyên dương của N.",
        "input_format": "Một số nguyên dương N (1 <= N <= 10^12).",
        "output_format": "In ra tổng các ước số của N.",
        "starter_cpp": "#include <iostream>\n#include <cmath>\nusing namespace std;\n\nint main() {\n    long long n; cin >> n;\n    long long sum = 0;\n    for (long long i = 1; i * i <= n; ++i) {\n        if (n % i == 0) {\n            sum += i;\n            if (i * i != n) sum += n / i;\n        }\n    }\n    cout << sum << \"\\n\";\n    return 0;\n}",
        "starter_py": "n = int(input())\ns = 0\ni = 1\nwhile i * i <= n:\n    if n % i == 0:\n        s += i\n        if i * i != n: s += n // i\n    i += 1\nprint(s)",
        "testcases": tests_499
    }

    # 25. MARISA-535: Máy tính đơn giản
    def solve_marisa_535(inp):
        tokens = inp.split()
        a = int(tokens[0])
        op = tokens[1]
        b = int(tokens[2])
        if op == '+': return str(a + b)
        if op == '-': return str(a - b)
        if op == '*': return str(a * b)
        if op == '/': return str(a // b)
        return "0"

    tests_535 = [
        {"input": "10 + 5\n", "is_sample": True, "explain": "10 + 5 = 15"},
        {"input": "10 / 3\n", "is_sample": True, "explain": "10 chia 3 lấy nguyên = 3"},
        {"input": "7 - 12\n", "is_sample": False},
        {"input": "8 * 9\n", "is_sample": False},
        {"input": "100 / 5\n", "is_sample": False},
    ]
    for t in tests_535: t["output"] = solve_marisa_535(t["input"]) + "\n"

    problems_spec["MARISA-535"] = {
        "description": "Mô phỏng máy tính cầm tay thực hiện một phép tính giữa hai số nguyên a và b với toán tử '+', '-', '*', '/'.",
        "input_format": "Gồm một dòng chứa a, toán tử op và b.",
        "output_format": "In ra kết quả của phép toán (phép chia lấy phần nguyên).",
        "starter_cpp": "#include <iostream>\nusing namespace std;\n\nint main() {\n    long long a, b; char op;\n    if (cin >> a >> op >> b) {\n        if (op == '+') cout << a + b << \"\\n\";\n        else if (op == '-') cout << a - b << \"\\n\";\n        else if (op == '*') cout << a * b << \"\\n\";\n        else if (op == '/') cout << a / b << \"\\n\";\n    }\n    return 0;\n}",
        "starter_py": "a, op, b = input().split()\na, b = int(a), int(b)\nif op == '+': print(a + b)\nelif op == '-': print(a - b)\nelif op == '*': print(a * b)\nelif op == '/': print(a // b)",
        "testcases": tests_535
    }

    # 26. MARISA-536: Số đối xứng
    def solve_marisa_536(inp):
        s = inp.strip()
        return "YES" if s == s[::-1] else "NO"

    tests_536 = [
        {"input": "12321\n", "is_sample": True, "explain": "Số đối xứng -> YES"},
        {"input": "12345\n", "is_sample": True, "explain": "Không đối xứng -> NO"},
        {"input": "9\n", "is_sample": False},
        {"input": "10\n", "is_sample": False},
        {"input": "10001\n", "is_sample": False},
        {"input": "888888\n", "is_sample": False},
    ]
    for t in tests_536: t["output"] = solve_marisa_536(t["input"]) + "\n"

    problems_spec["MARISA-536"] = {
        "description": "Một số được gọi là số đối xứng (Palindrome) nếu đọc từ trái sang phải hay từ phải sang trái đều như nhau. Hãy kiểm tra xem số nguyên N có đối xứng hay không.",
        "input_format": "Một số nguyên dương N (1 <= N <= 10^18).",
        "output_format": "In ra \"YES\" nếu là số đối xứng, ngược lại in \"NO\".",
        "starter_cpp": "#include <iostream>\n#include <string>\nusing namespace std;\n\nint main() {\n    string s; cin >> s;\n    string r = s;\n    for (int i = 0; i < s.size() / 2; ++i) swap(r[i], r[s.size() - 1 - i]);\n    if (s == r) cout << \"YES\\n\";\n    else cout << \"NO\\n\";\n    return 0;\n}",
        "starter_py": "s = input().strip()\nprint(\"YES\" if s == s[::-1] else \"NO\")",
        "testcases": tests_536
    }

    # 27. MARISA-537: Dãy số
    def solve_marisa_537(inp):
        n = int(inp.strip())
        # Dãy số tự nhiên 1 + 2 + ... + n
        return str(n * (n + 1) // 2)

    tests_537 = [
        {"input": "5\n", "is_sample": True, "explain": "1 + 2 + 3 + 4 + 5 = 15"},
        {"input": "10\n", "is_sample": True, "explain": "Tổng 1 đến 10 = 55"},
        {"input": "1\n", "is_sample": False},
        {"input": "100\n", "is_sample": False},
        {"input": "1000000\n", "is_sample": False},
    ]
    for t in tests_537: t["output"] = solve_marisa_537(t["input"]) + "\n"

    problems_spec["MARISA-537"] = {
        "description": "Cho số nguyên dương n. Hãy tính tổng của dãy số: S = 1 + 2 + 3 + ... + n.",
        "input_format": "Một số nguyên dương n (1 <= n <= 10^9).",
        "output_format": "In ra tổng S.",
        "starter_cpp": "#include <iostream>\nusing namespace std;\n\nint main() {\n    long long n; cin >> n;\n    cout << n * (n + 1) / 2 << \"\\n\";\n    return 0;\n}",
        "starter_py": "n = int(input())\nprint(n * (n + 1) // 2)",
        "testcases": tests_537
    }

    # 28. MARISA-541: Số chính phương & Căn bậc hai
    def solve_marisa_541(inp):
        n = int(inp.strip())
        if n < 0: return "NO"
        r = int(math.isqrt(n))
        return "YES" if r * r == n else "NO"

    tests_541 = [
        {"input": "16\n", "is_sample": True, "explain": "16 = 4^2 là số chính phương -> YES"},
        {"input": "15\n", "is_sample": True, "explain": "15 không phải số chính phương -> NO"},
        {"input": "0\n", "is_sample": False},
        {"input": "1\n", "is_sample": False},
        {"input": "1000000\n", "is_sample": False},
        {"input": "999999\n", "is_sample": False},
    ]
    for t in tests_541: t["output"] = solve_marisa_541(t["input"]) + "\n"

    problems_spec["MARISA-541"] = {
        "description": "Số chính phương là số bằng bình phương của một số nguyên. Cho số nguyên không âm N, hãy kiểm tra xem N có phải là số chính phương hay không.",
        "input_format": "Một số nguyên không âm N (0 <= N <= 10^18).",
        "output_format": "In ra \"YES\" nếu là số chính phương, ngược lại in \"NO\".",
        "starter_cpp": "#include <iostream>\n#include <cmath>\nusing namespace std;\n\nint main() {\n    long long n; cin >> n;\n    long long r = round(sqrt(n));\n    if (r * r == n) cout << \"YES\\n\";\n    else cout << \"NO\\n\";\n    return 0;\n}",
        "starter_py": "import math\nn = int(input())\nr = math.isqrt(n)\nprint(\"YES\" if r * r == n else \"NO\")",
        "testcases": tests_541
    }

    # 29. MARISA-587: Hệ thập phân & Đổi cơ số
    def solve_marisa_587(inp):
        n = int(inp.strip())
        return bin(n)[2:]

    tests_587 = [
        {"input": "10\n", "is_sample": True, "explain": "10 ở hệ nhị phân là 1010"},
        {"input": "7\n", "is_sample": True, "explain": "7 ở hệ nhị phân là 111"},
        {"input": "0\n", "is_sample": False},
        {"input": "1\n", "is_sample": False},
        {"input": "16\n", "is_sample": False},
        {"input": "255\n", "is_sample": False},
        {"input": "1024\n", "is_sample": False},
    ]
    for t in tests_587: t["output"] = solve_marisa_587(t["input"]) + "\n"

    problems_spec["MARISA-587"] = {
        "description": "Cho một số nguyên không âm N ở hệ thập phân. Hãy chuyển đổi N sang hệ nhị phân và in ra kết quả.",
        "input_format": "Một số nguyên không âm N (0 <= N <= 10^18).",
        "output_format": "In ra dãy số nhị phân biểu diễn N.",
        "starter_cpp": "#include <iostream>\n#include <string>\n#include <algorithm>\nusing namespace std;\n\nint main() {\n    long long n; cin >> n;\n    if (n == 0) { cout << 0 << \"\\n\"; return 0; }\n    string res = \"\";\n    while (n > 0) {\n        res += (n % 2 == 1 ? '1' : '0');\n        n /= 2;\n    }\n    reverse(res.begin(), res.end());\n    cout << res << \"\\n\";\n    return 0;\n}",
        "starter_py": "n = int(input())\nprint(bin(n)[2:])",
        "testcases": tests_587
    }

    # 30. 26TI-A: Khởi động Contest 26TI
    def solve_26ti_a(inp):
        tokens = inp.split()
        n = int(tokens[0])
        nums = [int(x) for x in tokens[1:n+1]]
        return f"{min(nums)} {max(nums)}"

    tests_26ti_a = [
        {"input": "5\n3 1 4 1 5\n", "is_sample": True, "explain": "Min = 1, Max = 5"},
        {"input": "3\n10 20 30\n", "is_sample": True, "explain": "Min = 10, Max = 30"},
        {"input": "1\n42\n", "is_sample": False},
        {"input": "4\n-10 -5 0 10\n", "is_sample": False},
    ]
    for t in tests_26ti_a: t["output"] = solve_26ti_a(t["input"]) + "\n"

    problems_spec["26TI-A"] = {
        "description": "Bài toán khởi động kiểm tra kỹ năng tư duy và cài đặt: Cho mảng n số nguyên. Hãy tìm giá trị nhỏ nhất và lớn nhất trong mảng.",
        "input_format": "Dòng 1 chứa n (1 <= n <= 10^5). Dòng 2 chứa n số nguyên.",
        "output_format": "In ra min và max cách nhau một khoảng trắng.",
        "starter_cpp": "#include <iostream>\n#include <algorithm>\nusing namespace std;\n\nint main() {\n    int n; cin >> n;\n    long long mn = 2e18, mx = -2e18;\n    for (int i = 0; i < n; ++i) {\n        long long x; cin >> x;\n        mn = min(mn, x);\n        mx = max(mx, x);\n    }\n    cout << mn << \" \" << mx << \"\\n\";\n    return 0;\n}",
        "starter_py": "n = int(input())\narr = list(map(int, input().split()))\nprint(f\"{min(arr)} {max(arr)}\")",
        "testcases": tests_26ti_a
    }

    # 31. CF-486C: Palindromic Transformation
    def solve_cf_486c(inp):
        tokens = inp.split()
        n = int(tokens[0])
        p = int(tokens[1]) - 1
        s = tokens[2]
        if p >= n // 2:
            p = n - 1 - p
        change_cost = 0
        diff_indices = []
        for i in range(n // 2):
            c1, c2 = ord(s[i]), ord(s[n - 1 - i])
            if c1 != c2:
                diff = abs(c1 - c2)
                change_cost += min(diff, 26 - diff)
                diff_indices.append(i)
        if not diff_indices:
            return "0"
        move_cost = (diff_indices[-1] - diff_indices[0]) + min(abs(p - diff_indices[0]), abs(p - diff_indices[-1]))
        return str(change_cost + move_cost)

    tests_486c = [
        {"input": "8 3\naeabcaez\n", "is_sample": True, "explain": "Ví dụ mẫu Codeforces 486C"},
        {"input": "4 2\nabba\n", "is_sample": True, "explain": "Đã đối xứng sẵn -> 0"},
        {"input": "1 1\na\n", "is_sample": False},
        {"input": "6 1\nabcdef\n", "is_sample": False},
    ]
    for t in tests_486c: t["output"] = solve_cf_486c(t["input"]) + "\n"

    problems_spec["CF-486C"] = {
        "description": "Cho xâu s độ dài n và vị trí con trỏ p. Mỗi thao tác có thể dịch chuyển con trỏ sang trái/phải 1 vị trí, hoặc tăng/giảm ký tự tại vị trí hiện tại theo vòng tròn chữ cái ('a' <-> 'z'). Hãy tìm số thao tác ít nhất để biến xâu s thành xâu đối xứng (Palindrome).",
        "input_format": "Dòng 1: n và p (1 <= p <= n <= 10^5). Dòng 2: xâu ký tự s gồm các chữ cái tiếng Anh in thường.",
        "output_format": "In ra số thao tác tối thiểu.",
        "starter_cpp": "#include <iostream>\n#include <string>\n#include <vector>\n#include <cmath>\nusing namespace std;\n\nint main() {\n    ios_base::sync_with_stdio(false); cin.tie(0);\n    int n, p; string s;\n    if (cin >> n >> p >> s) {\n        p--;\n        if (p >= n / 2) p = n - 1 - p;\n        int ans = 0, l = -1, r = -1;\n        for (int i = 0; i < n / 2; ++i) {\n            int d = abs(s[i] - s[n - 1 - i]);\n            if (d > 0) {\n                ans += min(d, 26 - d);\n                if (l == -1) l = i;\n                r = i;\n            }\n        }\n        if (l != -1) ans += (r - l) + min(abs(p - l), abs(p - r));\n        cout << ans << \"\\n\";\n    }\n    return 0;\n}",
        "starter_py": "n, p = map(int, input().split())\ns = input().strip()\np -= 1\nif p >= n // 2: p = n - 1 - p\nans, diffs = 0, []\nfor i in range(n // 2):\n    d = abs(ord(s[i]) - ord(s[n - 1 - i]))\n    if d > 0:\n        ans += min(d, 26 - d)\n        diffs.append(i)\nif diffs:\n    ans += (diffs[-1] - diffs[0]) + min(abs(p - diffs[0]), abs(p - diffs[-1]))\nprint(ans)",
        "testcases": tests_486c
    }

    # 32. CF-214B: Hometask
    def solve_cf_214b(inp):
        tokens = inp.split()
        n = int(tokens[0])
        digits = sorted([int(x) for x in tokens[1:n+1]], reverse=True)
        if 0 not in digits:
            return "-1"
        s = sum(digits)
        rem = s % 3
        if rem != 0:
            # Try remove 1 digit with same rem
            cand1 = [i for i, d in enumerate(digits) if d % 3 == rem]
            if cand1:
                del digits[cand1[-1]]
            else:
                # Remove 2 digits with (3 - rem)
                cand2 = [i for i, d in enumerate(digits) if d % 3 == (3 - rem)]
                if len(cand2) >= 2:
                    del digits[cand2[-1]]
                    del digits[cand2[-2]]
                else:
                    return "-1"
        if 0 not in digits:
            return "-1"
        if all(d == 0 for d in digits):
            return "0"
        return "".join(map(str, digits))

    tests_214b = [
        {"input": "1\n0\n", "is_sample": True, "explain": "0 chia hết cho 2, 3, 5"},
        {"input": "4\n1 2 3 0\n", "is_sample": True, "explain": "Tạo số 3120 chia hết cho 2, 3, 5"},
        {"input": "3\n5 5 5\n", "is_sample": False},
        {"input": "5\n0 0 0 0 0\n", "is_sample": False},
        {"input": "6\n9 8 7 1 0 0\n", "is_sample": False},
    ]
    for t in tests_214b: t["output"] = solve_cf_214b(t["input"]) + "\n"

    problems_spec["CF-214B"] = {
        "description": "Cho n chữ số. Hãy tạo ra số nguyên lớn nhất có thể từ một tập con các chữ số đã cho sao cho số đó chia hết cho 2, 3 và 5.",
        "input_format": "Dòng 1 chứa n (1 <= n <= 10^5). Dòng 2 chứa n chữ số.",
        "output_format": "In ra số lớn nhất tạo được, hoặc -1 nếu không thể tạo được số nào.",
        "starter_cpp": "#include <iostream>\n#include <vector>\n#include <algorithm>\n#include <numeric>\nusing namespace std;\n\nint main() {\n    int n; if (!(cin >> n)) return 0;\n    vector<int> a(n);\n    bool has0 = false; int sum = 0;\n    for (int i = 0; i < n; ++i) { cin >> a[i]; if (a[i] == 0) has0 = true; sum += a[i]; }\n    if (!has0) { cout << -1 << \"\\n\"; return 0; }\n    sort(a.rbegin(), a.rend());\n    int rem = sum % 3;\n    if (rem != 0) {\n        int del1 = -1;\n        for (int i = n - 1; i >= 0; --i) if (a[i] % 3 == rem) { del1 = i; break; }\n        if (del1 != -1) a.erase(a.begin() + del1);\n        else {\n            int d1 = -1, d2 = -1;\n            for (int i = n - 1; i >= 0; --i) {\n                if (a[i] % 3 == 3 - rem) {\n                    if (d1 == -1) d1 = i;\n                    else if (d2 == -1) { d2 = i; break; }\n                }\n            }\n            if (d1 != -1 && d2 != -1) { a.erase(a.begin() + d1); a.erase(a.begin() + d2); }\n            else { cout << -1 << \"\\n\"; return 0; }\n        }\n    }\n    if (a.empty() || a[0] == 0) { cout << 0 << \"\\n\"; return 0; }\n    for (int x : a) cout << x;\n    cout << \"\\n\";\n    return 0;\n}",
        "starter_py": "n = int(input())\na = sorted(list(map(int, input().split())), reverse=True)\nif 0 not in a: print(-1)\nelse:\n    rem = sum(a) % 3\n    if rem:\n        c1 = [i for i, x in enumerate(a) if x % 3 == rem]\n        if c1: del a[c1[-1]]\n        else:\n            c2 = [i for i, x in enumerate(a) if x % 3 == 3 - rem]\n            if len(c2) >= 2:\n                del a[c2[-1]]; del a[c2[-2]]\n            else: a = []\n    if not a or 0 not in a: print(-1)\n    elif a[0] == 0: print(0)\n    else: print(''.join(map(str, a)))",
        "testcases": tests_214b
    }

    # 33. CF-231C: To Add or Not to Add
    def solve_cf_231c(inp):
        tokens = inp.split()
        n = int(tokens[0])
        k = int(tokens[1])
        a = sorted([int(x) for x in tokens[2:n+2]])
        best_len = 0
        best_val = a[0]
        j = 0
        cur_sum = 0
        for i in range(n):
            if i > 0:
                cur_sum += (a[i] - a[i-1]) * (i - j)
            while cur_sum > k:
                cur_sum -= (a[i] - a[j])
                j += 1
            length = i - j + 1
            if length > best_len:
                best_len = length
                best_val = a[i]
        return f"{best_len} {best_val}"

    tests_231c = [
        {"input": "3 1\n2 3 4\n", "is_sample": True, "explain": "Tăng 1 phần tử lên 1: 3->4 tạo thành 2 số 4 -> in 2 4"},
        {"input": "5 3\n6 3 4 1 5\n", "is_sample": True, "explain": "Tối đa 3 phần tử bằng 6"},
        {"input": "1 10\n100\n", "is_sample": False},
        {"input": "4 0\n1 2 2 3\n", "is_sample": False},
    ]
    for t in tests_231c: t["output"] = solve_cf_231c(t["input"]) + "\n"

    problems_spec["CF-231C"] = {
        "description": "Cho mảng a gồm n số nguyên. Bạn được phép thực hiện tối đa k thao tác tăng 1 phần tử bất kỳ lên 1 đơn vị. Hãy tìm cách thực hiện để số lượng phần tử bằng nhau trong mảng là lớn nhất có thể. In ra số lượng phần tử bằng nhau tối đa và giá trị của phần tử đó.",
        "input_format": "Dòng 1: n và k (1 <= n <= 10^5, 0 <= k <= 10^14). Dòng 2: n số nguyên a[i].",
        "output_format": "In ra hai số nguyên: số lượng phần tử bằng nhau tối đa và giá trị đó (nếu có nhiều giá trị cho cùng kết quả, in giá trị nhỏ nhất).",
        "starter_cpp": "#include <iostream>\n#include <vector>\n#include <algorithm>\nusing namespace std;\n\nint main() {\n    int n; long long k; cin >> n >> k;\n    vector<long long> a(n);\n    for (int i = 0; i < n; ++i) cin >> a[i];\n    sort(a.begin(), a.end());\n    int best_len = 0; long long best_val = a[0];\n    long long cur_sum = 0;\n    int j = 0;\n    for (int i = 0; i < n; ++i) {\n        if (i > 0) cur_sum += (a[i] - a[i - 1]) * (i - j);\n        while (cur_sum > k) {\n            cur_sum -= (a[i] - a[j]);\n            j++;\n        }\n        if (i - j + 1 > best_len) {\n            best_len = i - j + 1;\n            best_val = a[i];\n        }\n    }\n    cout << best_len << \" \" << best_val << \"\\n\";\n    return 0;\n}",
        "starter_py": "n, k = map(int, input().split())\na = sorted(list(map(int, input().split())))\nbest_len, best_val = 0, a[0]\ncur_sum, j = 0, 0\nfor i in range(n):\n    if i > 0: cur_sum += (a[i] - a[i - 1]) * (i - j)\n    while cur_sum > k:\n        cur_sum -= (a[i] - a[j])\n        j += 1\n    if i - j + 1 > best_len:\n        best_len = i - j + 1\n        best_val = a[i]\nprint(f\"{best_len} {best_val}\")",
        "testcases": tests_231c
    }

    # 34. CSES-1628: Meet in the Middle
    def solve_cses_1628(inp):
        tokens = inp.split()
        n = int(tokens[0])
        x = int(tokens[1])
        a = [int(v) for v in tokens[2:n+2]]
        mid = n // 2
        left = a[:mid]
        right = a[mid:]
        
        from collections import Counter
        left_sums = Counter()
        for mask in range(1 << len(left)):
            s = sum(left[i] for i in range(len(left)) if (mask & (1 << i)))
            if s <= x:
                left_sums[s] += 1
        
        ans = 0
        for mask in range(1 << len(right)):
            s = sum(right[i] for i in range(len(right)) if (mask & (1 << i)))
            if s <= x:
                ans += left_sums[x - s]
        return str(ans)

    tests_1628 = [
        {"input": "4 5\n1 2 3 2\n", "is_sample": True, "explain": "Các tập con có tổng = 5: {1, 2, 2}, {2, 3}, {3, 2} -> 3 cách"},
        {"input": "3 10\n1 2 3\n", "is_sample": True, "explain": "Không có tập nào -> 0"},
        {"input": "1 5\n5\n", "is_sample": False},
        {"input": "6 7\n1 1 1 1 1 1\n", "is_sample": False},
        {"input": "8 15\n2 3 5 7 11 13 17 19\n", "is_sample": False},
    ]
    for t in tests_1628: t["output"] = solve_cses_1628(t["input"]) + "\n"

    problems_spec["CSES-1628"] = {
        "description": "Cho mảng gồm n số nguyên và một số nguyên x. Hãy đếm số lượng tập con của mảng có tổng đúng bằng x (n <= 40). Sử dụng kỹ thuật Meet-in-the-middle.",
        "input_format": "Dòng 1: n và x (1 <= n <= 40, 1 <= x <= 10^9). Dòng 2: n số nguyên dương.",
        "output_format": "In ra số tập con có tổng bằng x.",
        "starter_cpp": "#include <iostream>\n#include <vector>\n#include <algorithm>\nusing namespace std;\n\nvoid get_sums(const vector<long long>& v, vector<long long>& res, long long limit) {\n    int n = v.size();\n    for (int mask = 0; mask < (1 << n); ++mask) {\n        long long s = 0;\n        for (int i = 0; i < n; ++i) if (mask & (1 << i)) s += v[i];\n        if (s <= limit) res.push_back(s);\n    }\n}\n\nint main() {\n    int n; long long x; cin >> n >> x;\n    vector<long long> a(n);\n    for (int i = 0; i < n; ++i) cin >> a[i];\n    int mid = n / 2;\n    vector<long long> left(a.begin(), a.begin() + mid);\n    vector<long long> right(a.begin() + mid, a.end());\n    vector<long long> s1, s2;\n    get_sums(left, s1, x); get_sums(right, s2, x);\n    sort(s2.begin(), s2.end());\n    long long ans = 0;\n    for (long long v : s1) {\n        auto p = equal_range(s2.begin(), s2.end(), x - v);\n        ans += distance(p.first, p.second);\n    }\n    cout << ans << \"\\n\";\n    return 0;\n}",
        "starter_py": "from collections import Counter\nn, x = map(int, input().split())\na = list(map(int, input().split()))\nmid = n // 2\nl, r = a[:mid], a[mid:]\ncnt = Counter()\nfor mask in range(1 << len(l)):\n    s = sum(l[i] for i in range(len(l)) if (mask & (1 << i)))\n    if s <= x: cnt[s] += 1\nans = 0\nfor mask in range(1 << len(r)):\n    s = sum(r[i] for i in range(len(r)) if (mask & (1 << i)))\n    if s <= x: ans += cnt[x - s]\nprint(ans)",
        "testcases": tests_1628
    }

    return problems_spec

def seed_deruck_tests_into_json():
    """Seeds testcases and specifications into docs/data.json."""
    if not os.path.exists(DATA_PATH):
        print(f"❌ Không tìm thấy file {DATA_PATH}")
        return False

    with open(DATA_PATH, 'r', encoding='utf-8') as f:
        data = json.load(f)

    problems = data.get('problems', [])
    specs = generate_all_deruck_problems()

    updated_count = 0
    grader_problems_list = []

    for p in problems:
        pid = p.get('id')
        if pid in specs:
            spec = specs[pid]
            p['description'] = spec['description']
            p['input_format'] = spec['input_format']
            p['output_format'] = spec['output_format']
            p['starter_cpp'] = spec['starter_cpp']
            p['starter_py'] = spec['starter_py']
            p['time_limit'] = 1.0 if 'CF' not in pid and 'CSES' not in pid else 2.0
            p['memory_limit'] = 256
            
            # Format testcases with scores
            raw_tests = spec['testcases']
            total_t = len(raw_tests)
            score_per_test = round(100.0 / total_t, 2)
            tests_formatted = []
            sample_tests = []
            for idx, t in enumerate(raw_tests):
                t_item = {
                    "input": t["input"],
                    "output": t["output"],
                    "sample": t.get("is_sample", False),
                    "is_sample": t.get("is_sample", False),
                    "score": score_per_test if idx < total_t - 1 else round(100.0 - score_per_test * (total_t - 1), 2)
                }
                if t.get("explain"):
                    t_item["explain"] = t["explain"]
                tests_formatted.append(t_item)
                if t.get("is_sample"):
                    sample_tests.append({
                        "input": t["input"].strip(),
                        "output": t["output"].strip(),
                        "explain": t.get("explain", "Ví dụ mẫu bài toán.")
                    })

            p['testcases'] = tests_formatted
            p['sample_tests'] = sample_tests
            
            # If not yet set, make sure it has deruck url anchor
            if not p.get('url') or p.get('url') == '#':
                p['url'] = f"#judge-{pid}"

            updated_count += 1
            grader_problems_list.append(p)

    data['problems'] = problems
    data['grader_problems'] = grader_problems_list

    # Ensure submissions array exists
    if 'submissions' not in data:
        data['submissions'] = []

    with open(DATA_PATH, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"✅ ĐÃ SINH BỘ TEST THÀNH CÔNG CHO {updated_count} BÀI TẬP VÀO docs/data.json!")
    return True

if __name__ == "__main__":
    seed_deruck_tests_into_json()
