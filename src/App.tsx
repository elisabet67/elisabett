/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  BookOpen,
  Plus,
  Search,
  RotateCw,
  History,
  Users,
  CheckCircle2,
  Clock,
  Layers,
  LayoutGrid,
  List,
  ExternalLink,
  Copy,
  Download,
  Settings,
  AlertCircle,
  X,
  Check,
  Calendar,
  UserCheck,
  ShieldCheck,
  Sparkles,
  BookMarked,
  ArrowRight,
  Code2,
} from 'lucide-react';

import { Book, Member, LoanLog } from './types';
import {
  apiGet,
  apiPost,
  testGasConnection,
  getGasUrl,
  setGasUrl,
  isDemoMode,
  setDemoMode,
  normalizeBooks,
  normalizeMembers,
  normalizeLogs,
  DEFAULT_GAS_URL,
} from './api';
import { CATEGORIES } from './mockData';
import { getSingleFileHtmlContent } from './singleFileHtmlGenerator';
import { GAS_SAMPLE_CODE } from './gasBackendScript';

interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

export default function App() {
  // Core Data
  const [books, setBooks] = useState<Book[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [logs, setLogs] = useState<LoanLog[]>([]);

  // UI States
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [isLiveConnected, setIsLiveConnected] = useState<boolean>(false);
  const [connectionMessage, setConnectionMessage] = useState<string>('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('전체');
  const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'borrowed'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'title' | 'author'>('newest');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isBorrowModalOpen, setIsBorrowModalOpen] = useState(false);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [isLogsModalOpen, setIsLogsModalOpen] = useState(false);
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isExportHtmlModalOpen, setIsExportHtmlModalOpen] = useState(false);

  // Sync Warning Alert Modal
  const [syncAlertModal, setSyncAlertModal] = useState<{
    open: boolean;
    title: string;
    message: string;
    isAuth: boolean;
  } | null>(null);

  // Diagnostic states
  const [diagLoading, setDiagLoading] = useState(false);
  const [diagResult, setDiagResult] = useState<{
    ok: boolean;
    status: string;
    message: string;
    details?: string;
  } | null>(null);
  const [showGasCodeTab, setShowGasCodeTab] = useState(false);
  const [copiedGasCode, setCopiedGasCode] = useState(false);

  // Selected Item for Actions
  const [activeBook, setActiveBook] = useState<Book | null>(null);

  // Form states
  const [newTitle, setNewTitle] = useState('');
  const [newAuthor, setNewAuthor] = useState('');
  const [newCategory, setNewCategory] = useState('기술/IT');
  const [customCategory, setCustomCategory] = useState('');
  const [borrowMemberName, setBorrowMemberName] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Settings State
  const [currentGasUrl, setCurrentGasUrlState] = useState(getGasUrl());
  const [useDemo, setUseDemoState] = useState(isDemoMode());
  const [copiedHtml, setCopiedHtml] = useState(false);

  // Toasts
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3800);
  };

  // Initial Data Fetch
  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [booksResult, membersResult, logsResult] = await Promise.all([
        apiGet<any>('getBooks'),
        apiGet<any>('getMembers'),
        apiGet<any>('getLogs'),
      ]);

      const normalizedB = normalizeBooks(booksResult.data);
      const normalizedM = normalizeMembers(membersResult.data);
      const normalizedL = normalizeLogs(logsResult.data);

      setBooks(normalizedB);
      setMembers(normalizedM);
      setLogs(normalizedL);

      if (booksResult.isLive) {
        setIsLiveConnected(true);
        setConnectionMessage('구글 시트 (GAS) 실시간 연동 완료');
        if (isManualRefresh) addToast('구글 시트에서 최신 데이터를 갱신했습니다.', 'success');
      } else {
        setIsLiveConnected(false);
        setConnectionMessage(booksResult.error || '데모 / 로컬 모드로 작동 중');
        if (isManualRefresh) addToast(booksResult.error || '로컬 데이터를 새로고침했습니다.', 'info');
      }
    } catch (err: any) {
      console.error(err);
      addToast('데이터를 불러오는 중 오류가 발생했습니다.', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Filter & Search Logic
  const filteredBooks = useMemo(() => {
    return books
      .filter((book) => {
        // Category Filter
        if (selectedCategory !== '전체' && book.category !== selectedCategory) {
          return false;
        }
        // Status Filter
        if (statusFilter !== 'all' && book.status !== statusFilter) {
          return false;
        }
        // Search Filter (Title, Author, ID)
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchTitle = book.title.toLowerCase().includes(q);
          const matchAuthor = book.author.toLowerCase().includes(q);
          const matchId = (book.id || book.bookId || '').toLowerCase().includes(q);
          const matchBorrower = (book.borrower || '').toLowerCase().includes(q);
          return matchTitle || matchAuthor || matchId || matchBorrower;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'title') return a.title.localeCompare(b.title, 'ko');
        if (sortBy === 'author') return a.author.localeCompare(b.author, 'ko');
        return 0; // default order
      });
  }, [books, selectedCategory, statusFilter, searchQuery, sortBy]);

  // Statistics
  const stats = useMemo(() => {
    const total = books.length;
    const borrowed = books.filter((b) => b.status === 'borrowed').length;
    const available = total - borrowed;
    const borrowedRatio = total > 0 ? Math.round((borrowed / total) * 100) : 0;
    return { total, borrowed, available, borrowedRatio };
  }, [books]);

  // Handle Add Book
  const handleAddBook = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = newTitle.trim();
    const author = newAuthor.trim();
    const category = newCategory === '직접입력' ? customCategory.trim() : newCategory;

    if (!title || !author) {
      addToast('도서 제목과 저자를 입력해 주세요.', 'error');
      return;
    }

    setActionLoading(true);
    try {
      const payload = { title, author, category: category || '기타' };
      const res = await apiPost('addBook', payload);

      if (res.isLive) {
        addToast(`'${title}' 도서가 구글 시트에 실시간 등록되었습니다!`, 'success');
        setIsAddModalOpen(false);
        setNewTitle('');
        setNewAuthor('');
        setCustomCategory('');
        loadAllData(false);
      } else {
        setIsAddModalOpen(false);
        setNewTitle('');
        setNewAuthor('');
        setCustomCategory('');
        loadAllData(false);
        // Show detailed sync alert modal
        setSyncAlertModal({
          open: true,
          title: '⚠️ 구글 시트에 도서가 저장되지 않았습니다',
          message:
            res.error ||
            'Google Apps Script 배포 설정에서 "액세스 권한: 모든 사용자(Anyone)" 설정이 필요합니다. 현재 구글 로그인 페이지로 차단되어 스프레드시트에 행이 추가되지 않았습니다.',
          isAuth: Boolean(res.isAuthError),
        });
      }
    } catch (err: any) {
      addToast(`등록 오류: ${err.message}`, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Open Borrow Modal
  const openBorrowModal = (book: Book) => {
    setActiveBook(book);
    setBorrowMemberName('');
    setIsBorrowModalOpen(true);
  };

  // Handle Borrow Book Submit
  const handleBorrowSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBook) return;
    const memberName = borrowMemberName.trim();
    if (!memberName) {
      addToast('대출자 성명을 입력해주세요.', 'error');
      return;
    }

    setActionLoading(true);
    try {
      const payload = { bookId: activeBook.id || activeBook.bookId, memberName };
      const res = await apiPost('borrowBook', payload);

      if (res.isLive) {
        addToast(`'${activeBook.title}' 도서가 구글 시트에 [${memberName}]님 대출로 기록되었습니다.`, 'success');
        setIsBorrowModalOpen(false);
        setActiveBook(null);
        setBorrowMemberName('');
        loadAllData(false);
      } else {
        setIsBorrowModalOpen(false);
        setActiveBook(null);
        setBorrowMemberName('');
        loadAllData(false);
        setSyncAlertModal({
          open: true,
          title: '⚠️ 구글 시트에 대출 상태가 반영되지 않았습니다',
          message:
            res.error ||
            'Google Apps Script 권한 오류로 인해 스프레드시트에 저장되지 못했습니다. 화면(로컬)에는 임시 반영되었으나 구글 시트 반영을 위해서는 웹 앱 배포 권한 수정이 필요합니다.',
          isAuth: Boolean(res.isAuthError),
        });
      }
    } catch (err: any) {
      addToast(`대출 오류: ${err.message}`, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Open Return Modal
  const openReturnModal = (book: Book) => {
    setActiveBook(book);
    setIsReturnModalOpen(true);
  };

  // Handle Return Book Submit
  const handleReturnSubmit = async () => {
    if (!activeBook) return;

    setActionLoading(true);
    try {
      const payload = { bookId: activeBook.id || activeBook.bookId };
      const res = await apiPost('returnBook', payload);

      if (res.isLive) {
        addToast(`'${activeBook.title}' 도서 반납이 구글 시트에 실시간 반영되었습니다.`, 'success');
        setIsReturnModalOpen(false);
        setActiveBook(null);
        loadAllData(false);
      } else {
        setIsReturnModalOpen(false);
        setActiveBook(null);
        loadAllData(false);
        setSyncAlertModal({
          open: true,
          title: '⚠️ 구글 시트에 반납 상태가 반영되지 않았습니다',
          message:
            res.error ||
            'Google Apps Script 권한 오류로 인해 스프레드시트에 반납이 기록되지 못했습니다.',
          isAuth: Boolean(res.isAuthError),
        });
      }
    } catch (err: any) {
      addToast(`반납 오류: ${err.message}`, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Settings Save
  const handleSaveSettings = () => {
    setGasUrl(currentGasUrl);
    setDemoMode(useDemo);
    addToast('설정이 저장되었습니다. 데이터를 새로고침합니다.', 'success');
    setIsSettingsModalOpen(false);
    loadAllData(true);
  };

  // Single file HTML content
  const singleFileHtml = useMemo(() => {
    return getSingleFileHtmlContent(currentGasUrl || DEFAULT_GAS_URL);
  }, [currentGasUrl]);

  const handleCopySingleHtml = () => {
    navigator.clipboard.writeText(singleFileHtml);
    setCopiedHtml(true);
    addToast('단일 파일 HTML 코드가 클립보드에 복사되었습니다!', 'success');
    setTimeout(() => setCopiedHtml(false), 2500);
  };

  const handleDownloadSingleHtml = () => {
    const blob = new Blob([singleFileHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'library-management.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    addToast('library-management.html 파일이 다운로드되었습니다.', 'success');
  };

  // Helper for category colors
  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case '기술/IT':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case '문학/소설':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case '인문/역사':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case '경제/경영':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case '자연과학':
        return 'bg-cyan-50 text-cyan-700 border-cyan-200';
      case '자기계발':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white flex items-center justify-center shadow-md shadow-indigo-100">
              <BookMarked className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                  스마트 도서관 관리 시스템
                </h1>
                <span
                  onClick={() => setIsSettingsModalOpen(true)}
                  className={`cursor-pointer inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors ${
                    isLiveConnected
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                      : 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
                  }`}
                  title="클릭하여 GAS API 연동 설정 확인"
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isLiveConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                    }`}
                  />
                  {isLiveConnected ? 'GAS 실시간 연동' : '데모/로컬 모드'}
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">Google Apps Script Web App 연동</p>
            </div>
          </div>

          {/* Action Header Buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Refresh */}
            <button
              onClick={() => loadAllData(true)}
              disabled={refreshing}
              className="p-2 text-slate-600 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors"
              title="데이터 새로고침"
            >
              <RotateCw className={`w-5 h-5 ${refreshing ? 'animate-spin text-indigo-600' : ''}`} />
            </button>

            {/* Logs button */}
            <button
              onClick={() => setIsLogsModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <History className="w-4 h-4 text-slate-500" />
              <span className="hidden md:inline">이력 조회</span>
              {logs.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-slate-100 text-[10px] font-semibold text-slate-600">
                  {logs.length}
                </span>
              )}
            </button>

            {/* Members button */}
            <button
              onClick={() => setIsMembersModalOpen(true)}
              className="hidden lg:inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <Users className="w-4 h-4 text-slate-500" />
              <span>회원 목록</span>
              {members.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-slate-100 text-[10px] font-semibold text-slate-600">
                  {members.length}
                </span>
              )}
            </button>

            {/* Single File HTML Export Modal Button */}
            <button
              onClick={() => setIsExportHtmlModalOpen(true)}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors"
              title="단일 HTML 파일 코드 보기 및 다운로드"
            >
              <Code2 className="w-4 h-4" />
              <span>단일 HTML 추출</span>
            </button>

            {/* Settings button */}
            <button
              onClick={() => setIsSettingsModalOpen(true)}
              className="p-2 text-slate-600 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors"
              title="GAS API 연동 설정 및 가이드"
            >
              <Settings className="w-5 h-5" />
            </button>

            {/* Add Book Primary CTA */}
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] rounded-lg shadow-sm hover:shadow transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>새 도서 등록</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full space-y-6">
        {/* Connection Notice Banner if Not Live */}
        {!isLiveConnected && (
          <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-sm text-amber-900 shadow-xs">
            <div className="flex items-start gap-3">
              <div className="p-1.5 bg-amber-100 text-amber-700 rounded-lg shrink-0 mt-0.5">
                <AlertCircle className="w-4 h-4" />
              </div>
              <div>
                <p className="font-semibold text-amber-900">
                  Google Apps Script 권한 안내 및 데모 모드 작동 중
                </p>
                <p className="text-xs text-amber-700 mt-0.5">
                  구글 웹 앱 배포 시 <span className="font-semibold underline">[액세스 권한: 모든 사용자(Anyone)]</span>로 배포되어야 외부 브라우저에서 CORS 차단 없이 직접 통신할 수 있습니다. 현재 로컬 환경에서 도서 등록, 대출, 반납의 모든 동작을 완벽히 테스트하실 수 있습니다.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
              <button
                onClick={() => setIsSettingsModalOpen(true)}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
              >
                GAS 설정 & 가이드 보기
              </button>
            </div>
          </div>
        )}

        {/* Dashboard Statistics KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Total Books */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">전체 보유 도서</span>
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <Layers className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-bold text-slate-900">{stats.total}</span>
              <span className="text-xs text-slate-500 font-medium">권</span>
            </div>
            <div className="mt-2 text-[11px] text-slate-400">도서관 전체 등록 권수</div>
          </div>

          {/* Available Books */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">대출 가능</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-bold text-emerald-600">{stats.available}</span>
              <span className="text-xs text-slate-500 font-medium">권</span>
            </div>
            <div className="mt-2 text-[11px] text-emerald-600/80 font-medium">
              즉시 열람 및 대출 신청 가능
            </div>
          </div>

          {/* Borrowed Books */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">현재 대출 중</span>
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-bold text-amber-600">{stats.borrowed}</span>
              <span className="text-xs text-slate-500 font-medium">권</span>
              <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded ml-auto">
                {stats.borrowedRatio}%
              </span>
            </div>
            <div className="mt-2 text-[11px] text-slate-400">이용자 대출 중인 도서</div>
          </div>

          {/* Members / Logs */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">등록 회원 / 대출 기록</span>
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-bold text-indigo-600">{members.length}</span>
              <span className="text-xs text-slate-500 font-medium">명</span>
              <span className="text-xs text-slate-400 ml-auto">누적 이력 {logs.length}건</span>
            </div>
            <div className="mt-2 text-[11px] text-slate-400">구글 스프레드시트 동기화</div>
          </div>
        </div>

        {/* Search, Filter, & Controls Bar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="도서 제목, 저자, 도서 번호(ID), 대출자명 검색..."
                className="w-full pl-10 pr-9 py-2.5 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Filter Dropdowns and View Mode */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="all">전체 도서 상태</option>
                <option value="available">대출 가능만 보기</option>
                <option value="borrowed">대출 중만 보기</option>
              </select>

              {/* Sort By */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="newest">기본 순서</option>
                <option value="title">제목 가나다순</option>
                <option value="author">저자명순</option>
              </select>

              {/* View Mode Toggle */}
              <div className="border border-slate-200 rounded-xl p-0.5 flex bg-slate-50">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded-lg transition-colors ${
                    viewMode === 'grid'
                      ? 'text-indigo-600 bg-white shadow-xs font-semibold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                  title="카드 뷰"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  className={`p-1.5 rounded-lg transition-colors ${
                    viewMode === 'table'
                      ? 'text-indigo-600 bg-white shadow-xs font-semibold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                  title="테이블 뷰"
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
            {CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-full font-medium transition-all shrink-0 ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content State: Loading, Empty, or List */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-4">
            <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
            <div className="text-center">
              <p className="text-sm font-semibold text-slate-800">도서관 데이터를 불러오는 중...</p>
              <p className="text-xs text-slate-500 mt-1">구글 시트 API와 통신하고 있습니다.</p>
            </div>
          </div>
        ) : filteredBooks.length === 0 ? (
          <div className="py-16 bg-white rounded-2xl border border-dashed border-slate-300 text-center space-y-3 p-6">
            <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
              <BookOpen className="w-7 h-7" />
            </div>
            <h3 className="text-base font-semibold text-slate-800">일치하는 도서가 없습니다</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              검색어나 필터 조건을 변경해 보거나, 상단 '새 도서 등록' 버튼을 통해 새 책을 등록해보세요.
            </p>
            {(searchQuery || selectedCategory !== '전체' || statusFilter !== 'all') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('전체');
                  setStatusFilter('all');
                }}
                className="px-4 py-2 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
              >
                검색 필터 초기화
              </button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          /* Grid Card View */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredBooks.map((book) => {
              const isAvailable = book.status === 'available';
              return (
                <div
                  key={book.id || book.bookId}
                  className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs hover:shadow-md hover:border-slate-300 transition-all flex flex-col justify-between group"
                >
                  <div className="space-y-3">
                    {/* Top tags */}
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className={`text-[11px] font-medium px-2 py-0.5 rounded-md border ${getCategoryColor(
                          book.category
                        )}`}
                      >
                        {book.category}
                      </span>

                      {/* Status Badge */}
                      {isAvailable ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          대출 가능
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                          대출 중
                        </span>
                      )}
                    </div>

                    {/* Book Title & Author */}
                    <div>
                      <h3
                        className="font-bold text-slate-900 text-base leading-snug line-clamp-2 group-hover:text-indigo-600 transition-colors"
                        title={book.title}
                      >
                        {book.title}
                      </h3>
                      <p className="text-xs text-slate-500 mt-1 font-medium">{book.author}</p>
                    </div>

                    {/* Book Details Box */}
                    <div className="pt-2.5 border-t border-slate-100 text-xs space-y-1.5">
                      <div className="flex justify-between items-center text-slate-500">
                        <span>도서 번호</span>
                        <span className="font-mono text-slate-700 text-[11px] bg-slate-50 px-1.5 py-0.5 rounded">
                          {book.id || book.bookId}
                        </span>
                      </div>

                      {!isAvailable && (
                        <>
                          <div className="flex justify-between items-center text-slate-500">
                            <span>대출자</span>
                            <span className="font-semibold text-slate-800 flex items-center gap-1">
                              <UserCheck className="w-3.5 h-3.5 text-indigo-500" />
                              {book.borrower || '이용자'}
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-slate-500">
                            <span>반납예정일</span>
                            <span className="font-semibold text-amber-700 flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5 text-amber-500" />
                              {book.dueDate || '미정'}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Dynamic Action Button */}
                  <div className="mt-4 pt-3 border-t border-slate-100">
                    {isAvailable ? (
                      <button
                        onClick={() => openBorrowModal(book)}
                        className="w-full py-2.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm hover:shadow transition-all"
                      >
                        <BookOpen className="w-4 h-4" />
                        <span>대출하기</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => openReturnModal(book)}
                        className="w-full py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border border-slate-200 transition-colors"
                      >
                        <RotateCw className="w-3.5 h-3.5 text-slate-500" />
                        <span>반납하기</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Table View */
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 text-xs font-semibold">
                  <tr>
                    <th className="py-3.5 px-4">도서 ID</th>
                    <th className="py-3.5 px-4">제목</th>
                    <th className="py-3.5 px-4">저자</th>
                    <th className="py-3.5 px-4">카테고리</th>
                    <th className="py-3.5 px-4">대출 상태</th>
                    <th className="py-3.5 px-4">대출자</th>
                    <th className="py-3.5 px-4">반납예정일</th>
                    <th className="py-3.5 px-4 text-right">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredBooks.map((book) => {
                    const isAvailable = book.status === 'available';
                    return (
                      <tr key={book.id || book.bookId} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 font-mono text-xs text-slate-500">
                          {book.id || book.bookId}
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-slate-900 max-w-xs truncate">
                          {book.title}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600">{book.author}</td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-medium border ${getCategoryColor(
                              book.category
                            )}`}
                          >
                            {book.category}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          {isAvailable ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              대출 가능
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                              대출 중
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-slate-700 font-medium">
                          {book.borrower || '-'}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 text-xs">
                          {book.dueDate ? (
                            <span className="font-medium text-amber-700">{book.dueDate}</span>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          {isAvailable ? (
                            <button
                              onClick={() => openBorrowModal(book)}
                              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs"
                            >
                              대출하기
                            </button>
                          ) : (
                            <button
                              onClick={() => openReturnModal(book)}
                              className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold border border-slate-200"
                            >
                              반납하기
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* MODAL 1: 새 도서 등록 */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            onClick={() => !actionLoading && setIsAddModalOpen(false)}
          />
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl relative z-10 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-indigo-600">
                <Plus className="w-5 h-5" />
                <h3 className="font-bold text-slate-900 text-lg">새 도서 등록</h3>
              </div>
              <button
                onClick={() => !actionLoading && setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddBook} className="space-y-4 text-sm">
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  도서 제목 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="예: 클린 코드 (Clean Code)"
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  저자 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newAuthor}
                  onChange={(e) => setNewAuthor(e.target.value)}
                  placeholder="예: 로버트 C. 마틴"
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  카테고리 <span className="text-rose-500">*</span>
                </label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
                >
                  <option value="기술/IT">기술/IT</option>
                  <option value="문학/소설">문학/소설</option>
                  <option value="인문/역사">인문/역사</option>
                  <option value="경제/경영">경제/경영</option>
                  <option value="자연과학">자연과학</option>
                  <option value="자기계발">자기계발</option>
                  <option value="예술/문화">예술/문화</option>
                  <option value="기타">기타</option>
                  <option value="직접입력">직접 입력하기...</option>
                </select>
              </div>

              {newCategory === '직접입력' && (
                <div>
                  <label className="block font-medium text-slate-700 mb-1">카테고리 직접 입력</label>
                  <input
                    type="text"
                    required
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    placeholder="예: 인공지능, 요리, 철학 등"
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              )}

              <div className="pt-3 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  disabled={actionLoading}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  {actionLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>등록 중...</span>
                    </>
                  ) : (
                    <span>등록하기</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: 도서 대출 */}
      {isBorrowModalOpen && activeBook && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            onClick={() => !actionLoading && setIsBorrowModalOpen(false)}
          />
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl relative z-10 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-indigo-600">
                <BookOpen className="w-5 h-5" />
                <h3 className="font-bold text-slate-900 text-lg">도서 대출 신청</h3>
              </div>
              <button
                onClick={() => !actionLoading && setIsBorrowModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Target Book Info Preview */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                대출 대상 도서
              </span>
              <p className="text-sm font-bold text-slate-900">{activeBook.title}</p>
              <div className="flex items-center gap-2 text-slate-600 pt-0.5">
                <span>{activeBook.author}</span>
                <span>•</span>
                <span className="font-mono">{activeBook.id || activeBook.bookId}</span>
              </div>
            </div>

            <form onSubmit={handleBorrowSubmit} className="space-y-4 text-sm">
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  대출자 이름 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  list="memberSuggestionsReact"
                  value={borrowMemberName}
                  onChange={(e) => setBorrowMemberName(e.target.value)}
                  placeholder="대출자 성명을 입력하세요 (예: 김민준)"
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
                <datalist id="memberSuggestionsReact">
                  {members.map((m) => (
                    <option key={m.id} value={m.name}>
                      {m.email ? `${m.name} (${m.email})` : m.name}
                    </option>
                  ))}
                </datalist>
                <p className="text-xs text-slate-500 mt-1">
                  기존 등록된 회원을 선택하거나 새 대출자명을 직접 입력할 수 있습니다.
                </p>
              </div>

              <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 text-xs text-indigo-800 flex items-center gap-2.5">
                <Calendar className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>
                  기본 대출 기간은 오늘로부터 <strong>14일간</strong>이며, 구글 시트에 반납예정일이 자동
                  반영됩니다.
                </span>
              </div>

              <div className="pt-3 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setIsBorrowModalOpen(false)}
                  disabled={actionLoading}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  {actionLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>대출 처리 중...</span>
                    </>
                  ) : (
                    <span>대출 승인</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: 도서 반납 확인 */}
      {isReturnModalOpen && activeBook && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            onClick={() => !actionLoading && setIsReturnModalOpen(false)}
          />
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl relative z-10 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-amber-600">
                <RotateCw className="w-5 h-5" />
                <h3 className="font-bold text-slate-900 text-lg">도서 반납 확인</h3>
              </div>
              <button
                onClick={() => !actionLoading && setIsReturnModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-sm space-y-2">
              <p className="text-slate-500 text-xs">반납 처리 대상 도서</p>
              <p className="font-bold text-slate-900 text-base">{activeBook.title}</p>
              <div className="text-xs text-slate-600 space-y-1 pt-1">
                <p>
                  대출자: <span className="font-semibold text-slate-800">{activeBook.borrower || '이용자'}</span>
                </p>
                <p>
                  반납예정일: <span className="font-semibold text-amber-700">{activeBook.dueDate || '미정'}</span>
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600">
              반납 처리를 진행하면 도서 상태가 '대출 가능'으로 변경되고 구글 시트의 대출/반납 이력에 자동
              기록됩니다.
            </p>

            <div className="pt-3 flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setIsReturnModalOpen(false)}
                disabled={actionLoading}
                className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleReturnSubmit}
                disabled={actionLoading}
                className="px-5 py-2 bg-amber-600 text-white font-semibold rounded-xl hover:bg-amber-700 flex items-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                {actionLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>반납 처리 중...</span>
                  </>
                ) : (
                  <span>반납 완료</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: 이력 조회 (Logs Modal) */}
      {isLogsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            onClick={() => setIsLogsModalOpen(false)}
          />
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl relative z-10 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-indigo-600">
                <History className="w-5 h-5" />
                <h3 className="font-bold text-slate-900 text-lg">대출 및 반납 이력 조회</h3>
              </div>
              <button
                onClick={() => setIsLogsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 divide-y divide-slate-100 pr-1">
              {logs.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-sm">
                  기록된 대출/반납 이력이 없습니다.
                </div>
              ) : (
                logs.map((log) => {
                  const isBorrow = log.action === 'borrow';
                  return (
                    <div
                      key={log.id}
                      className="py-3 px-2 flex items-center justify-between hover:bg-slate-50/80 rounded-lg text-sm"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`px-2.5 py-1 rounded-md text-xs font-semibold ${
                            isBorrow
                              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          {isBorrow ? '대출' : '반납'}
                        </span>
                        <div>
                          <p className="font-semibold text-slate-900">{log.bookTitle}</p>
                          <p className="text-xs text-slate-500">
                            이용자: <span className="font-medium text-slate-700">{log.memberName}</span>
                            {log.dueDate && (
                              <span className="ml-2">| 반납예정: {log.dueDate}</span>
                            )}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs text-slate-400 font-mono">{log.timestamp}</span>
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setIsLogsModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: 회원 명단 (Members Modal) */}
      {isMembersModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            onClick={() => setIsMembersModalOpen(false)}
          />
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl relative z-10 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-indigo-600">
                <Users className="w-5 h-5" />
                <h3 className="font-bold text-slate-900 text-lg">도서관 회원 명단</h3>
              </div>
              <button
                onClick={() => setIsMembersModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 divide-y divide-slate-100">
              {members.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-sm">등록된 회원이 없습니다.</div>
              ) : (
                members.map((m) => (
                  <div key={m.id} className="py-3 px-2 flex items-center justify-between text-sm">
                    <div>
                      <p className="font-bold text-slate-900">{m.name}</p>
                      <p className="text-xs text-slate-500">
                        {m.email || '이메일 없음'} {m.phone && `• ${m.phone}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full">
                        대출 중 {m.borrowedCount || 0}권
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setIsMembersModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: GAS API 연동 설정 & 가이드 모달 */}
      {isSettingsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            onClick={() => setIsSettingsModalOpen(false)}
          />
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl relative z-10 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-indigo-600">
                <Settings className="w-5 h-5" />
                <h3 className="font-bold text-slate-900 text-lg">Google Apps Script 연동 설정</h3>
              </div>
              <button
                onClick={() => setIsSettingsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 space-y-4 pr-1 text-sm">
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Google Apps Script Web App URL
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={currentGasUrl}
                    onChange={(e) => setCurrentGasUrlState(e.target.value)}
                    placeholder="https://script.google.com/macros/s/.../exec"
                    className="flex-1 px-3.5 py-2 font-mono text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    disabled={diagLoading}
                    onClick={async () => {
                      setDiagLoading(true);
                      const res = await testGasConnection(currentGasUrl);
                      setDiagResult(res);
                      setDiagLoading(false);
                    }}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold shrink-0 flex items-center gap-1.5 transition-colors"
                  >
                    {diagLoading ? (
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    )}
                    <span>연결 진단</span>
                  </button>
                </div>
              </div>

              {/* Diagnostic Result Banner */}
              {diagResult && (
                <div
                  className={`p-3.5 rounded-xl border text-xs space-y-1 ${
                    diagResult.ok
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-rose-50 border-rose-200 text-rose-900'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold">
                    {diagResult.ok ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-600" />
                    )}
                    <span>진단 결과: {diagResult.status}</span>
                  </div>
                  <p className="text-slate-700">{diagResult.message}</p>
                  {!diagResult.ok && diagResult.status === 'AUTH_REQUIRED' && (
                    <div className="mt-2 p-2 bg-white/80 rounded-lg border border-rose-200 text-[11px] text-rose-800 leading-relaxed font-sans">
                      ⚠️ <strong>해결 방법:</strong> Apps Script 편집기 우측 상단 <strong>[배포] &gt; [배포 관리]</strong>에서 연필 아이콘을 누르고 <strong>[액세스 권한: 모든 사용자 (Anyone)]</strong>로 수정한 뒤 저장해주세요!
                    </div>
                  )}
                </div>
              )}

              {/* Toggle to view GAS Code.gs */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowGasCodeTab(!showGasCodeTab)}
                  className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100 flex items-center justify-between text-left text-xs font-semibold text-slate-700 transition-colors"
                >
                  <span className="flex items-center gap-1.5">
                    <Code2 className="w-4 h-4 text-indigo-600" />
                    완벽 호환 Google Apps Script 백엔드 코드 (Code.gs) 확인하기
                  </span>
                  <span className="text-indigo-600">{showGasCodeTab ? '접기 ▲' : '코드 보기 ▼'}</span>
                </button>

                {showGasCodeTab && (
                  <div className="p-3 bg-slate-900 text-slate-200 space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>스프레드시트 &gt; 확장 프로그램 &gt; Apps Script에 붙여넣기</span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(GAS_SAMPLE_CODE);
                          setCopiedGasCode(true);
                          setTimeout(() => setCopiedGasCode(false), 2000);
                        }}
                        className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-semibold flex items-center gap-1"
                      >
                        {copiedGasCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedGasCode ? '복사됨!' : '전체 복사'}</span>
                      </button>
                    </div>
                    <pre className="text-[10px] font-mono max-h-48 overflow-y-auto p-2 bg-slate-950 rounded text-slate-300 leading-relaxed whitespace-pre">
                      {GAS_SAMPLE_CODE}
                    </pre>
                  </div>
                )}
              </div>

              {/* Demo Mode Toggle */}
              <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <p className="font-semibold text-slate-900 text-xs">오프라인 데모 모드 강제 사용</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    구글 시트 연동 대신 브라우저 로컬 저장소로 빠른 테스트를 진행합니다.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={useDemo}
                  onChange={(e) => setUseDemoState(e.target.checked)}
                  className="w-5 h-5 accent-indigo-600 rounded cursor-pointer"
                />
              </div>

              {/* Troubleshooting Guide */}
              <div className="p-4 bg-indigo-50/70 border border-indigo-100 rounded-xl text-xs space-y-2 text-indigo-950">
                <p className="font-bold flex items-center gap-1.5 text-indigo-900">
                  <ShieldCheck className="w-4 h-4 text-indigo-600" />
                  구글 앱스 스크립트 배포 시 필수 체크 사항:
                </p>
                <ol className="list-decimal list-inside space-y-1.5 text-slate-700 leading-relaxed">
                  <li>
                    Apps Script 상단 <span className="font-semibold text-indigo-700">[배포] &gt; [배포 관리]</span>를 클릭합니다.
                  </li>
                  <li>
                    현재 배포 우측의 <strong>연필(수정) 아이콘</strong>을 클릭하거나 <strong>[새 배포]</strong>를 클릭합니다.
                  </li>
                  <li>
                    다음 사용자로 실행: <strong>나 (Me)</strong>
                  </li>
                  <li>
                    액세스 권한이 있는 사용자:{' '}
                    <strong className="text-rose-600 underline font-bold">모든 사용자 (Anyone)</strong> 필수!
                    <span className="text-[11px] block text-slate-500 ml-4">
                      ※ '나만' 또는 '내 도메인 사용자'로 설정되면 로그인 화면으로 리디렉션되어 스프레드시트에 행이 추가되지 않습니다.
                    </span>
                  </li>
                </ol>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex gap-2 justify-end">
              <button
                onClick={() => setIsSettingsModalOpen(false)}
                className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-50 text-xs font-semibold"
              >
                닫기
              </button>
              <button
                onClick={handleSaveSettings}
                className="px-5 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700 shadow-sm"
              >
                설정 저장 및 데이터 갱신
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SYNC WARNING ALERT MODAL (구글 시트 저장 실패 안내) */}
      {syncAlertModal && syncAlertModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            onClick={() => setSyncAlertModal(null)}
          />
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl relative z-10 space-y-4 border border-rose-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-rose-600">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <h3 className="font-bold text-slate-900 text-base">{syncAlertModal.title}</h3>
              </div>
              <button onClick={() => setSyncAlertModal(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-700 leading-relaxed">
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 space-y-1">
                <p className="font-semibold">{syncAlertModal.message}</p>
                <p className="text-[11px] text-rose-700">
                  웹 화면(로컬 브라우저)에는 즉시 표시되지만, <strong>실제 구글 시트에는 저장되지 않았습니다.</strong>
                </p>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <p className="font-bold text-slate-900 text-xs">🚀 30초 안에 구글 시트 저장 해결하기:</p>
                <ol className="list-decimal list-inside space-y-1.5 text-slate-600">
                  <li>Google 스프레드시트 상단 메뉴 <strong>[확장 프로그램] &gt; [Apps Script]</strong>를 엽니다.</li>
                  <li>우측 상단 <strong>[배포] &gt; [배포 관리]</strong>를 클릭합니다.</li>
                  <li>현재 활성 배포 우측의 <strong>연필(수정) 아이콘</strong>을 누릅니다.</li>
                  <li>
                    <strong>[액세스 권한이 있는 사용자]</strong>를 <span className="text-rose-600 font-bold underline">'모든 사용자 (Anyone)'</span>로 변경 후 <strong>[배포]</strong>를 클릭합니다!
                  </li>
                </ol>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  setSyncAlertModal(null);
                  setIsSettingsModalOpen(true);
                }}
                className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-semibold"
              >
                연결 진단 및 설정 열기
              </button>
              <button
                onClick={() => setSyncAlertModal(null)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold shadow-xs"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 7: 단일 HTML 파일 코드 보기 / 복사 / 다운로드 */}
      {isExportHtmlModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            onClick={() => setIsExportHtmlModalOpen(false)}
          />
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl relative z-10 space-y-4 max-h-[88vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-indigo-600">
                <Code2 className="w-5 h-5" />
                <h3 className="font-bold text-slate-900 text-lg">
                  단일 파일 HTML (HTML+CSS+JS) 코드 내보내기
                </h3>
              </div>
              <button
                onClick={() => setIsExportHtmlModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-slate-600 space-y-1">
              <p>
                사용자 요청 사항인 <strong>"단일 파일 HTML (HTML+CSS+JS) 코드"</strong>가 완벽하게 준비되었습니다.
              </p>
              <p className="text-slate-500">
                Tailwind CSS CDN, Lucide Icons, 대시보드 UI, 도서 등록/대출/반납 POST API, GET 목록 조회 로직이 모두 하나의 파일에 압축되어 있습니다.
              </p>
            </div>

            {/* Action Bar */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleCopySingleHtml}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
              >
                {copiedHtml ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copiedHtml ? '복사 완료!' : '전체 코드 복사하기'}</span>
              </button>
              <button
                onClick={handleDownloadSingleHtml}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold border border-slate-300 transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>index.html 파일 다운로드</span>
              </button>
              <a
                href="/standalone-library.html"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold border border-slate-300 transition-colors ml-auto"
              >
                <ExternalLink className="w-4 h-4" />
                <span>새 탭에서 열기</span>
              </a>
            </div>

            {/* Code View Preview */}
            <div className="flex-1 overflow-hidden rounded-xl border border-slate-200 bg-slate-900 text-slate-200 font-mono text-xs">
              <div className="bg-slate-800 px-4 py-2 border-b border-slate-700 flex justify-between items-center text-[11px] text-slate-400">
                <span>index.html (단일 파일 완전체)</span>
                <span>{singleFileHtml.length.toLocaleString()} bytes</span>
              </div>
              <pre className="p-4 overflow-y-auto max-h-[380px] text-slate-300 text-[11px] leading-relaxed whitespace-pre font-mono">
                {singleFileHtml}
              </pre>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setIsExportHtmlModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notification Stack */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none max-w-sm w-full">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg text-xs sm:text-sm font-medium transition-all transform animate-in fade-in slide-in-from-bottom-2 duration-200 ${
              toast.type === 'success'
                ? 'bg-emerald-600 text-white'
                : toast.type === 'error'
                ? 'bg-rose-600 text-white'
                : 'bg-slate-800 text-white'
            }`}
          >
            {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 shrink-0" />}
            {toast.type === 'error' && <AlertCircle className="w-4 h-4 shrink-0" />}
            {toast.type === 'info' && <Sparkles className="w-4 h-4 shrink-0" />}
            <span className="flex-1 leading-snug">{toast.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
