"""
Seeds starter basic problems with test cases into docs/data.json
"""
import json
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

DATA_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'docs', 'data.json')

STARTER_GRADER_PROBLEMS = [
    {
        'id': 'CB-01',
        'code': 'CB-01',
        'name': 'Tính tổng hai số nguyên A + B',
        'platform': 'DeruckOJ',
        'badge_color': 'indigo',
        'category': 'Nhập xuất cơ bản',
        'difficulty': 'Level 1 • Nhập xuất',
        'classes': ['Public', 'C++', 'Python', 'Python 1-1'],
        'time_limit': 1.0,
        'memory_limit': 256,
        'description': 'Cho hai số nguyên A và B. Hãy tính và in ra giá trị của tổng A + B.',
        'input_format': 'Gồm một dòng chứa hai số nguyên A và B cách nhau bởi dấu cách (-10^9 <= A, B <= 10^9).',
        'output_format': 'In ra một số nguyên duy nhất là giá trị của A + B.',
        'starter_cpp': '#include <iostream>\nusing namespace std;\n\nint main() {\n    ios_base::sync_with_stdio(false);\n    cin.tie(NULL);\n    \n    long long a, b;\n    if (cin >> a >> b) {\n        cout << a + b << "\\n";\n    }\n    return 0;\n}',
        'starter_py': 'import sys\n\ndef main():\n    data = sys.stdin.read().split()\n    if len(data) >= 2:\n        a, b = int(data[0]), int(data[1])\n        print(a + b)\n\nif __name__ == "__main__":\n    main()',
        'sample_tests': [
            {'input': '2 3', 'output': '5', 'explain': 'Tổng 2 + 3 = 5.'},
            {'input': '-10 15', 'output': '5', 'explain': 'Tổng (-10) + 15 = 5.'}
        ],
        'testcases': [
            {'input': '2 3', 'output': '5', 'is_sample': True, 'score': 12.5},
            {'input': '-10 15', 'output': '5', 'is_sample': True, 'score': 12.5},
            {'input': '0 0', 'output': '0', 'is_sample': False, 'score': 12.5},
            {'input': '1000000 2000000', 'output': '3000000', 'is_sample': False, 'score': 12.5},
            {'input': '-500 -700', 'output': '-1200', 'is_sample': False, 'score': 12.5},
            {'input': '1000000000 -1000000000', 'output': '0', 'is_sample': False, 'score': 12.5},
            {'input': '999999999 1', 'output': '1000000000', 'is_sample': False, 'score': 12.5},
            {'input': '-999999999 -1', 'output': '-1000000000', 'is_sample': False, 'score': 12.5}
        ]
    },
    {
        'id': 'CB-02',
        'code': 'CB-02',
        'name': 'Số chẵn hay số lẻ',
        'platform': 'DeruckOJ',
        'badge_color': 'cyan',
        'category': 'Cấu trúc rẽ nhánh if/else',
        'difficulty': 'Level 1 • Rẽ nhánh',
        'classes': ['Public', 'C++', 'Python', 'Python 1-1'],
        'time_limit': 1.0,
        'memory_limit': 256,
        'description': 'Cho một số nguyên N. Hãy xác định xem N là số chẵn hay số lẻ. Nếu N là số chẵn thì in ra "CHAN", nếu N là số lẻ thì in ra "LE".',
        'input_format': 'Gồm một số nguyên N (-10^9 <= N <= 10^9).',
        'output_format': 'In ra "CHAN" hoặc "LE" (viết hoa, không dấu ngoặc kép).',
        'starter_cpp': '#include <iostream>\nusing namespace std;\n\nint main() {\n    long long n;\n    if (cin >> n) {\n        if (n % 2 == 0) cout << "CHAN\\n";\n        else cout << "LE\\n";\n    }\n    return 0;\n}',
        'starter_py': 'n = int(input().strip())\nif n % 2 == 0:\n    print("CHAN")\nelse:\n    print("LE")',
        'sample_tests': [
            {'input': '4', 'output': 'CHAN', 'explain': '4 chia hết cho 2 nên là số chẵn.'},
            {'input': '7', 'output': 'LE', 'explain': '7 không chia hết cho 2 nên là số lẻ.'}
        ],
        'testcases': [
            {'input': '4', 'output': 'CHAN', 'is_sample': True, 'score': 14.28},
            {'input': '7', 'output': 'LE', 'is_sample': True, 'score': 14.28},
            {'input': '0', 'output': 'CHAN', 'is_sample': False, 'score': 14.28},
            {'input': '-6', 'output': 'CHAN', 'is_sample': False, 'score': 14.28},
            {'input': '-13', 'output': 'LE', 'is_sample': False, 'score': 14.28},
            {'input': '1000000000', 'output': 'CHAN', 'is_sample': False, 'score': 14.28},
            {'input': '999999999', 'output': 'LE', 'is_sample': False, 'score': 14.32}
        ]
    },
    {
        'id': 'CB-03',
        'code': 'CB-03',
        'name': 'Tìm số lớn nhất trong ba số',
        'platform': 'DeruckOJ',
        'badge_color': 'blue',
        'category': 'Cấu trúc rẽ nhánh if/else',
        'difficulty': 'Level 1 • Rẽ nhánh',
        'classes': ['Public', 'C++', 'Python', 'Python 1-1'],
        'time_limit': 1.0,
        'memory_limit': 256,
        'description': 'Cho ba số nguyên a, b, c. Hãy tìm và in ra số có giá trị lớn nhất trong ba số đó.',
        'input_format': 'Một dòng chứa 3 số nguyên a, b, c cách nhau bởi dấu cách (-10^9 <= a, b, c <= 10^9).',
        'output_format': 'In ra số nguyên lớn nhất trong ba số.',
        'starter_cpp': '#include <iostream>\n#include <algorithm>\nusing namespace std;\n\nint main() {\n    long long a, b, c;\n    if (cin >> a >> b >> c) {\n        cout << max({a, b, c}) << "\\n";\n    }\n    return 0;\n}',
        'starter_py': 'a, b, c = map(int, input().split())\nprint(max(a, b, c))',
        'sample_tests': [
            {'input': '3 7 5', 'output': '7', 'explain': 'Số lớn nhất là 7.'},
            {'input': '-5 -2 -9', 'output': '-2', 'explain': 'Số lớn nhất trong các số âm là -2.'}
        ],
        'testcases': [
            {'input': '3 7 5', 'output': '7', 'is_sample': True, 'score': 14.28},
            {'input': '-5 -2 -9', 'output': '-2', 'is_sample': True, 'score': 14.28},
            {'input': '10 10 10', 'output': '10', 'is_sample': False, 'score': 14.28},
            {'input': '100 20 50', 'output': '100', 'is_sample': False, 'score': 14.28},
            {'input': '15 25 25', 'output': '25', 'is_sample': False, 'score': 14.28},
            {'input': '-1000000000 0 1000000000', 'output': '1000000000', 'is_sample': False, 'score': 14.28},
            {'input': '40 80 60', 'output': '80', 'is_sample': False, 'score': 14.32}
        ]
    },
    {
        'id': 'CB-04',
        'code': 'CB-04',
        'name': 'Tính tổng dãy số từ 1 đến N',
        'platform': 'DeruckOJ',
        'badge_color': 'emerald',
        'category': 'Vòng lặp cơ bản',
        'difficulty': 'Level 1 • Vòng lặp',
        'classes': ['Public', 'C++', 'Python', 'Python 1-1'],
        'time_limit': 1.0,
        'memory_limit': 256,
        'description': 'Cho số nguyên dương N. Hãy tính tổng các số nguyên liên tiếp từ 1 đến N: S = 1 + 2 + 3 + ... + N.',
        'input_format': 'Một số nguyên dương N duy nhất (1 <= N <= 10^6).',
        'output_format': 'In ra giá trị của tổng S.',
        'starter_cpp': '#include <iostream>\nusing namespace std;\n\nint main() {\n    long long n;\n    if (cin >> n) {\n        long long s = n * (n + 1) / 2;\n        cout << s << "\\n";\n    }\n    return 0;\n}',
        'starter_py': 'n = int(input().strip())\ns = n * (n + 1) // 2\nprint(s)',
        'sample_tests': [
            {'input': '5', 'output': '15', 'explain': '1 + 2 + 3 + 4 + 5 = 15.'},
            {'input': '1', 'output': '1', 'explain': 'Tổng chỉ có 1 phần tử = 1.'}
        ],
        'testcases': [
            {'input': '5', 'output': '15', 'is_sample': True, 'score': 14.28},
            {'input': '1', 'output': '1', 'is_sample': True, 'score': 14.28},
            {'input': '10', 'output': '55', 'is_sample': False, 'score': 14.28},
            {'input': '100', 'output': '5050', 'is_sample': False, 'score': 14.28},
            {'input': '1000', 'output': '500500', 'is_sample': False, 'score': 14.28},
            {'input': '1000000', 'output': '500000500000', 'is_sample': False, 'score': 14.28},
            {'input': '77', 'output': '3003', 'is_sample': False, 'score': 14.32}
        ]
    },
    {
        'id': 'CB-05',
        'code': 'CB-05',
        'name': 'Tính giai thừa N!',
        'platform': 'DeruckOJ',
        'badge_color': 'amber',
        'category': 'Vòng lặp & Tích số',
        'difficulty': 'Level 1 • Vòng lặp',
        'classes': ['Public', 'C++', 'Python', 'Python 1-1'],
        'time_limit': 1.0,
        'memory_limit': 256,
        'description': 'Cho số tự nhiên N. Hãy tính giai thừa của N: N! = 1 * 2 * ... * N. Quy ước 0! = 1.',
        'input_format': 'Một số nguyên N (0 <= N <= 15).',
        'output_format': 'In ra giá trị N!.',
        'starter_cpp': '#include <iostream>\nusing namespace std;\n\nint main() {\n    int n;\n    if (cin >> n) {\n        long long ans = 1;\n        for (int i = 1; i <= n; ++i) ans *= i;\n        cout << ans << "\\n";\n    }\n    return 0;\n}',
        'starter_py': 'n = int(input().strip())\nans = 1\nfor i in range(1, n + 1):\n    ans *= i\nprint(ans)',
        'sample_tests': [
            {'input': '5', 'output': '120', 'explain': '5! = 1 * 2 * 3 * 4 * 5 = 120.'},
            {'input': '0', 'output': '1', 'explain': '0! = 1 theo quy ước.'}
        ],
        'testcases': [
            {'input': '5', 'output': '120', 'is_sample': True, 'score': 14.28},
            {'input': '0', 'output': '1', 'is_sample': True, 'score': 14.28},
            {'input': '1', 'output': '1', 'is_sample': False, 'score': 14.28},
            {'input': '3', 'output': '6', 'is_sample': False, 'score': 14.28},
            {'input': '7', 'output': '5040', 'is_sample': False, 'score': 14.28},
            {'input': '10', 'output': '3628800', 'is_sample': False, 'score': 14.28},
            {'input': '15', 'output': '1307674368000', 'is_sample': False, 'score': 14.32}
        ]
    },
    {
        'id': 'CB-06',
        'code': 'CB-06',
        'name': 'Kiểm tra số nguyên tố',
        'platform': 'DeruckOJ',
        'badge_color': 'purple',
        'category': 'Thuật toán số học cơ bản',
        'difficulty': 'Level 1 • Số học',
        'classes': ['Public', 'C++', 'Python', 'Python 1-1'],
        'time_limit': 1.0,
        'memory_limit': 256,
        'description': 'Cho số nguyên N. Số nguyên tố là số nguyên lớn hơn 1 và chỉ chia hết cho 1 và chính nó. Hãy kiểm tra xem N có phải là số nguyên tố hay không. Nếu đúng in "YES", ngược lại in "NO".',
        'input_format': 'Một số nguyên N duy nhất (-10^9 <= N <= 10^9).',
        'output_format': 'In ra YES nếu N là số nguyên tố, ngược lại in NO.',
        'starter_cpp': '#include <iostream>\nusing namespace std;\n\nbool isPrime(long long n) {\n    if (n < 2) return false;\n    for (long long i = 2; i * i <= n; ++i) {\n        if (n % i == 0) return false;\n    }\n    return true;\n}\n\nint main() {\n    long long n;\n    if (cin >> n) {\n        if (isPrime(n)) cout << "YES\\n";\n        else cout << "NO\\n";\n    }\n    return 0;\n}',
        'starter_py': 'def is_prime(n):\n    if n < 2:\n        return False\n    i = 2\n    while i * i <= n:\n        if n % i == 0:\n            return False\n        i += 1\n    return True\n\nn = int(input().strip())\nprint("YES" if is_prime(n) else "NO")',
        'sample_tests': [
            {'input': '7', 'output': 'YES', 'explain': '7 là số nguyên tố.'},
            {'input': '4', 'output': 'NO', 'explain': '4 chia hết cho 2 nên không phải số nguyên tố.'}
        ],
        'testcases': [
            {'input': '7', 'output': 'YES', 'is_sample': True, 'score': 11.11},
            {'input': '4', 'output': 'NO', 'is_sample': True, 'score': 11.11},
            {'input': '1', 'output': 'NO', 'is_sample': False, 'score': 11.11},
            {'input': '2', 'output': 'YES', 'is_sample': False, 'score': 11.11},
            {'input': '0', 'output': 'NO', 'is_sample': False, 'score': 11.11},
            {'input': '-5', 'output': 'NO', 'is_sample': False, 'score': 11.11},
            {'input': '97', 'output': 'YES', 'is_sample': False, 'score': 11.11},
            {'input': '100', 'output': 'NO', 'is_sample': False, 'score': 11.11},
            {'input': '1000000007', 'output': 'YES', 'is_sample': False, 'score': 11.12}
        ]
    },
    {
        'id': 'CB-07',
        'code': 'CB-07',
        'name': 'Đảo ngược xâu ký tự',
        'platform': 'DeruckOJ',
        'badge_color': 'pink',
        'category': 'Xử lý chuỗi (String)',
        'difficulty': 'Level 1 • Chuỗi',
        'classes': ['Public', 'C++', 'Python', 'Python 1-1'],
        'time_limit': 1.0,
        'memory_limit': 256,
        'description': 'Cho một xâu ký tự S. Hãy in ra xâu S sau khi đã đảo ngược thứ tự các ký tự.',
        'input_format': 'Một dòng chứa xâu ký tự S (độ dài không quá 1000 ký tự).',
        'output_format': 'In ra xâu S đảo ngược.',
        'starter_cpp': '#include <iostream>\n#include <string>\n#include <algorithm>\nusing namespace std;\n\nint main() {\n    string s;\n    if (getline(cin, s)) {\n        reverse(s.begin(), s.end());\n        cout << s << "\\n";\n    }\n    return 0;\n}',
        'starter_py': 's = input()\nprint(s[::-1])',
        'sample_tests': [
            {'input': 'hello', 'output': 'olleh', 'explain': 'Đảo ngược hello thành olleh.'},
            {'input': '12345', 'output': '54321', 'explain': 'Đảo ngược số dạng xâu.'}
        ],
        'testcases': [
            {'input': 'hello', 'output': 'olleh', 'is_sample': True, 'score': 16.66},
            {'input': '12345', 'output': '54321', 'is_sample': True, 'score': 16.66},
            {'input': 'a', 'output': 'a', 'is_sample': False, 'score': 16.66},
            {'input': 'racecar', 'output': 'racecar', 'is_sample': False, 'score': 16.66},
            {'input': 'Competitive Programming', 'output': 'gnimmargorP evititepmoC', 'is_sample': False, 'score': 16.66},
            {'input': 'Python vs C++', 'output': '++C sv nohtyP', 'is_sample': False, 'score': 16.70}
        ]
    },
    {
        'id': 'CB-08',
        'code': 'CB-08',
        'name': 'Tìm số lớn nhất trong mảng',
        'platform': 'DeruckOJ',
        'badge_color': 'teal',
        'category': 'Mảng một chiều (Array)',
        'difficulty': 'Level 1 • Mảng',
        'classes': ['Public', 'C++', 'Python', 'Python 1-1'],
        'time_limit': 1.0,
        'memory_limit': 256,
        'description': 'Cho một dãy gồm N số nguyên. Hãy tìm phần tử có giá trị lớn nhất trong dãy số đó.',
        'input_format': 'Dòng đầu chứa số nguyên dương N (1 <= N <= 10^5). Dòng thứ hai chứa N số nguyên cách nhau một dấu cách (-10^9 <= A_i <= 10^9).',
        'output_format': 'In ra một số nguyên duy nhất là giá trị lớn nhất trong dãy.',
        'starter_cpp': '#include <iostream>\n#include <vector>\n#include <algorithm>\nusing namespace std;\n\nint main() {\n    int n;\n    if (cin >> n) {\n        long long max_val = -2e18;\n        for (int i = 0; i < n; ++i) {\n            long long x;\n            cin >> x;\n            if (x > max_val) max_val = x;\n        }\n        cout << max_val << "\\n";\n    }\n    return 0;\n}',
        'starter_py': 'import sys\n\ndef main():\n    lines = sys.stdin.read().split()\n    if not lines:\n        return\n    n = int(lines[0])\n    nums = [int(x) for x in lines[1:n+1]]\n    print(max(nums))\n\nif __name__ == "__main__":\n    main()',
        'sample_tests': [
            {'input': '5\n1 9 3 7 5', 'output': '9', 'explain': 'Số lớn nhất là 9.'},
            {'input': '4\n-10 -5 -20 -3', 'output': '-3', 'explain': 'Số lớn nhất trong các số âm là -3.'}
        ],
        'testcases': [
            {'input': '5\n1 9 3 7 5', 'output': '9', 'is_sample': True, 'score': 16.66},
            {'input': '4\n-10 -5 -20 -3', 'output': '-3', 'is_sample': True, 'score': 16.66},
            {'input': '1\n42', 'output': '42', 'is_sample': False, 'score': 16.66},
            {'input': '6\n0 0 0 0 0 0', 'output': '0', 'is_sample': False, 'score': 16.66},
            {'input': '5\n100 200 500 500 300', 'output': '500', 'is_sample': False, 'score': 16.66},
            {'input': '7\n-100 -50 0 20 80 40 80', 'output': '80', 'is_sample': False, 'score': 16.70}
        ]
    }
]


