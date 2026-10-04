/**
 * =========================================================================
 * GOOGLE APPS SCRIPT: ĐỒNG BỘ 2 CHIỀU WEB <-> GOOGLE SHEET (WEBHOCTAP)
 * =========================================================================
 * 
 * HƯỚNG DẪN CÀI ĐẶT (Chỉ mất 1 phút):
 * 1. Trên Google Sheet "Quản lý học sinh", chọn: Tiện ích mở rộng (Extensions) > Apps Script.
 * 2. Xóa hết mã cũ trong tệp Code.gs, sao chép toàn bộ nội dung tệp này dán vào.
 * 3. Bấm biểu tượng 💾 "Lưu dự án" (Save).
 * 4. Bấm nút màu xanh "Triển khai" (Deploy) ở góc trên bên phải > "Tùy chọn triển khai mới" (New deployment).
 *    - Chọn loại: Ứng dụng web (Web app).
 *    - Mô tả: "WebHocTap Two-Way Sync API".
 *    - Thực thi dưới dạng (Execute as): "Tôi" (Me - tài khoản Google của bạn).
 *    - Ai có quyền truy cập (Who has access): "Bất kỳ ai" (Anyone).
 * 5. Bấm "Triển khai" (Deploy), cấp quyền truy cập nếu Google yêu cầu.
 * 6. Sao chép "URL ứng dụng web" (Web App URL) nhận được.
 * 7. Mở trang Web > Bảng điều khiển Giáo viên > Cài đặt đồng bộ 2 chiều > Dán URL này vào!
 */

