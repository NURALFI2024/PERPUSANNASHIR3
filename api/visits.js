import supabase from './db-client.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    if (req.method === 'GET') {
      const { data, error } = await supabase.from('library_visits').select('*').order('nomor', { ascending: false });
      if (error) throw error;
      return res.status(200).json(data);
    }
    if (req.method === 'POST') {
      const { hari, tanggal, jam_kunjungan, kelas, nama, keperluan, petugas } = req.body || {};
      if (![hari, tanggal, jam_kunjungan, kelas, nama, keperluan, petugas].every(value => typeof value === 'string' && value.trim())) return res.status(400).json({ error: 'Lengkapi semua kolom kunjungan.' });
      const { data, error } = await supabase.from('library_visits').insert({ hari: hari.trim(), tanggal, jam_kunjungan, kelas: kelas.trim(), nama: nama.trim(), keperluan: keperluan.trim(), petugas: petugas.trim() }).select('*').single();
      if (error) throw error;
      return res.status(201).json(data);
    }
    if (req.method === 'PUT') {
      const { nomor, ...body } = req.body || {};
      if (!nomor) return res.status(400).json({ error: 'Nomor catatan wajib diisi.' });
      const allowed = ['hari', 'tanggal', 'jam_kunjungan', 'kelas', 'nama', 'keperluan', 'petugas'];
      const changes = Object.fromEntries(Object.entries(body).filter(([key, value]) => allowed.includes(key) && value !== undefined));
      if (!Object.keys(changes).length) return res.status(400).json({ error: 'Tidak ada perubahan untuk disimpan.' });
      const { data, error } = await supabase.from('library_visits').update(changes).eq('nomor', nomor).select('*').single();
      if (error) throw error;
      return res.status(200).json(data);
    }
    if (req.method === 'DELETE') {
      const { nomor } = req.body || {};
      if (!nomor) return res.status(400).json({ error: 'Nomor catatan wajib diisi.' });
      const { error } = await supabase.from('library_visits').delete().eq('nomor', nomor);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('API error:', err);
    return res.status(500).json({ error: err.message || 'Kesalahan server.' });
  }
}
