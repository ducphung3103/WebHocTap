"""
Populates extracted lectures and problems from teacher's 4 Google Docs
into Google Sheet tabs 'Bài Giảng' and 'Bài Tập'.
"""

import sys
import os

sys.stdout.reconfigure(encoding='utf-8')
os.environ.pop('SSLKEYLOGFILE', None)

# Ensure project root is in sys.path
_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _root not in sys.path:
    sys.path.insert(0, _root)

from config.settings import get_settings
from src.sync_to_gsheet import get_spreadsheet
from src.classify_problems import classify_problem

sh = get_spreadsheet()

# ==============================================================================
# 1. PREPARE LECTURES ('Bài Giảng')
# ==============================================================================

# Columns: Mã bài giảng, Chương / Tuần, Tiêu đề bài giảng, Lớp áp dụng, Link bài giảng, Tóm tắt kiến thức
lectures_data = [
    # --- 4 Master Google Docs ---
    ["DOC-CPP-CB", "Giáo trình", "Tài liệu học tập & Nhật ký bài giảng - Lập trình C++ cơ bản", "C++ cơ bản", "https://docs.google.com/document/d/1vX6b2B-TsjZ7lNSXxAUzVZBSEyQ2mApWNQN6jzk1lGI/edit", "File tổng hợp toàn bộ bài giảng, mã nguồn mẫu, record video và bài tập về nhà của lớp C++ cơ bản."],
    ["DOC-PY-CB", "Giáo trình", "Tài liệu học tập & Nhật ký bài giảng - Python cơ bản", "Python cơ bản", "https://docs.google.com/document/d/1t-9f0PrWfJmzZFNirfAbshOjcQksc9OiflD9XCFATSw/edit", "File tổng hợp toàn bộ bài giảng, cú pháp Python, bài tập thực hành và video record của lớp Python cơ bản."],
    ["DOC-PY-11", "Giáo trình", "Tài liệu học tập & Nhật ký bài giảng - Python 1-1", "Python 1-1", "https://docs.google.com/document/d/1P5lW-q-zpx8nrVW-vj_T4wDyI0HzDgnXhLsx2GQl-_c/edit", "File bài giảng cá nhân hóa, bài tập rèn luyện tư duy toán học và lập trình Python 1-1."],
    ["DOC-26TI", "Giáo trình", "Tài liệu học tập & Chuyên đề - Lập trình 26TI (C++ nâng cao)", "C++ nâng cao", "https://docs.google.com/document/d/19LI2lWWo1HNQNPWdlRCEpEwImGOXfwns_nE9T-Zup0c/edit", "File tài liệu chuyên đề bồi dưỡng học sinh giỏi, lập trình thi đấu và thuật toán nâng cao 26TI."],

    # --- Bài giảng Lớp C++ cơ bản ---
    ["CPP-01", "Tuần 1", "Buổi 1: Giới thiệu Tin học, Ngôn ngữ lập trình & Cài đặt CodeBlocks", "C++ cơ bản", "https://youtu.be/YhjHTOcUDxM", "Khái niệm lập trình, cài đặt IDE CodeBlocks/Thonny, cấu trúc một chương trình C++."],
    ["CPP-02", "Tuần 1", "Buổi 2: Các nền tảng học thuật toán & Luyện tập lập trình thi đấu", "C++ cơ bản", "https://youtu.be/CJOY3uDX4HY", "Làm quen VNOI, CSES, Codeforces, MarisaOJ và cách thức nộp bài tự động."],
    ["CPP-03", "Tuần 2", "Buổi 3: Khái niệm về Biến & Thao tác câu lệnh nhập xuất", "C++ cơ bản", "https://youtu.be/bwr5IGd_nYY", "Biến là gì, các kiểu dữ liệu int/long long/string, cách gán giá trị và xuất kết quả."],
    ["CPP-04", "Tuần 2", "Buổi 4: Thực hành Nhập xuất Họ tên & Phép toán cơ bản", "C++ cơ bản", "https://youtu.be/2OoPL7KECe0", "Thực hành khai báo biến, nhập xuất họ tên và tính toán biểu thức."],
    ["CPP-05", "Tuần 3", "Buổi 5: Dịch lỗi cú pháp & Phương pháp kiểm thử kết quả code", "C++ cơ bản", "https://youtu.be/fLzMt9bNUtY", "Phân biệt lỗi biên dịch (Compile Error) và lỗi logic/kết quả sai (Wrong Answer)."],
    ["CPP-06", "Tuần 3", "Buổi 6: Cấu trúc lặp & Thực hành giải bài tập Module 1", "C++ cơ bản", "https://youtu.be/j7OSLalp9aw", "Vòng lặp for/while, duyệt qua các phần tử và giải quyết bài toán cơ bản."],
    ["CPP-07", "Tuần 4", "Buổi 7: 4 giai đoạn viết code chuẩn từ Đọc đề đến Chạy chương trình", "C++ cơ bản", "https://youtu.be/G0zGtpyOO8Q", "Đọc đề -> Nháp/Ý tưởng -> Code -> Chạy kiểm thử. Thao tác biến và bộ nhớ."],
    ["CPP-08", "Tuần 4", "Buổi 8: Phép toán số học trên 2 số nguyên A và B", "C++ cơ bản", "https://youtu.be/SirrPenxcKE", "Giải quyết bài toán cộng, trừ, nhân, chia và xác định số lượng biến cần dùng."],
    ["CPP-09", "Tuần 5", "Buổi 9: Cấu trúc rẽ nhánh if/else & Điều kiện logic", "C++ cơ bản", "https://youtu.be/AukzhzXqauU", "Cú pháp if, else if, else, toán tử so sánh (==, !=, <, >, <=, >=) và toán tử logic (&&, ||)."],
    ["CPP-10", "Tuần 5", "Buổi 10: Phép toán số mũ & Thứ tự ưu tiên toán tử", "C++ cơ bản", "https://youtu.be/paETexLmdkI", "Phép toán số mũ, lũy thừa, thứ tự ưu tiên các phép tính số học."],
    ["CPP-11", "Tuần 6", "Buổi 11: Ôn tập C++ & Kiểu dữ liệu số thực double, số nguyên lớn long long", "C++ cơ bản", "https://youtu.be/iik1PieGf-E", "Tránh tràn số với long long, xử lý số thập phân với double."],
    ["CPP-12", "Tuần 6", "Buổi 12: Biểu diễn dữ liệu và thông tin trong máy tính", "C++ cơ bản", "https://youtu.be/DCNM5wuWzD4", "Các dạng dữ liệu: Số, chữ, ảnh, video và cách máy tính lưu trữ."],
    ["CPP-13", "Tuần 7", "Buổi 13: Luyện tập giải bài toán thực tế trên MarisaOJ", "C++ cơ bản", "https://youtu.be/atctVa85zJA", "Chiến lược đọc đề, xác định input/output và cài đặt bài nộp đạt điểm tối đa."],
    ["CPP-14", "Tuần 7", "Buổi 14: Cấu trúc tuần tự và rẽ nhánh nâng cao", "C++ cơ bản", "https://youtu.be/wpRdet9ygEQ", "Kết hợp nhiều điều kiện rẽ nhánh và các trường hợp đặc biệt."],
    ["CPP-15", "Tuần 8", "Buổi 15: Hệ nhị phân & Nguyên lý máy tính tính toán", "C++ cơ bản", "https://youtu.be/MbGOFKtTnMc", "Bit, byte, cách biểu diễn số nhị phân 0 và 1."],
    ["CPP-16", "Tuần 8", "Buổi 16: Xử lý dãy nhị phân và mã hóa thông tin", "C++ cơ bản", "https://youtu.be/OP0Y0tXQ410", "Dãy bit, chuyển đổi giữa nhị phân và thập phân."],
    ["CPP-17", "Tuần 9", "Buổi 17: Hệ thập phân & Kỹ thuật tách chữ số của số nguyên", "C++ cơ bản", "https://youtu.be/ARqXDSBUZ6E", "Các phép toán % 10 và / 10 để tách từng chữ số của số nguyên."],
    ["CPP-18", "Tuần 9", "Buổi 18: Toán học quanh ta & Ứng dụng trong lập trình thi đấu", "C++ cơ bản", "https://youtu.be/fniQIkVTCzg", "Liên hệ các bài toán thực tế và tư duy giải thuật trong tin học."],

    # --- Bài giảng Lớp Python cơ bản ---
    ["PYCB-01", "Tuần 1", "Buổi 1: Nội quy lớp học & Phương pháp học lập trình hiệu quả", "Python cơ bản", "https://youtu.be/KVNKR57_lPQ", "Nội quy, cách tương tác, phương pháp ghi nhớ qua thực hành lặp lại."],
    ["PYCB-02", "Tuần 1", "Buổi 2: Các phép tính toán trong lập trình (+, -, *, /, //, %)", "Python cơ bản", "https://drive.google.com/file/d/1c08YTorvjqAd7__q5uL4ZaNIrom6vLsN/view?usp=sharing", "Các phép toán số học trong Python: chia lấy nguyên //, chia lấy dư %, lũy thừa **."],
    ["PYCB-03", "Tuần 2", "Buổi 3: Hệ thống file & Quản lý thư mục trên máy tính", "Python cơ bản", "https://youtu.be/TluMT-5iLNw", "Sử dụng File Explorer, tạo folder, đổi tên file, quản lý mã nguồn code."],
    ["PYCB-04", "Tuần 2", "Buổi 4: Làm quen Thonny IDE & Phương pháp giải bài toán", "Python cơ bản", "https://youtu.be/JnxuZVWfpHE", "Cài đặt Thonny, tạo tài khoản MarisaOJ, làm quen số âm và số dương."],
    ["PYCB-05", "Tuần 3", "Buổi 5: Nhập môn Python & Bài toán chia kẹo liên hoan", "Python cơ bản", "https://youtu.be/T9wTj8vRiIs", "Lập trình giải bài toán chia phần thưởng và xử lý số dư."],
    ["PYCB-06", "Tuần 3", "Buổi 6: Khái niệm về Biến & Sử dụng biến in lên màn hình", "Python cơ bản", "https://youtu.be/A-nthTS0JEE", "Biến là hộp chứa dữ liệu, in số, in chữ và nối chuỗi trong Python."],
    ["PYCB-07", "Tuần 4", "Buổi 7: Phân biệt Nhập (input) và Gán (assignment) trong Python", "Python cơ bản", "https://youtu.be/1MEWS98zquM", "Khi nào dùng gán biến trực tiếp, khi nào dùng input() và ép kiểu int(input())."],
    ["PYCB-08", "Tuần 4", "Buổi 8: Hướng dẫn nộp bài MarisaOJ & Chế tạo máy tính 2 số", "Python cơ bản", "https://youtu.be/dsZ0zoPJhbo", "Thao tác trên giao diện MarisaOJ, nộp bài, kiểm tra trạng thái AC."],

    # --- Bài giảng Lớp Python 1-1 ---
    ["PY11-01", "Chuyên đề", "Buổi 1: Khái niệm biến, số âm & Công thức tính hình học", "Python 1-1", "https://drive.google.com/file/d/1exJ_NqOYLqEkIcEFXai7cjQCh_KkZKA6/view?usp=sharing", "Quy tắc dấu số âm, biến x, y và tính diện tích hình chữ nhật."],
    ["PY11-02", "Chuyên đề", "Buổi 2: Tính chất giao hoán, kết hợp & Định dạng số thực f-string", "Python 1-1", "https://youtu.be/10j8WdUEHkM", "Giao hoán phép cộng/nhân, định dạng chữ số thập phân f'{a/b:.3f}'."],
    ["PY11-03", "Chuyên đề", "Buổi 3: Chữa bài tập MarisaOJ & Kỹ thuật lập trình cơ bản", "Python 1-1", "https://youtu.be/gRztmoQym7g", "Chữa các bài toán gấp giấy, chia kẹo, đổi tiền, bài toán nấm."],

    # --- Bài giảng Lớp C++ nâng cao (26TI) ---
    ["CPPNC-01", "Chuyên đề 1", "Buổi 1: Template thi HSG, Fast I/O & Cấu trúc dữ liệu STL (Stack, Queue, Deque, Map, Set)", "C++ nâng cao", "https://youtu.be/4eWCk6m1ZVw", "Khai báo nhập xuất file (freopen, fast I/O), cấu trúc dữ liệu STL (Stack đơn điệu, Queue hai con trỏ, Deque cửa sổ trượt, Map, Set), tìm kiếm nhị phân lower_bound, đệ quy & quy hoạch động cơ bản."],
    ["CPPNC-02", "Chuyên đề 2", "Buổi 2: Chữa Contest 26TI - Biến đổi Palindrome, Số học chia hết & Kỹ thuật Hai con trỏ", "C++ nâng cao", "https://youtu.be/PvLadoW3VrY", "Chữa chi tiết contest 26TI: Bài A (Khởi động), Bài B (Biến đổi xâu đối xứng tối thiểu thao tác - CF 486C), Bài C (Tạo số lớn nhất chia hết cho 2, 3, 5 - CF 214B), Bài D (Tăng mảng bằng nhau tối đa k thao tác - CF 231C - Kỹ thuật Hai con trỏ Two Pointers)."],
    ["CPPNC-03", "Chuyên đề 3", "Buổi 3: Đệ quy, Nhánh cận & Kỹ thuật Gặp nhau ở giữa (Meet-in-the-middle N <= 40)", "C++ nâng cao", "https://docs.google.com/document/d/19LI2lWWo1HNQNPWdlRCEpEwImGOXfwns_nE9T-Zup0c/edit", "Đệ quy sinh dãy nhị phân, sinh tập con mảng, phương pháp quay lui có nhánh cận và kỹ thuật Gặp nhau ở giữa (Meet-in-the-middle) giải bài toán tổng tập con với N lên tới 40."]
]

