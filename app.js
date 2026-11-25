// Company Party 2026 - GitHub Pages frontend
const API_URL = "https://company-party-api.wit03212.workers.dev/";

const $ = (id) => document.getElementById(id);
let staffToken = "";
let adminToken = "";
let currentEmployee = null;
let summaryData = [];
let pendingRequest = null;

let toastTimer = null;

function toast(message) {
  const el = $("toast");

  clearTimeout(toastTimer);

  el.textContent = message;
  el.classList.add("show");

  toastTimer = setTimeout(() => {
    el.classList.remove("show");
    el.textContent = "";
    toastTimer = null;
  }, 3200);
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
  adminToken = "";
}

async function api(payload) {
  if (pendingRequest) {
    throw new Error("กำลังติดต่อระบบอยู่ กรุณารอสักครู่");
  }

  const requestId = crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}_${Math.random()}`;

  const controller = new AbortController();
  pendingRequest = { requestId };

  const timer = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        ...payload,
        requestId
      }),
      signal: controller.signal
    });

    const text = await response.text();

    let result;
    try {
      result = JSON.parse(text);
    } catch (_) {
      throw new Error("ระบบตอบกลับไม่ถูกต้อง กรุณาตรวจสอบ Apps Script และ Cloudflare Worker");
    }

    if (!response.ok) {
      throw new Error(result.message || `เกิดข้อผิดพลาด HTTP ${response.status}`);
    }

    return result;

  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("หมดเวลารอการตอบกลับจากระบบ กรุณาลองใหม่");
    }
    throw error;

  } finally {
    clearTimeout(timer);
    pendingRequest = null;
  }
}

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
  currentEmployee = null;
  $("employeeCard").classList.add("hidden");
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
    $("confirmCheckin").disabled = false;
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
  $("tableNumber").textContent = get("เบอร์โต๊ะ");
}


$("confirmCheckin").addEventListener("click", async () => {
  if (!currentEmployee) {
    return toast("กรุณาค้นหาพนักงานก่อน");
  }

  const button = $("confirmCheckin");
  button.disabled = true;
  button.textContent = "กำลังบันทึก...";

  try {
    const result = await api({
      action: "checkin",
      token: staffToken,
      code: String(currentEmployee["รหัส"] || "").trim()
    });

    if (!result.success) {
      throw new Error(result.message || "บันทึกไม่สำเร็จ");
    }

    toast("บันทึก Check-in เรียบร้อยแล้ว");
    setMessage("lookupMessage", "บันทึกการเข้าร่วมงานสำเร็จ", "success");

    $("employeeCard").classList.add("hidden");
    $("employeeId").value = "";
    currentEmployee = null;

  } catch (error) {
    toast(error.message);

    if (/Session หมดอายุ/.test(error.message)) {
      staffToken = "";
      showLogin();
    }
  } finally {
  button.disabled = !currentEmployee;
  button.innerHTML = 'ยืนยัน Check-in <span>→</span>';
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
showLogin();
