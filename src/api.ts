/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Book, Member, LoanLog } from './types';
import { INITIAL_BOOKS, INITIAL_MEMBERS, INITIAL_LOGS } from './mockData';

export const DEFAULT_GAS_URL =
  'https://script.google.com/macros/s/AKfycbwWqK4-klzX2W09IKjHoVW_oxN0NsNiUTsO1F4esCroXtwkHJ4spRk8roa8hBrG-JX8/exec';

const STORAGE_KEY_GAS_URL = 'library_gas_url';
const STORAGE_KEY_LOCAL_BOOKS = 'library_local_books';
const STORAGE_KEY_LOCAL_MEMBERS = 'library_local_members';
const STORAGE_KEY_LOCAL_LOGS = 'library_local_logs';
const STORAGE_KEY_USE_DEMO = 'library_use_demo_mode';

export function getGasUrl(): string {
  return localStorage.getItem(STORAGE_KEY_GAS_URL) || DEFAULT_GAS_URL;
}

export function setGasUrl(url: string): void {
  localStorage.setItem(STORAGE_KEY_GAS_URL, url.trim());
}

export function isDemoMode(): boolean {
  return localStorage.getItem(STORAGE_KEY_USE_DEMO) === 'true';
}

export function setDemoMode(val: boolean): void {
  localStorage.setItem(STORAGE_KEY_USE_DEMO, val ? 'true' : 'false');
}

// Local persistence helpers for demo or offline fallback
export function getLocalBooks(): Book[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_LOCAL_BOOKS);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error(e);
  }
  return [...INITIAL_BOOKS];
}

export function saveLocalBooks(books: Book[]): void {
  localStorage.setItem(STORAGE_KEY_LOCAL_BOOKS, JSON.stringify(books));
}

export function getLocalMembers(): Member[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_LOCAL_MEMBERS);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error(e);
  }
  return [...INITIAL_MEMBERS];
}

export function saveLocalMembers(members: Member[]): void {
  localStorage.setItem(STORAGE_KEY_LOCAL_MEMBERS, JSON.stringify(members));
}

export function getLocalLogs(): LoanLog[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_LOCAL_LOGS);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error(e);
  }
  return [...INITIAL_LOGS];
}

export function saveLocalLogs(logs: LoanLog[]): void {
  localStorage.setItem(STORAGE_KEY_LOCAL_LOGS, JSON.stringify(logs));
}

// Helper to normalize books from various GAS response schemas
export function normalizeBooks(data: any): Book[] {
  if (!data) return [];
  const list = Array.isArray(data) ? data : data.books || data.data || [];
  if (!Array.isArray(list)) return [];

  return list.map((item: any, idx: number) => {
    const id = String(item.id || item.bookId || item['도서ID'] || item['도서아이디'] || `BK-${idx + 1}`);
    const title = String(item.title || item['제목'] || item['도서명'] || '제목 없음');
    const author = String(item.author || item['저자'] || item['지은이'] || '저자 미상');
    const category = String(item.category || item['카테고리'] || item['분류'] || '기타');
    
    // Normalize status
    const rawStatus = String(item.status || item['대출상태'] || item['상태'] || '대출가능').toLowerCase();
    const isBorrowed =
      rawStatus === 'borrowed' ||
      rawStatus === '대출중' ||
      rawStatus === '대출' ||
      rawStatus === '대여중' ||
      Boolean(item.borrower || item['대출자']);

    const borrower = item.borrower || item['대출자'] || null;
    const dueDate = item.dueDate || item['반납예정일'] || null;
    const borrowedAt = item.borrowedAt || item['대출일'] || null;

    return {
      id,
      bookId: id,
      title,
      author,
      category,
      status: isBorrowed ? 'borrowed' : 'available',
      borrower: isBorrowed ? borrower : null,
      dueDate: isBorrowed ? dueDate : null,
      borrowedAt: isBorrowed ? borrowedAt : null,
    };
  });
}

export function normalizeMembers(data: any): Member[] {
  if (!data) return [];
  const list = Array.isArray(data) ? data : data.members || data.data || [];
  if (!Array.isArray(list)) return [];

  return list.map((item: any, idx: number) => {
    return {
      id: String(item.id || item.memberId || `M-${idx + 1}`),
      name: String(item.name || item['이름'] || item['회원명'] || `회원 ${idx + 1}`),
      email: item.email || item['이메일'] || undefined,
      phone: item.phone || item['연락처'] || undefined,
      borrowedCount: Number(item.borrowedCount || item['대출권수'] || 0),
    };
  });
}

