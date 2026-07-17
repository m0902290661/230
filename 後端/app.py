# app.py
from flask import Flask, request, jsonify
from flask_cors import CORS
import sqlite3
import datetime
import random
import smtplib
from email.mime.text import MIMEText

app = Flask(__name__)
CORS(app)

DB_FILE = 'system.db'
RESET_CODES = {}
ADMIN_DELETE_PASSWORD = "990607"  # 防呆刪除密碼

# ==================== 🛠️ SMTP 郵件伺服器設定 ====================
# 請依據您的郵件服務商修改此處設定（下方以 Gmail 作為範例）
SMTP_SERVER = "smtp.gmail.com"       
SMTP_PORT = 587                      
SMTP_USER = "m0902290661@gmail.com"   # 改成您的信箱
SMTP_PASSWORD = "ndcj kvqv hqrr clxf" # 改成您的信箱密碼（Gmail 需使用「應用程式密碼」）
# ============================================================

def get_db_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

@app.route('/', methods=['POST'])
def handle_api():
    try:
        params = request.get_json(force=True)
        action = params.get('action')
        conn = get_db_connection()
        cursor = conn.cursor()

        # 動作一：登入驗證
        if action == "login":
            username = str(params.get('username')).strip()
            password = str(params.get('password')).strip()
            cursor.execute("SELECT * FROM users WHERE username = ? AND password = ?", (username, password))
            user = cursor.fetchone()
            if user:
                is_first = user['is_first_login'].lower() == 'true'
                role = "student"
                try:
                    if int(username) >= 493028:
                        role = "admin"
                except ValueError:
                    pass

                return jsonify({
                    "status": "success", "message": "驗證成功！", 
                    "nickname": user['nickname'], "isFirstLogin": is_first, 
                    "rowIndex": user['username'], "role": role
                })
            return jsonify({"status": "fail", "message": "帳號或密碼錯誤。"})

        # 動作二：首次登入更新密碼與郵件
        elif action == "updateProfile":
            username = str(params.get('rowIndex')).strip()
            new_password = params.get('newPassword')
            email = params.get('email')
            cursor.execute(
                "UPDATE users SET password = ?, is_first_login = 'false', email = ? WHERE username = ?",
                (new_password, email, username)
            )
            conn.commit()
            return jsonify({"status": "success", "message": "資料更新成功！"})

        # 動作三：抓取班級公告
        elif action == "getAnnouncements":
            cursor.execute("SELECT id, date, author, title, content FROM announcements ORDER BY id DESC")
            rows = cursor.fetchall()
            list_data = [{"id": r['id'], "date": r['date'], "author": r['author'], "title": r['title'], "content": r['content']} for r in rows]
            return jsonify({"status": "success", "data": list_data})

        # 動作四：抓取個人私人訊息
        elif action == "getPrivateMessages":
            current_user = str(params.get('username')).strip()
            cursor.execute("SELECT id, date, sender, title, content FROM private_messages WHERE username = ? ORDER BY id DESC", (current_user,))
            rows = cursor.fetchall()
            p_messages = [{"id": r['id'], "date": r['date'], "sender": r['sender'], "title": r['title'], "content": r['content']} for r in rows]
            return jsonify({"status": "success", "data": p_messages})

        # 動作六：接收前端提交的問題回報
        elif action == "submitReport":
            content = params.get('content', '').strip()
            if not content: 
                return jsonify({"status": "fail", "message": "回報內容不能為空！"})
            timestamp = datetime.datetime.now().strftime("%Y/%m/%d %H:%M:%S")
            cursor.execute(
                "INSERT INTO reports (timestamp, username, nickname, report_type, content) VALUES (?, ?, ?, ?, ?)",
                (timestamp, params.get('username'), params.get('nickname'), params.get('type'), content)
            )
            conn.commit()
            return jsonify({"status": "success", "message": "問題已成功送出！謝謝您的回報。"})

        # 動作八：抓取課程網站資源
        elif action == "getCourseResources":
            cursor.execute("SELECT id, category, name, description, url, icon FROM course_resources ORDER BY id DESC")
            rows = cursor.fetchall()
            res_list = [{
                "id": r['id'], "category": r['category'], "name": r['name'], 
                "description": r['description'] if r['description'] else "點擊下方按鈕前往該網站學習。",
                "url": r['url'], "icon": r['icon'] if r['icon'] else "fa-book"
            } for r in rows]
            return jsonify({"status": "success", "data": res_list})

        # ==========================================
        # 👑 管理員後台專用 API 動作
        # ==========================================
        
        # 👑 讀取特定資料表全表內容
        elif action == "adminFetchTable":
            table = params.get('table')
            if table not in ["announcements", "private_messages", "course_resources", "reports", "users"]:
                return jsonify({"status": "fail", "message": "不合法的資料表請求"})
            
            if table == "users":
                cursor.execute("SELECT username, password, nickname, is_first_login, email FROM users ORDER BY username ASC")
            else:
                cursor.execute(f"SELECT * FROM {table} ORDER BY id DESC")
                
            rows = cursor.fetchall()
            data_list = [dict(r) for r in rows]
            return jsonify({"status": "success", "data": data_list})

        # 👑 新增或更新資料庫項目
        elif action == "adminSaveItem":
            table = params.get('table')
            item_id = params.get('id')
            data = params.get('data', {})

            if table == "announcements":
                if item_id:
                    cursor.execute("UPDATE announcements SET date=?, author=?, title=?, content=? WHERE id=?", 
                                   (data.get('date'), data.get('author'), data.get('title'), data.get('content'), item_id))
                else:
                    cursor.execute("INSERT INTO announcements (date, author, title, content) VALUES (?, ?, ?, ?)", 
                                   (data.get('date'), data.get('author'), data.get('title'), data.get('content')))
            
            elif table == "private_messages":
                if item_id:
                    cursor.execute("UPDATE private_messages SET date=?, sender=?, username=?, title=?, content=? WHERE id=?", 
                                   (data.get('date'), data.get('sender'), data.get('username'), data.get('title'), data.get('content'), item_id))
                else:
                    cursor.execute("INSERT INTO private_messages (date, sender, username, title, content) VALUES (?, ?, ?, ?, ?)", 
                                   (data.get('date'), data.get('sender'), data.get('username'), data.get('title'), data.get('content')))
            
            elif table == "course_resources":
                if item_id:
                    cursor.execute("UPDATE course_resources SET category=?, name=?, description=?, url=?, icon=? WHERE id=?", 
                                   (data.get('category'), data.get('name'), data.get('description'), data.get('url'), data.get('icon'), item_id))
                else:
                    cursor.execute("INSERT INTO course_resources (category, name, description, url, icon) VALUES (?, ?, ?, ?, ?)", 
                                   (data.get('category'), data.get('name'), data.get('description'), data.get('url'), data.get('icon')))
            
            elif table == "reports":
                cursor.execute("UPDATE reports SET status=? WHERE id=?", (data.get('status'), item_id))

            elif table == "users":
                if item_id:
                    cursor.execute("UPDATE users SET password=?, nickname=?, is_first_login=?, email=? WHERE username=?",
                                   (data.get('password'), data.get('nickname'), data.get('is_first_login'), data.get('email'), item_id))
                else:
                    cursor.execute("INSERT OR REPLACE INTO users (username, password, nickname, is_first_login, email) VALUES (?, ?, ?, ?, ?)",
                                   (data.get('username'), data.get('password'), data.get('nickname'), data.get('is_first_login'), data.get('email')))

            conn.commit()
            return jsonify({"status": "success", "message": "資料儲存成功！"})

        # 👑 CSV 批量發布個人私訊
        elif action == "adminBatchPrivateMessages":
            messages_list = params.get('messages', [])
            if not messages_list:
                return jsonify({"status": "fail", "message": "發布失敗：未偵測到任何有效的訊息數據。"})
            
            success_count = 0
            for msg in messages_list:
                date_val = msg.get('date', '').strip()
                sender_val = msg.get('sender', '').strip()
                username_val = str(msg.get('username', '')).strip()
                title_val = msg.get('title', '').strip()
                content_val = msg.get('content', '').strip()
                
                if username_val and title_val and content_val:
                    cursor.execute(
                        "INSERT INTO private_messages (date, sender, username, title, content) VALUES (?, ?, ?, ?, ?)",
                        (date_val, sender_val, username_val, title_val, content_val)
                    )
                    success_count += 1
            
            conn.commit()
            return jsonify({"status": "success", "message": f"批量發布成功！共計寫入 {success_count} 筆個人私訊。"})

        # 👑 單筆刪除資料庫項目 (包含防呆驗證)
        elif action == "adminDeleteItem":
            table = params.get('table')
            item_id = params.get('id')
            delete_password = str(params.get('deletePassword', '')).strip()
            
            if delete_password != ADMIN_DELETE_PASSWORD:
                return jsonify({"status": "fail", "message": "拒絕刪除！防呆密碼輸入錯誤。"})

            if table == "users":
                cursor.execute("SELECT COUNT(*) as count FROM users WHERE CAST(username AS INTEGER) >= 493028")
                admin_count = cursor.fetchone()['count']
                try:
                    if int(item_id) >= 493028 and admin_count <= 1:
                        return jsonify({"status": "fail", "message": "刪除失敗！系統必須保留至少一位管理員。"})
                except ValueError:
                    pass
                
                cursor.execute("DELETE FROM users WHERE username = ?", (item_id,))
                conn.commit()
                return jsonify({"status": "success", "message": f"帳號 {item_id} 已從系統中永久刪除。"})
                
            elif table in ["announcements", "private_messages", "course_resources", "reports"]:
                cursor.execute(f"DELETE FROM {table} WHERE id = ?", (item_id,))
                conn.commit()
                return jsonify({"status": "success", "message": f"該筆資料已成功從 [{table}] 資料表中刪除。"})
            else:
                return jsonify({"status": "fail", "message": "不支援的資料表刪除請求。"})

        # 👑 新增功能：批量（選取）刪除資料庫項目
        elif action == "adminBatchDeleteItems":
            table = params.get('table')
            ids_list = params.get('ids', [])
            delete_password = str(params.get('deletePassword', '')).strip()
            
            if delete_password != ADMIN_DELETE_PASSWORD:
                return jsonify({"status": "fail", "message": "拒絕批量刪除！防呆密碼輸入錯誤。"})
                
            if not ids_list:
                return jsonify({"status": "fail", "message": "未選擇任何項目。"})

            if table == "users":
                # 檢查若全數刪除後是否還剩餘管理員帳號（防呆）
                placeholders = ', '.join(['?'] * len(ids_list))
                
                # 計算即將被刪除的管理員數量
                cursor.execute(f"SELECT COUNT(*) as count FROM users WHERE username IN ({placeholders}) AND CAST(username AS INTEGER) >= 493028", ids_list)
                to_delete_admin_count = cursor.fetchone()['count']
                
                # 計算系統中總共的管理員數量
                cursor.execute("SELECT COUNT(*) as count FROM users WHERE CAST(username AS INTEGER) >= 493028")
                total_admin_count = cursor.fetchone()['count']
                
                if total_admin_count - to_delete_admin_count < 1:
                    return jsonify({"status": "fail", "message": "刪除失敗！系統必須保留至少一位管理員，不能將其全數刪除。"})
                
                cursor.execute(f"DELETE FROM users WHERE username IN ({placeholders})", ids_list)
                conn.commit()
                return jsonify({"status": "success", "message": f"已成功批量刪除 {len(ids_list)} 筆帳號資料。"})
                
            elif table in ["announcements", "private_messages", "course_resources", "reports"]:
                placeholders = ', '.join(['?'] * len(ids_list))
                cursor.execute(f"DELETE FROM {table} WHERE id IN ({placeholders})", ids_list)
                conn.commit()
                return jsonify({"status": "success", "message": f"已成功從 [{table}] 批量刪除 {len(ids_list)} 筆項目。"})
            else:
                return jsonify({"status": "fail", "message": "不支援的資料表刪除請求。"})

        # ==========================================
        # 🔐 忘記密碼與重設邏輯
        # ==========================================
        elif action == "sendResetCode":
            username = str(params.get('username')).strip()
            cursor.execute("SELECT email FROM users WHERE username = ?", (username,))
            user = cursor.fetchone()
            if not user: return jsonify({"status": "fail", "message": "找不到該帳號。"})
            user_email = user['email']
            if not user_email or "@" not in user_email: return jsonify({"status": "fail", "message": "無綁定有效信箱。"})
            code = str(random.randint(100000, 999999))
            RESET_CODES[username] = {"code": code, "expire": datetime.datetime.now() + datetime.timedelta(minutes=10)}
            try:
                msg = MIMEText(f"驗證碼為： {code}", 'plain', 'utf-8')
                msg['Subject'] = "【高二智系統】密碼重設"
                msg['From'] = SMTP_USER; msg['To'] = user_email
                server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT); server.starttls()
                server.login(SMTP_USER, SMTP_PASSWORD); server.sendmail(SMTP_USER, [user_email], msg.as_string()); server.quit()
                return jsonify({"status": "success", "message": "驗證碼已寄出！", "maskedEmail": user_email.split("@")[0][:2]+"***@"+user_email.split("@")[1]})
            except Exception as e: return jsonify({"status": "fail", "message": str(e)})

        elif action == "resetPassword":
            username = str(params.get('username')).strip()
            input_code = str(params.get('code')).strip()
            new_password = str(params.get('newPassword')).strip()
            saved = RESET_CODES.get(username)
            if not saved or datetime.datetime.now() > saved["expire"]: return jsonify({"status": "fail", "message": "驗證碼過期。"})
            if saved["code"] != input_code: return jsonify({"status": "fail", "message": "驗證碼錯誤。"})
            cursor.execute("UPDATE users SET password = ? WHERE username = ?", (new_password, username))
            conn.commit()
            return jsonify({"status": "success", "message": "密碼重設成功！"})

        conn.close()
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)