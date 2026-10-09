/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const GAS_SAMPLE_CODE = `/**
 * [스마트 도서관 관리] Google Apps Script 백엔드 코드
 * 스프레드시트 > 확장 프로그램 > Apps Script 에 복사하여 붙여넣으세요.
 */

const SHEET_BOOKS = "도서목록";
const SHEET_MEMBERS = "회원목록";
const SHEET_LOGS = "대출이력";

// GET 요청 처리 (getBooks, getMembers, getLogs)
function doGet(e) {
  try {
    initSheetsIfNeeded();
    const action = (e && e.parameter && e.parameter.action) || "getBooks";
    let result = [];

    if (action === "getBooks") {
      result = getBooksList();
    } else if (action === "getMembers") {
      result = getMembersList();
    } else if (action === "getLogs") {
      result = getLogsList();
    } else {
      return responseJson({ success: false, error: "알 수 없는 action: " + action });
    }

    return responseJson(result);
  } catch (err) {
    return responseJson({ success: false, error: err.toString() });
  }
}

// POST 요청 처리 (addBook, borrowBook, returnBook)
function doPost(e) {
  try {
    initSheetsIfNeeded();
    let data;
    if (e.postData && e.postData.contents) {
      data = JSON.parse(e.postData.contents);
    } else if (e.parameter) {
      data = e.parameter;
    }

    const action = data.action;
    const payload = data.payload || {};
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    if (action === "addBook") {
      // 1. 도서 등록
      const sheet = ss.getSheetByName(SHEET_BOOKS);
      const lastRow = sheet.getLastRow();
      const newId = "BK-" + String(lastRow).padStart(3, "0");
      const title = payload.title || "제목 없음";
      const author = payload.author || "저자 미상";
      const category = payload.category || "기타";
      
      sheet.appendRow([newId, title, author, category, "대출가능", "", ""]);
      return responseJson({ success: true, message: "도서 등록 완료", bookId: newId });

    } else if (action === "borrowBook") {
      // 2. 도서 대출
      const sheet = ss.getSheetByName(SHEET_BOOKS);
      const dataRange = sheet.getDataRange().getValues();
      const bookId = payload.bookId;
      const memberName = payload.memberName;
      let foundRow = -1;

      for (let i = 1; i < dataRange.length; i++) {
        if (String(dataRange[i][0]) === String(bookId)) {
          foundRow = i + 1;
          break;
        }
      }

      if (foundRow === -1) {
        return responseJson({ success: false, error: "도서를 찾을 수 없습니다: " + bookId });
      }

      // 14일 후 반납예정일
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 14);
      const dueDateStr = Utilities.formatDate(dueDate, "Asia/Seoul", "yyyy-MM-dd");

      // 시트 컬럼 업데이트: 상태=대출중, 대출자=이름, 반납예정일=날짜
      sheet.getRange(foundRow, 5).setValue("대출중");
      sheet.getRange(foundRow, 6).setValue(memberName);
      sheet.getRange(foundRow, 7).setValue(dueDateStr);

      // 이력 시트에 기록
      const logsSheet = ss.getSheetByName(SHEET_LOGS);
      const nowStr = Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy-MM-dd HH:mm:ss");
      const bookTitle = dataRange[foundRow - 1][1] || "도서";
      logsSheet.appendRow(["LOG-" + Date.now(), bookId, bookTitle, memberName, "대출", nowStr, dueDateStr]);

      return responseJson({ success: true, message: "대출 완료", bookId: bookId, dueDate: dueDateStr });

    } else if (action === "returnBook") {
      // 3. 도서 반납
      const sheet = ss.getSheetByName(SHEET_BOOKS);
      const dataRange = sheet.getDataRange().getValues();
      const bookId = payload.bookId;
      let foundRow = -1;
      let borrower = "이용자";

      for (let i = 1; i < dataRange.length; i++) {
        if (String(dataRange[i][0]) === String(bookId)) {
          foundRow = i + 1;
          borrower = dataRange[i][5] || "이용자";
          break;
        }
      }

      if (foundRow === -1) {
        return responseJson({ success: false, error: "도서를 찾을 수 없습니다: " + bookId });
      }

      sheet.getRange(foundRow, 5).setValue("대출가능");
      sheet.getRange(foundRow, 6).setValue("");
      sheet.getRange(foundRow, 7).setValue("");

      // 이력 시트에 기록
      const logsSheet = ss.getSheetByName(SHEET_LOGS);
      const nowStr = Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy-MM-dd HH:mm:ss");
      const bookTitle = dataRange[foundRow - 1][1] || "도서";
      logsSheet.appendRow(["LOG-" + Date.now(), bookId, bookTitle, borrower, "반납", nowStr, ""]);

      return responseJson({ success: true, message: "반납 완료", bookId: bookId });
    }

    return responseJson({ success: false, error: "알 수 없는 action: " + action });
  } catch (err) {
    return responseJson({ success: false, error: err.toString() });
  }
}

// 헬퍼: 도서 목록 반환
function getBooksList() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_BOOKS);
  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return [];

  const books = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row[0] && !row[1]) continue;
    books.push({
      id: String(row[0]),
      title: String(row[1]),
      author: String(row[2]),
      category: String(row[3]),
      status: String(row[4]).includes("대출중") ? "borrowed" : "available",
      borrower: row[5] ? String(row[5]) : null,
      dueDate: row[6] ? Utilities.formatDate(new Date(row[6]), "Asia/Seoul", "yyyy-MM-dd") : null
    });
  }
  return books;
}

// 헬퍼: 회원 목록 반환
function getMembersList() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_MEMBERS);
  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return [];

  const members = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row[0] && !row[1]) continue;
    members.push({
      id: String(row[0]),
      name: String(row[1]),
      email: row[2] ? String(row[2]) : "",
      phone: row[3] ? String(row[3]) : ""
    });
  }
  return members;
}

// 헬퍼: 이력 목록 반환
function getLogsList() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_LOGS);
  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return [];

  const logs = [];
  for (let i = rows.length - 1; i >= 1; i--) {
    const row = rows[i];
    if (!row[0] && !row[1]) continue;
    logs.push({
      id: String(row[0]),
      bookId: String(row[1]),
      bookTitle: String(row[2]),
      memberName: String(row[3]),
      action: String(row[4]).includes("반납") ? "return" : "borrow",
      timestamp: String(row[5]),
      dueDate: row[6] ? String(row[6]) : ""
    });
  }
  return logs;
}

// 헬퍼: 시트 초기화 (없는 경우 자동 생성)
function initSheetsIfNeeded() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. 도서목록 시트
  let bSheet = ss.getSheetByName(SHEET_BOOKS);
  if (!bSheet) {
    bSheet = ss.insertSheet(SHEET_BOOKS);
    bSheet.appendRow(["도서ID", "제목", "저자", "카테고리", "대출상태", "대출자", "반납예정일"]);
    bSheet.getRange(1, 1, 1, 7).setBackground("#E2E8F0").setFontWeight("bold");
    // 샘플 도서 2권
    bSheet.appendRow(["BK-001", "클린 코드", "로버트 C. 마틴", "기술/IT", "대출가능", "", ""]);
    bSheet.appendRow(["BK-002", "불편한 편의점", "김호연", "문학/소설", "대출가능", "", ""]);
  }

  // 2. 회원목록 시트
  let mSheet = ss.getSheetByName(SHEET_MEMBERS);
  if (!mSheet) {
    mSheet = ss.insertSheet(SHEET_MEMBERS);
    mSheet.appendRow(["회원ID", "이름", "이메일", "연락처"]);
    mSheet.getRange(1, 1, 1, 4).setBackground("#E2E8F0").setFontWeight("bold");
    mSheet.appendRow(["M-001", "김민준", "minjun@example.com", "010-1234-5678"]);
    mSheet.appendRow(["M-002", "이지은", "jieun@example.com", "010-2345-6789"]);
  }

  // 3. 대출이력 시트
  let lSheet = ss.getSheetByName(SHEET_LOGS);
  if (!lSheet) {
    lSheet = ss.insertSheet(SHEET_LOGS);
    lSheet.appendRow(["이력ID", "도서ID", "도서명", "회원명", "구분", "일시", "반납예정일"]);
    lSheet.getRange(1, 1, 1, 7).setBackground("#E2E8F0").setFontWeight("bold");
  }
}

// 헬퍼: CORS 호환 JSON 응답
function responseJson(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
`;
