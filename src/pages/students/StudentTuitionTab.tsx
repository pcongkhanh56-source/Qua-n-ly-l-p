import { useState, useEffect } from 'react';
import { supabase } from '@/src/lib/supabase';
import { useToast } from '@/src/contexts/ToastContext';
import { TuitionRecord, Payment } from '@/src/types';
import { Loader2, Receipt, AlertTriangle, Ban } from 'lucide-react';
import { ConfirmModal } from '@/src/components/ui/ConfirmModal';
import { format } from 'date-fns';

interface StudentTuitionTabProps {
  studentId: string;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
};

export function StudentTuitionTab({ studentId }: StudentTuitionTabProps) {
  const { showToast } = useToast();
  
  const [payments, setPayments] = useState<(Payment & { tuition: TuitionRecord & { class: any } })[]>([]);
  const [loading, setLoading] = useState(true);

  const [paymentToCancel, setPaymentToCancel] = useState<Payment | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('payments')
        .select(`
          *,
          tuition:student_tuition(*, class:classes(class_name))
        `)
        .eq('student_id', studentId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPayments(data || []);
    } catch (error) {
      console.error('Error fetching payment history:', error);
      showToast('Không thể tải lịch sử đóng tiền', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [studentId]);

  const handleCancelPayment = async () => {
    if (!paymentToCancel) return;
    setIsCancelling(true);
    
    try {
      const tuitionId = paymentToCancel.tuition_id;

      // 1. Mark payment as cancelled
      const { error: cancelError } = await supabase
        .from('payments')
        .update({ transaction_status: 'cancelled' })
        .eq('id', paymentToCancel.id);

      if (cancelError) throw cancelError;

      // 2. Recalculate tuition record
      const { data: allPayments, error: fetchError } = await supabase
        .from('payments')
        .select('amount')
        .eq('tuition_id', tuitionId)
        .eq('transaction_status', 'active');

      if (fetchError) throw fetchError;

      const newPaid = allPayments?.reduce((sum, p) => sum + p.amount, 0) || 0;
      
      const { data: tr, error: trError } = await supabase
        .from('student_tuition')
        .select('amount_due')
        .eq('id', tuitionId)
        .single();
        
      if (trError) throw trError;

      const newBalance = tr.amount_due - newPaid;
      const newStatus = newBalance === tr.amount_due ? 'unpaid' : (newBalance <= 0 ? 'paid' : 'partial');

      const { error: updateError } = await supabase
        .from('student_tuition')
        .update({
          amount_paid: newPaid,
          balance: newBalance,
          status: newStatus
        })
        .eq('id', tuitionId);

      if (updateError) throw updateError;

      showToast('Đã hủy giao dịch và tính toán lại công nợ', 'success');
      setPaymentToCancel(null);
      fetchHistory();
    } catch (error: any) {
      console.error('Error cancelling payment:', error);
      showToast('Lỗi khi hủy giao dịch', 'error');
    } finally {
      setIsCancelling(false);
    }
  };

  if (loading) {
    return <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>;
  }

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-medium text-slate-900">Lịch sử đóng học phí</h3>
      
      {payments.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200">
          <Receipt className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-2 text-sm text-slate-500">Chưa có giao dịch đóng tiền nào.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Kỳ học phí / Lớp</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Ngày đóng</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Số tiền</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Hình thức</th>
                <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">Trạng thái</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Thao tác</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {payments.map((payment) => (
                <tr key={payment.id} className={payment.transaction_status === 'cancelled' ? 'bg-red-50/50' : 'hover:bg-slate-50'}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-bold text-slate-900">Tháng {payment.tuition.month}/{payment.tuition.year}</div>
                    <div className="text-xs text-slate-500">{payment.tuition.class.class_name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">
                    {format(new Date(payment.payment_date), 'dd/MM/yyyy')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-900 text-right">
                    {formatCurrency(payment.amount)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                    {payment.payment_method === 'cash' ? 'Tiền mặt' : 'Chuyển khoản'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    {payment.transaction_status === 'active' ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">Thành công</span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">Đã hủy</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {payment.transaction_status === 'active' && (
                      <button
                        onClick={() => setPaymentToCancel(payment)}
                        className="text-red-500 hover:text-red-700 p-1.5 hover:bg-red-50 rounded-md transition-colors"
                        title="Hủy giao dịch này"
                      >
                        <Ban className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmModal
        isOpen={paymentToCancel !== null}
        onClose={() => setPaymentToCancel(null)}
        onConfirm={handleCancelPayment}
        title="Hủy giao dịch thu tiền"
        message={
          <>
            Bạn có chắc chắn muốn hủy giao dịch thu <span className="font-bold text-red-600">{paymentToCancel && formatCurrency(paymentToCancel.amount)}</span>?
            <br/><br/>
            Hệ thống sẽ giữ lại lịch sử hủy, đồng thời tự động cập nhật lại Số tiền đã đóng và Công nợ của học sinh trong tháng đó.
          </>
        }
        isConfirming={isCancelling}
        confirmText="Xác nhận hủy"
      />
    </div>
  );
}