# ==============================================================================
# 2. PREPARE PROBLEMS ('Bài Tập')
# ==============================================================================

# Catalog of MarisaOJ problems from the documents
# Columns: Mã bài, Link bài tập, Tên bài tập, Class, Level, Dạng bài, Nền tảng, Ghi chú
raw_problems = [
    {
        "id": "MARISA-1",
        "url": "https://marisaoj.com/problem/1",
        "name": "A + B",
        "classes": "C++ cơ bản, Python cơ bản",
        "notes": "Phép cộng 2 số nguyên, làm quen nộp bài trên MarisaOJ"
    },
    {
        "id": "MARISA-2",
        "url": "https://marisaoj.com/problem/2",
        "name": "Chu vi và diện tích hình chữ nhật",
        "classes": "C++ cơ bản, Python cơ bản",
        "notes": "Nhập chiều dài và chiều rộng, tính chu vi và diện tích"
    },
    {
        "id": "MARISA-3",
        "url": "https://marisaoj.com/problem/3",
        "name": "Phép chia",
        "classes": "C++ cơ bản, Python cơ bản",
        "notes": "Tính phần nguyên và phần dư của phép chia 2 số nguyên"
    },
    {
        "id": "MARISA-4",
        "url": "https://marisaoj.com/problem/4",
        "name": "Ba cạnh tam giác",
        "classes": "C++ cơ bản, Python 1-1",
        "notes": "Kiểm tra bất đẳng thức tam giác AB + AC > BC"
    },
    {
        "id": "MARISA-6",
        "url": "https://marisaoj.com/problem/6",
        "name": "Chia kẹo",
        "classes": "Python 1-1",
        "notes": "Tính số kẹo mỗi bạn nhận được và số kẹo còn dư"
    },
    {
        "id": "MARISA-7",
        "url": "https://marisaoj.com/problem/7",
        "name": "Đổi tiền",
        "classes": "Python 1-1",
        "notes": "Tính số lượng tờ tiền tối thiểu theo mệnh giá"
    },
    {
        "id": "MARISA-8",
        "url": "https://marisaoj.com/problem/8",
        "name": "Biểu thức a * b % c",
        "classes": "C++ cơ bản",
        "notes": "Tính giá trị biểu thức tích chia lấy dư"
    },
    {
        "id": "MARISA-10",
        "url": "https://marisaoj.com/problem/10",
        "name": "Tổng các chữ số",
        "classes": "Python 1-1",
        "notes": "Tách từng chữ số của số nguyên và tính tổng"
    },
    {
        "id": "MARISA-11",
        "url": "https://marisaoj.com/problem/11",
        "name": "Số đảo ngược",
        "classes": "Python 1-1",
        "notes": "Đảo ngược thứ tự các chữ số của số nguyên dương"
    },
    {
        "id": "MARISA-13",
        "url": "https://marisaoj.com/problem/13",
        "name": "Đổi ký tự hoa thường",
        "classes": "C++ cơ bản, Python 1-1",
        "notes": "Chuyển ký tự hoa thành thường và ngược lại"
    },
    {
        "id": "MARISA-14",
        "url": "https://marisaoj.com/problem/14",
        "name": "Tìm kiếm ký tự",
        "classes": "Python 1-1",
        "notes": "Kiểm tra sự xuất hiện của ký tự trong xâu"
    },
    {
        "id": "MARISA-15",
        "url": "https://marisaoj.com/problem/15",
        "name": "In xâu ký tự",
        "classes": "C++ cơ bản, Python cơ bản",
        "notes": "Nhập vào 1 xâu và in ra xâu đó nhiều lần"
    },
    {
        "id": "MARISA-16",
        "url": "https://marisaoj.com/problem/16",
        "name": "Gấp giấy",
        "classes": "Python 1-1",
        "notes": "Tính độ dày của tờ giấy sau n lần gấp đôi (lũy thừa 2)"
    },
    {
        "id": "MARISA-20",
        "url": "https://marisaoj.com/problem/20",
        "name": "Đếm số chẵn",
        "classes": "C++ cơ bản",
        "notes": "Đếm số lượng các số chẵn trong dãy số nguyên"
    },
    {
        "id": "MARISA-42",
        "url": "https://marisaoj.com/problem/42",
        "name": "Mảng số nguyên chẵn lẻ",
        "classes": "C++ cơ bản",
        "notes": "Thao tác trên mảng một chiều: phân loại phần tử chẵn lẻ"
    },
    {
        "id": "MARISA-314",
        "url": "https://marisaoj.com/problem/314",
        "name": "Chữ số lớn nhất",
        "classes": "C++ cơ bản",
        "notes": "Vòng lặp tách chữ số để tìm chữ số có giá trị lớn nhất"
    },
    {
        "id": "MARISA-396",
        "url": "https://marisaoj.com/problem/396",
        "name": "Độ độc cây nấm",
        "classes": "C++ cơ bản",
        "notes": "Kiểm tra điều kiện mức độ độc hại T >= 9.0 (VERY TOXIC)"
    },
    {
        "id": "MARISA-397",
        "url": "https://marisaoj.com/problem/397",
        "name": "Nghiệm phương trình ax + b = 0",
        "classes": "C++ cơ bản",
        "notes": "Biện luận và tìm nghiệm nguyên của phương trình bậc nhất"
    },
    {
        "id": "MARISA-401",
        "url": "https://marisaoj.com/problem/401",
        "name": "Ăn nấm",
        "classes": "Python 1-1",
        "notes": "Tính số ngày ăn nấm dựa trên số lượng stems"
    },
    {
        "id": "MARISA-402",
        "url": "https://marisaoj.com/problem/402",
        "name": "Gấp giấy nâng cao",
        "classes": "Python 1-1",
        "notes": "Tính số lần gấp giấy cần thiết để đạt độ dày mong muốn"
    },
    {
        "id": "MARISA-405",
        "url": "https://marisaoj.com/problem/405",
        "name": "Mảng số nguyên",
        "classes": "C++ cơ bản",
        "notes": "Khai báo mảng, nhập xuất mảng và tính toán cơ bản"
    },
    {
        "id": "MARISA-416",
        "url": "https://marisaoj.com/problem/416",
        "name": "Kiểm tra điều kiện số học",
        "classes": "Python 1-1",
        "notes": "Cấu trúc rẽ nhánh kiểm tra các tính chất số nguyên"
    },
    {
        "id": "MARISA-419",
        "url": "https://marisaoj.com/problem/419",
        "name": "Điểm thuộc đoạn thẳng",
        "classes": "Python 1-1",
        "notes": "Kiểm tra điểm c có nằm trong đoạn [a, b] hay không"
    },
    {
        "id": "MARISA-499",
        "url": "https://marisaoj.com/problem/499",
        "name": "Tổng ước số",
        "classes": "C++ cơ bản",
        "notes": "Duyệt tìm tất cả các ước số của số nguyên N và tính tổng"
    },
    {
        "id": "MARISA-535",
        "url": "https://marisaoj.com/problem/535",
        "name": "Máy tính đơn giản",
        "classes": "C++ cơ bản",
        "notes": "Mô phỏng máy tính cầm tay thực hiện phép toán +, -, *, /"
    },
    {
        "id": "MARISA-536",
        "url": "https://marisaoj.com/problem/536",
        "name": "Số đối xứng",
        "classes": "C++ cơ bản",
        "notes": "Kiểm tra số nguyên có phải là số Palindrome đối xứng hay không"
    },
    {
        "id": "MARISA-537",
        "url": "https://marisaoj.com/problem/537",
        "name": "Dãy số",
        "classes": "C++ cơ bản",
        "notes": "Tạo và tính toán các phần tử trong dãy số theo quy luật"
    },
    {
        "id": "MARISA-541",
        "url": "https://marisaoj.com/problem/541",
        "name": "Số chính phương & Căn bậc hai",
        "classes": "C++ cơ bản",
        "notes": "Kiểm tra số nguyên có phải là số chính phương hay không"
    },
    {
        "id": "MARISA-587",
        "url": "https://marisaoj.com/problem/587",
        "name": "Hệ thập phân & Đổi cơ số",
        "classes": "C++ cơ bản",
        "notes": "Chuyển đổi số nguyên giữa hệ thập phân và nhị phân"
    },

    # --- Bài tập Lớp C++ nâng cao (26TI) ---
    {
        "id": "26TI-A",
        "url": "https://youtu.be/PvLadoW3VrY",
        "name": "Khởi động Contest 26TI",
        "classes": "C++ nâng cao",
        "platform": "26TI",
        "notes": "Bài toán khởi động kiểm tra kỹ năng tư duy và cài đặt cơ bản (Chữa trong video Buổi 2)"
    },
    {
        "id": "CF-486C",
        "url": "https://codeforces.com/problemset/problem/486/C",
        "name": "Palindromic Transformation",
        "classes": "C++ nâng cao",
        "platform": "Codeforces",
        "notes": "Biến đổi xâu đối xứng với số thao tác đổi ký tự và di chuyển con trỏ ít nhất"
    },
    {
        "id": "CF-214B",
        "url": "https://codeforces.com/problemset/problem/214/B",
        "name": "Hometask",
        "classes": "C++ nâng cao",
        "platform": "Codeforces",
        "notes": "Tạo số lớn nhất chia hết cho 2, 3, 5 từ tập các chữ số cho trước"
    },
    {
        "id": "CF-231C",
        "url": "https://codeforces.com/problemset/problem/231/C",
        "name": "To Add or Not to Add",
        "classes": "C++ nâng cao",
        "platform": "Codeforces",
        "notes": "Tăng mảng tối đa k thao tác để số phần tử bằng nhau nhiều nhất (Hai con trỏ sliding window)"
    },
    {
        "id": "CSES-1628",
        "url": "https://cses.fi/problemset/task/1628",
        "name": "Meet in the Middle",
        "classes": "C++ nâng cao",
        "platform": "CSES",
        "notes": "Đếm số tập con có tổng bằng M với N <= 40 bằng kỹ thuật Meet-in-the-middle"
    }
]

