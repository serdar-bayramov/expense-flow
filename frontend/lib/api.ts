import axios from 'axios';

// Base API URL from environment variable
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Types for API responses
export interface User {
  id: number;
  email: string;
  full_name: string | null;
  unique_receipt_email: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface RegisterData {
  email: string;
  password: string;
  full_name?: string;
}

export interface LoginData {
  email: string;
  password: string;
}

// Auth API calls
export const authAPI = {
  // Register new user
  register: async (data: RegisterData): Promise<User> => {
    const response = await api.post('/api/v1/auth/register', data);
    return response.data;
  },

  // Login user
  login: async (data: LoginData): Promise<LoginResponse> => {
    // FastAPI expects form data for OAuth2, not JSON
    const formData = new URLSearchParams();
    formData.append('username', data.email);
    formData.append('password', data.password);

    const response = await api.post('/api/v1/auth/login', formData.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    return response.data;
  },

  // Get current user (requires token)
  me: async (token: string): Promise<User> => {
    const response = await api.get('/api/v1/users/me', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  },
};

// Receipt types
export type ExpenseCategory = 
  | 'Office Costs'
  | 'Travel Costs'
  | 'Clothing'
  | 'Staff Costs'
  | 'Stock and Materials'
  | 'Financial Costs'
  | 'Business Premises'
  | 'Advertising and Marketing'
  | 'Training and Development'
  | 'Other';

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'Office Costs',
  'Travel Costs',
  'Clothing',
  'Staff Costs',
  'Stock and Materials',
  'Financial Costs',
  'Business Premises',
  'Advertising and Marketing',
  'Training and Development',
  'Other',
];

export const EXPENSE_CATEGORY_OPTIONS = EXPENSE_CATEGORIES.map(cat => ({
  value: cat,
  label: cat,
}));

export interface Receipt {
  id: number;
  user_id: number;
  image_url: string;
  vendor: string | null;
  date: string | null;
  total_amount: number | null;
  tax_amount: number | null;
  items: string | null;
  category: ExpenseCategory | null;
  notes: string | null;
  is_business: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  ocr_raw_text: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface ReceiptUpdate {
  vendor?: string;
  date?: string;
  total_amount?: number;
  tax_amount?: number;
  items?: string;
  category?: ExpenseCategory;
  notes?: string;
  is_business?: number;
}

// Analytics types
export interface CategoryBreakdown {
  category: string;
  total: number;
  vat: number;
  count: number;
  percentage: number;
}

export interface MonthlyBreakdown {
  month: string;
  total: number;
  vat: number;
  count: number;
}

export interface AnalyticsResponse {
  total_amount: number;
  total_vat: number;
  receipt_count: number;
  categories: CategoryBreakdown[];
  monthly_breakdown: MonthlyBreakdown[];
}

// Receipts API calls
export const receiptsAPI = {
  // Get all receipts for current user
  getAll: async (token: string): Promise<Receipt[]> => {
    const response = await api.get('/api/v1/receipts', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  },

  // Get single receipt by ID
  getById: async (token: string, id: number): Promise<Receipt> => {
    const response = await api.get(`/api/v1/receipts/${id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  },

  // Upload new receipt
  upload: async (
    token: string,
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<Receipt> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post('/api/v1/receipts/upload', formData, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total) {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          onProgress?.(percentCompleted);
        }
      },
    });
    return response.data;
  },

  // Update receipt
  update: async (
    token: string,
    id: number,
    data: ReceiptUpdate
  ): Promise<Receipt> => {
    const response = await api.put(`/api/v1/receipts/${id}`, data, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  },

  // Delete receipt
  delete: async (token: string, id: number): Promise<void> => {
    await api.delete(`/api/v1/receipts/${id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  },

  // Approve receipt (change status from pending to completed)
  approve: async (token: string, id: number): Promise<Receipt> => {
    const response = await api.post(`/api/v1/receipts/${id}/approve`, {}, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  },

  // Get analytics
  getAnalytics: async (
    token: string,
    startDate?: string,
    endDate?: string
  ): Promise<AnalyticsResponse> => {
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);

    const response = await api.get(`/api/v1/receipts/analytics?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  },
};

export default api;