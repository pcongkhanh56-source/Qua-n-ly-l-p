import { useState, useEffect } from 'react';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/contexts/AuthContext';
import { useToast } from '@/src/contexts/ToastContext';
import { TuitionRecord } from '@/src/types';
import { Modal } from '@/src/components/ui/Modal';
import { Loader2, Banknote, CreditCard } from 'lucide-react';
import { format } from 'date-fns';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  tuition: (TuitionRecord & { student: any, class: any }) | null;
  onSuccess: () => void;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
};

export function PaymentModal({ isOpen, onClose, tuition, onSuccess }: PaymentModalProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  
  const [amount, setAmount] = useState<string>('');
  const [method, setMethod] = useState<'cash' | 'bank_transfer' | 'momo' | 'other'>('cash');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [note, setNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Reset form when modal opens with a new tuition
  useEffect(() => {
    if (tuition) {
      setAmount(tuition.balance.toString());
    }
  }, [tuition]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !tuition) return;

    const paymentAmount = Number(amount);
    if (paymentAmount <= 0) {
      showToast('Số tiền thu phải lớn hơn 0', 'error');
      return;
    }
    
    if (paymentAmount > tuition.balance) {
      showToast('Số tiền thu không được lớn hơn số tiền còn thiếu', 'error');
      return;
    }

    setIsSaving(true);
    try {
      // 1. Insert payment record
      const { error: paymentError } = await supabase
        .from('payments')
        .insert([{
          tuition_id: tuition.id,
          student_id: tuition.student_id,
          teacher_id: user.id,
          amount: paymentAmount,
          payment_date: date,
          payment_method: method,
          transaction_status: 'active',
          note: note
        }]);

      if (paymentError) throw paymentError;

      // 2. Update tuition record
      const newPaid = tuition.amount_paid + paymentAmount;
      const newBalance = tuition.amount_due - newPaid;
      const newStatus = newBalance <= 0 ? 'paid' : 'partial';

      const { error: tuitionError } = await supabase
        .from('student_tuition')
        .update({
          amount_paid: newPaid,
          balance: newBalance,
          status: newStatus
        })
        .eq('id', tuition.id);

      if (tuitionError) throw tuitionError;

      showToast('Đã ghi nhận thu tiền thành công', 'success');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error saving payment:', error);
      showToast('Lỗi khi lưu giao dịch thu tiền', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (!tuition) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Thu tiền học phí" maxWidth="lg">
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Summary Card */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
          <div className="grid grid-cols-2 gap-y-2 text-sm">
            <div className="text-slate-500">Học sinh:</div>
            <div className="font-semibold text-slate-900 text-right">{tuition.student.full_name}</div>
            
            <div className="text-slate-500">Lớp:</div>
            <div className="font-medium text-slate-900 text-right">{tuition.class.class_name}</div>
            
            <div className="text-slate-500">Kỳ học phí:</div>
            <div className="font-medium text-slate-900 text-right">Tháng {tuition.month}/{tuition.year}</div>
          </div>
          
          <div className="mt-4 pt-4 border-t border-slate-200 grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-xs text-slate-500 mb-1">Tổng cần đóng</div>
              <div className="font-medium text-slate-900">{formatCurrency(tuition.amount_due)}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">Đã đóng</div>
              <div className="font-medium text-green-600">{formatCurrency(tuition.amount_paid)}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">Còn thiếu</div>
              <div className="font-bold text-red-600">{formatCurrency(tuition.balance)}</div>
            </div>
          </div>
        </div>

        {/* Payment Form */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Số tiền thu lần này (VNĐ) *</label>
            <input
              type="number"
              required
              min={1000}
              max={tuition.balance}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-lg font-semibold focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              placeholder="Nhập số tiền..."
            />
            {amount && <p className="text-xs text-slate-500 mt-1">Định dạng: {formatCurrency(Number(amount))}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Ngày đóng *</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Hình thức *</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setMethod('cash')}
                  className={`flex-1 flex items-center justify-center gap-1 py-2 px-3 border rounded-lg text-sm font-medium transition-colors ${
                    method === 'cash' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Banknote className="w-4 h-4" /> Tiền mặt
                </button>
                <button
                  type="button"
                  onClick={() => setMethod('bank_transfer')}
                  className={`flex-1 flex items-center justify-center gap-1 py-2 px-3 border rounded-lg text-sm font-medium transition-colors ${
                    method === 'bank_transfer' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <CreditCard className="w-4 h-4" /> C.Khoản
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Ghi chú</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="VD: Phụ huynh chuyển khoản VCB..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={isSaving || !amount || Number(amount) <= 0}
            className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-70 transition-colors"
          >
            {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Xác nhận thu tiền
          </button>
        </div>
      </form>
    </Modal>
  );
}