def seed():
    if not os.path.exists(DATA_PATH):
        print(f"Error: {DATA_PATH} not found!")
        return

    with open(DATA_PATH, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # Preserve any existing custom grader problems that user already created
    existing_map = {p['id']: p for p in data.get('grader_problems', [])}
    for p in STARTER_GRADER_PROBLEMS:
        if p['id'] not in existing_map:
            existing_map[p['id']] = p

    # Ensure in order
    data['grader_problems'] = list(existing_map.values())

    # Sync into problems list for viewing
    prob_map = {p['id']: p for p in data.get('problems', [])}
    for gp in data['grader_problems']:
        if gp['id'] not in prob_map:
            prob_map[gp['id']] = {
                'id': gp['id'],
                'name': gp['name'],
                'platform': 'DeruckOJ',
                'url': f'#judge-{gp["id"]}',
                'badge_color': gp.get('badge_color', 'indigo'),
                'category': gp.get('category', 'Cơ bản'),
                'difficulty': gp.get('difficulty', 'Level 1 • Cơ bản'),
                'classes': gp.get('classes', ['Public'])
            }

    data['problems'] = list(prob_map.values())

    with open(DATA_PATH, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"✅ Đã cập nhật thành công {len(data['grader_problems'])} bài tập chấm tự động vào {DATA_PATH}!")


if __name__ == "__main__":
    seed()
