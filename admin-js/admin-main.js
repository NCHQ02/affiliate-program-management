// import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
// import {
//   getFirestore,
//   doc,
//   setDoc,
//   getDoc,
//   getDocs,
//   deleteDoc,
//   collection,
//   query,
//   orderBy,
//   limit,
//   onSnapshot,
// } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
// import {
//   getAuth,
//   signInWithEmailAndPassword,
//   createUserWithEmailAndPassword,
//   onAuthStateChanged,
//   signOut,
// } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// import pako from "https://esm.sh/pako@2.1.0";

// const app = initializeApp(firebaseConfig);
// const db = getFirestore(app);
// const auth = getAuth(app);
// console.log("Firebase đã được kết nối!");
// --------------------------------------------------------------
// admin-js/admin-main.js (phần đầu file)

// KHỐI CODE MỚI - CHÍNH XÁC
const app = firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

console.log("Firebase đã được kết nối (sử dụng global compat scope)!");

console.log("Firebase và Pako đã được kết nối (sử dụng global scope)!");

// --- AUTHENTICATION STATE MANAGEMENT ---
let isAuthenticated = false;
let currentUser = null;

// DOM Elements for auth
const loginContainer = document.getElementById("loginContainer");
const mainApp = document.getElementById("mainApp");
const authForm = document.getElementById("authForm");
const authEmail = document.getElementById("authEmail");
const authPassword = document.getElementById("authPassword");
const authConfirmPassword = document.getElementById("authConfirmPassword");
const confirmPasswordDiv = document.getElementById("confirmPasswordDiv");
const authError = document.getElementById("authError");
const authSubmit = document.getElementById("authSubmit");
const authSubmitText = document.getElementById("authSubmitText");
const authSpinner = document.getElementById("authSpinner");
// Removed register tab elements - admin only login
const logoutBtn = document.getElementById("logoutBtn");
const userEmail = document.getElementById("userEmail");

// Always in login mode - no registration allowed
let isLoginMode = true;

// Show/Hide auth error
const showAuthError = (message) => {
  authError.textContent = message;
  authError.classList.remove("hidden");
};

const hideAuthError = () => {
  authError.classList.add("hidden");
};

// Auth form submission - LOGIN ONLY
const handleAuth = async (e) => {
  e.preventDefault();

  const email = authEmail.value.trim();
  const password = authPassword.value;

  // Validation
  if (!email || !password) {
    showAuthError("Vui lòng nhập đầy đủ email và mật khẩu");
    return;
  }

  if (password.length < 6) {
    showAuthError("Mật khẩu phải có ít nhất 6 ký tự");
    return;
  }

  // Show loading
  authSubmit.disabled = true;
  authSpinner.classList.remove("hidden");
  hideAuthError();

  try {
    // Only login - no registration allowed
    await auth.signInWithEmailAndPassword(email, password);
    // Success will be handled by onAuthStateChanged
  } catch (error) {
    console.error("Auth error:", error);
    let errorMessage = "Có lỗi xảy ra. Vui lòng thử lại.";

    switch (error.code) {
      case "auth/user-not-found":
      case "auth/wrong-password":
      case "auth/invalid-credential":
        errorMessage = "Email hoặc mật khẩu không đúng";
        break;
      case "auth/email-already-in-use":
        errorMessage = "Email này đã được sử dụng";
        break;
      case "auth/weak-password":
        errorMessage = "Mật khẩu quá yếu";
        break;
      case "auth/invalid-email":
        errorMessage = "Email không hợp lệ";
        break;
      case "auth/too-many-requests":
        errorMessage = "Quá nhiều lần thử. Vui lòng đợi một chút";
        break;
      case "auth/configuration-not-found":
        errorMessage =
          "Firebase Auth chưa được cấu hình. Vui lòng liên hệ admin để enable Authentication trong Firebase Console.";
        break;
      case "auth/operation-not-allowed":
        errorMessage =
          "Phương thức đăng nhập Email/Password chưa được enable trong Firebase Console.";
        break;
      default:
        errorMessage =
          "Đăng nhập thất bại. Vui lòng kiểm tra email và mật khẩu.";
        break;
    }

    showAuthError(errorMessage);
  } finally {
    authSubmit.disabled = false;
    authSpinner.classList.add("hidden");
  }
};

// Logout function
const handleLogout = async () => {
  try {
    await auth.signOut();
  } catch (error) {
    console.error("Logout error:", error);
  }
};

// Show/Hide UI based on auth state
const showLoginUI = () => {
  loginContainer.classList.remove("hidden");
  mainApp.classList.add("hidden");
};

const showMainUI = () => {
  loginContainer.classList.add("hidden");
  mainApp.classList.remove("hidden");
};

// Event listeners for auth - removed register tab listeners
authForm.addEventListener("submit", handleAuth);
logoutBtn.addEventListener("click", handleLogout);

// Auth state observer
auth.onAuthStateChanged((user) => {
  if (user) {
    // User is signed in
    console.log("User logged in:", user.email);
    isAuthenticated = true;
    currentUser = user;
    userEmail.textContent = user.email;
    showMainUI();
    // Initialize admin functionality
    setupRealtimeListener();
    // Log login activity
    logActivity("login", `Đăng nhập thành công`, {
      email: user.email,
      timestamp: new Date().toISOString(),
    });
  } else {
    // User is signed out
    console.log("User logged out");
    isAuthenticated = false;
    currentUser = null;
    showLoginUI();
  }
});

// --- STATE MANAGEMENT ---
let brandsData = {};
let brandLogos = {}; // Store persistent brand logos separately
let programHeaderData = {
  logo: "https://placehold.co/150x50/0a0c18/FFF?text=LOGO",
  text: "Affiliates Program",
};
let editMode = false;
let currentBrandKey = null;
let currentCalendarDate = new Date();
let currentView = "dashboard"; // 'dashboard' or 'brand'

// Version Management State
let versionsData = [];
let currentRollbackVersion = null;

// Dashboard State
let dashboardStats = {
  totalBrands: 0,
  lastPublish: null,
  activeCampaigns: 0,
  upcomingCampaigns: 0,
};
let activityLogs = [];

// --- DOM ELEMENTS ---
const publishBtn = document.getElementById("publishBtn");
const brandListContainer = document.getElementById("brandList");
const mainContent = document.getElementById("mainContent");
const welcomePlaceholder = document.getElementById("welcomePlaceholder");
const loadingOverlay = document.getElementById("loadingOverlay");
const toggleEdit = document.getElementById("toggleEdit");
const tooltipEl = document.getElementById("customTooltip");

// Dashboard DOM Elements
const dashboardLink = document.getElementById("dashboardLink");
const dashboardContent = document.getElementById("dashboardContent");
const versioningLink = document.getElementById("versioningLink");
const versioningContent = document.getElementById("versioningContent");
const totalBrandsEl = document.getElementById("totalBrands");
const lastPublishEl = document.getElementById("lastPublish");
const lastPublishTimeEl = document.getElementById("lastPublishTime");
const activeCampaignsEl = document.getElementById("activeCampaigns");
const upcomingCampaignsEl = document.getElementById("upcomingCampaigns");
const recentActivityList = document.getElementById("recentActivityList");
const refreshActivityBtn = document.getElementById("refreshActivity");

// Version Management DOM Elements
const versionsList = document.getElementById("versionsList");
const refreshVersionsBtn = document.getElementById("refreshVersions");
const rollbackModal = document.getElementById("rollbackModal");
const versionPreviewModal = document.getElementById("versionPreviewModal");
const rollbackVersionInfo = document.getElementById("rollbackVersionInfo");
const rollbackVersionDetails = document.getElementById(
  "rollbackVersionDetails"
);
const cancelRollbackBtn = document.getElementById("cancelRollback");
const confirmRollbackBtn = document.getElementById("confirmRollback");
const closeVersionPreviewBtn = document.getElementById("closeVersionPreview");
const versionPreviewContent = document.getElementById("versionPreviewContent");

// Publish with Note DOM Elements
const publishWithNoteBtn = document.getElementById("publishWithNoteBtn");
const publishNoteModal = document.getElementById("publishNoteModal");
const publishNoteInput = document.getElementById("publishNoteInput");
const noteCharCount = document.getElementById("noteCharCount");
const cancelPublishNoteBtn = document.getElementById("cancelPublishNote");
const confirmPublishNoteBtn = document.getElementById("confirmPublishNote");

// Toast Notification Elements
const successToast = document.getElementById("successToast");
const errorToast = document.getElementById("errorToast");
const toastTitle = document.getElementById("toastTitle");
const toastMessage = document.getElementById("toastMessage");
const toastNote = document.getElementById("toastNote");
const toastProgress = document.getElementById("toastProgress");
const closeToast = document.getElementById("closeToast");
const errorMessage = document.getElementById("errorMessage");
const closeErrorToast = document.getElementById("closeErrorToast");

// --- UTILITY FUNCTIONS ---
const cleanStr = (s) => String(s || "").trim();
const rmAccent = (s) =>
  cleanStr(s)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
const norm = (s) => rmAccent(s).toLowerCase();
const normalizeBrand = (s) => cleanStr(s).toLowerCase().replace(/\s+/g, "-");
const currency = (n) => (Number(n) || 0).toLocaleString("vi-VN") + "đ";
const formatVoucher = (v) => {
  const num = Number(v);
  if (isNaN(num) || num === 0) return v || "";
  return (
    num
      .toLocaleString("vi-VN", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      })
      .replace(/,/g, ".") + "đ"
  );
};
const numParse = (s) => {
  const str = String(s || "").replace(/[^\d.-]/g, "");
  return str ? parseFloat(str) : NaN;
};

// admin-js/admin-main.js

// --- UTILITY FUNCTIONS ---

// ... (các hàm cleanStr, rmAccent, norm,...)

// === CÁC HÀM NÉN / GIẢI NÉN MỚI ===
// Nén đối tượng JSON thành chuỗi Base64
function compressData(data) {
  try {
    const jsonString = JSON.stringify(data);
    const compressed = pako.deflate(jsonString);
    // Chuyển đổi Uint8Array thành chuỗi Base64 để lưu trữ an toàn
    const base64String = btoa(String.fromCharCode.apply(null, compressed));
    return base64String;
  } catch (error) {
    console.error("Lỗi khi nén dữ liệu:", error);
    return null;
  }
}

// Giải nén chuỗi Base64 về lại đối tượng JSON
function decompressData(base64OrJsonString) {
  // CÁCH GIẢI NÉN GIỐNG TRANG PUBLIC (đơn giản, đáng tin cậy với dữ liệu đã nén bởi pako.deflate)
  function simpleDecompressLikePublic(base64) {
    try {
      const bytes = atob(base64)
        .split("")
        .map((c) => c.charCodeAt(0));
      const jsonString = pako.inflate(new Uint8Array(bytes), { to: "string" });
      return JSON.parse(jsonString);
    } catch (e) {
      return null;
    }
  }

  // Chuẩn hóa base64 (hỗ trợ URL-safe và padding)
  function normalizeBase64(input) {
    let str = input.replace(/-/g, "+").replace(/_/g, "/");
    const pad = str.length % 4;
    if (pad === 2) str += "==";
    else if (pad === 3) str += "=";
    else if (pad !== 0) str += "==";
    return str;
  }

  function tryParseJson(text) {
    try {
      return JSON.parse(text);
    } catch (_) {
      return null;
    }
  }

  // Thử parse JSON trực tiếp (trường hợp dữ liệu không nén)
  try {
    if (
      typeof base64OrJsonString === "string" &&
      base64OrJsonString.trim().startsWith("{")
    ) {
      return JSON.parse(base64OrJsonString);
    }
  } catch (_) {
    // bỏ qua, sẽ thử giải nén bên dưới
  }

  try {
    // Hỗ trợ khi dữ liệu là mảng số (byte array) được serialize
    if (
      typeof base64OrJsonString === "object" &&
      base64OrJsonString &&
      typeof base64OrJsonString.length === "number"
    ) {
      const byteArray = new Uint8Array(base64OrJsonString);
      try {
        const jsonString = pako.inflate(byteArray, { to: "string" });
        return JSON.parse(jsonString);
      } catch (_) {}
      try {
        const jsonString = pako.ungzip(byteArray, { to: "string" });
        return JSON.parse(jsonString);
      } catch (_) {}
      try {
        const jsonString = pako.inflateRaw(byteArray, { to: "string" });
        return JSON.parse(jsonString);
      } catch (inflateRawErr) {
        console.error("Lỗi khi giải nén dữ liệu:", inflateRawErr);
        return null;
      }
    }

    if (typeof base64OrJsonString !== "string") return null;

    let candidate = base64OrJsonString.trim();

    // Nếu chuỗi có vẻ là JSON string double-encoded ("{...}")
    const maybeDouble = tryParseJson(candidate);
    if (typeof maybeDouble === "string") {
      candidate = maybeDouble;
    }

    // Thử decodeURIComponent nếu có dạng URL-encoded
    try {
      if (/%(?:[0-9A-Fa-f]{2})/.test(candidate)) {
        const decodedUri = decodeURIComponent(candidate);
        if (decodedUri) candidate = decodedUri;
      }
    } catch (_) {}

    // Thử cách public trước
    const fromPublic = simpleDecompressLikePublic(candidate);
    if (fromPublic) return fromPublic;

    const normalized = normalizeBase64(candidate);
    const binaryString = atob(normalized);
    const byteArray = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      byteArray[i] = binaryString.charCodeAt(i);
    }

    // Trường hợp base64 là JSON thuần (không nén)
    const jsonFromBinaryString = tryParseJson(binaryString);
    if (jsonFromBinaryString) {
      return jsonFromBinaryString;
    }

    try {
      const decodedUtf8 =
        typeof TextDecoder !== "undefined"
          ? new TextDecoder("utf-8").decode(byteArray)
          : null;
      const jsonFromUtf8 = decodedUtf8 ? tryParseJson(decodedUtf8) : null;
      if (jsonFromUtf8) {
        return jsonFromUtf8;
      }
    } catch (_) {
      // ignore
    }

    // Thử inflate (zlib/deflate)
    try {
      // Chọn thuật toán dựa trên header khi có thể
      if (
        byteArray.length >= 2 &&
        byteArray[0] === 0x1f &&
        byteArray[1] === 0x8b
      ) {
        // GZIP
        const jsonString = pako.ungzip(byteArray, { to: "string" });
        return JSON.parse(jsonString);
      }
      if (byteArray.length >= 2 && byteArray[0] === 0x78) {
        // ZLIB header phổ biến (0x78 0x01/0x9C/0xDA)
        const jsonString = pako.inflate(byteArray, { to: "string" });
        return JSON.parse(jsonString);
      }
      // Mặc định thử inflate trước
      const jsonString = pako.inflate(byteArray, { to: "string" });
      return JSON.parse(jsonString);
    } catch (inflateErr) {
      // Thử ungzip
      try {
        const jsonString = pako.ungzip(byteArray, { to: "string" });
        return JSON.parse(jsonString);
      } catch (ungzipErr) {
        // Thử inflateRaw như là phương án cuối
        try {
          const jsonString = pako.inflateRaw(byteArray, { to: "string" });
          return JSON.parse(jsonString);
        } catch (inflateRawErr) {
          console.error("Lỗi khi giải nén dữ liệu:", inflateRawErr);
          return null;
        }
      }
    }
  } catch (error) {
    console.error("Lỗi khi giải nén dữ liệu:", error);
    return null;
  }
}

