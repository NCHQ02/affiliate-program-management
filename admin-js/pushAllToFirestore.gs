/**
 * @OnlyCurrentDoc
 */
const ss = SpreadsheetApp.getActiveSpreadsheet();

/**
 * Đẩy toàn bộ dữ liệu đã xử lý từ Google Sheets lên Firestore.
 * Hàm này sẽ được trigger mỗi khi có chỉnh sửa trong trang tính (sau khi cài đặt trigger).
 */
/**
 * Đẩy toàn bộ dữ liệu đã xử lý từ Google Sheets lên Firestore.
 * Dữ liệu sẽ được NÉN trước khi gửi đi để tránh lỗi giới hạn 1MB.
 */
function pushAllToFirestore() {
  try {
    Logger.log("Bắt đầu pushAllToFirestore...");

    const brandsData = processDataForFirestore();
    Logger.log(
      `Đã xử lý xong dữ liệu. Có ${Object.keys(brandsData).length} brands.`
    );

    if (Object.keys(brandsData).length === 0) {
      Logger.log("CẢNH BÁO: Không có dữ liệu brand nào để đẩy lên.");
      return;
    }

    // --- PHẦN NÉN DỮ LIỆU ---
    Logger.log("Đang nén dữ liệu...");
    const jsonString = JSON.stringify({ brands: brandsData }); // Nén toàn bộ object chứa brands
    // Dòng code đúng để nén GZIP
    const jsonBlob = Utilities.newBlob(
      jsonString,
      "application/json",
      "data.json"
    );
    const compressedBlob = Utilities.gzip(jsonBlob);
    const base64CompressedData = Utilities.base64Encode(
      compressedBlob.getBytes()
    );
    const compressedSize = base64CompressedData.length;
    Logger.log(
      `Nén thành công. Kích thước gốc: ${jsonString.length} bytes, Kích thước sau khi nén: ${compressedSize} bytes.`
    );

    if (compressedSize > 1048576) {
      Logger.log(
        `LỖI: Dữ liệu sau khi nén (${compressedSize} bytes) vẫn vượt quá giới hạn 1MB.`
      );
      return;
    }
    // --- KẾT THÚC PHẦN NÉN ---

    const projectId =
      PropertiesService.getScriptProperties().getProperty("PROJECT_ID");
    const apiKey =
      PropertiesService.getScriptProperties().getProperty("API_KEY");

    if (!projectId || !apiKey) {
      throw new Error(
        "Chưa thiết lập PROJECT_ID hoặc API_KEY trong Script Properties."
      );
    }

    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/admin/previewData?key=${apiKey}`;

    // Tạo body với dữ liệu đã nén
    const body = {
      fields: {
        isCompressed: toFirestoreValue(true),
        compressedData: toFirestoreValue(base64CompressedData),
        lastUpdated: toFirestoreValue(new Date()), // Thêm timestamp để client biết có cập nhật
      },
    };

    Logger.log("Đang gửi dữ liệu ĐÃ NÉN lên Firestore...");
    const response = UrlFetchApp.fetch(url, {
      method: "PATCH",
      contentType: "application/json",
      payload: JSON.stringify(body),
      muteHttpExceptions: true,
    });

    const responseCode = response.getResponseCode();
    const responseBody = response.getContentText();

    if (responseCode >= 200 && responseCode < 300) {
      Logger.log("THÀNH CÔNG! Dữ liệu ĐÃ NÉN đã được cập nhật trên Firestore.");
    } else {
      Logger.log(
        `LỖI khi push dữ liệu. Mã lỗi: ${responseCode}. Phản hồi: ${responseBody}`
      );
    }
  } catch (e) {
    Logger.log(
      "LỖI nghiêm trọng trong pushAllToFirestore: " +
        e.message +
        "\nStack: " +
        e.stack
    );
  }
}

/**
 * Chuyển đổi một giá trị JavaScript sang định dạng đối tượng của Firestore.
 * @param {*} value Giá trị cần chuyển đổi.
 * @return {Object} Đối tượng theo định dạng Firestore.
 */
function toFirestoreValue(value) {
  if (typeof value === "string") {
    return { stringValue: value };
  }
  if (typeof value === "number" && isFinite(value)) {
    if (Number.isInteger(value)) {
      return { integerValue: value.toString() };
    }
    return { doubleValue: value };
  }
  if (typeof value === "boolean") {
    return { booleanValue: value };
  }
  if (value === null || value === undefined) {
    return { nullValue: null };
  }
  if (value instanceof Date) {
    return { timestampValue: value.toISOString() };
  }
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(toFirestoreValue) } };
  }
  if (typeof value === "object") {
    const fields = {};
    for (const key in value) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        fields[key] = toFirestoreValue(value[key]);
      }
    }
    return { mapValue: { fields: fields } };
  }
  return { stringValue: String(value) };
}

/**
 * Chuyển đổi dữ liệu từ một Sheet thành một mảng các đối tượng.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet Sheet cần đọc dữ liệu.
 * @return {Array<Object>} Mảng các đối tượng, mỗi đối tượng là một hàng.
 */
function sheetToObjects(sheet) {
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  const headers = data.shift().map((h) => String(h || "").trim());

  return data
    .filter((row) => row.some((cell) => String(cell || "").trim() !== "")) // Bỏ qua các hàng trống
    .map((row) => {
      const obj = {};
      headers.forEach((header, i) => {
        if (header) obj[header] = row[i];
      });
      return obj;
    });
}

/**
 * Tạo một đối tượng brand mặc định với các cấu trúc dữ liệu cơ bản.
 * @param {string} key Key đã được chuẩn hóa của brand.
 * @param {string} name Tên gốc của brand.
 * @return {Object} Đối tượng brand.
 */
function initBrand(key, name) {
  return {
    key: key,
    name: name,
    calendar: {},
    promotion: [],
    top: [],
    logo: `https://ui-avatars.com/api/?name=${encodeURIComponent(
      name
    )}&background=random&color=fff`,
    bg: "#4338ca",
  };
}

/**
 * Gom và xử lý dữ liệu từ các sheet Calendar, TopSKU, và Promotion cho Firestore.
 * Xử lý động các cột giá, quà tặng, voucher theo "Cụm ngày" trong header.
 * Xử lý sheet Calendar với startDate và endDate.
 * @return {Object} Đối tượng chứa tất cả dữ liệu brands đã được xử lý.
 */
function processDataForFirestore() {
  Logger.log("Bắt đầu xử lý dữ liệu từ các sheet...");

  const normalize = (s) =>
    String(s || "")
      .trim()
      .toLowerCase();
  const normalizeBrand = (s) => normalize(s).replace(/\s+/g, "-");

  const calendarData = sheetToObjects(ss.getSheetByName("Calendar"));
  const topSkuData = sheetToObjects(ss.getSheetByName("TopSKU"));

  let combinedPromotionData = []; // <<< THAY ĐỔI 1: Sử dụng Set để thu thập tất cả các header duy nhất
  const allPromotionHeaders = new Set();
  ss.getSheets().forEach((sheet) => {
    if (sheet.getName().startsWith("Promotion")) {
      const sheetDataRange = sheet.getDataRange();
      if (sheetDataRange.getNumRows() > 1) {
        // Lấy header của sheet hiện tại
        const currentHeaders = sheetDataRange
          .getValues()[0]
          .map((h) => String(h || "").trim()); // Thêm từng header vào Set (tự động loại bỏ trùng lặp)
        currentHeaders.forEach((header) => {
          if (header) allPromotionHeaders.add(header);
        }); // Nối dữ liệu từ sheet này vào mảng chung
        combinedPromotionData = combinedPromotionData.concat(
          sheetToObjects(sheet)
        );
      }
    }
  }); // <<< THAY ĐỔI 2: Chuyển Set thành mảng để xử lý
  const promotionHeaders = Array.from(allPromotionHeaders);
  Logger.log(
    `Tìm thấy ${
      combinedPromotionData.length
    } hàng Promotion với TẤT CẢ headers: ${promotionHeaders.join(", ")}`
  );

  const brands = {};
  const allData = [...calendarData, ...topSkuData, ...combinedPromotionData]; // 1. Gom tất cả các brand duy nhất từ mọi nguồn

  allData.forEach((row) => {
    const brandName = row["Brand"];
    if (brandName) {
      const brandKey = normalizeBrand(brandName);
      if (brandKey && !brands[brandKey]) {
        brands[brandKey] = initBrand(brandKey, String(brandName).trim());
      }
    }
  });
  Logger.log(`Đã khởi tạo ${Object.keys(brands).length} brands duy nhất.`); // 2. Đổ dữ liệu Calendar (đã cập nhật) và TopSKU

  calendarData.forEach((c, index) => {
    const brandKey = normalizeBrand(c.Brand);
    if (brands[brandKey] && c.startDate) {
      const eventKey = `event-${index}`; // Key duy nhất cho mỗi sự kiện
      brands[brandKey].calendar[eventKey] = {
        title: c.Title || "",
        description: c.Description || "",
        link: c.Link || "",
        startDate: c.startDate,
        endDate: c.endDate || c.startDate, // Nếu endDate trống, mặc định bằng startDate
      };
    }
  });

  topSkuData.forEach((t) => {
    const brandKey = normalizeBrand(t.Brand);
    if (brands[brandKey]) {
      brands[brandKey].top.push({
        sku: t.SKU || "",
        image: t.Image || "",
        qty: Number(String(t.qty || "0").replace(/[^0-9]/g, "")) || 0,
      });
    }
  }); // 3. Đổ dữ liệu Promotion với logic động (Phần còn lại giữ nguyên)

  if (promotionHeaders.length > 0) {
    const extractPeriod = (header) => {
      const match = header.match(/\((.*?)\)/);
      // SỬA LỖI: Trim() kết quả để xử lý khoảng trắng dư thừa bên trong dấu ngoặc, giúp việc so sánh đáng tin cậy hơn.
      return match && match[1] ? match[1].trim() : null;
    };

    const priceCols = promotionHeaders.filter((h) =>
      normalize(h).includes("giá bán mới")
    );
    const giftCols = promotionHeaders.filter((h) =>
      normalize(h).includes("quà tặng")
    );
    const voucherCols = promotionHeaders.filter((h) =>
      normalize(h).startsWith("seller voucher")
    );

    const priceToGiftMap = {};
    const priceToVoucherMap = {};

    priceCols.forEach((priceCol) => {
      const pricePeriod = extractPeriod(priceCol);
      if (pricePeriod) {
        const matchingGiftCol = giftCols.find(
          (giftCol) => extractPeriod(giftCol) === pricePeriod
        );
        if (matchingGiftCol) priceToGiftMap[priceCol] = matchingGiftCol;
        const matchingVoucherCol = voucherCols.find(
          (voucherCol) => extractPeriod(voucherCol) === pricePeriod
        );
        if (matchingVoucherCol)
          priceToVoucherMap[priceCol] = matchingVoucherCol;
      }
    });

    const brandHeader = "Brand",
      typeHeader = "Loại sản phẩm",
      nameHeader = "Sản phẩm";
    const platformHeader = "Platform",
      originalHeader = "Giá gốc",
      linkHeader = "Link sp";
    const extraHeader = "THÔNG TIN SẢN PHẨM";

    combinedPromotionData.forEach((row) => {
      const brandKey = normalizeBrand(row[brandHeader]);
      if (!brands[brandKey]) return;

      priceCols.forEach((priceColHeader) => {
        const salePriceValue = row[priceColHeader];
        if (
          salePriceValue !== null &&
          salePriceValue !== undefined &&
          String(salePriceValue).trim() !== ""
        ) {
          const giftColHeader = priceToGiftMap[priceColHeader];
          const voucherColHeader = priceToVoucherMap[priceColHeader];
          brands[brandKey].promotion.push({
            type: row[typeHeader] || "",
            name: row[nameHeader] || "",
            platform: row[platformHeader] || "",
            original:
              Number(
                String(row[originalHeader] || "0").replace(/[^0-9]/g, "")
              ) || null,
            sale:
              Number(String(salePriceValue || "0").replace(/[^0-9]/g, "")) ||
              null,
            gift: giftColHeader ? row[giftColHeader] || "" : "",
            voucher: voucherColHeader ? row[voucherColHeader] || "" : "",
            link: row[linkHeader] || "",
            extra: row[extraHeader] || "",
            period: extractPeriod(priceColHeader) || "",
          });
        }
      });
    });
  }

  Logger.log("Hoàn tất xử lý dữ liệu.");
  return brands;
}

/**
 * Cài đặt trigger `onEdit` để tự động chạy hàm `pushAllToFirestore` khi có chỉnh sửa.
 * ⚠️ CHỈ CHẠY HÀM NÀY MỘT LẦN DUY NHẤT để thiết lập.
 */
function createEditTrigger() {
  // Xóa các trigger cũ có cùng tên hàm để tránh chạy trùng lặp
  const allTriggers = ScriptApp.getProjectTriggers();
  for (const trigger of allTriggers) {
    if (trigger.getHandlerFunction() === "pushAllToFirestore") {
      ScriptApp.deleteTrigger(trigger);
      Logger.log("Đã xóa trigger cũ.");
    }
  } // Tạo installable trigger mới gắn vào file Google Sheets hiện tại

  ScriptApp.newTrigger("pushAllToFirestore")
    .forSpreadsheet(ss)
    .onEdit()
    .create();
  Logger.log(
    "✅ Đã tạo trigger onEdit thành công! Dữ liệu sẽ tự động được đẩy lên Firestore sau mỗi lần chỉnh sửa."
  );
}
