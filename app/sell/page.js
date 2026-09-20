'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function SellPage() {
  // รายการสินค้าที่มีในสต็อก
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // ตะกร้าสินค้า: { [productId]: { id, name, price, stock, unit, quantity } }
  const [cart, setCart] = useState({});
  const [checkingOut, setCheckingOut] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, []);

  async function fetchProducts() {
    setLoading(true);
    setError('');
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .gt('stock', 0)
      .order('name', { ascending: true });

    if (error) {
      setError('โหลดข้อมูลสินค้าไม่สำเร็จ: ' + error.message);
    } else {
      setProducts(data);
    }
    setLoading(false);
  }

  // เพิ่มสินค้าลงตะกร้า (ครั้งละ 1 ชิ้น) โดยไม่เกินสต็อกที่มี
  function addToCart(product) {
    setCart((prev) => {
      const existing = prev[product.id];
      const currentQty = existing ? existing.quantity : 0;

      if (currentQty + 1 > product.stock) {
        setError(`สินค้า "${product.name}" มีไม่พอ (คงเหลือ ${product.stock})`);
        return prev;
      }

      setError('');
      return {
        ...prev,
        [product.id]: {
          id: product.id,
          name: product.name,
          price: product.price,
          stock: product.stock,
          unit: product.unit,
          quantity: currentQty + 1,
        },
      };
    });
  }

  // ลดจำนวนสินค้าในตะกร้า ถ้าเหลือ 0 ให้ลบออก
  function decreaseQty(productId) {
    setCart((prev) => {
      const existing = prev[productId];
      if (!existing) return prev;

      const newQty = existing.quantity - 1;
      const updated = { ...prev };

      if (newQty <= 0) {
        delete updated[productId];
      } else {
        updated[productId] = { ...existing, quantity: newQty };
      }
      return updated;
    });
  }

  // ตั้งจำนวนโดยตรงจากช่อง input ในตะกร้า
  function setQty(productId, qtyValue) {
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    let qty = parseInt(qtyValue, 10);
    if (isNaN(qty) || qty < 0) qty = 0;

    if (qty > product.stock) {
      setError(`สินค้า "${product.name}" มีไม่พอ (คงเหลือ ${product.stock})`);
      qty = product.stock;
    } else {
      setError('');
    }

    setCart((prev) => {
      const updated = { ...prev };
      if (qty <= 0) {
        delete updated[productId];
      } else {
        updated[productId] = {
          id: product.id,
          name: product.name,
          price: product.price,
          stock: product.stock,
          unit: product.unit,
          quantity: qty,
        };
      }
      return updated;
    });
  }

  function removeFromCart(productId) {
    setCart((prev) => {
      const updated = { ...prev };
      delete updated[productId];
      return updated;
    });
  }

  const cartItems = Object.values(cart);
  const totalAmount = cartItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  // สร้างข้อความแจ้งเตือน "มีรายการขายใหม่"
  function buildNewOrderMessage(item, newStock) {
    const timeStr = new Date().toLocaleString('th-TH', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
    return (
      `<b>🛒 มีรายการขายใหม่!</b>\n` +
      `- สินค้า: ${item.name}\n` +
      `- จำนวน: ${item.quantity} ชิ้น\n` +
      `- ราคารวม: ${(item.price * item.quantity).toFixed(2)} บาท\n` +
      `- สต็อกคงเหลือปัจจุบัน: ${newStock} ชิ้น\n` +
      `- เวลา: ${timeStr}`
    );
  }

  // สร้างข้อความแจ้งเตือน "สต็อกใกล้หมด"
  function buildLowStockMessage(item, newStock) {
    return (
      `<b>⚠️ [เตือนภัย] สต็อกสินค้าใกล้หมด!</b>\n` +
      `- สินค้า: ${item.name}\n` +
      `- คงเหลือเพียง: ${newStock} ชิ้น\n` +
      `⚠️ กรุณาเติมสต็อกสินค้าด่วน!`
    );
  }

  // ยิงข้อความแจ้งเตือนผ่าน API Route ของเราเอง
  async function sendTelegramNotifications(messages) {
    try {
      await fetch('/api/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages }),
      });
    } catch (err) {
      console.error('Telegram notification failed:', err);
    }
  }

  // ยืนยันการขาย: บันทึกลง sales ทีละรายการ แล้วตัดสต็อกใน products
  async function handleCheckout() {
    if (cartItems.length === 0) {
      setError('ยังไม่มีสินค้าในตะกร้า');
      return;
    }

    setCheckingOut(true);
    setError('');
    setSuccess('');

    try {
      const salesRows = cartItems.map((item) => ({
        product_id: item.id,
        product_name: item.name,
        quantity: item.quantity,
        total_price: item.price * item.quantity,
      }));

      const { error: insertError } = await supabase.from('sales').insert(salesRows);

      if (insertError) {
        setError('บันทึกการขายไม่สำเร็จ: ' + insertError.message);
        setCheckingOut(false);
        return;
      }

      const LOW_STOCK_THRESHOLD = 5;
      const notifyMessages = [];

      for (const item of cartItems) {
        const newStock = item.stock - item.quantity;
        const { error: updateError } = await supabase
          .from('products')
          .update({ stock: newStock })
          .eq('id', item.id);

        if (updateError) {
          setError(`บันทึกการขายสำเร็จ แต่ตัดสต็อกสินค้า "${item.name}" ไม่สำเร็จ: ${updateError.message}`);
          setCheckingOut(false);
          return;
        }

        notifyMessages.push(buildNewOrderMessage(item, newStock));

        if (newStock <= LOW_STOCK_THRESHOLD) {
          notifyMessages.push(buildLowStockMessage(item, newStock));
        }
      }

      await sendTelegramNotifications(notifyMessages);

      setSuccess('บันทึกการขายและตัดสต็อกสำเร็จ!');
      setCart({});
      fetchProducts();
    } catch (err) {
      setError('เกิดข้อผิดพลาด: ' + err.message);
    } finally {
      setCheckingOut(false);
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">ขายสินค้า</h1>

      {error && <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>}
      {success && <div className="bg-green-100 text-green-700 p-3 rounded mb-4">{success}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* รายการสินค้าที่มีในสต็อก */}
        <div className="bg-white p-4 rounded shadow">
          <h2 className="text-lg font-semibold mb-3">เลือกสินค้าเพื่อเพิ่มรายการขาย</h2>
          {loading ? (
            <p>กำลังโหลดข้อมูล...</p>
          ) : (
            <div className="space-y-2">
              {products.map((product) => (
                <div key={product.id} className="flex justify-between items-center border-b pb-2">
                  <div>
                    <p className="font-medium">{product.name}</p>
                    <p className="text-sm text-gray-500">ราคา: {product.price} บาท | คงเหลือ: {product.stock} {product.unit}</p>
                  </div>
                  <button
                    onClick={() => addToCart(product)}
                    className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                  >
                    + เพิ่มรายการ
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ตะกร้าสินค้า */}
        <div className="bg-white p-4 rounded shadow">
          <h2 className="text-lg font-semibold mb-3">รายการที่จะขาย</h2>
          {cartItems.length === 0 ? (
            <p className="text-gray-500">ยังไม่มีสินค้าในรายการขาย</p>
          ) : (
            <div className="space-y-3">
              {cartItems.map((item) => (
                <div key={item.id} className="flex justify-between items-center border-b pb-2">
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-sm text-gray-500">{item.price} x {item.quantity} = {item.price * item.quantity} บาท</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button onClick={() => decreaseQty(item.id)} className="bg-gray-200 px-2 rounded">-</button>
                    <span>{item.quantity}</span>
                    <button onClick={() => addToCart(item)} className="bg-gray-200 px-2 rounded">+</button>
                    <button onClick={() => removeFromCart(item.id)} className="text-red-600 text-sm ml-2">ลบ</button>
                  </div>
                </div>
              ))}

              <div className="mt-4 pt-2 border-t flex justify-between font-bold text-lg">
                <span>ยอดรวมทั้งสิ้น:</span>
                <span>{totalAmount.toFixed(2)} บาท</span>
              </div>

              <button
                onClick={handleCheckout}
                disabled={checkingOut}
                className="w-full bg-green-600 text-white py-2 rounded mt-4 hover:bg-green-700 disabled:bg-gray-400"
              >
                {checkingOut ? 'กำลังดำเนินการ...' : 'ยืนยันการขาย'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