export function normalizeLogs(data: any): LoanLog[] {
  if (!data) return [];
  const list = Array.isArray(data) ? data : data.logs || data.data || [];
  if (!Array.isArray(list)) return [];

  return list.map((item: any, idx: number) => {
    const rawAction = String(item.action || item['구분'] || item['상태'] || item.type || 'borrow').toLowerCase();
    const action = rawAction.includes('return') || rawAction.includes('반납') ? 'return' : 'borrow';
    return {
      id: String(item.id || `LOG-${idx + 1}`),
      bookId: String(item.bookId || item['도서ID'] || ''),
      bookTitle: String(item.bookTitle || item.title || item['도서명'] || item['도서제목'] || '도서'),
      memberName: String(item.memberName || item.borrower || item['회원명'] || item['대출자'] || '이용자'),
      action,
      timestamp: String(item.timestamp || item.date || item['일시'] || item['날짜'] || new Date().toLocaleString()),
      dueDate: item.dueDate || item['반납예정일'] || undefined,
    };
  });
}

// Fetch with fallback logic
export async function apiGet<T>(action: string): Promise<{ data: T; isLive: boolean; error?: string }> {
  const url = getGasUrl();
  const demo = isDemoMode();

  if (demo) {
    if (action === 'getBooks') return { data: getLocalBooks() as unknown as T, isLive: false };
    if (action === 'getMembers') return { data: getLocalMembers() as unknown as T, isLive: false };
    if (action === 'getLogs') return { data: getLocalLogs() as unknown as T, isLive: false };
  }

  try {
    const endpoint = `${url}?action=${encodeURIComponent(action)}&_t=${Date.now()}`;
    const response = await fetch(endpoint, {
      method: 'GET',
      redirect: 'follow',
    });

    const text = await response.text();

    // Check if Google returned a sign-in or authorization required HTML page
    if (text.includes('accounts.google.com') || text.includes('drive-logo') || text.includes('需要存取權') || text.includes('<!DOCTYPE html>') || text.includes('<!doctype html>')) {
      throw new Error('GAS_AUTH_REQUIRED');
    }

    const json = JSON.parse(text);
    return { data: json, isLive: true };
  } catch (err: any) {
    const isAuth = err.message === 'GAS_AUTH_REQUIRED';
    console.warn(`[GAS GET ${action} Failed]:`, err.message || err);

    // Fallback to local data
    let fallbackData: any = [];
    if (action === 'getBooks') fallbackData = getLocalBooks();
    if (action === 'getMembers') fallbackData = getLocalMembers();
    if (action === 'getLogs') fallbackData = getLocalLogs();

    return {
      data: fallbackData as T,
      isLive: false,
      error: isAuth
        ? 'GAS 웹 앱 권한 설정(액세스 권한: 모든 사용자)이 필요합니다. 데모 데이터로 표시 중입니다.'
        : `네트워크 또는 CORS 오류: ${err.message || '요청 실패'}. 로컬 모드로 작동합니다.`,
    };
  }
}

export async function apiPost<T>(
  action: string,
  payload: any
): Promise<{ success: boolean; result?: any; isLive: boolean; error?: string; isAuthError?: boolean }> {
  const url = getGasUrl();
  const demo = isDemoMode();

  if (demo) {
    const local = handleLocalPost(action, payload);
    return { success: true, result: local.result, isLive: false, error: '데모 모드로 로컬에만 저장되었습니다.' };
  }

  try {
    // Note: sending text/plain prevents CORS preflight OPTIONS which Google Apps Script rejects
    const bodyContent = JSON.stringify({ action, payload });
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: bodyContent,
      redirect: 'follow',
    });

    const text = await response.text();

    if (
      text.includes('accounts.google.com') ||
      text.includes('需要存取權') ||
      text.includes('<!DOCTYPE html>') ||
      text.includes('drive-logo')
    ) {
      throw new Error('GAS_AUTH_REQUIRED');
    }

    let json;
    try {
      json = JSON.parse(text);
    } catch {
      json = { success: true, message: text };
    }

    // Also update local cache so UI remains in sync
    updateLocalAfterPost(action, payload);

    return { success: true, result: json, isLive: true };
  } catch (err: any) {
    console.warn(`[GAS POST ${action} Failed]:`, err.message || err);
    // Execute local fallback mutation so the UI shows the item locally
    const localResult = handleLocalPost(action, payload);

    const isAuth = err.message === 'GAS_AUTH_REQUIRED';
    return {
      success: false, // Mark as false for Google Sheets so user is informed!
      result: localResult.result,
      isLive: false,
      isAuthError: isAuth,
      error: isAuth
        ? '구글 시트(GAS) 배포 권한 오류: "액세스 권한: 모든 사용자(Anyone)" 설정이 필요합니다. 구글 시트에는 저장되지 않았으며 로컬 화면에만 임시 표시됩니다.'
        : `구글 시트 전송 실패 (${err.message}). 시트에 저장되지 못하고 로컬에만 반영되었습니다.`,
    };
  }
}

