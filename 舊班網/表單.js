const form = document.getElementById('gmailRegisterForm');
  const joinOut = document.getElementById('join_out');
  const userGmailInput = document.getElementById('userGmail');

  form.addEventListener('submit', function(e) {
    e.preventDefault(); // 阻止表單預設提交行為

    const userGmail = userGmailInput.value.trim();

    if (!userGmail) {
      joinOut.className = 'error';
      joinOut.textContent = '請輸入您的GO帳號 (Gmail地址)。';
      return;
    }

    // 簡單的Gmail格式驗證
    if (!userGmail.endsWith('@go.edu.tw') && !userGmail.endsWith('@gmail.com')) {
      joinOut.className = 'error';
      joinOut.textContent = '請輸入有效的GO帳號或Gmail地址。';
      return;
    }

    const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxfhgZ6mfI-v67vAW-iSeUZdF0GHxSFAKLQ9ubtetsMJwc7ezCtPOl5JmJbBEVtFKhb/exec"; // **請替換為您從 GAS 獲取的 URL**

    // 準備要發送的資料
    const data = {
      '使用者Gmail地址': userGmail,
      'subject': '新的學習歷程檔案雲端硬碟加入申請' // 設定郵件主旨
    };

    fetch(GAS_WEB_APP_URL, {
      method: 'POST',
      body: new URLSearchParams(data), // 將資料轉換為 URL 編碼的字串
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    })
    .then(response => {
      if (!response.ok) {
        // 如果 HTTP 狀態碼不是 2xx，則拋出錯誤
        return response.text().then(text => { throw new Error(text || '網路回應不正確'); });
      }
      return response.text();
    })
    .then(result => {
      joinOut.className = 'success';
      joinOut.textContent = result; // 顯示 GAS 返回的訊息
      form.reset(); // 成功後清空表單
    })
    .catch(error => {
      joinOut.className = 'error';
      joinOut.textContent = `登記失敗：${error.message}`;
      console.error('Error:', error);
    });
  });

// 請勿未經允許使用原始碼