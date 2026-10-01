# 📝 NOTION DATABASE SCHEMA: KHO BÀI TẬP & NHIỆM VỤ TUẦN

Kho bài tập trên Notion giúp giáo viên lên giáo trình và học sinh theo dõi đề bài kèm link trực tiếp đến các OJ.

| Tên Cột (Property Name) | Kiểu dữ liệu (Type) | Mục đích & Mô tả | Ví dụ dữ liệu |
| :--- | :--- | :--- | :--- |
| **Mã bài tập (Problem Code)** | `Title` (Bắt buộc) | Mã định danh chuẩn khớp với Google Sheet để Bot tự động chấm | `CF-71A`, `VNOI-nklineup`, `LQDOJ-cses1068` |
| **Tên bài toán** | `Text` | Tên đầy đủ của bài tập | `Way Too Long Words` / `Xếp hàng` |
| **Nền tảng (Platform)** | `Select` | Nền tảng chấm bài trực tuyến | Options: `🟦 Codeforces`, `🟧 VNOI`, `🟩 LQDOJ` |
| **Link đề bài** | `URL` | Đường dẫn trực tiếp đến trang đề bài | `https://codeforces.com/problemset/problem/71/A` |
| **Chủ đề / Thuật toán** | `Multi-select` | Dạng bài để học sinh tiện ôn tập | Options: `Mảng & Chuỗi`, `Quy hoạch động`, `Đồ thị (BFS/DFS)`, `Tham lam`, `Số học`, `Cấu trúc dữ liệu` |
| **Độ khó / Rating** | `Select` | Phân loại cấp độ bài tập | Options: `🟢 Cơ bản (800-1000)`, `🟡 Trung bình (1100-1400)`, `🔴 Nâng cao (1500+)` |
| **Tuần học** | `Select` | Phân phối bài tập theo tuần của khóa học | Options: `Tuần 1: Nhập môn & Mảng`, `Tuần 2: Sắp xếp & Tìm kiếm`, `Tuần 3: Quy hoạch động 1` |
| **Hạn nộp (Deadline)** | `Date` | Thời hạn hoàn thành bài tập | `2026-10-15 23:59` |
| **Editorial / Hướng dẫn** | `URL` | Link lời giải mẫu hoặc code mẫu sau khi hết deadline | `https://notion.so/...` |

---

### 💡 Các View tối ưu trên Notion cho Học sinh:
1. **View "Bài tập tuần này" (Board View):** Nhóm theo `Tuần học`, lọc bài chưa hết hạn.
2. **View "Kho bài tập theo Thuật toán" (Table View):** Nhóm theo `Chủ đề / Thuật toán` để tiện tra cứu khi ôn thi.
3. **View "Lịch Deadline" (Calendar View):** Hiển thị theo `Hạn nộp` trên giao diện lịch trực quan.
