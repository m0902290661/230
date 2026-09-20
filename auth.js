/**
 * AuthGuard - 前端身分驗證與持久性 Session 管理模組 (含瀏覽器推播通知)
 */
const AuthGuard = (function () {
    const STORAGE_KEY = "shs_user_session";
    const READ_ANNOUNCEMENTS_KEY = "shs_read_announcements";
    const READ_PRIVATE_MSGS_KEY = "shs_read_private_messages";

    function getStoredSession() {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            console.error("讀取 Session 失敗:", e);
            return null;
        }
    }

    function setStoredSession(session) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
        } catch (e) {
            console.error("儲存 Session 失敗:", e);
        }
    }

    return {
        createSession: async function (username, nickname, password, role = "student") {
            const session = {
                username: username,
                nickname: nickname || username,
                role: role,
                loginTime: new Date().getTime()
            };
            setStoredSession(session);
            return session;
        },

        validateSession: async function () {
            const session = getStoredSession();
            if (!session || !session.username) {
                return { valid: false, reason: "NO_SESSION" };
            }
            return {
                valid: true,
                username: session.username,
                nickname: session.nickname,
                role: session.role
            };
        },

        requireSession: async function (redirectUrl = "login.html") {
            const result = await this.validateSession();
            if (!result.valid) {
                window.location.href = redirectUrl;
                return null;
            }
            return result;
        },

        clearSession: function () {
            localStorage.removeItem(STORAGE_KEY);
            localStorage.removeItem("admin_login");
            localStorage.removeItem("user_role");
        },

        // 🔔 已讀狀態紀錄
        getReadIds: function (key) {
            try {
                const data = localStorage.getItem(key);
                return data ? JSON.parse(data) : [];
            } catch (e) {
                return [];
            }
        },

        markAsRead: function (type, id) {
            const key = type === 'announcement' ? READ_ANNOUNCEMENTS_KEY : READ_PRIVATE_MSGS_KEY;
            const readIds = this.getReadIds(key);
            if (!readIds.includes(String(id))) {
                readIds.push(String(id));
                localStorage.setItem(key, JSON.stringify(readIds));
            }
        },

        isRead: function (type, id) {
            const key = type === 'announcement' ? READ_ANNOUNCEMENTS_KEY : READ_PRIVATE_MSGS_KEY;
            return this.getReadIds(key).includes(String(id));
        },

        // 📣 瀏覽器原生通知 API 整合
        requestNotificationPermission: async function () {
            if (!("Notification" in window)) {
                console.warn("此瀏覽器不支援桌面通知功能");
                return false;
            }
            if (Notification.permission === "granted") {
                return true;
            }
            if (Notification.permission !== "denied") {
                const permission = await Notification.requestPermission();
                return permission === "granted";
            }
            return false;
        },

        sendNotification: function (title, body, icon = "logo.png") {
            if ("Notification" in window && Notification.permission === "granted") {
                const notification = new Notification(title, {
                    body: body,
                    icon: icon,
                    badge: icon
                });

                notification.onclick = function () {
                    window.focus();
                    this.close();
                };
            }
        }
    };
})();