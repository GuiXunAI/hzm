import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AppState, Language, EmergencyContact, UserContact } from './types';
import { TRANSLATIONS, HEALING_QUOTES } from './constants';
import Onboarding from './components/Onboarding';
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';

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
  const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date());
  const [isSyncing, setIsSyncing] = useState(false);
  const [tick, setTick] = useState(0); 

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

  const formatCountdown = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleCheckIn = (e: React.MouseEvent) => {
    const now = new Date();
    const todayStr = now.toLocaleDateString();
    if (state.checkInHistory.some(h => h.dateString === todayStr)) return;

    setState(prev => {
      const ts = now.getTime();
      const last = prev.lastCheckIn ? new Date(prev.lastCheckIn) : null;
      const isConsecutive = last ? (ts - last.getTime()) / (1000 * 60 * 60 * 24) <= 1.5 : false;
      return {
        ...prev,
        lastCheckIn: ts,
        streak: isConsecutive ? prev.streak + 1 : 1,
        checkInHistory: [...prev.checkInHistory, { 
          timestamp: ts, 
          dateString: todayStr, 
          timeString: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) 
        }].slice(-365),
      };
    });
  };

  const saveSettings = async () => {
    if (!editUser.name.trim()) { alert(state.language === 'en' ? 'Name cannot be empty' : '姓名不能为空'); return; }
    if (editGuardians.some(g => !g.email.includes('@'))) { alert(state.language === 'en' ? 'Please fill in valid emergency emails' : '请填写有效的紧急联系人邮箱'); return; }
    
    const newState = { ...state, userContact: editUser, emergencyContacts: editGuardians };
    setState(newState);
    await syncToCloud(newState);
    alert(state.language === 'en' ? 'Settings saved' : '信息已成功保存');
  };

  const addGuardian = () => {
    if (editGuardians.length >= 3) return;
    const newGuardian: EmergencyContact = {
      id: 'guardian_' + Math.random().toString(36).substr(2, 9),
      name: '',
      email: '',
      phone: '',
    };
    setEditGuardians([...editGuardians, newGuardian]);
  };

  const removeGuardian = (id: string) => {
    if (editGuardians.length <= 1) return;
    setEditGuardians(editGuardians.filter(g => g.id !== id));
  };

  const hasCheckedInToday = useMemo(() => {
    if (!state.lastCheckIn) return false;
    const lastDate = new Date(state.lastCheckIn).toDateString();
    const todayDate = new Date().toDateString();
    return lastDate === todayDate;
  }, [state.lastCheckIn, tick]);

  const countdownToAlert = useMemo(() => {
    if (!state.lastCheckIn) return 172800; // 48h
    const diff = Date.now() - state.lastCheckIn;
    return Math.max(0, 172800 - Math.floor(diff / 1000));
  }, [state.lastCheckIn, tick]);

  const weekLabels = state.language === 'en' ? ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'] : ['日','一','二','三','四','五','六'];

  const calendarDays = useMemo(() => {
    const y = currentCalendarDate.getFullYear();
    const m = currentCalendarDate.getMonth();
    const firstIdx = new Date(y, m, 1).getDay();
    const lastDay = new Date(y, m + 1, 0).getDate();
    return Array.from({ length: 42 }).map((_, i) => {
      const dayNum = i - firstIdx + 1;
      if (dayNum < 1 || dayNum > lastDay) return null;
      const dStr = new Date(y, m, dayNum).toLocaleDateString();
      return { day: dayNum, checked: state.checkInHistory.some(h => h.dateString === dStr) };
    });
  }, [state.checkInHistory, currentCalendarDate]);

  const monthActivityData = useMemo(() => {
    const currentMonth = currentCalendarDate.getMonth();
    const currentYear = currentCalendarDate.getFullYear();
    return state.checkInHistory
      .filter(h => {
        const d = new Date(h.timestamp);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      })
      .map(h => {
        const d = new Date(h.timestamp);
        const [hPart, mPart] = h.timeString.split(':');
        return {
          date: (d.getMonth() + 1) + '/' + d.getDate(),
          rawDate: d.toLocaleDateString(state.language === 'en' ? 'en-US' : 'zh-CN', { month: 'short', day: 'numeric' }),
          time: parseInt(hPart) * 60 + parseInt(mPart),
          display: h.timeString
        };
      })
      .sort((a,b) => {
         const [m1, d1] = a.date.split('/').map(Number);
         const [m2, d2] = b.date.split('/').map(Number);
         return m1 !== m2 ? m1 - m2 : d1 - d2;
      });
  }, [state.checkInHistory, currentCalendarDate, state.language]);

  if (!state.isRegistered) return <Onboarding onComplete={(lang, name, email) => {
    const initialUser = { name, email: '', phone: '' };
    const initialGuardians = [{ id: 'primary', name: '', email, phone: '' }];
    setState(p => ({ ...p, language: lang, userContact: initialUser, emergencyContacts: initialGuardians, isRegistered: true }));
    setEditUser(initialUser); setEditGuardians(initialGuardians);
  }} />;

  return (
    <div ref={containerRef} className="max-w-[480px] mx-auto w-full relative h-screen flex flex-col bg-white text-slate-800 overflow-hidden select-none">
      <main className="flex-1 overflow-y-auto no-scrollbar relative pt-14 pb-32 px-7">
        <div className="flex items-center justify-between mb-8">
           <div className="flex flex-col">
              <h1 className="brand-logo-text text-[32px] leading-tight">{t.title}</h1>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-[12px] font-bold text-[#00D658] uppercase tracking-[0.3em] italic">{t.subtitle}</p>
                {isSyncing && <div className="w-1.5 h-1.5 bg-[#00D658] rounded-full animate-ping"></div>}
              </div>
           </div>
           <nav className="flex bg-[#F8F9FA] p-1.5 rounded-full border border-slate-100">
              {['home', 'history', 'settings'].map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab as any)} className={`p-3 rounded-full transition-all duration-300 ${activeTab === tab ? 'bg-[#00D658] text-white shadow-lg shadow-[#00D658]/20' : 'text-slate-300'}`}>
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d={tab === 'home' ? 'M10.7 2.3a1 1 0 00-1.4 0l-7 7a1 1 0 001.4 1.4L4 9.4V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1V9.4l.3.3a1 1 0 001.4-1.4l-7-7z' : tab === 'history' ? 'M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z' : 'M11.5 3.2c-.4-1.6-2.6-1.6-3 0a1.5 1.5 0 01-2.3 1c-1.4-.9-3 .7-2.1 2.1a1.5 1.5 0 01-.9 2.3c-1.6.4-1.6 2.6 0 3a1.5 1.5 0 01.9 2.3c-.8 1.4.7 3 2.1 2.1a1.5 1.5 0 012.3.9c.4 1.6 2.6 1.6 3 0a1.5 1.5 0 012.3-1c1.4.9 3-.7 2.1-2.1a1.5 1.5 0 01.9-2.3c1.6-.4 1.6-2.6 0-3a1.5 1.5 0 01-.9-2.3c.9-1.4-.7-3-2.1-2.1a1.5 1.5 0 01-2.3-.9zM10 13a3 3 0 100-6 3 3 0 000 6z'}/>
                  </svg>
                </button>
              ))}
           </nav>
        </div>

        {activeTab === 'home' && (
          <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 mt-4">
            <div className={`premium-card p-6 border-2 transition-all duration-500 ${hasCheckedInToday ? 'border-[#EFFFF4]' : countdownToAlert < 43200 ? 'border-orange-100 bg-orange-50/30' : 'border-[#FF4D4F] bg-[#FFF1F0]'}`}>
              <div className="flex items-center justify-between mb-4">
                 <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${hasCheckedInToday ? 'bg-[#00D658]' : 'bg-[#FF4D4F] animate-pulse'}`}></div>
                    <span className={`text-[12px] font-black uppercase tracking-widest ${hasCheckedInToday ? 'text-[#00D658]/60' : 'text-[#FF4D4F]/60'}`}>{t.statusCheck}</span>
                 </div>
                 {!hasCheckedInToday && (
                   <span className={`text-[11px] font-bold px-3 py-1 rounded-full ${countdownToAlert < 3600 ? 'bg-orange-500 text-white animate-pulse' : 'bg-rose-500/10 text-rose-500'}`}>
                     {state.language === 'en' ? `Alert in ${formatCountdown(countdownToAlert)}` : `预警倒计时: ${formatCountdown(countdownToAlert)}`}
                   </span>
                 )}
              </div>
              <div className="flex justify-between items-start">
                <div className="flex flex-col">
                  <h3 className="text-[32px] font-black text-slate-800 leading-none">{hasCheckedInToday ? t.statusSafe : t.statusPending}</h3>
                  <p className="text-[13px] text-slate-400 mt-2">{t.statusCheck}</p>
                </div>
                <div className="flex flex-col items-end">
                  <div className="relative">
                    <div className="absolute -inset-2 bg-[#00D658]/10 rounded-full blur-md"></div>
                    <span className="relative text-[48px] font-black text-[#00D658] leading-none tracking-tighter">{state.streak}</span>
                  </div>
                  <span className="text-[10px] font-black text-[#00D658]/40 mt-3 uppercase tracking-tighter">{t.consecutiveDays}</span>
                </div>
              </div>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center py-14">
               <div className={`relative w-64 h-64 flex items-center justify-center transition-all duration-1000 ${hasCheckedInToday ? 'text-[#00D658]' : 'text-[#FF4D4F]'}`}>
                  <button disabled={hasCheckedInToday} onClick={handleCheckIn} 
                    className={`w-full h-full rounded-full flex flex-col items-center justify-center squishy shadow-2xl relative z-10 transition-all duration-700 
                      ${hasCheckedInToday ? 'bg-[#00D658] border-none text-white shadow-[#00D658]/40' : 'bg-[#FF4D4F] border-[8px] border-white text-white animate-breathe shadow-[#FF4D4F]/40'}`}
                  >
                    <span className="text-[28px] font-black tracking-tight mb-4">{hasCheckedInToday ? t.checkedInToday : t.checkInBtn}</span>
                    <div className={`w-24 h-24 rounded-full flex items-center justify-center ${hasCheckedInToday ? 'bg-white/20' : 'bg-white/30'}`}>
                      <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 20 20">
                         {hasCheckedInToday ? <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"/> : <path d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"/>}
                      </svg>
                    </div>
                  </button>
               </div>
            </div>
            
            <div className="bg-[#F8F9FA] rounded-[24px] p-6 text-center border border-slate-100">
               <p className="text-[13px] text-slate-400 font-medium leading-relaxed">
                  {state.language === 'en' ? 'Daily check-ins ensure your safety. Alerts are sent after 48h silence.' : '保持每日签到习惯，若超过48小时未响应，系统将向守护者邮箱发送预警报告。'}
               </p>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="flex flex-col gap-7 animate-in fade-in duration-500 pb-12">
            <div className="premium-card p-8">
              <div className="flex items-center justify-between mb-10">
                <h3 className="text-[17px] font-black text-[#00D658] tracking-tight">{t.calendarTitle}</h3>
                <div className="flex gap-2">
                   <button onClick={() => setCurrentCalendarDate(new Date(currentCalendarDate.setMonth(currentCalendarDate.getMonth()-1)))} className="p-2 hover:bg-slate-50 rounded-xl text-slate-300">←</button>
                   <button onClick={() => setCurrentCalendarDate(new Date(currentCalendarDate.setMonth(currentCalendarDate.getMonth()+1)))} className="p-2 hover:bg-slate-50 rounded-xl text-slate-300">→</button>
                </div>
              </div>
              <div className="grid grid-cols-7 gap-3">
                 {weekLabels.map(w => <div key={w} className="text-center text-[10px] font-black text-[#00D658]/30 uppercase tracking-tighter">{w}</div>)}
                 {calendarDays.map((d, i) => (
                   <div key={i} className={`aspect-square flex items-center justify-center rounded-[18px] text-[15px] font-bold ${!d ? '' : (d.checked ? 'bg-[#00D658] text-white shadow-lg shadow-[#00D658]/20' : 'bg-slate-50 text-slate-200 opacity-60')}`}>{d?.day}</div>
                 ))}
              </div>
            </div>

            <div className="premium-card p-8 h-[380px] flex flex-col">
               <h3 className="text-[17px] font-black text-[#00D658] mb-8">{t.timeTrend}</h3>
               <div className="flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={monthActivityData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} interval={Math.max(0, Math.floor(monthActivityData.length / 5))} />
                      <YAxis domain={[0, 1440]} axisLine={false} tickLine={false} tickFormatter={(v) => `${Math.floor(v/60)}:00`} tick={{fill: '#94a3b8', fontSize: 11}} />
                      <Tooltip content={({ active, payload }) => active && payload && (
                          <div className="bg-white px-5 py-4 rounded-3xl shadow-2xl border border-slate-50 font-black">
                            {payload[0].payload.rawDate} <span className="text-[#00D658] ml-2">{payload[0].payload.display}</span>
                          </div>
                        )}
                      />
                      <Line type="monotone" dataKey="time" stroke="#00D658" strokeWidth={5} dot={{r: 5, fill:'#00D658', stroke: '#fff', strokeWidth: 2}} />
                    </LineChart>
                  </ResponsiveContainer>
               </div>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="flex flex-col gap-8 animate-in fade-in duration-500 pb-20">
            <section className="space-y-4">
               <h3 className="text-[16px] font-black text-[#00D658] ml-2">{t.userTitle}</h3>
               <div className="premium-card p-6 space-y-4">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">{t.name}</label>
                    <input type="text" value={editUser.name} onChange={e => setEditUser({...editUser, name:e.target.value})} className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-2 border-transparent outline-none focus:border-[#00D658]/20 transition-all font-bold" />
                  </div>
               </div>
            </section>

            <section className="space-y-4">
               <div className="flex items-center justify-between px-2">
                 <h3 className="text-[16px] font-black text-[#00D658]">{t.emergencyTitle}</h3>
                 {editGuardians.length < 3 && (
                   <button onClick={addGuardian} className="text-[11px] font-black text-[#00D658] bg-[#EFFFF4] px-4 py-2 rounded-full squishy uppercase tracking-tighter">
                     + {t.addGuardian}
                   </button>
                 )}
               </div>
               <div className="space-y-4">
                  {editGuardians.map((c, i) => (
                    <div key={c.id} className="premium-card p-6 relative group">
                       {editGuardians.length > 1 && (
                         <button onClick={() => removeGuardian(c.id)} className="absolute top-4 right-4 text-slate-300 hover:text-rose-500 transition-colors">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/></svg>
                         </button>
                       )}
                       <div className="space-y-1">
                         <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">{t.email} #{i+1}</label>
                         <input type="email" value={c.email} onChange={e => { const n = [...editGuardians]; n[i].email = e.target.value; setEditGuardians(n); }} className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-2 border-transparent outline-none focus:border-[#00D658]/20 transition-all font-bold" />
                       </div>
                    </div>
                  ))}
               </div>
            </section>

            <div className="px-2 space-y-4">
              <button onClick={saveSettings} className="w-full py-5 rounded-[32px] bg-[#00D658] text-white font-black text-[18px] shadow-xl shadow-[#00D658]/20 squishy tracking-tight">{t.save}</button>
            </div>

            <div className="flex bg-slate-100 p-1 rounded-[24px] h-[64px] items-center mx-2">
                 <button onClick={() => setState(p => ({...p, language:'zh'}))} className={`flex-1 h-full rounded-[20px] font-black text-[14px] transition-all ${state.language === 'zh' ? 'bg-white text-[#00D658] shadow-sm' : 'text-slate-400'}`}>中文</button>
                 <button onClick={() => setState(p => ({...p, language:'en'}))} className={`flex-1 h-full rounded-[20px] font-black text-[14px] transition-all ${state.language === 'en' ? 'bg-white text-[#00D658] shadow-sm' : 'text-slate-400'}`}>EN</button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
