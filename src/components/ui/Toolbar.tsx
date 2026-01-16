/**
 * Toolbar Component
 * 새 게임, 빌드 모드, 속도 조절 버튼 및 모드 표시
 */

import React from 'react';
import type { Language } from '../../i18n';
import { getTranslations } from '../../i18n';

interface ToolbarProps {
  isBuildMode: boolean;
  gameSpeed: number;
  isOrthoMode: boolean;
  isCurveMode: boolean;
  language: Language;
  onNewGame: () => void;
  onToggleBuildMode: () => void;
  onToggleSpeed: () => void;
  onOpenShop: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  isBuildMode,
  gameSpeed,
  isOrthoMode,
  isCurveMode,
  language,
  onNewGame,
  onToggleBuildMode,
  onToggleSpeed,
  onOpenShop,
}) => {
  const t = getTranslations(language);
  
  return (
    <div className="w-full max-w-[1000px] bg-white rounded-xl sm:rounded-2xl p-2.5 sm:p-3 shadow-md border-2 border-slate-200 mb-2 sm:mb-4 flex flex-row justify-between items-center gap-2 sm:gap-0 safe-top-margin">
      <div className="flex gap-2 sm:gap-3 flex-wrap justify-center">
        <button 
          onClick={onNewGame} 
          className="group flex items-center gap-2 px-4 sm:px-5 py-3 sm:py-2.5 bg-blue-600 text-white rounded-xl font-bold text-base sm:text-sm hover:bg-blue-700 active:bg-blue-800 transition-all shadow-lg shadow-blue-200 hover:shadow-xl hover:-translate-y-0.5 border-2 border-blue-500"
        >
          <svg className="w-5 h-5 group-hover:rotate-180 transition-transform duration-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span className="hidden sm:inline">{t.newGame}</span>
          <span className="sm:hidden">New</span>
        </button>
        
        {/* 빌드 모드 토글 버튼 */}
        <button 
          onClick={onToggleBuildMode}
          className={`flex items-center gap-2 px-4 sm:px-5 py-3 sm:py-2.5 rounded-xl font-bold text-base sm:text-sm transition-all border-2 hover:shadow-lg hover:-translate-y-0.5 ${
            isBuildMode 
              ? 'bg-orange-500 text-white border-orange-600 ring-2 ring-orange-200 shadow-orange-200 shadow-lg animate-pulse' 
              : 'bg-emerald-500 text-white border-emerald-600 hover:bg-emerald-600 shadow-emerald-200 shadow-lg'
          }`}
        >
          {isBuildMode ? (
            <>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{t.playMode}</span>
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
              <span>{t.buildMode}</span>
            </>
          )}
        </button>
        
        <button 
          onClick={onToggleSpeed}
          className={`flex items-center gap-2 px-4 sm:px-5 py-3 sm:py-2.5 rounded-xl font-bold text-base sm:text-sm transition-all border-2 hover:shadow-lg hover:-translate-y-0.5 ${
            gameSpeed === 2 
              ? 'bg-emerald-100 text-emerald-700 border-emerald-400 ring-2 ring-emerald-200 shadow-emerald-100 shadow-lg' 
              : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50 hover:border-slate-400'
          }`}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span className="font-black">{gameSpeed === 2 ? '2x' : '1x'}</span>
          <span className="hidden sm:inline">{t.speed}</span>
        </button>
        
        {/* Shop Button - 빌드 모드에서만 표시 */}
        {isBuildMode && (
          <button 
            onClick={onOpenShop}
            className="flex items-center gap-2 px-4 sm:px-5 py-3 sm:py-2.5 rounded-xl font-bold text-base sm:text-sm transition-all border-2 hover:shadow-lg hover:-translate-y-0.5 bg-amber-100 text-amber-700 border-amber-400 hover:bg-amber-200"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <span className="hidden sm:inline">{t.shop}</span>
          </button>
        )}
      </div>

      <div className="hidden sm:flex gap-6 px-4 text-xs font-bold text-slate-500 uppercase tracking-wide">
        <span className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-blue-500 shadow-sm"></span> 
          {t.road}
        </span>
        <span className={`flex items-center gap-2 ${isOrthoMode ? 'text-blue-600' : ''}`}>
          <span className="w-3 h-3 rounded-full bg-indigo-500 shadow-sm"></span> 
          {t.straight}
        </span>
        <span className={`flex items-center gap-2 ${isCurveMode ? 'text-purple-600' : ''}`}>
          <span className="w-3 h-3 rounded-full bg-purple-500 shadow-sm"></span> 
          {t.curve}
        </span>
      </div>
    </div>
  );
};
