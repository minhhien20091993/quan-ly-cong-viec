import React, { useMemo, useState } from 'react';
import { Building2, CalendarDays, ClipboardList, Eye, MapPin, Package, Pencil, Plus, Search, ShieldCheck, Wrench, X } from 'lucide-react';

const ASSET_CATEGORIES = ['Trang thiết bị y tế', 'Công nghệ thông tin', 'Cơ sở vật chất', 'Phương tiện', 'Khác'];
const ASSET_STATUSES = ['Đang sử dụng', 'Chờ bảo trì', 'Đang bảo trì', 'Hư hỏng', 'Đã thanh lý'];
const localDate = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const blankAsset = () => ({
  code: '', name: '', category: ASSET_CATEGORIES[0], manufacturer: '', model: '', serialNumber: '',
  department: '', location: '', purchaseDate: '', warrantyUntil: '', status: ASSET_STATUSES[0], note: '', history: []
});
const formatDate = (value) => value ? new Date(`${value}T00:00:00`).toLocaleDateString('vi-VN') : '—';
const statusStyle = (status) => ({
  'Đang sử dụng': 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
  'Chờ bảo trì': 'bg-amber-500/10 text-amber-300 border-amber-500/20',
  'Đang bảo trì': 'bg-blue-500/10 text-blue-300 border-blue-500/20',
  'Hư hỏng': 'bg-red-500/10 text-red-300 border-red-500/20',
  'Đã thanh lý': 'bg-slate-500/10 text-slate-400 border-slate-500/20'
}[status] || 'bg-slate-500/10 text-slate-400 border-slate-500/20');

