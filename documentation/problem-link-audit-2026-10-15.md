# Đối chiếu tên và link bài tập — 15/10/2026

## Quy tắc nguồn dữ liệu

Google Sheet là nguồn gốc. Lần rà soát này chỉ dùng quyền `spreadsheets.readonly`, không sửa, thêm hoặc xóa ô nào. Đối chiếu hai chiều có nghĩa là kiểm tra bài có ở mỗi phía; chỉ cập nhật website theo Sheet. Không đẩy khác biệt từ web ngược vào Sheet.

Phạm vi: tab **Bài Tập** (47 bài) và hai danh mục `problems`, `grader_problems` của website (51 bài mỗi danh mục). Không nhập các tab kho tham khảo vào danh sách bài tập đang giao.

## Chênh lệch web ↔ Sheet

| Mã bài | Vị trí Sheet | Web trước sửa | Giá trị gốc | Xử lý |
| --- | --- | --- | --- | --- |
| PY-EX-02 | C41 | Chú quạ thông minh | Chú quạ cứng đầu | Đã sửa tên ở cả hai danh mục web; giữ nguyên đề và bộ test |

Sau sửa: **47/47 bài chung khớp tên và URL**, không có bài trên Sheet bị thiếu ở web. Bốn bài chỉ có trên web là `HSG-NUMBER`, `HSG-FACTORIAL`, `HSG-SEGMENT`, `HSG-DIVISOR`: giữ nguyên đề, không thêm vào Sheet. Việc xóa bài nộp NBK không xóa bốn đề này.

## Tên trong nguồn so với trang đích

Các vấn đề dưới đây tồn tại cả trong Sheet và trên web. Chưa tự sửa vì sẽ trái với quy tắc giữ Sheet làm nguồn gốc.

| Mã bài | Tên đang lưu | Trang đích / kết quả |
| --- | --- | --- |
| MARISA-2 | Chu vi và diện tích hình chữ nhật | Link `/problem/2` là **A + B**, không phải bài hình chữ nhật. [Trang đề](https://marisaoj.com/problem/2), [tài liệu chính thức cũng dẫn A+B tới /problem/2](https://marisaoj.com/resources/notes/) |
| CF-486C | Palindromic Transformation | Link đúng mã 486C nhưng tên chính thức là **Palindrome Transformation**. [Trang đề](https://codeforces.com/problemset/problem/486/C) |

`MARISA-1` (A + B → `/problem/1`) cũng cần kiểm tra: tài liệu MarisaOJ dẫn A+B tới `/problem/2`, nhưng chưa đọc được nội dung `/problem/1` để kết luận chắc chắn. Không tự đổi ID hoặc URL vì có thể làm sai liên kết bài nộp và bộ test.

Đã xác nhận `CF-214B` — [Hometask](https://codeforces.com/problemset/problem/214/B), `CF-231C` — [To Add or Not to Add](https://codeforces.com/problemset/problem/231/C) và `CSES-1628` — [Meet in the Middle](https://cses.fi/problemset/task/1628) khớp tên. Ba trang Codeforces và trang CSES đều trả HTTP 200 trong lần kiểm tra trực tiếp; HTTP 200 riêng lẻ không chứng minh tên bài đúng.

## Giới hạn xác minh

Đã thử đọc cả **33 URL ngoài**. Toàn bộ 29 URL MarisaOJ trả trang xác minh Cloudflare/HTTP 403, không thể dùng tiêu đề trang chặn để kết luận bài sai. Riêng MARISA-2 được đối chứng thêm từ chỉ mục tìm kiếm và tài liệu chính thức.

28 bài MarisaOJ còn lại **chưa xác minh được nội dung đích**: 1, 3, 4, 6, 7, 8, 10, 11, 13, 14, 15, 16, 20, 42, 314, 396, 397, 401, 402, 405, 416, 419, 499, 535, 536, 537, 541, 587. Không coi nhóm này là đã đúng hay đã sai.

## Bảo vệ đồng bộ

- Tác vụ định kỳ đã bỏ bước đẩy dữ liệu web lên Sheet; bộ đọc dùng quyền chỉ đọc.
- Nút đồng bộ dùng endpoint chỉ kéo dữ liệu; không đẩy hàng đợi chỉnh sửa vào Sheet. Route đồng bộ hai chiều cũ cũng chỉ kéo dữ liệu.
- Đọc URL thực trong ô HYPERLINK/rich text, không nhầm nhãn hiển thị thành đường dẫn.
- Các thao tác quản trị ghi Sheet riêng biệt không được chạy trong lần rà soát này; đây không phải việc vô hiệu hóa toàn bộ tính năng quản trị.

Chạy lại: `python -m scripts.audit_problem_links --check-targets`. Báo cáo máy đọc được lưu riêng ở `data/private/problem-link-audit.json`, không xuất bản dữ liệu Sheet lên trang công khai.