// --- DASHBOARD FUNCTIONS ---

// Calculate dashboard statistics
function calculateDashboardStats() {
  const totalBrands = Object.keys(brandsData).length;

  // Calculate today's campaigns (campaigns happening today)
  let activeCampaigns = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  Object.values(brandsData).forEach((brand) => {
    if (brand.calendar) {
      Object.values(brand.calendar).forEach((event) => {
        let startDate, endDate;

        if (
          event.startDate &&
          typeof event.startDate === "object" &&
          event.startDate.seconds
        ) {
          startDate = new Date(event.startDate.seconds * 1000);
        } else if (
          event.startDate &&
          typeof event.startDate === "object" &&
          event.startDate._seconds
        ) {
          startDate = new Date(event.startDate._seconds * 1000);
        } else {
          startDate = new Date(event.startDate);
        }

        if (
          event.endDate &&
          typeof event.endDate === "object" &&
          event.endDate.seconds
        ) {
          endDate = new Date(event.endDate.seconds * 1000);
        } else if (
          event.endDate &&
          typeof event.endDate === "object" &&
          event.endDate._seconds
        ) {
          endDate = new Date(event.endDate._seconds * 1000);
        } else {
          endDate = new Date(event.endDate);
        }

        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(0, 0, 0, 0);

        if (today >= startDate && today <= endDate) {
          activeCampaigns++;
        }
      });
    }
  });

  // Calculate upcoming campaigns (next 30 days)
  let upcomingCampaigns = 0;
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
  thirtyDaysFromNow.setHours(23, 59, 59, 999);

  Object.values(brandsData).forEach((brand) => {
    if (brand.calendar) {
      Object.values(brand.calendar).forEach((event) => {
        let startDate;

        if (
          event.startDate &&
          typeof event.startDate === "object" &&
          event.startDate.seconds
        ) {
          startDate = new Date(event.startDate.seconds * 1000);
        } else if (
          event.startDate &&
          typeof event.startDate === "object" &&
          event.startDate._seconds
        ) {
          startDate = new Date(event.startDate._seconds * 1000);
        } else {
          startDate = new Date(event.startDate);
        }

        if (startDate > today && startDate <= thirtyDaysFromNow) {
          upcomingCampaigns++;
        }
      });
    }
  });

  // Get current version info from versions
  let lastPublish = null;
  if (versionsData.length > 0) {
    // Find the current version (the one that matches current data)
    lastPublish =
      versionsData.find((v) => isCurrentVersion(v)) || versionsData[0];
  }

  dashboardStats = {
    totalBrands,
    lastPublish,
    activeCampaigns,
    upcomingCampaigns,
  };

  return dashboardStats;
}

// Update dashboard UI
function updateDashboardUI() {
  const stats = calculateDashboardStats();

  // Update stats cards
  if (totalBrandsEl) totalBrandsEl.textContent = stats.totalBrands;
  if (activeCampaignsEl) activeCampaignsEl.textContent = stats.activeCampaigns;
  if (upcomingCampaignsEl)
    upcomingCampaignsEl.textContent = stats.upcomingCampaigns;

  // Update last publish info
  if (lastPublishEl && lastPublishTimeEl) {
    if (stats.lastPublish) {
      const publishDate = new Date(stats.lastPublish.createdAt);
      lastPublishEl.textContent = `Version ${stats.lastPublish.versionId}`;
      lastPublishTimeEl.textContent = formatDate(stats.lastPublish.createdAt);
    } else {
      lastPublishEl.textContent = "Chưa có";
      lastPublishTimeEl.textContent = "";
    }
  }
}

// Show dashboard view
function showDashboard() {
  console.log("showDashboard called");
  currentView = "dashboard";
  currentBrandKey = null;

  // Hide welcome placeholder and show dashboard
  welcomePlaceholder.classList.add("hidden");
  if (dashboardContent) {
    dashboardContent.classList.remove("hidden");
    console.log("Dashboard content shown");
  }

  // Clear any brand content from mainContent
  mainContent.innerHTML = "";
  mainContent.appendChild(dashboardContent);

  // Update dashboard stats
  updateDashboardUI();

  // Update navigation state
  updateNavigationState();

  // Load recent activity
  loadRecentActivity();
}

// Show brand detail view
function showBrandDetailView(key) {
  console.log("showBrandDetailView called with key:", key);
  console.log("dashboardContent element:", dashboardContent);
  console.log("mainContent element:", mainContent);

  currentView = "brand";
  // Don't set currentBrandKey here, let showBrandDetail handle it

  // Hide dashboard content but don't remove it from DOM
  if (dashboardContent) {
    dashboardContent.classList.add("hidden");
    console.log("Dashboard content hidden");
  }
  welcomePlaceholder.classList.add("hidden");

  // Show brand detail (existing function)
  showBrandDetail(key);

  // Update navigation state
  updateNavigationState();
}

// Show versioning view
function showVersioning() {
  console.log("showVersioning called");
  currentView = "versioning";
  currentBrandKey = null;

  // Hide welcome placeholder and show versioning
  welcomePlaceholder.classList.add("hidden");
  if (versioningContent) {
    versioningContent.classList.remove("hidden");
    console.log("Versioning content shown");
  }

  // Clear any brand content from mainContent
  mainContent.innerHTML = "";
  mainContent.appendChild(versioningContent);

  // Load versions data
  loadVersions();

  // Update navigation state
  updateNavigationState();
}

// Update navigation state
function updateNavigationState() {
  // Update dashboard link
  if (dashboardLink) {
    if (currentView === "dashboard") {
      dashboardLink.classList.add("bg-indigo-600", "text-white");
      dashboardLink.classList.remove("hover:bg-slate-700");
    } else {
      dashboardLink.classList.remove("bg-indigo-600", "text-white");
      dashboardLink.classList.add("hover:bg-slate-700");
    }
  }

  // Update versioning link
  if (versioningLink) {
    if (currentView === "versioning") {
      versioningLink.classList.add("bg-indigo-600", "text-white");
      versioningLink.classList.remove("hover:bg-slate-700");
    } else {
      versioningLink.classList.remove("bg-indigo-600", "text-white");
      versioningLink.classList.add("hover:bg-slate-700");
    }
  }

  // Update brand items
  document.querySelectorAll(".brand-item").forEach((item) => {
    const brandKey = item.getAttribute("data-brand-key");
    if (currentView === "brand" && brandKey === currentBrandKey) {
      item.classList.add("bg-indigo-600", "text-white");
      item.classList.remove("hover:bg-slate-700");
    } else {
      item.classList.remove("bg-indigo-600", "text-white");
      item.classList.add("hover:bg-slate-700");
    }
  });
}

