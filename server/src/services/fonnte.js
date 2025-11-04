import axios from 'axios';

export async function sendWhatsAppMessage({ phone, message }) {
  const token = process.env.FONNTE_TOKEN;
  if (!token) throw new Error('FONNTE_TOKEN not set');

  const url = 'https://api.fonnte.com/send';
  const payload = {
    target: phone,
    message,
  };

  const headers = {
    Authorization: token,
    'Content-Type': 'application/json',
  };

  const res = await axios.post(url, payload, { headers });
  return res.data;
}
