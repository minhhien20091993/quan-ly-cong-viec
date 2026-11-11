import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, LoaderCircle, Search, ShieldCheck, UserRoundCheck, UserRoundX } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function OfficeAiAccess({ darkMode, onClose }) {
  const [accounts, setAccounts] = useState([]);
  const [permissions, setPermissions] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState('');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    setError('');
    const [profileResult, accessResult, adminResult] = await Promise.all([
      supabase.from('office_ai_profiles').select('user_id,email,display_name,created_at').order('email'),
      supabase.from('office_ai_access').select('user_id,enabled'),
      supabase.from('office_ai_admins').select('user_id'),
    ]);
    const failure = profileResult.error || accessResult.error || adminResult.error;
    if (failure) {
      setError(failure.message || 'Không tải được danh sách tài khoản. Hãy chạy migration Office AI trong Supabase.');
      setLoading(false);
      return;
    }
    const nextPermissions = Object.fromEntries((accessResult.data || []).map(row => [row.user_id, row.enabled]));
    for (const row of adminResult.data || []) nextPermissions[row.user_id] = true;
    setAccounts(profileResult.data || []);
    setPermissions(nextPermissions);
    setLoading(false);
  }, []);

  useEffect(() => { loadAccounts(); }, [loadAccounts]);

  const filteredAccounts = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return accounts;
    return accounts.filter(account =>
      (account.email || '').toLowerCase().includes(query) ||
      (account.display_name || '').toLowerCase().includes(query)
    );
  }, [accounts, search]);

  const toggleAccess = async (account) => {
    if (account.user_id === accounts.find(row => row.email?.toLowerCase() === 'minhhien20091993@gmail.com')?.user_id) {
      setNotice('Tài khoản quản trị viên cao nhất luôn có quyền Văn phòng AI.');
      return;
    }
    const enabled = !permissions[account.user_id];
    setSavingId(account.user_id);
    setError('');
    setNotice('');
    const { data: authData } = await supabase.auth.getUser();
    const { error: saveError } = await supabase.from('office_ai_access').upsert({
      user_id: account.user_id,
      enabled,
      granted_by: authData?.user?.id || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
    if (saveError) setError(saveError.message || 'Không lưu được quyền truy cập.');
    else {
      setPermissions(current => ({ ...current, [account.user_id]: enabled }));
      setNotice(enabled ? 'Đã cấp quyền Văn phòng AI.' : 'Đã thu hồi quyền Văn phòng AI.');
    }
    setSavingId('');
  };

  const panel = darkMode ? 'border-slate-800 bg-slate-900/60 text-slate-100' : 'border-slate-200 bg-white text-slate-900';
  const subtle = darkMode ? 'text-slate-400' : 'text-slate-500';

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-slate-950/75 p-3 backdrop-blur-sm sm:p-8" role="dialog" aria-modal="true" aria-labelledby="office-ai-access-title">
      <section className={`mx-auto max-w-5xl rounded-2xl border shadow-2xl ${panel}`}>
        <header className={`flex items-center justify-between gap-4 border-b p-5 ${darkMode ? 'border-slate-800' : 'border-slate-200'}`}>
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-blue-500/10 p-2.5 text-blue-400"><ShieldCheck className="h-5 w-5"/></div>
            <div>
              <p className={`text-xs font-semibold uppercase tracking-wider ${subtle}`}>Quản trị hệ thống</p>
              <h2 id="office-ai-access-title" className="text-lg font-bold">Quyền truy cập Văn phòng AI</h2>
            </div>
          </div>
          <button onClick={onClose} className={`rounded-lg border px-3 py-2 text-sm ${darkMode ? 'border-slate-700 hover:bg-slate-800' : 'border-slate-200 hover:bg-slate-100'}`}><ArrowLeft className="mr-1 inline h-4 w-4"/>Đóng</button>
        </header>

        <div className="space-y-4 p-5">
          <p className={`text-sm ${subtle}`}>Cấp quyền theo từng tài khoản Supabase. Chỉ quản trị viên cao nhất mới xem và thay đổi danh sách này.</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className={`absolute left-3 top-3 h-4 w-4 ${subtle}`}/>
              <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Tìm theo email hoặc tên" className={`w-full rounded-xl border py-2.5 pl-10 pr-3 text-sm outline-none focus:border-blue-500 ${darkMode ? 'border-slate-700 bg-slate-950 text-slate-100' : 'border-slate-200 bg-slate-50 text-slate-900'}`}/>
            </div>
            <button onClick={loadAccounts} disabled={loading} className={`rounded-xl border px-4 py-2 text-sm font-medium ${darkMode ? 'border-slate-700 hover:bg-slate-800' : 'border-slate-200 hover:bg-slate-100'}`}>{loading ? 'Đang tải…' : 'Tải lại danh sách'}</button>
          </div>
          {error && <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div>}
          {notice && <div role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">{notice}</div>}

          <div className={`overflow-hidden rounded-xl border ${darkMode ? 'border-slate-800' : 'border-slate-200'}`}>
            <div className={`grid grid-cols-[minmax(0,1fr)_auto] gap-3 px-4 py-3 text-xs font-semibold uppercase tracking-wide ${darkMode ? 'bg-slate-950/70 text-slate-400' : 'bg-slate-50 text-slate-500'}`}><span>Tài khoản Supabase</span><span>Quyền Văn phòng AI</span></div>
            {loading ? <div className={`flex items-center justify-center gap-2 p-10 text-sm ${subtle}`}><LoaderCircle className="h-4 w-4 animate-spin"/>Đang tải danh sách tài khoản…</div>
              : filteredAccounts.length === 0 ? <div className={`p-10 text-center text-sm ${subtle}`}>Không tìm thấy tài khoản.</div>
              : filteredAccounts.map(account => {
                const admin = account.email?.toLowerCase() === 'minhhien20091993@gmail.com';
                const allowed = Boolean(permissions[account.user_id]);
                return <div key={account.user_id} className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-t px-4 py-3 ${darkMode ? 'border-slate-800' : 'border-slate-200'}`}>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-sm font-medium">{account.display_name || account.email || 'Tài khoản'}{admin && <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[11px] font-semibold text-violet-300">Quản trị viên cao nhất</span>}</div>
                    <div className={`mt-0.5 truncate text-xs ${subtle}`}>{account.email}</div>
                  </div>
                  {admin ? <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-400"><UserRoundCheck className="h-4 w-4"/>Luôn được phép</span>
                    : <button disabled={savingId === account.user_id} onClick={() => toggleAccess(account)} aria-pressed={allowed} className={`inline-flex min-w-[124px] items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition disabled:opacity-50 ${allowed ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : darkMode ? 'border-slate-700 bg-slate-950 text-slate-400 hover:border-slate-600' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
                      {savingId === account.user_id ? <LoaderCircle className="h-4 w-4 animate-spin"/> : allowed ? <UserRoundCheck className="h-4 w-4"/> : <UserRoundX className="h-4 w-4"/>}
                      {allowed ? 'Được phép' : 'Chưa cấp quyền'}
                    </button>}
                </div>;
              })}
          </div>
          <p className={`text-xs ${subtle}`}>Tắt quyền sẽ có hiệu lực ở các yêu cầu AI tiếp theo sau khi lưu.</p>
        </div>
      </section>
    </div>
  );
}
