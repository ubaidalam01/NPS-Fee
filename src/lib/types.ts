export type SchoolStatus = "pending" | "active" | "rejected" | "suspended";
export type UserRole = "school_admin" | "super_admin";
export type StudentStatus = "active" | "graduated" | "left";
export type FeeFrequency = "recurring" | "non_recurring";
export type VoucherStatus = "unpaid" | "paid";
export type PaymentStatus = "completed" | "reversed";

export interface School {
  id: string;
  name: string;
  logo_url: string | null;
  address: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  status: SchoolStatus;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  school_id: string | null;
  full_name: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface Student {
  id: string;
  school_id: string;
  name: string;
  father_name: string;
  /** DB column `class` (not class_name) */
  class: string;
  section: string;
  /** DB column `gr_no` (not roll_no) */
  gr_no: string;
  admission_date: string;
  monthly_tuition_fee: number;
  status: StudentStatus;
  created_at: string;
  updated_at: string;
}

export interface FeeHead {
  id: string;
  school_id: string;
  name: string;
  frequency: FeeFrequency;
  is_default: boolean;
  created_at: string;
}

export interface FeeStructureRow {
  id: string;
  school_id: string;
  /** DB column `class` on class_fee_structures */
  class: string;
  fee_head_id: string;
  amount: number;
  created_at: string;
  updated_at: string;
  fee_heads?: FeeHead;
}

export interface FeeVoucher {
  id: string;
  school_id: string;
  student_id: string;
  voucher_no: string;
  billing_month: string;
  total_amount: number;
  status: VoucherStatus;
  generated_at: string;
  students?: Student;
  voucher_items?: VoucherItem[];
}

export interface VoucherItem {
  id: string;
  voucher_id: string;
  school_id: string;
  fee_head_id: string | null;
  fee_head_name: string;
  amount: number;
}

export interface Payment {
  id: string;
  school_id: string;
  voucher_id: string;
  receipt_no: string;
  amount: number;
  paid_at: string;
  is_voided: boolean;
  voided_at: string | null;
  created_at: string;
  fee_vouchers?: FeeVoucher;
}

export interface PaymentReversal {
  id: string;
  school_id: string;
  payment_id: string;
  reason: string;
  reversed_at: string;
  reversed_by: string | null;
}

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  schoolId: string | null;
  schoolName: string | null;
  schoolStatus: SchoolStatus | null;
  schoolAddress: string | null;
  schoolPhone: string | null;
  schoolLogoUrl: string | null;
}

export const CLASS_OPTIONS = [
  "Nursery",
  "KG",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
] as const;

export const SECTION_OPTIONS = ["A", "B", "C", "D", "E"] as const;
