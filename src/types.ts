/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Book {
  id: string;
  bookId?: string;
  title: string;
  author: string;
  category: string;
  status: 'available' | 'borrowed';
  borrower?: string | null;
  dueDate?: string | null;
  borrowedAt?: string | null;
}

export interface Member {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  borrowedCount?: number;
}

export interface LoanLog {
  id: string;
  bookId: string;
  bookTitle: string;
  memberName: string;
  action: 'borrow' | 'return';
  timestamp: string;
  dueDate?: string;
}

export interface ApiResponse<T = any> {
  success?: boolean;
  data?: T;
  books?: Book[];
  members?: Member[];
  logs?: LoanLog[];
  message?: string;
  error?: string;
}
