import React, { useState } from 'react';
import { Language } from '../types';
import { POLICIES } from '../constants';

interface Props {
  onComplete: (lang: Language, userName: string, guardianEmail: string) => void;
}

const DecorationSmiley = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 340 340" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="170" cy="170" r="160" stroke="#00D658" strokeWidth="20" strokeOpacity="0.08" />
    <rect x="110" y="110" width="30" height="60" rx="15" fill="#00D658" fillOpacity="0.08" />
    <rect x="200" y="110" width="30" height="60" rx="15" fill="#00D658" fillOpacity="0.08" />
    <path d="M80 210C80 210 110 260 170 260C230 260 260 210 260 210" stroke="#00D658" strokeWidth="20" strokeLinecap="round" strokeOpacity="0.08" />
  </svg>
);

const AppLogoBlock = () => (
  <div className="flex items-center gap-3">
    <div className="w-14 h-14 bg-[#00D658] rounded-xl flex items-center justify-center overflow-hidden">
       <svg width="34" height="34" viewBox="0 0 100 100" fill="none">
          <rect x="25" y="25" width="10" height="20" rx="5" fill="white" />
          <rect x="65" y="25" width="10" height="20" rx="5" fill="white" />
          <path d="M20 60C20 60 35 80 50 80C65 80 80 60 80 60" stroke="white" strokeWidth="8" strokeLinecap="round" />
       </svg>
    </div>
    <div className="flex flex-col">
      <h1 className="text-[28px] font-black text-[#00D658] leading-tight">活着么</h1>
      <p className="text-[12px] font-bold text-[#00D658] opacity-80">温暖守护你的每一天</p>
    </div>
  </div>
);

const Onboarding: React.FC<Props> = ({ onComplete }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [showPolicy, setShowPolicy] = useState<'none' | 'agreement' | 'privacy'>('none');

  const handleFinish = () => {
    if (!agreed) {
      setError('请阅读并勾选协议');
      return;
    }
    if (!name.trim()) {
      setError('称呼不能为空');
      return;
    }
    if (!email.includes('@')) {
      setError('邮箱格式不正确');
      return;
    }
    onComplete('zh', name.trim(), email.trim());
  };

  return (
    <div className="fixed inset-0 bg-[#FFFFFF] flex flex-col items-center justify-center z-[300] overflow-hidden select-none">
      <DecorationSmiley className="absolute -top-10 -right-20 w-80 h-80 rotate-12" />
      <DecorationSmiley className="absolute -bottom-20 -left-10 w-[450px] h-[450px] -rotate-12" />
      <div className="absolute top-0 right-0 w-full h-1/2 bg-gradient-to-b from-[#EFFFF4] to-transparent opacity-60"></div>

      <div className="w-full max-w-[360px] px-8 z-10 flex flex-col items-center">
        <div className="mb-20 w-full flex justify-start">
          <AppLogoBlock />
        </div>

        <div className="w-full space-y-5 mb-10">
          <input 
            type="text" 
            placeholder="请输入您的姓名"
            value={name} 
            onChange={e => { setName(e.target.value); setError(null); }} 
            className="pill-input"
          />
          <input 
            type="email" 
            placeholder="请输入紧急联系人邮箱"
            value={email} 
            onChange={e => { setEmail(e.target.value); setError(null); }} 
            className="pill-input"
          />
        </div>

        <div className="mb-12 w-full flex flex-col items-center">
          <label className="flex items-center gap-2 cursor-pointer group">
            <input 
              type="checkbox" 
              checked={agreed} 
              onChange={() => { setAgreed(!agreed); setError(null); }} 
              className="sr-only"
            />
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${agreed ? 'bg-[#00D658] border-[#00D658]' : 'border-slate-200'}`}>
              {agreed && <div className="w-2 h-2 rounded-full bg-white" />}
            </div>
            <p className="text-[13px] font-medium text-slate-400 whitespace-nowrap">
              我已阅读并同意<span onClick={(e) => {e.stopPropagation(); setShowPolicy('agreement')}} className="text-[#00D658]">《用户协议》</span>及<span onClick={(e) => {e.stopPropagation(); setShowPolicy('privacy')}} className="text-[#00D658]">《隐私政策》</span>
            </p>
          </label>
          {error && <p className="mt-4 text-[12px] font-bold text-rose-500 animate-bounce">{error}</p>}
        </div>

        <button 
          onClick={handleFinish} 
          className="w-full py-6 rounded-full bg-[#00D658] text-white font-black text-[28px] shadow-xl shadow-[#00D658]/20 squishy tracking-widest"
        >
          开启守护
        </button>
      </div>

      {showPolicy !== 'none' && (
        <div className="fixed inset-0 z-[400] bg-black/30 backdrop-blur-md flex items-center justify-center p-8 animate-in fade-in duration-300">
           <div className="bg-white rounded-[40px] px-8 py-10 w-full max-w-[340px] shadow-2xl flex flex-col border border-white">
              <h3 className="text-[20px] font-black text-[#00D658] mb-6">
                {showPolicy === 'agreement' ? '用户协议' : '隐私政策'}
              </h3>
              <div className="h-80 overflow-y-auto pr-2 no-scrollbar mb-8 text-[14px] font-medium text-slate-400 leading-relaxed whitespace-pre-wrap">
                {showPolicy === 'agreement' ? POLICIES.zh.userAgreement : POLICIES.zh.privacyPolicy}
              </div>
              <button onClick={() => setShowPolicy('none')} className="w-full py-4 bg-slate-50 rounded-full font-bold text-slate-800 squishy">知道了</button>
           </div>
        </div>
      )}
    </div>
  );
};

export default Onboarding;