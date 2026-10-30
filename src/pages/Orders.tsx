import { useState, useEffect } from 'react';
import { Package, Clock, CheckCircle2, Truck } from 'lucide-react';
import { useAppContext } from '../AppContext';
import { db } from '../firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';

export default function Orders() {
  const { user } = useAppContext();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchOrders() {
      if (!user) {
        setLoading(false);
        return;
      }
      try {
        const q = query(
          collection(db, 'orders'),
          where('userId', '==', user.uid),
        );
        const querySnapshot = await getDocs(q);
        const ordersData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        // Sort manually for now since we didn't setup composite index
        ordersData.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setOrders(ordersData);
      } catch (error) {
        console.error("Error fetching orders:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchOrders();
  }, [user]);

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <Package className="h-12 w-12 text-gray-900 mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">سجل الطلبات</h2>
        <p className="text-gray-900 font-black">الرجاء تسجيل الدخول لعرض طلباتك السابقة</p>
      </div>
    );
  }

  if (loading) {
    return <div className="text-center py-20 text-gray-900 font-black">جاري تحميل الطلبات...</div>;
  }

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <Package className="h-12 w-12 text-gray-900 mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">لا توجد طلبات</h2>
        <p className="text-gray-900 font-black">لم تقم بأي طلبات بعد</p>
      </div>
    );
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="h-5 w-5 text-orange-500" />;
      case 'processing': return <Package className="h-5 w-5 text-blue-500" />;
      case 'shipped': return <Truck className="h-5 w-5 text-purple-500" />;
      case 'delivered': return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      default: return <Clock className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'قيد الانتظار';
      case 'processing': return 'قيد التجهيز';
      case 'shipped': return 'في الطريق';
      case 'delivered': return 'تم التسليم';
      default: return status;
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">طلباتي</h2>
      {orders.map((order) => (
        <div key={order.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex flex-wrap justify-between items-center border-b pb-4 mb-4 gap-4">
            <div>
              <p className="text-sm text-gray-900 font-black">رقم الطلب</p>
              <p className="font-mono text-sm font-bold text-gray-900">#{order.id.slice(0, 8)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-900 font-black">التاريخ</p>
              <p className="font-bold text-gray-900">{new Date(order.createdAt).toLocaleDateString('ar-YE')}</p>
            </div>
            <div>
              <p className="text-sm text-gray-900 font-black">الإجمالي</p>
              <p className="font-bold text-green-600">{order.total.toLocaleString()} ريال</p>
            </div>
            <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-full">
              {getStatusIcon(order.status)}
              <span className="text-sm font-bold text-gray-700">{getStatusText(order.status)}</span>
            </div>
          </div>
          
          <div className="space-y-3">
            {order.items.map((item: any, idx: number) => (
              <div key={idx} className="flex justify-between items-center text-sm">
                <span className="text-gray-800">{item.quantity}x {item.title}</span>
                <span className="text-gray-500">{item.price.toLocaleString()} ريال</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