// Format date for display
const formatDate = (dateStr) => {
  const date = new Date(dateStr);
  return date.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

// Calculate data changes between versions (for delta)
const calculateDelta = (oldData, newData) => {
  const changes = {
    added: [],
    modified: [],
    deleted: [],
  };

  // Simple delta calculation for brands
  const oldBrands = oldData?.brands || {};
  const newBrands = newData?.brands || {};

  // Find added and modified brands
  Object.keys(newBrands).forEach((key) => {
    if (!oldBrands[key]) {
      changes.added.push(key);
    } else if (
      JSON.stringify(oldBrands[key]) !== JSON.stringify(newBrands[key])
    ) {
      changes.modified.push(key);
    }
  });

  // Find deleted brands
  Object.keys(oldBrands).forEach((key) => {
    if (!newBrands[key]) {
      changes.deleted.push(key);
    }
  });

  return changes;
};

// --- VERSION MANAGEMENT FUNCTIONS ---

// Safely read version payload supporting both compressed and legacy formats
function getVersionData(version) {
  try {
    if (!version) return null;
    // New compressed format - delegate to robust decompressor
    if (version.isCompressed && version.compressedData) {
      const decompressed = decompressData(version.compressedData);
      if (decompressed && typeof decompressed === "object") return decompressed;
      console.warn(
        "Compressed version detected but could not be decompressed via decompressData"
      );
      return null;
    }
    // Legacy inline JSON format
    if (version.data) return version.data;
    return null;
  } catch (error) {
    console.error("Failed to read version data:", error);
    return null;
  }
}

// Save current data as a new version
async function saveVersion(dataToSave, versionNote = "") {
  try {
    const timestamp = Date.now();
    const versionId = `v${timestamp}`;

    // NÉN DỮ LIỆU
    const compressedData = compressData(dataToSave);
    if (!compressedData) {
      throw new Error("Không thể nén dữ liệu.");
    }
    const compressedSize = compressedData.length;

    // Kiểm tra kích thước sau khi nén
    if (compressedSize > 1048576) {
      throw new Error(
        `Dữ liệu sau khi nén (${Math.round(
          compressedSize / 1024
        )}KB) vẫn vượt quá giới hạn 1MB.`
      );
    }

    // Get previous version for delta calculation
    let delta = null;
    if (versionsData.length > 0) {
      // Để tính delta, ta cần giải nén phiên bản cũ
      const previousData = await getVersionData(versionsData[0]);
      if (previousData) {
        delta = calculateDelta(previousData, dataToSave);
      }
    }

    const versionData = {
      versionId,
      // Lưu dữ liệu đã nén
      compressedData: compressedData,
      isCompressed: true, // Thêm cờ để nhận biết
      createdAt: new Date().toISOString(),
      createdBy: currentUser?.email || "unknown",
      note: versionNote,
      delta: delta,
      size: compressedSize, // Lưu kích thước sau khi nén
      originalSize: JSON.stringify(dataToSave).length,
    };

    await db.collection("versions").doc(versionId).set(versionData);

    versionsData.unshift(versionData);
    await cleanupOldVersions();
    await logActivity("publish", `Xuất bản phiên bản ${versionId}`, {
      versionId,
      note: versionNote,
      brandsCount: Object.keys(dataToSave.brands || {}).length,
    });

    console.log(`Phiên bản nén ${versionId} đã được lưu thành công`);
    return versionId;
  } catch (error) {
    console.error("Lỗi khi lưu phiên bản nén:", error);
    throw error;
  }
}

// Load all versions from Firestore
async function loadVersions() {
  try {
    const snapshot = await db
      .collection("versions")
      .orderBy("createdAt", "desc")
      .limit(5)
      .get();
    versionsData = [];

    snapshot.forEach((doc) => {
      versionsData.push(doc.data());
    });

    renderVersionsList();

    // Update versioning tab info
    updateVersioningInfo();

    return versionsData;
  } catch (error) {
    console.error("Error loading versions:", error);
    versionsList.innerHTML =
      '<div class="text-red-400 text-xs text-center py-2">Lỗi tải phiên bản</div>';
    return [];
  }
}

// Version Comparison functionality
function populateVersionSelectors() {
  const versionASelect = document.getElementById("versionA");
  const versionBSelect = document.getElementById("versionB");

  if (!versionASelect || !versionBSelect) return;

  // Clear existing options
  versionASelect.innerHTML = '<option value="">Chọn phiên bản...</option>';
  versionBSelect.innerHTML = '<option value="">Chọn phiên bản...</option>';

  // Add version options
  versionsData.forEach((version, index) => {
    const optionText = `Version ${version.versionId} - ${
      version.note || "Không có ghi chú"
    }`;
    const optionA = new Option(optionText, version.versionId);
    const optionB = new Option(optionText, version.versionId);

    versionASelect.add(optionA);
    versionBSelect.add(optionB);
  });

  // Enable/disable compare button based on selections
  updateCompareButton();
}

function updateCompareButton() {
  const versionA = document.getElementById("versionA");
  const versionB = document.getElementById("versionB");
  const compareBtn = document.getElementById("compareVersionsBtn");

  if (!versionA || !versionB || !compareBtn) return;

  const canCompare =
    versionA.value && versionB.value && versionA.value !== versionB.value;
  compareBtn.disabled = !canCompare;
}

function compareVersions() {
  const versionAId = document.getElementById("versionA").value;
  const versionBId = document.getElementById("versionB").value;

  if (!versionAId || !versionBId || versionAId === versionBId) return;

  const versionA = versionsData.find((v) => v.versionId === versionAId);
  const versionB = versionsData.find((v) => v.versionId === versionBId);

  if (!versionA || !versionB) return;

  // Calculate differences
  const diff = calculateVersionDiff(versionA, versionB);

  // Update UI
  updateComparisonResult(diff);

  // Show result
  const resultDiv = document.getElementById("comparisonResult");
  if (resultDiv) {
    resultDiv.classList.remove("hidden");
  }
}

function calculateVersionDiff(versionA, versionB) {
  const dataA = versionA.data || {};
  const dataB = versionB.data || {};

  const brandsA = dataA.brands || {};
  const brandsB = dataB.brands || {};

  let added = 0;
  let removed = 0;
  let modified = 0;

  // Compare brands
  const allBrandKeys = new Set([
    ...Object.keys(brandsA),
    ...Object.keys(brandsB),
  ]);

  allBrandKeys.forEach((brandKey) => {
    const brandA = brandsA[brandKey];
    const brandB = brandsB[brandKey];

    if (!brandA && brandB) {
      added++;
    } else if (brandA && !brandB) {
      removed++;
    } else if (brandA && brandB) {
      // Compare brand data
      const brandDiff = compareBrandData(brandA, brandB);
      added += brandDiff.added;
      removed += brandDiff.removed;
      modified += brandDiff.modified;
    }
  });

  return {
    added,
    removed,
    modified,
    total: added + removed + modified,
  };
}

function compareBrandData(brandA, brandB) {
  let added = 0;
  let removed = 0;
  let modified = 0;

  // Compare products
  const productsA = brandA.products || [];
  const productsB = brandB.products || [];

  const allProductIds = new Set([
    ...productsA.map((p) => p.id || p.name),
    ...productsB.map((p) => p.id || p.name),
  ]);

  allProductIds.forEach((productId) => {
    const productA = productsA.find((p) => (p.id || p.name) === productId);
    const productB = productsB.find((p) => (p.id || p.name) === productId);

    if (!productA && productB) {
      added++;
    } else if (productA && !productB) {
      removed++;
    } else if (productA && productB) {
      // Simple comparison - if JSON strings are different, consider modified
      if (JSON.stringify(productA) !== JSON.stringify(productB)) {
        modified++;
      }
    }
  });

  return { added, removed, modified };
}

function updateComparisonResult(diff) {
  const changeCountEl = document.getElementById("changeCount");
  const addedCountEl = document.getElementById("addedCount");
  const removedCountEl = document.getElementById("removedCount");
  const modifiedCountEl = document.getElementById("modifiedCount");

  if (changeCountEl) changeCountEl.textContent = diff.total;
  if (addedCountEl) addedCountEl.textContent = diff.added;
  if (removedCountEl) removedCountEl.textContent = diff.removed;
  if (modifiedCountEl) modifiedCountEl.textContent = diff.modified;
}

// Update versioning tab info
function updateVersioningInfo() {
  const totalVersionsEl = document.getElementById("totalVersions");
  const currentVersionEl = document.getElementById("currentVersion");
  const lastUpdateEl = document.getElementById("lastUpdate");

  // New highlight elements
  const currentVersionDisplayEl = document.getElementById(
    "currentVersionDisplay"
  );
  const currentVersionNoteEl = document.getElementById("currentVersionNote");
  const currentVersionTimeEl = document.getElementById("currentVersionTime");

  if (totalVersionsEl) {
    totalVersionsEl.textContent = versionsData.length;
  }

  if (versionsData.length > 0) {
    // Find the current version (the one that matches current data)
    const currentVersion = versionsData.find((v) => isCurrentVersion(v));

    if (currentVersion) {
      // Update main info
      if (currentVersionEl) {
        currentVersionEl.textContent = `Version ${currentVersion.versionId}`;
      }
      if (lastUpdateEl) {
        lastUpdateEl.textContent = formatDate(currentVersion.createdAt);
      }

      // Update highlight section
      if (currentVersionDisplayEl) {
        currentVersionDisplayEl.textContent = `Version ${currentVersion.versionId}`;
        // Add animation class
        currentVersionDisplayEl.classList.add("updating");
        setTimeout(() => {
          currentVersionDisplayEl.classList.remove("updating");
        }, 600);
      }
      if (currentVersionNoteEl) {
        currentVersionNoteEl.textContent =
          currentVersion.note || "Không có ghi chú";
      }
      if (currentVersionTimeEl) {
        currentVersionTimeEl.textContent = `Tạo lúc: ${formatDate(
          currentVersion.createdAt
        )}`;
      }
    } else {
      // Fallback to latest by time if no exact match found
      const latestVersion = versionsData[0];
      if (currentVersionEl) {
        currentVersionEl.textContent = `Version ${latestVersion.versionId}`;
      }
      if (lastUpdateEl) {
        lastUpdateEl.textContent = formatDate(latestVersion.createdAt);
      }

      // Update highlight section with fallback
      if (currentVersionDisplayEl) {
        currentVersionDisplayEl.textContent = `Version ${latestVersion.versionId}`;
      }
      if (currentVersionNoteEl) {
        currentVersionNoteEl.textContent =
          latestVersion.note || "Không có ghi chú";
      }
      if (currentVersionTimeEl) {
        currentVersionTimeEl.textContent = `Tạo lúc: ${formatDate(
          latestVersion.createdAt
        )}`;
      }
    }
  } else {
    if (currentVersionEl) {
      currentVersionEl.textContent = "Chưa có";
    }
    if (lastUpdateEl) {
      lastUpdateEl.textContent = "Chưa có";
    }

    // Update highlight section with empty state
    if (currentVersionDisplayEl) {
      currentVersionDisplayEl.textContent = "Chưa có";
    }
    if (currentVersionNoteEl) {
      currentVersionNoteEl.textContent = "";
    }
    if (currentVersionTimeEl) {
      currentVersionTimeEl.textContent = "";
    }
  }

  // Populate version comparison selectors
  populateVersionSelectors();
}

// Clean up old versions (keep only 5 most recent)
async function cleanupOldVersions() {
  try {
    if (versionsData.length > 5) {
      const versionsToDelete = versionsData.slice(5);

      for (const version of versionsToDelete) {
        await db.collection("versions").doc(version.versionId).delete();
      }

      versionsData = versionsData.slice(0, 5);
      console.log(`Cleaned up ${versionsToDelete.length} old versions`);
    }
  } catch (error) {
    console.error("Error cleaning up old versions:", error);
  }
}

// Rollback to a specific version
async function rollbackToVersion(versionId) {
  try {
    const version = versionsData.find((v) => v.versionId === versionId);
    if (!version) {
      throw new Error("Version not found");
    }

    const data = getVersionData(version);
    if (!data) {
      throw new Error("Không đọc được dữ liệu phiên bản để rollback");
    }

    // Update production data
    const productionDocRef = db.collection("landingPage").doc("data");
    await productionDocRef.set(data);

    // Update local data
    brandsData = data.brands || {};
    programHeaderData = data.header || programHeaderData;

    // Refresh UI
    renderBrandList();
    if (currentBrandKey && brandsData[currentBrandKey]) {
      showBrandDetail(currentBrandKey);
    } else {
      currentBrandKey = null;
      mainContent.innerHTML = "";
      mainContent.appendChild(welcomePlaceholder);
      welcomePlaceholder.classList.remove("hidden");
    }

    // Log activity
    await logActivity("rollback", `Rollback về phiên bản ${versionId}`, {
      versionId,
      createdAt: version.createdAt,
      createdBy: version.createdBy,
    });

    // Reload versions to update the UI
    await loadVersions();

    // Force refresh all UI components
    refreshAllVersioningUI();

    console.log(`Successfully rolled back to version ${versionId}`);
    return true;
  } catch (error) {
    console.error("Error rolling back:", error);
    throw error;
  }
}

// Force refresh all versioning UI components
function refreshAllVersioningUI() {
  // Update dashboard stats if on dashboard
  if (currentView === "dashboard") {
    updateDashboardUI();
  }

  // Update versioning info if on versioning tab
  if (currentView === "versioning") {
    updateVersioningInfo();
  }

  // Always update the versions list to reflect current state
  renderVersionsList();
}

// Check if a version matches current data
// admin-js/admin-main.js

function isCurrentVersion(version) {
  try {
    const data = getVersionData(version);
    if (!data) return false;
    const versionBrands = JSON.stringify(data.brands || {});
    const currentBrands = JSON.stringify(brandsData || {});
    const versionHeader = JSON.stringify(data.header || {});
    const currentHeader = JSON.stringify(programHeaderData || {});
    return currentBrands === versionBrands && currentHeader === versionHeader;
  } catch (error) {
    console.error("Error comparing version data:", error);
    return false;
  }
}

// Render versions list in sidebar
function renderVersionsList() {
  if (versionsData.length === 0) {
    versionsList.innerHTML =
      '<div class="text-slate-400 text-xs text-center py-2">Chưa có phiên bản nào</div>';
    return;
  }

  const versionsHTML = versionsData
    .map((version, index) => {
      const isLatest = isCurrentVersion(version);
      const deltaInfo = version.delta
        ? `+${version.delta.added.length} -${version.delta.deleted.length} ~${version.delta.modified.length}`
        : "Phiên bản đầu tiên";

      return `
      <div class="version-item ${
        isLatest ? "version-latest" : "version-old"
      } rounded-lg p-3 border transition-all">
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center gap-2">
            <span class="text-xs font-semibold ${
              isLatest ? "text-green-400" : "text-slate-300"
            }">
              ${isLatest ? "🟢 CURRENT" : `Version ${version.versionId}`}
            </span>
            ${
              version.note
                ? `<span class="text-xs text-slate-400 truncate max-w-32" title="${version.note}">${version.note}</span>`
                : ""
            }
          </div>
          <div class="flex gap-1">
            <button 
              onclick="previewVersion('${version.versionId}')"
              class="text-blue-400 hover:text-blue-300 p-1 rounded transition-colors"
              title="Xem trước"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </button>
            ${
              !isLatest
                ? `
              <button 
                onclick="initiateRollback('${version.versionId}')"
                class="text-yellow-400 hover:text-yellow-300 p-1 rounded transition-colors"
                title="Rollback"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                  <path d="M3 3v5h5"/>
                </svg>
              </button>
            `
                : ""
            }
          </div>
        </div>
        <div class="text-xs text-slate-400 mb-2">
          ${formatDate(version.createdAt)}
        </div>
        ${
          version.delta
            ? `
          <div class="flex gap-1 mb-2">
            ${
              version.delta.added.length > 0
                ? `<span class="delta-badge delta-added">+${version.delta.added.length}</span>`
                : ""
            }
            ${
              version.delta.modified.length > 0
                ? `<span class="delta-badge delta-modified">~${version.delta.modified.length}</span>`
                : ""
            }
            ${
              version.delta.deleted.length > 0
                ? `<span class="delta-badge delta-deleted">-${version.delta.deleted.length}</span>`
                : ""
            }
          </div>
        `
            : '<div class="text-xs text-slate-500 mb-2">Phiên bản đầu tiên</div>'
        }
        <div class="text-xs text-slate-500 text-right">
          ${Math.round(version.size / 1024)}KB
        </div>
      </div>
    `;
    })
    .join("");

  versionsList.innerHTML = versionsHTML;
}

// Preview version content
window.previewVersion = async function (versionId) {
  try {
    const version = versionsData.find((v) => v.versionId === versionId);
    if (!version) return;

    const data = getVersionData(version);
    if (!data) return;
    const brands = data.brands || {};
    const brandCount = Object.keys(brands).length;

    let previewHTML = `
      <div class="mb-4">
        <h4 class="text-lg font-semibold text-white mb-2">Thông tin phiên bản</h4>
        <div class="grid grid-cols-2 gap-4 text-sm">
          <div><strong>ID:</strong> ${version.versionId}</div>
          <div><strong>Tạo lúc:</strong> ${formatDate(version.createdAt)}</div>
          <div><strong>Người tạo:</strong> ${version.createdBy}</div>
          <div><strong>Kích thước:</strong> ${Math.round(
            version.size / 1024
          )}KB</div>
        </div>
        ${
          version.note
            ? `<div class="mt-2"><strong>Ghi chú:</strong> ${version.note}</div>`
            : ""
        }
      </div>
      
      <div class="mb-4">
        <h4 class="text-lg font-semibold text-white mb-2">Thống kê dữ liệu</h4>
        <div class="text-sm">
          <div><strong>Số lượng brands:</strong> ${brandCount}</div>
        </div>
      </div>
    `;

    if (version.delta) {
      previewHTML += `
        <div class="mb-4">
          <h4 class="text-lg font-semibold text-white mb-2">Thay đổi so với phiên bản trước</h4>
          <div class="text-sm space-y-1">
            <div class="text-green-400">✅ Thêm mới: ${version.delta.added.length} brands</div>
            <div class="text-yellow-400">📝 Chỉnh sửa: ${version.delta.modified.length} brands</div>
            <div class="text-red-400">❌ Xóa: ${version.delta.deleted.length} brands</div>
          </div>
        </div>
      `;
    }

    previewHTML += `
      <div>
        <h4 class="text-lg font-semibold text-white mb-2">Danh sách Brands</h4>
        <div class="max-h-64 overflow-y-auto">
          ${Object.values(brands)
            .map(
              (brand) => `
            <div class="flex items-center gap-2 p-2 bg-slate-700/30 rounded mb-1">
              <img src="${escapeHtml(brand.logo)}" alt="${escapeHtml(
                brand.name
              )}" class="w-6 h-6 rounded object-cover">
              <span class="text-sm">${escapeHtml(brand.name)}</span>
            </div>
          `
            )
            .join("")}
        </div>
      </div>
    `;

    versionPreviewContent.innerHTML = previewHTML;
    versionPreviewModal.classList.remove("hidden");
  } catch (error) {
    console.error("Error previewing version:", error);
  }
};

