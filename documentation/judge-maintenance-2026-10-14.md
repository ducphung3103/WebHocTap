# Báo cáo bảo trì máy chấm và hướng dẫn chỉnh sửa

Ngày cập nhật: 14/10/2026  
Phạm vi: máy chấm trên web, phân tải local/cloud, lịch sử bài nộp và giao diện DeruckOJ.

## 1. Kết quả đã hoàn thành

- Sửa chế độ tự động để không gửi C++ vào Local Judge khi máy không có `g++`.
- Khi chấm theo lô tại Local Judge gặp lỗi hệ thống, chế độ tự động chuyển sang Judge0/Wandbox.
- Trạng thái lỗi hệ thống `SE` không còn bị coi là kết quả chạy hợp lệ.
- Chế độ cố định Local Judge báo rõ khi thiếu compiler hoặc không hỗ trợ batch.
- Chuyển client kết nối máy chấm vào `docs/assets/js/judge/client.js`.
- Lưu lịch sử bài nộp trên trình duyệt trước khi thực hiện đồng bộ mạng.
- Chờ kết quả lưu Firebase/Google Sheets trước khi đánh dấu trạng thái đồng bộ.
- Hợp nhất lịch sử cục bộ với `appData.submissions` và loại bản ghi trùng theo `id`.
- Chuyển lịch sử cũ từ khóa `deruck_judge_history` sang `deruck_judge_history_v2`.
- Giới hạn lịch sử cục bộ ở 30 mục và khoảng 1,8 triệu ký tự để giảm lỗi đầy `localStorage`.
- Dùng ID dạng `SUB-<timestamp>-<random>` để tránh trùng giữa nhiều lần nộp hoặc nhiều tab.
- Hiển thị `Chờ đồng bộ`, `Đã lưu` hoặc `Lưu trên máy` trong lịch sử.
- Tinh gọn giao diện máy chấm còn ba khu vực: `Đề bài`, `Viết code`, `Lịch sử`.
- Bỏ nút xem song song và rút gọn các nhãn Anh–Việt dư thừa.
- Thêm kho IndexedDB `deruckoj-realtime-data/submissions` để giữ bài cũ và bài offline trên thiết bị.
- Đổi các luồng tải Firebase từ thay thế toàn bộ sang hợp nhất theo submission ID.
- Đồng bộ thay đổi IndexedDB giữa nhiều tab bằng `BroadcastChannel`.
- Thêm giao diện `Cool Breeze` xanh trời/xanh lá nhạt cho trang chính và trang học sinh.

## 2. Vị trí mã nguồn quan trọng

| Thành phần | Tệp | Trách nhiệm |
|---|---|---|
| Client máy chấm | `docs/assets/js/judge/client.js` | Kiểm tra health, chọn server, gọi Local/Judge0/Wandbox, batch và failover |
| Kho bài nộp thiết bị | `docs/assets/js/data/submission-store.js` | IndexedDB, hợp nhất theo ID và thông báo thay đổi giữa các tab |
| Giao diện màu | `docs/assets/css/cool-breeze.css` | Palette xanh trời/bạc hà dùng chung, ghi đè giao diện tối cũ |
| Không gian làm bài | `docs/assets/js/app.js` | Chạy thử, nộp bài, tính verdict, tạo submission và hiển thị lịch sử |
| Giao diện | `docs/index.html` | Ba tab máy chấm, editor, kết quả và bảng lịch sử |
| Firebase | `docs/firebase-config.js` | Đọc/ghi submission lên Realtime Database |
| Local HTTP server | `src/judge_server.py` | API `/health`, `/judge`, `/judge-batch` và API đồng bộ cục bộ |
| Lõi thực thi | `src/core/judge_engine.py` | Biên dịch/chạy C++ và Python, timeout, output limit và batch |
| Lưu bài cục bộ backend | `src/core/submission_store.py` | Upsert submission vào `data/private/` |

## 3. Luồng lưu một bài nộp

```text
Chấm xong
  → tạo một submission ID duy nhất
  → lưu code và verdict vào deruck_judge_history_v2
  → thêm cùng ID vào appData.submissions và cache
  → lưu bản bền vững vào IndexedDB trên thiết bị
  → thử lưu Firebase
  → thử Google Sheets hoặc backend cục bộ
  → cập nhật sync_status = synced | pending
  → render lịch sử đã gộp và chống trùng ID
```

