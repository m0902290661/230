// 設定跨年時間（台灣時間）
  const targetTime = new Date(new Date().getFullYear() + 1, 0, 1, 0, 0, 0);

  function updateCountdown() {
    const now = new Date();
    const diff = targetTime - now;

    if (diff <= 0) {
      document.getElementById("advout").innerHTML = "🎉 新年快樂！🎉";
      return;
    }

    const seconds = Math.floor(diff / 1000) % 60;
    const minutes = Math.floor(diff / (1000 * 60)) % 60;
    const hours = Math.floor(diff / (1000 * 60 * 60)) % 24;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    document.getElementById("advout").innerHTML =
      `${days} 天<br>${hours} 時 ${minutes} 分 ${seconds} 秒`;
  }

  setInterval(updateCountdown, 1000);
  updateCountdown();