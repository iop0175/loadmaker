/**
 * Header Component
 * 게임 타이틀과 스탯 표시 (자금, 시간, 파괴)
 */

import React from 'react';
import type { Language } from '../../i18n';
import { getTranslations } from '../../i18n';

interface HeaderProps {
  score: number;
  gameTime: number;
  destroyedCount: number;
  language: Language;
  onLanguageChange: (lang: Language) => void;
}

export const Header: React.FC<HeaderProps> = ({
  score,
  gameTime,
  destroyedCount,
  language,
  onLanguageChange,
}) => {
  const t = getTranslations(language);
  
  return (
    <div className="w-full max-w-[1000px] flex justify-between items-end mb-6">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-4xl font-black text-slate-800 tracking-tighter mb-1">
            Load<span className="text-indigo-600">Maker</span>
          </h1>
          {/* Language Toggle */}
          <button
            onClick={() => onLanguageChange(language === 'en' ? 'ko' : 'en')}
            className="px-2 py-1 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors"
          >
            {language === 'en' ? '한국어' : 'English'}
          </button>
        </div>
        <p className="text-slate-500 font-medium tracking-tight">{t.subtitle}</p>
      </div>
      
      <div className="flex gap-4">
        {/* Stats: Money */}
        <div className="bg-white rounded-2xl px-5 py-3 shadow-sm border border-slate-200 flex flex-col justify-center min-w-[120px]">
          <div className="flex items-center gap-1.5 mb-1">
            <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-xs text-slate-400 font-bold tracking-wider">{t.money}</span>
          </div>
          <span className="text-2xl font-black text-emerald-600 tracking-tight leading-none">{score}</span>
        </div>

        {/* Stats: Time */}
        <div className="bg-white rounded-2xl px-5 py-3 shadow-sm border border-slate-200 flex flex-col justify-center min-w-[140px]">
          <div className="flex items-center gap-1.5 mb-1">
            <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-xs text-slate-400 font-bold tracking-wider">{t.time}</span>
          </div>
          <span className="text-2xl font-black text-indigo-600 tracking-tight leading-none">
            {Math.floor(gameTime / 60)}:{String(gameTime % 60).padStart(2, '0')}
          </span>
        </div>

        {/* Stats: Broken */}
        <div className="bg-white rounded-2xl px-5 py-3 shadow-sm border border-slate-200 flex flex-col justify-center min-w-[100px]">
          <div className="flex items-center gap-1.5 mb-1">
            <svg className="w-4 h-4 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span className="text-xs text-slate-400 font-bold tracking-wider">{t.destroyed}</span>
          </div>
          <span className={`text-2xl font-black tracking-tight leading-none ${destroyedCount > 0 ? 'text-rose-500' : 'text-slate-700'}`}>
            {destroyedCount}/3
          </span>
        </div>
      </div>
    </div>
  );
};
