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

  // สร้างข้อความแจ้งเตือน "มีรายการขายใหม่"
  function buildNewOrderMessage(item, newStock) {
    const timeStr = new Date().toLocaleString('th-TH', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
    return (
      `🛍️ <b>มีรายการขายใหม่!</b>\n` +
      `- สินค้า: ${item.name}\n` +
      `- จำนวน: ${item.quantity} ชิ้น\n` +
      `- ราคารวม: ${(item.price * item.quantity).toFixed(2)} บาท\n` +
      `- สต๊อกคงเหลือปัจจุบัน: ${newStock} ชิ้น\n` +
      `- เวลา: ${timeStr}`
    );
  }

  // สร้างข้อความแจ้งเตือน "สต๊อกใกล้หมด"
  function buildLowStockMessage(item, newStock) {
    return (
      `🚨 <b>[เตือนภัย] สต๊อกสินค้าใกล้หมด!</b>\n` +
      `- สินค้า: ${item.name}\n` +
      `- คงเหลือเพียง: ${newStock} ชิ้น\n` +
      `⚠️ กรุณาเติมสต๊อกสินค้าด่วน!`
    );
  }

  // ยิงข้อความแจ้งเตือนผ่าน API Route ของเราเอง (app/api/telegram/route.js)
  // ห่อด้วย try-catch และไม่ throw ต่อ เพื่อไม่ให้กระทบ flow การขายหลัก
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
  // จากนั้นยิงแจ้งเตือน Telegram (ไม่บล็อกผลลัพธ์การขาย)
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

    // ตัดสต็อกสินค้าแต่ละรายการ พร้อมสะสมข้อความแจ้งเตือนไว้ยิงทีเดียว
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
    }

    // ตัดสต็อกครบทุกรายการแล้ว -> ส่ง Telegram แจ้งเตือน (ยิงทีเดียวหลังลูปจบ)
    for (const item of cartItems) {
      const newStock = item.stock - item.quantity;
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


