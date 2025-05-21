// 全域變數
let allCrossBorderData = [];
let uniqueYears = [];
let uniqueMonths = [];
let uniqueRegionCodeToName = {};

let overviewTrendsChartInstance = null;
let consumptionUpgradeChartInstance = null;
let crossBorderRatioChartInstance = null;
let avgCbSpendingPerCardChartInstance = null;

const CSV_FIELD_MAPPING = {
    '年月': 'yearMonth',
    '地區': 'regionCode',
    '卡數': 'cardCount',
    '總交易筆數': 'totalTransactions',
    '總交易金額[新臺幣]': 'totalAmountNTD',
    '跨境交易筆數': 'crossBorderTransactions',
    '跨境交易金額[新臺幣]': 'crossBorderAmountNTD'
};

// --- Firebase 初始化與設定 ---
const firebaseConfig = {
  apiKey: "AIzaSyDOFPzUrQLtKozPPZAHjRwmImo-Li8G_8M",
  authDomain: "credit-card-8e6da.firebaseapp.com",
  databaseURL: "https://credit-card-8e6da-default-rtdb.firebaseio.com",
  projectId: "credit-card-8e6da",
  storageBucket: "credit-card-8e6da.appspot.com",
  messagingSenderId: "635105427017",
  appId: "1:635105427017:web:afd8b704aaa13f604e0998",
  measurementId: "G-BHY84TRB59"
};

if (typeof firebase !== 'undefined' && !firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
} else if (typeof firebase !== 'undefined' && firebase.apps.length) {
    firebase.app();
} else {
    console.error("Firebase SDK not loaded!");
}
const auth = typeof firebase !== 'undefined' ? firebase.auth() : null;

// --- DOMContentLoaded 事件 ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM 已載入 (Layout Final v13)，開始初始化應用程式...");
    if (auth) {
        initializeAuthUI();
    } else {
        console.error("Firebase Auth 未成功初始化，登入及驗證功能將無法使用。");
        const authContainer = document.getElementById('auth-container');
        if (authContainer) authContainer.innerHTML = '<p class="text-danger small">Firebase 初始化失敗</p>';
        updateAuthUI(null);
    }
    showLoadingIndicator(true, "正在載入數據...");
    loadCSVDataAndInitialize();
    initializeHeroLinks();
});

// --- Hero Section 連結平滑滾動 ---
function initializeHeroLinks() {
    const heroLinks = document.querySelectorAll('#hero .icon-box a');
    heroLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href'); // e.g., "#trendsChartSection"
            const targetElement = document.querySelector(targetId); // Use querySelector for ID
            
            if (targetElement) {
                const header = document.getElementById('header');
                const headerHeight = header ? header.offsetHeight : 0;
                const elementPosition = targetElement.getBoundingClientRect().top;
                // Calculate the scroll position, considering the fixed header and a small offset
                const offsetPosition = elementPosition + window.pageYOffset - headerHeight - 20; // 20px additional offset

                window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth'
                });

                // Optional: If using AOS, refresh it after scroll to ensure animations trigger correctly
                if (typeof AOS !== 'undefined') {
                    setTimeout(() => {
                        AOS.refresh(); // General refresh might be enough
                        // For more targeted refresh if needed:
                        // const aosElementsInTarget = targetElement.querySelectorAll('[data-aos]');
                        // aosElementsInTarget.forEach(el => {
                        //     el.classList.remove('aos-animate');
                        //     void el.offsetWidth; // Force reflow
                        //     el.classList.add('aos-animate');
                        // });
                    }, 400); // Adjust delay as needed for smooth scroll to complete
                }
            } else {
                console.warn("Hero link target not found: ", targetId);
            }
        });
    });
}


// --- 認證相關函數 ---
function initializeAuthUI() {
    const authActionButton = document.getElementById('auth-action-button');
    const signOutButton = document.getElementById('sign-out-button');
    const emailSigninButton = document.getElementById('email-signin-button');
    const emailSignupButton = document.getElementById('email-signup-button');
    const sendVerificationEmailButton = document.getElementById('send-verification-email-button');

    if (authActionButton) {
        authActionButton.addEventListener('click', () => {
            const overlay = document.getElementById('restricted-content-overlay');
            const authForm = document.getElementById('auth-form-container');
            const verifyForm = document.getElementById('verify-email-prompt-content');
            if (overlay) overlay.style.display = 'flex';
            if (authForm) authForm.style.display = 'block';
            if (verifyForm) verifyForm.style.display = 'none';
            document.getElementById('restricted-content-wrapper')?.classList.add('blurred');
            const authErrorMessage = document.getElementById('auth-error-message');
            if (authErrorMessage) authErrorMessage.textContent = '';
        });
    }
    if (signOutButton) signOutButton.addEventListener('click', handleSignOut);
    if (emailSigninButton) emailSigninButton.addEventListener('click', handleEmailPasswordSignIn);
    if (emailSignupButton) emailSignupButton.addEventListener('click', handleEmailPasswordSignUp);
    if (sendVerificationEmailButton) sendVerificationEmailButton.addEventListener('click', handleSendVerificationEmail);

    auth.onAuthStateChanged(user => {
        updateAuthUI(user);
        if (user && user.emailVerified) {
            console.log("使用者已登入且 Email 已驗證:", user.displayName || user.email);
            if (allCrossBorderData.length > 0) {
                updatePotentialStarsAnalysis();
            }
        } else if (user && !user.emailVerified) {
            console.log("使用者已登入但 Email 未驗證:", user.displayName || user.email);
            clearRestrictedContentOnAuthChange();
        } else {
            console.log("使用者已登出");
            clearRestrictedContentOnAuthChange();
        }
    });
}

async function handleEmailPasswordSignUp() {
    if (!auth) { alert("Firebase 登入服務未就緒。"); return; }
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    const authErrorMessage = document.getElementById('auth-error-message');

    if (!email || !password) {
        if (authErrorMessage) authErrorMessage.textContent = "電子郵件和密碼不能為空。";
        return;
    }
    if (password.length < 6) {
        if (authErrorMessage) authErrorMessage.textContent = "密碼長度至少需要6位。";
        return;
    }
    if (authErrorMessage) authErrorMessage.textContent = "";

    showLoadingIndicator(true, "正在註冊...");
    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        console.log("註冊成功:", userCredential.user);
        if (userCredential.user && !userCredential.user.emailVerified) {
            await handleSendVerificationEmail(true);
        }
    } catch (error) {
        console.error("註冊失敗:", error);
        if (authErrorMessage) authErrorMessage.textContent = `註冊失敗: ${mapFirebaseErrorToMessage(error)}`;
    } finally {
        showLoadingIndicator(false);
    }
}

async function handleEmailPasswordSignIn() {
    if (!auth) { alert("Firebase 登入服務未就緒。"); return; }
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    const authErrorMessage = document.getElementById('auth-error-message');

    if (!email || !password) {
        if (authErrorMessage) authErrorMessage.textContent = "電子郵件和密碼不能為空。";
        return;
    }
    if (authErrorMessage) authErrorMessage.textContent = "";

    showLoadingIndicator(true, "正在登入...");
    try {
        await auth.signInWithEmailAndPassword(email, password);
    } catch (error) {
        console.error("登入失敗:", error);
        if (authErrorMessage) authErrorMessage.textContent = `登入失敗: ${mapFirebaseErrorToMessage(error)}`;
    } finally {
        showLoadingIndicator(false);
    }
}


async function handleSignOut() {
    if (!auth) return;
    try {
        showLoadingIndicator(true, "正在登出...");
        await auth.signOut();
    } catch (error) {
        console.error("登出失敗:", error);
        alert(`登出失敗: ${error.message}`);
    } finally {
        showLoadingIndicator(false);
    }
}

