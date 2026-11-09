import React, { useState, useEffect, useMemo } from 'react';
import { isSupabaseConfigured, supabase, EMPTY_WORKSPACE } from './lib/supabase';
import { 
  LayoutDashboard, 
  CheckSquare, 
  Users, 
  BarChart3, 
  Plus, 
  Trash2, 
  Edit3, 
  Search, 
  Moon, 
  Sun, 
  Clock, 
  Building2, 
  Lock,
  KeyRound,
  FolderTree,
  ShieldCheck,
  Activity,
  Layers,
  SlidersHorizontal,
  CheckCircle,
  PlayCircle,
  Calendar,
  AlertTriangle,
  MessageSquare,
  Send,
  Hourglass,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

const getVnDateTimeString = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const getLocalDateString = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getTaskDateLabel = (task) => {
  const dateValue = task.scheduledDate || task.dateTime?.split('T')[0];
  if (!dateValue) return 'Chưa có ngày';
  const parsedDate = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(parsedDate.getTime())) return 'Chưa có ngày';
  const formattedDate = parsedDate.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  return `${task.scheduledDate ? 'Dự kiến' : 'Ghi nhận'} ${formattedDate}`;
};

export default function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(isSupabaseConfigured);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [cloudError, setCloudError] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [workspaceReady, setWorkspaceReady] = useState(!isSupabaseConfigured);

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined;
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) setLoginError(error.message);
      setSession(data?.session ?? null);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoginError('');
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleCloudLogin = async (event) => {
    event.preventDefault();
    setLoginError('');
    const { error } = await supabase.auth.signInWithPassword({ email: loginEmail.trim(), password: loginPassword });
    if (error) setLoginError('Không đăng nhập được. Kiểm tra email, mật khẩu và tài khoản Supabase đã được tạo.');
  };

  const [activeTab, setActiveTab] = useState('kanban');
  const [activeCategorySubTab, setActiveCategorySubTab] = useState('staff');
  const [darkMode, setDarkMode] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPriority, setFilterPriority] = useState('ALL');
  const [filterAssignee, setFilterAssignee] = useState('ALL');
  const [filterDept, setFilterDept] = useState('ALL');
  const [filterDate, setFilterDate] = useState('ALL');
  const [calendarSelectedDate, setCalendarSelectedDate] = useState(() => getLocalDateString());
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });

  const [isCategoryUnlocked, setIsCategoryUnlocked] = useState(false);
  const [categoryPassInput, setCategoryPassInput] = useState('');
  const [passError, setPassError] = useState(false);

  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const [staffList, setStaffList] = useState(() => {
    const saved = localStorage.getItem('demo_staff');
    return saved ? JSON.parse(saved) : [
      { id: 1, name: 'Nhân sự mẫu 01', role: 'Điều phối viên', email: 'demo01@example.invalid', phone: '' },
      { id: 2, name: 'Nhân sự mẫu 02', role: 'Nhân viên hỗ trợ', email: 'demo02@example.invalid', phone: '' }
    ];
  });

  const [departments, setDepartments] = useState(() => {
    const saved = localStorage.getItem('demo_departments');
    return saved ? JSON.parse(saved) : [
      'Bộ phận Hành chính',
      'Bộ phận Kỹ thuật',
      'Bộ phận Vận hành',
      'Bộ phận Tiếp nhận',
      'Bộ phận Hỗ trợ',
      'Bộ phận Dự án',
      'Bộ phận Tài chính',
      'Bộ phận Tổng hợp',
      'Bộ phận Công nghệ'
    ];
  });

  const [categoryTypes, setCategoryTypes] = useState(() => {
    const saved = localStorage.getItem('demo_category_types');
    return saved ? JSON.parse(saved) : ['Sự cố hạ tầng', 'Bảo trì định kỳ', 'Yêu cầu phần mềm mẫu', 'Cấp tài khoản / Phân quyền'];
  });

  const [tasks, setTasks] = useState(() => {
    const saved = localStorage.getItem('demo_tasks');
    return saved ? JSON.parse(saved) : [
      { 
        id: 101, 
        title: 'Thiết lập máy in văn phòng', 
        description: 'Máy in mẫu cần được kiểm tra kết nối', 
        assignee: 'Nhân sự mẫu 01', 
        priority: 'P1 - Khẩn cấp', 
        status: 'In Progress', 
        department: 'Bộ phận Hành chính', 
        estimatedHours: 0.5, 
        startTimestamp: Date.now() - 900000, 
        totalTimeSpent: 0, 
        dateTime: getVnDateTimeString(),
        comments: [
          { id: 1, author: 'Nhân sự mẫu 01', text: 'Đã tiếp nhận yêu cầu mẫu, đang kiểm tra kết nối.', time: '10 phút trước' }
        ]
      }
    ];
  });

  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    assignee: '',
    priority: 'P3 - Trung bình',
    status: 'Todo',
    department: 'Bộ phận Hành chính',
    estimatedHours: 4,
    dateTime: getVnDateTimeString(),
    scheduledDate: getLocalDateString(),
    comments: []
  });

  const [newCommentText, setNewCommentText] = useState('');

  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [staffForm, setStaffForm] = useState({ name: '', role: '', email: '', phone: '' });

  const [newDeptInput, setNewDeptInput] = useState('');
  const [newCatInput, setNewCatInput] = useState('');

  useEffect(() => { if (!isSupabaseConfigured) localStorage.setItem('demo_staff', JSON.stringify(staffList)); }, [staffList]);
  useEffect(() => { if (!isSupabaseConfigured) localStorage.setItem('demo_departments', JSON.stringify(departments)); }, [departments]);
  useEffect(() => { if (!isSupabaseConfigured) localStorage.setItem('demo_category_types', JSON.stringify(categoryTypes)); }, [categoryTypes]);
  useEffect(() => { if (!isSupabaseConfigured) localStorage.setItem('demo_tasks', JSON.stringify(tasks)); }, [tasks]);

  useEffect(() => {
    if (!isSupabaseConfigured || !session?.user?.id) {
      setWorkspaceReady(!isSupabaseConfigured);
      return undefined;
    }
    let active = true;
    setWorkspaceLoading(true);
    setWorkspaceReady(false);
    setCloudError('');
    (async () => {
      const { data, error } = await supabase.from('workspace_state').select('data').eq('id', 'main').maybeSingle();
      if (error) throw error;
      let workspace = data?.data;
      if (!workspace) {
        const { data: created, error: createError } = await supabase.from('workspace_state')
          .insert({ id: 'main', data: EMPTY_WORKSPACE, updated_by: session.user.id }).select('data').single();
        if (createError) throw createError;
        workspace = created.data;
      }
      if (!active) return;
      setStaffList(Array.isArray(workspace.staff) ? workspace.staff : []);
      setDepartments(Array.isArray(workspace.departments) ? workspace.departments : []);
      setCategoryTypes(Array.isArray(workspace.categoryTypes) ? workspace.categoryTypes : []);
      setTasks(Array.isArray(workspace.tasks) ? workspace.tasks : []);
      setWorkspaceReady(true);
    })().catch((error) => {
      if (active) setCloudError(error.message || 'Không thể tải dữ liệu cloud. Hãy kiểm tra SQL/RLS trong Supabase.');
    }).finally(() => { if (active) setWorkspaceLoading(false); });
    return () => { active = false; };
  }, [session?.user?.id]);

  useEffect(() => {
    if (!isSupabaseConfigured || !session?.user?.id || !workspaceReady) return undefined;
    const timer = setTimeout(async () => {
      const { error } = await supabase.from('workspace_state').upsert({
        id: 'main',
        data: { staff: staffList, departments, categoryTypes, tasks },
        updated_by: session.user.id,
        updated_at: new Date().toISOString(),
      });
      if (error) setCloudError('Không lưu được lên cloud. ' + error.message);
      else setCloudError('');
    }, 500);
    return () => clearTimeout(timer);
  }, [session?.user?.id, workspaceReady, staffList, departments, categoryTypes, tasks]);

  const handlePriorityChange = (priority) => {
    let defaultHours = 4;
    if (priority.includes('P1')) defaultHours = 0.5;
    else if (priority.includes('P2')) defaultHours = 2;
    else if (priority.includes('P3')) defaultHours = 4;
    else if (priority.includes('P4')) defaultHours = 8;

    setTaskForm(prev => ({
      ...prev,
      priority: priority,
      estimatedHours: defaultHours
    }));
  };

  const availableDates = useMemo(() => {
    const dates = tasks.map(t => t.dateTime ? t.dateTime.split('T')[0] : '').filter(Boolean);
    return Array.from(new Set(dates)).sort().reverse();
  }, [tasks]);

  const calculateTaskHours = (task) => {
    if (task.status === 'Done') {
      return task.totalTimeSpent || 0;
    }
    if (task.status === 'In Progress' && task.startTimestamp) {
      const diffMs = Date.now() - task.startTimestamp;
      return parseFloat((diffMs / (1000 * 60 * 60)).toFixed(1));
    }
    return task.totalTimeSpent || 0;
  };

  const getSlaCountdown = (task) => {
    if (task.status === 'Done') return { text: 'Đã hoàn thành', isOverdue: false };
    if (task.status !== 'In Progress' || !task.startTimestamp) return { text: 'Chưa bấm xử lý', isOverdue: false };

    const estMs = parseFloat(task.estimatedHours || 1) * 3600000;
    const elapsedMs = Date.now() - task.startTimestamp;
    const remainingMs = estMs - elapsedMs;

    if (remainingMs <= 0) {
      const overdueMs = Math.abs(remainingMs);
      const hours = Math.floor(overdueMs / 3600000);
      const mins = Math.floor((overdueMs % 3600000) / 60000);
      return { text: `Quá hạn ${hours}h ${mins}p`, isOverdue: true };
    } else {
      const hours = Math.floor(remainingMs / 3600000);
      const mins = Math.floor((remainingMs % 3600000) / 60000);
      const secs = Math.floor((remainingMs % 60000) / 1000);
      return { text: `Còn ${hours > 0 ? hours + 'h ' : ''}${mins}p ${secs}s`, isOverdue: false };
    }
  };

  const stats = useMemo(() => {
    const total = tasks.length;
    const inProgress = tasks.filter(t => t.status === 'In Progress').length;
    const completed = tasks.filter(t => t.status === 'Done').length;
    const totalEst = tasks.reduce((acc, t) => acc + (parseFloat(t.estimatedHours) || 0), 0);
    const totalAct = tasks.reduce((acc, t) => acc + calculateTaskHours(t), 0);
    return { total, inProgress, completed, totalEst, totalAct: parseFloat(totalAct.toFixed(1)) };
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      const matchSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (task.description && task.description.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchPriority = filterPriority === 'ALL' || task.priority === filterPriority;
      const matchAssignee = filterAssignee === 'ALL' || task.assignee === filterAssignee;
      const matchDept = filterDept === 'ALL' || task.department === filterDept;
      const taskDateOnly = task.dateTime ? task.dateTime.split('T')[0] : '';
      const matchDate = filterDate === 'ALL' || taskDateOnly === filterDate;
      return matchSearch && matchPriority && matchAssignee && matchDept && matchDate;
    });
  }, [tasks, searchTerm, filterPriority, filterAssignee, filterDept, filterDate]);

  const calendarTasks = useMemo(() => tasks.filter(task => {
    const matchSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (task.description && task.description.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchSearch && (filterPriority === 'ALL' || task.priority === filterPriority) &&
      (filterAssignee === 'ALL' || task.assignee === filterAssignee) &&
      (filterDept === 'ALL' || task.department === filterDept);
  }), [tasks, searchTerm, filterPriority, filterAssignee, filterDept]);

  const calendarDaysInMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate();
  const calendarStartOffset = (new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1).getDay() + 6) % 7;
  const calendarCellCount = Math.ceil((calendarStartOffset + calendarDaysInMonth) / 7) * 7;
  const calendarCells = Array.from({ length: calendarCellCount }, (_, index) => {
    const day = index - calendarStartOffset + 1;
    return day > 0 && day <= calendarDaysInMonth
      ? getLocalDateString(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day))
      : null;
  });
  const selectedDayTasks = calendarTasks
    .filter(task => (task.scheduledDate || task.dateTime?.split('T')[0]) === calendarSelectedDate)
    .sort((a, b) => (a.dateTime || '').localeCompare(b.dateTime || ''));

  const openNewTask = (scheduledDate = getLocalDateString()) => {
    setEditingTask(null);
    setTaskForm({
      title: '', description: '', assignee: staffList[0]?.name || '', priority: 'P3 - Trung bình',
      status: 'Todo', department: departments[0] || '', estimatedHours: 4,
      dateTime: getVnDateTimeString(), scheduledDate, comments: []
    });
    setIsTaskModalOpen(true);
  };

  const handleQuickStatusChange = (taskId, newStatus) => {
    setTasks(tasks.map(t => {
      if (t.id !== taskId) return t;
      let updated = { ...t, status: newStatus };
      
      if (newStatus === 'In Progress' && t.status !== 'In Progress') {
        updated.startTimestamp = Date.now();
      }
      if (newStatus === 'Done' && t.status === 'In Progress' && t.startTimestamp) {
        const addedHours = (Date.now() - t.startTimestamp) / (1000 * 60 * 60);
        updated.totalTimeSpent = parseFloat(((t.totalTimeSpent || 0) + addedHours).toFixed(1));
        updated.startTimestamp = null;
      }
      if (newStatus === 'Todo' && t.status === 'In Progress' && t.startTimestamp) {
        const addedHours = (Date.now() - t.startTimestamp) / (1000 * 60 * 60);
        updated.totalTimeSpent = parseFloat(((t.totalTimeSpent || 0) + addedHours).toFixed(1));
        updated.startTimestamp = null;
      }
      return updated;
    }));
  };

  const handleAddComment = () => {
    if (!newCommentText.trim()) return;
    const newComment = {
      id: Date.now(),
      author: taskForm.assignee || 'Điều phối viên',
      text: newCommentText.trim(),
      time: 'Vừa xong'
    };
    setTaskForm(prev => ({
      ...prev,
      comments: [...(prev.comments || []), newComment]
    }));
    setNewCommentText('');
  };

  const handleSaveTask = (e) => {
    e.preventDefault();
    if (!taskForm.title.trim()) return;

    const parsedHours = parseFloat(taskForm.estimatedHours) || 0;
    const finalTaskForm = {
      ...taskForm,
      scheduledDate: taskForm.scheduledDate || taskForm.dateTime?.split('T')[0] || getLocalDateString(),
      estimatedHours: parsedHours
    };

    if (editingTask) {
      setTasks(tasks.map(t => t.id === editingTask.id ? { ...finalTaskForm, id: t.id, startTimestamp: t.startTimestamp, totalTimeSpent: t.totalTimeSpent } : t));
    } else {
      let newTask = {
        ...finalTaskForm,
        id: Date.now(),
        startTimestamp: finalTaskForm.status === 'In Progress' ? Date.now() : null,
        totalTimeSpent: 0
      };
      setTasks([...tasks, newTask]);
    }
    setIsTaskModalOpen(false);
    setEditingTask(null);
  };

  const handleDeleteTask = (id) => {
    if (window.confirm('Bạn có chắc muốn xóa yêu cầu này?')) {
      setTasks(tasks.filter(t => t.id !== id));
    }
  };

  const handleSaveStaff = (e) => {
    e.preventDefault();
    if (!staffForm.name.trim()) return;
    if (editingStaff) {
      setStaffList(staffList.map(s => s.id === editingStaff.id ? { ...staffForm, id: s.id } : s));
    } else {
      setStaffList([...staffList, { ...staffForm, id: Date.now() }]);
    }
    setIsStaffModalOpen(false);
    setEditingStaff(null);
  };

  const handleDeleteStaff = (id) => {
    if (window.confirm('Xóa nhân sự này khỏi hệ thống?')) {
      setStaffList(staffList.filter(s => s.id !== id));
    }
  };

  const handleVerifyPass = (e) => {
    e.preventDefault();
    if (categoryPassInput === '761311') {
      setIsCategoryUnlocked(true);
      setPassError(false);
      setCategoryPassInput('');
    } else {
      setPassError(true);
    }
  };

  if (isSupabaseConfigured && authLoading) return <div className="min-h-screen grid place-items-center bg-slate-950 text-slate-200">Đang kết nối Supabase…</div>;
  if (isSupabaseConfigured && !session) return (
    <main className="min-h-screen grid place-items-center bg-slate-950 px-4 text-slate-100">
      <form onSubmit={handleCloudLogin} className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-7 shadow-2xl space-y-4">
        <div className="text-blue-400 text-sm font-semibold">ĐỒNG BỘ ĐA THIẾT BỊ</div>
        <h1 className="text-2xl font-bold">Đăng nhập MAMOS</h1>
        <p className="text-sm text-slate-400">Dùng tài khoản đã tạo trong Supabase Auth để mở workspace chung.</p>
        <input className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" type="email" autoComplete="username" placeholder="Email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} required />
        <input className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" type="password" autoComplete="current-password" placeholder="Mật khẩu" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} required />
        {loginError && <p className="text-sm text-red-400">{loginError}</p>}
        <button className="w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold hover:bg-blue-500">Đăng nhập</button>
        <p className="text-xs text-slate-500">Tài khoản được quản lý trong Supabase; website không cho đăng ký tự do.</p>
      </form>
    </main>
  );
  if (isSupabaseConfigured && (workspaceLoading || !workspaceReady) && !cloudError) return <div className="min-h-screen grid place-items-center bg-slate-950 text-slate-200">Đang tải workspace…</div>;
  if (isSupabaseConfigured && cloudError && !workspaceReady) return <main className="min-h-screen grid place-items-center bg-slate-950 px-4 text-slate-100"><div className="max-w-xl rounded-2xl border border-red-900 bg-slate-900 p-6"><h1 className="text-xl font-bold">Chưa thể kết nối dữ liệu</h1><p className="mt-3 text-sm text-slate-300">{cloudError}</p><button className="mt-5 rounded-lg bg-slate-700 px-4 py-2" onClick={() => supabase.auth.signOut()}>Đăng xuất</button></div></main>;

  return (
    <div className={`min-h-screen w-full font-sans antialiased transition-colors duration-200 ${darkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      {cloudError && <div role="status" className="bg-amber-950 px-4 py-2 text-center text-xs text-amber-200">{cloudError}</div>}
      <header className={`sticky top-0 z-40 w-full border-b backdrop-blur-xl ${darkMode ? 'bg-slate-900/85 border-slate-800/80 shadow-lg shadow-black/20' : 'bg-white/85 border-slate-200/80 shadow-sm'}`}>
        <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-3 px-3 py-2 sm:px-6 lg:h-16 lg:flex-row lg:items-center lg:justify-between lg:gap-4 lg:py-0">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-blue-500 text-white shadow-lg shadow-blue-500/25 sm:h-10 sm:w-10">
              <Activity className="w-5 h-5"/>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate whitespace-nowrap bg-gradient-to-r from-blue-400 to-indigo-300 bg-clip-text text-sm font-bold tracking-tight text-transparent sm:text-lg">Quản lý công việc</h1>
                <span className="hidden sm:inline-block px-2.5 py-0.5 text-[10px] font-semibold bg-blue-500/10 text-blue-400 rounded-full border border-blue-500/20">Đồng bộ Supabase</span>
              </div>
            </div>
          </div>
            <div className="flex shrink-0 items-center gap-2 lg:hidden">
              <button onClick={() => supabase.auth.signOut()} className={`rounded-xl border px-2.5 py-2 text-xs ${darkMode ? 'border-slate-800 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-700 hover:bg-slate-100'}`} title={session?.user?.email || 'Đăng xuất'}>Thoát</button>
              <button onClick={() => setDarkMode(!darkMode)} className={`rounded-xl border p-2 transition ${darkMode ? 'bg-slate-900 border-slate-800 text-amber-400 hover:bg-slate-800' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'}`} title="Chuyển đổi giao diện Sáng / Tối">{darkMode ? <Sun className="h-4 w-4"/> : <Moon className="h-4 w-4"/>}</button>
            </div>
          </div>

          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:items-center sm:gap-3">
            <button 
              onClick={() => { setActiveTab('category'); setActiveCategorySubTab('staff'); }}
              className={`flex min-w-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl border px-2.5 py-2 text-xs font-medium transition-all sm:px-3.5 sm:text-sm ${
                activeTab === 'category' ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/30' : darkMode ? 'border-slate-800 hover:bg-slate-800 text-slate-300' : 'border-slate-200 hover:bg-slate-100 text-slate-700'
              }`}
            >
              <FolderTree className="w-4 h-4 text-blue-400"/>
              <span className="hidden md:inline">Quản lý</span> Danh mục
            </button>

            <button 
              onClick={() => openNewTask(activeTab === 'calendar' ? calendarSelectedDate : getLocalDateString())}
              className="flex min-w-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-2.5 py-2 text-xs font-medium text-white shadow-lg shadow-blue-600/30 transition-all hover:from-blue-500 hover:to-indigo-500 active:scale-95 sm:px-4 sm:text-sm"
            >
              <Plus className="w-4 h-4"/>
              <span>Tạo việc mới</span>
            </button>

            <div className={`hidden h-6 w-px sm:block ${darkMode ? 'bg-slate-800' : 'bg-slate-200'} mx-1`}></div>

            <button onClick={() => supabase.auth.signOut()} className={`hidden rounded-xl border px-3 py-2 text-xs sm:block ${darkMode ? 'border-slate-800 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-700 hover:bg-slate-100'}`} title={session?.user?.email || 'Đăng xuất'}>Đăng xuất</button>

            <button 
              onClick={() => setDarkMode(!darkMode)}
              className={`hidden rounded-xl border p-2 transition sm:block ${darkMode ? 'bg-slate-900 border-slate-800 text-amber-400 hover:bg-slate-800' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'}`}
              title="Chuyển đổi giao diện Sáng / Tối"
            >
              {darkMode ? <Sun className="w-4 h-4"/> : <Moon className="w-4 h-4"/>}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1600px] min-w-0 space-y-4 px-3 py-4 sm:space-y-6 sm:px-6 sm:py-6 lg:px-8">
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4 sm:gap-4">
          <div className={`min-w-0 rounded-2xl border p-3 transition-all sm:p-4 ${darkMode ? 'bg-slate-900/40 border-slate-800/80 shadow-xl' : 'bg-white border-slate-200 shadow-sm'}`}>
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[11px] font-medium leading-tight text-slate-400 sm:text-xs">Tổng việc / Sự cố</p>
                <h3 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">{stats.total}</h3>
              </div>
              <div className="rounded-xl border border-blue-500/15 bg-blue-500/10 p-2 text-blue-400 sm:p-2.5"><CheckSquare className="h-4 w-4 sm:h-5 sm:w-5"/></div>
            </div>
          </div>

          <div className={`min-w-0 rounded-2xl border p-3 transition-all sm:p-4 ${darkMode ? 'bg-slate-900/40 border-slate-800/80 shadow-xl' : 'bg-white border-slate-200 shadow-sm'}`}>
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[11px] font-medium leading-tight text-slate-400 sm:text-xs">Đang thực hiện</p>
                <h3 className="mt-1 text-xl font-bold tracking-tight text-amber-400 sm:text-2xl">{stats.inProgress}</h3>
              </div>
              <div className="rounded-xl border border-amber-500/15 bg-amber-500/10 p-2 text-amber-400 sm:p-2.5"><Clock className="h-4 w-4 sm:h-5 sm:w-5"/></div>
            </div>
          </div>

          <div className={`min-w-0 rounded-2xl border p-3 transition-all sm:p-4 ${darkMode ? 'bg-slate-900/40 border-slate-800/80 shadow-xl' : 'bg-white border-slate-200 shadow-sm'}`}>
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[11px] font-medium leading-tight text-slate-400 sm:text-xs">Giờ thực tế / Dự kiến</p>
                <h3 className="mt-1 text-lg font-bold tracking-tight text-emerald-400 sm:text-2xl">{stats.totalAct}h <span className="text-[10px] font-normal text-slate-500 sm:text-xs">({stats.totalEst}h)</span></h3>
              </div>
              <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/10 p-2 text-emerald-400 sm:p-2.5"><BarChart3 className="h-4 w-4 sm:h-5 sm:w-5"/></div>
            </div>
          </div>

          <div className={`min-w-0 rounded-2xl border p-3 transition-all sm:p-4 ${darkMode ? 'bg-slate-900/40 border-slate-800/80 shadow-xl' : 'bg-white border-slate-200 shadow-sm'}`}>
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[11px] font-medium leading-tight text-slate-400 sm:text-xs">Nhân sự vận hành</p>
                <h3 className="mt-1 text-xl font-bold tracking-tight text-purple-400 sm:text-2xl">{staffList.length}</h3>
              </div>
              <div className="rounded-xl border border-purple-500/15 bg-purple-500/10 p-2 text-purple-400 sm:p-2.5"><Users className="h-4 w-4 sm:h-5 sm:w-5"/></div>
            </div>
          </div>
        </div>

        <div className={`flex min-w-0 flex-col gap-3 rounded-2xl border p-3 sm:gap-4 sm:p-4 ${darkMode ? 'bg-slate-900/40 border-slate-800/80 shadow-xl' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className="flex min-w-0 flex-col items-stretch justify-between gap-3 lg:flex-row lg:items-center">
            <div className={`grid w-full min-w-0 grid-cols-4 gap-1 rounded-xl p-1 sm:flex sm:w-auto ${darkMode ? 'bg-slate-950/80 border border-slate-800/80' : 'bg-slate-100'}`}>
              <button
                onClick={() => setActiveTab('calendar')}
                className={`flex min-w-0 items-center justify-center gap-1 whitespace-nowrap rounded-lg px-1.5 py-2 text-[10px] font-medium transition-all sm:flex-none sm:gap-2 sm:px-4 sm:text-sm ${
                  activeTab === 'calendar' ? 'bg-blue-600 text-white shadow-md' : darkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600'
                }`}
              >
                <Calendar className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4"/> <span>Lịch</span>
              </button>
              <button
                onClick={() => setActiveTab('kanban')}
                className={`flex min-w-0 items-center justify-center gap-1 whitespace-nowrap rounded-lg px-1.5 py-2 text-[10px] font-medium transition-all sm:flex-none sm:gap-2 sm:px-4 sm:text-sm ${
                  activeTab === 'kanban' ? 'bg-blue-600 text-white shadow-md' : darkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600'
                }`}
              >
                <LayoutDashboard className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4"/> <span>Kanban</span>
              </button>
              <button
                onClick={() => setActiveTab('list')}
                className={`flex min-w-0 items-center justify-center gap-1 whitespace-nowrap rounded-lg px-1.5 py-2 text-[10px] font-medium transition-all sm:flex-none sm:gap-2 sm:px-4 sm:text-sm ${
                  activeTab === 'list' ? 'bg-blue-600 text-white shadow-md' : darkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600'
                }`}
              >
                <CheckSquare className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4"/> <span>Danh sách</span>
              </button>
              <button
                onClick={() => setActiveTab('analytics')}
                className={`flex min-w-0 items-center justify-center gap-1 whitespace-nowrap rounded-lg px-1.5 py-2 text-[10px] font-medium transition-all sm:flex-none sm:gap-2 sm:px-4 sm:text-sm ${
                  activeTab === 'analytics' ? 'bg-blue-600 text-white shadow-md' : darkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600'
                }`}
              >
                <BarChart3 className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4"/> <span className="sm:hidden">Thống kê</span><span className="hidden sm:inline">Thống kê &amp; Lịch sử</span>
              </button>
            </div>

            {activeTab !== 'category' && (
              <div className="relative w-full min-w-0 lg:max-w-xs">
                <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400"/>
                <input 
                  type="text" 
                  placeholder="Tìm kiếm công việc, sự cố..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={`w-full pl-10 pr-4 py-2 text-xs sm:text-sm rounded-xl border ${darkMode ? 'bg-slate-950/60 border-slate-800 text-slate-100 placeholder-slate-500' : 'bg-slate-50 border-slate-200 text-slate-800'} focus:outline-none focus:border-blue-500`}
                />
              </div>
            )}
          </div>

          {activeTab !== 'category' && (
            <div className="grid grid-cols-2 items-center gap-2 border-t border-slate-800/40 pt-3 sm:flex sm:flex-wrap sm:gap-2.5">
              <span className="col-span-2 mr-1 flex items-center gap-1.5 text-xs font-medium text-slate-400 sm:col-span-1">
                <SlidersHorizontal className="w-3.5 h-3.5 text-blue-400"/> Lọc nhanh:
              </span>

              {activeTab !== 'calendar' && (
                <select
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  className={`w-full min-w-0 truncate rounded-xl border px-2.5 py-2 text-[11px] focus:outline-none sm:w-auto sm:px-3 sm:text-xs ${darkMode ? 'bg-slate-950/80 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-700'}`}
                >
                  <option value="ALL">📅 Tất cả các ngày</option>
                  {availableDates.map((dateStr) => (
                    <option key={dateStr} value={dateStr}>Ngày: {dateStr}</option>
                  ))}
                </select>
              )}

              <select
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value)}
                className={`w-full min-w-0 truncate rounded-xl border px-2.5 py-2 text-[11px] focus:outline-none sm:w-auto sm:px-3 sm:text-xs ${darkMode ? 'bg-slate-950/80 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-700'}`}
              >
                <option value="ALL">Tất cả mức ưu tiên</option>
                <option value="P1 - Khẩn cấp">P1 - Khẩn cấp</option>
                <option value="P2 - Cao">P2 - Cao</option>
                <option value="P3 - Trung bình">P3 - Trung bình</option>
                <option value="P4 - Thấp">P4 - Thấp</option>
              </select>

              <select
                value={filterDept}
                onChange={(e) => setFilterDept(e.target.value)}
                className={`w-full min-w-0 truncate rounded-xl border px-2.5 py-2 text-[11px] focus:outline-none sm:w-auto sm:px-3 sm:text-xs ${darkMode ? 'bg-slate-950/80 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-700'}`}
              >
                <option value="ALL">Tất cả Khoa/Phòng</option>
                {departments.map((dept, i) => (
                  <option key={i} value={dept}>{dept}</option>
                ))}
              </select>

              <select
                value={filterAssignee}
                onChange={(e) => setFilterAssignee(e.target.value)}
                className={`w-full min-w-0 truncate rounded-xl border px-2.5 py-2 text-[11px] focus:outline-none sm:w-auto sm:px-3 sm:text-xs ${darkMode ? 'bg-slate-950/80 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-700'}`}
              >
                <option value="ALL">Tất cả nhân sự phụ trách</option>
                {staffList.map((s) => (
                  <option key={s.id} value={s.name}>{s.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {activeTab === 'calendar' && (
          <section className={`overflow-hidden rounded-2xl border ${darkMode ? 'border-slate-800 bg-slate-900/40 shadow-xl' : 'border-slate-200 bg-white shadow-sm'}`}>
            <div className={`flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5 ${darkMode ? 'border-slate-800' : 'border-slate-200'}`}>
              <div>
                <h2 className="text-lg font-bold capitalize">{calendarMonth.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' })}</h2>
                <p className="mt-1 text-xs text-slate-400">{calendarTasks.length} công việc phù hợp với bộ lọc</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => { const month = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1); setCalendarMonth(month); setCalendarSelectedDate(getLocalDateString(month)); }} className={`flex h-10 w-10 items-center justify-center rounded-xl border ${darkMode ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-100'}`} aria-label="Tháng trước"><ChevronLeft className="h-4 w-4"/></button>
                <button onClick={() => { const today = new Date(); setCalendarMonth(new Date(today.getFullYear(), today.getMonth(), 1)); setCalendarSelectedDate(getLocalDateString(today)); }} className={`h-10 rounded-xl border px-3 text-xs font-medium ${darkMode ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-700 hover:bg-slate-100'}`}>Hôm nay</button>
                <button onClick={() => { const month = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1); setCalendarMonth(month); setCalendarSelectedDate(getLocalDateString(month)); }} className={`flex h-10 w-10 items-center justify-center rounded-xl border ${darkMode ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-100'}`} aria-label="Tháng sau"><ChevronRight className="h-4 w-4"/></button>
                <button onClick={() => openNewTask(calendarSelectedDate)} className="flex h-10 items-center justify-center gap-2 rounded-xl bg-blue-600 px-3.5 text-xs font-semibold text-white shadow-lg shadow-blue-600/20 hover:bg-blue-500"><Plus className="h-4 w-4"/> Thêm việc ngày này</button>
              </div>
            </div>

            <div className="p-2 sm:p-4">
              <div className="grid grid-cols-7 gap-1 sm:gap-2">
                {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((day, index) => <div key={day} className={`py-2 text-center text-[10px] font-semibold uppercase tracking-wide sm:text-xs ${index > 4 ? 'text-blue-400' : 'text-slate-400'}`}>{day}</div>)}
                {calendarCells.map((date, index) => {
                  if (!date) return <div key={`empty-${index}`} className="min-h-[72px] rounded-xl sm:min-h-[108px]"/>;
                  const dayTasks = calendarTasks.filter(task => (task.scheduledDate || task.dateTime?.split('T')[0]) === date);
                  const isSelected = date === calendarSelectedDate;
                  const isToday = date === getLocalDateString();
                  return (
                    <button key={date} onClick={() => setCalendarSelectedDate(date)} className={`flex min-h-[72px] min-w-0 flex-col items-stretch rounded-xl border p-1.5 text-left transition sm:min-h-[108px] sm:p-2 ${isSelected ? 'border-blue-500 bg-blue-600/10 ring-1 ring-blue-500/40' : darkMode ? 'border-slate-800/80 bg-slate-950/40 hover:border-slate-700' : 'border-slate-100 bg-slate-50 hover:border-slate-300'}`}>
                      <span className={`mx-auto flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold sm:mx-0 sm:h-7 sm:w-7 sm:text-xs ${isToday ? 'bg-blue-600 text-white' : isSelected ? 'text-blue-400' : 'text-slate-300'}`}>{Number(date.slice(-2))}</span>
                      <div className="mt-1 hidden w-full space-y-1 sm:block">
                        {dayTasks.slice(0, 2).map(task => <div key={task.id} className={`truncate rounded-md px-1.5 py-1 text-[10px] ${task.status === 'Done' ? 'bg-emerald-500/10 text-emerald-300' : task.status === 'In Progress' ? 'bg-amber-500/10 text-amber-300' : 'bg-blue-500/10 text-blue-300'}`}>{task.title}</div>)}
                        {dayTasks.length > 2 && <div className="px-1 text-[10px] text-slate-500">+{dayTasks.length - 2} việc</div>}
                      </div>
                      {dayTasks.length > 0 && <span className="mt-auto flex items-center justify-center gap-1 pt-1 sm:hidden"><span className="h-1.5 w-1.5 rounded-full bg-blue-400"/><span className="text-[9px] text-slate-400">{dayTasks.length}</span></span>}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className={`border-t p-4 sm:p-5 ${darkMode ? 'border-slate-800' : 'border-slate-200'}`}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold capitalize">{new Date(`${calendarSelectedDate}T00:00:00`).toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' })}</h3>
                  <p className="mt-0.5 text-xs text-slate-400">{selectedDayTasks.length} công việc trong ngày</p>
                </div>
              </div>
              <div className="space-y-2">
                {selectedDayTasks.map(task => (
                  <button key={task.id} onClick={() => { setEditingTask(task); setTaskForm({ ...task, scheduledDate: task.scheduledDate || task.dateTime?.split('T')[0] || calendarSelectedDate }); setIsTaskModalOpen(true); }} className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition ${darkMode ? 'border-slate-800 bg-slate-950/60 hover:border-blue-500/50' : 'border-slate-200 bg-slate-50 hover:border-blue-400'}`}>
                    <span className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${task.status === 'Done' ? 'bg-emerald-400' : task.status === 'In Progress' ? 'bg-amber-400' : 'bg-blue-400'}`}/>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{task.title}</span>
                      <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-400"><span>{task.dateTime?.split('T')[1] ? `Tiếp nhận ${task.dateTime.split('T')[1]}` : 'Chưa có giờ tiếp nhận'}</span><span>{task.assignee || 'Chưa giao'}</span><span>{task.department || 'Chưa có bộ phận'}</span></span>
                    </span>
                    <span className={`shrink-0 rounded-lg px-2 py-1 text-[10px] font-medium ${task.status === 'Done' ? 'bg-emerald-500/10 text-emerald-300' : task.status === 'In Progress' ? 'bg-amber-500/10 text-amber-300' : 'bg-blue-500/10 text-blue-300'}`}>{task.status === 'Done' ? 'Hoàn thành' : task.status === 'In Progress' ? 'Đang làm' : 'Cần làm'}</span>
                  </button>
                ))}
                {selectedDayTasks.length === 0 && <div className={`rounded-xl border border-dashed p-7 text-center ${darkMode ? 'border-slate-800' : 'border-slate-200'}`}><Calendar className="mx-auto h-7 w-7 text-slate-500"/><p className="mt-2 text-sm font-medium">Chưa có công việc trong ngày</p><p className="mt-1 text-xs text-slate-400">Thêm việc để lên lịch cho ngày này.</p></div>}
              </div>
            </div>
          </section>
        )}

        {activeTab === 'kanban' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              { id: 'Todo', title: 'Cần làm (To Do)', border: 'border-slate-800/80', headerBg: 'bg-slate-800/40 text-slate-300' },
              { id: 'In Progress', title: 'Đang xử lý (In Progress)', border: 'border-amber-500/30', headerBg: 'bg-amber-500/10 text-amber-400' },
              { id: 'Done', title: 'Hoàn thành (Done)', border: 'border-emerald-500/30', headerBg: 'bg-emerald-500/10 text-emerald-400' }
            ].map(col => {
              const colTasks = filteredTasks.filter(t => t.status === col.id);
              return (
                <div key={col.id} className={`p-4 rounded-2xl border ${col.border} ${darkMode ? 'bg-slate-900/30 shadow-xl' : 'bg-white shadow-sm'} flex flex-col gap-3.5`}>
                  <div className={`flex justify-between items-center px-3.5 py-2.5 rounded-xl ${col.headerBg} border border-white/5`}>
                    <h3 className="font-bold text-xs tracking-wider uppercase">{col.title}</h3>
                    <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-slate-900/80 text-slate-200 border border-slate-700/50">
                      {colTasks.length}
                    </span>
                  </div>

                  <div className="flex flex-col gap-3">
                    {colTasks.map(task => {
                      const currentSpent = calculateTaskHours(task);
                      const estHours = parseFloat(task.estimatedHours || 1);
                      const percent = Math.min(Math.round((currentSpent / estHours) * 100), 100);
                      const isOvertime = currentSpent > estHours;
                      const sla = getSlaCountdown(task);

                      return (
                        <div 
                          key={task.id}
                          className={`p-4 rounded-2xl border transition-all hover:-translate-y-1 hover:shadow-xl ${
                            isOvertime && task.status !== 'Done' 
                              ? 'border-red-500/60 bg-red-950/20' 
                              : darkMode ? 'bg-slate-900/90 border-slate-800/80' : 'bg-white border-slate-200'
                          } flex flex-col gap-3`}
                        >
                          <div className="flex justify-between items-start gap-2">
                            <span className={`text-[10px] px-2.5 py-0.5 rounded-lg font-bold uppercase tracking-wide ${
                              task.priority.includes('P1') ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                              task.priority.includes('P2') ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' :
                              task.priority.includes('P3') ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                              'bg-slate-800 text-slate-300 border border-slate-700'
                            }`}>
                              {task.priority}
                            </span>
                            <div className="flex items-center gap-1">
                              <button onClick={() => { setEditingTask(task); setTaskForm(task); setIsTaskModalOpen(true); }} className="p-1.5 text-slate-400 hover:text-blue-400 rounded-lg transition" title="Chỉnh sửa & Xem ghi chú"><Edit3 className="w-3.5 h-3.5"/></button>
                              <button onClick={() => handleDeleteTask(task.id)} className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg transition"><Trash2 className="w-3.5 h-3.5"/></button>
                            </div>
                          </div>

                          <div>
                            <h4 className="font-semibold text-sm leading-snug">{task.title}</h4>
                            {task.description && <p className="text-xs text-slate-400 line-clamp-2 mt-1">{task.description}</p>}
                            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-400">
                              <Calendar className="h-3.5 w-3.5 text-blue-400"/>
                              <span>{getTaskDateLabel(task)}</span>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-1.5 items-center justify-between">
                            {task.department && (
                              <span className="text-[10px] px-2.5 py-1 bg-purple-500/10 text-purple-300 border border-purple-500/20 rounded-lg font-medium">
                                🏥 {task.department}
                              </span>
                            )}
                            {task.comments && task.comments.length > 0 && (
                              <span className="text-[10px] px-2 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-md font-medium flex items-center gap-1">
                                <MessageSquare className="w-3 h-3"/> {task.comments.length}
                              </span>
                            )}
                          </div>

                          {task.status === 'In Progress' && (
                            <div className="space-y-1.5 pt-1">
                              <div className="flex justify-between text-[11px] font-mono items-center">
                                <span className={sla.isOverdue ? 'text-red-400 font-bold flex items-center gap-1 animate-pulse' : 'text-amber-400 font-medium flex items-center gap-1'}>
                                  <Hourglass className="w-3 h-3 animate-spin"/> {sla.text}
                                </span>
                                <span className="text-slate-400">{currentSpent}h / {estHours}h</span>
                              </div>
                              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden border border-slate-700/50">
                                <div 
                                  className={`h-full transition-all duration-500 ${
                                    isOvertime ? 'bg-red-500 animate-pulse' : percent > 75 ? 'bg-amber-500' : 'bg-blue-500'
                                  }`} 
                                  style={{ width: `${percent}%` }}
                                ></div>
                              </div>
                            </div>
                          )}

                          <div className="flex justify-between items-center pt-2.5 border-t border-slate-800/80 text-xs text-slate-400">
                            <div className="flex items-center gap-1.5 font-medium text-slate-300">
                              <Users className="w-3.5 h-3.5 text-blue-400"/>
                              <span className="truncate max-w-[110px]">{task.assignee || 'Chưa gán'}</span>
                            </div>
                            <div className="flex items-center gap-1 font-mono text-[11px]">
                              <Clock className="w-3.5 h-3.5 text-slate-500"/>
                              <span className={isOvertime ? 'text-red-400 font-bold' : 'text-slate-300'}>
                                {currentSpent}h
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-1 pt-2 border-t border-slate-800/40">
                            <span className="text-[10px] text-slate-500 font-medium">Chuyển nhanh:</span>
                            <div className="flex items-center gap-1">
                              {task.status !== 'Todo' && (
                                <button onClick={() => handleQuickStatusChange(task.id, 'Todo')} className="px-2 py-1 text-[10px] font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300">To Do</button>
                              )}
                              {task.status !== 'In Progress' && (
                                <button onClick={() => handleQuickStatusChange(task.id, 'In Progress')} className="px-2 py-1 text-[10px] font-medium rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/20 flex items-center gap-1"><PlayCircle className="w-3 h-3"/> Xử lý</button>
                              )}
                              {task.status !== 'Done' && (
                                <button onClick={() => handleQuickStatusChange(task.id, 'Done')} className="px-2 py-1 text-[10px] font-medium rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/20 flex items-center gap-1"><CheckCircle className="w-3 h-3"/> Xong</button>
                              )}
                            </div>
                          </div>

                        </div>
                      );
                    })}
                    {colTasks.length === 0 && (
                      <div className="text-center py-12 text-xs text-slate-500 border border-dashed border-slate-800 rounded-2xl">Không có yêu cầu</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 'list' && (
          <div className={`rounded-2xl border ${darkMode ? 'bg-slate-900/40 border-slate-800/80 shadow-xl' : 'bg-white border-slate-200 shadow-sm'} overflow-hidden`}>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm whitespace-nowrap">
                <thead>
                  <tr className={`border-b ${darkMode ? 'bg-slate-950/80 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600'} uppercase font-bold text-[11px] tracking-wider`}>
                    <th className="py-4 px-5">Thời gian phát sinh</th>
                    <th className="py-4 px-5">Tiêu đề sự cố / Công việc</th>
                    <th className="py-4 px-5">Bộ phận</th>
                    <th className="py-4 px-5">Ưu tiên</th>
                    <th className="py-4 px-5">Trạng thái & Chuyển nhanh</th>
                    <th className="py-4 px-5">Phụ trách</th>
                    <th className="py-4 px-5">Thời gian (Thực tế/Dự kiến)</th>
                    <th className="py-4 px-5 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${darkMode ? 'divide-slate-800/60' : 'divide-slate-200'}`}>
                  {filteredTasks.map(task => {
                    const currentSpent = calculateTaskHours(task);
                    const isOvertime = currentSpent > parseFloat(task.estimatedHours || 1);

                    return (
                      <tr key={task.id} className={`transition ${isOvertime && task.status !== 'Done' ? 'bg-red-950/10' : darkMode ? 'hover:bg-slate-800/30' : 'hover:bg-slate-50'}`}>
                        <td className="py-4 px-5 font-mono text-xs text-slate-300 align-middle">
                          {task.dateTime ? task.dateTime.replace('T', ' ') : 'Chưa rõ'}
                        </td>
                        <td className="py-4 px-5 align-middle max-w-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold truncate">{task.title}</span>
                            {task.comments && task.comments.length > 0 && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-blue-500/10 text-blue-400 rounded flex items-center gap-0.5 shrink-0">
                                <MessageSquare className="w-3 h-3"/> {task.comments.length}
                              </span>
                            )}
                          </div>
                          {task.description && <p className="text-xs text-slate-400 font-normal truncate mt-0.5">{task.description}</p>}
                        </td>
                        <td className="py-4 px-5 align-middle">
                          <span className="inline-block px-2.5 py-1 text-xs bg-purple-500/10 text-purple-300 border border-purple-500/20 rounded-lg font-medium">
                            {task.department}
                          </span>
                        </td>
                        <td className="py-4 px-5 align-middle">
                          <span className={`inline-block text-[10px] px-2.5 py-1 rounded-lg font-bold uppercase tracking-wide ${
                            task.priority.includes('P1') ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                            task.priority.includes('P2') ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' :
                            task.priority.includes('P3') ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                            'bg-slate-800 text-slate-300'
                          }`}>
                            {task.priority}
                          </span>
                        </td>
                        <td className="py-4 px-5 align-middle">
                          <div className="flex flex-col gap-1.5 items-start">
                            <span className={`px-2.5 py-1 text-xs rounded-full font-semibold ${
                              task.status === 'Done' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                              task.status === 'In Progress' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                              'bg-slate-800 text-slate-400 border border-slate-700'
                            }`}>
                              {task.status === 'Todo' ? 'Cần làm' : task.status === 'In Progress' ? 'Đang xử lý' : 'Hoàn thành'}
                            </span>
                            <div className="flex items-center gap-1">
                              {task.status !== 'Todo' && <button onClick={() => handleQuickStatusChange(task.id, 'Todo')} className="px-2 py-0.5 text-[10px] bg-slate-800 hover:bg-slate-700 rounded text-slate-300 transition">To Do</button>}
                              {task.status !== 'In Progress' && <button onClick={() => handleQuickStatusChange(task.id, 'In Progress')} className="px-2 py-0.5 text-[10px] bg-amber-500/20 hover:bg-amber-500/30 rounded text-amber-300 transition">Xử lý</button>}
                              {task.status !== 'Done' && <button onClick={() => handleQuickStatusChange(task.id, 'Done')} className="px-2 py-0.5 text-[10px] bg-emerald-500/20 hover:bg-emerald-500/30 rounded text-emerald-300 transition">Xong</button>}
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-5 font-medium text-slate-200 align-middle">{task.assignee || 'Chưa gán'}</td>
                        <td className="py-4 px-5 font-mono align-middle">
                          <span className={isOvertime ? 'text-red-400 font-bold' : 'text-slate-300'}>
                            {currentSpent}h / {task.estimatedHours || 0}h
                          </span>
                        </td>
                        <td className="py-4 px-5 text-right align-middle">
                          <div className="flex items-center justify-end gap-1.5">
                            <button onClick={() => { setEditingTask(task); setTaskForm(task); setIsTaskModalOpen(true); }} className="p-2 text-slate-400 hover:text-blue-400 transition rounded-xl hover:bg-slate-800" title="Chỉnh sửa & Xem ghi chú"><Edit3 className="w-4 h-4"/></button>
                            <button onClick={() => handleDeleteTask(task.id)} className="p-2 text-slate-400 hover:text-red-400 transition rounded-xl hover:bg-slate-800" title="Xóa yêu cầu"><Trash2 className="w-4 h-4"/></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredTasks.length === 0 && (
                    <tr>
                      <td colSpan="8" className="text-center py-12 text-slate-500 italic">Không tìm thấy yêu cầu phù hợp</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'category' && (
          <div>
            {!isCategoryUnlocked ? (
              <div className={`max-w-md mx-auto mt-12 p-6 sm:p-8 rounded-3xl border ${darkMode ? 'bg-slate-900/60 border-slate-800 shadow-2xl backdrop-blur-xl' : 'bg-white border-slate-200 shadow-xl'} text-center`}>
                <div className="w-14 h-14 bg-blue-500/10 text-blue-400 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-blue-500/20">
                  <Lock className="w-7 h-7"/>
                </div>
                <h2 className="text-lg font-bold mb-1">Xác thực Quản trị Danh mục</h2>
                <p className="text-xs text-slate-400 mb-6">Vui lòng nhập mật khẩu hệ thống để truy cập phân vùng quản trị.</p>

                <form onSubmit={handleVerifyPass} className="space-y-4">
                  <div className="relative">
                    <KeyRound className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500"/>
                    <input 
                      type="password"
                      placeholder="Nhập mật khẩu..."
                      value={categoryPassInput}
                      onChange={(e) => setCategoryPassInput(e.target.value)}
                      className={`w-full pl-10 pr-4 py-3 rounded-2xl border text-sm ${darkMode ? 'bg-slate-950/85 border-slate-800 text-white' : 'bg-slate-50 border-slate-300'} focus:outline-none font-mono tracking-widest`}
                      autoFocus
                    />
                  </div>
                  {passError && <p className="text-xs text-red-400 font-medium text-left">Mật khẩu không chính xác!</p>}
                  <button type="submit" className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-medium shadow-lg shadow-blue-600/30 transition-all">Mở khóa phân vùng</button>
                </form>
              </div>
            ) : (
              <div className="space-y-5">
                <div className={`p-4 rounded-2xl border ${darkMode ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-slate-200'} flex flex-col sm:flex-row justify-between items-center gap-3`}>
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"><ShieldCheck className="w-5 h-5"/></div>
                    <div>
                      <h3 className="font-bold text-sm">Hệ thống Quản lý Danh mục</h3>
                      <p className="text-[11px] text-slate-400">Đã mở khóa phiên làm việc quản trị viên.</p>
                    </div>
                  </div>
                  <div className={`flex p-1 rounded-xl ${darkMode ? 'bg-slate-950 border border-slate-800' : 'bg-slate-100'}`}>
                    <button onClick={() => setActiveCategorySubTab('staff')} className={`px-4 py-2 rounded-lg text-xs font-medium transition ${activeCategorySubTab === 'staff' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>1. Nhân sự</button>
                    <button onClick={() => setActiveCategorySubTab('departments')} className={`px-4 py-2 rounded-lg text-xs font-medium transition ${activeCategorySubTab === 'departments' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>2. Phòng Ban</button>
                    <button onClick={() => setActiveCategorySubTab('categories')} className={`px-4 py-2 rounded-lg text-xs font-medium transition ${activeCategorySubTab === 'categories' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>3. Danh mục</button>
                  </div>
                </div>

                {activeCategorySubTab === 'staff' && (
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold text-sm sm:text-base flex items-center gap-2"><Users className="w-4 h-4 text-blue-400"/> Danh sách nhân sự mẫu</h3>
                      <button onClick={() => { setEditingStaff(null); setStaffForm({ name: '', role: '', email: '', phone: '' }); setIsStaffModalOpen(true); }} className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-medium shadow flex items-center gap-1.5"><Plus className="w-4 h-4"/> Thêm nhân sự</button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {staffList.map(staff => {
                        const assignedTasks = tasks.filter(t => t.assignee === staff.name);
                        const completedTasks = assignedTasks.filter(t => t.status === 'Done');
                        return (
                          <div key={staff.id} className={`p-5 rounded-2xl border ${darkMode ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-slate-200'} flex flex-col justify-between gap-4`}>
                            <div>
                              <div className="flex justify-between items-start">
                                <div>
                                  <h4 className="font-bold text-sm sm:text-base">{staff.name}</h4>
                                  <p className="text-xs text-blue-400 font-medium">{staff.role || 'Kỹ thuật viên'}</p>
                                </div>
                                <div className="flex gap-1">
                                  <button onClick={() => { setEditingStaff(staff); setStaffForm(staff); setIsStaffModalOpen(true); }} className="p-1.5 text-slate-400 hover:text-blue-400 rounded-lg hover:bg-slate-800"><Edit3 className="w-4 h-4"/></button>
                                  <button onClick={() => handleDeleteStaff(staff.id)} className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg hover:bg-slate-800"><Trash2 className="w-4 h-4"/></button>
                                </div>
                              </div>
                              <div className="mt-3.5 space-y-1 text-xs text-slate-400">
                                <p>📧 {staff.email || 'Chưa cập nhật'}</p>
                                <p>📞 {staff.phone || 'Chưa cập nhật'}</p>
                              </div>
                            </div>
                            <div className="pt-3 border-t border-slate-800/80 flex justify-between text-xs font-medium">
                              <span className="text-slate-400">Đang xử lý: <strong className="text-amber-400">{assignedTasks.length - completedTasks.length}</strong></span>
                              <span className="text-slate-400">Hoàn thành: <strong className="text-emerald-400">{completedTasks.length}</strong></span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {activeCategorySubTab === 'departments' && (
                  <div className={`p-6 rounded-2xl border ${darkMode ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-slate-200'} space-y-4`}>
                    <h3 className="font-bold text-sm sm:text-base flex items-center gap-2"><Building2 className="w-4 h-4 text-purple-400"/> Quản lý Bộ phận</h3>
                    <form onSubmit={(e) => {
                      e.preventDefault();
                      if (!newDeptInput.trim()) return;
                      if (!departments.includes(newDeptInput.trim())) {
                        setDepartments([...departments, newDeptInput.trim()]);
                        setNewDeptInput('');
                      } else { alert('Bộ phận đã tồn tại!'); }
                    }} className="flex gap-2">
                      <input type="text" placeholder="Nhập tên bộ phận mẫu..." value={newDeptInput} onChange={(e) => setNewDeptInput(e.target.value)} className={`flex-1 px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border ${darkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200'}`} />
                      <button type="submit" className="px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs sm:text-sm font-medium shadow flex items-center gap-1.5"><Plus className="w-4 h-4"/> Thêm mới</button>
                    </form>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {departments.map((dept, index) => (
                        <div key={index} className={`p-3.5 rounded-xl border ${darkMode ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'} flex justify-between items-center text-xs sm:text-sm font-medium`}>
                          <span>🏥 {dept}</span>
                          <button onClick={() => { if (departments.length <= 1) { alert('Cần giữ lại ít nhất một phòng ban!'); return; } if (window.confirm(`Xóa phòng ban "${dept}"?`)) setDepartments(departments.filter(d => d !== dept)); }} className="text-slate-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-slate-800"><Trash2 className="w-4 h-4"/></button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeCategorySubTab === 'categories' && (
                  <div className={`p-6 rounded-2xl border ${darkMode ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-slate-200'} space-y-4`}>
                    <h3 className="font-bold text-sm sm:text-base flex items-center gap-2"><Layers className="w-4 h-4 text-emerald-400"/> Quản lý Danh mục Sự cố / Yêu cầu</h3>
                    <form onSubmit={(e) => {
                      e.preventDefault();
                      if (!newCatInput.trim()) return;
                      if (!categoryTypes.includes(newCatInput.trim())) {
                        setCategoryTypes([...categoryTypes, newCatInput.trim()]);
                        setNewCatInput('');
                      } else { alert('Danh mục đã tồn tại!'); }
                    }} className="flex gap-2">
                      <input type="text" placeholder="Nhập loại danh mục sự cố mới..." value={newCatInput} onChange={(e) => setNewCatInput(e.target.value)} className={`flex-1 px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border ${darkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200'}`} />
                      <button type="submit" className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs sm:text-sm font-medium shadow flex items-center gap-1.5"><Plus className="w-4 h-4"/> Thêm mới</button>
                    </form>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {categoryTypes.map((cat, index) => (
                        <div key={index} className={`p-3.5 rounded-xl border ${darkMode ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'} flex justify-between items-center text-xs sm:text-sm font-medium`}>
                          <span>📌 {cat}</span>
                          <button onClick={() => { if (window.confirm(`Xóa danh mục "${cat}"?`)) setCategoryTypes(categoryTypes.filter(c => c !== cat)); }} className="text-slate-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-slate-800"><Trash2 className="w-4 h-4"/></button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className={`p-6 rounded-2xl border ${darkMode ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-slate-200'}`}>
                <h3 className="font-bold text-sm sm:text-base mb-4 flex items-center gap-2"><Building2 className="w-4 h-4 text-purple-400"/> Tổng hợp yêu cầu theo bộ phận</h3>
                <div className="space-y-4">
                  {departments.map(dept => {
                    const count = tasks.filter(t => t.department === dept).length;
                    const percentage = tasks.length > 0 ? Math.round((count / tasks.length) * 100) : 0;
                    if (count === 0) return null;
                    return (
                      <div key={dept} className="space-y-1.5">
                        <div className="flex justify-between text-xs font-medium">
                          <span className="text-slate-300">{dept}</span>
                          <span className="text-slate-400">{count} việc ({percentage}%)</span>
                        </div>
                        <div className="w-full bg-slate-800/80 h-2.5 rounded-full overflow-hidden">
                          <div className="bg-gradient-to-r from-purple-600 to-indigo-500 h-full rounded-full transition-all duration-500" style={{ width: `${percentage}%` }}></div>
                        </div>
                      </div>
                    );
                  })}
                  {tasks.length === 0 && <p className="text-xs text-slate-500 italic text-center py-8">Chưa có dữ liệu thống kê</p>}
                </div>
              </div>

              <div className={`p-6 rounded-2xl border ${darkMode ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-slate-200'}`}>
                <h3 className="font-bold text-sm sm:text-base mb-4 flex items-center gap-2"><Calendar className="w-4 h-4 text-blue-400"/> Tra cứu Lịch sử theo Ngày</h3>
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                  {availableDates.map(dateStr => {
                    const dayTasks = tasks.filter(t => t.dateTime && t.dateTime.split('T')[0] === dateStr);
                    const doneCount = dayTasks.filter(t => t.status === 'Done').length;
                    return (
                      <div key={dateStr} className={`p-3.5 rounded-xl border ${darkMode ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'} flex justify-between items-center`}>
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 font-mono text-xs font-bold">{dateStr}</div>
                          <div>
                            <p className="text-xs font-semibold">{dayTasks.length} sự cố / yêu cầu</p>
                            <p className="text-[11px] text-slate-400">Đã hoàn thành: <span className="text-emerald-400 font-medium">{doneCount}/{dayTasks.length}</span></p>
                          </div>
                        </div>
                        <button onClick={() => { setFilterDate(dateStr); setActiveTab('list'); }} className="px-3 py-1.5 text-xs bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 rounded-lg font-medium transition">Xem chi tiết</button>
                      </div>
                    );
                  })}
                  {availableDates.length === 0 && <p className="text-xs text-slate-500 italic text-center py-8">Chưa có dữ liệu lịch sử theo ngày</p>}
                </div>
              </div>
            </div>
          </div>
        )}

      </main>

      {isTaskModalOpen && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-50 animate-fade-in">
          <div className={`w-full max-w-2xl h-[94dvh] sm:h-auto sm:max-h-[90vh] flex flex-col rounded-t-3xl sm:rounded-3xl border ${darkMode ? 'bg-slate-900 border-slate-800 shadow-2xl' : 'bg-white border-slate-200 shadow-2xl'} overflow-hidden`}>
            <div className={`shrink-0 flex justify-between items-center px-5 py-4 sm:px-7 border-b ${darkMode ? 'border-slate-800' : 'border-slate-200'}`}>
              <div>
                <h3 className="text-lg font-bold">{editingTask ? 'Chỉnh sửa công việc' : 'Tạo công việc mới'}</h3>
                <p className="text-xs text-slate-400 mt-1">Nhập thông tin để giao việc và theo dõi tiến độ.</p>
              </div>
              <button type="button" aria-label="Đóng biểu mẫu" onClick={() => setIsTaskModalOpen(false)} className="w-10 h-10 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white text-lg font-medium">✕</button>
            </div>
            
            <form onSubmit={handleSaveTask} className="flex-1 min-h-0 overflow-y-auto px-5 py-5 sm:px-7 space-y-5 overscroll-contain">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Tiêu đề công việc / Sự cố *</label>
                <input 
                  type="text" 
                  required
                  placeholder="Ví dụ: Thiết lập máy in văn phòng"
                  value={taskForm.title}
                  onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                  className={`w-full min-h-12 px-4 py-3 text-base sm:text-sm rounded-xl border ${darkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-blue-500' : 'bg-slate-50 border-slate-200'}`}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Mô tả chi tiết</label>
                <textarea 
                  rows="2"
                  placeholder="Mô tả hiện trạng, yêu cầu hỗ trợ..."
                  value={taskForm.description}
                  onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                  className={`w-full min-h-24 px-4 py-3 text-base sm:text-sm rounded-xl border resize-y ${darkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-blue-500' : 'bg-slate-50 border-slate-200'}`}
                ></textarea>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Ngày & Giờ phát sinh (VN +7) *</label>
                  <input 
                    type="datetime-local"
                    required
                    value={taskForm.dateTime}
                    onChange={(e) => setTaskForm({ ...taskForm, dateTime: e.target.value })}
                    className={`w-full min-h-12 px-4 py-3 text-base sm:text-sm rounded-xl border ${darkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-blue-500' : 'bg-slate-50 border-slate-200'}`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Bộ phận yêu cầu</label>
                  <select
                    value={taskForm.department}
                    onChange={(e) => setTaskForm({ ...taskForm, department: e.target.value })}
                    className={`w-full min-h-12 px-4 py-3 text-base sm:text-sm rounded-xl border ${darkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200'}`}
                  >
                    <option value="" disabled>Chọn bộ phận</option>
                    {departments.map((dept, i) => (
                      <option key={i} value={dept}>{dept}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Ngày dự kiến thực hiện</label>
                <input
                  type="date"
                  value={taskForm.scheduledDate || taskForm.dateTime?.split('T')[0] || ''}
                  onChange={(e) => setTaskForm({ ...taskForm, scheduledDate: e.target.value })}
                  className={`w-full min-h-12 px-4 py-3 text-base sm:text-sm rounded-xl border ${darkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-blue-500' : 'bg-slate-50 border-slate-200'}`}
                />
                <p className="mt-1 text-[11px] text-slate-500">Ngày này sẽ được hiển thị trên Lịch công việc.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Mức độ ưu tiên (Tự động đổi giờ)</label>
                  <select
                    value={taskForm.priority}
                    onChange={(e) => handlePriorityChange(e.target.value)}
                    className={`w-full min-h-12 px-4 py-3 text-base sm:text-sm rounded-xl border ${darkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200'}`}
                  >
                    <option value="P1 - Khẩn cấp">P1 · Khẩn cấp · 30 phút</option>
                    <option value="P2 - Cao">P2 · Cao · 2 giờ</option>
                    <option value="P3 - Trung bình">P3 · Trung bình · 4 giờ</option>
                    <option value="P4 - Thấp">P4 · Thấp · 8 giờ</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Trạng thái</label>
                  <select
                    value={taskForm.status}
                    onChange={(e) => setTaskForm({ ...taskForm, status: e.target.value })}
                    className={`w-full min-h-12 px-4 py-3 text-base sm:text-sm rounded-xl border ${darkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200'}`}
                  >
                    <option value="Todo">Cần làm (To Do)</option>
                    <option value="In Progress">Đang xử lý (In Progress)</option>
                    <option value="Done">Hoàn thành (Done)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Người phụ trách</label>
                  <select
                    value={taskForm.assignee}
                    onChange={(e) => setTaskForm({ ...taskForm, assignee: e.target.value })}
                    className={`w-full min-h-12 px-4 py-3 text-base sm:text-sm rounded-xl border ${darkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200'}`}
                  >
                    <option value="">-- Chọn --</option>
                    {staffList.map(s => (
                      <option key={s.id} value={s.name}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Giờ dự kiến (Tự động)</label>
                  <input 
                    type="number"
                    step="any"
                    min="0.1"
                    value={taskForm.estimatedHours}
                    onChange={(e) => setTaskForm({ ...taskForm, estimatedHours: e.target.value })}
                    className={`w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border ${darkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200'}`}
                  />
                </div>
              </div>

              {editingTask && (
                <div className="pt-3 border-t border-slate-800 space-y-3">
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <MessageSquare className="w-4 h-4 text-blue-400"/> Nhật ký trao đổi / Ghi chú xử lý ({taskForm.comments?.length || 0})
                  </label>

                  <div className={`max-h-40 overflow-y-auto space-y-2 p-3 rounded-xl border ${darkMode ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                    {taskForm.comments && taskForm.comments.map((c, idx) => (
                      <div key={idx} className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 text-xs space-y-1">
                        <div className="flex justify-between items-center text-slate-400 font-medium">
                          <span className="text-blue-400 font-semibold">👤 {c.author}</span>
                          <span className="text-[10px] font-mono">{c.time}</span>
                        </div>
                        <p className="text-slate-200 pl-2 border-l-2 border-blue-500/40">{c.text}</p>
                      </div>
                    ))}
                    {(!taskForm.comments || taskForm.comments.length === 0) && (
                      <p className="text-xs text-slate-500 italic text-center py-3">Chưa có ghi chú nào cho sự cố này.</p>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <input 
                      type="text"
                      placeholder="Thêm ghi chú xử lý / tiến độ..."
                      value={newCommentText}
                      onChange={(e) => setNewCommentText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddComment(); } }}
                      className={`flex-1 px-3 py-2 text-xs rounded-xl border ${darkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200'}`}
                    />
                    <button 
                      type="button" 
                      onClick={handleAddComment}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-medium shadow flex items-center gap-1"
                    >
                      <Send className="w-3.5 h-3.5"/> Gửi
                    </button>
                  </div>
                </div>
              )}

              <div className={`sticky bottom-0 -mx-5 sm:-mx-7 px-5 sm:px-7 py-4 flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 border-t ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                <button type="button" onClick={() => setIsTaskModalOpen(false)} className={`px-4 py-2.5 text-xs sm:text-sm font-medium rounded-xl border transition ${darkMode ? 'border-slate-800 hover:bg-slate-800 text-slate-300' : 'border-slate-300 hover:bg-slate-100'}`}>Hủy</button>
                <button type="submit" className="px-5 py-2.5 text-xs sm:text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-lg shadow-blue-600/30 transition">Lưu công việc</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isStaffModalOpen && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
          <div className={`w-full max-w-md max-h-[92dvh] overflow-y-auto p-5 sm:p-7 rounded-t-3xl sm:rounded-3xl border ${darkMode ? 'bg-slate-900 border-slate-800 shadow-2xl' : 'bg-white border-slate-200 shadow-2xl'} space-y-4`}>
            <div className="flex items-start justify-between gap-4">
              <div><h3 className="text-lg font-bold">{editingStaff ? 'Chỉnh sửa nhân sự' : 'Thêm nhân sự mới'}</h3><p className="mt-1 text-xs text-slate-400">Cập nhật thông tin người phụ trách.</p></div>
              <button type="button" aria-label="Đóng biểu mẫu" onClick={() => setIsStaffModalOpen(false)} className="w-10 h-10 shrink-0 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white">✕</button>
            </div>
            <form onSubmit={handleSaveStaff} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Họ và tên *</label>
                <input type="text" required placeholder="Ví dụ: Nhân sự mẫu" value={staffForm.name} onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })} className={`w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border ${darkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200'}`} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Chức vụ / Vị trí</label>
                <input type="text" placeholder="Ví dụ: Kỹ sư CNTT" value={staffForm.role} onChange={(e) => setStaffForm({ ...staffForm, role: e.target.value })} className={`w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border ${darkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200'}`} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Email</label>
                <input type="email" placeholder="demo@example.invalid" value={staffForm.email} onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })} className={`w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border ${darkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200'}`} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Số điện thoại</label>
                <input type="text" placeholder="" value={staffForm.phone} onChange={(e) => setStaffForm({ ...staffForm, phone: e.target.value })} className={`w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border ${darkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200'}`} />
              </div>
              <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 pt-3">
                <button type="button" onClick={() => setIsStaffModalOpen(false)} className={`px-4 py-2.5 text-xs sm:text-sm font-medium rounded-xl border transition ${darkMode ? 'border-slate-800 hover:bg-slate-800 text-slate-300' : 'border-slate-300 hover:bg-slate-100'}`}>Hủy</button>
                <button type="submit" className="px-5 py-2.5 text-xs sm:text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-lg transition">Lưu nhân sự</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
