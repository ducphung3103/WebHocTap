# 📋 NOTION DATABASE SCHEMA: QUẢN LÝ DANH SÁCH HỌC SINH

Dưới đây là cấu trúc chi tiết các trường (Properties) chuẩn hóa cho Database Học sinh trên Notion:

| Tên Cột (Property Name) | Kiểu dữ liệu (Type) | Mục đích & Mô tả | Ví dụ dữ liệu |
| :--- | :--- | :--- | :--- |
| **STT** | `Number` | Số thứ tự định danh học sinh, đồng bộ với Google Sheets | `1`, `2`, `3` |
| **Họ và Tên** | `Title` (Bắt buộc) | Họ tên đầy đủ của học sinh | `Nguyễn Văn An` |
| **Email** | `Email` | Email đăng ký Notion và Google để phân quyền bài giảng | `an.nguyen@gmail.com` |
| **Codeforces Handle** | `Text` | Tên tài khoản trên Codeforces để Bot tự động cào bài | `tourist` |
| **VNOI Handle** | `Text` | Tên tài khoản trên VNOI OJ | `vnoi_coder01` |
| **LQDOJ Handle** | `Text` | Tên tài khoản trên Le Quy Don OJ | `lqd_master` |
| **Trạng thái** | `Select` | Tình trạng theo học của học sinh | Options: `🟢 Đang học`, `🟡 Tạm nghỉ`, `⚪ Hoàn thành` |
| **Số điện thoại / Zalo** | `Phone` | Liên hệ trực tiếp với học sinh / phụ huynh khi cần | `0912345678` |
| **Trường / Lớp** | `Text` | Đơn vị trường học hiện tại | `Lớp 10 Tin - THPT Chuyên KHTN` |
| **Mục tiêu học tập** | `Multi-select` | Mục tiêu tham dự các kỳ thi | Options: `HSG Cấp Tỉnh/TP`, `HSG Quốc Gia`, `Tin học trẻ`, `Đổi giải đại học` |
| **Ghi chú** | `Text` | Lưu ý về điểm mạnh, điểm yếu hoặc bài tập nợ | `Cần cải thiện Quy hoạch động` |

---

### 💡 Các View gợi ý nên tạo trên Notion:
1. **View 1 - All Students (Table View):** Hiển thị toàn bộ học sinh và handles.
2. **View 2 - Đang học (Filtered Table):** Lọc theo `Trạng thái = 🟢 Đang học`.
3. **View 3 - Theo Mục tiêu (Board View):** Nhóm các cột Kanban theo `Mục tiêu học tập`.
