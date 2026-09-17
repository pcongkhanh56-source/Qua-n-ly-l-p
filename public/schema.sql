-- ==============================================================================
-- THẦY KHANH – QUẢN LÝ HỌC SINH DẠY THÊM
-- Database Schema for Supabase
-- Run this entire script in Supabase SQL Editor.
-- ==============================================================================

-- Bật extension UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================================================
-- 1. HÀM CƠ SỞ (FUNCTIONS)
-- ==============================================================================

-- Function cập nhật cột updated_at tự động
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function tạo mã học sinh tự động (Ví dụ: HS240001)
CREATE OR REPLACE FUNCTION generate_student_code() 
RETURNS TRIGGER AS $$
DECLARE
    next_seq INT;
BEGIN
    IF NEW.student_code IS NULL OR NEW.student_code = '' THEN
        -- Đếm số học sinh hiện tại của giáo viên để tạo số thứ tự
        SELECT count(*) + 1 INTO next_seq FROM students WHERE teacher_id = NEW.teacher_id;
        NEW.student_code := 'HS' || to_char(now(), 'YY') || lpad(next_seq::text, 4, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function tạo hàng loạt buổi học trong tháng dựa vào lịch học
CREATE OR REPLACE FUNCTION create_monthly_sessions(p_class_id UUID, p_month INT, p_year INT)
RETURNS INT AS $$
DECLARE
    v_teacher_id UUID;
    v_start_date DATE;
    v_end_date DATE;
    v_inserted_count INT := 0;
BEGIN
    -- Lấy teacher_id của lớp để áp dụng RLS
    SELECT teacher_id INTO v_teacher_id FROM classes WHERE id = p_class_id;
    
    v_start_date := make_date(p_year, p_month, 1);
    v_end_date := (v_start_date + interval '1 month' - interval '1 day')::date;
    
    INSERT INTO sessions (class_id, teacher_id, session_date, start_time, end_time, status)
    SELECT 
        cs.class_id,
        v_teacher_id,
        d.date,
        cs.start_time,
        cs.end_time,
        'scheduled'
    FROM class_schedules cs
    CROSS JOIN generate_series(v_start_date, v_end_date, '1 day'::interval) d(date)
    WHERE cs.class_id = p_class_id
      -- extract(isodow): 1 = Thứ 2, 7 = Chủ nhật
      AND extract(isodow from d.date) = cs.day_of_week 
    ON CONFLICT DO NOTHING;
    
    GET DIAGNOSTICS v_inserted_count = ROW_COUNT;
    RETURN v_inserted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function cập nhật công nợ học phí khi có thanh toán
CREATE OR REPLACE FUNCTION update_tuition_after_payment() 
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.transaction_status = 'active' THEN
        UPDATE student_tuition
        SET amount_paid = amount_paid + NEW.amount,
            balance = amount_due - (amount_paid + NEW.amount),
            status = CASE 
                        WHEN amount_due - (amount_paid + NEW.amount) <= 0 THEN 'paid'
                        WHEN (amount_paid + NEW.amount) > 0 THEN 'partial'
                        ELSE 'unpaid'
                     END,
            updated_at = timezone('utc'::text, now())
        WHERE id = NEW.tuition_id;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Xử lý khi giao dịch bị hủy (cancelled)
        IF OLD.transaction_status = 'active' AND NEW.transaction_status = 'cancelled' THEN
            UPDATE student_tuition
            SET amount_paid = amount_paid - OLD.amount,
                balance = amount_due - (amount_paid - OLD.amount),
                status = CASE 
                            WHEN amount_due - (amount_paid - OLD.amount) <= 0 THEN 'paid'
                            WHEN (amount_paid - OLD.amount) > 0 THEN 'partial'
                            ELSE 'unpaid'
                         END,
                updated_at = timezone('utc'::text, now())
            WHERE id = NEW.tuition_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ==============================================================================
-- 2. TẠO CÁC BẢNG (TABLES) VÀ POLICIES
-- ==============================================================================

-- ---------------------------------------------------------
-- 1. PROFILES (Hồ sơ giáo viên)
-- ---------------------------------------------------------
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    role TEXT DEFAULT 'teacher' CHECK (role IN ('teacher', 'admin')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teacher full access to own profile" ON profiles 
    FOR ALL USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles 
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Tự động tạo profile khi đăng ký
CREATE OR REPLACE FUNCTION handle_new_user() RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name');
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE handle_new_user();

-- ---------------------------------------------------------
-- 2. STUDENTS (Học sinh)
-- ---------------------------------------------------------
CREATE TABLE students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    student_code TEXT NOT NULL,
    full_name TEXT NOT NULL,
    date_of_birth DATE,
    gender TEXT CHECK (gender IN ('male', 'female', 'other')),
    school_name TEXT,
    school_class TEXT,
    student_phone TEXT,
    parent_name TEXT,
    parent_phone TEXT,
    address TEXT,
    enrollment_date DATE DEFAULT CURRENT_DATE,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
    UNIQUE(teacher_id, student_code)
);

ALTER TABLE students ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teacher full access to students" ON students 
    FOR ALL USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid());