// Initiate rollback process
window.initiateRollback = function (versionId) {
  const version = versionsData.find((v) => v.versionId === versionId);
  if (!version) return;

  currentRollbackVersion = version;
  rollbackVersionInfo.textContent = `Phiên bản ${versionId}`;
  rollbackVersionDetails.textContent = `Tạo lúc: ${formatDate(
    version.createdAt
  )} bởi ${version.createdBy}`;

  rollbackModal.classList.remove("hidden");
};

// --- TOAST NOTIFICATION FUNCTIONS ---

let toastTimeout = null;
let progressInterval = null;

// Show success toast
function showSuccessToast(title, message, note = null, duration = 5000) {
  // Hide any existing toasts
  hideAllToasts();

  // Set content
  toastTitle.textContent = title;
  toastMessage.textContent = message;

  if (note) {
    toastNote.textContent = `💬 "${note}"`;
    toastNote.classList.remove("hidden");
  } else {
    toastNote.classList.add("hidden");
  }

  // Show toast with slide animation
  successToast.classList.remove(
    "translate-x-full",
    "opacity-0",
    "pointer-events-none"
  );
  successToast.classList.add(
    "translate-x-0",
    "opacity-100",
    "pointer-events-auto"
  );

  // Add bounce effect
  const toastContent = successToast.querySelector(".bg-gradient-to-r");
  toastContent.classList.add("toast-bounce");
  setTimeout(() => {
    toastContent.classList.remove("toast-bounce");
  }, 600);

  // Start progress bar animation
  toastProgress.style.width = "100%";
  let progress = 100;
  progressInterval = setInterval(() => {
    progress -= 100 / (duration / 100);
    if (progress <= 0) {
      progress = 0;
      clearInterval(progressInterval);
    }
    toastProgress.style.width = progress + "%";
  }, 100);

  // Auto hide after duration
  toastTimeout = setTimeout(() => {
    hideSuccessToast();
  }, duration);
}

// Show error toast
function showErrorToast(message, duration = 7000) {
  // Hide any existing toasts
  hideAllToasts();

  // Set content
  errorMessage.textContent = message;

  // Show toast with slide animation
  errorToast.classList.remove(
    "translate-x-full",
    "opacity-0",
    "pointer-events-none"
  );
  errorToast.classList.add(
    "translate-x-0",
    "opacity-100",
    "pointer-events-auto"
  );

  // Auto hide after duration
  toastTimeout = setTimeout(() => {
    hideErrorToast();
  }, duration);
}

// Hide success toast
function hideSuccessToast() {
  successToast.classList.remove(
    "translate-x-0",
    "opacity-100",
    "pointer-events-auto"
  );
  successToast.classList.add(
    "translate-x-full",
    "opacity-0",
    "pointer-events-none"
  );
  clearTimeout(toastTimeout);
  clearInterval(progressInterval);
}

// Hide error toast
function hideErrorToast() {
  errorToast.classList.remove(
    "translate-x-0",
    "opacity-100",
    "pointer-events-auto"
  );
  errorToast.classList.add(
    "translate-x-full",
    "opacity-0",
    "pointer-events-none"
  );
  clearTimeout(toastTimeout);
}

// Hide all toasts
function hideAllToasts() {
  hideSuccessToast();
  hideErrorToast();
}

// Publish with custom note function
// admin-js/admin-main.js

async function publishWithNote(customNote = "") {
  if (!isAuthenticated) {
    alert("Bạn cần đăng nhập để thực hiện chức năng này.");
    return;
  }
  if (Object.keys(brandsData).length === 0) {
    alert("Không có dữ liệu để đăng tải.");
    return;
  }

  const dataToPublish = {
    header: programHeaderData,
    brands: brandsData,
    lastUpdated: new Date().toISOString(),
  };

  const note = customNote.trim() || "Auto-save khi publish";

  try {
    // BƯỚC 1: LƯU PHIÊN BẢN (VERSION) ĐÃ NÉN (ĐÃ HOẠT ĐỘNG TỐT)
    await saveVersion(dataToPublish, note);

    // BƯỚC 2: LƯU DỮ LIỆU LIVE CHO TRANG WEB (ĐÂY LÀ PHẦN CẦN SỬA)
    console.log("Đang nén dữ liệu cho trang live...");
    const compressedForProduction = compressData(dataToPublish);
    if (!compressedForProduction) {
      throw new Error("Không thể nén dữ liệu cho production.");
    }

    const productionData = {
      isCompressed: true,
      compressedData: compressedForProduction,
      // Thêm timestamp để trang public biết khi nào có cập nhật
      lastUpdated: dataToPublish.lastUpdated,
    };

    const productionDocRef = db.collection("landingPage").doc("data");
    console.log("Đang publish dữ liệu đã nén lên landingPage/data...");
    await productionDocRef.set(productionData); // Gửi đi dữ liệu đã nén
    console.log("Publish dữ liệu live thành công!");

    await loadVersions(); // Tải lại danh sách versions để cập nhật UI
    return true;
  } catch (error) {
    console.error("Lỗi khi đăng tải dữ liệu:", error);
    throw error;
  }
}

// --- Popup Functions ---
window.showProductInfo = function (productName, productInfo) {
  const popup = document.getElementById("productInfoPopup");
  const title = document.getElementById("popupTitle");
  const body = document.getElementById("popupBody");

  title.textContent = productName || "Thông tin sản phẩm";
  // Preserve line breaks from Google Sheets
  const formattedProductInfo = (productInfo || "Không có thông tin chi tiết.")
    .replace(/\n/g, "<br>")
    .replace(/\r\n/g, "<br>");
  body.innerHTML = `<p><strong>Chi tiết:</strong></p><p>${formattedProductInfo}</p>`;

  popup.style.display = "flex";
  document.body.style.overflow = "hidden"; // Prevent background scrolling
};

// Hàm mới để hiển thị chi tiết sự kiện calendar trong admin
window.showCalendarEventDetails = function (events) {
  const popup = document.getElementById("productInfoPopup");
  const title = document.getElementById("popupTitle");
  const body = document.getElementById("popupBody");

  title.textContent = "Chi tiết Sự kiện Calendar";

  let eventDetailsHTML = "";
  [...new Set(events.map((t) => JSON.stringify(t)))]
    .map((t) => JSON.parse(t))
    .forEach((event, index) => {
      if (index > 0) eventDetailsHTML += "<hr class='border-slate-600 my-4'>";
      eventDetailsHTML += `
        <div class="bg-slate-700/30 rounded-lg p-4 mb-4">
          <h4 class="text-indigo-400 font-bold text-lg mb-3">
            ${event.title || "Sự kiện"}
          </h4>
          <div class="space-y-2 text-slate-300">
            <p class="flex items-center gap-2">
              <svg class="w-4 h-4 text-slate-400" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd"></path>
              </svg>
              <strong>Thời gian:</strong> ${(() => {
                let startDate, endDate;

                if (
                  event.startDate &&
                  typeof event.startDate === "object" &&
                  event.startDate.seconds
                ) {
                  startDate = new Date(event.startDate.seconds * 1000);
                } else if (
                  event.startDate &&
                  typeof event.startDate === "object" &&
                  event.startDate._seconds
                ) {
                  startDate = new Date(event.startDate._seconds * 1000);
                } else {
                  startDate = new Date(event.startDate);
                }

                if (
                  event.endDate &&
                  typeof event.endDate === "object" &&
                  event.endDate.seconds
                ) {
                  endDate = new Date(event.endDate.seconds * 1000);
                } else if (
                  event.endDate &&
                  typeof event.endDate === "object" &&
                  event.endDate._seconds
                ) {
                  endDate = new Date(event.endDate._seconds * 1000);
                } else {
                  endDate = new Date(event.endDate);
                }

                const startStr = startDate.toLocaleDateString("vi-VN", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                });
                const endStr = endDate.toLocaleDateString("vi-VN", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                });

                return `${startStr} - ${endStr}`;
              })()}
            </p>
            ${
              event.description
                ? `
              <p class="flex items-start gap-2">
                <svg class="w-4 h-4 text-slate-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"></path>
                </svg>
                <span><strong>Mô tả:</strong> ${(event.description || "")
                  .replace(/\n/g, "<br>")
                  .replace(/\r\n/g, "<br>")}</span>
              </p>
            `
                : ""
            }
            ${
              event.link
                ? `
              <p class="flex items-center gap-2">
                <svg class="w-4 h-4 text-slate-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clip-rule="evenodd"></path>
                </svg>
                <a href="${event.link}" target="_blank" rel="noopener" 
                   class="text-blue-400 hover:text-blue-300 underline hover:no-underline transition-colors">
                  Xem chi tiết tại đây →
                </a>
              </p>
            `
                : ""
            }
          </div>
        </div>
      `;
    });

  body.innerHTML =
    eventDetailsHTML ||
    "<p class='text-slate-400'>Không có thông tin chi tiết.</p>";
  popup.style.display = "flex";
  document.body.style.overflow = "hidden";
};

window.closeProductInfo = function () {
  const popup = document.getElementById("productInfoPopup");
  popup.style.display = "none";
  document.body.style.overflow = "auto"; // Restore scrolling
};

// Close popup when clicking outside
document
  .getElementById("productInfoPopup")
  .addEventListener("click", function (e) {
    if (e.target === this) {
      closeProductInfo();
    }
  });

// Close popup with Escape key
document.addEventListener("keydown", function (e) {
  if (e.key === "Escape") {
    closeProductInfo();
  }
});

// Event delegation for product info buttons
document.addEventListener("click", function (e) {
  if (e.target.classList.contains("product-info-btn")) {
    const productName = e.target.getAttribute("data-product-name");
    const productInfo = e.target.getAttribute("data-product-info");
    showProductInfo(productName, productInfo);
  }
});

const showLoading = (show) => {
  loadingOverlay.classList.toggle("hidden", !show);
  loadingOverlay.classList.toggle("flex", show);
};

// --- DATA PROCESSING (No changes needed) ---
function processCalendarData(rows) {
  const map = {};
  rows.forEach((r) => {
    const bKey = normalizeBrand(r["brand"] || r["Brand"] || r["BRAND"]);
    if (!bKey) return;
    map[bKey] ??= {};

    // Sử dụng startDate và endDate thay vì date
    const startDate = r["startDate"] || r["StartDate"] || r["start_date"];
    const endDate = r["endDate"] || r["EndDate"] || r["end_date"];

    // Fallback về date nếu không có startDate/endDate
    if (!startDate || !endDate) {
      const date = r["date"] || r["Date"];
      if (date) {
        map[bKey][date] = {
          title: r["title"] || r["Title"],
          description: r["description"] || r["Description"],
          link: r["link"] || r["Link"] || r["URL"],
          startDate: date,
          endDate: date,
        };
      }
    } else {
      // Sử dụng startDate làm key để tương thích với logic cũ
      map[bKey][startDate] = {
        title: r["title"] || r["Title"],
        description: r["description"] || r["Description"],
        link: r["link"] || r["Link"] || r["URL"],
        startDate: startDate,
        endDate: endDate,
      };
    }
  });
  return map;
}

function processTopSkuData(rows) {
  const map = {};
  rows.forEach((r) => {
    const bKey = normalizeBrand(r["brand"] || r["Brand"]);
    if (!bKey) return;
    (map[bKey] ??= []).push({
      sku: r["sku"] || r["SKU"] || r["Sản phẩm"],
      image: r["image"] || r["Image"] || "",
      qty: numParse(r["qty"] || r["Quantity"] || r["Số lượng"]) || 0,
    });
  });
  return map;
}

