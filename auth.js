/**
 * auth.js - 高二智班務系統 身份驗證與狀態管理模組
 */

const AuthGuard = {
    // Session Key 定義
    SESSION_KEY: "user_session",

    /**
     * 建立使用者登入 Session 憑證
     * @param {string} username 學號 / 帳號
     * @param {string} nickname 姓名 / 暱稱
     * @param {string} token 密碼或驗證 Token
     * @param {string} role 身分角色 ('student', 'parent', 'admin')
     */
    createSession: function (username, nickname, token, role = "student") {
        try {
            const sessionData = {
                username: String(username),
                nickname: nickname || username,
                token: token,
                role: role,
                loginTime: new Date().getTime()
            };
            // 寫入 LocalStorage 與 SessionStorage 確保雙重狀態同步
            localStorage.setItem(this.SESSION_KEY, JSON.stringify(sessionData));
            sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(sessionData));

            // 若為管理員角色，同步寫入管理員專屬 Flag
            if (role === "admin") {
                localStorage.setItem("admin_login", "true");
                localStorage.setItem("user_role", "admin");
            }

            return Promise.resolve(sessionData);
        } catch (e) {
            console.error("建立 Session 失敗:", e);
            return Promise.reject(e);
        }
    },

    /**
     * 取得目前登入者的 Session 資料
     * @returns {Object|null} 使用者物件或 null
     */
    getSession: function () {
        try {
            const sessionData = localStorage.getItem(this.SESSION_KEY) || sessionStorage.getItem(this.SESSION_KEY);
            return sessionData ? JSON.parse(sessionData) : null;
        } catch (e) {
            console.error("讀取 Session 失敗:", e);
            return null;
        }
    },

    /**
     * 靜態與非同步驗證 Session 有效性 (提供成績查詢等系統非同步驗證)
     * @returns {Promise<Object>} 包含 valid 狀態與用戶資訊的物件
     */
    validateSession: async function () {
        const session = this.getSession();
        if (session && session.username) {
            return {
                valid: true,
                username: session.username,
                nickname: session.nickname,
                role: session.role
            };
        }
        return { valid: false };
    },

    /**
     * 驗證頁面存取權限 (若未登入則跳出提示並自動跳轉)
     * @param {string} loginUrl 跳轉的登入頁面路徑
     * @returns {Promise<Object|null>} 使用者 Session 物件
     */
    requireSession: async function (loginUrl = "login.html") {
        const session = this.getSession();
        if (!session || !session.username) {
            alert("請先登入系統！");
            window.location.href = loginUrl;
            return null;
        }
        return session;
    },

    /**
     * 清除使用者登入狀態 (登出)
     */
    clearSession: function () {
        localStorage.removeItem(this.SESSION_KEY);
        sessionStorage.removeItem(this.SESSION_KEY);
        localStorage.removeItem("admin_login");
        localStorage.removeItem("user_role");
    },

    // ==========================================
    // 🔔 公告與私人訊息「已讀 / 未讀」狀態管理
    // ==========================================

    /**
     * 檢查指定項目是否已讀
     * @param {string} type 項目類型 ('announcement' 或 'privateMsg')
     * @param {string} id 項目唯一識別碼 (或標題+日期組合)
     * @returns {boolean} 是否已讀
     */
    isRead: function (type, id) {
        if (!id) return false;
        try {
            const storageKey = `read_${type}`;
            const readList = JSON.parse(localStorage.getItem(storageKey) || "[]");
            return readList.includes(String(id));
        } catch (e) {
            console.error("讀取已讀狀態失敗:", e);
            return false;
        }
    },

    /**
     * 將指定項目標記為已讀
     * @param {string} type 項目類型 ('announcement' 或 'privateMsg')
     * @param {string} id 項目唯一識別碼 (或標題+日期組合)
     */
    markAsRead: function (type, id) {
        if (!id) return;
        try {
            const storageKey = `read_${type}`;
            let readList = JSON.parse(localStorage.getItem(storageKey) || "[]");
            const stringId = String(id);
            
            if (!readList.includes(stringId)) {
                readList.push(stringId);
                localStorage.setItem(storageKey, JSON.stringify(readList));
            }
        } catch (e) {
            console.error("寫入已讀狀態失敗:", e);
        }
    },

    /**
     * 清除指定類型的已讀紀錄 (用於測試或重置)
     * @param {string} type 項目類型 ('announcement' 或 'privateMsg')
     */
    clearReadStatus: function (type) {
        if (type) {
            localStorage.removeItem(`read_${type}`);
        } else {
            localStorage.removeItem("read_announcement");
            localStorage.removeItem("read_privateMsg");
        }
    }
};

// 匯出至全域環境
window.AuthGuard = AuthGuard;