CREATE TRIGGER update_students_updated_at BEFORE UPDATE ON students FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER on_student_insert_generate_code BEFORE INSERT ON students FOR EACH ROW EXECUTE PROCEDURE generate_student_code();

-- ---------------------------------------------------------
-- 3. CLASSES (Lớp học)
-- ---------------------------------------------------------
CREATE TABLE classes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    class_code TEXT NOT NULL,
    class_name TEXT NOT NULL,
    subject TEXT,
    grade TEXT,
    academic_year TEXT,
    tuition_type TEXT DEFAULT 'per_month' CHECK (tuition_type IN ('per_session', 'per_month', 'course')),
    tuition_amount NUMERIC(12,2) DEFAULT 0,
    sessions_per_month INT DEFAULT 4,
    location TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
    UNIQUE(teacher_id, class_code)
);

ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teacher full access to classes" ON classes 
    FOR ALL USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid());

CREATE TRIGGER update_classes_updated_at BEFORE UPDATE ON classes FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- ---------------------------------------------------------
-- 4. CLASS_SCHEDULES (Lịch học định kỳ)
-- ---------------------------------------------------------
CREATE TABLE class_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 1 AND 7), -- 1: T2, 7: CN
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE class_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teacher full access to class_schedules" ON class_schedules 
    FOR ALL USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid());

CREATE TRIGGER update_class_schedules_updated_at BEFORE UPDATE ON class_schedules FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- ---------------------------------------------------------
-- 5. STUDENT_CLASSES (Học sinh - Lớp học)
-- ---------------------------------------------------------
CREATE TABLE student_classes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    join_date DATE DEFAULT CURRENT_DATE,
    custom_tuition NUMERIC(12,2), -- Nếu học phí khác với học phí chung của lớp
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'dropped')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
    UNIQUE(student_id, class_id) -- Không cho học sinh đăng ký trùng 1 lớp
);

ALTER TABLE student_classes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teacher full access to student_classes" ON student_classes 
    FOR ALL USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid());

CREATE TRIGGER update_student_classes_updated_at BEFORE UPDATE ON student_classes FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- ---------------------------------------------------------
-- 6. SESSIONS (Buổi học thực tế)
-- ---------------------------------------------------------
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    session_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    lesson_title TEXT,
    lesson_content TEXT,
    homework TEXT,
    note TEXT,
    status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(class_id, session_date, start_time)
);

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teacher full access to sessions" ON sessions 
    FOR ALL USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid());

CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON sessions FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- ---------------------------------------------------------
-- 7. ATTENDANCE (Điểm danh)
-- ---------------------------------------------------------
CREATE TABLE attendance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('present', 'absent_with_leave', 'absent_without_leave', 'late')),
    check_in_time TIMESTAMP WITH TIME ZONE,
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
    UNIQUE(session_id, student_id)
);

ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teacher full access to attendance" ON attendance 
    FOR ALL USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid());

CREATE TRIGGER update_attendance_updated_at BEFORE UPDATE ON attendance FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- ---------------------------------------------------------
-- 8. TUITION_PERIODS (Kỳ học phí)
-- ---------------------------------------------------------
CREATE TABLE tuition_periods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL, -- vd: "Tháng 9/2023"
    month INT CHECK (month BETWEEN 1 AND 12),
    year INT,
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE tuition_periods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teacher full access to tuition_periods" ON tuition_periods 
    FOR ALL USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid());