function processPromotionData(rows) {
  const map = {};
  if (
    !rows.length ||
    !rows[0] ||
    !Object.keys(rows[0]).some((h) => norm(h).includes("brand"))
  ) {
    console.warn(
      "Sheet 'Promotion' không có dữ liệu hoặc không có cột 'brand'."
    );
    return map;
  }
  const headers = Object.keys(rows[0]);
  const isPriceCol = (h) =>
    /gia\b/.test(norm(h)) && /ban\b/.test(norm(h)) && !/goc\b/.test(norm(h));
  const isGiftCol = (h) => /qua\b/.test(norm(h)) && /tang\b/.test(norm(h));
  const takeParen = (h) => {
    const m = String(h || "").match(/\(([^)]+)\)/);
    return m ? m[1] : "";
  };
  const findCol = (predicate) => headers.find((h) => predicate(h));
  const isLoai = (h) => /\bloai\b/.test(norm(h)) || /\bstt\b/.test(norm(h));
  const isName = (h) =>
    /\b(ten\s*san\s*pham|san\s*pham|ten\s*sp|sku|ten\s*sku|ma\s*sku|product|name)\b/.test(
      norm(h)
    ) && !/\bloai\b/.test(norm(h));
  const colType = findCol(isLoai) || headers[0];
  let colName = headers.find((h) => isName(h) && h !== colType) || headers[1];
  const colPlat = findCol((h) => /\b(platform|kenh)\b/.test(norm(h)));
  const colOG = findCol((h) => /\bgia\s*goc\b/.test(norm(h)));
  const colVoucher = findCol((h) => /\b(seller\s*)?voucher\b/.test(norm(h)));
  const colLink = findCol((h) => /\b(link(\s*sp)?|url)\b/.test(norm(h)));
  const colInfo = findCol((h) =>
    /(thong\s*tin\s*san\s*pham|mo\s*ta)/.test(norm(h))
  );
  const colBrand = findCol((h) => /\b(brand|nhan\s*hang)\b/.test(norm(h)));
  const priceCols = headers
    .map((h, idx) => ({ h, idx, period: takeParen(h) }))
    .filter((x) => isPriceCol(x.h));
  const giftCols = headers
    .map((h, idx) => ({ h, idx, period: takeParen(h) }))
    .filter((x) => isGiftCol(x.h));
  const pairGift = {};
  priceCols.forEach((p) => {
    let g = giftCols.find((g) => g.period && g.period === p.period);
    if (!g) {
      g = [...giftCols].sort(
        (a, b) => Math.abs(a.idx - p.idx) - Math.abs(b.idx - p.idx)
      )[0];
      if (g && Math.abs(g.idx - p.idx) > 3) g = null;
    }
    if (g) pairGift[p.h] = g.h;
  });

  rows.forEach((r) => {
    const brandName = r[colBrand];
    const bKey = normalizeBrand(brandName);
    if (!bKey) return;
    if (!map[bKey]) map[bKey] = { name: brandName, items: [] };
    priceCols.forEach((p) => {
      const sale = numParse(r[p.h]);
      if (!isFinite(sale)) return;
      const giftColName = pairGift[p.h];
      const giftVal = giftColName
        ? r[giftColName]
        : r["Quà tặng"] || r["Gift"] || "";

      map[bKey].items.push({
        type: r[colType] ?? "",
        name: r[colName] ?? "",
        platform: colPlat ? r[colPlat] : "",
        original: colOG ? numParse(r[colOG]) : NaN,
        sale: sale,
        gift: giftVal || "",
        voucher: colVoucher ? r[colVoucher] : "",
        link: colLink ? r[colLink] : "",
        extra: colInfo ? r[colInfo] : "",
        period: p.period || "",
      });
    });
  });
  return map;
}

// --- ACTIVITY LOG FUNCTIONS ---

// Log activity to Firebase
async function logActivity(type, description, details = {}) {
  try {
    const activityData = {
      type,
      description,
      details,
      timestamp: new Date().toISOString(),
      user: currentUser?.email || "unknown",
    };

    const activityId = `activity_${Date.now()}`;
    await db.collection("activityLogs").doc(activityId).set(activityData);

    // Add to local array
    activityLogs.unshift(activityData);

    // Keep only last 50 activities locally
    if (activityLogs.length > 50) {
      activityLogs = activityLogs.slice(0, 50);
    }

    console.log("Activity logged:", activityData);
  } catch (error) {
    console.error("Error logging activity:", error);
  }
}

// Load recent activity from Firebase
async function loadRecentActivity() {
  try {
    const snapshot = await db
      .collection("activityLogs")
      .orderBy("timestamp", "desc")
      .limit(10)
      .get();
    activityLogs = [];

    snapshot.forEach((doc) => {
      activityLogs.push(doc.data());
    });

    renderRecentActivity();
  } catch (error) {
    console.error("Error loading recent activity:", error);
    if (recentActivityList) {
      recentActivityList.innerHTML = `
        <div class="text-center text-red-400 py-8">
          <p>Lỗi tải hoạt động gần đây</p>
          <p class="text-sm text-slate-500 mt-1">${error.message}</p>
        </div>
      `;
    }
  }
}

// Render recent activity
function renderRecentActivity() {
  if (!recentActivityList) return;

  if (activityLogs.length === 0) {
    recentActivityList.innerHTML = `
      <div class="text-center text-slate-400 py-8">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" class="mx-auto mb-4">
          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
          <path d="M3 3v5h5"/>
        </svg>
        <p>Chưa có hoạt động nào</p>
        <p class="text-sm text-slate-500 mt-1">Các hoạt động sẽ hiển thị ở đây</p>
      </div>
    `;
    return;
  }

  const activityHTML = activityLogs
    .map((activity) => {
      const timeAgo = getTimeAgo(new Date(activity.timestamp));
      const icon = getActivityIcon(activity.type);
      const color = getActivityColor(activity.type);

      return `
      <div class="flex items-start gap-3 p-3 bg-slate-700/30 rounded-lg hover:bg-slate-700/50 transition-colors">
        <div class="w-8 h-8 ${color} rounded-full flex items-center justify-center flex-shrink-0">
          ${icon}
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm text-white font-medium">${activity.description}</p>
          <p class="text-xs text-slate-400 mt-1">${timeAgo}</p>
          ${
            activity.details && Object.keys(activity.details).length > 0
              ? `
            <div class="text-xs text-slate-500 mt-1">
              ${Object.entries(activity.details)
                .map(
                  ([key, value]) =>
                    `<span class="inline-block mr-2"><strong>${key}:</strong> ${value}</span>`
                )
                .join("")}
            </div>
          `
              : ""
          }
        </div>
      </div>
    `;
    })
    .join("");

  recentActivityList.innerHTML = activityHTML;
}

// Get activity icon
function getActivityIcon(type) {
  const icons = {
    publish:
      '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M12 12v9"/><path d="m16 16-4-4-4 4"/></svg>',
    rollback:
      '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>',
    edit: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>',
    login:
      '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10,17 15,12 10,7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>',
    default:
      '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg>',
  };
  return icons[type] || icons.default;
}

// Get activity color
function getActivityColor(type) {
  const colors = {
    publish: "bg-green-500/20 text-green-400",
    rollback: "bg-yellow-500/20 text-yellow-400",
    edit: "bg-blue-500/20 text-blue-400",
    login: "bg-purple-500/20 text-purple-400",
    default: "bg-slate-500/20 text-slate-400",
  };
  return colors[type] || colors.default;
}

// Get time ago string
function getTimeAgo(date) {
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);

  if (diffInSeconds < 60) return "Vừa xong";
  if (diffInSeconds < 3600)
    return `${Math.floor(diffInSeconds / 60)} phút trước`;
  if (diffInSeconds < 86400)
    return `${Math.floor(diffInSeconds / 3600)} giờ trước`;
  if (diffInSeconds < 2592000)
    return `${Math.floor(diffInSeconds / 86400)} ngày trước`;

  return date.toLocaleDateString("vi-VN");
}