Lưu ý: một bài nộp phải dùng cùng một `id` ở lịch sử cục bộ, `appData.submissions`, Firebase và Google Sheets. Không tạo ID mới ở từng tầng.

## 4. Schema lịch sử cục bộ

Các trường tối thiểu:

```js
{
  id: "SUB-...",
  timestamp: 1791990000000,
  submitted_at: "14/10/2026 21:00:00",
  probId: "CPP-TEST",
  probName: "Tên bài",
  lang: "C++20",
  verdict: "AC",
  score: 100,
  acCount: 10,
  totalCount: 10,
  code: "...",
  sync_status: "local" // local | pending | synced
}
```

`sync_status` có ý nghĩa:

- `local`: mới lưu trên trình duyệt, chưa thử đồng bộ.
- `pending`: Firebase và kênh Sheets/backend đều chưa xác nhận; payload đã được đưa vào hàng đợi đồng bộ.
- `synced`: ít nhất một kênh lưu từ xa đã xác nhận thành công.

## 5. Các quy tắc phải giữ khi sửa tiếp

1. Luôn lưu cục bộ trước khi gọi mạng để mất kết nối không làm mất bài.
2. Không dùng thao tác fire-and-forget cho submission; phải `await` kết quả lưu.
3. Không coi `SE`, response đang queue hoặc response thiếu trạng thái là verdict hợp lệ.
4. Chế độ `auto` phải bỏ qua Local Judge cho C++ nếu `/health` trả `gpp: false`.
5. Chế độ `local` không được âm thầm chuyển cloud; cần báo lỗi rõ cho người dùng.
6. Khi render lịch sử, chống trùng bằng submission `id` và chỉ hiện bài của problem hiện tại.
7. Nút xóa lịch sử chỉ xóa cache trên thiết bị; không xóa Firebase/Sheets.
8. Không đưa mã nguồn, học sinh, token hoặc PIN vào `docs/data.json`.
9. Giữ `docs/` là thư mục public deploy; dữ liệu riêng nằm trong `data/private/`.
10. Nếu thay đổi schema, phải có bước đọc tương thích hoặc migration cho dữ liệu cũ.
11. Không thay `appData.submissions` bằng response Firebase ngắn hơn; luôn dùng `mergeSubmissionCollections`.
12. Khi tạo/xóa bài nộp, cập nhật cả Firebase/cache và IndexedDB.

## 6. Kiểm thử bắt buộc sau khi chỉnh sửa

Chạy từ thư mục gốc:

```bat
node scripts/check_project.mjs
node tests/judge-client.test.cjs
node --test tests/firebase.test.cjs
scripts\windows\run_python.bat -m unittest discover -s tests -v
node tests/browser-smoke.mjs
```

Các tình huống hồi quy quan trọng đã có kiểm thử:

- Local Python giữ nguyên time limit gửi từ client.
- Judge0 không biến trạng thái queued/internal error thành `OK`.
- Auto mode bỏ qua Local C++ khi thiếu compiler.
- Batch tự chuyển cloud khi Local Judge trả `SE`.
- Lịch sử còn sau khi reload và không hiển thị trùng với cache/server.
- Bài chấm xong có trạng thái `pending` khi mạng lỗi và `synced` khi lưu thành công.
- Nộp bài lỗi mạng vẫn tạo đúng một bản ghi cục bộ.

## 7. Giới hạn còn lại

- Local Judge chạy mã dưới tài khoản hệ điều hành, chưa phải sandbox bảo mật.
- Việc `synced` hiện có nghĩa là ít nhất một kênh từ xa thành công, không đảm bảo đồng thời cả Firebase và Google Sheets.
- Cloud judge thật chưa được gọi trong bộ kiểm thử offline; request/response được giả lập.
- Firebase rules hiện vẫn cần cơ chế xác thực máy chủ phù hợp trước khi dùng cho dữ liệu nhạy cảm.

## 8. Quy trình bàn giao khi hết quota

Nếu một phiên chỉnh sửa hết quota trước khi hoàn tất, tạo báo cáo mới trong `documentation/` và ghi:

- mục tiêu đang làm;
- thay đổi đã áp dụng;
- tệp và dòng liên quan;
- kiểm thử đã chạy cùng kết quả;
- lỗi hoặc giả thuyết còn lại;
- lệnh tiếp theo nên chạy;
- thay đổi chưa được xác minh hoặc cần hoàn tác.

Model tiếp theo nên đọc tài liệu này, báo cáo bàn giao mới nhất và `README.md` trước khi sửa máy chấm.