async function handleSendVerificationEmail(isAfterSignUp = false) {
    const user = auth.currentUser;
    const sentMessageEl = document.getElementById('verification-email-sent-message');
    if (sentMessageEl) {
        sentMessageEl.textContent = '';
        sentMessageEl.style.display = 'none';
    }

    if (user && !user.emailVerified) {
        showLoadingIndicator(true, "正在寄送驗證郵件...");
        try {
            await user.sendEmailVerification();
            if(sentMessageEl) {
                sentMessageEl.textContent = `驗證郵件已成功寄至 ${user.email}！請檢查您的收件匣。`;
                sentMessageEl.style.display = 'block';
                sentMessageEl.classList.remove('text-danger');
                sentMessageEl.classList.add('text-success');
            }
            if (!isAfterSignUp) {
                alert(`驗證郵件已成功寄至 ${user.email}！請檢查您的收件匣 (包含垃圾郵件)。點擊信中連結完成驗證後，可能需要重新整理頁面或重新登入。`);
            }
        } catch (error) {
            console.error("寄送驗證郵件失敗:", error);
            if(sentMessageEl) {
                sentMessageEl.textContent = `寄送驗證郵件失敗: ${mapFirebaseErrorToMessage(error)}`;
                sentMessageEl.style.display = 'block';
                sentMessageEl.classList.remove('text-success');
                sentMessageEl.classList.add('text-danger');
            }
            if (!isAfterSignUp) {
                alert(`寄送驗證郵件失敗: ${mapFirebaseErrorToMessage(error)}`);
            }
        } finally {
            showLoadingIndicator(false);
        }
    } else if (!isAfterSignUp) {
        alert("使用者未登入或電子郵件已驗證。");
    }
}

function mapFirebaseErrorToMessage(error) {
    switch (error.code) {
        case 'auth/invalid-email': return '電子郵件格式不正確。';
        case 'auth/user-disabled': return '此帳號已被停用。';
        case 'auth/user-not-found': return '找不到此電子郵件對應的帳號。';
        case 'auth/wrong-password': return '密碼錯誤。';
        case 'auth/email-already-in-use': return '此電子郵件已被註冊。';
        case 'auth/weak-password': return '密碼強度不足，請設定更複雜的密碼。';
        case 'auth/network-request-failed': return '網路連線錯誤，請檢查您的網路。';
        default: return error.message;
    }
}

function updateAuthUI(user) {
    const authActionButton = document.getElementById('auth-action-button');
    const userStatusContainer = document.getElementById('user-status');
    const userNameEl = document.getElementById('user-name');
    const userPhotoEl = document.getElementById('user-photo');

    const restrictedContentWrapper = document.getElementById('restricted-content-wrapper');
    const restrictedContentOverlay = document.getElementById('restricted-content-overlay');
    const authFormContainer = document.getElementById('auth-form-container');
    const verifyEmailPromptContent = document.getElementById('verify-email-prompt-content');
    const verificationEmailSentMessage = document.getElementById('verification-email-sent-message');
    const authErrorMessage = document.getElementById('auth-error-message');

    if (!authActionButton || !userStatusContainer || !userNameEl || !userPhotoEl ||
        !restrictedContentWrapper || !restrictedContentOverlay || !authFormContainer || !verifyEmailPromptContent) {
        return;
    }
    if (verificationEmailSentMessage) verificationEmailSentMessage.style.display = 'none';
    if (authErrorMessage) authErrorMessage.textContent = '';

    if (user) {
        authActionButton.style.display = 'none';
        userStatusContainer.style.display = 'flex';
        userNameEl.textContent = user.displayName || user.email.split('@')[0];
        userPhotoEl.src = user.photoURL || 'assets/img/default-avatar.png';

        if (user.emailVerified) {
            restrictedContentWrapper.classList.remove('blurred');
            restrictedContentOverlay.style.display = 'none';
            authFormContainer.style.display = 'none';
            verifyEmailPromptContent.style.display = 'none';
        } else {
            restrictedContentWrapper.classList.add('blurred');
            restrictedContentOverlay.style.display = 'flex';
            authFormContainer.style.display = 'none';
            verifyEmailPromptContent.style.display = 'block';
        }
    } else { // User is not logged in
        authActionButton.style.display = 'block';
        userStatusContainer.style.display = 'none';
        userNameEl.textContent = '';
        userPhotoEl.src = '';

        restrictedContentWrapper.classList.add('blurred');
        restrictedContentOverlay.style.display = 'flex'; // Show overlay by default if not logged in
        authFormContainer.style.display = 'block';    // Show login/signup form in overlay
        verifyEmailPromptContent.style.display = 'none';
    }
}

function clearRestrictedContentOnAuthChange() {
    if (consumptionUpgradeChartInstance) {
        consumptionUpgradeChartInstance.destroy();
        consumptionUpgradeChartInstance = null;
    }
    const focusContainer = document.getElementById('potentialFocus');
    if (focusContainer) focusContainer.innerHTML = '';
}


// --- 數據載入與處理 ---
function showLoadingIndicator(show, message = "載入中...") {
    const indicator = document.getElementById('loadingIndicator');
    if (indicator) {
        indicator.style.display = show ? 'flex' : 'none';
        const messageSpan = indicator.querySelector('span:not(.visually-hidden)');
        if (messageSpan) messageSpan.textContent = message;
    }
}

async function loadCSVDataAndInitialize() {
    const csvFilePath = 'be7f3ef5e6058d56af3e8173738e4ae1_export.csv';
    try {
        const csvResponse = await fetch(csvFilePath);
        if (!csvResponse.ok) {
            if (csvResponse.status === 404) {
                 throw new Error(`無法找到 CSV 檔案 (404 Not Found)。請確認檔案 "${csvFilePath}" 是否與 HTML 檔案在同一目錄下，且檔案名稱完全正確。`);
            }
            throw new Error(`無法獲取 CSV 檔案，HTTP 狀態: ${csvResponse.status}. 請確認檔案路徑正確，並透過本地伺服器運行。`);
        }
        const csvText = await csvResponse.text();
        console.log("CSV 檔案已成功獲取。");
        showLoadingIndicator(true, "正在解析 CSV 數據...");

        Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: false,
            complete: function(results) {
                if (results.errors.length > 0) {
                    console.error("CSV 解析錯誤:", results.errors);
                    showLoadingIndicator(false);
                    displayFetchError("CSV 檔案內容解析失敗。請檢查檔案格式。", "", results.errors.map(e => e.message).join('; '));
                    return;
                }
                console.log("CSV 解析完成，開始處理數據...");
                showLoadingIndicator(true, "正在處理數據...");
                processRawData(results.data);

                console.log("數據處理完成，開始初始化網站核心元件...");
                showLoadingIndicator(true, "正在初始化網站核心元件...");
                initializeCoreWebsiteComponents();
                showLoadingIndicator(false);
            },
            error: function(error) {
                console.error("PapaParse 解析 CSV 時發生嚴重錯誤:", error);
                showLoadingIndicator(false);
                displayFetchError("PapaParse 解析 CSV 時發生嚴重錯誤。", error.message);
            }
        });
    } catch (error) {
        console.error('載入或處理 CSV 檔案失敗:', error);
        showLoadingIndicator(false);
        displayFetchError(
            `無法載入必要的數據檔案 (${csvFilePath})。`,
            error.message.includes("Failed to fetch") || error.message.includes("404") ?
            `這通常是因為：<br>1. 檔案不存在於預期路徑，或檔名錯誤。<br>2. 您直接用 <code>file:///</code> 方式打開 HTML 檔案 (瀏覽器會因安全限制而阻止)。<br>請務必透過<strong class="text-danger">本地 HTTP 伺服器</strong>來瀏覽此頁面 (例如 VS Code 的 "Live Server" 或 Python 的 <code>python -m http.server</code>)。` :
            `請檢查檔案是否存在於與 HTML 檔案相同的目錄下，以及您的網路連線。`,
            error.message
        );
    }
}

