'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function HistoryPage() {
  // รายการประวัติการขายทั้งหมด
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchSales();
  }, []);

  async function fetchSales() {
    setLoading(true);
    setError('');

    const { data, error } = await supabase
      .from('sales')
      .select('*')
      .order('sold_at', { ascending: false });

    if (error) {
      setError('โหลดข้อมูลประวัติการขายไม่สำเร็จ: ' + error.message);
    } else {
      setSales(data);
    }
    setLoading(false);
  }

  // รวมยอดขายทั้งหมดจาก total_price ของทุกแถว
  const totalSalesAmount = sales.reduce(
    (sum, sale) => sum + Number(sale.total_price),
    0
  );

  // จัดรูปแบบวันเวลาให้อ่านง่าย (แบบไทย)
  function formatDateTime(isoString) {
    const date = new Date(isoString);
    return date.toLocaleString('th-TH', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  }

  return (
    <div>
      <h1>ประวัติการขาย</h1>

      {error && <p className="error-text">{error}</p>}

      {/* สรุปยอดขายรวมทั้งหมด */}
      <div className="card">
        <h2>ยอดขายรวมทั้งหมด: {totalSalesAmount.toFixed(2)} บาท</h2>
        <p style={{ margin: 0, color: '#64748b' }}>
          จำนวนรายการขายทั้งหมด: {sales.length} รายการ
        </p>
      </div>

      {/* ตารางประวัติการขาย */}
      {loading ? (
        <p>กำลังโหลดข้อมูล...</p>
      ) : sales.length === 0 ? (
        <p>ยังไม่มีประวัติการขาย</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>วันเวลาที่ขาย</th>
              <th>ชื่อสินค้า</th>
              <th>จำนวน</th>
              <th>ยอดรวม</th>
            </tr>
          </thead>
          <tbody>
            {sales.map((sale) => (
              <tr key={sale.id}>
                <td>{formatDateTime(sale.sold_at)}</td>
                <td>{sale.product_name}</td>
                <td>{sale.quantity}</td>
                <td>{Number(sale.total_price).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
