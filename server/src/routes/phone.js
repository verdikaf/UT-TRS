import { Router } from 'express';
import { isValidPhone } from '../utils/validators.js';
import { sendWhatsAppMessage } from '../services/fonnte.js';

const router = Router();

// Public endpoint to validate a phone number by sending a test message
router.post('/validate', async (req, res) => {
  try {
    const { phone, name } = req.body || {};
    if (!phone) return res.status(400).json({ error: 'Nomor telepon wajib diisi' });
    const phoneTrim = String(phone).trim();
    if (!isValidPhone(phoneTrim)) return res.status(400).json({ error: 'Format nomor telepon tidak valid' });

    const tz = process.env.TIMEZONE || 'Asia/Jakarta';
    const nowStr = new Date().toLocaleString('id-ID', {
      timeZone: tz,
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    const greetName = name ? ` ${String(name).trim()}` : '';
    const message = `Halo${greetName}! 👋\nIni pesan validasi dari UT-TRS untuk memastikan WhatsApp kamu aktif.\nWaktu: ${nowStr}\nJika kamu menerima pesan ini, validasi nomor BERHASIL. Terima kasih 🙌`;
    const result = await sendWhatsAppMessage({ phone: phoneTrim, message });
    return res.json({ ok: true, result });
  } catch (e) {
    const msg = e?.response?.data || e?.message || 'Validasi gagal';
    return res.status(500).json({ error: typeof msg === 'string' ? msg : JSON.stringify(msg) });
  }
});

export default router;
