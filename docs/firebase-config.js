/**
 * ==============================================================================
 * FIREBASE REALTIME DATABASE CONFIGURATION & DATA STORAGE ENGINE
 * ==============================================================================
 * WebHocTap Security Layer: Toàn bộ thông tin học sinh, mã PIN, học phí và tiến độ
 * được lưu trữ bảo mật trên Firebase Realtime Database.
 * File docs/data.json chỉ chứa bài tập và bài giảng công khai, TUYỆT ĐỐI không lộ học sinh.
 *
 * HƯỚNG DẪN 3 BƯỚC THIẾT LẬP:
 * 1. Mở https://console.firebase.google.com/ > Tạo hoặc chọn Project.
 * 2. Vào Build > Realtime Database > Bấm "Create Database" (chọn location Singapore: asia-southeast1 hoặc us-central1).
 * 3. Vào tab Rules, dán nội dung từ file firebase_rules.json và bấm "Publish".
 * 4. Nhập dữ liệu ban đầu: Bấm dấu 3 chấm (⋮) góc phải Realtime Database > Chọn "Import JSON" > Tải tệp firebase_database_export.json lên.
 * 5. Sao chép Database URL (VD: https://your-project-default-rtdb.asia-southeast1.firebasedatabase.app)
 *    và dán vào biến databaseURL bên dưới (hoặc dán trong Giao diện Quản Trị Hệ Thống).
 */

const FIREBASE_CONFIG = {
  // URL Firebase Realtime Database đã cấu hình:
  databaseURL: "https://webhoctap-46912-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "webhoctap-46912"
};

/**
 * Lấy URL Realtime Database hiện tại (ưu tiên URL cấu hình trong localStorage của Admin)
 */
function getFirebaseDatabaseUrl() {
  const customUrl = localStorage.getItem('cp_firebase_db_url');
  if (customUrl && customUrl.trim()) {
    return customUrl.trim().replace(/\/+$/, '');
  }
  return (FIREBASE_CONFIG.databaseURL || '').trim().replace(/\/+$/, '');
}

/**
 * Kiểm tra xem Firebase Realtime Database đã được cấu hình URL thật hay chưa
 */
function isFirebaseConfigured() {
  const url = getFirebaseDatabaseUrl();
  return Boolean(url && !url.includes('webhoctap-default-rtdb.firebaseio.com'));
}

/**
 * 1. Xác thực mã PIN hoặc mật khẩu trực tiếp qua Firebase Realtime Database
 * @param {string} tokenHash - Mã băm SHA-256 của mã PIN hoặc mật khẩu
 * @returns {Promise<{success: boolean, data?: object, error?: string, notConfigured?: boolean}>}
 */
async function verifyAuthTokenFromFirebase(tokenHash) {
  const dbUrl = getFirebaseDatabaseUrl();
  if (!isFirebaseConfigured()) {
    return {
      success: false,
      notConfigured: true,
      error: "Chưa cấu hình URL Firebase Realtime Database. Vui lòng cập nhật URL tại docs/firebase-config.js hoặc trong Bảng Quản Trị!"
    };
  }

  try {
    const url = `${dbUrl}/auth_tokens/${tokenHash}.json`;
    const resp = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });

    if (!resp.ok) {
      if (resp.status === 401 || resp.status === 403) {
        return { 
          success: false, 
          error: "Lỗi phân quyền Firebase (401/403). Vui lòng kiểm tra lại Rules trong Firebase Console!" 
        };
      }
      return { success: false, error: `Lỗi kết nối Firebase (HTTP ${resp.status})` };
    }

    const data = await resp.json();
    if (data) {
      return { success: true, data: data };
    }

    // 2. Dự phòng: Tìm mã PIN trong danh sách học sinh (đã băm SHA-256 an toàn)
    try {
      const students = await fetchStudentsFromFirebase();
      if (students && Array.isArray(students)) {
        const found = students.find(s => s && s.pin_hash && s.pin_hash.toLowerCase() === tokenHash.toLowerCase());
        if (found) {
          return {
            success: true,
            data: {
              role: "student",
              name: found.name,
              class: found.class,
              stt: found.stt
            }
          };
        }
      }
    } catch(fErr) {
      console.warn("Fallback pin_hash check error:", fErr);
    }

    return { success: false, error: "Mã PIN hoặc mật khẩu không chính xác!" };
  } catch (err) {
    console.error("Firebase Auth Error:", err);
    return {
      success: false,
      error: "Không thể kết nối đến máy chủ Firebase. Vui lòng kiểm tra lại mạng hoặc URL Database!"
    };
  }
}

