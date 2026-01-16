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
    <div className="w-full max-w-[1000px] flex flex-col sm:flex-row justify-between items-center sm:items-end mb-3 sm:mb-6 gap-2 sm:gap-0 pt-safe safe-top-margin">
      <div className="text-center sm:text-left">
        <div className="flex items-center justify-center sm:justify-start gap-2 sm:gap-3">
          <h1 className="text-2xl sm:text-4xl font-black text-slate-800 tracking-tighter mb-0.5 sm:mb-1">
            Load<span className="text-indigo-600">Maker</span>
          </h1>
          {/* Language Toggle */}
          <button
            onClick={() => onLanguageChange(language === 'en' ? 'ko' : 'en')}
            className="px-1.5 sm:px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-md sm:rounded-lg transition-colors"
          >
            {language === 'en' ? '한국어' : 'EN'}
          </button>
        </div>
        <p className="text-slate-500 font-medium tracking-tight text-xs sm:text-base hidden sm:block">{t.subtitle}</p>
      </div>
      
      <div className="flex gap-2 sm:gap-4">
        {/* Stats: Money */}
        <div className="bg-gradient-to-br from-emerald-50 to-white rounded-xl sm:rounded-2xl px-3 sm:px-5 py-2 sm:py-3 shadow-md border-2 border-emerald-200 flex flex-col justify-center min-w-[70px] sm:min-w-[130px]">
          <div className="flex items-center gap-1.5 mb-1">
            <svg className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-[10px] sm:text-xs text-emerald-600 font-bold tracking-wider">{t.money}</span>
          </div>
          <span className="text-xl sm:text-3xl font-black text-emerald-600 tracking-tight leading-none">{score}</span>
        </div>

        {/* Stats: Time */}
        <div className="bg-gradient-to-br from-indigo-50 to-white rounded-xl sm:rounded-2xl px-3 sm:px-5 py-2 sm:py-3 shadow-md border-2 border-indigo-200 flex flex-col justify-center min-w-[70px] sm:min-w-[140px]">
          <div className="flex items-center gap-1.5 mb-1">
            <svg className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-[10px] sm:text-xs text-indigo-600 font-bold tracking-wider">{t.time}</span>
          </div>
          <span className="text-xl sm:text-3xl font-black text-indigo-600 tracking-tight leading-none">
            {Math.floor(gameTime / 60)}:{String(gameTime % 60).padStart(2, '0')}
          </span>
        </div>

        {/* Stats: Broken */}
        <div className={`bg-gradient-to-br rounded-xl sm:rounded-2xl px-3 sm:px-5 py-2 sm:py-3 shadow-md border-2 flex flex-col justify-center min-w-[60px] sm:min-w-[110px] ${
          destroyedCount >= 2 
            ? 'from-rose-100 to-white border-rose-300 animate-pulse' 
            : destroyedCount > 0 
              ? 'from-rose-50 to-white border-rose-200' 
              : 'from-slate-50 to-white border-slate-200'
        }`}>
          <div className="flex items-center gap-1.5 mb-1">
            <svg className={`w-4 h-4 sm:w-5 sm:h-5 ${destroyedCount > 0 ? 'text-rose-500' : 'text-slate-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span className={`text-[10px] sm:text-xs font-bold tracking-wider ${destroyedCount > 0 ? 'text-rose-600' : 'text-slate-500'}`}>{t.destroyed}</span>
          </div>
          <span className={`text-xl sm:text-3xl font-black tracking-tight leading-none ${
            destroyedCount >= 2 ? 'text-rose-600' : destroyedCount > 0 ? 'text-rose-500' : 'text-slate-700'
          }`}>
            {destroyedCount}/3
          </span>
        </div>
      </div>
    </div>
  );
};
