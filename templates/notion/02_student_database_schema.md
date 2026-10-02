# 📋 NOTION DATABASE SCHEMA: QUẢN LÝ DANH SÁCH HỌC SINH
*Hỗ trợ các nền tảng: Codeforces (làm đề), VJudge (Codeforces, VNOI, CSES), MarisaOJ*

Dưới đây là cấu trúc chi tiết các trường (Properties) chuẩn hóa cho Database Học sinh trên Notion:

| Tên Cột (Property Name) | Kiểu dữ liệu (Type) | Mục đích & Mô tả | Ví dụ dữ liệu |
| :--- | :--- | :--- | :--- |
| **Họ và Tên** | `Title` (Bắt buộc) | Họ tên đầy đủ của học sinh | `Nguyễn Văn An` |
| **STT** | `Number` | Số thứ tự định danh học sinh, đồng bộ với Google Sheets | `1`, `2`, `3` |
| **Email** | `Email` | Email đăng ký Notion và Google để phân quyền bài giảng | `an.nguyen@gmail.com` |
| **Codeforces Handle** | `Text` | Tên tài khoản Codeforces (dùng để làm đề thi / contest) | `tourist` |
| **VJudge Handle** | `Text` | Tên tài khoản VJudge (tổng hợp bài Codeforces, VNOI, CSES) | `an_vjudge` |
| **MarisaOJ Handle** | `Text` | Tên tài khoản trên MarisaOJ | `an_marisaoj` |
| **Trạng thái** | `Select` | Tình trạng theo học của học sinh | Options: `🟢 Đang học`, `🟡 Tạm nghỉ`, `⚪ Hoàn thành` |
| **Số điện thoại / Zalo** | `Phone` | Liên hệ trực tiếp với học sinh / phụ huynh khi cần | `0912345678` |
| **Trường / Lớp** | `Text` | Đơn vị trường học hiện tại | `Lớp 10 Tin - THPT Chuyên KHTN` |
| **Mục tiêu học tập** | `Multi-select` | Mục tiêu tham dự các kỳ thi | Options: `HSG Cấp Tỉnh/TP`, `HSG Quốc Gia`, `Tin học trẻ` |
| **Ghi chú** | `Text` | Lưu ý về điểm mạnh, điểm yếu hoặc bài tập nợ | `Cần cải thiện Quy hoạch động` |

---

### 💡 Các View gợi ý nên tạo trên Notion:
1. **View 1 - All Students (Table View):** Hiển thị toàn bộ học sinh và 3 handle luyện tập.
2. **View 2 - Đang học (Filtered Table):** Lọc theo `Trạng thái = 🟢 Đang học`.
3. **View 3 - Theo Mục tiêu (Board View):** Nhóm các cột Kanban theo `Mục tiêu học tập`.
