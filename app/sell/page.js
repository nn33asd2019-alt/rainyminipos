'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function SellPage() {
  // รายการสินค้าที่มีสต็อก
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

  // ยืนยันการขาย: บันทึกลง sales ทีละรายการ แล้วตัดสต็อกใน products
  async function handleCheckout() {
    if (cartItems.length === 0) {
      setError('ยังไม่มีสินค้าในตะกร้า');
      return;
    }

    setCheckingOut(true);
    setError('');
    setSuccess('');

    // สร้างแถวสำหรับตาราง sales จากรายการในตะกร้า
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

    // ตัดสต็อกสินค้าแต่ละรายการ
    for (const item of cartItems) {
      const newStock = item.stock - item.quantity;
      const { error: updateError } = await supabase
        .from('products')
        .update({ stock: newStock })
        .eq('id', item.id);

      if (updateError) {
        setError(
          `บันทึกการขายสำเร็จ แต่ตัดสต็อกสินค้า "${item.name}" ไม่สำเร็จ: ` +
            updateError.message
        );
      }
    }

    setSuccess('บันทึกการขายเรียบร้อยแล้ว');
    setCart({});
    setCheckingOut(false);
    fetchProducts(); // โหลดสต็อกล่าสุดใหม่
  }

  return (
    <div>
      <h1>ขายสินค้า</h1>

      {error && <p className="error-text">{error}</p>}
      {success && <p className="success-text">{success}</p>}

      <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
        {/* รายการสินค้าให้เลือก */}
        <div style={{ flex: '2', minWidth: '320px' }}>
          <div className="card">
            <h2>สินค้าที่มีในสต็อก</h2>
            {loading ? (
              <p>กำลังโหลดข้อมูล...</p>
            ) : products.length === 0 ? (
              <p>ไม่มีสินค้าคงเหลือในสต็อก</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>ชื่อสินค้า</th>
                    <th>ราคา</th>
                    <th>คงเหลือ</th>
                    <th>หน่วย</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id}>
                      <td>{p.name}</td>
                      <td>{Number(p.price).toFixed(2)}</td>
                      <td>{p.stock}</td>
                      <td>{p.unit}</td>
                      <td>
                        <button onClick={() => addToCart(p)}>เพิ่มลงตะกร้า</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* ตะกร้าสินค้า */}
        <div style={{ flex: '1', minWidth: '280px' }}>
          <div className="card">
            <h2>ตะกร้าสินค้า</h2>
            {cartItems.length === 0 ? (
              <p>ยังไม่มีสินค้าในตะกร้า</p>
            ) : (
              <>
                {cartItems.map((item) => (
                  <div key={item.id} className="form-row">
                    <div style={{ flex: 1 }}>
                      <div>{item.name}</div>
                      <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                        {item.price} x {item.quantity} ={' '}
                        {(item.price * item.quantity).toFixed(2)}
                      </div>
                    </div>
                    <button onClick={() => decreaseQty(item.id)}>-</button>
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => setQty(item.id, e.target.value)}
                      style={{ width: '60px' }}
                    />
                    <button onClick={() => addToCart(item)}>+</button>
                    <button onClick={() => removeFromCart(item.id)}>ลบ</button>
                  </div>
                ))}

                <hr />
                <h3>รวมทั้งหมด: {totalAmount.toFixed(2)} บาท</h3>

                <button onClick={handleCheckout} disabled={checkingOut}>
                  {checkingOut ? 'กำลังบันทึก...' : 'ยืนยันการขาย'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
