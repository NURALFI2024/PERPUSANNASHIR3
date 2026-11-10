import supabase from './db-client.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    if (req.method === 'GET') {
      const { data, error } = await supabase.from('library_books').select('*').order('id', { ascending: true });
      if (error) throw error;
      return res.status(200).json(data);
    }
    if (req.method === 'POST') {
      const { no_invt, judul, pengarang, kategori } = req.body || {};
      if (![no_invt, judul].every(value => typeof value === 'string' && value.trim())) return res.status(400).json({ error: 'Nomor inventaris dan judul buku wajib diisi.' });
      const { data, error } = await supabase.from('library_books').insert({ no_invt: no_invt.trim(), judul: judul.trim(), pengarang: pengarang?.trim() || null, kategori: kategori?.trim() || null }).select('*').single();
      if (error) throw error;
      return res.status(201).json(data);
    }
    if (req.method === 'PUT') {
      const { id, no_invt, judul, pengarang, kategori } = req.body || {};
      if (!id) return res.status(400).json({ error: 'ID buku wajib diisi.' });
      if (!no_invt?.trim() || !judul?.trim()) return res.status(400).json({ error: 'Nomor inventaris dan judul buku wajib diisi.' });
      const { data, error } = await supabase.from('library_books').update({ no_invt: no_invt.trim(), judul: judul.trim(), pengarang: pengarang?.trim() || null, kategori: kategori?.trim() || null }).eq('id', id).select('*').single();
      if (error) throw error;
      return res.status(200).json(data);
    }
    if (req.method === 'DELETE') {
      const { id } = req.body || {};
      if (!id) return res.status(400).json({ error: 'ID buku wajib diisi.' });
      const { error } = await supabase.from('library_books').delete().eq('id', id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('API error:', err);
    return res.status(500).json({ error: err.message || 'Kesalahan server.' });
  }
}
