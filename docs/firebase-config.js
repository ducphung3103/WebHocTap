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
  const entries = await fetchFirebaseStudentEntries();
  return entries === null ? null : entries.map(entry => entry.student);
}

// Preserve the actual Firebase key: arrays can contain holes and objects use arbitrary keys.
async function fetchFirebaseStudentEntries() {
  if (!isFirebaseConfigured()) return null;
  const dbUrl = getFirebaseDatabaseUrl();
  try {
    const resp = await fetch(`${dbUrl}/students.json`, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(6000)
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    if (!data) return [];
    if (typeof data === 'object') return Object.entries(data)
      .filter(([, student]) => student && typeof student === 'object')
      .map(([key, student]) => ({ key, student }));
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
    const timeoutSignal = (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function')
      ? AbortSignal.timeout(12000)
      : undefined;
    const resp = await fetch(`${dbUrl}/submissions.json`, {
      headers: { 'Accept': 'application/json' },
      signal: timeoutSignal
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    if (!data) return [];
    let list = [];
    if (Array.isArray(data)) {
      list = data.filter(Boolean);
    } else if (typeof data === 'object') {
      list = Object.values(data);
    }
    // CHỈ LƯU VÀ XỬ LÝ BÀI NỘP CỦA WEB DERUCKOJ (loại bỏ các web khác: Marisa, CF, VJudge, CSES...)
    return list.filter(isDeruckSubmission);
  } catch(err) {
    console.warn("Could not fetch submissions from Firebase:", err);
    return null;
  }
}

/**
 * 3a-2. Lấy chi tiết 1 bài nộp cụ thể từ Firebase (kèm mã nguồn đầy đủ)
 */
async function fetchSingleSubmissionFromFirebase(subId) {
  if (!isFirebaseConfigured() || !subId) return null;
  const dbUrl = getFirebaseDatabaseUrl();
  try {
    const key = encodeURIComponent(subId);
    const timeoutSignal = (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function')
      ? AbortSignal.timeout(8000)
      : undefined;
    const resp = await fetch(`${dbUrl}/submissions/${key}.json`, {
      headers: { 'Accept': 'application/json' },
      signal: timeoutSignal
    });
    if (!resp.ok) return null;
    return await resp.json();
  } catch(err) {
    console.warn("Could not fetch single submission from Firebase:", err);
    return null;
  }
}

/**
 * 3b. Kiểm tra bài tập có thuộc WEB DeruckOJ hay không
 */
function isDeruckProblem(probId, probObj) {
  if (!probId && !probObj) return false;
  if (probObj && probObj.platform === 'DeruckOJ') return true;
  const pid = String(probId || (probObj ? probObj.id : '')).toUpperCase().trim();
  if (pid.startsWith('CPP-') || pid.startsWith('PY-') || pid.startsWith('PY11-') || pid.startsWith('26TI-') || pid.startsWith('DERUCK-') || pid.startsWith('HSG-')) {
    return true;
  }
  if (typeof appData !== 'undefined' && appData && Array.isArray(appData.problems)) {
    const found = appData.problems.find(p => p && p.id && p.id.toUpperCase() === pid);
    if (found && found.platform === 'DeruckOJ') return true;
  }
  return false;
}

/**
 * 3c. Kiểm tra bài nộp hợp lệ của WEB DeruckOJ (loại bỏ crawler ngoài, chỉ lưu và hiển thị bài nộp trên web DeruckOJ)
 */
function isImportedNbkSubmission(sub) {
  return Boolean(sub && (
    /^SUB-HSG-/i.test(String(sub.id || '').trim()) ||
    String(sub.submission_type_display || '').includes('Code Thi HSG')
  ));
}

function isDeruckSubmission(sub) {
  if (!sub || sub.is_synthetic || isImportedNbkSubmission(sub)) return false;
  const sid = String(sub.id || '').toUpperCase().trim();
  const stype = String(sub.submission_type_display || '');
  if (stype === 'Code Online Judge' || sid.startsWith('SUB-AC-')) return false;
  // Both conditions are required: a website problem AND a direct web submission.
  // HSG problem statements remain available for students to solve on DeruckOJ.
  if (!isDeruckProblem(sub.problem_id || sub.probId)) return false;
  return sub.source === 'deruckoj-web' ||
    stype.includes('DeruckOJ') ||
    /^SUB-\d{12,13}(?:-|$)/.test(sid) ||
    Boolean(sub.probId && sub.code && sub.verdict);
}

/**
 * 3d. Bảo mật mã nguồn: Giữ nguyên mã nguồn bài nộp thật trong bộ nhớ để không làm mất code.
 * UI sẽ kiểm tra quyền truy cập (Admin/Giáo viên hoặc chính tác giả) khi hiển thị.
 */
function sanitizeSubmissionsForRole(submissions, isAdminOrTeacher, currentStudentObj) {
  if (!submissions || !Array.isArray(submissions)) return [];
  // Giữ lại toàn bộ bài nộp hợp lệ của học sinh
  return submissions.filter(isDeruckSubmission);
}

/**
 * 3c. Tìm kiếm bài nộp của học sinh linh hoạt theo Tên, STT hoặc Mã PIN (Bảo tồn nhận diện sau khi reload cache)
 */
function findStudentSubmission(submissions, probId, studentIdentifier) {
  if (!submissions || !Array.isArray(submissions) || !probId || !studentIdentifier) return null;
  return submissions.find(s => s && s.problem_id === probId && submissionBelongsToStudent(s, studentIdentifier)) || null;
}

function submissionBelongsToStudent(submission, identifier) {
  if (!submission || identifier === null || identifier === undefined) return false;
  const student = typeof identifier === 'object' ? identifier
    : typeof identifier === 'number' ? { stt: identifier } : { name: identifier };
  const value = v => v === null || v === undefined ? '' : String(v).trim();
  const stt = value(student.stt);
  const subStt = value(submission.student_stt ?? submission.stt);
  // An explicit conflicting ID must never fall back to a matching name.
  if (stt && subStt) return stt === subStt;
  const pin = value(student.pin || student.student_pin);
  const subPin = value(submission.student_pin);
  if (pin && subPin) return pin === subPin;
  const legacyId = value(submission.student_id);
  if (legacyId && (stt || pin)) return legacyId === stt || legacyId === pin;
  const name = value(student.name).toLocaleLowerCase('vi');
  const subName = value(submission.student_name).toLocaleLowerCase('vi');
  const className = value(student.class || student.class_name);
  const subClass = value(submission.class_name);
  return Boolean(name && name === subName && (!className || !subClass || className === subClass));
}

/**
 * 3d. Cập nhật bài đã giải (AC) của học sinh lên Firebase Realtime Database
 */
async function saveStudentSolvedToFirebase(studentIdent, probId) {
  if (!isFirebaseConfigured() || !studentIdent || !probId) return false;
  const dbUrl = getFirebaseDatabaseUrl();
  try {
    const entries = await fetchFirebaseStudentEntries();
    const students = entries && entries.map(entry => entry.student);
    if (students && Array.isArray(students)) {
      let idx = -1;
      if (typeof studentIdent === 'number') {
        idx = students.findIndex(s => s && String(s.stt) === String(studentIdent));
      } else if (typeof studentIdent === 'string') {
        const sLower = studentIdent.trim().toLowerCase();
        idx = students.findIndex(s => s && (
          (s.name && s.name.trim().toLowerCase() === sLower) ||
          (s.pin && s.pin === studentIdent)
        ));
      } else if (typeof studentIdent === 'object') {
        idx = students.findIndex(s => studentIdent.stt != null
          ? String(s.stt) === String(studentIdent.stt)
          : studentIdent.name && s.name && s.name.trim().toLowerCase() === studentIdent.name.trim().toLowerCase());
      }

      if (idx !== -1) {
        const url = `${dbUrl}/students/${encodeURIComponent(entries[idx].key)}/solved.json`;
        // Conditional writes prevent concurrent AC submissions from overwriting one another.
        for (let attempt = 0; attempt < 3; attempt++) {
          const current = await fetch(url, { headers: { 'X-Firebase-ETag': 'true' } });
          if (!current.ok) return false;
          const saved = await current.json();
          const solved = Array.isArray(saved) ? saved.filter(Boolean) : Object.values(saved || {});
          if (solved.includes(probId)) return true;
          const etag = current.headers.get('ETag');
          if (!etag) return false;
          solved.push(probId);
          const resp = await fetch(url, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'if-match': etag },
            body: JSON.stringify(solved)
          });
          if (resp.status === 412) continue;
          if (resp.ok) {
            touchFirebaseLastUpdated().catch(() => {});
          }
          return resp.ok;
        }
        return false;
      }
    }
  } catch(err) {
    console.warn("Could not save student solved to Firebase:", err);
  }
  return false;
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
    if (resp.ok) {
      touchFirebaseLastUpdated().catch(() => {});
    }
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
    const entries = await fetchFirebaseStudentEntries();
    if (entries) {
      const idx = entries.findIndex(({ student }) => String(student.stt) === String(stt));
      if (idx !== -1) {
        const resp = await fetch(`${dbUrl}/students/${encodeURIComponent(entries[idx].key)}/tuition/${encodeURIComponent(month)}.json`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(Boolean(isPaid))
        });
        if (resp.ok) {
          touchFirebaseLastUpdated().catch(() => {});
        }
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
    const entries = await fetchFirebaseStudentEntries();
    if (entries) {
      const idx = entries.findIndex(({ student }) => String(student.stt) === String(stt));
      if (idx !== -1) {
        const resp = await fetch(`${dbUrl}/students/${encodeURIComponent(entries[idx].key)}/status.json`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newStatus)
        });
        if (resp.ok) {
          touchFirebaseLastUpdated().catch(() => {});
        }
        return resp.ok;
      }
    }
  } catch(err) {
    console.warn("Could not update student status to Firebase:", err);
  }
  return false;
}

/**
 * Cập nhật timestamp last_updated lên Firebase (Micro-polling 25 bytes)
 */
async function touchFirebaseLastUpdated() {
  if (!isFirebaseConfigured()) return;
  const dbUrl = getFirebaseDatabaseUrl();
  try {
    const nowIso = new Date().toISOString();
    await fetch(`${dbUrl}/metadata/last_updated.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(nowIso)
    });
  } catch(e) {}
}

/**
 * 7. Lưu bài nộp mới lên Firebase (Bảo tồn vĩnh viễn theo ID bài nộp, chống mất dữ liệu khi reload cache)
 */
async function saveSubmissionToFirebase(subData) {
  if (!isFirebaseConfigured() || !subData) return false;
  if (subData.is_synthetic || isImportedNbkSubmission(subData)) return false;
  const dbUrl = getFirebaseDatabaseUrl();
  try {
    const subId = subData.id || ('SUB-' + Date.now());
    subData.id = subId;
    const key = encodeURIComponent(subId);
    const resp = await fetch(`${dbUrl}/submissions/${key}.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(subData)
    });
    if (resp.ok) {
      touchFirebaseLastUpdated().catch(() => {});
    }
    return resp.ok;
  } catch(err) {
    console.warn("Could not save submission to Firebase:", err);
    return false;
  }
}