function displayFetchError(mainMessage, detailMessage, rawErrorMessage = "") {
    const mainContent = document.querySelector('.main');
    if(mainContent) {
        let errorContainer = document.getElementById('fetchErrorContainer');
        if (!errorContainer) {
            mainContent.innerHTML = ''; // Clear main content to show only the error
            errorContainer = document.createElement('div');
            errorContainer.id = 'fetchErrorContainer';
            // Use a more prominent error display within a section
            errorContainer.innerHTML = `
                <section class="section section-padding">
                    <div class="container">
                        <div class="fetch-error-container alert alert-danger">
                            <h2 class="alert-heading"><i class="bi bi-exclamation-triangle-fill me-2"></i>數據檔案載入錯誤</h2>
                            <p id="fetchErrorMainMessage" class="mb-1">${mainMessage}</p>
                            <div id="fetchErrorDetailMessage" class="mb-2">${detailMessage}</div>
                            <div id="fetchErrorRawMessage" class="mt-3 small"><small>詳細技術訊息: ${rawErrorMessage}</small></div>
                            <hr>
                            <p class="mb-1"><strong>請嘗試以下解決方案：</strong></p>
                            <ol class="small">
                                <li>確認 CSV 檔案 <code>be7f3ef5e6058d56af3e8173738e4ae1_export.csv</code> 與 <code>index.html</code> 在同一個資料夾。</li>
                                <li>確認 CSV 檔案名稱完全正確，沒有打錯字或多餘空格。</li>
                                <li><strong>如果您是直接點開 HTML 檔案，請改用本地伺服器開啟 (非常重要！)。</strong>
                                    <ul>
                                        <li>VS Code: 安裝 "Live Server" 擴充功能，右鍵點擊 <code>index.html</code> -> "Open with Live Server"。</li>
                                        <li>Python: 在包含檔案的資料夾中打開終端機，執行 <code>python -m http.server</code>，然後瀏覽 <code>http://localhost:8000</code>。</li>
                                    </ul>
                                </li>
                                <li>檢查瀏覽器開發者工具 (F12) 的 Console 和 Network 分頁是否有更詳細的錯誤線索。</li>
                            </ol>
                        </div>
                    </div>
                </section>`;
            mainContent.appendChild(errorContainer);
        } else {
            // If error container already exists, just update messages
             document.getElementById('fetchErrorMainMessage').innerHTML = `<p class="lead">${mainMessage}</p>`;
             document.getElementById('fetchErrorDetailMessage').innerHTML = detailMessage ? `<p>${detailMessage}</p>` : '';
             document.getElementById('fetchErrorRawMessage').innerHTML = rawErrorMessage ? `<small>詳細錯誤訊息: ${rawErrorMessage}</small>` : '';
        }
    }
    // No alert here, as the error is displayed on the page
}


function processRawData(rawData) {
    const tempYears = new Set();
    const tempMonths = new Set();
    const tempRegionCodes = new Set();
    uniqueRegionCodeToName = {};

    allCrossBorderData = rawData.map(row => {
        const newRow = {};
        let hasEssentialData = true;

        const yearMonthOriginalHeader = Object.keys(CSV_FIELD_MAPPING).find(key => CSV_FIELD_MAPPING[key] === 'yearMonth');
        const yearMonthStr = row[yearMonthOriginalHeader];

        if (yearMonthStr && typeof yearMonthStr === 'string' && yearMonthStr.length === 6) {
            newRow.year = parseInt(yearMonthStr.substring(0, 4), 10);
            newRow.month = parseInt(yearMonthStr.substring(4, 6), 10);
            if (isNaN(newRow.year) || isNaN(newRow.month) || newRow.month < 1 || newRow.month > 12) {
                hasEssentialData = false;
            }
        } else {
            hasEssentialData = false;
        }

        for (const chineseHeader in CSV_FIELD_MAPPING) {
            const englishKey = CSV_FIELD_MAPPING[chineseHeader];
            if (englishKey === 'yearMonth') continue;

            const originalValue = row[chineseHeader];
            if (originalValue !== undefined && originalValue !== null && (typeof originalValue === 'string' ? originalValue.trim() !== '' : true) ) {
                if (['cardCount', 'totalTransactions', 'totalAmountNTD', 'crossBorderTransactions', 'crossBorderAmountNTD'].includes(englishKey)) {
                    const parsedNum = parseInt(originalValue, 10);
                    newRow[englishKey] = isNaN(parsedNum) ? 0 : parsedNum;
                } else if (englishKey === 'regionCode') {
                    const code = typeof originalValue === 'string' ? originalValue.trim() : String(originalValue);
                    newRow[englishKey] = code;
                    if (!code) {
                        hasEssentialData = false;
                    } else {
                        tempRegionCodes.add(code);
                    }
                }
            } else {
                if (englishKey === 'regionCode') {
                    newRow[englishKey] = 'UNKNOWN_CODE'; hasEssentialData = false;
                } else {
                    newRow[englishKey] = 0;
                }
            }
        }

        if (!hasEssentialData) return null;

        if (newRow.year) tempYears.add(newRow.year);
        if (newRow.month) tempMonths.add(newRow.month);
        return newRow;
    }).filter(row => row !== null);

    uniqueYears = Array.from(tempYears).sort((a, b) => a - b);
    uniqueMonths = Array.from(tempMonths).sort((a, b) => a - b);

    tempRegionCodes.forEach(code => {
        if (!uniqueRegionCodeToName[code]) {
            uniqueRegionCodeToName[code] = getRegionNameFromCode(code);
        }
    });
}

function getRegionNameFromCode(code) {
    const regionMap = {
        "63000000": "臺北市", "65000000": "新北市", "68000000": "桃園市",
        "66000000": "臺中市", "67000000": "臺南市", "64000000": "高雄市",
        "10002000": "宜蘭縣", "10004000": "新竹縣", "10005000": "苗栗縣",
        "10007000": "彰化縣", "10008000": "南投縣", "10009000": "雲林縣",
        "10010000": "嘉義縣", "10013000": "屏東縣", "10014000": "臺東縣",
        "10015000": "花蓮縣", "10016000": "澎湖縣", "10017000": "基隆市",
        "10020000": "新竹市", "10006000": "嘉義市",
        "10018000": "金門縣", "09020000": "金門縣",
        "10003000": "連江縣", "09007000": "連江縣",
        "ZZZZZZZZ": "其他地區"
    };
    return regionMap[code] || `地區 ${code}`;
}

function initializeCoreWebsiteComponents() {
    populateAllFilters();
    attachAllEventListeners();
    updateDashboardOverview();
    updateAdvancedAnalysisCharts();
    
    const currentUser = auth ? auth.currentUser : null;
    const potentialData = calculatePotentialDataForAllRegions();
    renderPotentialStarsTable(potentialData);

    if (currentUser && currentUser.emailVerified) {
        renderConsumptionUpgradeChart(potentialData);
        renderPotentialFocusRegions(potentialData);
    } else {
        clearRestrictedContentOnAuthChange();
    }
}

