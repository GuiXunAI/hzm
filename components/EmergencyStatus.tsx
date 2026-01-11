import React from 'react';
import { TRANSLATIONS } from '../constants';
import { Language } from '../types';

interface Props {
  language: Language;
  hasCheckedInToday: boolean;
  streak: number;
}

const EmergencyStatus: React.FC<Props> = ({ language, hasCheckedInToday, streak }) => {
  const t = TRANSLATIONS[language];

  return (
    <div className="premium-card p-6 flex flex-col justify-between min-h-[150px] relative overflow-hidden group border-[#F0F0F0]">
      {/* Dynamic Glow Background */}
      <div className={`absolute -right-8 -top-8 w-32 h-32 rounded-full blur-[45px] transition-colors duration-1000 ${hasCheckedInToday ? 'bg-[#00D658]/10' : 'bg-[#FF4D4F]/10'}`}></div>
      
      <div className="flex items-start justify-between relative z-10">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-700 ${hasCheckedInToday ? 'bg-[#00D658] text-white shadow-lg shadow-[#00D658]/20' : 'bg-[#FF4D4F] text-white shadow-lg shadow-[#FF4D4F]/20'}`}>
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" />
          </svg>
        </div>
        
        <div className="text-right">
          <span className="text-[10px] font-black text-black/10 uppercase tracking-widest">{t.streakText}</span>
          <div className="flex items-baseline justify-end gap-1 mt-0.5">
            <span className="text-[28px] font-black tracking-tighter leading-none">{streak}</span>
            <span className="text-[11px] font-bold text-[#00D658] uppercase">{t.consecutiveDays}</span>
          </div>
        </div>
      </div>

      <div className="mt-4 relative z-10">
        <div className="flex flex-col">
          <span className="text-[10px] font-black text-black/10 uppercase tracking-widest mb-1.5">{t.statusCheck}</span>
          <div className="flex items-center gap-2">
             <div className={`w-2 h-2 rounded-full ${hasCheckedInToday ? 'bg-[#00D658]' : 'bg-[#FF4D4F] animate-pulse'}`}></div>
             <h3 className={`font-black text-[22px] tracking-tight ${hasCheckedInToday ? 'text-slate-800' : 'text-[#FF4D4F]'}`}>
               {hasCheckedInToday ? t.statusSafe : t.statusPending}
             </h3>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmergencyStatus;