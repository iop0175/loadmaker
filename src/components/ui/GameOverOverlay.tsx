/**
 * GameOverOverlay Component
 * 게임 오버 화면
 */

import React from 'react';
import type { Language } from '../../i18n';
import { getTranslations } from '../../i18n';

interface GameOverOverlayProps {
  score: number;
  gameTime: number;
  destroyedCount: number;
  language: Language;
  onPlayAgain: () => void;
}

export const GameOverOverlay: React.FC<GameOverOverlayProps> = ({
  score,
  gameTime,
  destroyedCount,
  language,
  onPlayAgain,
}) => {
  const t = getTranslations(language);
  
  return (
    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-white rounded-3xl p-8 shadow-2xl text-center max-w-md w-full border border-slate-200 animate-bounce-in">
        <div className="w-20 h-20 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-6 text-rose-500">
          <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-3xl font-black text-slate-800 mb-2 tracking-tight">{t.gameOver}</h2>
        <p className="text-slate-500 mb-8 font-medium">Critical Infrastructure Failure</p>
        
        <div className="bg-slate-50 rounded-2xl p-6 mb-8 border border-slate-100">
          <p className="text-xs text-slate-400 uppercase font-extrabold tracking-widest mb-2">{t.survivalTime}</p>
          <p className="text-5xl font-black text-indigo-600 tracking-tighter mb-4">
            {Math.floor(gameTime / 60)}<span className="text-2xl text-indigo-300 font-bold ml-1">m</span> {gameTime % 60}<span className="text-2xl text-indigo-300 font-bold ml-1">s</span>
          </p>
          
          <div className="flex justify-center gap-4 mb-4">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-sm font-bold border border-emerald-100">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {t.finalScore}: {score}
            </div>
          </div>
          
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-rose-50 text-rose-600 rounded-lg text-sm font-bold border border-rose-100">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            {t.buildingsDestroyed}: {destroyedCount}
          </div>
        </div>
        
        <button 
          onClick={onPlayAgain}
          className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold text-lg hover:bg-indigo-700 active:transform active:scale-95 transition-all shadow-xl shadow-indigo-200"
        >
          {t.playAgain}
        </button>
      </div>
    </div>
  );
};