function populateAllFilters() {
    const yearSelectors = [
        document.getElementById('yearFilterOverview'),
        document.getElementById('startYearPotential'),
        document.getElementById('endYearPotential')
    ];
    const monthSelectors = [ document.getElementById('monthFilterOverview') ];
    const regionSelectorOverview = document.getElementById('regionFilterOverview');

    yearSelectors.forEach(selector => {
        if (!selector) return;
        const isGeneralFilter = selector.id === 'yearFilterOverview';
        const currentVal = selector.value;
        selector.innerHTML = isGeneralFilter ? '<option value="ALL">全部年份</option>' : '';
        uniqueYears.forEach(year => selector.insertAdjacentHTML('beforeend', `<option value="${year}">${year}年</option>`));
        if (isGeneralFilter && currentVal && Array.from(selector.options).some(opt => opt.value === currentVal)) selector.value = currentVal;
        else if (isGeneralFilter) selector.value = "ALL";
    });

    monthSelectors.forEach(selector => {
        if (!selector) return;
        const currentVal = selector.value;
        selector.innerHTML = '<option value="ALL">全部月份</option>';
        uniqueMonths.forEach(month => selector.insertAdjacentHTML('beforeend', `<option value="${month}">${month}月</option>`));
        if (currentVal && Array.from(selector.options).some(opt => opt.value === currentVal)) selector.value = currentVal;
        else selector.value = "ALL";
    });

    if (regionSelectorOverview) {
        const currentVal = regionSelectorOverview.value;
        regionSelectorOverview.innerHTML = '<option value="ALL">全國</option>';
        const sortedRegionCodes = Object.keys(uniqueRegionCodeToName).sort((a,b) => {
            const numA = parseInt(a.replace(/\D/g,''));
            const numB = parseInt(b.replace(/\D/g,''));
            if (!isNaN(numA) && !isNaN(numB) && numA !== numB) return numA - numB;
            return a.localeCompare(b);
        });
        sortedRegionCodes.forEach(code => {
             regionSelectorOverview.insertAdjacentHTML('beforeend', `<option value="${code}">${uniqueRegionCodeToName[code]}</option>`);
        });
        if (currentVal && Array.from(regionSelectorOverview.options).some(opt => opt.value === currentVal)) regionSelectorOverview.value = currentVal;
        else regionSelectorOverview.value = "ALL";
    }

    const startYearPotential = document.getElementById('startYearPotential');
    const endYearPotential = document.getElementById('endYearPotential');
    if (startYearPotential && endYearPotential && uniqueYears.length > 0) {
        const defaultStart = uniqueYears.length > 1 ? uniqueYears[uniqueYears.length - 2] : uniqueYears[0];
        const defaultEnd = uniqueYears[uniqueYears.length - 1];
        if (Array.from(startYearPotential.options).some(opt => opt.value == defaultStart)) startYearPotential.value = defaultStart;
        if (Array.from(endYearPotential.options).some(opt => opt.value == defaultEnd)) endYearPotential.value = defaultEnd;
    }
}

function attachAllEventListeners() {
    document.getElementById('yearFilterOverview')?.addEventListener('change', handleSharedFilterChange);
    document.getElementById('monthFilterOverview')?.addEventListener('change', handleSharedFilterChange);
    document.getElementById('regionFilterOverview')?.addEventListener('change', handleSharedFilterChange);

    document.getElementById('resetFiltersOverview')?.addEventListener('click', () => {
        document.getElementById('yearFilterOverview').value = "ALL";
        document.getElementById('monthFilterOverview').value = "ALL";
        document.getElementById('regionFilterOverview').value = "ALL";
        handleSharedFilterChange();
    });
    document.getElementById('analyzePotentialButton')?.addEventListener('click', updatePotentialStarsAnalysis);
}

function handleSharedFilterChange() {
    updateDashboardOverview();
    updateAdvancedAnalysisCharts();
    const selectedRegionCode = document.getElementById('regionFilterOverview').value;
    const detailedDataSection = document.getElementById('detailedDataSection');
    const detailedDataTitle = document.getElementById('detailedDataTitle');

    if (selectedRegionCode !== "ALL") {
        if (detailedDataSection) detailedDataSection.style.display = 'block';
        if (detailedDataTitle) detailedDataTitle.textContent = `${uniqueRegionCodeToName[selectedRegionCode] || selectedRegionCode} - 詳細數據`;
        renderDetailedDataTable(selectedRegionCode);
    } else {
        if (detailedDataSection) detailedDataSection.style.display = 'none';
    }
}


function updateDashboardOverview() {
    if (allCrossBorderData.length === 0) return;
    showLoadingIndicator(true, "更新總覽數據...");

    const selectedYear = document.getElementById('yearFilterOverview').value;
    const selectedMonth = document.getElementById('monthFilterOverview').value;
    const selectedRegionCode = document.getElementById('regionFilterOverview').value;

    let filteredData = allCrossBorderData;
    if (selectedYear !== "ALL") filteredData = filteredData.filter(d => d.year == selectedYear);
    if (selectedMonth !== "ALL") filteredData = filteredData.filter(d => d.month == selectedMonth);
    if (selectedRegionCode !== "ALL") filteredData = filteredData.filter(d => d.regionCode == selectedRegionCode);

    renderKeyMetricsForOverview(filteredData);
    renderTrendsChartForOverview(filteredData, selectedYear, selectedMonth, selectedRegionCode);
    if (selectedRegionCode === "ALL") {
        renderRegionRankingForOverview(filteredData);
    } else {
        const tableBody = document.getElementById('regionRankingTableBody');
        if (tableBody) tableBody.innerHTML = `<tr><td colspan="3" class="text-center">已選擇地區：${uniqueRegionCodeToName[selectedRegionCode] || selectedRegionCode}</td></tr>`;
    }
    showLoadingIndicator(false);
}

function renderKeyMetricsForOverview(data) {
    let totalCBAmount = 0;
    let totalCBTransactions = 0;
    data.forEach(d => {
        totalCBAmount += d.crossBorderAmountNTD;
        totalCBTransactions += d.crossBorderTransactions;
    });
    const averageCBTransactionValue = totalCBTransactions > 0 ? (totalCBAmount / totalCBTransactions) : 0;

    const container = document.getElementById('keyMetricsCards');
    if (!container) return;
    container.innerHTML = `
        <div class="col-sm-6 col-lg-12 mb-3">
            <div class="stats-item">
                <h4>跨境總消費金額</h4>
                <p>${totalCBAmount.toLocaleString()} <small>NTD</small></p>
            </div>
        </div>
        <div class="col-sm-6 col-lg-12 mb-3">
            <div class="stats-item">
                <h4>跨境總交易筆數</h4>
                <p>${totalCBTransactions.toLocaleString()}</p>
            </div>
        </div>
        <div class="col-sm-6 col-lg-12 mb-3">
            <div class="stats-item">
                <h4>平均跨境交易金額 (ATV)</h4>
                <p>${averageCBTransactionValue.toLocaleString(undefined, { maximumFractionDigits: 0 })} <small>NTD</small></p>
            </div>
        </div>`;
}

