// 1. 設定目標時間（下一年的一月一日 00:00:00）
const targetTime = new Date(new Date().getFullYear() + 1, 0, 1, 0, 0, 0);

function updateCountdown() {
  const now = new Date();
  
  // 2. 計算毫秒差（需移除 diff = 0）
  const diff = 0;

  // 3. 如果時間到了
  if (diff <= 0) {
    document.getElementById("advout").innerHTML = "🎉 新年快樂！🎉";
    // 修正：設定背景圖片正確語法為 'url(圖片網址)'
    document.getElementById('adv').style.backgroundImage = "url('https://img95.699pic.com/photo/40152/0342.gif_wh300.gif')";
    return;
  }

  // 4. 計算剩餘天、時、分、秒
  const seconds = Math.floor(diff / 1000) % 60;
  const minutes = Math.floor(diff / (1000 * 60)) % 60;
  const hours = Math.floor(diff / (1000 * 60 * 60)) % 24;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  // 5. 更新 DOM
  document.getElementById("advout").innerHTML =
    `${days} 天<br>${hours} 時 ${minutes} 分 ${seconds} 秒`;
}

// 6. 設定每秒執行一次
setInterval(updateCountdown, 1000);
updateCountdown();