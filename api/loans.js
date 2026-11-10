import supabase from './db-client.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    if (req.method === 'GET') {
      const { data, error } = await supabase.from('library_loans').select('*').order('nomor', { ascending: false });
      if (error) throw error;
      return res.status(200).json(data);
    }
    if (req.method === 'POST') {
      const { nama, judul, no_invt, tanggal_pinjam, tanggal_kembali, petugas } = req.body || {};
      if (![nama, judul, no_invt, tanggal_pinjam, tanggal_kembali, petugas].every(value => typeof value === 'string' && value.trim())) return res.status(400).json({ error: 'Lengkapi semua kolom peminjaman.' });
      const { data, error } = await supabase.from('library_loans').insert({ nama: nama.trim(), judul: judul.trim(), no_invt: no_invt.trim(), tanggal_pinjam, tanggal_kembali, petugas: petugas.trim(), status: 'Dipinjam' }).select('*').single();
      if (error) throw error;
      return res.status(201).json(data);
    }
    if (req.method === 'PUT') {
      const { nomor, status, nama, judul, no_invt, tanggal_pinjam, tanggal_kembali, petugas } = req.body || {};
      if (!nomor) return res.status(400).json({ error: 'Nomor catatan wajib diisi.' });
      const changes = {};
      if (status !== undefined) changes.status = status;
      for (const [key, value] of Object.entries({ nama, judul, no_invt, tanggal_pinjam, tanggal_kembali, petugas })) if (value !== undefined) changes[key] = value;
      if (!Object.keys(changes).length) return res.status(400).json({ error: 'Tidak ada perubahan untuk disimpan.' });
      const { data, error } = await supabase.from('library_loans').update(changes).eq('nomor', nomor).select('*').single();
      if (error) throw error;
      return res.status(200).json(data);
    }
    if (req.method === 'DELETE') {
      const { nomor } = req.body || {};
      if (!nomor) return res.status(400).json({ error: 'Nomor catatan wajib diisi.' });
      const { error } = await supabase.from('library_loans').delete().eq('nomor', nomor);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('API error:', err);
    return res.status(500).json({ error: err.message || 'Kesalahan server.' });
  }
}
