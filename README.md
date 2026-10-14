# WebHocTap — Deruck's Competitive Programming

Website quản lý lớp học lập trình: hồ sơ và tiến độ học sinh, học phí, bài giảng, bài tập tuần, kỳ thi, nộp bài và chấm C++/Python. Giao diện tĩnh được triển khai từ `docs/` lên GitHub Pages; Python phụ trách máy chấm cục bộ, crawler và đồng bộ Google Sheets/Firebase.

## Cấu trúc thư mục

```text
docs/                         Website công khai, là thư mục deploy GitHub Pages
  index.html                  Trang chính và quản trị
  student.html                Hồ sơ học sinh
  firebase-config.js          URL Firebase và các hàm truy cập dữ liệu
  assets/css/                 CSS riêng cho từng trang
  assets/js/                  Logic giao diện dùng chung
    data/submission-store.js  Kho IndexedDB và hợp nhất bài nộp theo ID
    judge/client.js           Kết nối, phân tải và dự phòng các máy chấm
  assets/css/cool-breeze.css  Bảng màu xanh trời/xanh lá dịu cho hai trang
  lectures/                   Bài giảng Markdown công khai
  data.json                   Danh mục bài tập/bài giảng/kỳ thi công khai
src/                          Backend cục bộ, crawler và đồng bộ dữ liệu
  judge_server.py             HTTP API cho máy chấm và đồng bộ cục bộ
  core/judge_engine.py        Biên dịch/chạy C++ và Python có giới hạn
  core/submission_store.py    Lưu bài nộp cục bộ ngoài thư mục web
config/                       Cấu hình Python
scripts/                      Công cụ quản trị, nhập dữ liệu và kiểm tra
  windows/                    Các file .bat/.vbs chạy trên Windows
  check_project.mjs           Kiểm tra đường dẫn, cú pháp JS và dữ liệu công khai
integrations/                 Google Apps Script
data/imports/                 CSV/TSV dùng để nhập dữ liệu
data/private/                 Bài nộp cục bộ, không đưa lên Git
documentation/                Hướng dẫn và báo cáo rà soát
  judge-maintenance-2026-10-14.md  Báo cáo và quy tắc bảo trì máy chấm
  archive/                    Báo cáo/kế hoạch cũ để tham khảo
templates/                    Mẫu Google Sheets và Notion
tests/                        Kiểm thử offline
main.py                       CLI theo dõi tiến độ Online Judge
```

`.env`, `service_account.json`, các bản xuất Firebase và Excel cũ vẫn ở gốc để tương thích các script đang sử dụng. Chúng đã được `.gitignore` loại trừ. Chỉ phục vụ thư mục `docs/` qua HTTP, vì thư mục gốc chứa dữ liệu riêng tư.

## Chạy trên máy

Cần Python 3.11+; Node.js 22+ dùng cho kiểm thử. Trên Windows, các lệnh dưới đây chạy từ thư mục gốc dự án:

```bat
scripts\windows\run_python.bat -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
scripts\windows\run_python.bat -m http.server 5500 --bind 127.0.0.1 --directory docs
```

Mở `http://127.0.0.1:5500/`. File `run_python.bat` tự chọn Python trong `.venv`, Python Launcher, PATH hoặc Thonny nếu có.

Để chạy máy chấm cục bộ, mở `scripts/windows/chay_he_thong_cham.bat`. C++ cần `g++`; Python dùng interpreter chạy máy chấm. Máy chấm hiện chạy mã trực tiếp dưới tài khoản hệ điều hành, chưa có sandbox cách ly mã không tin cậy.

Sao chép `.env.example` thành `.env`, cấu hình Google Sheets và tài khoản dịch vụ trước khi đồng bộ. Các lệnh đồng bộ sau **có ghi dữ liệu thật**:

```bat
scripts\windows\dong_bo_ggsheets.bat
scripts\windows\sync.bat
scripts\windows\tu_dong_cap_nhat_bai_nop.bat
```

Google Apps Script nằm ở `integrations/google-apps-script.js`. Hướng dẫn thiết lập Google Sheets cũ được giữ tại [documentation/setup-google-sheets.md](documentation/setup-google-sheets.md).

## Kiểm thử offline

```bat
node scripts/check_project.mjs
node tests/judge-client.test.cjs
node --test tests/firebase.test.cjs
scripts\windows\run_python.bat -m unittest discover -s tests -v
node tests/browser-smoke.mjs
```

Kiểm thử trình duyệt dùng Chrome ẩn và giả lập dịch vụ ngoài; có thể đặt `BROWSER_PATH` nếu Chrome nằm ở vị trí khác. Không cần tài khoản Firebase/Sheets cho các bài kiểm thử này. `scripts/verify_full_system.py` là công cụ kiểm tra có kết nối mạng, khác với bộ kiểm thử offline trên.

## Triển khai và giới hạn hiện tại

GitHub Pages tiếp tục deploy `docs/`; các URL `index.html` và `student.html?id=...` không đổi. Workflow deploy sẽ kiểm tra tài nguyên và chặn dữ liệu học sinh, bài nộp hoặc token trong `docs/data.json`.

**Rules Firebase hiện tại cho phép truy cập công khai. Cookie/PIN trên giao diện chưa phải cơ chế phân quyền máy chủ.** Cần triển khai Firebase Authentication hoặc backend xác thực và rules tương ứng trước khi coi dữ liệu là riêng tư. Không áp dụng rules chặn toàn bộ một cách độc lập vì giao diện và script hiện chưa dùng cùng cơ chế xác thực.

Xem [báo cáo rà soát ngày 14/10/2026](documentation/review-2026-10-14.md) để biết lỗi đã sửa, kết quả kiểm thử và các phần chưa kiểm chứng trên hệ thống thật.

Khi sửa máy chấm hoặc lịch sử bài nộp, đọc [hướng dẫn bảo trì máy chấm](documentation/judge-maintenance-2026-10-14.md) để giữ đúng schema, thứ tự lưu và chính sách failover.
