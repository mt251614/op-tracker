const STORAGE_KEY = "open-premium-rate-records";
const TWSE_QUOTE_URL = "https://mis.twse.com.tw/stock/api/getStockInfo.jsp";

const FALLBACK_STOCKS = [
  { code: "1101", name: "台泥", market: "上市" },
  { code: "1216", name: "統一", market: "上市" },
  { code: "1301", name: "台塑", market: "上市" },
  { code: "2002", name: "中鋼", market: "上市" },
  { code: "2303", name: "聯電", market: "上市" },
  { code: "2317", name: "鴻海", market: "上市" },
  { code: "2330", name: "台積電", market: "上市" },
  { code: "2412", name: "中華電", market: "上市" },
  { code: "2454", name: "聯發科", market: "上市" },
  { code: "2603", name: "長榮", market: "上市" },
  { code: "2881", name: "富邦金", market: "上市" },
  { code: "2882", name: "國泰金", market: "上市" },
  { code: "3008", name: "大立光", market: "上市" },
  { code: "3711", name: "日月光投控", market: "上市" },
  { code: "4938", name: "和碩", market: "上市" },
  { code: "5347", name: "世界", market: "上櫃" },
  { code: "5483", name: "中美晶", market: "上櫃" },
  { code: "6187", name: "萬潤", market: "上櫃" },
  { code: "6488", name: "環球晶", market: "上櫃" },
  { code: "8069", name: "元太", market: "上櫃" }
];

const form = document.querySelector("#premium-form");
const stockCodeInput = document.querySelector("#stock-code");
const stockNameInput = document.querySelector("#stock-name");
const marketInput = document.querySelector("#market");
const lookupStockButton = document.querySelector("#lookup-stock");
const lookupMessage = document.querySelector("#lookup-message");
const tradeDateInput = document.querySelector("#trade-date");
const previousCloseInput = document.querySelector("#previous-close");
const todayOpenInput = document.querySelector("#today-open");
const price905Input = document.querySelector("#price-905");
const price910Input = document.querySelector("#price-910");
const noteInput = document.querySelector("#note");
const errorMessage = document.querySelector("#error-message");
const result = document.querySelector("#result");
const saveRecordButton = document.querySelector("#save-record");
const recordsBody = document.querySelector("#records-body");
const emptyRecords = document.querySelector("#empty-records");
const clearRecordsButton = document.querySelector("#clear-records");
const exportCsvButton = document.querySelector("#export-csv");

let currentResult = null;
let records = [];
let stocks = FALLBACK_STOCKS;

async function loadStocks() {
  try {
    const response = await fetch("data/stocks.json", { cache: "no-store" });

    if (!response.ok) {
      throw new Error("stocks json failed");
    }

    const data = await response.json();

    if (Array.isArray(data)) {
      stocks = data;
    }
  } catch (error) {
    stocks = FALLBACK_STOCKS;
  }
}

async function fetchStockQuote(stockCode) {
  const code = stockCode.trim();

  if (code === "") {
    throw new Error("EMPTY_CODE");
  }

  const tseQuote = await fetchQuoteByMarket(code, "tse");

  if (tseQuote) {
    return tseQuote;
  }

  const otcQuote = await fetchQuoteByMarket(code, "otc");

  if (otcQuote) {
    return otcQuote;
  }

  return null;
}

async function fetchQuoteByMarket(stockCode, exchange) {
  const exCh = `${exchange}_${stockCode}.tw`;
  const url = `${TWSE_QUOTE_URL}?ex_ch=${encodeURIComponent(exCh)}&json=1&delay=0&_=${Date.now()}`;
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error("QUOTE_REQUEST_FAILED");
  }

  const data = await response.json();
  const quote = data && Array.isArray(data.msgArray) ? data.msgArray[0] : null;

  if (!quote || quote.c !== stockCode) {
    return null;
  }

  return quote;
}

function normalizeMarket(exchange) {
  if (exchange === "tse") {
    return "上市";
  }

  if (exchange === "otc") {
    return "上櫃";
  }

  return "未找到";
}

function isValidQuotePrice(value) {
  if (value === undefined || value === null) {
    return false;
  }

  const text = String(value).trim();

  if (text === "" || text === "-") {
    return false;
  }

  const price = Number(text);
  return Number.isFinite(price) && price > 0;
}