function renderTrendsChartForOverview(data, selectedYear, selectedMonth, selectedRegionCode) {
    const ctx = document.getElementById('trendsChart')?.getContext('2d');
    if (!ctx) return;

    let labels = [];
    let cbAmountSeries = [];
    let cbTransactionsSeries = [];
    let chartTitle = "跨境消費趨勢";
    const currentRegionName = selectedRegionCode === "ALL" ? "全國" : (uniqueRegionCodeToName[selectedRegionCode] || selectedRegionCode);
    const chartFontColor = '#fff'; 

    if (selectedYear === "ALL" && selectedMonth === "ALL") {
        chartTitle = `${currentRegionName} - 年度跨境趨勢`;
        const yearlyData = {};
        data.forEach(d => {
            if (!yearlyData[d.year]) yearlyData[d.year] = { amount: 0, transactions: 0 };
            yearlyData[d.year].amount += d.crossBorderAmountNTD;
            yearlyData[d.year].transactions += d.crossBorderTransactions;
        });
        labels = Object.keys(yearlyData).map(y => parseInt(y)).sort((a, b) => a - b);
        cbAmountSeries = labels.map(year => yearlyData[year]?.amount || 0);
        cbTransactionsSeries = labels.map(year => yearlyData[year]?.transactions || 0);
    } else if (selectedYear !== "ALL" && selectedMonth === "ALL") {
        chartTitle = `${currentRegionName} - ${selectedYear}年 月度跨境趨勢`;
        const monthlyData = Array(12).fill(null).map(() => ({ amount: 0, transactions: 0 }));
        data.filter(d => d.year == selectedYear).forEach(d => {
            if (d.month >= 1 && d.month <= 12) {
                monthlyData[d.month - 1].amount += d.crossBorderAmountNTD;
                monthlyData[d.month - 1].transactions += d.crossBorderTransactions;
            }
        });
        labels = uniqueMonths.map(m => `${selectedYear}/${m.toString().padStart(2,'0')}`);
        cbAmountSeries = monthlyData.map(monthData => monthData.amount);
        cbTransactionsSeries = monthlyData.map(monthData => monthData.transactions);
    } else if (selectedYear !== "ALL" && selectedMonth !== "ALL") {
        if (selectedRegionCode === "ALL") {
            chartTitle = `${selectedYear}年${selectedMonth.toString().padStart(2,'0')}月 - 各地區跨境消費金額`;
            const regionalDataForPeriod = {};
            data.forEach(d => {
                const regionName = uniqueRegionCodeToName[d.regionCode] || d.regionCode;
                if (!regionalDataForPeriod[regionName]) regionalDataForPeriod[regionName] = { amount: 0, transactions: 0 };
                regionalDataForPeriod[regionName].amount += d.crossBorderAmountNTD;
                regionalDataForPeriod[regionName].transactions += d.crossBorderTransactions;
            });
            const sortedRegions = Object.entries(regionalDataForPeriod).sort(([,a],[,b]) => b.amount - a.amount).slice(0,15);
            labels = sortedRegions.map(([name,]) => name);
            cbAmountSeries = sortedRegions.map(([,rData]) => rData.amount);
            cbTransactionsSeries = sortedRegions.map(([,rData]) => rData.transactions);
        } else {
            chartTitle = `${currentRegionName} - ${selectedYear}年${selectedMonth.toString().padStart(2,'0')}月 跨境消費`;
            labels = [`${selectedYear}/${selectedMonth.toString().padStart(2,'0')}`];
            cbAmountSeries = [data.reduce((sum, d) => sum + d.crossBorderAmountNTD, 0)];
            cbTransactionsSeries = [data.reduce((sum, d) => sum + d.crossBorderTransactions, 0)];
        }
    } else {
        labels = ["請選擇更明確的篩選條件"];
        cbAmountSeries = []; cbTransactionsSeries = [];
    }

    if (overviewTrendsChartInstance) overviewTrendsChartInstance.destroy();
    overviewTrendsChartInstance = new Chart(ctx, {
        type: labels.length > 1 ? 'line' : 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: '跨境消費金額 (NTD)', data: cbAmountSeries,
                    borderColor: 'rgb(54, 162, 235)', backgroundColor: 'rgba(54, 162, 235, 0.5)',
                    tension: 0.1, yAxisID: 'yAmount',
                    pointRadius: labels.length <= 12 ? 4 : 2, pointHoverRadius: labels.length <= 12 ? 6 : 4,
                },
                {
                    label: '跨境交易筆數', data: cbTransactionsSeries,
                    borderColor: 'rgb(255, 99, 132)', backgroundColor: 'rgba(255, 99, 132, 0.5)',
                    tension: 0.1, yAxisID: 'yTransactions',
                    pointRadius: labels.length <= 12 ? 4 : 2, pointHoverRadius: labels.length <= 12 ? 6 : 4,
                    hidden: labels.length > 15
                }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: chartTitle, font: { size: 14 }, color: chartFontColor },
                legend: { labels: { color: chartFontColor, boxWidth: 12, font: {size: 10} } }
            },
            scales: {
                x: { ticks: { color: chartFontColor, font: {size: 10} }, grid: { color: 'rgba(255,255,255,0.1)'} },
                yAmount: {
                    type: 'linear', display: true, position: 'left',
                    title: { display: true, text: '金額 (NTD)', color: chartFontColor, font: {size: 10} },
                    ticks: { color: chartFontColor, font: {size: 10}, callback: v => v.toLocaleString() },
                    grid: { color: 'rgba(255,255,255,0.1)'}
                },
                yTransactions: {
                    type: 'linear', display: true, position: 'right',
                    title: { display: true, text: '筆數', color: chartFontColor, font: {size: 10} },
                    ticks: { color: chartFontColor, font: {size: 10}, callback: v => v.toLocaleString() },
                    grid: { drawOnChartArea: false },
                }
            }
        }
    });
}

function renderRegionRankingForOverview(data) {
    const tableBody = document.getElementById('regionRankingTableBody');
    if (!tableBody) return;
    tableBody.innerHTML = '';

    const aggregatedByRegion = {};
    data.forEach(d => {
        if (!uniqueRegionCodeToName[d.regionCode]) return;
        const regionName = uniqueRegionCodeToName[d.regionCode];
        if (!aggregatedByRegion[d.regionCode]) {
            aggregatedByRegion[d.regionCode] = { name: regionName, cbAmount: 0 };
        }
        aggregatedByRegion[d.regionCode].cbAmount += d.crossBorderAmountNTD;
    });

    const rankedRegions = Object.values(aggregatedByRegion)
        .sort((a, b) => b.cbAmount - a.cbAmount)
        .slice(0, 10);

    if (rankedRegions.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="3" class="text-center">此篩選條件下無地區數據可供排行。</td></tr>';
        return;
    }
    rankedRegions.forEach((region, index) => {
        tableBody.insertAdjacentHTML('beforeend', `<tr><td>${index + 1}</td><td>${region.name}</td><td>${region.cbAmount.toLocaleString()}</td></tr>`);
    });
}

function renderDetailedDataTable(regionCode) {
    const tableHeadersContainer = document.getElementById('detailedDataHeaders');
    const tableBodyContainer = document.getElementById('detailedDataTableBody');
    if (!tableHeadersContainer || !tableBodyContainer) return;

    tableHeadersContainer.innerHTML = '';
    tableBodyContainer.innerHTML = '';

    const selectedYear = document.getElementById('yearFilterOverview').value;
    const selectedMonth = document.getElementById('monthFilterOverview').value;

    let dataForTable = allCrossBorderData.filter(d => d.regionCode === regionCode);
    if (selectedYear !== "ALL") dataForTable = dataForTable.filter(d => d.year == selectedYear);
    if (selectedMonth !== "ALL") dataForTable = dataForTable.filter(d => d.month == selectedMonth);

    if (dataForTable.length === 0) {
        tableBodyContainer.innerHTML = '<tr><td colspan="7" class="text-center">此篩選條件下無詳細數據。</td></tr>';
        tableHeadersContainer.innerHTML = '<th>年月</th><th>卡數</th><th>總筆數</th><th>總金額(NTD)</th><th>跨境筆數</th><th>跨境金額(NTD)</th><th>跨境ATV(NTD)</th>';
        return;
    }

    tableHeadersContainer.innerHTML = '<th>年月</th><th>卡數</th><th>總筆數</th><th>總金額(NTD)</th><th>跨境筆數</th><th>跨境金額(NTD)</th><th>跨境ATV(NTD)</th>';

    dataForTable.sort((a,b) => (a.year === b.year) ? a.month - b.month : a.year - b.year)
    .forEach(row => {
        const atv = row.crossBorderTransactions > 0 ? (row.crossBorderAmountNTD / row.crossBorderTransactions) : 0;
        const tr = `<tr>
            <td>${row.year}/${row.month.toString().padStart(2,'0')}</td>
            <td>${row.cardCount.toLocaleString()}</td>
            <td>${row.totalTransactions.toLocaleString()}</td>
            <td>${row.totalAmountNTD.toLocaleString()}</td>
            <td>${row.crossBorderTransactions.toLocaleString()}</td>
            <td>${row.crossBorderAmountNTD.toLocaleString()}</td>
            <td>${atv.toLocaleString(undefined, {maximumFractionDigits: 0})}</td>
        </tr>`;
        tableBodyContainer.insertAdjacentHTML('beforeend', tr);
    });
}