// --- UI RENDERING FUNCTIONS ---
// Helper function to escape HTML and special characters
function escapeHtml(text) {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderBrandList() {
  brandListContainer.innerHTML = "";
  const sortedBrands = Object.values(brandsData).sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  sortedBrands.forEach((b) => {
    console.log("Rendering brand:", b.name, "with key:", b.key);
    const item = document.createElement("a");
    item.href = "#";
    item.className = `brand-item flex items-center p-2 rounded-lg transition-colors duration-200 hover:bg-slate-700`;
    item.setAttribute("data-brand-key", b.key);

    // Create edit button with proper event handling
    const editButton = document.createElement("button");
    editButton.className = "edit-tool ml-auto p-1 rounded-md hover:bg-white/20";
    editButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`;
    editButton.onclick = (e) => {
      e.stopPropagation();
      console.log("Edit button clicked for brand:", b.name, "key:", b.key);
      window.editBrand(b.key);
    };

    item.innerHTML = `
              <img src="${escapeHtml(b.logo)}" alt="${escapeHtml(
      b.name
    )}" class="w-8 h-8 rounded-full object-cover mr-3 flex-shrink-0">
              <span class="font-medium truncate flex-1">${escapeHtml(
                b.name
              )}</span>
          `;
    item.appendChild(editButton);

    item.onclick = (e) => {
      e.preventDefault();
      showBrandDetailView(b.key);
    };
    if (editMode) item.classList.add("editing");
    brandListContainer.appendChild(item);
  });

  // Update navigation state after rendering
  updateNavigationState();
}

function showBrandDetail(key) {
  console.log("showBrandDetail called with key:", key);
  console.log("brandsData:", brandsData);
  console.log("currentBrandKey:", currentBrandKey);

  // Don't re-render if already selected, but still log for debugging
  if (currentBrandKey === key) {
    console.log("Brand already selected, skipping re-render");
    return;
  }

  currentBrandKey = key;
  currentCalendarDate = new Date();
  const brand = brandsData[key];

  console.log("Brand found:", brand);

  if (!brand) {
    console.log("Brand not found for key:", key);
    return;
  }

  // Ensure dashboard is hidden and welcome placeholder is hidden
  if (dashboardContent) dashboardContent.classList.add("hidden");
  welcomePlaceholder.classList.add("hidden");

  let calendarHTML = "",
    promotionHTML = "",
    topSkuHTML = "";

  if (brand.calendar && Object.keys(brand.calendar).length) {
    calendarHTML = `
          <div class="bg-slate-800/50 rounded-xl p-4 md:p-6 fade-in">
              <h3 class="text-xl font-bold mb-4 text-white flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  Lịch trình Campaign
              </h3>
              <div id="calendarWrapper"></div>
          </div>`;
  }

  if (brand.promotion?.length) {
    promotionHTML = `
          <div class="bg-slate-800/50 rounded-xl p-4 md:p-6 fade-in" style="animation-delay: 100ms;">
              <h3 class="text-xl font-bold mb-4 text-white flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><circle cx="12" cy="12" r="4"/></svg>
                  Chi tiết Khuyến mãi
              </h3>
              ${renderPromotionTable(brand)}
          </div>`;
  }

  if (brand.top?.length) {
    topSkuHTML = `
          <div class="bg-slate-800/50 rounded-xl p-4 md:p-6 fade-in" style="animation-delay: 200ms;">
              <h3 class="text-xl font-bold mb-4 text-white flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                  Top SKU bán chạy
              </h3>
              <div class="overflow-x-auto">
                  <table class="w-full text-sm text-left text-slate-300">
                      <thead class="text-xs text-slate-400 uppercase bg-slate-700/50">
                          <tr>
                              <th scope="col" class="px-6 py-3">Sản phẩm</th>
                              <th scope="col" class="px-6 py-3">Ảnh</th>
                              <th scope="col" class="px-6 py-3 text-right">Số lượng bán</th>
                          </tr>
                      </thead>
                      <tbody>${brand.top
                        .map(
                          (t) => `
                          <tr class="border-b border-slate-700 hover:bg-slate-700/30">
                              <td class="px-6 py-4 font-medium text-white whitespace-nowrap">${
                                t.sku || ""
                              }</td>
                              <td class="px-6 py-4">
                                  ${
                                    t.image
                                      ? `<img src="${t.image}" class="h-10 w-10 object-cover rounded-md" alt="${t.sku}">`
                                      : `<div class="h-10 w-10 bg-slate-700 rounded-md flex items-center justify-center text-slate-500 text-xs">No Img</div>`
                                  }
                              </td>
                              <td class="px-6 py-4 text-right font-mono">${Number(
                                t.qty || 0
                              ).toLocaleString("vi-VN")}</td>
                          </tr>`
                        )
                        .join("")}
                      </tbody>
                  </table>
              </div>
          </div>`;
  }

  const brandHTML = `
          <div class="space-y-8">
              <div class="flex items-center justify-between fade-in">
                  <div class="flex items-center gap-4">
                      <img src="${escapeHtml(
                        brand.logo
                      )}" class="w-12 h-12 rounded-full object-cover border-2 border-slate-700" alt="${escapeHtml(
    brand.name
  )}">
                      <h2 class="text-3xl font-bold text-white">${escapeHtml(
                        brand.name
                      )}</h2>
                  </div>
              </div>
              ${calendarHTML}
              ${promotionHTML}
              ${topSkuHTML}
          </div>`;

  console.log("Rendering brand HTML:", brandHTML);
  console.log("Calendar HTML:", calendarHTML);
  console.log("Promotion HTML:", promotionHTML);
  console.log("Top SKU HTML:", topSkuHTML);

  mainContent.innerHTML = brandHTML;

  if (brand.calendar && Object.keys(brand.calendar).length) {
    console.log("Rendering calendar UI for brand:", key);
    renderCalendarUI(key);
  }
  renderBrandList(); // Re-render to update active state
}

function renderCalendarUI(brandKey) {
  const wrapper = document.getElementById("calendarWrapper");
  if (!wrapper) return;

  const b = brandsData[brandKey];
  const campaigns = [...new Set(Object.values(b.calendar).map((e) => e.title))];

  wrapper.innerHTML = `
          <div class="flex flex-col sm:flex-row items-center justify-between mb-4 gap-4">
              <div class="flex items-center gap-2 text-lg font-semibold text-white">
                  <button id="prevMonth" class="p-2 rounded-md hover:bg-slate-700 transition-colors">‹</button>
                  <h4 id="monthYear" class="w-40 text-center"></h4>
                  <button id="nextMonth" class="p-2 rounded-md hover:bg-slate-700 transition-colors">›</button>
              </div>
              <select id="campaignFilter" class="w-full sm:w-auto bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500">
                  <option value="">-- Lọc theo Campaign --</option>
                  ${campaigns
                    .map((c) => `<option value="${c}">${c}</option>`)
                    .join("")}
              </select>
          </div>
          <div id="calendarContainer"></div>
          <div class="calendar-legend">
              <div class="legend-item">
                  <div class="legend-color legend-single"></div>
                  <span class="text-slate-300">1 sự kiện</span>
              </div>
              <div class="legend-item">
                  <div class="legend-color legend-double"></div>
                  <span class="text-slate-300">2 sự kiện</span>
              </div>
              <div class="legend-item">
                  <div class="legend-color legend-multiple"></div>
                  <span class="text-slate-300">3+ sự kiện</span>
              </div>
              <div class="legend-item ml-auto">
                  <span class="text-slate-400 text-xs">💡 Màu thay đổi theo brand & tháng</span>
              </div>
          </div>`;

  const updateAndRender = () => {
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    document.getElementById("monthYear").textContent = `Tháng ${
      month + 1
    }, ${year}`;
    const campaignFilter = document.getElementById("campaignFilter").value;
    buildCalendar(brandKey, campaignFilter, year, month);
  };

  document.getElementById("prevMonth").onclick = () => {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
    updateAndRender();
  };
  document.getElementById("nextMonth").onclick = () => {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
    updateAndRender();
  };
  document.getElementById("campaignFilter").onchange = () => {
    const selectedCampaign = document.getElementById("campaignFilter").value;
    if (selectedCampaign) {
      const allEvents = brandsData[brandKey].calendar;
      const eventsForCampaign = Object.keys(allEvents).filter(
        (eventKey) => allEvents[eventKey].title === selectedCampaign
      );
      if (eventsForCampaign.length > 0) {
        // Sử dụng startDate của event đầu tiên để điều hướng calendar
        const firstEvent = allEvents[eventsForCampaign[0]];
        let startDate;

        if (
          firstEvent.startDate &&
          typeof firstEvent.startDate === "object" &&
          firstEvent.startDate.seconds
        ) {
          startDate = new Date(firstEvent.startDate.seconds * 1000);
        } else if (
          firstEvent.startDate &&
          typeof firstEvent.startDate === "object" &&
          firstEvent.startDate._seconds
        ) {
          startDate = new Date(firstEvent.startDate._seconds * 1000);
        } else {
          startDate = new Date(firstEvent.startDate);
        }

        currentCalendarDate = startDate;
      }
    }
    updateAndRender();
  };
  updateAndRender();
}

// Hàm riêng để gán event listeners cho calendar trong admin
function attachCalendarEventListeners() {
  const container = document.getElementById("calendarContainer");
  const tooltipEl = document.getElementById("customTooltip");
  if (!container || !tooltipEl) return;

  container.querySelectorAll(".day[data-tooltip]").forEach((dayEl) => {
    // Detect if device supports hover (desktop)
    const supportsHover = window.matchMedia("(hover: hover)").matches;

    // Only add hover events on desktop devices
    if (supportsHover) {
      dayEl.onmouseenter = (e) => {
        const tooltips = JSON.parse(e.target.getAttribute("data-tooltip"));
        let tooltipContent = [
          ...new Set(tooltips.map((t) => JSON.stringify(t))),
        ]
          .map((tStr) => JSON.parse(tStr))
          .map(
            (t) => `<div class="py-1">
                        <h4 class="font-bold text-indigo-400">${
                          t.title || "Sự kiện"
                        }</h4>
                        <p class="text-slate-400 text-xs">${(
                          t.description || ""
                        )
                          .replace(/\n/g, "<br>")
                          .replace(/\r\n/g, "<br>")}</p>
                        ${
                          t.link
                            ? `<a href="${t.link}" target="_blank" rel="noopener" class="text-blue-400 hover:underline text-xs">Chi tiết...</a>`
                            : ""
                        }
                    </div>`
          )
          .join('<hr class="border-slate-700 my-1">');

        tooltipEl.innerHTML = tooltipContent;
        tooltipEl.classList.remove("hidden");
      };
      dayEl.onmousemove = (e) => {
        tooltipEl.style.left = e.clientX + 15 + "px";
        tooltipEl.style.top = e.clientY + 15 + "px";
      };
      dayEl.onmouseleave = () => tooltipEl.classList.add("hidden");
    }

    // Click/Touch events cho tất cả devices
    const handleClick = (e) => {
      console.log("Admin calendar day clicked/touched:", e.type, e.target);
      e.preventDefault();
      e.stopPropagation();

      // Luôn ẩn tooltip trước (đặc biệt quan trọng cho mobile)
      tooltipEl.classList.add("hidden");

      const tooltipAttr = e.target.getAttribute("data-tooltip");
      console.log("Admin tooltip attribute:", tooltipAttr);

      if (tooltipAttr) {
        try {
          const tooltips = JSON.parse(tooltipAttr);
          console.log("Admin parsed tooltips:", tooltips);

          if (tooltips && tooltips.length > 0) {
            // Delay một chút để đảm bảo tooltip đã ẩn hoàn toàn
            setTimeout(() => {
              showCalendarEventDetails(tooltips);
            }, 50);
          } else {
            console.warn("No tooltips found or empty array");
          }
        } catch (error) {
          console.error("Error parsing tooltip data:", error);
        }
      } else {
        console.warn("No data-tooltip attribute found");
      }
    };

    // Detect if this is a mobile device
    const isMobile = !window.matchMedia("(hover: hover)").matches;

    if (isMobile) {
      // Mobile: Use touchstart for immediate response
      dayEl.addEventListener(
        "touchstart",
        (e) => {
          console.log(
            "Admin touch started on calendar day - will handle click"
          );
          e.preventDefault();
          dayEl.style.transform = "scale(0.95)";

          // Handle the click immediately on touchstart for mobile
          handleClick(e);
        },
        { passive: false }
      );
    } else {
      // Desktop: Use click event
      dayEl.addEventListener("click", handleClick, { passive: false });
    }

    // Thêm visual feedback
    dayEl.style.cursor = "pointer";
    dayEl.style.userSelect = "none";
    dayEl.style.webkitUserSelect = "none";
    dayEl.style.webkitTouchCallout = "none";
    dayEl.style.webkitTapHighlightColor = "rgba(59, 130, 246, 0.3)";

    // Thêm class cho mobile styling
    dayEl.classList.add("calendar-day-clickable");
    dayEl.classList.add("hover:ring-2", "hover:ring-indigo-400");

    // Thêm data attribute để debug
    dayEl.setAttribute("data-clickable", "true");
  });
}

// Hệ thống màu thông minh cho calendar (bỏ độ ưu tiên)
function generateSmartColors(brandKey, month, eventCount) {
  // Tạo màu base dựa trên brand key (hash)
  const brandHash = brandKey.split("").reduce((a, b) => {
    a = (a << 5) - a + b.charCodeAt(0);
    return a & a;
  }, 0);

  // Tạo màu dựa trên tháng (0-11)
  const monthHue = (month * 30) % 360;

  // Tạo màu dựa trên số lượng sự kiện
  const intensityMultiplier = Math.min(eventCount / 3, 1.5); // Tối đa 1.5x intensity

  // Base color từ brand hash
  const baseHue = Math.abs(brandHash) % 360;

  // Kết hợp hue từ brand và month
  const finalHue = (baseHue + monthHue * 0.3) % 360;

  return {
    primary: `hsl(${finalHue}, 70%, 50%)`,
    light: `hsl(${finalHue}, 60%, 60%)`,
    dark: `hsl(${finalHue}, 80%, 40%)`,
    gradient: `linear-gradient(135deg, hsl(${finalHue}, 70%, 50%), hsl(${finalHue}, 60%, 60%))`,
    intensity: intensityMultiplier,
  };
}

function buildCalendar(brandKey, campaignTitleFilter, year, month) {
  const container = document.getElementById("calendarContainer");
  if (!container) return;

  const events = brandsData[brandKey]?.calendar || {};

  const filteredEvents = Object.keys(events)
    .filter((eventKey) => {
      const event = events[eventKey];
      return !campaignTitleFilter || event.title === campaignTitleFilter;
    })
    .map((eventKey) => ({ eventKey, ...events[eventKey] }));

  const dayProps = {};
  filteredEvents.forEach((event) => {
    // Xử lý cả timestamp và string date
    let startDate, endDate;

    if (
      event.startDate &&
      typeof event.startDate === "object" &&
      event.startDate.seconds
    ) {
      // Firebase timestamp format
      startDate = new Date(event.startDate.seconds * 1000);
    } else if (
      event.startDate &&
      typeof event.startDate === "object" &&
      event.startDate._seconds
    ) {
      // Alternative Firebase timestamp format
      startDate = new Date(event.startDate._seconds * 1000);
    } else {
      // String date format
      startDate = new Date(event.startDate);
    }

    if (
      event.endDate &&
      typeof event.endDate === "object" &&
      event.endDate.seconds
    ) {
      // Firebase timestamp format
      endDate = new Date(event.endDate.seconds * 1000);
    } else if (
      event.endDate &&
      typeof event.endDate === "object" &&
      event.endDate._seconds
    ) {
      // Alternative Firebase timestamp format
      endDate = new Date(event.endDate._seconds * 1000);
    } else {
      // String date format
      endDate = new Date(event.endDate);
    }

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return;
    }

    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(0, 0, 0, 0);

    // Tô màu tất cả các ngày từ startDate đến endDate
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      if (
        currentDate.getFullYear() === year &&
        currentDate.getMonth() === month
      ) {
        const dayOfMonth = currentDate.getDate();
        dayProps[dayOfMonth] ??= {
          classes: new Set(),
          tooltips: [],
          events: [],
        };
        dayProps[dayOfMonth].classes.add("campaign-active");
        dayProps[dayOfMonth].tooltips.push(event);
        dayProps[dayOfMonth].events.push(event);
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
  });

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let firstDayOfMonth = new Date(year, month, 1).getDay();
  firstDayOfMonth = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

  let html = `<div class="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-slate-400 mb-2">
          ${["T2", "T3", "T4", "T5", "T6", "T7", "CN"]
            .map((d) => `<div>${d}</div>`)
            .join("")}
      </div>
      <div class="grid grid-cols-7 gap-1">`;

  html += "<div></div>".repeat(firstDayOfMonth);

  for (let d = 1; d <= daysInMonth; d++) {
    const props = dayProps[d];
    let classes =
      "day relative text-sm h-12 flex items-center justify-center rounded-lg cursor-pointer border border-transparent transition-all duration-300";
    let tooltipData = "";
    let customStyle = "";

    if (props) {
      const eventCount = props.events.length;
      const colors = generateSmartColors(brandKey, month, eventCount);

      // Thêm class dựa trên số lượng sự kiện
      if (eventCount === 1) {
        classes += " campaign-single";
      } else if (eventCount === 2) {
        classes += " campaign-double";
      } else if (eventCount >= 3) {
        classes += " campaign-multiple";
      }

      // Tạo style động dựa trên màu và số lượng sự kiện
      if (eventCount === 1) {
        customStyle = `background: ${colors.primary}; color: white; box-shadow: 0 2px 8px ${colors.primary}40;`;
      } else if (eventCount === 2) {
        customStyle = `background: ${colors.gradient}; color: white; box-shadow: 0 3px 12px ${colors.primary}50; transform: scale(1.05);`;
      } else if (eventCount >= 3) {
        customStyle = `background: ${colors.gradient}; color: white; box-shadow: 0 4px 16px ${colors.primary}60; transform: scale(1.1); animation: pulse-glow 2s infinite;`;
      }

      // Thêm indicator cho ngày có nhiều sự kiện
      const eventIndicator =
        eventCount > 1
          ? `<div class="event-count-badge">${eventCount}</div>`
          : "";

      tooltipData = `data-tooltip='${JSON.stringify(props.tooltips)}'`;
      html += `<div class='${classes}' ${tooltipData} style='${customStyle}'>${d}${eventIndicator}</div>`;
    } else {
      classes += " hover:bg-slate-700";
      html += `<div class='${classes}'>${d}</div>`;
    }
  }
  html += "</div>";
  container.innerHTML = html;

  // Gán lại event listeners sau khi re-render
  attachCalendarEventListeners();
}

function renderPromotionTable(b) {
  let page = 1,
    per = 15;
  let filtered = [...b.promotion];

  const uniqueTypes = [
    ...new Set(b.promotion.map((p) => p.type).filter(Boolean)),
  ].sort();
  const uniquePlatforms = [
    ...new Set(b.promotion.map((p) => p.platform).filter(Boolean)),
  ].sort();
  const uniquePeriods = [
    ...new Set(b.promotion.map((p) => p.period).filter(Boolean)),
  ].sort();

  const render = () => {
    const total = Math.max(1, Math.ceil(filtered.length / per));
    const cur = Math.min(Math.max(page, 1), total);
    const start = (cur - 1) * per;
    const slice = filtered.slice(start, start + per);

    const filterBarHTML = `
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
              <input id="filterName" placeholder="🔍 Tên sản phẩm/SKU..." oninput="window.__applyPromoFilters()" class="lg:col-span-2 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500" />
              <select id="filterType" onchange="window.__applyPromoFilters()" class="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500">
                  <option value="">-- Tất cả Loại --</option>
                  ${uniqueTypes
                    .map((t) => `<option value="${t}">${t}</option>`)
                    .join("")}
              </select>
              <select id="filterPlatform" onchange="window.__applyPromoFilters()" class="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500">
                  <option value="">-- Tất cả Kênh --</option>
                  ${uniquePlatforms
                    .map((p) => `<option value="${p}">${p}</option>`)
                    .join("")}
              </select>
              <select id="filterPeriod" onchange="window.__applyPromoFilters()" class="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500">
                  <option value="">-- Tất cả Cụm ngày --</option>
                  ${uniquePeriods
                    .map((p) => `<option value="${p}">${p}</option>`)
                    .join("")}
              </select>
          </div>`;

    return `${filterBarHTML}
              <div class="flex items-center justify-between mb-2 text-sm text-slate-400">
                  <div>Tổng: <b>${
                    filtered.length
                  }</b> dòng • Trang <b>${cur}</b>/<b>${total}</b></div>
                  <div class="space-x-1">
                      <button class="px-2 py-1 rounded-md bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed" ${
                        cur <= 1 ? "disabled" : ""
                      } onclick="window.__prev()">«</button>
                      <button class="px-2 py-1 rounded-md bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed" ${
                        cur >= total ? "disabled" : ""
                      } onclick="window.__next()">»</button>
                  </div>
              </div>
              <div class="overflow-x-auto rounded-lg border border-slate-700">
                  <table class="w-full text-sm text-left text-slate-300 min-w-[1200px]">
                      <thead class="text-xs text-slate-400 uppercase bg-slate-700/50">
                          <tr>
                              <th class="px-4 py-3 w-[8%]">Loại</th><th class="px-4 py-3 w-[20%]">Sản phẩm</th><th class="px-4 py-3 w-[9%]">Platform</th>
                              <th class="px-4 py-3 w-[8%]">Giá gốc</th><th class="px-4 py-3 w-[9%]">Giá bán</th><th class="px-4 py-3 w-[12%]">Quà</th>
                              <th class="px-4 py-3 w-[10%]">Giá Voucher</th><th class="px-4 py-3 w-[8%]">Cụm ngày</th><th class="px-4 py-3 w-[12%]">Thông tin SP</th>
                              <th class="px-4 py-3 w-[6%]">Link</th>
                          </tr>
                      </thead>
                      <tbody>${
                        slice.length === 0
                          ? `<tr><td colspan="10" class="text-center py-8 text-slate-500">Không tìm thấy kết quả phù hợp.</td></tr>`
                          : slice
                              .map(
                                (x) => `
                          <tr class="border-b border-slate-700 hover:bg-slate-700/30">
                              <td class="px-4 py-2">${
                                x.type || ""
                              }</td><td class="px-4 py-2 text-white font-medium">${
                                  x.name || ""
                                }</td><td class="px-4 py-2">${
                                  x.platform || ""
                                }</td>
                              <td class="px-4 py-2 line-through text-slate-400">${
                                isFinite(Number(x.original))
                                  ? currency(x.original)
                                  : ""
                              }</td>
                              <td class="px-4 py-2 text-green-400 font-bold">${
                                isFinite(Number(x.sale)) ? currency(x.sale) : ""
                              }</td>
                              <td class="px-4 py-2">${(x.gift || "")
                                .replace(/\n/g, "<br>")
                                .replace(
                                  /\r\n/g,
                                  "<br>"
                                )}</td><td class="px-4 py-2 text-blue-400 font-bold">${formatVoucher(
                                  x.voucher
                                )}</td><td>${
                                  x.period || ""
                                }</td><td class="px-4 py-2">${
                                  x.extra
                                    ? `<button class="product-info-btn" data-product-name="${(
                                        x.name || ""
                                      ).replace(
                                        /"/g,
                                        "&quot;"
                                      )}" data-product-info="${(x.extra || "")
                                        .replace(/\n/g, "<br>")
                                        .replace(/\r\n/g, "<br>")
                                        .replace(
                                          /"/g,
                                          "&quot;"
                                        )}">Chi tiết</button>`
                                    : ""
                                }</td>
                              <td class="px-4 py-2">${
                                x.link
                                  ? `<a href="${x.link}" target="_blank" rel="noopener" class="font-medium text-indigo-400 hover:underline">Mở</a>`
                                  : ""
                              }</td>
                          </tr>`
                              )
                              .join("")
                      }
                      </tbody>
                  </table>
              </div>`;
  };

  window.__prev = () => {
    if (page > 1) {
      page--;
      document.getElementById("promoBox").innerHTML = render();
    }
  };
  window.__next = () => {
    if (page < Math.ceil(filtered.length / per)) {
      page++;
      document.getElementById("promoBox").innerHTML = render();
    }
  };

  window.__applyPromoFilters = () => {
    const nameVal = document.getElementById("filterName").value;
    const nameQuery = norm(nameVal);
    const typeQuery = document.getElementById("filterType").value;
    const platformQuery = document.getElementById("filterPlatform").value;
    const periodQuery = document.getElementById("filterPeriod").value;

    filtered = b.promotion.filter((p) => {
      const matchName = !nameQuery || norm(p.name || "").includes(nameQuery);
      const matchType = !typeQuery || p.type === typeQuery;
      const matchPlatform = !platformQuery || p.platform === platformQuery;
      const matchPeriod = !periodQuery || p.period === periodQuery;
      return matchName && matchType && matchPlatform && matchPeriod;
    });
    page = 1;
    document.getElementById("promoBox").innerHTML = render();
    document.getElementById("filterName").value = nameVal;
    document.getElementById("filterType").value = typeQuery;
    document.getElementById("filterPlatform").value = platformQuery;
    document.getElementById("filterPeriod").value = periodQuery;
  };
  return `<div id="promoBox">${render()}</div>`;
}

