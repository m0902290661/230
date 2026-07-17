function doPost(e) {
  var output = ContentService.createTextOutput();
  
  try {
    var params = JSON.parse(e.postData.contents);
    var action = params.action;
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // --- 💡 新增動作九：忘記密碼 - 寄送 Email 驗證碼 ---
    if (action === "sendResetCode") {
      var sheet = ss.getSheetByName("users");
      if (!sheet) return output.setMimeType(ContentService.MimeType.JSON).setContent(JSON.stringify({ status: "fail", message: "找不到用戶資料表。" }));
      
      var username = params.username.toString().trim();
      var data = sheet.getDataRange().getValues();
      var userEmail = "";
      var rowIndex = -1;
      
      // 1. 尋找帳號與對應的 Email (假設：A欄帳號、E欄Email，如 updateProfile 所對應)
      for (var i = 1; i < data.length; i++) {
        if (data[i][0].toString().trim() === username) {
          userEmail = data[i][4] ? data[i][4].toString().trim() : ""; // 第 5 欄 (E欄)
          rowIndex = i + 1;
          break;
        }
      }
      
      if (rowIndex === -1) {
        return output.setMimeType(ContentService.MimeType.JSON).setContent(JSON.stringify({ status: "fail", message: "找不到該帳號，請確認輸入是否正確。" }));
      }
      
      if (!userEmail || userEmail.indexOf("@") === -1) {
        return output.setMimeType(ContentService.MimeType.JSON).setContent(JSON.stringify({ status: "fail", message: "該帳號尚未綁定有效的電子郵件，請聯繫管理員。" }));
      }
      
      // 2. 產生 6 位數隨機驗證碼
      var code = Math.floor(100000 + Math.random() * 900000).toString();
      
      // 3. 將驗證碼與有效時間（例如 10 分鐘後）暫存到 Google 屬性服務 (Properties Service)
      var scriptProperties = PropertiesService.getScriptProperties();
      var expireTime = new Date().getTime() + (10 * 60 * 1000); // 10 分鐘
      
      scriptProperties.setProperty("reset_" + username, JSON.stringify({ code: code, expire: expireTime }));
      
      // 4. 透過 GmailApp 寄送驗證碼信件
      try {
        var emailBody = "您好：\n\n您正在進行高二智系統的密碼重設申請。\n您的驗證碼為： " + code + " \n該驗證碼將於 10 分鐘後過期。\n\n如果非您本人操作，請忽略此郵件。";
        GmailApp.sendEmail(userEmail, "【高二智系統】密碼重設驗證碼", emailBody);
        
        // 為了安全性，隱碼處理前端顯示的 Email (例如: ex***le@mail.com)
        var emailParts = userEmail.split("@");
        var maskedEmail = emailParts[0].substring(0, 2) + "***" + "@" + emailParts[1];
        
        return output.setMimeType(ContentService.MimeType.JSON).setContent(JSON.stringify({ 
          status: "success", 
          message: "驗證碼已成功寄出！", 
          maskedEmail: maskedEmail 
        }));
      } catch (mailErr) {
        return output.setMimeType(ContentService.MimeType.JSON).setContent(JSON.stringify({ status: "fail", message: "郵件寄送失敗，請稍後再試或聯繫管理員。" }));
      }
    }

    // --- 💡 新增動作十：忘記密碼 - 驗證並重設密碼 ---
    if (action === "resetPassword") {
      var sheet = ss.getSheetByName("users");
      var username = params.username.toString().trim();
      var inputCode = params.code.toString().trim();
      var newPassword = params.newPassword.toString().trim();
      
      // 1. 取得剛剛儲存的驗證碼資訊
      var scriptProperties = PropertiesService.getScriptProperties();
      var savedDataStr = scriptProperties.getProperty("reset_" + username);
      
      if (!savedDataStr) {
        return output.setMimeType(ContentService.MimeType.JSON).setContent(JSON.stringify({ status: "fail", message: "驗證碼已失效或尚未申請，請重新獲取。" }));
      }
      
      var savedData = JSON.parse(savedDataStr);
      var currentTime = new Date().getTime();
      
      // 2. 檢查是否過期與驗證碼是否正確
      if (currentTime > savedData.expire) {
        scriptProperties.deleteProperty("reset_" + username); // 刪除過期資料
        return output.setMimeType(ContentService.MimeType.JSON).setContent(JSON.stringify({ status: "fail", message: "驗證碼已過期，請重新獲取。" }));
      }
      
      if (savedData.code !== inputCode) {
        return output.setMimeType(ContentService.MimeType.JSON).setContent(JSON.stringify({ status: "fail", message: "驗證碼錯誤，請重新輸入。" }));
      }
      
      // 3. 驗證成功，尋找該用戶並變更密碼 (B欄，第 2 欄)
      var data = sheet.getDataRange().getValues();
      var rowIndex = -1;
      for (var i = 1; i < data.length; i++) {
        if (data[i][0].toString().trim() === username) {
          rowIndex = i + 1;
          break;
        }
      }
      
      if (rowIndex === -1) {
        return output.setMimeType(ContentService.MimeType.JSON).setContent(JSON.stringify({ status: "fail", message: "找不到該帳號。" }));
      }
      
      // 寫入新密碼，並清除驗證碼
      sheet.getRange(rowIndex, 2).setValue(newPassword);
      scriptProperties.deleteProperty("reset_" + username);
      
      return output.setMimeType(ContentService.MimeType.JSON).setContent(JSON.stringify({ 
        status: "success", 
        message: "密碼重設成功！請使用新密碼登入。" 
      }));
    }
    // --- 動作一：登入驗證 ---
    if (action === "login") {
      var sheet = ss.getSheetByName("users");
      var data = sheet.getDataRange().getValues();
      var username = params.username;
      var password = params.password;
      var loginSuccess = false;
      var nickname = "";
      var isFirstLogin = false;
      var rowIndex = -1;

      for (var i = 1; i < data.length; i++) {
        if (data[i][0].toString() === username && data[i][1].toString() === password) {
          loginSuccess = true;
          nickname = data[i][2].toString();
          isFirstLogin = (data[i][3].toString().toLowerCase() === "true");
          rowIndex = i + 1;
          break;
        }
      }

      if (loginSuccess) {
        var result = { status: "success", message: "驗證成功！", nickname: nickname, isFirstLogin: isFirstLogin, rowIndex: rowIndex };
      } else {
        var result = { status: "fail", message: "帳號或密碼錯誤。" };
      }
      return output.setMimeType(ContentService.MimeType.JSON).setContent(JSON.stringify(result));
    }
    
    // --- 動作二：首次登入更新密碼與郵件 ---
    if (action === "updateProfile") {
      var sheet = ss.getSheetByName("users");
      var targetRow = params.rowIndex;
      var newPassword = params.newPassword;
      var email = params.email;
      
      if (!targetRow || targetRow <= 1) {
        return output.setMimeType(ContentService.MimeType.JSON).setContent(JSON.stringify({ status: "fail", message: "無效的用戶索引。" }));
      }
      
      sheet.getRange(targetRow, 2).setValue(newPassword);
      sheet.getRange(targetRow, 4).setValue(false);
      sheet.getRange(targetRow, 5).setValue(email);
      
      return output.setMimeType(ContentService.MimeType.JSON).setContent(JSON.stringify({ status: "success", message: "資料更新成功！" }));
    }

    // --- 動作三：抓取班級公告 ---
    if (action === "getAnnouncements") {
      var sheet = ss.getSheetByName("公告內容");
      if (!sheet) return output.setMimeType(ContentService.MimeType.JSON).setContent(JSON.stringify({ status: "fail", message: "找不到公告內容工作表" }));
      
      var data = sheet.getDataRange().getValues();
      var list = [];
      for (var i = data.length - 1; i >= 1; i--) {
        if (!data[i][0] && !data[i][2]) continue;
        var dateVal = data[i][0];
        var dateString = dateVal instanceof Date ? Utilities.formatDate(dateVal, Session.getScriptTimeZone(), "yyyy/MM/dd") : dateVal.toString();
        list.push({ date: dateString, author: data[i][1].toString(), title: data[i][2].toString(), content: data[i][3].toString() });
      }
      return output.setMimeType(ContentService.MimeType.JSON).setContent(JSON.stringify({ status: "success", data: list }));
    }

    // --- 💡 新增動作四：安全抓取個人「私人訊息」 ---
    if (action === "getPrivateMessages") {
      var sheet = ss.getSheetByName("私人訊息");
      if (!sheet) {
        return output.setMimeType(ContentService.MimeType.JSON).setContent(JSON.stringify({ status: "fail", message: "找不到私人訊息工作表" }));
      }
      
      var currentUser = params.username; // 前端傳過來的目前登入者帳號
      var data = sheet.getDataRange().getValues();
      var pMessages = [];
      
      // 從最新的資料開始往前撈
      for (var i = data.length - 1; i >= 1; i--) {
        // 核心安全機制：比對 C 欄 (索引 2) 是否等於目前登入的學生帳號
        if (data[i][2].toString().trim() === currentUser.toString().trim()) {
          var dateVal = data[i][0];
          var dateString = dateVal instanceof Date ? Utilities.formatDate(dateVal, Session.getScriptTimeZone(), "yyyy/MM/dd") : dateVal.toString();
          
          pMessages.push({
            date: dateString,
            sender: data[i][1].toString(), // 發信人
            title: data[i][3].toString(),  // 訊息主題
            content: data[i][4].toString() // 訊息內容
          });
        }
      }
      return output.setMimeType(ContentService.MimeType.JSON).setContent(JSON.stringify({ status: "success", data: pMessages }));
    }
    // --- 💡 大升級動作五：全科目當週總排名、單科明細與總分級距分析 ---
    if (action === "getScore") {
      var targetWeek = params.week;     
      var targetUser = params.username;   
      
      var subjects = ["國文", "英文", "數學", "歷史", "公民", "地理", "化學", "生物", "地科", "物理"]; 
      var allSubjectsData = [];
      var studentName = "";
      
      // 用來儲存「全班每位學生」在當週的「總得分」與「應考科目數」
      // 結構：{ "user01": { name: "張三", totalScore: 0, subjectCount: 0 } }
      var classTotalScoreMap = {}; 

      // 1. 穿透所有科目工作表，同時收集個人明細與全班總分
      for (var s = 0; s < subjects.length; s++) {
        var sheetName = subjects[s];
        var sheet = ss.getSheetByName(sheetName);
        if (!sheet) continue;

        var data = sheet.getDataRange().getValues();
        var headerRow = data[0];
        
        var colIndex = -1;
        for (var j = 2; j < headerRow.length; j++) {
          if (headerRow[j].toString().trim() === targetWeek.trim()) { colIndex = j; break; }
        }
        
        if (colIndex === -1) {
          allSubjectsData.push({ subject: sheetName, hasScore: false, msg: "尚未登錄" });
          continue;
        }

        var allScores = [];
        var studentScore = null;

        for (var i = 1; i < data.length; i++) {
          var uName = data[i][0].toString().trim();
          var sName = data[i][1].toString().trim();
          var scoreVal = data[i][colIndex];
          
          if (uName === targetUser.trim()) { studentName = sName; }

          // 初始化全班總分地圖
          if (!classTotalScoreMap[uName]) {
            classTotalScoreMap[uName] = { name: sName, totalScore: 0, subjectCount: 0 };
          }

          if (scoreVal !== "" && !isNaN(scoreVal)) {
            var numScore = Number(scoreVal);
            allScores.push(numScore);
            
            // 累加全班每個人當週的總分與考科數
            classTotalScoreMap[uName].totalScore += numScore;
            classTotalScoreMap[uName].subjectCount += 1;

            if (uName === targetUser.trim()) { studentScore = numScore; }
          }
        }

        // 計算單科統計
        if (studentScore !== null) {
          var totalStudents = allScores.length;
          var sum = allScores.reduce(function(a, b) { return a + b; }, 0);
          var average = (sum / totalStudents).toFixed(1);
          
          var avg = sum / totalStudents;
          var squareDiffs = allScores.map(function(v) { return (v - avg) * (v - avg); });
          var avgSquareDiff = squareDiffs.reduce(function(a, b) { return a + b; }, 0) / totalStudents;
          var stdDev = Math.sqrt(avgSquareDiff).toFixed(1);
          
          var rank = 1;
          for (var k = 0; k < allScores.length; k++) { if (allScores[k] > studentScore) rank++; }

          allSubjectsData.push({
            subject: sheetName, hasScore: true, myScore: studentScore,
            classAvg: average, classStdDev: stdDev, classRank: rank, classSize: totalStudents
          });
        } else {
          allSubjectsData.push({ subject: sheetName, hasScore: false, msg: "缺考或未登錄" });
        }
      }
      
      // 2. 💡 計算「當週總排名」與「全班平均總分級距」
      var allClassTotals = [];
      var myTotalScore = 0;
      var mySubjectCount = 0;
      
      // 定義總分平均級距計數器 (以全班每人當週的「平均分數」來做級距，這樣即使有人缺考一兩科也公平)
      // 級距：90以上, 80-89, 70-79, 60-69, 50-59, 50以下
      var intervals = { "90+": 0, "80-89": 0, "70-79": 0, "60-69": 0, "50-59": 0, "50-": 0 };

      for (var userKey in classTotalScoreMap) {
        var uData = classTotalScoreMap[userKey];
        if (uData.subjectCount > 0) {
          var userAvgInWeek = uData.totalScore / uData.subjectCount; // 算出該生當週平均分
          allClassTotals.push(userAvgInWeek);

          if (userKey === targetUser.trim()) {
            myTotalScore = uData.totalScore;
            mySubjectCount = uData.subjectCount;
          }

          // 歸類到級距
          if (userAvgInWeek >= 90) intervals["90+"]++;
          else if (userAvgInWeek >= 80) intervals["80-89"]++;
          else if (userAvgInWeek >= 70) intervals["70-79"]++;
          else if (userAvgInWeek >= 60) intervals["60-69"]++;
          else if (userAvgInWeek >= 50) intervals["50-59"]++;
          else intervals["50-"]++;
        }
      }

      // 計算總排名
      var myWeekAvg = mySubjectCount > 0 ? (myTotalScore / mySubjectCount) : 0;
      var totalRank = 1;
      for (var t = 0; t < allClassTotals.length; t++) {
        if (allClassTotals[t] > myWeekAvg) totalRank++;
      }

      return output.setMimeType(ContentService.MimeType.JSON).setContent(JSON.stringify({
        status: "success",
        studentName: studentName,
        week: targetWeek,
        data: allSubjectsData,
        // 額外附加的大數據包
        summary: {
          myTotalScore: myTotalScore,
          myWeekAvg: myWeekAvg.toFixed(1),
          totalRank: totalRank,
          totalClassSize: allClassTotals.length,
          intervals: intervals
        }
      }));
    }

    // --- 💡 新增動作六：接收前端提交的「問題回報」並寫入資料庫 ---
    if (action === "submitReport") {
      var sheet = ss.getSheetByName("問題回報");
      if (!sheet) return output.setMimeType(ContentService.MimeType.JSON).setContent(JSON.stringify({ status: "fail", message: "找不到問題回報工作表" }));
      
      var username = params.username;
      var nickname = params.nickname;
      var reportType = params.type;
      var content = params.content;
      
      // 驗證是否有空白欄位
      if (!content || content.trim() === "") {
        return output.setMimeType(ContentService.MimeType.JSON).setContent(JSON.stringify({ status: "fail", message: "回報內容不能為空！" }));
      }
      
      // 取得台灣時間戳記
      var timestamp = Utilities.formatDate(new Date(), "GMT+8", "yyyy/MM/dd HH:mm:ss");
      
      // 自動附加至工作表的最新一行 (時間, 帳號, 姓名, 類型, 內容, 預設狀態)
      sheet.appendRow([timestamp, username, nickname, reportType, content, "待處理"]);
      
      return output.setMimeType(ContentService.MimeType.JSON).setContent(JSON.stringify({
        status: "success",
        message: "問題已成功送出！謝謝您的回報，我們會盡快處理。"
      }));
    }

    if (action === "updateAccountSettings") {
      var sheet = ss.getSheetByName("帳號資料"); 
      if (!sheet) return output.setMimeType(ContentService.MimeType.JSON).setContent(JSON.stringify({ status: "fail", message: "找不到帳號資料表。" }));
      
      var targetUser = params.username.toString().trim();
      var oldPassword = params.oldPassword.toString().trim();
      var newPassword = params.newPassword.toString().trim();
      var newEmail = params.newEmail.toString().trim();
      
      var data = sheet.getDataRange().getValues();
      var userRowIndex = -1;
      
      // 1. 尋找學生所在的列
      for (var i = 1; i < data.length; i++) {
        if (data[i][0].toString().trim() === targetUser) {
          userRowIndex = i + 1; 
          break;
        }
      }
      
      if (userRowIndex === -1) {
        return output.setMimeType(ContentService.MimeType.JSON).setContent(JSON.stringify({ status: "fail", message: "找不到該帳號。" }));
      }
      
      // 2. 舊密碼安全核對 (B欄在陣列索引為 1)
      var currentPasswordInDb = data[userRowIndex - 1][1].toString().trim();
      if (currentPasswordInDb !== oldPassword) {
        return output.setMimeType(ContentService.MimeType.JSON).setContent(JSON.stringify({ status: "fail", message: "舊密碼輸入錯誤，拒絕修改！" }));
      }
      
      // 3. 執行寫入變更
      // 如果有填新密碼，更新 B 欄 (第 2 欄)
      if (newPassword !== "") {
        sheet.getRange(userRowIndex, 2).setValue(newPassword);
      }
      
      // 如果有填新郵箱，更新 E 欄 (第 5 欄)
      if (newEmail !== "") {
        sheet.getRange(userRowIndex, 5).setValue(newEmail);
      }
      
      // 💡 只要進行了帳戶設定，就將 D 欄 (第 4 欄) 的狀態改為 false (代表已設定/已登入過)
      sheet.getRange(userRowIndex, 4).setValue(false);
      
      // 判斷是否需要重新登入 (如果有改密碼就必須重登)
      var requireRelogin = (newPassword !== "");
      
      return output.setMimeType(ContentService.MimeType.JSON).setContent(JSON.stringify({
        status: "success",
        requireRelogin: requireRelogin,
        message: requireRelogin ? "設定成功！因密碼已變更，請用新密碼重新登入。" : "電子郵箱與帳戶狀態已成功更新！"
      }));
    }

    // --- 💡 新增動作八：抓取學習網站與課程資源 ---
    if (action === "getCourseResources") {
      var sheet = ss.getSheetByName("課程資源");
      if (!sheet) {
        return output.setMimeType(ContentService.MimeType.JSON).setContent(JSON.stringify({ status: "fail", message: "找不到課程資源工作表" }));
      }
      
      var data = sheet.getDataRange().getValues();
      var resourcesList = [];
      
      // 從第二行（i=1）開始讀取資料
      for (var i = 1; i < data.length; i++) {
        // 如果名稱和連結都是空的就跳過
        if (!data[i][1] && !data[i][3]) continue; 
        
        resourcesList.push({
          category: data[i][0].toString().trim(),    // 科目分類
          name: data[i][1].toString().trim(),        // 資源名稱
          description: data[i][2].toString().trim(), // 資源簡介
          url: data[i][3].toString().trim(),         // 網站連結
          icon: data[i][4] ? data[i][4].toString().trim() : "fa-book" // 圖標，預設為書本
        });
      }
      
      return output.setMimeType(ContentService.MimeType.JSON).setContent(JSON.stringify({ 
        status: "success", 
        data: resourcesList 
      }));
    }

    
  } catch(err) {
    return output.setMimeType(ContentService.MimeType.JSON).setContent(JSON.stringify({ status: "error", message: err.toString() }));
  }
}
