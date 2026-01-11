import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AppState, Language, EmergencyContact, UserContact } from './types';
import { TRANSLATIONS, HEALING_QUOTES } from './constants';
import Onboarding from './components/Onboarding';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(() => {
    const saved = localStorage.getItem('live_well_v6_db');
    if (saved) return JSON.parse(saved);
    return {
      userId: 'user_' + Math.random().toString(36).substr(2, 9),
      language: 'zh',
      lastCheckIn: null,
      checkInHistory: [],
      emergencyContacts: [],
      userContact: { name: '', email: '', phone: '' },
      streak: 0,
      isRegistered: false,
    };
  });

  const [activeTab, setActiveTab] = useState<'home' | 'history' | 'settings'>('home');
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [tick, setTick] = useState(0); 
  const [apiLogs, setApiLogs] = useState<any>({});
  const [rawLogs, setRawLogs] = useState<string>('');
  const [showDevTools, setShowDevTools] = useState(false);

  const [editUser, setEditUser] = useState<UserContact>(state.userContact);
  const [editGuardians, setEditGuardians] = useState<EmergencyContact[]>(state.emergencyContacts);

  const containerRef = useRef<HTMLDivElement>(null);
  const t = TRANSLATIONS[state.language || 'zh'];

  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    localStorage.setItem('live_well_v6_db', JSON.stringify(state));
  }, [state]);

  const syncToCloud = async (data: AppState) => {
    setSyncStatus('syncing');
    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Sync failed');
      setSyncStatus('success');
      setTimeout(() => setSyncStatus('idle'), 3000);
    } catch (e) {
      setSyncStatus('error');
      console.error("Cloud sync error", e);
    }
  };

  const manualTriggerCheck = async () => {
    setRawLogs("正在请求预警接口...");
    try {
      const res = await fetch('/api/alert-check');
      const data = await res.json();
      setApiLogs(data);
      setRawLogs(JSON.stringify(data, null, 2));
    } catch (e: any) {
      setRawLogs("请求失败: " + e.message);
    }
  };

  const handleCheckIn = (e: React.MouseEvent) => {
    const now = new Date();
    const todayStr = now.toLocaleDateString();
    const newState = {
      ...state,
      lastCheckIn: now.getTime(),
      streak: state.streak + 1,
      checkInHistory: [...state.checkInHistory, { 
        timestamp: now.getTime(), 
        dateString: todayStr, 
        timeString: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) 
      }].slice(-365),
    };
    setState(newState);
    syncToCloud(newState);
  };

  const saveSettings = async () => {
    const newState = { ...state, userContact: editUser, emergencyContacts: editGuardians };
    setState(newState);
    await syncToCloud(newState);
  };

  const hasCheckedInToday = useMemo(() => {
    if (!state.lastCheckIn) return false;
    return (Date.now() - state.lastCheckIn) < 60 * 1000;
  }, [state.lastCheckIn, tick]);

  const countdownToAlert = useMemo(() => {
    if (!state.lastCheckIn) return 0;
    const diff = Date.now() - state.lastCheckIn;
    return Math.max(0, 120 - Math.floor(diff / 1000));
  }, [state.lastCheckIn, tick]);

  if (!state.isRegistered) return <Onboarding onComplete={(lang, name, email) => {
    const initialUser = { name, email: '', phone: '' };
    const initialGuardians = [{ id: 'primary', name: '', email, phone: '' }];
    const newState = { ...state, language: lang, userContact: initialUser, emergencyContacts: initialGuardians, isRegistered: true };
    setState(newState);
    setEditUser(initialUser); setEditGuardians(initialGuardians);
    syncToCloud(newState);
  }} />;

  return (
    <div ref={containerRef} className="max-w-[480px] mx-auto w-full relative h-screen flex flex-col bg-white overflow-hidden">
      <main className="flex-1 overflow-y-auto pt-14 pb-32 px-7">
        <div className="flex items-center justify-between mb-8">
           <div>
              <h1 className="brand-logo-text text-[32px]">{t.title}</h1>
              <p className="text-[10px] font-black text-[#00D658] uppercase tracking-widest">
                {syncStatus === 'syncing' ? '同步中...' : syncStatus === 'success' ? '同步成功' : 'Dev Test Mode'}
              </p>
           </div>
           <nav className="flex bg-[#F8F9FA] p-1.5 rounded-full">
              <button onClick={() => setActiveTab('home')} className={`p-3 rounded-full transition-all ${activeTab === 'home' ? 'bg-[#00D658] text-white shadow-lg' : 'text-slate-300'}`}>
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M10.7 2.3a1 1 0 00-1.4 0l-7 7a1 1 0 001.4 1.4L4 9.4V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1V9.4l.3.3a1 1 0 001.4-1.4l-7-7z"/></svg>
              </button>
              <button onClick={() => setActiveTab('settings')} className={`p-3 rounded-full transition-all ${activeTab === 'settings' ? 'bg-[#00D658] text-white shadow-lg' : 'text-slate-300'}`}>
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M11.5 3.2c-.4-1.6-2.6-1.6-3 0a1.5 1.5 0 01-2.3 1c-1.4-.9-3 .7-2.1 2.1a1.5 1.5 0 01-.9 2.3c-1.6.4-1.6 2.6 0 3a1.5 1.5 0 01.9 2.3c-.8 1.4.7 3 2.1 2.1a1.5 1.5 0 012.3.9c.4 1.6 2.6 1.6 3 0a1.5 1.5 0 012.3-1c1.4.9 3-.7 2.1-2.1a1.5 1.5 0 01.9-2.3c1.6-.4 1.6-2.6 0-3a1.5 1.5 0 01-.9-2.3c.9-1.4-.7-3-2.1-2.1a1.5 1.5 0 01-2.3-.9zM10 13a3 3 0 100-6 3 3 0 000 6z"/></svg>
              </button>
           </nav>
        </div>

        {activeTab === 'home' && (
          <div className="flex flex-col gap-6">
            <div className={`premium-card p-6 border-2 transition-all duration-500 ${hasCheckedInToday ? 'border-[#EFFFF4]' : 'border-[#FF4D4F] bg-[#FFF1F0]'}`}>
              <div className="flex items-center justify-between mb-2">
                 <span className="text-[12px] font-black uppercase text-slate-400">状态监控</span>
                 {!hasCheckedInToday && (
                   <span className="text-[11px] font-bold bg-rose-500 text-white px-3 py-1 rounded-full animate-pulse">
                     {countdownToAlert}s 后触发预警
                   </span>
                 )}
              </div>
              <h3 className="text-[32px] font-black text-slate-800 tracking-tighter">{hasCheckedInToday ? "已确认为安全" : "检测失联中"}</h3>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center py-10">
               <button disabled={hasCheckedInToday} onClick={handleCheckIn} 
                 className={`w-56 h-56 rounded-full flex flex-col items-center justify-center squishy shadow-2xl transition-all duration-700 
                   ${hasCheckedInToday ? 'bg-slate-100 text-slate-400' : 'bg-[#FF4D4F] text-white animate-breathe'}`}
               >
                 <span className="text-[28px] font-black">{hasCheckedInToday ? "已确认" : "确认平安"}</span>
                 {!hasCheckedInToday && <span className="text-[12px] opacity-70 mt-1 font-bold">CLICK TO SIGN</span>}
               </button>
            </div>
            
            <div className="bg-slate-50 rounded-3xl p-6 border border-slate-100">
               <div className="flex justify-between items-center mb-2">
                 <p className="text-[13px] font-bold text-slate-500">测试工具箱</p>
                 <button onClick={() => setShowDevTools(!showDevTools)} className="text-[11px] font-black text-[#00D658] uppercase">{showDevTools ? '隐藏' : '显示'}</button>
               </div>
               {showDevTools && (
                 <div className="space-y-4 animate-in slide-in-from-bottom-2 duration-300">
                   <div className="p-4 bg-white rounded-2xl border border-slate-200">
                      <div className="flex items-center justify-between mb-2 text-[10px] font-mono text-slate-400">
                         <span>CURRENT ID: {state.userId}</span>
                      </div>
                      
                      {apiLogs.report && apiLogs.report.some((r: any) => r.user_id !== state.userId) && (
                        <div className="mb-3 p-3 bg-amber-50 border border-amber-100 rounded-xl">
                          <p className="text-[11px] font-bold text-amber-600 mb-1">提示：检测到旧账号数据</p>
                          <p className="text-[10px] text-amber-500 leading-tight">
                            下方日志显示的 <b>{apiLogs.report.find((r:any)=>r.user_id !== state.userId)?.user_name}</b> 可能是您之前的旧账号记录。请点击“设置-保存”强制同步当前账号。
                          </p>
                        </div>
                      )}

                      <pre className="text-[10px] bg-slate-900 text-green-400 p-3 rounded-lg overflow-x-auto max-h-48 whitespace-pre-wrap font-mono">
                        {rawLogs || '点击下方按钮触发 API'}
                      </pre>
                   </div>
                   <button onClick={manualTriggerCheck} className="w-full py-4 bg-slate-800 text-white rounded-2xl font-black text-[14px] squishy">
                     立即模拟后端巡检 (Trigger API)
                   </button>
                 </div>
               )}
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="flex flex-col gap-6">
            <h3 className="text-[18px] font-black text-[#00D658]">守护设置</h3>
            <div className="premium-card p-6 space-y-4">
               <div className="text-[10px] font-mono text-slate-300 mb-2">ID: {state.userId}</div>
               <div>
                 <label className="text-[11px] font-bold text-slate-400 uppercase">您的姓名</label>
                 <input value={editUser.name} onChange={e=>setEditUser({...editUser, name:e.target.value})} className="w-full mt-1 p-4 bg-slate-50 rounded-2xl outline-none border-2 border-transparent focus:border-[#00D658]/20 transition-all font-bold" />
               </div>
               <div>
                 <label className="text-[11px] font-bold text-slate-400 uppercase">紧急联系人邮箱</label>
                 <input value={editGuardians[0]?.email} onChange={e=>{const n=[...editGuardians]; n[0].email=e.target.value; setEditGuardians(n);}} className="w-full mt-1 p-4 bg-slate-50 rounded-2xl outline-none border-2 border-transparent focus:border-[#00D658]/20 transition-all font-bold" />
               </div>
            </div>
            <button onClick={saveSettings} className={`w-full py-5 rounded-[32px] text-white font-black shadow-xl squishy transition-all ${syncStatus === 'syncing' ? 'bg-slate-400' : 'bg-[#00D658] shadow-[#00D658]/20'}`}>
              {syncStatus === 'syncing' ? '正在同步云端...' : '保存并强制同步'}
            </button>
            {syncStatus === 'success' && <p className="text-center text-[12px] text-[#00D658] font-bold">已同步至 D1 数据库</p>}
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