// --- BRAND LOGO PERSISTENCE FUNCTIONS ---

// Load brand logos from Firestore
async function loadBrandLogos() {
  try {
    const logosDocRef = db.collection("admin").doc("brandLogos");
    const logosDoc = await logosDocRef.get();

    if (logosDoc.exists) {
      brandLogos = logosDoc.data();
      console.log("Loaded brand logos:", brandLogos);
    }
  } catch (error) {
    console.error("Error loading brand logos:", error);
  }
}

// Save brand logo to Firestore
async function saveBrandLogo(brandKey, logoUrl) {
  try {
    brandLogos[brandKey] = logoUrl;
    const logosDocRef = db.collection("admin").doc("brandLogos");
    await logosDocRef.set(brandLogos);
    console.log(`Saved logo for brand ${brandKey}:`, logoUrl);
  } catch (error) {
    console.error("Error saving brand logo:", error);
    throw error;
  }
}

// Merge brand logos with brand data
function mergeBrandLogos() {
  Object.keys(brandsData).forEach((key) => {
    // Check if we have a persisted logo for this brand
    if (brandLogos[key]) {
      brandsData[key].logo = brandLogos[key];
    }
  });
}

// Clean up logos for brands that no longer exist
async function cleanupOrphanedLogos() {
  try {
    const existingBrandKeys = Object.keys(brandsData);
    let hasChanges = false;

    // Remove logos for brands that don't exist anymore
    Object.keys(brandLogos).forEach((key) => {
      if (!existingBrandKeys.includes(key)) {
        console.log(`Removing orphaned logo for brand: ${key}`);
        delete brandLogos[key];
        hasChanges = true;
      }
    });

    // Save if there were changes
    if (hasChanges) {
      const logosDocRef = db.collection("admin").doc("brandLogos");
      await logosDocRef.set(brandLogos);
      console.log("Cleaned up orphaned logos");
    }
  } catch (error) {
    console.error("Error cleaning up orphaned logos:", error);
  }
}

window.editBrand = (key) => {
  console.log("editBrand called with key:", key);
  console.log("brandsData:", brandsData);
  const b = brandsData[key];
  console.log("Found brand:", b);

  if (!b) {
    console.error("Brand not found for key:", key);
    alert("Không tìm thấy brand với key: " + key);
    return;
  }

  const modal = document.createElement("div");
  modal.className =
    "fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4";
  modal.innerHTML = `
          <div class="bg-slate-800 rounded-lg shadow-xl w-full max-w-md p-6">
              <h3 class="text-xl font-bold mb-4 text-white">Chỉnh sửa Brand</h3>
              <div class="space-y-4">
                  <div>
                      <label class="block text-sm font-medium text-slate-300 mb-1">Tên hiển thị:</label>
                      <input id="editName" type="text" value="${escapeHtml(
                        b.name
                      )}" class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500">
                  </div>
                  <div>
                      <label class="block text-sm font-medium text-slate-300 mb-2">Logo URL:</label>
                      <div class="space-y-2">
                          <input id="customLogoUrl" type="url" value="${escapeHtml(
                            brandLogos[key] || ""
                          )}" class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500" placeholder="https://example.com/logo.png">
                          <p class="text-xs text-slate-400">Nhập URL ảnh cho logo của brand này</p>
                          ${
                            brandLogos[key]
                              ? `
                          <div class="flex items-center gap-2 p-2 bg-green-500/10 border border-green-500/30 rounded-lg">
                              <svg class="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                              </svg>
                              <span class="text-xs text-green-400">Logo đã được thiết lập</span>
                              <button id="removeLogo" class="ml-auto text-red-400 hover:text-red-300 text-xs underline">Xóa</button>
                          </div>
                          `
                              : ""
                          }
                          <div id="urlPreview" class="hidden mt-2">
                              <img id="previewImage" class="max-h-20 rounded border border-slate-600" alt="Preview">
                          </div>
                      </div>
                  </div>
              </div>
              <div class="flex justify-end gap-3 mt-6">
                  <button id="cancelEdit" class="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm font-semibold">Hủy</button>
                  <button id="saveEdit" class="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold">Lưu thay đổi</button>
              </div>
          </div>`;
  document.body.appendChild(modal);

  // Preview URL image
  const urlInput = document.getElementById("customLogoUrl");
  const previewDiv = document.getElementById("urlPreview");
  const previewImg = document.getElementById("previewImage");

  urlInput.addEventListener("input", (e) => {
    const url = e.target.value.trim();
    if (url && url.startsWith("http")) {
      previewImg.src = url;
      previewImg.onload = () => {
        previewDiv.classList.remove("hidden");
      };
      previewImg.onerror = () => {
        previewDiv.classList.add("hidden");
      };
    } else {
      previewDiv.classList.add("hidden");
    }
  });

  // Remove logo button
  const removeLogoBtn = document.getElementById("removeLogo");
  if (removeLogoBtn) {
    removeLogoBtn.onclick = async () => {
      if (confirm("Bạn có chắc muốn xóa logo đã upload?")) {
        try {
          delete brandLogos[key];
          const logosDocRef = db.collection("admin").doc("brandLogos");
          await logosDocRef.set(brandLogos);

          // Refresh brand data
          mergeBrandLogos();
          renderBrandList();
          if (currentBrandKey === key) showBrandDetail(key);

          modal.remove();
          showSuccessToast("Đã xóa logo", "Logo đã được xóa thành công");
        } catch (error) {
          console.error("Error removing logo:", error);
          alert("Lỗi khi xóa logo: " + error.message);
        }
      }
    };
  }

  modal.onclick = (e) => {
    if (e.target === modal) modal.remove();
  };

  document.getElementById("saveEdit").onclick = async () => {
    const saveBtn = document.getElementById("saveEdit");
    saveBtn.disabled = true;
    saveBtn.textContent = "Đang lưu...";

    try {
      b.name = document.getElementById("editName").value;

      // Check if user entered a custom logo URL
      const customLogoUrl = urlInput.value.trim();
      if (customLogoUrl) {
        // Save to Firestore
        await saveBrandLogo(key, customLogoUrl);

        // Update local data
        b.logo = customLogoUrl;
      } else {
        // If URL is empty, remove the custom logo
        delete brandLogos[key];
        const logosDocRef = db.collection("admin").doc("brandLogos");
        await logosDocRef.set(brandLogos);
      }

      modal.remove();

      // Refresh UI
      mergeBrandLogos();
      renderBrandList();
      if (currentBrandKey === key) showBrandDetail(key);

      showSuccessToast("Đã lưu", "Thay đổi đã được lưu thành công");
    } catch (error) {
      console.error("Error saving brand:", error);
      alert("Lỗi khi lưu: " + error.message);
      saveBtn.disabled = false;
      saveBtn.textContent = "Lưu thay đổi";
    }
  };

  document.getElementById("cancelEdit").onclick = () => modal.remove();
};

// --- Mobile Menu Functions ---
const mobileMenuToggle = document.getElementById("mobileMenuToggle");
const mobileOverlay = document.getElementById("mobileOverlay");
const sidebar = document.getElementById("sidebar");
const closeSidebar = document.getElementById("closeSidebar");

const openSidebar = () => {
  sidebar.classList.remove("-translate-x-full");
  mobileOverlay.classList.remove("hidden");
  document.body.style.overflow = "hidden";
};

const closeSidebarMenu = () => {
  sidebar.classList.add("-translate-x-full");
  mobileOverlay.classList.add("hidden");
  document.body.style.overflow = "auto";
};

mobileMenuToggle?.addEventListener("click", openSidebar);
closeSidebar?.addEventListener("click", closeSidebarMenu);
mobileOverlay?.addEventListener("click", closeSidebarMenu);

// Close sidebar when clicking on brand items on mobile
document.addEventListener("click", (e) => {
  if (window.innerWidth < 1024 && e.target.closest(".brand-item")) {
    closeSidebarMenu();
  }
});

// --- Event Listeners & Main Logic ---

// Dashboard event listeners
dashboardLink?.addEventListener("click", (e) => {
  e.preventDefault();
  showDashboard();
});

versioningLink?.addEventListener("click", (e) => {
  e.preventDefault();
  showVersioning();
});

refreshActivityBtn?.addEventListener("click", () => {
  loadRecentActivity();
});

