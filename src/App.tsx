import { useEffect, useMemo, useState } from 'react';
import { Activity, ArrowDownToLine, ArrowLeftRight, BookMarked, BookOpen, CalendarDays, Check, ChevronDown, CircleAlert, Clock3, FileSpreadsheet, LayoutDashboard, LibraryBig, Menu, Plus, Search, Users, X } from 'lucide-react';

type Loan = { nomor:number; nama:string; judul:string; no_invt:string; tanggal_pinjam:string; tanggal_kembali:string; petugas:string; status:string; created_at?:string };
type Visit = { nomor:number; hari:string; tanggal:string; jam_kunjungan:string; kelas:string; nama:string; keperluan:string; petugas:string; created_at?:string };
type Book = { id:number; no_invt:string; judul:string; pengarang:string|null; kategori:string|null; status:string };
type Section = 'dashboard'|'peminjaman'|'kunjungan'|'buku';
type Toast = { kind:'success'|'error'; text:string } | null;

const nav: {id:Section; label:string; icon:typeof LayoutDashboard}[] = [
  {id:'dashboard',label:'Ringkasan',icon:LayoutDashboard},
  {id:'peminjaman',label:'Peminjaman',icon:ArrowLeftRight},
  {id:'kunjungan',label:'Kunjungan',icon:Users},
  {id:'buku',label:'Koleksi buku',icon:BookMarked},
];
const today = () => new Date().toLocaleDateString('en-CA');
const dayNames = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
const dateLabel = (value?:string) => value ? new Date(`${value.slice(0,10)}T12:00:00`).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'}) : '—';
const escapeCsv = (value:unknown) => `"${String(value ?? '').replaceAll('"','""')}"`;