# Process and classify each problem
problems_rows = []
for p in raw_problems:
    platform = p.get("platform", "MarisaOJ")
    res = classify_problem({
        "id": p["id"],
        "name": p["name"],
        "platform": platform,
        "notes": p["notes"]
    })
    problems_rows.append([
        p["id"],
        p["url"],
        p["name"],
        p["classes"],
        str(res.level),
        res.main_topic,
        platform,
        p["notes"]
    ])

# ==============================================================================
# 3. WRITE TO GOOGLE SHEETS
# ==============================================================================

# Write to 'Bài Giảng'
ws_lec = sh.worksheet("Bài Giảng")
header_lec = ["Mã bài giảng", "Chương / Tuần", "Tiêu đề bài giảng", "Lớp áp dụng", "Link bài giảng", "Tóm tắt kiến thức"]
rows_to_write_lec = [header_lec] + lectures_data
ws_lec.clear()
ws_lec.update(range_name="A1", values=rows_to_write_lec, value_input_option="USER_ENTERED")
print(f"✅ Đã ghi thành công {len(lectures_data)} bài giảng vào tab 'Bài Giảng' trên Google Sheet!")

# Write to 'Bài Tập'
ws_prob = sh.worksheet("Bài Tập")
header_prob = ["Mã bài", "Link bài tập", "Tên bài tập", "Class", "Level", "Dạng bài", "Nền tảng", "Ghi chú"]
rows_to_write_prob = [header_prob] + problems_rows
ws_prob.clear()
ws_prob.update(range_name="A1", values=rows_to_write_prob, value_input_option="USER_ENTERED")
print(f"✅ Đã ghi thành công {len(problems_rows)} bài tập vào tab 'Bài Tập' trên Google Sheet!")
