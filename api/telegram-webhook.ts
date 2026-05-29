import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
  // Read database config from environment variables
  const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Missing Supabase environment variables VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // 1. Fetch system settings dynamically to get the current telegram_bot_token
  const { data: settings, error: settingsError } = await supabase
    .from('system_settings')
    .select('*')
    .eq('id', 'default')
    .single();

  if (settingsError || !settings || !settings.telegram_bot_token) {
    return res.status(500).json({ error: 'Telegram Bot Token not configured in Cyfence Settings panel.' });
  }

  const botToken = settings.telegram_bot_token;
  const telegramApiUrl = `https://api.telegram.org/bot${botToken}`;

  // Helper method to POST to Telegram Bot API
  const sendTelegram = async (method: string, body: any) => {
    try {
      const response = await fetch(`${telegramApiUrl}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      return await response.json();
    } catch (e) {
      console.error(`Telegram API error on ${method}:`, e);
      return { ok: false, error: e };
    }
  };

  // 2. GET Request: Automated setWebhook wizard for user convenience
  if (req.method === 'GET') {
    const host = req.headers.host;
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const webhookUrl = `${protocol}://${host}/api/telegram-webhook`;

    try {
      const response = await fetch(`${telegramApiUrl}/setWebhook?url=${encodeURIComponent(webhookUrl)}`);
      const result = await response.json();
      if (result.ok) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.status(200).send(`
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Telegram Webhook Registration</title>
              <style>
                body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #F5F5F7; color: #1D1D1F; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
                .card { background: white; padding: 40px 30px; border-radius: 28px; box-shadow: 0 10px 30px rgba(0,0,0,0.03); text-align: center; max-width: 420px; border: 1px solid #E8E8ED; box-sizing: border-box; }
                .icon { font-size: 54px; margin-bottom: 24px; animation: pulse 2s infinite ease-in-out; }
                h1 { font-size: 20px; font-weight: 800; margin: 0 0 12px 0; color: #1D1D1F; letter-spacing: -0.5px; }
                p { font-size: 13px; color: #86868B; line-height: 1.6; margin: 0 0 24px 0; }
                .url-box { font-family: "SFMono-Regular", Consolas, monospace; background: #F5F5F7; padding: 12px 16px; border-radius: 12px; font-size: 11px; color: #1D1D1F; word-break: break-all; margin: 15px 0; border: 1px solid #E8E8ED; text-align: left; }
                .response-status { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: #1E8E3E; background: #E6F4EA; padding: 6px 14px; border-radius: 50px; font-weight: bold; margin-bottom: 20px; }
                .btn { background: black; color: white; border: none; padding: 14px 28px; border-radius: 14px; font-size: 13px; font-weight: bold; cursor: pointer; text-decoration: none; display: inline-block; transition: all 0.2s; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
                .btn:hover { background: #1D1D1F; transform: translateY(-1px); }
                @keyframes pulse {
                  0% { transform: scale(1); }
                  50% { transform: scale(1.08); }
                  100% { transform: scale(1); }
                }
              </style>
            </head>
            <body>
              <div class="card">
                <div class="icon">🤖</div>
                <h1>ลงทะเบียน Webhook สำเร็จ!</h1>
                <p>บอทของคุณผูกระบบรับคำสั่งผ่าน Vercel Serverless Function เรียบร้อยแล้วค่ะ:</p>
                <div class="url-box">${webhookUrl}</div>
                <div class="response-status">🟢 Telegram: ${result.description}</div>
                <div>
                  <a href="${protocol}://${host}" class="btn">เข้าสู่หน้าหลักคลังพัสดุ</a>
                </div>
              </div>
            </body>
          </html>
        `);
      } else {
        return res.status(400).send(`Failed to register Telegram webhook: ${JSON.stringify(result)}`);
      }
    } catch (err: any) {
      return res.status(500).send(`Error setting Telegram webhook: ${err?.message || err}`);
    }
  }

  // 3. POST Request: Incoming updates sent from Telegram chat / buttons
  if (req.method === 'POST') {
    const update = req.body;
    if (!update) {
      return res.status(200).send('No payload.');
    }

    // A. Handle standard message text inputs (e.g. /start, /stock, or text replies)
    if (update.message) {
      const chatId = update.message.chat.id;
      const text = (update.message.text || '').trim();

      if (text === '/start' || text.toLowerCase() === '/stock' || text.includes('เช็คสต๊อก') || text.includes('สต็อก')) {
        // Fetch all categories dynamically from equipments table
        const { data: eqs } = await supabase.from('equipments').select('category');
        const categories = Array.from(new Set((eqs || []).map(e => e.category))).filter(Boolean).sort();

        if (categories.length === 0) {
          await sendTelegram('sendMessage', {
            chat_id: chatId,
            text: '❌ <b>ไม่พบข้อมูลหมวดหมู่อุปกรณ์คลังพัสดุในขณะนี้</b>\nกรุณาเพิ่มรายการอุปกรณ์พร้อมระบุหมวดหมู่ที่เหมาะสมในแผงจัดการคลังอุปกรณ์ก่อนนะคะ',
            parse_mode: 'HTML'
          });
          return res.status(200).send('OK');
        }

        // Build Inline Keyboard layout (max 2 buttons per row)
        const keyboard: any[] = [];
        for (let i = 0; i < categories.length; i += 2) {
          const row: any[] = [];
          row.push({
            text: `📦 ${categories[i]}`,
            callback_data: `cat_${i}` // Callback data is dynamic array index
          });
          if (i + 1 < categories.length) {
            row.push({
              text: `📦 ${categories[i + 1]}`,
              callback_data: `cat_${i + 1}`
            });
          }
          keyboard.push(row);
        }

        await sendTelegram('sendMessage', {
          chat_id: chatId,
          text: '🤖 <b>ระบบจัดการคลังพัสดุ Cyfence Inventory</b>\n\nสวัสดีค่ะ กรุณาเลือกหมวดหมู่อุปกรณ์ที่คุณต้องการเช็คสถานะสต็อกคงเหลือปัจจุบันด้านล่างนี้ได้เลยค่ะ:',
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: keyboard
          }
        });
      }
      return res.status(200).send('OK');
    }

    // B. Handle callback query events (when user taps the inline keyboard buttons)
    if (update.callback_query) {
      const callbackQueryId = update.callback_query.id;
      const chatId = update.callback_query.message.chat.id;
      const messageId = update.callback_query.message.message_id;
      const callbackData = update.callback_query.data || '';

      // Tapped a specific category button
      if (callbackData.startsWith('cat_')) {
        const catIndex = parseInt(callbackData.replace('cat_', ''), 10);

        // Fetch dynamic categories list to resolve name index
        const { data: eqs } = await supabase.from('equipments').select('category');
        const categories = Array.from(new Set((eqs || []).map(e => e.category))).filter(Boolean).sort();
        const selectedCategory = categories[catIndex];

        if (!selectedCategory) {
          await sendTelegram('answerCallbackQuery', {
            callback_query_id: callbackQueryId,
            text: '❌ ไม่พบหมวดหมู่ที่ระบุ โปรดลองส่งคำขอใหม่อีกครั้งค่ะ',
            show_alert: true
          });
          return res.status(200).send('OK');
        }

        // Trigger native loading feedback on button
        await sendTelegram('answerCallbackQuery', {
          callback_query_id: callbackQueryId,
          text: `กำลังตรวจสอบคลังหมวดหมู่: ${selectedCategory}...`
        });

        // Query stock in Supabase for selectedCategory
        const { data: equipments, error: eqError } = await supabase
          .from('equipments')
          .select('*')
          .eq('category', selectedCategory)
          .order('name', { ascending: true });

        let responseText = `📦 <b>รายงานสต็อกอุปกรณ์ล่าสุด</b>\n`;
        responseText += `<b>หมวดหมู่:</b> <code>${selectedCategory}</code>\n`;
        responseText += `-----------------------------------------\n\n`;

        if (eqError || !equipments || equipments.length === 0) {
          responseText += `❌ <i>ไม่พบข้อมูลอุปกรณ์คงเหลือในหมวดหมู่นี้ในระบบคลังพัสดุขณะนี้</i>\n`;
        } else {
          equipments.forEach(eq => {
            const avail = eq.available_qty ?? 0;
            const total = eq.total_qty ?? 0;
            const borrowed = total - avail;
            // Visual indicator emojis based on stock abundance
            const statusEmoji = avail > 5 ? '🟢' : avail > 0 ? '🟡' : '🔴';
            
            responseText += `${statusEmoji} <b>${eq.name}</b> (<code>${eq.code}</code>)\n`;
            responseText += `   » 📥 ว่างพร้อมใช้: <b>${avail}</b> ชิ้น\n`;
            responseText += `   » 📤 ถูกยืมใช้งาน: <b>${borrowed}</b> ชิ้น (สต็อกทั้งหมด ${total})\n\n`;
          });
        }

        responseText += `-----------------------------------------\n`;
        responseText += `🕒 <i>ข้อมูลอัปเดต Real-time: ${new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })} น.</i>`;

        // Back action button keyboard
        const backKeyboard = [
          [{ text: '🔙 ย้อนกลับไปเลือกหมวดหมู่', callback_data: 'show_categories' }]
        ];

        // Send inventory sheet to user as a new message
        await sendTelegram('sendMessage', {
          chat_id: chatId,
          text: responseText,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: backKeyboard
          }
        });
      } 
      // Tapped the Back button
      else if (callbackData === 'show_categories') {
        const { data: eqs } = await supabase.from('equipments').select('category');
        const categories = Array.from(new Set((eqs || []).map(e => e.category))).filter(Boolean).sort();

        const keyboard: any[] = [];
        for (let i = 0; i < categories.length; i += 2) {
          const row: any[] = [];
          row.push({
            text: `📦 ${categories[i]}`,
            callback_data: `cat_${i}`
          });
          if (i + 1 < categories.length) {
            row.push({
              text: `📦 ${categories[i + 1]}`,
              callback_data: `cat_${i + 1}`
            });
          }
          keyboard.push(row);
        }

        await sendTelegram('answerCallbackQuery', {
          callback_query_id: callbackQueryId
        });

        await sendTelegram('sendMessage', {
          chat_id: chatId,
          text: '🤖 <b>ระบบจัดการคลังพัสดุ Cyfence Inventory</b>\n\nกรุณาเลือกหมวดหมู่อุปกรณ์ที่คุณต้องการเช็คสถานะสต็อกคงเหลือปัจจุบันด้านล่างนี้ได้เลยค่ะ:',
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: keyboard
          }
        });
      }

      return res.status(200).send('OK');
    }

    return res.status(200).send('Unknown Telegram payload.');
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