function lookupLocalStock(showEmptyMessage = true) {
  const code = stockCodeInput.value.trim();

  lookupMessage.textContent = "";

  if (code === "") {
    marketInput.value = "未找到";

    if (showEmptyMessage) {
      lookupMessage.textContent = "請輸入股票代碼";
    }

    return null;
  }

  const stock = stocks.find((item) => item.code === code);

  if (!stock) {
    marketInput.value = "未找到";
    lookupMessage.textContent = "查無此股票代碼，請手動輸入";
    return null;
  }

  stockNameInput.value = stock.name;
  marketInput.value = stock.market;
  lookupMessage.textContent = `已帶入：${stock.name}（${stock.market}）`;
  return stock;
}

async function handleStockQuoteLookup() {
  const code = stockCodeInput.value.trim();

  clearError();
  lookupMessage.textContent = "";

  if (code === "") {
    lookupMessage.textContent = "請輸入股票代碼";
    return;
  }

  lookupStockButton.disabled = true;
  lookupStockButton.textContent = "查詢中";

  try {
    const quote = await fetchStockQuote(code);

    if (!quote) {
      lookupLocalStock(false);
      lookupMessage.textContent = "查無資料，請手動輸入昨日收盤價與今日開盤價";
      return;
    }

    stockNameInput.value = quote.n || stockNameInput.value;
    marketInput.value = normalizeMarket(quote.ex);

    if (isValidQuotePrice(quote.y)) {
      previousCloseInput.value = quote.y;
    }

    if (isValidQuotePrice(quote.o)) {
      todayOpenInput.value = quote.o;
    }

    if (!isValidQuotePrice(quote.y)) {
      lookupMessage.textContent = "昨日收盤價無效，請手動輸入";
      return;
    }

    if (!isValidQuotePrice(quote.o)) {
      lookupMessage.textContent = "今日開盤價不存在或尚未開盤，請手動輸入";
      return;
    }

    lookupMessage.textContent = `已帶入：${quote.n}（${marketInput.value}），並完成計算`;
    calculateAndRender();
  } catch (error) {
    lookupLocalStock(false);
    lookupMessage.textContent = "自動查詢失敗，請手動輸入";
  } finally {
    lookupStockButton.disabled = false;
    lookupStockButton.textContent = "查詢股票";
  }
}

function getStrengthRate(rate) {
  if (rate < 0) {
    return {
      label: "負溢價，直接撤離",
      message: "開盤弱於昨日收盤價，不列入觀察，不進場。"
    };
  }

  if (rate === 0) {
    return {
      label: "平盤開出",
      message: "沒有明顯強勢，不列入主要觀察。"
    };
  }

  if (rate < 3) {
    return {
      label: "小幅開高",
      message: "強度不足，暫不列入主要觀察。"
    };
  }

  if (rate <= 5) {
    return {
      label: "強勢開盤",
      message: "主要觀察區，若放量且站穩開盤價，可列為偏多觀察。"
    };
  }

  if (rate <= 7) {
    return {
      label: "強勢偏熱",
      message: "開盤很強，但追高風險增加，需觀察是否站穩開盤價。"
    };
  }

  return {
    label: "過熱開盤",
    message: "溢價過高，不建議追高，觀察是否開高走低。"
  };
}

function getHoldOpenStatus(openPrice, price905, price910) {
  if (price905 === null || price910 === null) {
    return {
      label: "尚未判斷",
      action: "等待站穩判斷",
      isStable: null
    };
  }

  if (price905 >= openPrice && price910 >= openPrice) {
    return {
      label: "站穩開盤價",
      action: "可繼續觀察",
      isStable: true
    };
  }

  if (price905 < openPrice && price910 < openPrice) {
    return {
      label: "沒站穩開盤價",
      action: "取消觀察，可能開高走低",
      isStable: false
    };
  }

  if (price905 < openPrice && price910 >= openPrice) {
    return {
      label: "轉強觀察",
      action: "可觀察，但不要急追",
      isStable: true
    };
  }

  return {
    label: "轉弱",
    action: "小心開高走低",
    isStable: false
  };
}

function getIntegratedAction(rate, holdStatus) {
  if (rate < 0) {
    return "直接撤離";
  }

  if (rate === 0) {
    return "不觀察";
  }

  if (rate < 3) {
    return "觀望";
  }

  if (rate <= 5) {
    return holdStatus.isStable === false ? "取消觀察" : "主要觀察";
  }

  if (rate <= 7) {
    return holdStatus.isStable === false ? "不追高" : "謹慎觀察";
  }

  return "不追高";
}

function parseRequiredPrice(value) {
  const trimmedValue = value.trim();

  if (trimmedValue === "") {
    return { error: "empty" };
  }

  return parseNumberPrice(trimmedValue);
}