// --- 新增的進階分析圖表函數 ---
function updateAdvancedAnalysisCharts() {
    if (allCrossBorderData.length === 0) return;
    showLoadingIndicator(true, "更新進階分析圖表...");

    const selectedYear = document.getElementById('yearFilterOverview').value;
    const selectedMonth = document.getElementById('monthFilterOverview').value;
    const selectedRegionCode = document.getElementById('regionFilterOverview').value;

    let filteredData = allCrossBorderData;
    if (selectedYear !== "ALL") filteredData = filteredData.filter(d => d.year == selectedYear);
    if (selectedMonth !== "ALL") filteredData = filteredData.filter(d => d.month == selectedMonth);
    if (selectedRegionCode !== "ALL") filteredData = filteredData.filter(d => d.regionCode == selectedRegionCode);

    renderCrossBorderRatioChart(filteredData, selectedYear, selectedMonth, selectedRegionCode);
    renderAvgCbSpendingPerCardChart(filteredData, selectedYear, selectedMonth, selectedRegionCode);
    showLoadingIndicator(false);
}

function renderCrossBorderRatioChart(data, selectedYear, selectedMonth, selectedRegionCode) {
    const ctx = document.getElementById('crossBorderRatioChart')?.getContext('2d');
    if (!ctx) return;

    let labels = [];
    let ratioSeries = [];
    let chartTitle = "跨境消費金額佔總消費金額比例";
    const currentRegionName = selectedRegionCode === "ALL" ? "全國" : (uniqueRegionCodeToName[selectedRegionCode] || selectedRegionCode);
    const chartFontColor = '#fff'; 

    if (selectedYear === "ALL" && selectedMonth === "ALL") {
        chartTitle = `${currentRegionName} - 年度跨境消費佔比趨勢`;
        const yearlyData = {};
        data.forEach(d => {
            if (!yearlyData[d.year]) yearlyData[d.year] = { cbAmount: 0, totalAmount: 0 };
            yearlyData[d.year].cbAmount += d.crossBorderAmountNTD;
            yearlyData[d.year].totalAmount += d.totalAmountNTD;
        });
        labels = Object.keys(yearlyData).map(y => parseInt(y)).sort((a, b) => a - b);
        ratioSeries = labels.map(year => {
            const yearData = yearlyData[year];
            return (yearData.totalAmount > 0) ? (yearData.cbAmount / yearData.totalAmount) * 100 : 0;
        });
    } else if (selectedYear !== "ALL" && selectedMonth === "ALL") {
        chartTitle = `${currentRegionName} - ${selectedYear}年 月度跨境消費佔比趨勢`;
        const monthlyData = Array(12).fill(null).map(() => ({ cbAmount: 0, totalAmount: 0 }));
        data.filter(d => d.year == selectedYear).forEach(d => {
            if (d.month >= 1 && d.month <= 12) {
                monthlyData[d.month - 1].cbAmount += d.crossBorderAmountNTD;
                monthlyData[d.month - 1].totalAmount += d.totalAmountNTD;
            }
        });
        labels = uniqueMonths.map(m => `${selectedYear}/${m.toString().padStart(2,'0')}`);
        ratioSeries = monthlyData.map(md => (md.totalAmount > 0) ? (md.cbAmount / md.totalAmount) * 100 : 0);
    } else {
        chartTitle = `${currentRegionName} - ${selectedYear || '所有年份'}/${selectedMonth || '所有月份'} 跨境消費佔比`;
         if (selectedRegionCode === "ALL" && selectedYear !== "ALL" && selectedMonth !== "ALL") {
            chartTitle = `${selectedYear}年${selectedMonth.toString().padStart(2,'0')}月 - 各地區跨境消費佔比`;
            const regionalData = {};
            data.forEach(d => {
                const regionName = uniqueRegionCodeToName[d.regionCode] || d.regionCode;
                if (!regionalData[regionName]) regionalData[regionName] = { cbAmount: 0, totalAmount: 0 };
                regionalData[regionName].cbAmount += d.crossBorderAmountNTD;
                regionalData[regionName].totalAmount += d.totalAmountNTD;
            });
            const sortedRegions = Object.entries(regionalData).sort(([,a],[,b]) => ((b.totalAmount > 0 ? (b.cbAmount / b.totalAmount) : 0) - (a.totalAmount > 0 ? (a.cbAmount / a.totalAmount) : 0))).slice(0,15);
            labels = sortedRegions.map(([name,]) => name);
            ratioSeries = sortedRegions.map(([,rData]) => (rData.totalAmount > 0) ? (rData.cbAmount / rData.totalAmount) * 100 : 0);

        } else {
            const totalCb = data.reduce((sum, d) => sum + d.crossBorderAmountNTD, 0);
            const totalAll = data.reduce((sum, d) => sum + d.totalAmountNTD, 0);
            labels = [chartTitle.substring(0, chartTitle.lastIndexOf("跨境消費佔比"))]; 
            ratioSeries = [(totalAll > 0) ? (totalCb / totalAll) * 100 : 0];
        }
    }

    if (crossBorderRatioChartInstance) crossBorderRatioChartInstance.destroy();
    crossBorderRatioChartInstance = new Chart(ctx, {
        type: labels.length > 1 ? 'line' : 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: '跨境消費金額佔總金額比例 (%)',
                data: ratioSeries,
                borderColor: 'rgb(255, 159, 64)',
                backgroundColor: 'rgba(255, 159, 64, 0.5)',
                tension: 0.1,
                pointRadius: labels.length <= 12 ? 4 : 2,
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { 
                title: { display: true, text: chartTitle, font: {size: 14}, color: chartFontColor },
                legend: { labels: { color: chartFontColor, boxWidth: 12, font: {size:10} } }
            },
            scales: { 
                x: { ticks: { color: chartFontColor, font: {size:10} }, grid: { color: 'rgba(255,255,255,0.1)'} },
                y: { beginAtZero: true, max: 100, ticks: { callback: value => `${value.toFixed(1)}%`, color: chartFontColor, font: {size:10} }, grid: { color: 'rgba(255,255,255,0.1)'} }
            }
        }
    });
}