export async function testGasConnection(targetUrl?: string): Promise<{
  ok: boolean;
  status: 'CONNECTED' | 'AUTH_REQUIRED' | 'NETWORK_ERROR' | 'INVALID_JSON';
  message: string;
  details?: string;
}> {
  const url = targetUrl || getGasUrl();
  try {
    const res = await fetch(`${url}?action=getBooks&_t=${Date.now()}`, {
      method: 'GET',
      redirect: 'follow',
    });
    const text = await res.text();

    if (
      text.includes('accounts.google.com') ||
      text.includes('需要存取權') ||
      text.includes('drive-logo') ||
      text.includes('<!DOCTYPE html>') ||
      text.includes('<!doctype html>')
    ) {
      return {
        ok: false,
        status: 'AUTH_REQUIRED',
        message: 'Google 로그인 또는 접근 권한 필요 (액세스 권한: 모든 사용자로 재배포 필요)',
        details: text.slice(0, 300),
      };
    }

    try {
      const json = JSON.parse(text);
      const count = Array.isArray(json) ? json.length : (json.books || json.data || []).length;
      return {
        ok: true,
        status: 'CONNECTED',
        message: `정상 연결됨 (시트 내 도서 데이터 ${count}건 감지)`,
      };
    } catch {
      return {
        ok: false,
        status: 'INVALID_JSON',
        message: '응답을 JSON으로 파싱할 수 없습니다. Code.gs의 반환 형식을 확인하세요.',
        details: text.slice(0, 300),
      };
    }
  } catch (err: any) {
    return {
      ok: false,
      status: 'NETWORK_ERROR',
      message: `네트워크 또는 CORS 차단: ${err.message || '접속 불가'}`,
      details: String(err),
    };
  }
}

function handleLocalPost(action: string, payload: any) {
  const books = getLocalBooks();
  const members = getLocalMembers();
  const logs = getLocalLogs();
  const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);

  if (action === 'addBook') {
    const newBook: Book = {
      id: `BK-${String(books.length + 1).padStart(3, '0')}`,
      bookId: `BK-${String(books.length + 1).padStart(3, '0')}`,
      title: payload.title,
      author: payload.author,
      category: payload.category || '기타',
      status: 'available',
      borrower: null,
      dueDate: null,
    };
    books.unshift(newBook);
    saveLocalBooks(books);
    return { success: true, result: newBook, isLive: false };
  }

  if (action === 'borrowBook') {
    const bookIndex = books.findIndex((b) => b.id === payload.bookId || b.bookId === payload.bookId);
    if (bookIndex !== -1) {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 14); // 2 weeks default
      const dueDateStr = dueDate.toISOString().split('T')[0];

      books[bookIndex].status = 'borrowed';
      books[bookIndex].borrower = payload.memberName;
      books[bookIndex].borrowedAt = new Date().toISOString().split('T')[0];
      books[bookIndex].dueDate = dueDateStr;
      saveLocalBooks(books);

      // Add to logs
      const newLog: LoanLog = {
        id: `LOG-${Date.now()}`,
        bookId: payload.bookId,
        bookTitle: books[bookIndex].title,
        memberName: payload.memberName,
        action: 'borrow',
        timestamp: nowStr,
        dueDate: dueDateStr,
      };
      logs.unshift(newLog);
      saveLocalLogs(logs);

      // Check member
      const member = members.find((m) => m.name === payload.memberName);
      if (member) {
        member.borrowedCount = (member.borrowedCount || 0) + 1;
      } else {
        members.push({
          id: `M-${members.length + 1}`,
          name: payload.memberName,
          borrowedCount: 1,
        });
      }
      saveLocalMembers(members);
    }
    return { success: true, result: { bookId: payload.bookId }, isLive: false };
  }

  if (action === 'returnBook') {
    const bookIndex = books.findIndex((b) => b.id === payload.bookId || b.bookId === payload.bookId);
    if (bookIndex !== -1) {
      const oldBorrower = books[bookIndex].borrower || '이용자';
      books[bookIndex].status = 'available';
      books[bookIndex].borrower = null;
      books[bookIndex].borrowedAt = null;
      books[bookIndex].dueDate = null;
      saveLocalBooks(books);

      // Add to logs
      const newLog: LoanLog = {
        id: `LOG-${Date.now()}`,
        bookId: payload.bookId,
        bookTitle: books[bookIndex].title,
        memberName: oldBorrower,
        action: 'return',
        timestamp: nowStr,
      };
      logs.unshift(newLog);
      saveLocalLogs(logs);

      // Decrement member count
      const member = members.find((m) => m.name === oldBorrower);
      if (member && member.borrowedCount && member.borrowedCount > 0) {
        member.borrowedCount -= 1;
        saveLocalMembers(members);
      }
    }
    return { success: true, result: { bookId: payload.bookId }, isLive: false };
  }

  return { success: true, result: null, isLive: false };
}

function updateLocalAfterPost(action: string, payload: any) {
  handleLocalPost(action, payload);
}
