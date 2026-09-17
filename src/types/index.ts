export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  created_at: string;
  updated_at: string;
}

export interface Student {
  id: string;
  teacher_id: string;
  student_code: string;
  full_name: string;
  date_of_birth?: string | null;
  gender?: 'male' | 'female' | 'other' | null;
  school_name?: string | null;
  school_class?: string | null;
  student_phone?: string | null;
  parent_name?: string | null;
  parent_phone?: string | null;
  address?: string | null;
  enrollment_date?: string | null;
  status: 'active' | 'inactive' | 'archived';
  note?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Class {
  id: string;
  teacher_id: string;
  class_code: string;
  class_name: string;
  subject?: string | null;
  grade?: string | null;
  academic_year?: string | null;
  tuition_type: 'per_session' | 'per_month' | 'course';
  tuition_amount: number;
  sessions_per_month: number;
  location?: string | null;
  status: 'active' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string;
}

export interface ClassSchedule {
  id: string;
  teacher_id: string;
  class_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  created_at: string;
  updated_at: string;
}

export interface StudentClass {
  id: string;
  teacher_id: string;
  student_id: string;
  class_id: string;
  join_date: string;
  custom_tuition?: number | null;
  status: 'active' | 'dropped';
  created_at: string;
  updated_at: string;
}

export interface ClassSession {
  id: string;
  class_id: string;
  teacher_id: string;
  session_date: string;
  start_time: string;
  end_time: string;
  lesson_title?: string | null;
  lesson_content?: string | null;
  homework?: string | null;
  note?: string | null;
  status: 'scheduled' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string;
}

export interface Attendance {
  id: string;
  session_id: string;
  student_id: string;
  status: 'present' | 'absent' | 'excused' | 'late' | 'makeup';
  note?: string | null;
  created_at: string;
  updated_at: string;
}

export interface TuitionRecord {
  id: string;
  student_id: string;
  class_id: string;
  teacher_id: string;
  month: number;
  year: number;
  amount_due: number;
  amount_paid: number;
  balance: number;
  status: 'unpaid' | 'partial' | 'paid';
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  tuition_id: string;
  student_id: string;
  teacher_id: string;
  amount: number;
  payment_date: string;
  payment_method: 'cash' | 'bank_transfer' | 'momo' | 'other';
  transaction_status: 'active' | 'cancelled';
  note?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AcademicResult {
  id: string;
  teacher_id: string;
  student_id: string;
  class_id: string;
  test_name: string;
  test_date: string;
  score: number;
  max_score: number;
  comment?: string | null;
  created_at: string;
  updated_at: string;
  student?: Student;
  class?: Class;
}

export interface StudentNote {
  id: string;
  teacher_id: string;
  student_id: string;
  class_id?: string | null;
  note_type: 'behavior' | 'academic' | 'general' | 'parent_meeting';
  content: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  student?: Student;
  class?: Class;
}
