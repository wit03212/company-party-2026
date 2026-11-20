// Company Party 2026 - GitHub Pages frontend
const API_URL = "https://script.google.com/macros/s/AKfycbzprn4svfmkBmUe_5Ts00plQlvSOEEI4IQi-f8SqhxMQy_FPYarLpQYaY-e06knBCs-/exec";

const $ = (id) => document.getElementById(id);
let staffToken = "";
let adminToken = "";
let currentEmployee = null;
let cameraStream = null;
let photoDataUrl = null;
let summaryData = [];
let pendingRequest = null;

function toast(message) {
  const el = $("toast");
  el.textContent = message;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 3200);
}
function setMessage(id, message, type = "") {
  const el = $(id);
  el.textContent = message;
  el.className = `message ${type}`;
}
function showStaffApp() {
  $("loginPanel").classList.add("hidden");
  $("staffNav").classList.remove("hidden");
  $("checkinPage").classList.add("active");
}
function showLogin() {
  $("loginPanel").classList.remove("hidden");
  $("staffNav").classList.add("hidden");
  $("checkinPage").classList.remove("active");
  $("summaryPage").classList.remove("active");
  $("employeeCard").classList.add("hidden");
  currentEmployee = null;
  photoDataUrl = null;
  adminToken = "";
  stopCamera();
}
function api(payload) {
  return new Promise((resolve, reject) => {
    if (!API_URL.startsWith("https://script.google.com/")) {
      reject(new Error("กรุณาตรวจสอบ Apps Script URL ใน app.js"));
      return;
    }
    if (pendingRequest) {
      reject(new Error("กำลังติดต่อระบบอยู่ กรุณารอสักครู่"));
      return;
    }
    const requestId = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random()}`);
    const timer = setTimeout(() => {
      pendingRequest = null;
      reject(new Error("หมดเวลารอการตอบกลับจากระบบ กรุณาลองใหม่"));
    }, 30000);
    pendingRequest = { requestId, resolve, reject, timer };
    $("uploadForm").action = API_URL;
    $("uploadPayload").value = JSON.stringify({ ...payload, requestId });
    $("uploadForm").submit();
  });
}
window.addEventListener("message", (event) => {
  const frame = $("uploadFrame");

  console.log("Message origin:", event.origin);
  console.log("Same iframe:", event.source === frame.contentWindow);
  console.log("Has pending request:", !!pendingRequest);

  if (event.source !== frame.contentWindow || !pendingRequest) return;

  const data = event.data;
  if (!data || data.requestId !== pendingRequest.requestId) return;

  clearTimeout(pendingRequest.timer);
  const request = pendingRequest;
  pendingRequest = null;
  request.resolve(data);
});

$("loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const pin = $("staffPin").value.trim();
  if (!pin) return;
  setMessage("loginMessage", "กำลังตรวจสอบรหัสผ่าน...");
  try {
    const result = await api({ action: "login", pin });
    if (!result.success) throw new Error(result.message || "เข้าสู่ระบบไม่สำเร็จ");
    staffToken = result.token;
    $("staffPin").value = "";
    setMessage("loginMessage", "");
    showStaffApp();
    toast("เข้าสู่ระบบสำเร็จ");
  } catch (error) {
    setMessage("loginMessage", error.message, "error");
  }
});

$("lookupForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  stopCamera();
  photoDataUrl = null;
  currentEmployee = null;
  $("employeeCard").classList.add("hidden");
  $("photoPreview").classList.add("hidden");
  $("retakePhoto").classList.add("hidden");
  $("camera").classList.add("hidden");
  $("cameraPlaceholder").classList.remove("hidden");
  $("takePhoto").disabled = true;
  $("confirmCheckin").disabled = true;
  setMessage("lookupMessage", "กำลังค้นหาข้อมูล...");
  try {
    const result = await api({
      action: "employee",
      token: staffToken,
      code: $("employeeId").value.trim()
    });
    if (!result.success) throw new Error(result.message || "ค้นหาข้อมูลไม่สำเร็จ");
    if (result.checkedIn) {
      setMessage("lookupMessage", "พนักงานรหัสนี้เช็คอินไปแล้ว", "error");
      return;
    }
    currentEmployee = result.employee;
    renderEmployee(currentEmployee);
    $("employeeCard").classList.remove("hidden");
    setMessage("lookupMessage", "พบข้อมูลพนักงาน กรุณาตรวจสอบความถูกต้อง", "success");
  } catch (error) {
    setMessage("lookupMessage", error.message, "error");
    if (/Session หมดอายุ/.test(error.message)) {
      staffToken = "";
      showLogin();
    }
  }
});

function renderEmployee(employee) {
  const get = (key) => employee[key] || "-";
  const name = get("ชื่อพนักงาน");
  $("employeeName").textContent = name;
  $("employeeCode").textContent = "รหัสพนักงาน: " + get("รหัส");
  $("avatar").textContent = name === "-" ? "EMP" : name.trim().slice(0, 2);
  $("position").textContent = get("ตำแหน่ง");
  $("department").textContent = get("แผนก");
  $("branch").textContent = get("ชื่อสาขา");
  $("startDate").textContent = get("วันเริ่มงาน");
  $("tenure").textContent = get("อายุงาน ป/ด");
}

async function startCamera() {
  try {
    stopCamera();
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" },
      audio: false
    });
    $("camera").srcObject = cameraStream;
    $("camera").classList.remove("hidden");
    $("cameraPlaceholder").classList.add("hidden");
    $("photoPreview").classList.add("hidden");
    $("takePhoto").disabled = false;
  } catch (error) {
    toast("เปิดกล้องไม่ได้ กรุณาอนุญาตการใช้กล้องและเปิดเว็บผ่าน HTTPS");
  }
}
function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
  }
}
$("startCamera").addEventListener("click", startCamera);
$("takePhoto").addEventListener("click", () => {
  const video = $("camera");
  const canvas = $("photoCanvas");
  if (!video.videoWidth) return toast("กล้องยังไม่พร้อม");
  const scale = Math.min(1, 1280 / video.videoWidth);
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
  photoDataUrl = canvas.toDataURL("image/jpeg", 0.78);
  $("photoPreview").src = photoDataUrl;
  $("photoPreview").classList.remove("hidden");
  $("camera").classList.add("hidden");
  $("takePhoto").disabled = true;
  $("retakePhoto").classList.remove("hidden");
  $("confirmCheckin").disabled = false;
  stopCamera();
});
$("retakePhoto").addEventListener("click", () => {
  photoDataUrl = null;
  $("retakePhoto").classList.add("hidden");
  $("confirmCheckin").disabled = true;
  startCamera();
});

$("confirmCheckin").addEventListener("click", async () => {
  if (!currentEmployee || !photoDataUrl) return toast("กรุณาค้นหาพนักงานและถ่ายภาพก่อน");
  const button = $("confirmCheckin");
  button.disabled = true;
  button.textContent = "กำลังบันทึก...";
  try {
    const result = await api({
      action: "checkin",
      token: staffToken,
      code: String(currentEmployee["รหัส"] || "").trim(),
      photoDataUrl
    });
    if (!result.success) throw new Error(result.message || "บันทึกไม่สำเร็จ");
    toast("บันทึก Check-in เรียบร้อยแล้ว");
    setMessage("lookupMessage", "บันทึกการเข้าร่วมงานสำเร็จ", "success");
    $("employeeCard").classList.add("hidden");
    $("employeeId").value = "";
    currentEmployee = null;
    photoDataUrl = null;
    $("photoPreview").classList.add("hidden");
    $("cameraPlaceholder").classList.remove("hidden");
  } catch (error) {
    toast(error.message);
    if (/Session หมดอายุ/.test(error.message)) {
      staffToken = "";
      showLogin();
    }
  } finally {
    button.disabled = true;
    button.innerHTML = 'ยืนยัน Check-in <span>→</span>';
    if (currentEmployee && photoDataUrl) button.disabled = false;
  }
});

document.querySelectorAll(".nav-btn[data-page]").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".nav-btn[data-page]").forEach(item => item.classList.toggle("active", item === button));
    $("checkinPage").classList.toggle("active", button.dataset.page === "checkin");
    $("summaryPage").classList.toggle("active", button.dataset.page === "summary");
  });
});

$("loadSummary").addEventListener("click", async () => {
  const pin = $("adminPin").value.trim();
  if (!pin && !adminToken) return setMessage("summaryMessage", "กรุณากรอก Admin PIN", "error");
  try {
    if (!adminToken) {
      setMessage("summaryMessage", "กำลังตรวจสอบ Admin PIN...");
      const login = await api({ action: "adminLogin", pin });
      if (!login.success) throw new Error(login.message || "Admin PIN ไม่ถูกต้อง");
      adminToken = login.token;
      $("adminPin").value = "";
    }
    await loadSummary();
  } catch (error) {
    setMessage("summaryMessage", error.message, "error");
  }
});
$("refreshSummary").addEventListener("click", loadSummary);

async function loadSummary() {
  if (!adminToken) {
    setMessage("summaryMessage", "กรุณายืนยัน Admin PIN ก่อนดูรายงาน", "error");
    return;
  }
  try {
    setMessage("summaryMessage", "กำลังโหลดข้อมูล...");
    const result = await api({ action: "summary", adminToken });
    if (!result.success) throw new Error(result.message || "โหลดสรุปไม่สำเร็จ");
    summaryData = result.rows || [];
    populateFilters(result.branches || [], result.departments || []);
    renderSummary(summaryData);
    setMessage("summaryMessage", "อัปเดตข้อมูลเรียบร้อย", "success");
  } catch (error) {
    setMessage("summaryMessage", error.message, "error");
    if (/Session หมดอายุ/.test(error.message)) adminToken = "";
  }
}
function populateFilters(branches, departments) {
  const fill = (id, values) => {
    const select = $(id);
    const selected = [...select.selectedOptions].map(option => option.value);
    select.innerHTML = "";
    values.forEach(value => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      option.selected = selected.includes(value);
      select.appendChild(option);
    });
  };
  fill("branchFilter", branches);
  fill("departmentFilter", departments);
}
function selected(id) {
  return [...$(id).selectedOptions].map(option => option.value);
}
function applySummaryFilters() {
  const branches = selected("branchFilter");
  const departments = selected("departmentFilter");
  const status = $("statusFilter").value;
  const rows = summaryData.filter(row =>
    (!branches.length || branches.includes(row.branch)) &&
    (!departments.length || departments.includes(row.department)) &&
    (status === "all" || (status === "present" && row.present) || (status === "absent" && !row.present))
  );
  renderSummary(rows);
}
function renderSummary(rows) {
  const present = rows.filter(row => row.present).length;
  const total = rows.length;
  $("totalCount").textContent = total.toLocaleString("th-TH");
  $("presentCount").textContent = present.toLocaleString("th-TH");
  $("absentCount").textContent = (total - present).toLocaleString("th-TH");
  $("attendanceRate").textContent = (total ? Math.round(present / total * 100) : 0) + "%";
  const body = $("summaryRows");
  body.innerHTML = "";
  if (!rows.length) {
    body.innerHTML = '<tr><td colspan="6" class="empty">ไม่พบข้อมูลตามตัวกรอง</td></tr>';
    return;
  }
  rows.forEach(row => {
    const tr = document.createElement("tr");
    [row.id, row.name, row.department, row.branch].forEach(value => {
      const td = document.createElement("td");
      td.textContent = value || "-";
      tr.appendChild(td);
    });
    const status = document.createElement("td");
    const badge = document.createElement("span");
    badge.className = row.present ? "status present" : "status absent";
    badge.textContent = row.present ? "มาร่วมงาน" : "ไม่มาร่วมงาน";
    status.appendChild(badge);
    tr.appendChild(status);
    const time = document.createElement("td");
    time.textContent = row.time || "-";
    tr.appendChild(time);
    body.appendChild(tr);
  });
}
$("applyFilters").addEventListener("click", applySummaryFilters);
$("statusFilter").addEventListener("change", applySummaryFilters);
$("clearFilters").addEventListener("click", () => {
  [...$("branchFilter").options, ...$("departmentFilter").options].forEach(option => option.selected = false);
  $("statusFilter").value = "all";
  applySummaryFilters();
});

$("logoutButton").addEventListener("click", async () => {
  try {
    if (staffToken || adminToken) await api({ action: "logout", token: staffToken, adminToken });
  } catch (_) {}
  staffToken = "";
  showLogin();
  toast("ออกจากระบบแล้ว");
});
window.addEventListener("beforeunload", stopCamera);
showLogin();