CREATE TRIGGER update_tuition_periods_updated_at BEFORE UPDATE ON tuition_periods FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- ---------------------------------------------------------
-- 9. STUDENT_TUITION (Học phí - Công nợ học sinh)
-- ---------------------------------------------------------
CREATE TABLE student_tuition (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    month INT CHECK (month BETWEEN 1 AND 12),
    year INT,
    amount_due NUMERIC(12,2) DEFAULT 0,
    amount_paid NUMERIC(12,2) DEFAULT 0,
    balance NUMERIC(12,2) DEFAULT 0,
    status TEXT DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'partial', 'paid')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
    UNIQUE(student_id, class_id, month, year)
);

ALTER TABLE student_tuition ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teacher full access to student_tuition" ON student_tuition 
    FOR ALL USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid());

CREATE TRIGGER update_student_tuition_updated_at BEFORE UPDATE ON student_tuition FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- ---------------------------------------------------------
-- 10. PAYMENTS (Giao dịch thanh toán)
-- ---------------------------------------------------------
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
    tuition_id UUID REFERENCES student_tuition(id) ON DELETE SET NULL,
    amount NUMERIC(12,2) NOT NULL,
    payment_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    payment_method TEXT CHECK (payment_method IN ('cash', 'bank_transfer', 'momo', 'other')),
    note TEXT,
    transaction_status TEXT DEFAULT 'active' CHECK (transaction_status IN ('active', 'cancelled')),
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teacher full access to payments" ON payments 
    FOR ALL USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid());

CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER after_payment_update_tuition AFTER INSERT OR UPDATE ON payments FOR EACH ROW EXECUTE PROCEDURE update_tuition_after_payment();

-- ---------------------------------------------------------
-- 11. ACADEMIC_RESULTS (Kết quả học tập)
-- ---------------------------------------------------------
CREATE TABLE academic_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    test_name TEXT NOT NULL,
    test_date DATE,
    score NUMERIC(5,2),
    max_score NUMERIC(5,2) DEFAULT 10,
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE academic_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teacher full access to academic_results" ON academic_results 
    FOR ALL USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid());

CREATE TRIGGER update_academic_results_updated_at BEFORE UPDATE ON academic_results FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- ---------------------------------------------------------
-- 12. STUDENT_NOTES (Ghi chú học sinh)
-- ---------------------------------------------------------
CREATE TABLE student_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
    note_type TEXT CHECK (note_type IN ('behavior', 'academic', 'general', 'parent_meeting')),
    content TEXT NOT NULL,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE student_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teacher full access to student_notes" ON student_notes 
    FOR ALL USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid());

CREATE TRIGGER update_student_notes_updated_at BEFORE UPDATE ON student_notes FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- ==============================================================================
-- 3. TẠO INDEXES TỐI ƯU TRUY VẤN
-- ==============================================================================
CREATE INDEX idx_profiles_id ON profiles(id);
CREATE INDEX idx_students_teacher_id ON students(teacher_id);
CREATE INDEX idx_students_full_name ON students(full_name);
CREATE INDEX idx_students_parent_phone ON students(parent_phone);
CREATE INDEX idx_classes_teacher_id ON classes(teacher_id);
CREATE INDEX idx_class_schedules_class_id ON class_schedules(class_id);
CREATE INDEX idx_student_classes_student_id ON student_classes(student_id);
CREATE INDEX idx_student_classes_class_id ON student_classes(class_id);
CREATE INDEX idx_sessions_class_id ON sessions(class_id);
CREATE INDEX idx_sessions_session_date ON sessions(session_date);
CREATE INDEX idx_attendance_session_id ON attendance(session_id);
CREATE INDEX idx_attendance_student_id ON attendance(student_id);
CREATE INDEX idx_student_tuition_student_id ON student_tuition(student_id);
CREATE INDEX idx_student_tuition_class_id ON student_tuition(class_id);
CREATE INDEX idx_payments_student_id ON payments(student_id);
CREATE INDEX idx_payments_payment_date ON payments(payment_date);
CREATE INDEX idx_academic_results_student_id ON academic_results(student_id);
CREATE INDEX idx_academic_results_class_id ON academic_results(class_id);
CREATE INDEX idx_student_notes_student_id ON student_notes(student_id);
