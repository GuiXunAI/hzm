import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AppState, Language, EmergencyContact, UserContact } from './types';
import { TRANSLATIONS, HEALING_QUOTES } from './constants';
import Onboarding from './components/Onboarding';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(() => {
    const saved = localStorage.getItem('live_well_v6_db');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.emergencyContacts && parsed.emergencyContacts[0] && parsed.emergencyContacts[0].id === 'primary') {
        parsed.emergencyContacts[0].id = 'c_' + Math.random().toString(36).substr(2, 9);
      }
      return parsed;
    }
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
  const [rawLogs, setRawLogs] = useState<string>('');
  const [showDevTools, setShowDevTools] = useState(false);
  const [testEmailInput, setTestEmailInput] = useState<string>('');

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
    }
  };

  const checkMyCloudData = async () => {
    setRawLogs("🔍 正在探测云端环境注入情况...");
    try {
      const res = await fetch(`/api/alert-check?user_id=${state.userId}`);
      const data = await res.json();
      setRawLogs(JSON.stringify(data, null, 2));
    } catch (e: any) {
      setRawLogs("❌ 请求失败: " + e.message);
    }
  };

  const runDirectMailTest = async () => {
    if (!testEmailInput.includes('@')) {
      alert("请输入有效的测试邮箱");
      return;
    }
    setRawLogs(`📡 发起即时测试...\n请确保您在 Cloudflare 修改变量后执行了【重新部署】。`);
    try {
      const res = await fetch(`/api/alert-check?test_to=${encodeURIComponent(testEmailInput)}`);
      const data = await res.json();
      setRawLogs(JSON.stringify(data, null, 2));
    } catch (e: any) {
      setRawLogs("❌ 网络请求错误: " + e.message);
    }
  };

  const handleCheckIn = (e: React.MouseEvent) => {
    const now = new Date();
    const newState = {
      ...state,
      lastCheckIn: now.getTime(),
      streak: state.streak + 1,
      checkInHistory: [{ 
        timestamp: now.getTime(), 
        dateString: now.toLocaleDateString(), 
        timeString: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) 
      }, ...state.checkInHistory].slice(0, 100),
    };
    setState(newState);
    syncToCloud(newState);
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
    const contactId = 'c_' + Math.random().toString(36).substr(2, 9);
    const initialGuardians = [{ id: contactId, name: '', email, phone: '' }];
    const newState = { ...state, language: lang, userContact: initialUser, emergencyContacts: initialGuardians, isRegistered: true };
    setState(newState);
    setEditUser(initialUser); setEditGuardians(initialGuardians);
    syncToCloud(newState);
  }} />;

  return (
    <div ref={containerRef} className="max-w-[480px] mx-auto w-full relative h-screen flex flex-col bg-white overflow-hidden">
      {/* Header */}
      <header className="px-7 pt-12 pb-4 flex items-center justify-between bg-white/80 backdrop-blur-md sticky top-0 z-20">
          <div>
            <h1 className="brand-logo-text text-[28px]">{t.title}</h1>
            <div className="flex items-center gap-1.5">
               <div className={`w-1.5 h-1.5 rounded-full ${syncStatus === 'success' ? 'bg-[#00D658]' : syncStatus === 'syncing' ? 'bg-orange-400 animate-pulse' : 'bg-slate-300'}`}></div>
               <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{syncStatus === 'syncing' ? 'Cloud Syncing' : 'System Ready'}</span>
            </div>
          </div>
          <nav className="flex bg-[#F8F9FA] p-1 rounded-full border border-slate-100 shadow-sm">
             <button onClick={() => setActiveTab('home')} className={`p-2.5 rounded-full transition-all ${activeTab === 'home' ? 'bg-white text-[#00D658] shadow-md' : 'text-slate-300'}`}>
               <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M10.7 2.3a1 1 0 00-1.4 0l-7 7a1 1 0 001.4 1.4L4 9.4V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1V9.4l.3.3a1 1 0 001.4-1.4l-7-7z"/></svg>
             </button>
             <button onClick={() => setActiveTab('history')} className={`p-2.5 rounded-full transition-all ${activeTab === 'history' ? 'bg-white text-[#00D658] shadow-md' : 'text-slate-300'}`}>
               <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"/></svg>
             </button>
             <button onClick={() => setActiveTab('settings')} className={`p-2.5 rounded-full transition-all ${activeTab === 'settings' ? 'bg-white text-[#00D658] shadow-md' : 'text-slate-300'}`}>
               <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M11.5 3.2c-.4-1.6-2.6-1.6-3 0a1.5 1.5 0 01-2.3 1c-1.4-.9-3 .7-2.1 2.1a1.5 1.5 0 01-.9 2.3c-1.6.4-1.6 2.6 0 3a1.5 1.5 0 01.9 2.3c-.8 1.4.7 3 2.1 2.1a1.5 1.5 0 012.3.9c.4 1.6 2.6 1.6 3 0a1.5 1.5 0 012.3-1c1.4.9 3-.7 2.1-2.1a1.5 1.5 0 01.9-2.3c1.6-.4 1.6-2.6 0-3a1.5 1.5 0 01-.9-2.3c.9-1.4-.7-3-2.1-2.1a1.5 1.5 0 01-2.3-.9zM10 13a3 3 0 100-6 3 3 0 000 6z"/></svg>
             </button>
          </nav>
      </header>

      <main className="flex-1 overflow-y-auto pb-32 px-7 pt-4 no-scrollbar">
        {activeTab === 'home' && (
          <div className="flex flex-col gap-8 py-4 animate-in fade-in duration-500">
            {/* Status Card */}
            <div className={`premium-card p-6 border-2 transition-all duration-700 ${hasCheckedInToday ? 'border-[#EFFFF4] bg-[#F9FFFB]' : 'border-[#FF4D4F] bg-[#FFF1F0]'}`}>
              <div className="flex items-center justify-between mb-4">
                 <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">平安状态监控</span>
                 <div className="flex items-baseline gap-1">
                   <span className="text-[20px] font-black">{state.streak}</span>
                   <span className="text-[10px] font-bold text-slate-400">DAYS</span>
                 </div>
              </div>
              <h3 className={`text-[36px] font-black tracking-tighter leading-none mb-2 ${hasCheckedInToday ? 'text-slate-800' : 'text-[#FF4D4F]'}`}>
                {hasCheckedInToday ? "今日已确认平安" : "等待确认中"}
              </h3>
              <p className="text-[13px] font-medium text-slate-400">
                {hasCheckedInToday ? "系统运行正常，守护者保持待命。" : `距离触发紧急邮件预警还有 ${countdownToAlert}s`}
              </p>
            </div>

            {/* Main Action Area */}
            <div className="flex-1 flex flex-col items-center justify-center py-8">
               <div className="relative">
                 {hasCheckedInToday && (
                   <div className="absolute inset-0 bg-[#00D658]/10 rounded-full animate-ping"></div>
                 )}
                 <button 
                   disabled={hasCheckedInToday} 
                   onClick={handleCheckIn} 
                   className={`w-64 h-64 rounded-full flex flex-col items-center justify-center squishy shadow-2xl transition-all duration-700 relative z-10
                     ${hasCheckedInToday ? 'bg-slate-50 text-slate-300 border-4 border-slate-100' : 'bg-[#FF4D4F] text-white animate-breathe'}`}
                 >
                   <span className="text-[32px] font-black">{hasCheckedInToday ? "已确认为安全" : "确认平安"}</span>
                   {!hasCheckedInToday && <span className="text-[12px] opacity-70 mt-1 font-bold">CLICK TO SIGN-IN</span>}
                   {hasCheckedInToday && (
                     <svg className="w-12 h-12 mt-4 text-[#00D658]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                     </svg>
                   )}
                 </button>
               </div>
            </div>

            {/* Healing Quote */}
            <div className="text-center px-6">
               <p className="text-slate-300 text-[14px] font-medium italic">
                 “ {HEALING_QUOTES[state.language || 'zh'][Math.floor(Date.now() / 86400000) % 10]} ”
               </p>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="animate-in slide-in-from-right-4 duration-300 space-y-6">
             <div className="flex items-center justify-between">
                <h3 className="text-[20px] font-black text-slate-800">打卡历史</h3>
                <span className="text-[11px] font-black bg-slate-100 text-slate-400 px-3 py-1 rounded-full uppercase">近 100 条记录</span>
             </div>
             {state.checkInHistory.length === 0 ? (
               <div className="py-20 text-center opacity-30 font-bold">暂无历史记录</div>
             ) : (
               <div className="space-y-3">
                 {state.checkInHistory.map((item, idx) => (
                   <div key={idx} className="bg-slate-50 border border-slate-100 p-5 rounded-[24px] flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-[#00D658] shadow-sm">
                           <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
                        </div>
                        <div>
                          <p className="text-[14px] font-black text-slate-700">{item.dateString}</p>
                          <p className="text-[11px] font-bold text-slate-400 uppercase">{item.timeString}</p>
                        </div>
                      </div>
                      <span className="text-[10px] font-black text-[#00D658] bg-[#00D658]/5 px-2 py-1 rounded-md">SUCCESS</span>
                   </div>
                 ))}
               </div>
             )}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="animate-in slide-in-from-left-4 duration-300 space-y-6">
            <h3 className="text-[20px] font-black text-slate-800">账号设置</h3>
            <div className="premium-card p-6 space-y-5">
               <div>
                 <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">我的称呼</label>
                 <input value={editUser.name} onChange={e=>setEditUser({...editUser, name:e.target.value})} className="w-full mt-2 p-4 bg-slate-50 rounded-2xl outline-none font-bold text-slate-700" />
               </div>
               <div>
                 <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">守护者邮箱 (接收预警)</label>
                 <input value={editGuardians[0]?.email} onChange={e=>{const n=[...editGuardians]; n[0].email=e.target.value; setEditGuardians(n);}} className="w-full mt-2 p-4 bg-slate-50 rounded-2xl outline-none font-bold text-slate-700" />
               </div>
            </div>
            
            <button onClick={async () => {
              const newState = { ...state, userContact: editUser, emergencyContacts: editGuardians };
              setState(newState);
              await syncToCloud(newState);
            }} className="w-full py-5 rounded-[28px] bg-[#00D658] text-white font-black shadow-xl shadow-[#00D658]/20 squishy">
              保存并应用
            </button>

            <div className="pt-10 border-t border-slate-100">
               <button onClick={() => setShowDevTools(!showDevTools)} className="text-[12px] font-black text-slate-300 uppercase tracking-widest">
                 高级开发者工具 {showDevTools ? '▲' : '▼'}
               </button>
               {showDevTools && (
                 <div className="mt-4 p-5 bg-slate-900 rounded-3xl space-y-4">
                    <div className="flex justify-between items-center text-[10px] font-mono text-green-500">
                       <span>UID: {state.userId}</span>
                       <button onClick={checkMyCloudData} className="bg-white/10 px-2 py-1 rounded">DEBUG DB & ENV</button>
                    </div>
                    
                    <div className="border-t border-white/10 pt-4">
                       <p className="text-[10px] font-black text-slate-500 uppercase mb-2">🚀 域名发信生效测试</p>
                       <p className="text-[9px] text-amber-500 mb-3 leading-tight font-bold">⚠️ 重要：修改环境变量后必须在 Cloudflare Pages 重新点击 Deploy，否则云端依然使用旧环境！</p>
                       <div className="flex gap-2">
                         <input 
                           placeholder="输入测试收件邮箱" 
                           value={testEmailInput}
                           onChange={e => setTestEmailInput(e.target.value)}
                           className="flex-1 bg-black/40 text-[11px] text-white p-2 rounded-lg outline-none border border-white/5"
                         />
                         <button onClick={runDirectMailTest} className="bg-[#00D658] text-white text-[10px] font-black px-3 rounded-lg squishy">RUN TEST</button>
                       </div>
                    </div>

                    <pre className="text-[10px] text-slate-400 max-h-60 overflow-y-auto font-mono bg-black/30 p-3 rounded-xl border border-white/5">
                      {rawLogs || '// 等待操作以检测云端变量...'}
                    </pre>
                 </div>
               )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