function doGet(e) {
  var output = {
    status: "ok",
    message: "Google Apps Script 2-Way Sync API for WebHocTap is active!",
    timestamp: new Date().toISOString()
  };
  return ContentService.createTextOutput(JSON.stringify(output))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000); // Đợi tối đa 10s tránh xung đột ghi đè
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: "Server bận, vui lòng thử lại sau vài giây!"
    })).setMimeType(ContentService.MimeType.JSON);
  }

  var response = { status: "error", message: "Yêu cầu không hợp lệ" };

  try {
    var contents = e.postData ? e.postData.contents : "";
    var data = {};
    if (contents) {
      data = JSON.parse(contents);
    }

    var action = data.action || "";
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // 1. CẬP NHẬT TRẠNG THÁI HỌC PHÍ (Học Phí tab)
    if (action === "update_tuition") {
      var studentName = (data.name || data.student || "").trim().toLowerCase();
      var month = (data.month || "").trim().toLowerCase();
      var isPaid = !!(data.paid !== undefined ? data.paid : data.is_paid);

      var sheetFee = ss.getSheetByName("Học Phí");
      if (!sheetFee) {
        throw new Error("Không tìm thấy tab 'Học Phí'");
      }

      var values = sheetFee.getDataRange().getValues();
      var headerRowIdx = -1;
      for (var r = 0; r < values.length; r++) {
        var rowStr = values[r].join(" ").toLowerCase();
        if (rowStr.indexOf("họ và tên") !== -1 && (rowStr.indexOf("tháng") !== -1 || rowStr.indexOf("thang") !== -1)) {
          headerRowIdx = r;
          break;
        }
      }

      if (headerRowIdx === -1) throw new Error("Không tìm thấy hàng tiêu đề trong 'Học Phí'");

      var header = values[headerRowIdx];
      var monthColIdx = -1;
      for (var c = 0; c < header.length; c++) {
        var cName = String(header[c]).toLowerCase().trim();
        if (cName.indexOf(month) !== -1 || cName.replace(/\s+/g, "") === month.replace(/\s+/g, "")) {
          monthColIdx = c;
          break;
        }
      }

      if (monthColIdx === -1) throw new Error("Không tìm thấy cột " + month);

      var studentRowIdx = -1;
      for (var r = headerRowIdx + 1; r < values.length; r++) {
        var curName = String(values[r][0]).toLowerCase().trim();
        if (curName === studentName || curName.indexOf(studentName) !== -1 || studentName.indexOf(curName) !== -1) {
          studentRowIdx = r;
          break;
        }
      }

      if (studentRowIdx === -1) throw new Error("Không tìm thấy học sinh " + data.name);

      sheetFee.getRange(studentRowIdx + 1, monthColIdx + 1).setValue(isPaid ? true : false);
      response = {
        status: "success",
        action: "update_tuition",
        student: data.name,
        month: data.month,
        is_paid: isPaid,
        cell: sheetFee.getRange(studentRowIdx + 1, monthColIdx + 1).getA1Notation()
      };
    }

    // 2. CẬP NHẬT TRẠNG THÁI HỌC SINH (Học Sinh tab)
    else if (action === "update_student_status") {
      var studentName = (data.name || data.student || "").trim().toLowerCase();
      var newStatus = data.status || data.new_status || "Đang học";

      var sheetStu = ss.getSheetByName("Học Sinh");
      if (!sheetStu) throw new Error("Không tìm thấy tab 'Học Sinh'");

      var values = sheetStu.getDataRange().getValues();
      var header = values[0];
      var statusColIdx = 9; // default col J
      for (var c = 0; c < header.length; c++) {
        if (String(header[c]).toLowerCase().indexOf("trạng thái") !== -1) {
          statusColIdx = c;
          break;
        }
      }

      var targetRow = -1;
      for (var r = 1; r < values.length; r++) {
        if (String(values[r][1]).toLowerCase().trim() === studentName) {
          targetRow = r;
          break;
        }
      }

      if (targetRow === -1) throw new Error("Không tìm thấy học sinh " + data.name);

      sheetStu.getRange(targetRow + 1, statusColIdx + 1).setValue(newStatus);
      response = { status: "success", action: "update_student_status", student: data.name, new_status: newStatus };
    }

    // 3. THÊM / CẬP NHẬT HỌC SINH (Học Sinh tab & Học Phí tab)
    else if (action === "save_student") {
      var st = data.student || data;
      var name = (st.name || "").trim();
      if (!name) throw new Error("Tên học sinh không được rỗng");

      var sheetStu = ss.getSheetByName("Học Sinh");
      var values = sheetStu.getDataRange().getValues();
      var foundRow = -1;
      for (var r = 1; r < values.length; r++) {
        if (String(values[r][1]).toLowerCase().trim() === name.toLowerCase()) {
          foundRow = r;
          break;
        }
      }

      var stt = foundRow !== -1 ? values[foundRow][0] : String(values.length);
      var rowData = [
        stt,
        name,
        st.class || "C++ nâng cao",
        st.marisa_handle || "",
        st.cf_handle || "",
        st.vjudge_handle || "",
        st.vnoi_handle || "",
        st.clue_handle || "",
        st.pin || "",
        st.status || "Đang học",
        st.notes || ""
      ];

      if (foundRow !== -1) {
        sheetStu.getRange(foundRow + 1, 1, 1, rowData.length).setValues([rowData]);
      } else {
        sheetStu.appendRow(rowData);
        // Thêm dòng tương ứng bên Học Phí nếu chưa có
        var sheetFee = ss.getSheetByName("Học Phí");
        if (sheetFee) {
          sheetFee.appendRow([name, st.class || "C++ nâng cao", false, false, false, false]);
        }
      }
      response = { status: "success", action: "save_student", student: name };
    }

    // 4. THÊM / CẬP NHẬT BÀI TẬP (Bài Tập tab)
    else if (action === "save_problem") {
      var prob = data.problem || data;
      var pid = (prob.id || "").trim().toUpperCase();
      if (!pid) throw new Error("Mã bài tập không được rỗng");

      var sheetProb = ss.getSheetByName("Bài Tập");
      if (!sheetProb) throw new Error("Không tìm thấy tab 'Bài Tập'");

      var values = sheetProb.getDataRange().getValues();
      var foundRow = -1;
      for (var r = 1; r < values.length; r++) {
        if (String(values[r][0]).trim().toUpperCase() === pid) {
          foundRow = r;
          break;
        }
      }

      var clsStr = Array.isArray(prob.classes) ? prob.classes.join(", ") : (prob.classes || "Tất cả");
      var diffStr = String(prob.difficulty || "1");
      var level = "1";
      for (var l = 1; l <= 5; l++) {
        if (diffStr.indexOf(String(l)) !== -1) { level = String(l); break; }
      }

      var rowData = [
        pid,
        prob.url || "",
        prob.name || "",
        clsStr,
        level,
        prob.category || "Brute Force",
        prob.platform || "MarisaOJ",
        prob.notes || ""
      ];

      if (foundRow !== -1) {
        sheetProb.getRange(foundRow + 1, 1, 1, rowData.length).setValues([rowData]);
      } else {
        sheetProb.appendRow(rowData);
      }
      response = { status: "success", action: "save_problem", problem_id: pid };
    }

    // 5. THÊM / CẬP NHẬT BÀI GIẢNG (Bài Giảng tab)
    else if (action === "save_curriculum") {
      var lec = data.lecture || data;
      var lid = (lec.id || "").trim().toUpperCase();
      var sheetLec = ss.getSheetByName("Bài Giảng");
      if (!sheetLec) throw new Error("Không tìm thấy tab 'Bài Giảng'");

      var values = sheetLec.getDataRange().getValues();
      if (!lid) lid = "LEC-" + values.length;

      var foundRow = -1;
      for (var r = 1; r < values.length; r++) {
        if (String(values[r][0]).trim().toUpperCase() === lid) {
          foundRow = r;
          break;
        }
      }

      var clsStr = Array.isArray(lec.classes) ? lec.classes.join(", ") : (lec.classes || "Tất cả");
      var rowData = [
        lid,
        lec.chapter || "Tuần 1",
        lec.title || "",
        clsStr,
        lec.url || "#",
        lec.summary || ""
      ];

      if (foundRow !== -1) {
        sheetLec.getRange(foundRow + 1, 1, 1, rowData.length).setValues([rowData]);
      } else {
        sheetLec.appendRow(rowData);
      }
      response = { status: "success", action: "save_curriculum", lecture_id: lid };
    }

    // 6. NỘP BÀI TẬP (ĐIỀN ĐÁP ÁN HOẶC TỰ LUẬN)
    else if (action === "submit_answer") {
      var sub = data.submission || data;
      var sheetSub = ss.getSheetByName("Bài Nộp");
      if (!sheetSub) {
        sheetSub = ss.insertSheet("Bài Nộp");
        sheetSub.appendRow(["Mã bài nộp", "Thời gian", "Họ và tên", "Lớp", "Mã bài", "Tên bài", "Hình thức", "Bài làm / Đáp án", "Trạng thái", "Điểm", "Nhận xét của Thầy"]);
      }

      var subId = sub.id || ("SUB-" + new Date().getTime());
      var subTime = sub.submitted_at || Utilities.formatDate(new Date(), "GMT+7", "dd/MM/yyyy HH:mm:ss");
      var subType = sub.submission_type_display || (sub.type === "essay" ? "Tự luận" : "Điền đáp án");
      var rowData = [
        subId,
        subTime,
        sub.student_name || "",
        sub.class_name || "",
        sub.problem_id || "",
        sub.problem_name || "",
        subType,
        sub.answer || "",
        sub.status || "Đã nộp",
        sub.score || "",
        sub.feedback || ""
      ];

      var values = sheetSub.getDataRange().getValues();
      var foundRow = -1;
      for (var r = 1; r < values.length; r++) {
        if (String(values[r][0]).trim() === subId) {
          foundRow = r;
          break;
        }
      }

      if (foundRow !== -1) {
        sheetSub.getRange(foundRow + 1, 1, 1, rowData.length).setValues([rowData]);
      } else {
        sheetSub.appendRow(rowData);
      }
      response = { status: "success", action: "submit_answer", id: subId };
    }

    // 7. CHẤM BÀI NỘP (CẬP NHẬT ĐIỂM & NHẬN XÉT)
    else if (action === "grade_submission") {
      var subId = data.id || data.submission_id;
      var sheetSub = ss.getSheetByName("Bài Nộp");
      if (!sheetSub) throw new Error("Chưa có tab 'Bài Nộp'");

      var values = sheetSub.getDataRange().getValues();
      var foundRow = -1;
      for (var r = 1; r < values.length; r++) {
        if (String(values[r][0]).trim() === subId) {
          foundRow = r;
          break;
        }
      }
      if (foundRow === -1) throw new Error("Không tìm thấy bài nộp " + subId);

      var newStatus = data.status || "Đã chấm";
      var newScore = data.score !== undefined ? String(data.score) : "";
      var newFeedback = data.feedback || "";

      sheetSub.getRange(foundRow + 1, 9, 1, 3).setValues([[newStatus, newScore, newFeedback]]);
      response = { status: "success", action: "grade_submission", id: subId };
    }

  } catch (err) {
    response = { status: "error", message: err.toString() };
  } finally {
    lock.releaseLock();
  }

  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}