export default function AssetManagement({ assets, onSave, onCreateTask, darkMode, currentUserLabel }) {
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [formOpen, setFormOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState(null);
  const [form, setForm] = useState(blankAsset);
  const [formError, setFormError] = useState('');
  const [detailAsset, setDetailAsset] = useState(null);
  const [historyForm, setHistoryForm] = useState({ type: 'Bảo trì', date: localDate(), note: '' });

  const filteredAssets = useMemo(() => assets.filter(asset => {
    const text = `${asset.code} ${asset.name} ${asset.model} ${asset.serialNumber} ${asset.department} ${asset.location}`.toLowerCase();
    return text.includes(query.trim().toLowerCase()) &&
      (categoryFilter === 'ALL' || asset.category === categoryFilter) &&
      (statusFilter === 'ALL' || asset.status === statusFilter);
  }).sort((a, b) => (a.code || '').localeCompare(b.code || '', 'vi')), [assets, query, categoryFilter, statusFilter]);

  const panel = darkMode ? 'border-slate-800 bg-slate-900/50' : 'border-slate-200 bg-white';
  const input = `min-h-11 w-full rounded-xl border px-3.5 py-2.5 text-base sm:text-sm ${darkMode ? 'border-slate-700 bg-slate-950 text-slate-100 placeholder:text-slate-500' : 'border-slate-200 bg-slate-50 text-slate-900'}`;
  const openCreate = () => { setEditingAsset(null); setForm(blankAsset()); setFormError(''); setFormOpen(true); };
  const openEdit = (asset) => { setEditingAsset(asset); setForm({ ...blankAsset(), ...asset }); setFormError(''); setFormOpen(true); };
  const saveForm = (event) => {
    event.preventDefault();
    const code = form.code.trim();
    if (!code || !form.name.trim()) { setFormError('Vui lòng nhập mã và tên tài sản.'); return; }
    if (assets.some(asset => asset.code.trim().toLowerCase() === code.toLowerCase() && asset.id !== editingAsset?.id)) {
      setFormError('Mã tài sản đã tồn tại. Vui lòng dùng mã khác.'); return;
    }
    onSave({ ...form, id: editingAsset?.id || `asset-${Date.now()}`, code, name: form.name.trim() });
    setFormOpen(false);
  };
  const addHistory = (event) => {
    event.preventDefault();
    if (!historyForm.note.trim() || !detailAsset) return;
    const updated = {
      ...detailAsset,
      history: [{ id: `event-${Date.now()}`, ...historyForm, note: historyForm.note.trim(), author: currentUserLabel }, ...(detailAsset.history || [])]
    };
    onSave(updated);
    setDetailAsset(updated);
    setHistoryForm({ type: 'Bảo trì', date: localDate(), note: '' });
  };
  const actionButton = `inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-medium transition ${darkMode ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-700 hover:bg-slate-100'}`;

  return (
    <section className={`overflow-hidden rounded-2xl border shadow-xl ${panel}`}>
      <div className={`flex flex-col gap-4 border-b p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5 ${darkMode ? 'border-slate-800' : 'border-slate-200'}`}>
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400"><Package className="h-5 w-5"/></div>
          <div><h2 className="text-lg font-bold">Quản lý tài sản</h2><p className="mt-0.5 text-xs text-slate-400">Hồ sơ, tình trạng và lịch sử bảo trì tài sản.</p></div>
        </div>
        <button onClick={openCreate} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 hover:bg-blue-500"><Plus className="h-4 w-4"/> Thêm tài sản</button>
      </div>

      <div className="grid gap-3 p-4 sm:grid-cols-[minmax(220px,1fr)_auto_auto] sm:p-5">
        <div className="relative"><Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-500"/><input className={`${input} pl-10`} value={query} onChange={e => setQuery(e.target.value)} placeholder="Tìm mã, tên, model, serial, vị trí..." aria-label="Tìm tài sản"/></div>
        <select className={input} value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} aria-label="Lọc theo nhóm tài sản"><option value="ALL">Tất cả nhóm tài sản</option>{ASSET_CATEGORIES.map(category => <option key={category}>{category}</option>)}</select>
        <select className={input} value={statusFilter} onChange={e => setStatusFilter(e.target.value)} aria-label="Lọc theo tình trạng"><option value="ALL">Tất cả tình trạng</option>{ASSET_STATUSES.map(status => <option key={status}>{status}</option>)}</select>
      </div>

      <div className="px-4 pb-4 sm:px-5 sm:pb-5">
        <div className="mb-3 flex items-center justify-between text-xs text-slate-400"><span>{filteredAssets.length} / {assets.length} tài sản</span><span>Hồ sơ được đồng bộ cùng workspace</span></div>
        {filteredAssets.length === 0 ? (
          <div className={`rounded-2xl border border-dashed px-5 py-12 text-center ${darkMode ? 'border-slate-700' : 'border-slate-300'}`}>
            <Package className="mx-auto h-9 w-9 text-slate-500"/><h3 className="mt-3 text-sm font-semibold">{assets.length ? 'Không tìm thấy tài sản phù hợp' : 'Chưa có hồ sơ tài sản'}</h3>
            <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-slate-400">Thêm hồ sơ với mã tài sản, nhóm, vị trí và tình trạng để bắt đầu theo dõi. Không có tài sản mẫu được điền sẵn.</p>
            {!assets.length && <button onClick={openCreate} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white"><Plus className="h-4 w-4"/> Thêm hồ sơ đầu tiên</button>}
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto rounded-xl border sm:block">
              <table className={`w-full min-w-[850px] text-left text-sm ${darkMode ? 'border-slate-800' : 'border-slate-200'}`}>
                <thead className={darkMode ? 'bg-slate-950/70 text-slate-400' : 'bg-slate-50 text-slate-600'}><tr className="text-[11px] uppercase tracking-wide"><th className="px-4 py-3">Mã / Tài sản</th><th className="px-4 py-3">Nhóm</th><th className="px-4 py-3">Khoa / Vị trí</th><th className="px-4 py-3">Bảo hành đến</th><th className="px-4 py-3">Tình trạng</th><th className="px-4 py-3 text-right">Thao tác</th></tr></thead>
                <tbody className={`divide-y ${darkMode ? 'divide-slate-800' : 'divide-slate-200'}`}>
                  {filteredAssets.map(asset => <tr key={asset.id} className={darkMode ? 'hover:bg-slate-800/30' : 'hover:bg-slate-50'}>
                    <td className="px-4 py-3"><p className="font-mono text-xs text-cyan-300">{asset.code}</p><p className="mt-1 font-semibold">{asset.name}</p><p className="mt-0.5 text-xs text-slate-400">{[asset.manufacturer, asset.model, asset.serialNumber && `S/N ${asset.serialNumber}`].filter(Boolean).join(' · ') || 'Chưa có thông tin model'}</p></td>
                    <td className="px-4 py-3 text-xs">{asset.category || 'Khác'}</td>
                    <td className="px-4 py-3 text-xs"><p>{asset.department || 'Chưa phân khoa/phòng'}</p><p className="mt-1 text-slate-400">{asset.location || 'Chưa có vị trí'}</p></td>
                    <td className="px-4 py-3 text-xs">{formatDate(asset.warrantyUntil)}</td>
                    <td className="px-4 py-3"><span className={`inline-flex rounded-lg border px-2.5 py-1 text-[10px] font-semibold ${statusStyle(asset.status)}`}>{asset.status}</span></td>
                    <td className="px-4 py-3"><div className="flex justify-end gap-1.5"><button className={actionButton} onClick={() => setDetailAsset(asset)} title="Hồ sơ và lịch sử"><Eye className="h-3.5 w-3.5"/> Hồ sơ</button><button className={actionButton} onClick={() => onCreateTask(asset)} title="Tạo công việc gắn với tài sản"><ClipboardList className="h-3.5 w-3.5"/> Tạo việc</button><button className={actionButton} onClick={() => openEdit(asset)} title="Sửa tài sản"><Pencil className="h-3.5 w-3.5"/></button></div></td>
                  </tr>)}
                </tbody>
              </table>
            </div>
            <div className="space-y-3 sm:hidden">
              {filteredAssets.map(asset => <article key={asset.id} className={`rounded-xl border p-4 ${darkMode ? 'border-slate-800 bg-slate-950/50' : 'border-slate-200 bg-slate-50'}`}>
                <div className="flex items-start justify-between gap-2"><div className="min-w-0"><span className="font-mono text-[11px] text-cyan-300">{asset.code}</span><h3 className="mt-1 break-words text-sm font-semibold">{asset.name}</h3><p className="mt-1 text-xs text-slate-400">{asset.category}</p></div><span className={`shrink-0 rounded-lg border px-2 py-1 text-[10px] font-semibold ${statusStyle(asset.status)}`}>{asset.status}</span></div>
                <div className="mt-3 space-y-1.5 text-xs text-slate-400"><p className="flex items-center gap-2"><Building2 className="h-3.5 w-3.5"/>{asset.department || 'Chưa phân khoa/phòng'}</p><p className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5"/>{asset.location || 'Chưa có vị trí'}</p><p className="flex items-center gap-2"><ShieldCheck className="h-3.5 w-3.5"/>Bảo hành đến {formatDate(asset.warrantyUntil)}</p></div>
                <div className="mt-3 grid grid-cols-3 gap-2"><button className={actionButton} onClick={() => setDetailAsset(asset)}><Eye className="h-3.5 w-3.5"/> Hồ sơ</button><button className={actionButton} onClick={() => onCreateTask(asset)}><ClipboardList className="h-3.5 w-3.5"/> Tạo việc</button><button className={actionButton} onClick={() => openEdit(asset)}><Pencil className="h-3.5 w-3.5"/> Sửa</button></div>
              </article>)}
            </div>
          </>
        )}
      </div>

      {formOpen && <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/75 backdrop-blur-sm sm:items-center sm:p-4">
        <div className={`flex max-h-[94dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border sm:rounded-3xl ${panel}`}>
          <div className={`flex shrink-0 items-center justify-between border-b px-5 py-4 sm:px-7 ${darkMode ? 'border-slate-800' : 'border-slate-200'}`}><div><h2 className="font-bold">{editingAsset ? 'Cập nhật tài sản' : 'Thêm tài sản'}</h2><p className="mt-1 text-xs text-slate-400">Thông tin có dấu * là bắt buộc.</p></div><button aria-label="Đóng" onClick={() => setFormOpen(false)} className={actionButton}><X className="h-4 w-4"/></button></div>
          <form onSubmit={saveForm} className="min-h-0 space-y-4 overflow-y-auto p-5 sm:p-7">
            <div className="grid gap-4 sm:grid-cols-2"><label className="space-y-1.5 text-xs text-slate-400">Mã tài sản *<input className={input} value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="Ví dụ: TS-0001" required/></label><label className="space-y-1.5 text-xs text-slate-400">Tên tài sản *<input className={input} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Nhập tên theo hồ sơ quản lý" required/></label></div>
            <div className="grid gap-4 sm:grid-cols-2"><label className="space-y-1.5 text-xs text-slate-400">Nhóm tài sản<select className={input} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>{ASSET_CATEGORIES.map(category => <option key={category}>{category}</option>)}</select></label><label className="space-y-1.5 text-xs text-slate-400">Tình trạng<select className={input} value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>{ASSET_STATUSES.map(status => <option key={status}>{status}</option>)}</select></label></div>
            <div className="grid gap-4 sm:grid-cols-2"><label className="space-y-1.5 text-xs text-slate-400">Hãng sản xuất<input className={input} value={form.manufacturer} onChange={e => setForm({ ...form, manufacturer: e.target.value })} placeholder="Không bắt buộc"/></label><label className="space-y-1.5 text-xs text-slate-400">Model<input className={input} value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} placeholder="Không bắt buộc"/></label></div>
            <div className="grid gap-4 sm:grid-cols-2"><label className="space-y-1.5 text-xs text-slate-400">Số serial<input className={input} value={form.serialNumber} onChange={e => setForm({ ...form, serialNumber: e.target.value })} placeholder="Không bắt buộc"/></label><label className="space-y-1.5 text-xs text-slate-400">Khoa / Phòng<input className={input} value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} placeholder="Nhập đơn vị sử dụng"/></label></div>
            <div className="grid gap-4 sm:grid-cols-2"><label className="space-y-1.5 text-xs text-slate-400">Vị trí<input className={input} value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="Tòa nhà, tầng, phòng..."/></label><label className="space-y-1.5 text-xs text-slate-400">Ngày mua<input className={input} type="date" value={form.purchaseDate} onChange={e => setForm({ ...form, purchaseDate: e.target.value })}/></label></div>
            <label className="block space-y-1.5 text-xs text-slate-400">Ngày hết hạn bảo hành<input className={input} type="date" value={form.warrantyUntil} onChange={e => setForm({ ...form, warrantyUntil: e.target.value })}/></label>
            <label className="block space-y-1.5 text-xs text-slate-400">Ghi chú<textarea className={`${input} min-h-20 resize-y`} value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} placeholder="Thông tin bổ sung"/></label>
            {formError && <p role="alert" className="text-xs text-red-400">{formError}</p>}
            <div className={`sticky bottom-0 -mx-5 flex flex-col-reverse gap-2 border-t px-5 py-4 sm:-mx-7 sm:flex-row sm:justify-end sm:px-7 ${darkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'}`}><button type="button" className={actionButton} onClick={() => setFormOpen(false)}>Hủy</button><button className="min-h-10 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-500">Lưu tài sản</button></div>
          </form>
        </div>
      </div>}

      {detailAsset && <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/75 backdrop-blur-sm sm:items-center sm:p-4">
        <div className={`flex max-h-[94dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border sm:rounded-3xl ${panel}`}>
          <div className={`flex shrink-0 items-start justify-between gap-3 border-b px-5 py-4 sm:px-7 ${darkMode ? 'border-slate-800' : 'border-slate-200'}`}><div className="min-w-0"><p className="font-mono text-xs text-cyan-300">{detailAsset.code}</p><h2 className="mt-1 truncate text-lg font-bold">{detailAsset.name}</h2><p className="mt-1 text-xs text-slate-400">{detailAsset.category} · {detailAsset.status}</p></div><button aria-label="Đóng" onClick={() => setDetailAsset(null)} className={actionButton}><X className="h-4 w-4"/></button></div>
          <div className="space-y-5 overflow-y-auto p-5 sm:p-7">
            <div className="grid gap-3 sm:grid-cols-2">{[['Hãng / Model', [detailAsset.manufacturer, detailAsset.model].filter(Boolean).join(' · ')], ['Serial', detailAsset.serialNumber], ['Khoa / Phòng', detailAsset.department], ['Vị trí', detailAsset.location], ['Ngày mua', formatDate(detailAsset.purchaseDate)], ['Bảo hành đến', formatDate(detailAsset.warrantyUntil)]].map(([label, value]) => <div key={label} className={`rounded-xl border p-3 ${darkMode ? 'border-slate-800 bg-slate-950/40' : 'border-slate-200 bg-slate-50'}`}><p className="text-[11px] text-slate-500">{label}</p><p className="mt-1 break-words text-sm font-medium">{value || 'Chưa cập nhật'}</p></div>)}</div>
            {detailAsset.note && <p className="rounded-xl bg-slate-800/40 p-3 text-sm text-slate-300">{detailAsset.note}</p>}
            <div><h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><Wrench className="h-4 w-4 text-blue-400"/>Lịch sử bảo trì / sửa chữa</h3>
              <form onSubmit={addHistory} className={`mb-4 space-y-3 rounded-xl border p-3 ${darkMode ? 'border-slate-800 bg-slate-950/40' : 'border-slate-200 bg-slate-50'}`}><div className="grid gap-3 sm:grid-cols-[1fr_1fr]"><select className={input} value={historyForm.type} onChange={e => setHistoryForm({ ...historyForm, type: e.target.value })}><option>Bảo trì</option><option>Sửa chữa</option><option>Kiểm định</option><option>Điều chuyển</option><option>Ghi nhận khác</option></select><input aria-label="Ngày ghi nhận" className={input} type="date" value={historyForm.date} onChange={e => setHistoryForm({ ...historyForm, date: e.target.value })} required/></div><textarea className={`${input} min-h-16 resize-y`} value={historyForm.note} onChange={e => setHistoryForm({ ...historyForm, note: e.target.value })} placeholder="Mô tả nội dung và kết quả xử lý..." required/><button className="min-h-10 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white"><Plus className="mr-1 inline h-3.5 w-3.5"/> Ghi nhận lịch sử</button></form>
              <div className="space-y-2">{(detailAsset.history || []).map(item => <div key={item.id} className={`flex gap-3 rounded-xl border p-3 ${darkMode ? 'border-slate-800' : 'border-slate-200'}`}><CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-blue-400"/><div className="min-w-0"><p className="text-xs font-semibold">{item.type} <span className="ml-1 font-normal text-slate-400">· {formatDate(item.date)}</span></p><p className="mt-1 whitespace-pre-wrap text-sm text-slate-300">{item.note}</p>{item.author && <p className="mt-1 text-[10px] text-slate-500">Ghi nhận bởi {item.author}</p>}</div></div>)}{(!detailAsset.history || detailAsset.history.length === 0) && <p className="rounded-xl border border-dashed border-slate-700 p-5 text-center text-xs text-slate-500">Chưa có lịch sử được ghi nhận.</p>}</div>
            </div>
          </div>
        </div>
      </div>}
    </section>
  );
}
