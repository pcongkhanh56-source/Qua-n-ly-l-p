// This SQL file is a starting reference for the database schema.
// It sets up the core tables and Row Level Security (RLS) policies 
// based on the architectural requirements.
// You should execute this in your Supabase SQL Editor.

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

---------------------------------------------------------
-- 1. PROFILES (Extended user info linked to auth.users)
---------------------------------------------------------
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    role TEXT DEFAULT 'teacher' CHECK (role IN ('teacher', 'admin')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own profile" 
    ON profiles FOR SELECT 
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" 
    ON profiles FOR UPDATE 
    USING (auth.uid() = id);

-- Function to handle new user signup and create profile automatically
CREATE OR REPLACE FUNCTION handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name');
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE handle_new_user();

---------------------------------------------------------
-- 2. STUDENTS
---------------------------------------------------------
CREATE TABLE students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    code TEXT NOT NULL, -- e.g., HS001
    full_name TEXT NOT NULL,
    dob DATE,
    phone TEXT,
    parent_name TEXT,
    parent_phone TEXT,
    address TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(teacher_id, code) -- Each teacher has unique student codes
);

-- Enable RLS
ALTER TABLE students ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Teachers can manage their own students" 
    ON students FOR ALL 
    USING (auth.uid() = teacher_id);

---------------------------------------------------------
-- 3. CLASSES
---------------------------------------------------------
CREATE TABLE classes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    code TEXT NOT NULL, -- e.g., T12A
    name TEXT NOT NULL,
    subject TEXT,
    grade TEXT,
    fee_per_session NUMERIC(12,2) DEFAULT 0,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(teacher_id, code)
);

-- Enable RLS
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Teachers can manage their own classes" 
    ON classes FOR ALL 
    USING (auth.uid() = teacher_id);

---------------------------------------------------------
-- 4. STUDENT_CLASSES (Many-to-Many relationship)
---------------------------------------------------------
CREATE TABLE student_classes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'dropped')),
    joined_at DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(student_id, class_id)
);

-- Enable RLS
ALTER TABLE student_classes ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Teachers can manage their own student_classes" 
    ON student_classes FOR ALL 
    USING (auth.uid() = teacher_id);

---------------------------------------------------------
-- (Placeholders for upcoming tables requested by user)
-- class_schedules, sessions, attendance, tuition_periods, 
-- student_tuition, payments, academic_results, student_notes
---------------------------------------------------------
-- The above structure establishes the core RLS pattern:
-- Every table has `teacher_id UUID NOT NULL REFERENCES auth.users(id)`
-- Every table has a policy: `USING (auth.uid() = teacher_id)`
---------------------------------------------------------

-- Automatically update updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_students_updated_at BEFORE UPDATE ON students FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_classes_updated_at BEFORE UPDATE ON classes FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