function renderAvgCbSpendingPerCardChart(data, selectedYear, selectedMonth, selectedRegionCode) {
    const ctx = document.getElementById('avgCbSpendingPerCardChart')?.getContext('2d');
    if (!ctx) return;

    let labels = [];
    let avgSpendingSeries = [];
    let chartTitle = "平均每卡跨境消費金額";
    const currentRegionName = selectedRegionCode === "ALL" ? "全國" : (uniqueRegionCodeToName[selectedRegionCode] || selectedRegionCode);
    const chartFontColor = '#fff';


    if (selectedYear === "ALL" && selectedMonth === "ALL") {
        chartTitle = `${currentRegionName} - 年度平均每卡跨境消費趨勢`;
        const yearlyData = {};
        data.forEach(d => {
            if (!yearlyData[d.year]) yearlyData[d.year] = { cbAmount: 0, cardCount: 0 };
            yearlyData[d.year].cbAmount += d.crossBorderAmountNTD;
            yearlyData[d.year].cardCount += d.cardCount;
        });
        labels = Object.keys(yearlyData).map(y => parseInt(y)).sort((a, b) => a - b);
        avgSpendingSeries = labels.map(year => {
            const yearData = yearlyData[year];
            return (yearData.cardCount > 0) ? (yearData.cbAmount / yearData.cardCount) : 0;
        });
    } else if (selectedYear !== "ALL" && selectedMonth === "ALL") {
        chartTitle = `${currentRegionName} - ${selectedYear}年 月度平均每卡跨境消費趨勢`;
        const monthlyData = Array(12).fill(null).map(() => ({ cbAmount: 0, cardCount: 0 }));
        data.filter(d => d.year == selectedYear).forEach(d => {
            if (d.month >= 1 && d.month <= 12) {
                monthlyData[d.month - 1].cbAmount += d.crossBorderAmountNTD;
                monthlyData[d.month - 1].cardCount += d.cardCount;
            }
        });
        labels = uniqueMonths.map(m => `${selectedYear}/${m.toString().padStart(2,'0')}`);
        avgSpendingSeries = monthlyData.map(md => (md.cardCount > 0) ? (md.cbAmount / md.cardCount) : 0);
    } else {
        chartTitle = `${currentRegionName} - ${selectedYear || '所有年份'}/${selectedMonth || '所有月份'} 平均每卡跨境消費`;
        if (selectedRegionCode === "ALL" && selectedYear !== "ALL" && selectedMonth !== "ALL") {
            chartTitle = `${selectedYear}年${selectedMonth.toString().padStart(2,'0')}月 - 各地區平均每卡跨境消費`;
            const regionalData = {};
            data.forEach(d => {
                const regionName = uniqueRegionCodeToName[d.regionCode] || d.regionCode;
                if (!regionalData[regionName]) regionalData[regionName] = { cbAmount: 0, cardCount: 0 };
                regionalData[regionName].cbAmount += d.crossBorderAmountNTD;
                regionalData[regionName].cardCount += d.cardCount;
            });
            const sortedRegions = Object.entries(regionalData).sort(([,a],[,b]) => ((b.cardCount > 0 ? b.cbAmount/b.cardCount : 0) - (a.cardCount > 0 ? a.cbAmount/a.cardCount : 0))).slice(0,15);
            labels = sortedRegions.map(([name,]) => name);
            avgSpendingSeries = sortedRegions.map(([,rData]) => (rData.cardCount > 0) ? (rData.cbAmount / rData.cardCount) : 0);
        } else {
            const totalCb = data.reduce((sum, d) => sum + d.crossBorderAmountNTD, 0);
            const totalCards = data.reduce((sum, d) => sum + d.cardCount, 0);
            labels = [chartTitle.substring(0, chartTitle.lastIndexOf("平均每卡跨境消費"))];
            avgSpendingSeries = [(totalCards > 0) ? (totalCb / totalCards) : 0];
        }
    }

    if (avgCbSpendingPerCardChartInstance) avgCbSpendingPerCardChartInstance.destroy();
    avgCbSpendingPerCardChartInstance = new Chart(ctx, {
        type: labels.length > 1 ? 'line' : 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: '平均每卡跨境消費金額 (NTD)',
                data: avgSpendingSeries,
                borderColor: 'rgb(153, 102, 255)',
                backgroundColor: 'rgba(153, 102, 255, 0.5)',
                tension: 0.1,
                pointRadius: labels.length <= 12 ? 4 : 2,
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { 
                title: { display: true, text: chartTitle, font: {size: 14}, color: chartFontColor },
                legend: { labels: { color: chartFontColor, boxWidth: 12, font: {size:10} } }
            },
            scales: { 
                x: { ticks: { color: chartFontColor, font: {size:10} }, grid: { color: 'rgba(255,255,255,0.1)'} },
                y: { beginAtZero: true, ticks: { callback: value => value.toLocaleString(undefined, {maximumFractionDigits: 0}), color: chartFontColor, font: {size:10} }, grid: { color: 'rgba(255,255,255,0.1)'} }
            }
        }
    });
}

// --- 潛力之星分析 (Potential Stars Analysis) ---
function initializePotentialStars() {
    const analyzeButton = document.getElementById('analyzePotentialButton');
    if (analyzeButton) {
        analyzeButton.addEventListener('click', updatePotentialStarsAnalysis);
    }
}

function calculatePotentialDataForAllRegions() {
    if (allCrossBorderData.length === 0) return [];

    const startYearElement = document.getElementById('startYearPotential');
    const endYearElement = document.getElementById('endYearPotential');

    if (!startYearElement || !endYearElement || !startYearElement.value || !endYearElement.value) {
        console.warn("潛力分析年份選擇元素未找到或未選擇年份。");
        return [];
    }

    const startYear = parseInt(startYearElement.value, 10);
    const endYear = parseInt(endYearElement.value, 10);

    if (isNaN(startYear) || isNaN(endYear) || startYear >= endYear) {
        return [];
    }

    const potentialData = [];
    for (const regionCode in uniqueRegionCodeToName) {
        const regionName = uniqueRegionCodeToName[regionCode];

        const prevPeriodData = allCrossBorderData.filter(d => d.regionCode == regionCode && d.year == startYear);
        let prevCBAmount = prevPeriodData.reduce((sum, d) => sum + d.crossBorderAmountNTD, 0);
        let prevCBTransactions = prevPeriodData.reduce((sum, d) => sum + d.crossBorderTransactions, 0);
        const prevATV = prevCBTransactions > 0 ? (prevCBAmount / prevCBTransactions) : 0;

        const currentPeriodData = allCrossBorderData.filter(d => d.regionCode == regionCode && d.year == endYear);
        let currentCBAmount = currentPeriodData.reduce((sum, d) => sum + d.crossBorderAmountNTD, 0);
        let currentCBTransactions = currentPeriodData.reduce((sum, d) => sum + d.crossBorderTransactions, 0);
        const currentATV = currentCBTransactions > 0 ? (currentCBAmount / currentCBTransactions) : 0;

        const calculateGrowth = (current, previous) => {
            if (previous > 0) return ((current - previous) / previous) * 100;
            if (current > 0 && previous === 0) return Infinity;
            return 0;
        };

        const amountGrowth = calculateGrowth(currentCBAmount, prevCBAmount);
        const transactionsGrowth = calculateGrowth(currentCBTransactions, prevCBTransactions);
        const atvGrowth = calculateGrowth(currentATV, prevATV);

        potentialData.push({
            regionCode, regionName,
            amountGrowthRate: isFinite(amountGrowth) ? amountGrowth : (amountGrowth === Infinity ? 99999 : 0),
            transactionsGrowthRate: isFinite(transactionsGrowth) ? transactionsGrowth : (transactionsGrowth === Infinity ? 99999 : 0),
            currentATV,
            atvGrowthRate: isFinite(atvGrowth) ? atvGrowth : (atvGrowth === Infinity ? 99999 : 0),
        });
    }
    return potentialData;
}


