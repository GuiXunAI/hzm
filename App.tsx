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
  const [isSyncing, setIsSyncing] = useState(false);
  const [tick, setTick] = useState(0); 
  const [apiLogs, setApiLogs] = useState<string>('等待触发...');
  const [showDevTools, setShowDevTools] = useState(false);

  const [editUser, setEditUser] = useState<UserContact>(state.userContact);
  const [editGuardians, setEditGuardians] = useState<EmergencyContact[]>(state.emergencyContacts);

  const containerRef = useRef<HTMLDivElement>(null);
  const t = TRANSLATIONS[state.language || 'zh'];

  // 每秒更新
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    localStorage.setItem('live_well_v6_db', JSON.stringify(state));
    if (state.isRegistered) syncToCloud(state);
  }, [state]);

  const syncToCloud = async (data: AppState) => {
    try {
      setIsSyncing(true);
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Sync failed');
    } catch (e) {
      console.error("Cloud sync paused");
    } finally {
      setIsSyncing(false);
    }
  };

  const manualTriggerCheck = async () => {
    setApiLogs("正在请求预警接口...");
    try {
      const res = await fetch('/api/alert-check');
      const text = await res.text();
      try {
        const json = JSON.parse(text);
        setApiLogs(JSON.stringify(json, null, 2));
      } catch {
        setApiLogs("错误：接口返回的不是 JSON。请检查 functions 目录是否部署正确。\n\n返回内容：\n" + text.substring(0, 200));
      }
    } catch (e: any) {
      setApiLogs("网络请求失败: " + e.message);
    }
  };

  const handleCheckIn = (e: React.MouseEvent) => {
    const now = new Date();
    const todayStr = now.toLocaleDateString();
    
    setState(prev => {
      const ts = now.getTime();
      return {
        ...prev,
        lastCheckIn: ts,
        streak: prev.streak + 1,
        checkInHistory: [...prev.checkInHistory, { 
          timestamp: ts, 
          dateString: todayStr, 
          timeString: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) 
        }].slice(-365),
      };
    });
  };

  const saveSettings = async () => {
    const newState = { ...state, userContact: editUser, emergencyContacts: editGuardians };
    setState(newState);
    await syncToCloud(newState);
    alert('信息已保存');
  };

  const hasCheckedInToday = useMemo(() => {
    if (!state.lastCheckIn) return false;
    // 测试模式：60秒有效期
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
    setState(p => ({ ...p, language: lang, userContact: initialUser, emergencyContacts: initialGuardians, isRegistered: true }));
    setEditUser(initialUser); setEditGuardians(initialGuardians);
  }} />;

  return (
    <div ref={containerRef} className="max-w-[480px] mx-auto w-full relative h-screen flex flex-col bg-white overflow-hidden">
      <main className="flex-1 overflow-y-auto pt-14 pb-32 px-7">
        <div className="flex items-center justify-between mb-8">
           <div>
              <h1 className="brand-logo-text text-[32px]">{t.title}</h1>
              <p className="text-[10px] font-black text-[#00D658] uppercase tracking-widest">Dev Test Mode</p>
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
                   <div className="p-3 bg-white rounded-xl border border-slate-200">
                      <p className="text-[11px] font-bold text-slate-400 uppercase mb-2">API 实时日志</p>
                      <pre className="text-[10px] bg-slate-900 text-green-400 p-3 rounded-lg overflow-x-auto max-h-40 whitespace-pre-wrap">
                        {apiLogs}
                      </pre>
                   </div>
                   <button onClick={manualTriggerCheck} className="w-full py-3 bg-slate-800 text-white rounded-xl font-black text-[13px] squishy">
                     立即模拟后端巡检 (Trigger API)
                   </button>
                   <p className="text-[10px] text-slate-400 text-center">注意：请在倒计时归零后点击上方按钮触发发信。</p>
                 </div>
               )}
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="flex flex-col gap-6">
            <h3 className="text-[18px] font-black text-[#00D658]">守护设置</h3>
            <div className="premium-card p-6 space-y-4">
               <div>
                 <label className="text-[11px] font-bold text-slate-400 uppercase">您的姓名</label>
                 <input value={editUser.name} onChange={e=>setEditUser({...editUser, name:e.target.value})} className="w-full mt-1 p-4 bg-slate-50 rounded-2xl outline-none border-2 border-transparent focus:border-[#00D658]/20 transition-all font-bold" />
               </div>
               <div>
                 <label className="text-[11px] font-bold text-slate-400 uppercase">紧急联系人邮箱</label>
                 <input value={editGuardians[0]?.email} onChange={e=>{const n=[...editGuardians]; n[0].email=e.target.value; setEditGuardians(n);}} className="w-full mt-1 p-4 bg-slate-50 rounded-2xl outline-none border-2 border-transparent focus:border-[#00D658]/20 transition-all font-bold" />
               </div>
            </div>
            <button onClick={saveSettings} className="w-full py-5 rounded-[32px] bg-[#00D658] text-white font-black shadow-xl shadow-[#00D658]/20 squishy">保存并上传同步</button>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
