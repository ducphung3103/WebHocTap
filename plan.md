# KẾ HOẠCH TRIỂN KHAI HỆ THỐNG QUẢN LÝ LỚP HỌC LẬP TRÌNH
**Mô hình:** Notion (Bài giảng) + Google Sheets (Lưu trữ) + GitHub Actions & Python (Tự động hóa tiến độ)
**Quy mô:** 20 - 30 Học sinh
**Mục tiêu:** Xây dựng hệ thống vận hành tự động với chi phí 0 đồng.

---

## 🛠 Chuẩn bị trước khi bắt đầu (Pre-requisites)
- [ ] Tạo 1 tài khoản **Notion** (Khuyên dùng email Giáo dục `.edu` để được gói Plus miễn phí, hoặc dùng gói Free vẫn đủ tốt).
- [ ] Tạo 1 tài khoản **Google** (Dùng cho Google Sheets và Google Cloud Console để lấy API key).
- [ ] Tạo 1 tài khoản **GitHub**.
- [ ] Cài đặt sẵn môi trường **Python** và trình soạn thảo code (VS Code) trên máy tính cá nhân.

---

## 📅 Giai đoạn 1: Xây dựng Giao diện lớp học bằng Notion (Dự kiến: 1-2 ngày)
*Mục tiêu: Tạo không gian học tập, bảo mật tài liệu và sẵn sàng đón học sinh.*

- [ ] **Tạo Workspace/Page chính:** Tạo một trang tổng (Ví dụ: `Lớp chuyên Tin - Khóa 2026`).
- [ ] **Phân chia cấu trúc thư mục:**
  - [ ] Trang **Lý thuyết & Bài giảng** (Chứa các file markdown/công thức toán).
  - [ ] Trang **Bài tập tuần** (Danh sách các bài tập yêu cầu học sinh làm).
  - [ ] Trang **Bảng xếp hạng / Tiến độ** (Nơi sẽ nhúng Google Sheets vào sau).
- [ ] **Thiết lập quyền riêng tư:** Cài đặt Share -> Invite từng email của học sinh (Quyền `View` hoặc `Comment`). Đảm bảo tắt tính năng "Share to web" (hoặc bật nếu không ngại lộ bài giảng).

---

## 📅 Giai đoạn 2: Thiết lập Database bằng Google Sheets (Dự kiến: 1 ngày)
*Mục tiêu: Nơi lưu trữ thông tin Handle và là Bảng tính (Dashboard) để nhúng vào Notion.*

- [ ] **Tạo File Google Sheets mới:** Đặt tên ví dụ `Data_Tien_Do_Lop_Hoc`.
- [ ] **Tạo Sheet 1 - "Danh sách Học sinh":** 
  - Các cột: `STT`, `Họ Tên`, `Email`, `Codeforces Handle`, `VNOI Handle`, `LQDOJ Handle`.
- [ ] **Tạo Sheet 2 - "Theo dõi Bài tập":**
  - Cột dọc: Tên học sinh.
  - Cột ngang: ID Bài tập (VD: `CF-71A`, `VNOI-nklineup`).
  - Ô giao nhau: Trạng thái (Trống / AC / Đang làm).
- [ ] **Cấu hình API:**
  - Vào Google Cloud Console, tạo 1 Project.
  - Kích hoạt `Google Sheets API` và `Google Drive API`.
  - Tạo `Service Account` và tải file `.json` chứa thông tin xác thực (Credentials) về máy.
  - Share file Google Sheets của bạn cho email của `Service Account` đó (Quyền Editor).
- [ ] **Nhúng vào Notion:** Copy link Google Sheets, dán vào trang Notion và chọn `Create Embed`.

---

## 📅 Giai đoạn 3: Viết Script tự động hóa bằng Python (Dự kiến: 2-3 ngày)
*Mục tiêu: Code con Bot thay bạn đi kiểm tra bài tập của học sinh.*

- [ ] **Khởi tạo Project Python:**
  - Tạo thư mục, cài đặt các thư viện cần thiết: `pip install gspread oauth2client requests bs4 httpx`.
- [ ] **Code Module 1 (Kết nối Google Sheets):**
  - Viết hàm đọc danh sách Handle học sinh và danh sách Bài tập từ Sheet.
  - Viết hàm cập nhật trạng thái "AC" vào đúng ô tương ứng trên Sheet.
- [ ] **Code Module 2 (Crawl API / Web):**
  - Viết hàm check Codeforces qua API: `https://codeforces.com/api/user.status?handle={handle}`.
  - Viết hàm check VNOI/LQDOJ qua feed hoặc dùng BeautifulSoup để cào danh sách "Bài đã giải".
- [ ] **Hoàn thiện luồng chạy (Main loop):**
  - Bot đọc list -> Lặp qua từng học sinh -> Gọi module crawl -> Lọc các bài mới AC -> Ghi vào Google Sheets.
- [ ] **Test cục bộ:** Chạy thử trên máy tính với 1-2 handle mẫu xem bảng Sheets có đổi màu/hiện chữ "AC" thành công không.

---

## 📅 Giai đoạn 4: Đưa lên Đám mây với GitHub Actions (Dự kiến: 1 ngày)
*Mục tiêu: Đặt lịch cho Bot chạy tự động mỗi ngày (hoặc mỗi x giờ) mà không cần bật máy tính.*

- [ ] **Upload code lên GitHub:** Tạo 1 Repository **Private**, push code Python của bạn lên.
- [ ] **Bảo mật file API Key:** KHÔNG đưa file `.json` của Google API lên repo. Dùng tính năng **GitHub Secrets** để lưu trữ các biến môi trường nhạy cảm này.
- [ ] **Tạo Workflow:** 
  - Tạo file `.github/workflows/auto_update.yml`.
  - Cấu hình Cron job. Ví dụ: `cron: '0 */6 * * *'` (Chạy mỗi 6 tiếng).
  - Cấu hình các bước: Checkout code -> Setup Python -> Cài thư viện (`pip install -r requirements.txt`) -> Chạy file `main.py`.
- [ ] **Kiểm tra luồng Actions:** Chạy trigger thủ công (Run workflow) để xem tiến trình trên GitHub có báo màu xanh (Success) không.

---

## 📅 Giai đoạn 5: Vận hành & Onboarding (Ngày cuối)
*Mục tiêu: Đưa học sinh vào sử dụng.*

- [ ] **Thu thập thông tin:** Gửi Google Form cho học sinh điền: `Họ tên`, `Email Notion`, `Các Handle Codeforces/VNOI/LQDOJ`.
- [ ] **Nhập liệu ban đầu:** Nhập Data vào Sheet 1. Thêm email học sinh vào Notion.
- [ ] **Chạy thử toàn hệ thống:** Yêu cầu một học sinh nộp thử 1 bài test dễ để hệ thống tự chạy vòng đời đầu tiên.
- [ ] **Tối ưu Dashboard:** Chỉnh lại màu sắc trong Google Sheets (Dùng Conditional Formatting: Chữ "AC" tự đổi sang màu xanh lá).

---
*Chúc bạn triển khai thành công! Trong quá trình làm, đến bước nào bạn có thể yêu cầu tôi hỗ trợ viết code hoặc giải thích sâu hơn.*