function updatePotentialStarsAnalysis() {
    if (allCrossBorderData.length === 0) return;
    showLoadingIndicator(true, "更新潛力分析...");

    const potentialData = calculatePotentialDataForAllRegions();

    renderPotentialStarsTable(potentialData);

    const currentUser = auth ? auth.currentUser : null;
    const restrictedContentWrapper = document.getElementById('restricted-content-wrapper');
    const restrictedContentOverlay = document.getElementById('restricted-content-overlay');
    const authFormContainer = document.getElementById('auth-form-container');
    const verifyEmailPromptContent = document.getElementById('verify-email-prompt-content');


    if (currentUser && currentUser.emailVerified) {
        if(restrictedContentWrapper) restrictedContentWrapper.classList.remove('blurred');
        if(restrictedContentOverlay) restrictedContentOverlay.style.display = 'none';
        if (potentialData.length > 0) {
            renderConsumptionUpgradeChart(potentialData);
            renderPotentialFocusRegions(potentialData);
        } else {
            clearRestrictedContentOnAuthChange();
        }
    } else {
        if(restrictedContentWrapper) restrictedContentWrapper.classList.add('blurred');
        if(restrictedContentOverlay) restrictedContentOverlay.style.display = 'flex';
        if (currentUser && !currentUser.emailVerified) {
            if(authFormContainer) authFormContainer.style.display = 'none';
            if(verifyEmailPromptContent) verifyEmailPromptContent.style.display = 'block';
        } else {
            if(authFormContainer) authFormContainer.style.display = 'block';
            if(verifyEmailPromptContent) verifyEmailPromptContent.style.display = 'none';
        }
        clearRestrictedContentOnAuthChange();
    }
    showLoadingIndicator(false);
}

function renderPotentialStarsTable(data) {
    const tableBody = document.getElementById('potentialStarsTableBody');
    if (!tableBody) return;
    tableBody.innerHTML = '';
    const sortedData = [...data].sort((a, b) => {
        if (b.amountGrowthRate === 99999 && a.amountGrowthRate !== 99999) return 1;
        if (a.amountGrowthRate === 99999 && b.amountGrowthRate !== 99999) return -1;
        if (b.amountGrowthRate === 99999 && a.amountGrowthRate === 99999) {
             if (b.atvGrowthRate === 99999 && a.atvGrowthRate !== 99999) return 1;
             if (a.atvGrowthRate === 99999 && b.atvGrowthRate !== 99999) return -1;
             return b.atvGrowthRate - a.atvGrowthRate;
        }
        return b.amountGrowthRate - a.amountGrowthRate;
    });

    if (sortedData.length === 0 && document.getElementById('startYearPotential').value && document.getElementById('endYearPotential').value && parseInt(document.getElementById('startYearPotential').value) < parseInt(document.getElementById('endYearPotential').value)) {
        tableBody.innerHTML = '<tr><td colspan="5" class="text-center">此年份區間無數據可供分析。</td></tr>';
    } else if (sortedData.length === 0) {
         tableBody.innerHTML = '<tr><td colspan="5" class="text-center">請點擊「開始分析」按鈕或選擇有效年份。</td></tr>';
    } else {
        const formatPercent = (val) => val === 99999 ? "∞" : `${val.toFixed(1)}%`;
        sortedData.forEach(region => {
            tableBody.insertAdjacentHTML('beforeend', `<tr><td>${region.regionName}</td><td>${formatPercent(region.amountGrowthRate)}</td><td>${formatPercent(region.transactionsGrowthRate)}</td><td>${region.currentATV.toLocaleString(undefined, {maximumFractionDigits:0})}</td><td>${formatPercent(region.atvGrowthRate)}</td></tr>`);
        });
    }
}

function renderConsumptionUpgradeChart(data) {
    const ctx = document.getElementById('consumptionUpgradeChart')?.getContext('2d');
    if (!ctx) return;

    if (data.length === 0) {
        if (consumptionUpgradeChartInstance) {
            consumptionUpgradeChartInstance.destroy();
            consumptionUpgradeChartInstance = null;
        }
        return;
    }

    const chartDataPoints = data.map(d => {
        const capGrowth = (val) => val === 99999 ? 250 : Math.min(250, Math.max(-100, val));
        return {
            x: capGrowth(d.transactionsGrowthRate),
            y: capGrowth(d.amountGrowthRate),
            r: Math.max(5, Math.min(20, (d.atvGrowthRate === 99999 ? 100 : d.atvGrowthRate) / 10 + 8)),
            label: d.regionName,
            atvGrowth: d.atvGrowthRate,
            currentATV: d.currentATV,
            originalX: d.transactionsGrowthRate,
            originalY: d.amountGrowthRate
        };
    });

    if (consumptionUpgradeChartInstance) consumptionUpgradeChartInstance.destroy();
    consumptionUpgradeChartInstance = new Chart(ctx, {
        type: 'bubble',
        data: {
            datasets: [{
                label: '各地區消費潛力 (氣泡大小代表ATV增長率)',
                data: chartDataPoints,
                backgroundColor: 'rgba(75, 192, 192, 0.7)',
                borderColor: 'rgb(75, 192, 192)',
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: '消費升級象限圖', font: { size: 14 }, color: '#fff' },
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const item = context.raw;
                            const formatOriginal = (val) => val === 99999 ? "∞" : val.toFixed(1);
                            return `${item.label}: 金額增長 ${formatOriginal(item.originalY)}%, 筆數增長 ${formatOriginal(item.originalX)}%, ATV增長 ${formatOriginal(item.atvGrowth)}% (現期ATV: ${item.currentATV.toLocaleString(undefined, {maximumFractionDigits:0})})`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: { display: true, text: '筆數增長率 (%)', color: '#fff', font: {size: 10} },
                    ticks: { color: '#fff', font: {size: 10}, callback: value => (value === 250 ) ? '≥250%' : (value === -100 ? '≤-100%' : value + '%') },
                    grid: { color: 'rgba(255,255,255,0.1)'}
                },
                y: {
                    title: { display: true, text: '金額增長率 (%)', color: '#fff', font: {size: 10} },
                    ticks: { color: '#fff', font: {size: 10}, callback: value => (value === 250) ? '≥250%' : (value === -100 ? '≤-100%' : value + '%') },
                    grid: { color: 'rgba(255,255,255,0.1)'}
                }
            }
        }
    });
}

function renderPotentialFocusRegions(data) {
    const focusContainer = document.getElementById('potentialFocus');
    if (!focusContainer) return;
    focusContainer.innerHTML = '';

    if (data.length === 0) {
        focusContainer.innerHTML = '<p class="text-center text-light small mt-3">無數據可供分析焦點地區。</p>';
        return;
    }

    const sortedForFocus = data
        .filter(d => d.amountGrowthRate > 10 && d.atvGrowthRate > 5 && d.amountGrowthRate !== 99999 && d.atvGrowthRate !== 99999)
        .sort((a, b) => (b.amountGrowthRate + b.atvGrowthRate) - (a.amountGrowthRate + a.atvGrowthRate))
        .slice(0, 3);

    if (sortedForFocus.length === 0) {
        focusContainer.innerHTML = '<p class="text-center text-light small mt-3">目前無符合「金額增長>10% 且 ATV增長>5%」焦點條件的地區。</p>';
        return;
    }
    sortedForFocus.forEach(region => {
        focusContainer.insertAdjacentHTML('beforeend', `
            <div class="col-md-12 col-lg-4 mb-3" data-aos="fade-up">
                <div class="icon-box p-3 text-center">
                     <i class="bi bi-award-fill" style="font-size: 1.8rem; color: #ffab00;"></i>
                    <h5 class="mt-2 text-light" style="font-size: 1rem;">${region.regionName}</h5>
                    <p class="small mb-1 text-light" style="font-size: 0.8rem;">金額增長: <span class="fw-bold">${region.amountGrowthRate.toFixed(1)}%</span></p>
                    <p class="small mb-0 text-light" style="font-size: 0.8rem;">ATV增長: <span class="fw-bold">${region.atvGrowthRate.toFixed(1)}%</span></p>
                </div>
            </div>`);
    });
}



