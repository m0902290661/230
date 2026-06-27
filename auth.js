(function () {
    const SESSION_KEY = "authSession";
    const SESSION_VERSION = 1;
    const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

    function textToBytes(text) {
        return new TextEncoder().encode(text);
    }

    function bytesToHex(buffer) {
        return Array.from(new Uint8Array(buffer))
            .map(byte => byte.toString(16).padStart(2, "0"))
            .join("");
    }

    async function sha256(text) {
        const hash = await crypto.subtle.digest("SHA-256", textToBytes(text));
        return bytesToHex(hash);
    }

    function randomHex(length) {
        const bytes = new Uint8Array(length);
        crypto.getRandomValues(bytes);
        return Array.from(bytes)
            .map(byte => byte.toString(16).padStart(2, "0"))
            .join("");
    }

    function sessionPayload(session) {
        return [
            session.version,
            session.username,
            session.nickname,
            session.issuedAt,
            session.expiresAt,
            session.nonce
        ].join("|");
    }

    async function buildSessionKey(session, authKey) {
        return sha256(`${sessionPayload(session)}|${authKey}|hm-class-session-v1`);
    }

    function clearSession() {
        localStorage.removeItem(SESSION_KEY);
        localStorage.removeItem("isLoggedIn");
        localStorage.removeItem("username");
        localStorage.removeItem("nickname");
        localStorage.removeItem("temp_reset_username");
    }

    async function createSession(username, nickname, password) {
        const issuedAt = Date.now();
        const session = {
            version: SESSION_VERSION,
            username: String(username || "").trim(),
            nickname: String(nickname || "").trim(),
            issuedAt,
            expiresAt: issuedAt + SESSION_TTL_MS,
            nonce: randomHex(16)
        };

        if (!session.username || !session.nickname || !password) {
            throw new Error("缺少登入資訊，無法建立密鑰。");
        }

        const authKey = await sha256(`${session.username}|${password}|hm-class-auth-key-v1`);
        const sessionKey = await buildSessionKey(session, authKey);
        const authSession = { ...session, authKey, sessionKey };

        localStorage.setItem(SESSION_KEY, JSON.stringify(authSession));
        localStorage.setItem("isLoggedIn", "true");
        localStorage.setItem("username", session.username);
        localStorage.setItem("nickname", session.nickname);

        return authSession;
    }

    async function validateSession() {
        const rawSession = localStorage.getItem(SESSION_KEY);
        const legacyLoggedIn = localStorage.getItem("isLoggedIn");
        const legacyUsername = localStorage.getItem("username");
        const legacyNickname = localStorage.getItem("nickname");

        if (!rawSession || legacyLoggedIn !== "true" || !legacyUsername || !legacyNickname) {
            clearSession();
            return { valid: false, reason: "missing" };
        }

        let session;
        try {
            session = JSON.parse(rawSession);
        } catch (error) {
            clearSession();
            return { valid: false, reason: "corrupt" };
        }

        const requiredFields = [
            "version",
            "username",
            "nickname",
            "issuedAt",
            "expiresAt",
            "nonce",
            "authKey",
            "sessionKey"
        ];

        if (requiredFields.some(field => session[field] === undefined || session[field] === "")) {
            clearSession();
            return { valid: false, reason: "incomplete" };
        }

        if (
            session.version !== SESSION_VERSION ||
            session.username !== legacyUsername ||
            session.nickname !== legacyNickname ||
            Number(session.expiresAt) <= Date.now()
        ) {
            clearSession();
            return { valid: false, reason: "mismatch" };
        }

        const expectedKey = await buildSessionKey(session, session.authKey);
        if (expectedKey !== session.sessionKey) {
            clearSession();
            return { valid: false, reason: "signature" };
        }

        return {
            valid: true,
            username: session.username,
            nickname: session.nickname,
            expiresAt: session.expiresAt
        };
    }

    async function requireSession(redirectUrl) {
        const result = await validateSession();
        if (!result.valid) {
            alert("登入密鑰無效或已過期，請重新登入！");
            window.location.href = redirectUrl || "login.html";
            return null;
        }
        return result;
    }

    window.AuthGuard = {
        createSession,
        validateSession,
        requireSession,
        clearSession
    };
})();
