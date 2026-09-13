'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function HomePage() {
  // รายการสินค้าทั้งหมด
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // ฟอร์มเพิ่มสินค้าใหม่
  const [form, setForm] = useState({
    sku: '',
    name: '',
    price: '',
    stock: '',
    unit: '',
  });
  const [submitting, setSubmitting] = useState(false);

  // สถานะสำหรับแก้ไขแบบ inline: เก็บ id ที่กำลังแก้ + ข้อมูลชั่วคราว
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  // โหลดรายการสินค้าครั้งแรกที่หน้าโหลด
  useEffect(() => {
    fetchProducts();
  }, []);

  async function fetchProducts() {
    setLoading(true);
    setError('');
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      setError('โหลดข้อมูลสินค้าไม่สำเร็จ: ' + error.message);
    } else {
      setProducts(data);
    }
    setLoading(false);
  }

  // เพิ่มสินค้าใหม่
  async function handleAddProduct(e) {
    e.preventDefault();
    setError('');

    if (!form.sku || !form.name || !form.price || !form.stock || !form.unit) {
      setError('กรุณากรอกข้อมูลให้ครบทุกช่อง');
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.from('products').insert({
      sku: form.sku,
      name: form.name,
      price: parseFloat(form.price),
      stock: parseInt(form.stock, 10),
      unit: form.unit,
    });
    setSubmitting(false);

    if (error) {
      setError('เพิ่มสินค้าไม่สำเร็จ: ' + error.message);
      return;
    }

    // ล้างฟอร์มและโหลดรายการใหม่
    setForm({ sku: '', name: '', price: '', stock: '', unit: '' });
    fetchProducts();
  }

  // เริ่มแก้ไขแถว: คัดลอกค่าปัจจุบันมาใส่ editForm
  function startEdit(product) {
    setEditingId(product.id);
    setEditForm({
      sku: product.sku,
      name: product.name,
      price: product.price,
      stock: product.stock,
      unit: product.unit,
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm({});
  }

  // บันทึกการแก้ไขแถว
  async function saveEdit(id) {
    setError('');
    const { error } = await supabase
      .from('products')
      .update({
        sku: editForm.sku,
        name: editForm.name,
        price: parseFloat(editForm.price),
        stock: parseInt(editForm.stock, 10),
        unit: editForm.unit,
      })
      .eq('id', id);

    if (error) {
      setError('แก้ไขสินค้าไม่สำเร็จ: ' + error.message);
      return;
    }

    setEditingId(null);
    setEditForm({});
    fetchProducts();
  }

  // ลบสินค้า
  async function handleDelete(id) {
    const confirmed = window.confirm('ยืนยันลบสินค้านี้หรือไม่?');
    if (!confirmed) return;

    setError('');
    const { error } = await supabase.from('products').delete().eq('id', id);

    if (error) {
      setError('ลบสินค้าไม่สำเร็จ: ' + error.message);
      return;
    }

    fetchProducts();
  }

  return (
    <div>
      <h1>รายการสินค้า</h1>

      {error && <p className="error-text">{error}</p>}

      {/* ฟอร์มเพิ่มสินค้าใหม่ */}
      <div className="card">
        <h2>เพิ่มสินค้าใหม่</h2>
        <form onSubmit={handleAddProduct}>
          <div className="form-row">
            <input
              type="text"
              placeholder="SKU"
              value={form.sku}
              onChange={(e) => setForm({ ...form, sku: e.target.value })}
            />
            <input
              type="text"
              placeholder="ชื่อสินค้า"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <input
              type="number"
              step="0.01"
              placeholder="ราคา"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
            />
            <input
              type="number"
              placeholder="คงเหลือ"
              value={form.stock}
              onChange={(e) => setForm({ ...form, stock: e.target.value })}
            />
            <input
              type="text"
              placeholder="หน่วย (เช่น ชิ้น, กล่อง)"
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
            />
            <button type="submit" disabled={submitting}>
              {submitting ? 'กำลังบันทึก...' : 'เพิ่มสินค้า'}
            </button>
          </div>
        </form>
      </div>

      {/* ตารางแสดงรายการสินค้า */}
      {loading ? (
        <p>กำลังโหลดข้อมูล...</p>
      ) : products.length === 0 ? (
        <p>ยังไม่มีสินค้าในระบบ</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>SKU</th>
              <th>ชื่อสินค้า</th>
              <th>ราคา</th>
              <th>คงเหลือ</th>
              <th>หน่วย</th>
              <th>จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => {
              const isEditing = editingId === p.id;
              return (
                <tr key={p.id}>
                  {isEditing ? (
                    <>
                      <td>
                        <input
                          type="text"
                          value={editForm.sku}
                          onChange={(e) =>
                            setEditForm({ ...editForm, sku: e.target.value })
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={editForm.name}
                          onChange={(e) =>
                            setEditForm({ ...editForm, name: e.target.value })
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          value={editForm.price}
                          onChange={(e) =>
                            setEditForm({ ...editForm, price: e.target.value })
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          value={editForm.stock}
                          onChange={(e) =>
                            setEditForm({ ...editForm, stock: e.target.value })
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={editForm.unit}
                          onChange={(e) =>
                            setEditForm({ ...editForm, unit: e.target.value })
                          }
                        />
                      </td>
                      <td>
                        <div className="form-row" style={{ margin: 0 }}>
                          <button onClick={() => saveEdit(p.id)}>บันทึก</button>
                          <button onClick={cancelEdit}>ยกเลิก</button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td>{p.sku}</td>
                      <td>{p.name}</td>
                      <td>{Number(p.price).toFixed(2)}</td>
                      <td>{p.stock}</td>
                      <td>{p.unit}</td>
                      <td>
                        <div className="form-row" style={{ margin: 0 }}>
                          <button onClick={() => startEdit(p)}>แก้ไข</button>
                          <button onClick={() => handleDelete(p.id)}>ลบ</button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
