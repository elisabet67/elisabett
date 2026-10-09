/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Book, Member, LoanLog } from './types';

export const INITIAL_BOOKS: Book[] = [
  {
    id: 'BK-001',
    bookId: 'BK-001',
    title: '클린 코드 (Clean Code)',
    author: '로버트 C. 마틴',
    category: '기술/IT',
    status: 'borrowed',
    borrower: '김민준',
    borrowedAt: '2026-09-28',
    dueDate: '2026-10-12',
  },
  {
    id: 'BK-002',
    bookId: 'BK-002',
    title: '리팩터링 2판',
    author: '마틴 파울러',
    category: '기술/IT',
    status: 'available',
    borrower: null,
    dueDate: null,
  },
  {
    id: 'BK-003',
    bookId: 'BK-003',
    title: '불편한 편의점',
    author: '김호연',
    category: '문학/소설',
    status: 'available',
    borrower: null,
    dueDate: null,
  },
  {
    id: 'BK-004',
    bookId: 'BK-004',
    title: '돈의 심리학',
    author: '모건 하우절',
    category: '경제/경영',
    status: 'borrowed',
    borrower: '이지은',
    borrowedAt: '2026-10-02',
    dueDate: '2026-10-16',
  },
  {
    id: 'BK-005',
    bookId: 'BK-005',
    title: '코스모스 (Cosmos)',
    author: '칼 세이건',
    category: '자연과학',
    status: 'available',
    borrower: null,
    dueDate: null,
  },
  {
    id: 'BK-006',
    bookId: 'BK-006',
    title: '사피엔스 (Sapiens)',
    author: '유발 하라리',
    category: '인문/역사',
    status: 'available',
    borrower: null,
    dueDate: null,
  },
  {
    id: 'BK-007',
    bookId: 'BK-007',
    title: '모던 자바스크립트 Deep Dive',
    author: '이웅모',
    category: '기술/IT',
    status: 'borrowed',
    borrower: '박도현',
    borrowedAt: '2026-09-25',
    dueDate: '2026-10-09',
  },
  {
    id: 'BK-008',
    bookId: 'BK-008',
    title: '아몬드',
    author: '손원평',
    category: '문학/소설',
    status: 'available',
    borrower: null,
    dueDate: null,
  },
];

export const INITIAL_MEMBERS: Member[] = [
  { id: 'M-101', name: '김민준', email: 'minjun@example.com', phone: '010-1234-5678', borrowedCount: 1 },
  { id: 'M-102', name: '이지은', email: 'jieun@example.com', phone: '010-2345-6789', borrowedCount: 1 },
  { id: 'M-103', name: '박도현', email: 'dohyun@example.com', phone: '010-3456-7890', borrowedCount: 1 },
  { id: 'M-104', name: '최서연', email: 'seoyeon@example.com', phone: '010-4567-8901', borrowedCount: 0 },
  { id: 'M-105', name: '정우진', email: 'woojin@example.com', phone: '010-5678-9012', borrowedCount: 0 },
  { id: 'M-106', name: '한가은', email: 'gaeun@example.com', phone: '010-6789-0123', borrowedCount: 0 },
];

export const INITIAL_LOGS: LoanLog[] = [
  {
    id: 'LOG-001',
    bookId: 'BK-001',
    bookTitle: '클린 코드 (Clean Code)',
    memberName: '김민준',
    action: 'borrow',
    timestamp: '2026-09-28 14:20:00',
    dueDate: '2026-10-12',
  },
  {
    id: 'LOG-002',
    bookId: 'BK-004',
    bookTitle: '돈의 심리학',
    memberName: '이지은',
    action: 'borrow',
    timestamp: '2026-10-02 11:05:00',
    dueDate: '2026-10-16',
  },
  {
    id: 'LOG-003',
    bookId: 'BK-007',
    bookTitle: '모던 자바스크립트 Deep Dive',
    memberName: '박도현',
    action: 'borrow',
    timestamp: '2026-09-25 09:30:00',
    dueDate: '2026-10-09',
  },
  {
    id: 'LOG-004',
    bookId: 'BK-003',
    bookTitle: '불편한 편의점',
    memberName: '최서연',
    action: 'return',
    timestamp: '2026-09-24 16:45:00',
  },
];

export const CATEGORIES = [
  '전체',
  '기술/IT',
  '문학/소설',
  '인문/역사',
  '경제/경영',
  '자연과학',
  '자기계발',
  '예술/문화',
  '기타',
];