export default function App() {
  const [section,setSection] = useState<Section>('dashboard');
  const [loans,setLoans] = useState<Loan[]>([]);
  const [visits,setVisits] = useState<Visit[]>([]);
  const [books,setBooks] = useState<Book[]>([]);
  const [loading,setLoading] = useState(true);
  const [busy,setBusy] = useState(false);
  const [search,setSearch] = useState('');
  const [toast,setToast] = useState<Toast>(null);
  const [modal,setModal] = useState<'loan'|'visit'|'book'|null>(null);
  const [editing,setEditing] = useState<Loan|Visit|Book|null>(null);
  const [mobileNav,setMobileNav] = useState(false);

  const load = async (quiet=false) => {
    if(!quiet) setLoading(true);
    try {
      const results = await Promise.all([fetch('/api/loans'),fetch('/api/visits'),fetch('/api/books')]);
      const failed = results.find(r=>!r.ok);
      if(failed) throw new Error('Tidak dapat memuat data. Pastikan koneksi database tersedia.');
      const [l,v,b] = await Promise.all(results.map(r=>r.json()));
      setLoans(l); setVisits(v); setBooks(b);
    } catch(err) { setToast({kind:'error',text:err instanceof Error?err.message:'Terjadi gangguan saat memuat data.'}); }
    finally { setLoading(false); }
  };
  useEffect(()=>{ void load(); },[]);
  useEffect(()=>{ if(!toast)return; const timer=window.setTimeout(()=>setToast(null),3600); return()=>window.clearTimeout(timer); },[toast]);

  const overdue = loans.filter(l=>l.status==='Dipinjam' && l.tanggal_kembali < today()).length;
  const activeLoans = loans.filter(l=>l.status==='Dipinjam').length;
  const todayVisits = visits.filter(v=>v.tanggal?.slice(0,10)===today()).length;
  const title = nav.find(n=>n.id===section)?.label ?? 'Ringkasan';
  const filteredLoans = useMemo(()=>loans.filter(l=>`${l.nomor} ${l.nama} ${l.judul} ${l.no_invt} ${l.petugas}`.toLowerCase().includes(search.toLowerCase())),[loans,search]);
  const filteredVisits = useMemo(()=>visits.filter(v=>`${v.nomor} ${v.nama} ${v.kelas} ${v.keperluan} ${v.petugas}`.toLowerCase().includes(search.toLowerCase())),[visits,search]);
  const filteredBooks = useMemo(()=>books.filter(b=>`${b.no_invt} ${b.judul} ${b.pengarang ?? ''} ${b.kategori ?? ''}`.toLowerCase().includes(search.toLowerCase())),[books,search]);

  const notify = (message:string,kind:'success'|'error'='success')=>setToast({kind,text:message});
  const submit = async (event:React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if(!modal)return;
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());
    if(modal==='visit' && !editing) payload.hari=dayNames[new Date(String(payload.tanggal)+'T12:00:00').getDay()];
    const resource = modal==='loan'?'loans':modal==='visit'?'visits':'books';
    const isEdit=Boolean(editing);
    if(modal==='loan' && !isEdit && (loans.some(l=>l.status==='Dipinjam'&&l.no_invt===payload.no_invt))) { notify('Buku ini masih tercatat sedang dipinjam.', 'error'); return; }
    setBusy(true);
    try {
      const response=await fetch(`/api/${resource}`,{method:isEdit?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,...(isEdit?{nomor:(editing as Loan|Visit).nomor,id:(editing as Book).id}:{})})});
      const body=await response.json(); if(!response.ok)throw new Error(body.error||'Data gagal disimpan.');
      await load(true); setModal(null);setEditing(null);notify(isEdit?'Perubahan berhasil disimpan.':'Data berhasil ditambahkan.');
    } catch(err) { notify(err instanceof Error?err.message:'Gagal menyimpan data.','error'); }
    finally { setBusy(false); }
  };
  const remove = async (resource:'loans'|'visits'|'books',item:Loan|Visit|Book) => {
    if(!window.confirm('Hapus catatan ini? Tindakan ini tidak dapat dibatalkan.'))return;
    try { const response=await fetch(`/api/${resource}`,{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify(resource==='books'?{id:(item as Book).id}:{nomor:(item as Loan|Visit).nomor})}); const body=await response.json();if(!response.ok)throw new Error(body.error||'Gagal menghapus data.');await load(true);notify('Catatan berhasil dihapus.'); }
    catch(err){notify(err instanceof Error?err.message:'Gagal menghapus data.','error');}
  };
  const returnLoan = async (loan:Loan) => {
    try { const response=await fetch('/api/loans',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({nomor:loan.nomor,status:'Kembali'})});const body=await response.json();if(!response.ok)throw new Error(body.error||'Gagal memperbarui status.');await load(true);notify('Buku ditandai sudah kembali.'); }
    catch(err){notify(err instanceof Error?err.message:'Gagal memperbarui status.','error');}
  };
  const openForm=(kind:'loan'|'visit'|'book',item?:Loan|Visit|Book)=>{setEditing(item??null);setModal(kind);};
  const exportCsv=(kind:'loans'|'visits'|'books')=>{
    const rows=kind==='loans'?loans:kind==='visits'?visits:books;
    const keys=kind==='loans'?['nomor','nama','judul','no_invt','tanggal_pinjam','tanggal_kembali','status','petugas']:kind==='visits'?['nomor','hari','tanggal','jam_kunjungan','kelas','nama','keperluan','petugas']:['no_invt','judul','pengarang','kategori','status'];
    const csv=[keys.join(','),...rows.map((row:any)=>keys.map(key=>escapeCsv(row[key])).join(','))].join('\n');
    const link=document.createElement('a');link.href=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}));link.download=`rekap-${kind}-${today()}.csv`;link.click();URL.revokeObjectURL(link.href);
  };
  const openPrint=()=>window.print();
  const openAdd=()=>openForm(section==='peminjaman'?'loan':section==='kunjungan'?'visit':'book');

  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav?'sidebar-open':''}`}>
      <div className="brand"><div className="brand-mark"><LibraryBig size={22}/></div><div><strong>Ruang Baca</strong><span>PERPUSTAKAAN MADRASAH</span></div><button className="mobile-close" onClick={()=>setMobileNav(false)} aria-label="Tutup menu"><X size={18}/></button></div>
      <div className="side-label">MENU UTAMA</div>
      <nav>{nav.map(item=><button key={item.id} className={`nav-link ${section===item.id?'selected':''}`} onClick={()=>{setSection(item.id);setSearch('');setMobileNav(false)}}><item.icon size={18}/><span>{item.label}</span>{item.id==='peminjaman'&&overdue>0&&<i className="nav-count">{overdue}</i>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="partner-icon"><BookOpen size={19}/></div><div><b>Data perpustakaan bersama</b><span>MTs AN-NASHIR<br/>Tersimpan untuk semua pengguna</span></div></div>
    </aside>
    {mobileNav&&<button className="scrim" onClick={()=>setMobileNav(false)} aria-label="Tutup navigasi"/>}
    <main className="main-area">
      <header className="topbar"><div className="topbar-left"><button className="menu-toggle" onClick={()=>setMobileNav(true)} aria-label="Buka navigasi"><Menu size={21}/></button><div><div className="eyebrow">MTs AN-NASHIR</div><h1>{title}</h1></div></div><div className="topbar-right"><span className="today-chip"><CalendarDays size={15}/>{new Date().toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</span><span className="online-dot" title="Aplikasi siap digunakan"/></div></header>
      <div className="content">
        {section==='dashboard'&&<>
          <div className="welcome-row"><div><p className="kicker">PUSAT ADMINISTRASI PERPUSTAKAAN</p><h2>Selamat datang di ruang literasi.</h2><p className="muted">Pantau sirkulasi buku dan aktivitas kunjungan dalam satu tempat.</p></div><button className="button button-primary" onClick={()=>openForm('loan')}><Plus size={17}/> Catat peminjaman</button></div>
          <section className="stats-grid">
            <Stat icon={BookOpen} label="Total koleksi" value={books.length} hint="Buku terdaftar" accent="sage"/>
            <Stat icon={ArrowLeftRight} label="Sedang dipinjam" value={activeLoans} hint={`${loans.length} catatan peminjaman`} accent="blue"/>
            <Stat icon={Users} label="Kunjungan hari ini" value={todayVisits} hint={`${visits.length} total kunjungan`} accent="amber"/>
            <Stat icon={CircleAlert} label="Terlambat kembali" value={overdue} hint="Perlu ditindaklanjuti" accent="rose"/>
          </section>
          <div className="dashboard-grid">
            <section className="panel"><div className="panel-heading"><div><span className="section-caption">SIRKULASI</span><h3>Peminjaman terbaru</h3></div><button className="text-action" onClick={()=>setSection('peminjaman')}>Semua catatan <span>→</span></button></div>
              {loading?<Loading/>:loans.length===0?<Empty icon={BookOpen} title="Belum ada peminjaman" text="Catatan pinjaman baru akan muncul di sini."/>:<div className="activity-list">{[...loans].slice(0,5).map(l=><div className="activity-row" key={l.nomor}><div className="avatar avatar-sage"><BookOpen size={17}/></div><div className="activity-copy"><b>{l.nama}</b><span>{l.judul} · {dateLabel(l.tanggal_pinjam)}</span></div><Status status={l.status}/></div>)}</div>}
            </section>
            <section className="panel"><div className="panel-heading"><div><span className="section-caption">KOMUNITAS</span><h3>Kunjungan terbaru</h3></div><button className="text-action" onClick={()=>setSection('kunjungan')}>Semua catatan <span>→</span></button></div>
              {loading?<Loading/>:visits.length===0?<Empty icon={Users} title="Belum ada kunjungan" text="Aktivitas pengunjung akan tercatat di sini."/>:<div className="activity-list">{[...visits].slice(0,5).map(v=><div className="activity-row" key={v.nomor}><div className="avatar avatar-amber"><Users size={17}/></div><div className="activity-copy"><b>{v.nama}<small>{v.kelas}</small></b><span>{v.keperluan} · {dateLabel(v.tanggal)}</span></div><span className="time-label">{v.jam_kunjungan}</span></div>)}</div>}
            </section>
          </div>
          <section className="insight-strip"><div className="insight-icon"><Activity size={20}/></div><div><b>Data terlihat oleh semua pengguna</b><p>Catatan peminjaman, kunjungan, dan koleksi tersimpan di database bersama sehingga tetap muncul saat aplikasi dibuka orang lain atau setelah aplikasi diperbarui.</p></div><span className="insight-tag">DATABASE AKTIF</span></section>
        </>}
        {section!=='dashboard'&&<section className="panel table-panel"><div className="list-heading"><div><span className="section-caption">DATA PERPUSTAKAAN</span><h2>{section==='peminjaman'?'Rekap peminjaman':section==='kunjungan'?'Rekap kunjungan':'Katalog koleksi'}</h2><p className="muted">{section==='peminjaman'?'Catat dan pantau peminjaman serta pengembalian buku.':section==='kunjungan'?'Arsip aktivitas pengunjung perpustakaan.':'Kelola koleksi buku dan nomor inventaris.'}</p></div><div className="toolbar"><button className="button button-light" onClick={()=>exportCsv(section==='peminjaman'?'loans':section==='kunjungan'?'visits':'books')}><ArrowDownToLine size={16}/><span>Ekspor CSV</span></button><button className="button button-primary" onClick={openAdd}><Plus size={17}/><span>{section==='peminjaman'?'Catat pinjam':section==='kunjungan'?'Catat kunjungan':'Tambah buku'}</span></button></div></div>
          <div className="table-tools"><label className="searchbox"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder={`Cari ${section==='peminjaman'?'nama, judul, inventaris...':section==='kunjungan'?'nama, kelas, keperluan...':'judul, pengarang, inventaris...'}`}/><kbd>⌘ K</kbd></label><button className="button button-light print-button" onClick={openPrint}><FileSpreadsheet size={16}/><span>Cetak rekap</span></button><span className="record-count">{section==='peminjaman'?filteredLoans.length:section==='kunjungan'?filteredVisits.length:filteredBooks.length} catatan</span></div>
          {loading?<Loading/>:section==='peminjaman'?<div className="table-scroll"><table><thead><tr><th>NO.</th><th>PEMINJAM</th><th>JUDUL BUKU</th><th>NO. INVT</th><th>TGL. PINJAM</th><th>TGL. KEMBALI</th><th>STATUS</th><th>PETUGAS</th><th/></tr></thead><tbody>{filteredLoans.map(l=><tr key={l.nomor}><td className="number-cell">{String(l.nomor).padStart(3,'0')}</td><td><b>{l.nama}</b></td><td>{l.judul}</td><td><span className="inventory-code">{l.no_invt}</span></td><td>{dateLabel(l.tanggal_pinjam)}</td><td>{dateLabel(l.tanggal_kembali)}</td><td><Status status={l.status}/></td><td>{l.petugas}</td><td><RowActions onEdit={()=>openForm('loan',l)} onDelete={()=>remove('loans',l)} onReturn={l.status==='Dipinjam'?()=>void returnLoan(l):undefined}/></td></tr>)}</tbody></table>{filteredLoans.length===0&&<Empty icon={BookOpen} title={search?'Catatan tidak ditemukan':'Belum ada peminjaman'} text={search?'Coba kata pencarian lain.':'Mulai dengan mencatat peminjaman pertama.'}/>}</div>:section==='kunjungan'?<div className="table-scroll"><table><thead><tr><th>NO.</th><th>HARI / TANGGAL</th><th>JAM</th><th>KELAS</th><th>NAMA PENGUNJUNG</th><th>KEPERLUAN</th><th>PETUGAS</th><th/></tr></thead><tbody>{filteredVisits.map(v=><tr key={v.nomor}><td className="number-cell">{String(v.nomor).padStart(3,'0')}</td><td><b>{v.hari}</b><span className="cell-sub">{dateLabel(v.tanggal)}</span></td><td>{v.jam_kunjungan}</td><td><span className="class-pill">{v.kelas}</span></td><td><b>{v.nama}</b></td><td>{v.keperluan}</td><td>{v.petugas}</td><td><RowActions onEdit={()=>openForm('visit',v)} onDelete={()=>remove('visits',v)}/></td></tr>)}</tbody></table>{filteredVisits.length===0&&<Empty icon={Users} title={search?'Catatan tidak ditemukan':'Belum ada kunjungan'} text={search?'Coba kata pencarian lain.':'Mulai catat kunjungan perpustakaan.'}/>}</div>:<div className="table-scroll"><table><thead><tr><th>NO.</th><th>NO. INVENTARIS</th><th>JUDUL BUKU</th><th>PENGARANG</th><th>KATEGORI</th><th>KETERSEDIAAN</th><th/></tr></thead><tbody>{filteredBooks.map(b=><tr key={b.id}><td className="number-cell">{String(books.findIndex(item=>item.id===b.id)+1).padStart(3,'0')}</td><td><span className="inventory-code">{b.no_invt}</span></td><td><b>{b.judul}</b></td><td>{b.pengarang||'—'}</td><td>{b.kategori||'—'}</td><td><Status status={b.status}/></td><td><RowActions onEdit={()=>openForm('book',b)} onDelete={()=>remove('books',b)}/></td></tr>)}</tbody></table>{filteredBooks.length===0&&<Empty icon={BookMarked} title={search?'Buku tidak ditemukan':'Koleksi masih kosong'} text={search?'Coba kata pencarian lain.':'Tambahkan inventaris buku untuk mulai membangun katalog.'}/>}</div>}
        </section>}
      </div>
    </main>
    {modal&&<RecordModal kind={modal} item={editing} books={books} busy={busy} onClose={()=>{setModal(null);setEditing(null)}} onSubmit={submit}/>}
    {toast&&<div className={`toast ${toast.kind==='error'?'toast-error':''}`}><span className="toast-check">{toast.kind==='error'?<CircleAlert size={17}/>:<Check size={17}/>}</span>{toast.text}<button onClick={()=>setToast(null)} aria-label="Tutup notifikasi"><X size={16}/></button></div>}
  </div>;
}

function Stat({icon:Icon,label,value,hint,accent}:{icon:typeof BookOpen;label:string;value:number;hint:string;accent:string}){return <article className="stat-card"><div className={`stat-icon ${accent}`}><Icon size={19}/></div><div className="stat-label">{label}</div><strong className="stat-value">{value}</strong><span className="stat-hint">{hint}</span></article>}
function Status({status}:{status:string}){const cls=status==='Dipinjam'?'status-blue':status==='Terlambat'?'status-red':status==='Tersedia'?'status-green':'status-neutral';return <span className={`status ${cls}`}><i/>{status}</span>}
function Loading(){return <div className="loading-state"><span className="spinner"/>Memuat data perpustakaan…</div>}
function Empty({icon:Icon,title,text}:{icon:typeof BookOpen;title:string;text:string}){return <div className="empty-state"><span><Icon size={22}/></span><b>{title}</b><p>{text}</p></div>}
function RowActions({onEdit,onDelete,onReturn}:{onEdit:()=>void;onDelete:()=>void;onReturn?:()=>void}){return <div className="row-actions">{onReturn&&<button className="icon-button return-action" onClick={onReturn} title="Tandai buku dikembalikan"><Check size={15}/></button>}<button className="icon-button" onClick={onEdit} title="Edit catatan">✎</button><button className="icon-button delete-action" onClick={onDelete} title="Hapus catatan"><X size={15}/></button></div>}
function Field({label,name,defaultValue,type='text',required=true,placeholder}:{label:string;name:string;defaultValue?:string;type?:string;required?:boolean;placeholder?:string}){return <label className="field"><span>{label}{required&&<i> *</i>}</span><input name={name} type={type} defaultValue={defaultValue} required={required} placeholder={placeholder}/></label>}
function RecordModal({kind,item,books,busy,onClose,onSubmit}:{kind:'loan'|'visit'|'book';item:Loan|Visit|Book|null;books:Book[];busy:boolean;onClose:()=>void;onSubmit:(e:React.FormEvent<HTMLFormElement>)=>void}){
 const isLoan=kind==='loan',isVisit=kind==='visit',loan=item as Loan|null,visit=item as Visit|null,book=item as Book|null;
 const name=isLoan?'Peminjaman buku':isVisit?'Catat kunjungan':'Tambah koleksi buku';
 return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><section className="modal-card" role="dialog" aria-modal="true"><div className="modal-head"><div><span className="section-caption">FORMULIR ARSIP</span><h2>{item?`Edit ${isLoan?'peminjaman':isVisit?'kunjungan':'koleksi'}`:name}</h2><p>Lengkapi informasi dengan benar sebelum disimpan.</p></div><button className="modal-x" onClick={onClose} aria-label="Tutup"><X size={19}/></button></div><form onSubmit={onSubmit}><div className="form-grid">
 {isLoan&&<><Field label="Nama peminjam" name="nama" defaultValue={loan?.nama} placeholder="Nama siswa"/><label className="field"><span>Judul buku <i>*</i></span><select name="judul" defaultValue={loan?.judul||''} required><option value="">Pilih judul buku</option>{books.map(b=><option value={b.judul} key={b.id}>{b.judul}</option>)}</select></label><Field label="Nomor inventaris" name="no_invt" defaultValue={loan?.no_invt} placeholder="Mis. INV-001"/><Field label="Tanggal pinjam" name="tanggal_pinjam" type="date" defaultValue={loan?.tanggal_pinjam||today()}/><Field label="Tanggal kembali" name="tanggal_kembali" type="date" defaultValue={loan?.tanggal_kembali||new Date(Date.now()+7*86400000).toLocaleDateString('en-CA')}/><Field label="Nama petugas" name="petugas" defaultValue={loan?.petugas} placeholder="Nama petugas"/></>}
 {isVisit&&<><Field label="Tanggal kunjungan" name="tanggal" type="date" defaultValue={visit?.tanggal||today()}/><Field label="Jam kunjungan" name="jam_kunjungan" type="time" defaultValue={visit?.jam_kunjungan||new Date().toTimeString().slice(0,5)}/><Field label="Hari" name="hari" defaultValue={visit?.hari||dayNames[new Date().getDay()]}/><Field label="Kelas" name="kelas" defaultValue={visit?.kelas} placeholder="Mis. VII A"/><Field label="Nama pengunjung" name="nama" defaultValue={visit?.nama} placeholder="Nama siswa"/><label className="field"><span>Keperluan <i>*</i></span><select name="keperluan" defaultValue={visit?.keperluan||''} required><option value="">Pilih keperluan</option><option>Membaca</option><option>Meminjam buku</option><option>Mengembalikan buku</option><option>Belajar kelompok</option><option>Lainnya</option></select></label><Field label="Nama petugas" name="petugas" defaultValue={visit?.petugas} placeholder="Nama petugas"/></>}
 {kind==='book'&&<><Field label="Nomor inventaris" name="no_invt" defaultValue={book?.no_invt} placeholder="Mis. INV-001"/><Field label="Judul buku" name="judul" defaultValue={book?.judul} placeholder="Judul buku"/><Field label="Pengarang" name="pengarang" defaultValue={book?.pengarang||''} required={false} placeholder="Nama pengarang"/><Field label="Kategori" name="kategori" defaultValue={book?.kategori||''} required={false} placeholder="Fiksi, pelajaran, referensi…"/></>}
 </div><div className="modal-actions"><button type="button" className="button button-light" onClick={onClose}>Batal</button><button className="button button-primary" disabled={busy}>{busy?<><span className="mini-spinner"/>Menyimpan…</>:<><Check size={16}/>{item?'Simpan perubahan':'Simpan catatan'}</>}</button></div></form></section></div>
}
