import { NextResponse } from "next/server";

// อ่านค่าจาก Environment Variables ฝั่ง Server เท่านั้น
// (ไฟล์นี้เป็น API Route จึงรันบน server ไม่ถูกฝังลง client bundle)
const TELEGRAM_BOT_TOKEN = process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.NEXT_PUBLIC_TELEGRAM_CHAT_ID;

export async function POST(request) {
  try {
    const { messages } = await request.json();

    // ถ้ายังไม่ได้ตั้งค่า ให้จบแบบไม่ error เพื่อไม่ให้กระทบระบบขาย
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
      return NextResponse.json({ ok: false, error: "Missing Telegram config" });
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ ok: false, error: "messages must be a non-empty array" });
    }

    // ยิงข้อความทีละรายการไปยัง Telegram sendMessage API
    for (const messageText of messages) {
      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text: messageText,
          parse_mode: "HTML",
        }),
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message });
  }
}