function parseOptionalPrice(value) {
  const trimmedValue = value.trim();

  if (trimmedValue === "") {
    return { value: null };
  }

  return parseNumberPrice(trimmedValue);
}

function parseNumberPrice(value) {
  const price = Number(value);

  if (!Number.isFinite(price)) {
    return { error: "notNumber" };
  }

  if (price < 0) {
    return { error: "negative" };
  }

  return { value: price };
}

function loadRecords() {
  try {
    const storedRecords = localStorage.getItem(STORAGE_KEY);
    return storedRecords ? JSON.parse(storedRecords) : [];
  } catch (error) {
    return [];
  }
}

function saveRecords(nextRecords = records) {
  records = nextRecords;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function syncRecordsFromStorage() {
  records = loadRecords();
}

function setError(message) {
  errorMessage.textContent = message;
  currentResult = null;
  saveRecordButton.disabled = true;
  result.innerHTML = '<p class="empty-result">請修正輸入內容後再計算。</p>';
}

function clearError() {
  errorMessage.textContent = "";
}

function getFormData() {
  return {
    stockCode: stockCodeInput.value.trim(),
    stockName: stockNameInput.value.trim(),
    market: marketInput.value.trim() || "未找到",
    tradeDate: tradeDateInput.value,
    previousCloseText: previousCloseInput.value,
    todayOpenText: todayOpenInput.value,
    price905Text: price905Input.value,
    price910Text: price910Input.value,
    note: noteInput.value.trim()
  };
}

function calculatePremium(formData) {
  const previousClose = parseRequiredPrice(formData.previousCloseText);
  const todayOpen = parseRequiredPrice(formData.todayOpenText);
  const price905 = parseOptionalPrice(formData.price905Text);
  const price910 = parseOptionalPrice(formData.price910Text);

  if (previousClose.error === "empty") {
    return { error: "昨日收盤價不可為空。" };
  }

  if (todayOpen.error === "empty") {
    return { error: "今日開盤價不可為空。" };
  }

  if (previousClose.error === "notNumber" || todayOpen.error === "notNumber" || price905.error === "notNumber" || price910.error === "notNumber") {
    return { error: "價格輸入內容必須是數字。" };
  }

  if (previousClose.error === "negative" || todayOpen.error === "negative" || price905.error === "negative" || price910.error === "negative") {
    return { error: "價格不可為負數。" };
  }

  if (previousClose.value === 0) {
    return { error: "昨日收盤價不可為 0。" };
  }

  const rate = ((todayOpen.value - previousClose.value) / previousClose.value) * 100;
  const strength = getStrengthRate(rate);
  const holdStatus = rate < 0
    ? { label: "不需判斷", action: "負溢價直接撤離", isStable: null }
    : getHoldOpenStatus(todayOpen.value, price905.value, price910.value);
  const action = getIntegratedAction(rate, holdStatus);

  return {
    value: {
      id: createRecordId(),
      stockCode: formData.stockCode,
      stockName: formData.stockName,
      market: formData.market,
      tradeDate: formData.tradeDate,
      previousClose: previousClose.value,
      todayOpen: todayOpen.value,
      price905: price905.value,
      price910: price910.value,
      note: formData.note,
      rate,
      rateText: `${rate.toFixed(2)}%`,
      strengthLabel: strength.label,
      strengthMessage: strength.message,
      holdLabel: holdStatus.label,
      holdAction: holdStatus.action,
      action,
      createdAt: new Date().toISOString()
    }
  };
}

function calculateAndRender() {
  clearError();
  const calculation = calculatePremium(getFormData());

  if (calculation.error) {
    setError(calculation.error);
    return false;
  }

  currentResult = calculation.value;
  saveRecordButton.disabled = false;
  renderResult(currentResult);
  return true;
}

function renderResult(record) {
  result.innerHTML = `
    <div class="result-item">
      <span>開盤溢價率</span>
      <strong>${escapeHtml(record.rateText)}</strong>
    </div>
    <div class="result-item">
      <span>強弱判斷</span>
      <strong>${escapeHtml(record.strengthLabel)}</strong>
    </div>
    <div class="result-item">
      <span>站穩判斷</span>
      <strong>${escapeHtml(record.holdLabel)}</strong>
    </div>
    <div class="result-item">
      <span>操作建議</span>
      <strong>${escapeHtml(record.action)}</strong>
    </div>
    <div class="result-item result-message">
      <span>風險提醒</span>
      <strong>${escapeHtml(getRiskMessage(record))}</strong>
    </div>
  `;
}

function getRiskMessage(record) {
  if (record.holdLabel === "尚未判斷" || record.holdLabel === "不需判斷") {
    return record.strengthMessage;
  }

  return `${record.strengthMessage} 站穩判斷：${record.holdAction}`;
}

function renderRecords() {
  recordsBody.innerHTML = "";

  records.forEach((record) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td data-label="建立時間">${escapeHtml(formatDateTime(record.createdAt))}</td>
      <td data-label="日期">${escapeHtml(record.tradeDate || "-")}</td>
      <td data-label="代碼">${escapeHtml(record.stockCode || "-")}</td>
      <td data-label="名稱">${escapeHtml(record.stockName || "-")}</td>
      <td data-label="市場別">${escapeHtml(record.market || "未找到")}</td>
      <td data-label="昨日收盤">${formatPrice(record.previousClose)}</td>
      <td data-label="今日開盤">${formatPrice(record.todayOpen)}</td>
      <td data-label="9:05">${formatPrice(record.price905)}</td>
      <td data-label="9:10">${formatPrice(record.price910)}</td>
      <td data-label="溢價率">${escapeHtml(record.rateText)}</td>
      <td data-label="強弱判斷">${escapeHtml(record.strengthLabel)}</td>
      <td data-label="站穩判斷">${escapeHtml(record.holdLabel || "-")}</td>
      <td data-label="操作建議">${escapeHtml(record.action)}</td>
      <td data-label="提醒">${escapeHtml(getRiskMessage(record))}</td>
      <td data-label="備註">${escapeHtml(record.note || "-")}</td>
      <td data-label="操作"><button type="button" class="delete-record" data-id="${escapeHtml(record.id)}">刪除</button></td>
    `;
    recordsBody.appendChild(row);
  });

  const hasRecords = records.length > 0;
  emptyRecords.hidden = hasRecords;
  clearRecordsButton.disabled = !hasRecords;
  exportCsvButton.disabled = !hasRecords;
}

function formatPrice(value) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  return Number(value).toLocaleString("zh-TW", {
    maximumFractionDigits: 4
  });
}

function formatDateTime(value) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("zh-TW", {
    hour12: false
  });
}

function createRecordId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function downloadCsv() {
  if (records.length === 0) {
    return;
  }

  const headers = ["建立時間", "日期", "股票代碼", "股票名稱", "市場別", "昨日收盤價", "今日開盤價", "開盤溢價率", "強弱判斷", "操作建議", "9:05價格", "9:10價格", "站穩判斷", "風險提醒", "備註"];
  const rows = records.map((record) => [
    formatDateTime(record.createdAt),
    record.tradeDate,
    record.stockCode,
    record.stockName,
    record.market || "未找到",
    record.previousClose,
    record.todayOpen,
    record.rateText,
    record.strengthLabel,
    record.action,
    record.price905 ?? "",
    record.price910 ?? "",
    record.holdLabel,
    getRiskMessage(record),
    record.note
  ]);

  const csvContent = [headers, ...rows]
    .map((row) => row.map(toCsvCell).join(","))
    .join("\r\n");
  const blob = new Blob([`\uFEFF${csvContent}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "開盤溢價率紀錄.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function toCsvCell(value) {
  const text = value === undefined || value === null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

lookupStockButton.addEventListener("click", handleStockQuoteLookup);

stockCodeInput.addEventListener("blur", () => {
  lookupLocalStock(false);
});

stockCodeInput.addEventListener("input", () => {
  marketInput.value = "未找到";
  lookupMessage.textContent = "";
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  calculateAndRender();
});

saveRecordButton.addEventListener("click", () => {
  if (!currentResult) {
    setError("請先完成計算後再儲存紀錄。");
    return;
  }

  saveRecords([currentResult, ...records]);
  renderRecords();
  saveRecordButton.disabled = true;
});

recordsBody.addEventListener("click", (event) => {
  const deleteButton = event.target.closest(".delete-record");

  if (!deleteButton) {
    return;
  }

  saveRecords(records.filter((record) => record.id !== deleteButton.dataset.id));
  renderRecords();
});

clearRecordsButton.addEventListener("click", () => {
  if (records.length === 0) {
    return;
  }

  if (!confirm("確定要清空全部紀錄嗎？")) {
    return;
  }

  saveRecords([]);
  renderRecords();
});

exportCsvButton.addEventListener("click", downloadCsv);

async function init() {
  syncRecordsFromStorage();
  renderRecords();
  await loadStocks();
}

init();
