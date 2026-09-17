import { Modal } from '@/src/components/ui/Modal';
import { EnrichedSession } from './index';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  MapPin, 
  Users, 
  BookOpen,
  ClipboardCheck,
  AlignLeft,
  XCircle,
  CheckCircle2,
  Edit2,
  Trash2,
  Loader2
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';
import { supabase } from '@/src/lib/supabase';
import { useToast } from '@/src/contexts/ToastContext';
import { useState } from 'react';

interface SessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: EnrichedSession;
  onEdit: () => void;
  onAttendance: () => void;
  onStatusChange: () => void;
}

export function SessionModal({ isOpen, onClose, session, onEdit, onAttendance, onStatusChange }: SessionModalProps) {
  const { showToast } = useToast();
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [showConfirmCancel, setShowConfirmCancel] = useState(false);

  const handleStatusChange = async (newStatus: 'scheduled' | 'completed' | 'cancelled') => {
    setIsUpdatingStatus(true);
    try {
      const { error } = await supabase
        .from('sessions')
        .update({ status: newStatus })
        .eq('id', session.id);

      if (error) throw error;
      showToast('Đã cập nhật trạng thái buổi học', 'success');
      onStatusChange();
      setShowConfirmCancel(false);
      onClose();
    } catch (error: any) {
      console.error('Error updating status:', error);
      showToast('Có lỗi xảy ra khi cập nhật', 'error');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const getStatusBadge = () => {
    switch (session.status) {
      case 'completed': 
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-green-100 text-green-700 border border-green-200"><CheckCircle2 className="w-3.5 h-3.5"/> Đã hoàn thành</span>;
      case 'cancelled': 
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-red-100 text-red-700 border border-red-200"><XCircle className="w-3.5 h-3.5"/> Đã hủy</span>;
      default: 
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-700 border border-blue-200"><Clock className="w-3.5 h-3.5"/> Sắp học</span>;
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Chi tiết buổi học" maxWidth="lg">
      {!showConfirmCancel ? (
        <div className="space-y-6">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-xl font-bold text-slate-900 mb-1">{session.class?.class_name}</h3>
              <p className="text-slate-500 text-sm flex items-center gap-1.5">
                <BookOpen className="w-4 h-4" /> {session.class?.subject || 'Chưa có môn học'}
              </p>
            </div>
            {getStatusBadge()}
          </div>

          <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                <CalendarIcon className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs text-slate-500 font-medium uppercase mb-0.5">Ngày học</div>
                <div className="text-sm font-semibold text-slate-800">
                  {format(parseISO(session.session_date), 'dd/MM/yyyy')}
                </div>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-100 text-amber-600 rounded-lg">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs text-slate-500 font-medium uppercase mb-0.5">Thời gian</div>
                <div className="text-sm font-semibold text-slate-800">
                  {session.start_time.substring(0, 5)} - {session.end_time.substring(0, 5)}
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 bg-green-100 text-green-600 rounded-lg">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs text-slate-500 font-medium uppercase mb-0.5">Địa điểm</div>
                <div className="text-sm font-semibold text-slate-800">
                  {session.class?.location || 'Chưa cập nhật'}
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs text-slate-500 font-medium uppercase mb-0.5">Học sinh</div>
                <div className="text-sm font-semibold text-slate-800">
                  {session.studentCount || 0} học sinh
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-800 mb-2">
                <ClipboardCheck className="w-4 h-4 text-slate-400" />
                Nội dung bài học
              </h4>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-sm text-slate-700 min-h-[60px]">
                {session.lesson_title ? (
                  <>
                    <div className="font-medium mb-1">{session.lesson_title}</div>
                    {session.lesson_content && <div className="text-slate-600 whitespace-pre-wrap">{session.lesson_content}</div>}
                  </>
                ) : (
                  <span className="text-slate-400 italic">Chưa cập nhật nội dung bài học.</span>
                )}
              </div>
            </div>

            <div>
              <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-800 mb-2">
                <AlignLeft className="w-4 h-4 text-slate-400" />
                Bài tập về nhà
              </h4>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-sm text-slate-700 min-h-[60px]">
                {session.homework ? (
                  <span className="whitespace-pre-wrap">{session.homework}</span>
                ) : (
                  <span className="text-slate-400 italic">Không có bài tập về nhà.</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 pt-4 border-t border-slate-100">
            <button
              onClick={onAttendance}
              className="w-full sm:w-auto flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              <Users className="w-4 h-4" />
              Điểm danh lớp
            </button>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                onClick={onEdit}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors font-medium"
              >
                <Edit2 className="w-4 h-4" />
                Sửa
              </button>
              {session.status !== 'cancelled' && (
                <button
                  onClick={() => setShowConfirmCancel(true)}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-white text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors font-medium"
                >
                  <XCircle className="w-4 h-4" />
                  Hủy buổi
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="py-6 text-center">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-2">Hủy buổi học này?</h3>
          <p className="text-slate-500 mb-6">Bạn có chắc chắn muốn chuyển trạng thái buổi học thành "Đã hủy"? Hành động này sẽ được ghi nhận lại.</p>
          
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => setShowConfirmCancel(false)}
              className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg font-medium hover:bg-slate-50"
            >
              Quay lại
            </button>
            <button
              onClick={() => handleStatusChange('cancelled')}
              disabled={isUpdatingStatus}
              className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
            >
              {isUpdatingStatus ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Xác nhận hủy'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
