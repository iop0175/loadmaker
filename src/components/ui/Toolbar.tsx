/**
 * Toolbar Component
 * 새 게임, 일시정지, 속도 조절 버튼 및 모드 표시
 */

import React from 'react';
import type { Language } from '../../i18n';
import { getTranslations } from '../../i18n';

interface ToolbarProps {
  isPaused: boolean;
  gameSpeed: number;
  isOrthoMode: boolean;
  isCurveMode: boolean;
  language: Language;
  onNewGame: () => void;
  onTogglePause: () => void;
  onToggleSpeed: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  isPaused,
  gameSpeed,
  isOrthoMode,
  isCurveMode,
  language,
  onNewGame,
  onTogglePause,
  onToggleSpeed,
}) => {
  const t = getTranslations(language);
  
  return (
    <div className="w-full max-w-[1000px] bg-white rounded-xl sm:rounded-2xl p-2 sm:p-2.5 shadow-sm border border-slate-200 mb-2 sm:mb-4 flex flex-row justify-between items-center gap-1 sm:gap-0">
      <div className="flex gap-2 sm:gap-2 flex-wrap justify-center">
        <button 
          onClick={onNewGame} 
          className="group flex items-center gap-1.5 sm:gap-2 px-4 sm:px-4 py-2.5 sm:py-2 bg-blue-600 text-white rounded-lg sm:rounded-xl font-bold text-base sm:text-sm hover:bg-blue-700 active:bg-blue-800 transition-all shadow-blue-200 hover:shadow-lg hover:-translate-y-0.5"
        >
          <svg className="w-5 h-5 sm:w-4 sm:h-4 group-hover:rotate-180 transition-transform duration-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span className="hidden sm:inline">{t.newGame}</span>
          <span className="sm:hidden">New</span>
        </button>
        
        <button 
          onClick={onTogglePause}
          className={`flex items-center gap-1.5 sm:gap-2 px-4 sm:px-4 py-2.5 sm:py-2 rounded-lg sm:rounded-xl font-bold text-base sm:text-sm transition-all border hover:shadow-md hover:-translate-y-0.5 ${
            isPaused 
              ? 'bg-amber-100 text-amber-700 border-amber-300 ring-2 ring-amber-200' 
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
          }`}
        >
          {isPaused ? (
            <>
              <svg className="w-5 h-5 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              </svg>
              <span className="hidden sm:inline">{t.resume}</span>
              <span className="sm:hidden">Play</span>
            </>
          ) : (
            <>
              <svg className="w-5 h-5 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 9v6m4-6v6" />
              </svg>
              <span className="hidden sm:inline">{t.pause}</span>
              <span className="sm:hidden">II</span>
            </>
          )}
        </button>
        
        <button 
          onClick={onToggleSpeed}
          className={`flex items-center gap-1.5 sm:gap-2 px-4 sm:px-4 py-2.5 sm:py-2 rounded-lg sm:rounded-xl font-bold text-base sm:text-sm transition-all border hover:shadow-md hover:-translate-y-0.5 ${
            gameSpeed === 2 
              ? 'bg-emerald-50 text-emerald-600 border-emerald-200 ring-2 ring-emerald-100' 
              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
          }`}
        >
          <svg className="w-5 h-5 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span>{gameSpeed === 2 ? '2x' : '1x'}</span>
          <span className="hidden sm:inline">{t.speed}</span>
        </button>
      </div>

      <div className="hidden sm:flex gap-6 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wide">
        <span className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-500 shadow-sm"></span> 
          {t.road}
        </span>
        <span className={`flex items-center gap-2 ${isOrthoMode ? 'text-blue-600' : ''}`}>
          <span className="w-2 h-2 rounded-full bg-indigo-500 shadow-sm"></span> 
          {t.straight}
        </span>
        <span className={`flex items-center gap-2 ${isCurveMode ? 'text-purple-600' : ''}`}>
          <span className="w-2 h-2 rounded-full bg-purple-500 shadow-sm"></span> 
          {t.curve}
        </span>
      </div>
    </div>
  );
};