/**
 * 2. Tải danh sách học sinh từ Firebase Realtime Database
 */
async function fetchStudentsFromFirebase() {
  if (!isFirebaseConfigured()) return null;
  const dbUrl = getFirebaseDatabaseUrl();
  try {
    const resp = await fetch(`${dbUrl}/students.json`, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(6000)
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    if (!data) return null;
    if (Array.isArray(data)) {
      return data.filter(Boolean);
    }
    if (typeof data === 'object') {
      return Object.values(data);
    }
    return null;
  } catch(err) {
    console.warn("Could not fetch students from Firebase:", err);
    return null;
  }
}

/**
 * 3. Tải danh sách bài nộp từ Firebase Realtime Database
 */
async function fetchSubmissionsFromFirebase() {
  if (!isFirebaseConfigured()) return null;
  const dbUrl = getFirebaseDatabaseUrl();
  try {
    const resp = await fetch(`${dbUrl}/submissions.json`, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(6000)
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    if (!data) return [];
    if (Array.isArray(data)) {
      return data.filter(Boolean);
    }
    if (typeof data === 'object') {
      return Object.values(data);
    }
    return [];
  } catch(err) {
    console.warn("Could not fetch submissions from Firebase:", err);
    return [];
  }
}

/**
 * 4. Lưu toàn bộ danh sách học sinh lên Firebase
 */
async function saveStudentsToFirebase(students) {
  if (!isFirebaseConfigured()) return false;
  const dbUrl = getFirebaseDatabaseUrl();
  try {
    const resp = await fetch(`${dbUrl}/students.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(students)
    });
    return resp.ok;
  } catch(err) {
    console.warn("Could not save students to Firebase:", err);
    return false;
  }
}

/**
 * 5. Cập nhật học phí cho 1 học sinh lên Firebase
 */
async function saveTuitionToFirebase(stt, month, isPaid) {
  if (!isFirebaseConfigured()) return false;
  const dbUrl = getFirebaseDatabaseUrl();
  try {
    const students = await fetchStudentsFromFirebase();
    if (students && Array.isArray(students)) {
      const idx = students.findIndex(s => s && s.stt === stt);
      if (idx !== -1) {
        const resp = await fetch(`${dbUrl}/students/${idx}/tuition/${encodeURIComponent(month)}.json`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(Boolean(isPaid))
        });
        return resp.ok;
      }
    }
  } catch(err) {
    console.warn("Could not save tuition to Firebase:", err);
  }
  return false;
}

/**
 * 6. Cập nhật trạng thái học sinh (Đang học / Nghỉ học) lên Firebase
 */
async function saveStudentStatusToFirebase(stt, newStatus) {
  if (!isFirebaseConfigured()) return false;
  const dbUrl = getFirebaseDatabaseUrl();
  try {
    const students = await fetchStudentsFromFirebase();
    if (students && Array.isArray(students)) {
      const idx = students.findIndex(s => s && s.stt === stt);
      if (idx !== -1) {
        const resp = await fetch(`${dbUrl}/students/${idx}/status.json`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newStatus)
        });
        return resp.ok;
      }
    }
  } catch(err) {
    console.warn("Could not update student status to Firebase:", err);
  }
  return false;
}

/**
 * 7. Lưu bài nộp mới lên Firebase
 */
async function saveSubmissionToFirebase(subData) {
  if (!isFirebaseConfigured()) return false;
  const dbUrl = getFirebaseDatabaseUrl();
  try {
    const resp = await fetch(`${dbUrl}/submissions.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(subData)
    });
    return resp.ok;
  } catch(err) {
    console.warn("Could not save submission to Firebase:", err);
    return false;
  }
}

/**
 * 8. Đẩy toàn bộ dữ liệu (students, submissions, metadata) lên Firebase từ trình duyệt
 */
async function pushFullDatabaseToFirebaseClient(fullData) {
  if (!isFirebaseConfigured()) return false;
  const dbUrl = getFirebaseDatabaseUrl();
  try {
    const payload = {
      students: fullData.students || [],
      submissions: fullData.submissions || [],
      metadata: {
        last_updated: new Date().toISOString(),
        tuition_months: fullData.tuition_months || ['Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'],
        data_source: "firebase"
      }
    };
    const resp = await fetch(`${dbUrl}/.json`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (resp.ok) return true;

    // Fallback: push endpoints individually in case root PATCH is restricted
    const rStudents = await fetch(`${dbUrl}/students.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload.students)
    });
    await fetch(`${dbUrl}/metadata.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload.metadata)
    });
    return rStudents.ok;
  } catch(err) {
    console.error("Could not push full data to Firebase:", err);
    return false;
  }
}
