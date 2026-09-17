import { useState, useEffect } from 'react';
import { useAuth } from '@/src/contexts/AuthContext';
import { supabase } from '@/src/lib/supabase';
import { StudentNote } from '@/src/types';
import { useToast } from '@/src/contexts/ToastContext';
import { format } from 'date-fns';
import { MessageSquare, BookOpen, User, Info, Trash2 } from 'lucide-react';

export function StudentNotesTab({ studentId }: { studentId: string }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [notes, setNotes] = useState<StudentNote[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [noteType, setNoteType] = useState<'behavior' | 'academic' | 'general' | 'parent_meeting'>('general');
  const [content, setContent] = useState('');

  useEffect(() => {
    fetchNotes();
  }, [studentId]);

  const fetchNotes = async () => {
    try {
      const { data, error } = await supabase
        .from('student_notes')
        .select('*')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setNotes(data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    
    try {
      const { error } = await supabase.from('student_notes').insert([{
        teacher_id: user?.id,
        student_id: studentId,
        note_type: noteType,
        content: content.trim()
      }]);
      
      if (error) throw error;
      setContent('');
      showToast('Đã thêm ghi chú', 'success');
      fetchNotes();
    } catch (error: any) {
      showToast(error.message, 'error');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Xóa ghi chú này?')) return;
    try {
      const { error } = await supabase.from('student_notes').delete().eq('id', id);
      if (error) throw error;
      showToast('Đã xóa ghi chú', 'success');
      fetchNotes();
    } catch (error: any) {
      showToast(error.message, 'error');
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'behavior': return <User className="w-5 h-5 text-purple-500" />;
      case 'academic': return <BookOpen className="w-5 h-5 text-blue-500" />;
      case 'parent_meeting': return <MessageSquare className="w-5 h-5 text-green-500" />;
      default: return <Info className="w-5 h-5 text-slate-500" />;
    }
  };

  const getTypeName = (type: string) => {
    switch (type) {
      case 'behavior': return 'Hành vi & Thái độ';
      case 'academic': return 'Học tập & Bài tập';
      case 'parent_meeting': return 'Trao đổi Phụ huynh';
      default: return 'Khác';
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <h3 className="font-medium text-slate-900 mb-4">Thêm ghi chú mới</h3>
        <form onSubmit={handleAddNote} className="space-y-4">
          <div className="flex gap-4">
            {['general', 'academic', 'behavior', 'parent_meeting'].map((type) => (
              <label key={type} className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="radio" 
                  name="note_type" 
                  value={type} 
                  checked={noteType === type}
                  onChange={(e) => setNoteType(e.target.value as any)}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-slate-700">{getTypeName(type)}</span>
              </label>
            ))}
          </div>
          <div>
            <textarea
              required
              rows={3}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Nhập nội dung ghi chú..."
            ></textarea>
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={!content.trim()} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium">
              Lưu ghi chú
            </button>
          </div>
        </form>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-4 text-slate-500">Đang tải...</div>
        ) : notes.length === 0 ? (
          <div className="text-center py-8 text-slate-500 border border-slate-200 rounded-xl bg-slate-50 border-dashed">Chưa có ghi chú nào.</div>
        ) : (
          notes.map(note => (
            <div key={note.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex gap-4">
              <div className="mt-1">{getTypeIcon(note.note_type)}</div>
              <div className="flex-1">
                <div className="flex justify-between items-start mb-1">
                  <div className="font-medium text-slate-900 text-sm">{getTypeName(note.note_type)}</div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500">{format(new Date(note.created_at), 'HH:mm dd/MM/yyyy')}</span>
                    <button onClick={() => handleDelete(note.id)} className="text-red-400 hover:text-red-600">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <p className="text-slate-700 text-sm whitespace-pre-wrap">{note.content}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