/**
 * 7b. Cập nhật chấm điểm, trạng thái hoặc nhận xét bài nộp lên Firebase
 */
async function updateSubmissionInFirebase(subId, patchData) {
  if (!isFirebaseConfigured() || !subId || !patchData) return false;
  const dbUrl = getFirebaseDatabaseUrl();
  try {
    const key = encodeURIComponent(subId);
    const resp = await fetch(`${dbUrl}/submissions/${key}.json`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patchData)
    });
    if (resp.ok) {
      touchFirebaseLastUpdated().catch(() => {});
    }
    return resp.ok;
  } catch(err) {
    console.warn("Could not update submission in Firebase:", err);
    return false;
  }
}

/**
 * 7c. Xóa bài nộp khỏi Firebase
 */
async function deleteSubmissionFromFirebase(subId) {
  if (!isFirebaseConfigured() || !subId) return false;
  const dbUrl = getFirebaseDatabaseUrl();
  try {
    const key = encodeURIComponent(subId);
    const resp = await fetch(`${dbUrl}/submissions/${key}.json`, {
      method: 'DELETE'
    });
    if (resp.ok) {
      touchFirebaseLastUpdated().catch(() => {});
    }
    return resp.ok;
  } catch(err) {
    console.warn("Could not delete submission from Firebase:", err);
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
    const submissions = {};
    for (const submission of Object.values(fullData.submissions || {})) {
      if (isImportedNbkSubmission(submission)) continue;
      if (!submission || !submission.id || /[.#$\[\]/]/.test(String(submission.id))) return false;
      submissions[submission.id] = submission;
    }
    const metadata = {
      last_updated: new Date().toISOString(),
      tuition_months: fullData.tuition_months || ['Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'],
      data_source: 'firebase'
    };
    const payload = {
      students: fullData.students || [],
      submissions,
      ...Object.fromEntries(Object.entries(metadata).map(([key, value]) => [`metadata/${key}`, value]))
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
    const rSubmissions = await fetch(`${dbUrl}/submissions.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(submissions)
    });
    const rMetadata = await fetch(`${dbUrl}/metadata.json`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(metadata)
    });
    return rStudents.ok && rSubmissions.ok && rMetadata.ok;
  } catch(err) {
    console.error("Could not push full data to Firebase:", err);
    return false;
  }
}

/**
 * 9. Tải danh sách Contest từ Firebase Realtime Database
 */
async function fetchContestsFromFirebase() {
  if (!isFirebaseConfigured()) return null;
  const dbUrl = getFirebaseDatabaseUrl();
  try {
    // 1. Thử tải từ /metadata/contests.json (nhánh metadata luôn mở quyền)
    let resp = await fetch(`${dbUrl}/metadata/contests.json`, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(6000)
    });
    if (resp.ok) {
      const data = await resp.json();
      if (data) {
        return Array.isArray(data) ? data.filter(Boolean) : Object.values(data);
      }
    }
    // 2. Dự phòng tải từ root /contests.json
    resp = await fetch(`${dbUrl}/contests.json`, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(6000)
    });
    if (resp.ok) {
      const data = await resp.json();
      if (data) {
        return Array.isArray(data) ? data.filter(Boolean) : Object.values(data);
      }
    }
    return null;
  } catch(err) {
    console.warn("Could not fetch contests from Firebase:", err);
    return null;
  }
}

/**
 * 9b. Lưu danh sách Contest lên Firebase Realtime Database
 */
async function saveContestsToFirebase(contests) {
  if (!isFirebaseConfigured() || !contests) return false;
  const dbUrl = getFirebaseDatabaseUrl();
  try {
    const respMeta = await fetch(`${dbUrl}/metadata/contests.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(contests)
    });
    try {
      await fetch(`${dbUrl}/contests.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contests)
      });
    } catch(e) {}
    touchFirebaseLastUpdated().catch(() => {});
    return respMeta.ok;
  } catch(err) {
    console.warn("Could not save contests to Firebase:", err);
    return false;
  }
}

/**
 * 10. Tải danh sách Bài tập theo tuần (Weekly Homework) từ Firebase Realtime Database
 */
async function fetchWeeklyHomeworkFromFirebase() {
  if (!isFirebaseConfigured()) return null;
  const dbUrl = getFirebaseDatabaseUrl();
  try {
    let resp = await fetch(`${dbUrl}/metadata/weekly_homework.json`, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(6000)
    });
    if (resp.ok) {
      const data = await resp.json();
      if (data && typeof data === 'object') return data;
    }
    resp = await fetch(`${dbUrl}/weekly_homework.json`, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(6000)
    });
    if (resp.ok) {
      const data = await resp.json();
      if (data && typeof data === 'object') return data;
    }
    return null;
  } catch(err) {
    console.warn("Could not fetch weekly homework from Firebase:", err);
    return null;
  }
}

/**
 * 10b. Lưu danh sách Bài tập theo tuần (Weekly Homework) lên Firebase Realtime Database
 */
async function saveWeeklyHomeworkToFirebase(weeklyHomework) {
  if (!isFirebaseConfigured() || !weeklyHomework) return false;
  const dbUrl = getFirebaseDatabaseUrl();
  try {
    const respMeta = await fetch(`${dbUrl}/metadata/weekly_homework.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(weeklyHomework)
    });
    try {
      await fetch(`${dbUrl}/weekly_homework.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(weeklyHomework)
      });
    } catch(e) {}
    touchFirebaseLastUpdated().catch(() => {});
    return respMeta.ok;
  } catch(err) {
    console.warn("Could not save weekly homework to Firebase:", err);
    return false;
  }
}

