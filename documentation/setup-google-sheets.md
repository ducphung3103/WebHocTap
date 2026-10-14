# 📘 CẨM NANG THAO TÁC KỸ THUẬT (CẦM TAY CHỈ VIỆC)

Tài liệu này hướng dẫn từng thao tác click chuột chuẩn xác, ngắn gọn nhất để thiết lập toàn bộ hệ thống từ Google Cloud đến GitHub Actions.

---

## 🟢 PHẦN 1: TẠO GOOGLE SERVICE ACCOUNT & CẤP QUYỀN GOOGLE SHEETS

### Bước 1: Kích hoạt Google Sheets & Drive API trên Google Cloud
1. Truy cập [Google Cloud Console](https://console.cloud.google.com/).
2. Đăng nhập bằng tài khoản Google của bạn.
3. Ở thanh menu trên cùng, bấm chọn **Select a project** -> Nhấp **NEW PROJECT** (Dự án mới).
4. Đặt tên dự án: `LMS-Progress-Tracker` -> Bấm **CREATE**.
5. Chờ vài giây để tạo dự án, sau đó chọn dự án vừa tạo.
6. Vào thanh tìm kiếm trên cùng, gõ `Google Sheets API` -> Nhấp vào kết quả -> Bấm **ENABLE** (Bật).
7. Tương tự, gõ `Google Drive API` -> Nhấp vào kết quả -> Bấm **ENABLE** (Bật).

### Bước 2: Tạo Service Account (Tài khoản dịch vụ bot)
1. Ở menu bên trái, vào **APIs & Services** -> Chọn **Credentials** (Thông tin xác thực).
2. Nhấp nút **+ CREATE CREDENTIALS** ở trên cùng -> Chọn **Service account**.
3. Điền thông tin:
   - **Service account name:** `oj-tracker-bot`
   - Bấm **CREATE AND CONTINUE**.
4. Mục **Grant this service account access to project**:
   - Ở ô **Role**, chọn `Editor` (hoặc `Basic` -> `Editor`).
   - Bấm **CONTINUE** -> Bấm **DONE**.

### Bước 3: Tạo và Tải file Key JSON về máy
1. Trong danh sách Service Accounts vừa tạo, nhấp vào email của service account (dạng: `oj-tracker-bot@lms-progress-tracker.iam.gserviceaccount.com`).
2. Chuyển sang tab **KEYS** -> Bấm **ADD KEY** -> Chọn **Create new key**.
3. Chọn định dạng **JSON** -> Bấm **CREATE**.
4. Trình duyệt sẽ tự động tải về một file `.json` (Ví dụ: `lms-progress-tracker-xxxx.json`).
5. Đổi tên file này thành `service_account.json` và lưu vào thư mục dự án `WebHocTap` (Tuyệt đối không commit file này lên Git công khai).

### Bước 4: Chia sẻ Google Sheets cho Service Account
1. Mở file Google Sheets tiến độ của bạn trên Google Drive.
2. Bấm nút **Chia sẻ** (Share) màu xanh góc trên bên phải.
3. Dán địa chỉ email của Service Account (`oj-tracker-bot@...iam.gserviceaccount.com`) vào ô mời.
4. Chọn quyền **Người chỉnh sửa (Editor)**.
5. Bỏ tích ô "Thông báo cho mọi người" -> Bấm **Chia sẻ (Share)**.
6. Lấy `SPREADSHEET_ID`: Nhìn lên thanh địa chỉ trình duyệt:
   ```
   https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit
   ```
   Chuỗi nằm giữa `/d/` và `/edit` chính là `SPREADSHEET_ID` (Ở ví dụ trên là `1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms`).

---

## 🟡 PHẦN 2: NHÚNG BẢNG ĐIỂM GOOGLE SHEETS VÀO NOTION

1. Mở trang Google Sheets tiến độ -> Bấm nút **Chia sẻ (Share)**.
2. Tại mục *Quyền truy cập chung*, chuyển thành **Bất kỳ ai có đường liên kết** (Chọn quyền: *Người xem - Viewer*).
3. Bấm **Sao chép đường liên kết (Copy link)**.
4. Mở Notion, điều hướng đến trang con `🏆 Bảng xếp hạng / Tiến độ`.
5. Gõ lệnh `/embed` -> Nhấn Enter -> Dán đường link Google Sheets vừa copy -> Bấm **Embed link**.
6. Kéo dãn khung nhúng trên Notion cho vừa vặn với toàn bộ chiều ngang của trang. Giờ đây học sinh có thể xem bảng điểm cập nhật trực tiếp ngay trên Notion!

---

## 🟣 PHẦN 3: CẤU HÌNH GITHUB ACTIONS (TỰ ĐỘNG CHẤM 24/7)

### Bước 1: Đẩy mã nguồn lên GitHub Repository Private
1. Truy cập [GitHub](https://github.com/) -> Bấm **New repository**.
2. Đặt tên repo: `WebHocTap` hoặc `oj-lms-tracker`.
3. **QUAN TRỌNG:** Chọn chế độ **Private** (Riêng tư).
4. Bấm **Create repository**.
5. Mở terminal tại thư mục `D:\0.CP\WebHocTap` và chạy:
   ```bash
   git init
   git add .
   git commit -m "feat: complete automated OJ tracker"
   git branch -M main
   git remote add origin https://github.com/<your-username>/WebHocTap.git
   git push -u origin main
   ```

### Bước 2: Thiết lập GitHub Secrets
1. Trong repository trên GitHub, bấm vào tab **Settings** (Bánh răng).
2. Ở thanh bên trái, cuộn xuống mục **Secrets and variables** -> Chọn **Actions**.
3. Bấm nút **New repository secret**:
   - **Secret 1:**
     - Name: `SPREADSHEET_ID`
     - Value: Dán chuỗi Spreadsheet ID lấy từ link Google Sheets ở Phần 1.
     - Bấm **Add secret**.
   - **Secret 2:**
     - Name: `GCP_SA_KEY`
     - Value: Mở file `service_account.json` bằng Notepad / VS Code, copy toàn bộ nội dung JSON và dán vào ô này.
     - Bấm **Add secret**.

### Bước 3: Kích hoạt chạy thử trên GitHub
1. Vào tab **Actions** trên GitHub repository.
2. Ở cột bên trái, nhấp chọn workflow **Online Judge Auto Tracker**.
3. Bấm nút **Run workflow** (nằm bên phải) -> Chọn branch `main` -> Bấm nút **Run workflow** màu xanh.
4. Chờ 30-60 giây, workflow sẽ hiện tích xanh ✅ **Success**. Bảng Google Sheets sẽ tự động cập nhật tất cả bài nộp AC mới của học sinh!