toggleEdit.onchange = () => {
  editMode = toggleEdit.checked;
  document.querySelectorAll(".brand-item").forEach((item) => {
    item.classList.toggle("editing", editMode);
  });
  const dot = toggleEdit.parentElement.querySelector(".dot");
  if (dot) dot.classList.toggle("translate-x-6");
};

publishBtn.onclick = async () => {
  // Check authentication
  if (!isAuthenticated) {
    alert("Bạn cần đăng nhập để thực hiện chức năng này.");
    return;
  }

  if (Object.keys(brandsData).length === 0) {
    alert(
      "Không có dữ liệu để đăng tải. Vui lòng chờ dữ liệu từ Google Sheet."
    );
    return;
  }
  const btnSpan = publishBtn.querySelector("span");
  publishBtn.disabled = true;
  btnSpan.textContent = "Đang đăng tải...";

  try {
    await publishWithNote(); // Use the new function with default note
    btnSpan.textContent = "✅ Đã đăng tải!";

    // Show success toast
    showSuccessToast(
      "🎉 Xuất bản thành công!",
      "Dữ liệu đã được cập nhật và lưu version mới."
    );
  } catch (error) {
    console.error("Lỗi khi đăng tải dữ liệu:", error);
    btnSpan.textContent = "❌ Lỗi!";

    // Show error toast
    showErrorToast("Có lỗi xảy ra khi xuất bản dữ liệu. Vui lòng thử lại!");
  } finally {
    setTimeout(() => {
      btnSpan.textContent = "Xuất Bản ";
      publishBtn.disabled = false;
    }, 2500);
  }
};

function setupRealtimeListener() {
  // Only setup if authenticated
  if (!isAuthenticated) {
    console.log("User not authenticated, skipping realtime listener setup");
    return;
  }

  showLoading(true);

  // Load brand logos first
  loadBrandLogos().then(() => {
    // Document "nháp" để admin xem trước (preview)
    const previewDocRef = db.collection("admin").doc("previewData");

    const unsubscribe = previewDocRef.onSnapshot(
      (docSnap) => {
        if (docSnap.exists) {
          console.log("Dữ liệu Preview thay đổi, đang cập nhật UI...");
          const firestoreData = docSnap.data();
          let resolvedData = firestoreData || {};

          // Hỗ trợ cả dữ liệu nén và không nén
          if (firestoreData && firestoreData.compressedData) {
            const decompressed = decompressData(firestoreData.compressedData);
            if (decompressed) {
              resolvedData = decompressed;
            } else {
              console.warn("Không thể giải nén dữ liệu preview.");
            }
          }

          if (resolvedData.brands) {
            brandsData = resolvedData.brands;

            // Merge persisted logos with brand data
            mergeBrandLogos();

            // Clean up logos for brands that no longer exist
            cleanupOrphanedLogos();

            renderBrandList();

            if (Object.keys(brandsData).length > 0) {
              welcomePlaceholder.classList.add("hidden");
            }

            // Update dashboard stats if on dashboard view
            if (currentView === "dashboard") {
              updateDashboardUI();
            }

            if (currentBrandKey && brandsData[currentBrandKey]) {
              // Brand still exists, refresh the view
              const key = currentBrandKey;
              showBrandDetailView(key);
            } else if (currentBrandKey && !brandsData[currentBrandKey]) {
              // Brand no longer exists, go back to dashboard
              currentBrandKey = null;
              showDashboard();
            } else if (currentView === "dashboard") {
              // Stay on dashboard and update stats
              updateDashboardUI();
            }
          } else {
            console.warn(
              "Dữ liệu từ Firestore (preview) không có trường 'brands'."
            );
            brandsData = {}; // Xóa dữ liệu cũ nếu document mới không hợp lệ
            renderBrandList();
            if (currentView === "dashboard") {
              updateDashboardUI();
            }
          }
        } else {
          console.log("Không tìm thấy document 'admin/previewData'.");
          if (currentView === "dashboard") {
            updateDashboardUI();
          } else {
            mainContent.innerHTML = `<div class="text-yellow-400 text-center p-8">Không tìm thấy dữ liệu Preview. Hãy chắc chắn rằng Apps Script đang đẩy dữ liệu lên document <b>admin/previewData</b>.</div>`;
            welcomePlaceholder.classList.remove("hidden");
          }
        }
        showLoading(false);
      },
      (error) => {
        console.error("Lỗi khi lắng nghe dữ liệu Firestore:", error);
        mainContent.innerHTML = `<div class="text-red-400 text-center p-8">Lỗi kết nối tới Firestore: ${error.message}</div>`;
        showLoading(false);
      }
    );
  });
}

// --- VERSION MANAGEMENT EVENT LISTENERS ---

// Refresh versions button
refreshVersionsBtn?.addEventListener("click", async () => {
  try {
    refreshVersionsBtn.disabled = true;
    versionsList.innerHTML =
      '<div class="text-xs text-slate-400 text-center py-2">Đang tải...</div>';
    await loadVersions();
  } catch (error) {
    console.error("Error refreshing versions:", error);
    versionsList.innerHTML =
      '<div class="text-red-400 text-xs text-center py-2">Lỗi tải phiên bản</div>';
  } finally {
    refreshVersionsBtn.disabled = false;
  }
});

// Version Comparison Event Listeners
const versionASelect = document.getElementById("versionA");
const versionBSelect = document.getElementById("versionB");
const compareVersionsBtn = document.getElementById("compareVersionsBtn");
const viewDiffBtn = document.getElementById("viewDiffBtn");
const exportDiffBtn = document.getElementById("exportDiffBtn");

versionASelect?.addEventListener("change", updateCompareButton);
versionBSelect?.addEventListener("change", updateCompareButton);
compareVersionsBtn?.addEventListener("click", compareVersions);

viewDiffBtn?.addEventListener("click", () => {
  // Show detailed diff in a modal or new section
  showDetailedDiff();
});

exportDiffBtn?.addEventListener("click", () => {
  // Export comparison report
  exportComparisonReport();
});

function showDetailedDiff() {
  const versionAId = document.getElementById("versionA").value;
  const versionBId = document.getElementById("versionB").value;

  if (!versionAId || !versionBId) return;

  const versionA = versionsData.find((v) => v.versionId === versionAId);
  const versionB = versionsData.find((v) => v.versionId === versionBId);

  if (!versionA || !versionB) return;

  // Create detailed diff view
  const diffContent = generateDetailedDiff(versionA, versionB);

  // Show in popup
  showPopup("Chi Tiết So Sánh Phiên Bản", diffContent);
}

function generateDetailedDiff(versionA, versionB) {
  const dataA = versionA.data || {};
  const dataB = versionB.data || {};

  let html = `
    <div class="space-y-4">
      <div class="grid grid-cols-2 gap-4">
        <div class="bg-slate-800 p-4 rounded-lg">
          <h4 class="text-white font-semibold mb-2">Version ${
            versionA.versionId
          }</h4>
          <p class="text-slate-400 text-sm">${
            versionA.note || "Không có ghi chú"
          }</p>
          <p class="text-slate-500 text-xs mt-1">${formatDate(
            versionA.createdAt
          )}</p>
        </div>
        <div class="bg-slate-800 p-4 rounded-lg">
          <h4 class="text-white font-semibold mb-2">Version ${
            versionB.versionId
          }</h4>
          <p class="text-slate-400 text-sm">${
            versionB.note || "Không có ghi chú"
          }</p>
          <p class="text-slate-500 text-xs mt-1">${formatDate(
            versionB.createdAt
          )}</p>
        </div>
      </div>
      
      <div class="bg-slate-700 p-4 rounded-lg">
        <h4 class="text-white font-semibold mb-3">Thay Đổi Chi Tiết</h4>
        <div class="space-y-2 text-sm">
          <div class="flex justify-between">
            <span class="text-slate-400">Tổng thay đổi:</span>
            <span class="text-white font-semibold">${
              calculateVersionDiff(versionA, versionB).total
            }</span>
          </div>
          <div class="flex justify-between">
            <span class="text-green-400">Thêm mới:</span>
            <span class="text-green-400 font-semibold">${
              calculateVersionDiff(versionA, versionB).added
            }</span>
          </div>
          <div class="flex justify-between">
            <span class="text-red-400">Xóa bỏ:</span>
            <span class="text-red-400 font-semibold">${
              calculateVersionDiff(versionA, versionB).removed
            }</span>
          </div>
          <div class="flex justify-between">
            <span class="text-yellow-400">Chỉnh sửa:</span>
            <span class="text-yellow-400 font-semibold">${
              calculateVersionDiff(versionA, versionB).modified
            }</span>
          </div>
        </div>
      </div>
    </div>
  `;

  return html;
}

function exportComparisonReport() {
  const versionAId = document.getElementById("versionA").value;
  const versionBId = document.getElementById("versionB").value;

  if (!versionAId || !versionBId) return;

  const versionA = versionsData.find((v) => v.versionId === versionAId);
  const versionB = versionsData.find((v) => v.versionId === versionBId);

  if (!versionA || !versionB) return;

  const diff = calculateVersionDiff(versionA, versionB);

  const report = {
    comparison: {
      versionA: {
        id: versionA.versionId,
        note: versionA.note,
        createdAt: versionA.createdAt,
      },
      versionB: {
        id: versionB.versionId,
        note: versionB.note,
        createdAt: versionB.createdAt,
      },
    },
    summary: diff,
    timestamp: new Date().toISOString(),
  };

  // Download as JSON file
  const blob = new Blob([JSON.stringify(report, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `version-comparison-${versionAId}-vs-${versionBId}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Publish with Note button
publishWithNoteBtn?.addEventListener("click", () => {
  publishNoteInput.value = "";
  noteCharCount.textContent = "0";
  publishNoteModal.classList.remove("hidden");
  publishNoteInput.focus();
});

// Note input character counter
publishNoteInput?.addEventListener("input", () => {
  const length = publishNoteInput.value.length;
  noteCharCount.textContent = length;
  noteCharCount.style.color =
    length > 80 ? "#f87171" : length > 60 ? "#fbbf24" : "#94a3b8";
});

// Submit on Ctrl+Enter
publishNoteInput?.addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.key === "Enter") {
    e.preventDefault();
    confirmPublishNoteBtn.click();
  }
});

// Rollback modal event listeners
cancelRollbackBtn?.addEventListener("click", () => {
  rollbackModal.classList.add("hidden");
  currentRollbackVersion = null;
});

confirmRollbackBtn?.addEventListener("click", async () => {
  if (!currentRollbackVersion) return;

  try {
    confirmRollbackBtn.disabled = true;
    confirmRollbackBtn.textContent = "Đang rollback...";

    await rollbackToVersion(currentRollbackVersion.versionId);

    // Close modal
    rollbackModal.classList.add("hidden");
    currentRollbackVersion = null;

    // Show success toast
    showSuccessToast(
      "🔄 Rollback thành công!",
      "Dữ liệu đã được khôi phục về phiên bản trước đó."
    );

    // Refresh versions list
    await loadVersions();
  } catch (error) {
    console.error("Error during rollback:", error);
    alert("Lỗi khi rollback: " + error.message);
  } finally {
    confirmRollbackBtn.disabled = false;
    confirmRollbackBtn.textContent = "Xác Nhận Rollback";
  }
});

// Version preview modal event listeners
closeVersionPreviewBtn?.addEventListener("click", () => {
  versionPreviewModal.classList.add("hidden");
});

// Publish Note modal event listeners
cancelPublishNoteBtn?.addEventListener("click", () => {
  publishNoteModal.classList.add("hidden");
});

confirmPublishNoteBtn?.addEventListener("click", async () => {
  try {
    confirmPublishNoteBtn.disabled = true;
    confirmPublishNoteBtn.textContent = "Đang xuất bản...";

    const customNote = publishNoteInput.value.trim();
    await publishWithNote(customNote);

    // Close modal
    publishNoteModal.classList.add("hidden");

    // Show success toast with custom note
    showSuccessToast(
      "🎉 Xuất bản thành công!",
      "Dữ liệu đã được cập nhật và lưu version mới.",
      customNote
    );
  } catch (error) {
    console.error("Error during publish with note:", error);
    showErrorToast("Lỗi khi xuất bản: " + error.message);
  } finally {
    confirmPublishNoteBtn.disabled = false;
    confirmPublishNoteBtn.textContent = "Xuất Bản Ngay";
  }
});

// Close modals when clicking outside
rollbackModal?.addEventListener("click", (e) => {
  if (e.target === rollbackModal) {
    rollbackModal.classList.add("hidden");
    currentRollbackVersion = null;
  }
});

versionPreviewModal?.addEventListener("click", (e) => {
  if (e.target === versionPreviewModal) {
    versionPreviewModal.classList.add("hidden");
  }
});

publishNoteModal?.addEventListener("click", (e) => {
  if (e.target === publishNoteModal) {
    publishNoteModal.classList.add("hidden");
  }
});

// Toast close button event listeners
closeToast?.addEventListener("click", () => {
  hideSuccessToast();
});

closeErrorToast?.addEventListener("click", () => {
  hideErrorToast();
});

// Load versions when authentication is successful
const originalSetupRealtimeListener = setupRealtimeListener;
setupRealtimeListener = function () {
  originalSetupRealtimeListener();
  // Load versions after setting up realtime listener
  setTimeout(() => {
    loadVersions();
  }, 1000);
  // Show dashboard by default
  setTimeout(() => {
    showDashboard();
  }, 1500);
};

// Initialize toasts to hidden state on page load
document.addEventListener("DOMContentLoaded", () => {
  hideAllToasts();
});

// Don't auto-setup realtime listener anymore - it will be called by auth state observer
// setupRealtimeListener();
