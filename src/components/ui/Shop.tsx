/**
 * Shop Component
 * 아이템 구매 상점 (다리, 고속도로)
 */

import React from 'react';
import type { Language } from '../../i18n';
import { getTranslations } from '../../i18n';

interface ShopItem {
  id: 'bridge' | 'highway';
  name: string;
  price: number;
  icon: React.ReactNode;
  count: number;
}

interface ShopProps {
  isOpen: boolean;
  onClose: () => void;
  score: number;
  bridgeCount: number;
  highwayCount: number;
  language: Language;
  onBuy: (item: 'bridge' | 'highway', price: number) => void;
}

export const Shop: React.FC<ShopProps> = ({
  isOpen,
  onClose,
  score,
  bridgeCount,
  highwayCount,
  language,
  onBuy,
}) => {
  const t = getTranslations(language);

  if (!isOpen) return null;

  const items: ShopItem[] = [
    {
      id: 'bridge',
      name: t.bridge,
      price: 500,
      count: bridgeCount,
      icon: (
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 20h16M4 12h16" />
        </svg>
      ),
    },
    {
      id: 'highway',
      name: t.highway,
      price: 300,
      count: highwayCount,
      icon: (
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
        </svg>
      ),
    },
  ];

  const handleBuy = (item: ShopItem) => {
    if (score >= item.price) {
      onBuy(item.id, item.price);
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-4 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-800">{t.shop}</h2>
          <div className="flex items-center gap-2">
            <span className="text-emerald-600 font-bold text-lg">${score}</span>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
            >
              <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Items */}
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between p-3 sm:p-4 bg-slate-50 rounded-xl border-2 border-slate-200"
            >
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  item.id === 'bridge' ? 'bg-amber-100 text-amber-600' :
                  item.id === 'highway' ? 'bg-blue-100 text-blue-600' :
                  'bg-green-100 text-green-600'
                }`}>
                  {item.icon}
                </div>
                <div>
                  <div className="font-bold text-slate-800">{item.name}</div>
                  <div className="text-sm text-slate-500">
                    {language === 'ko' ? '보유' : 'Owned'}: {item.count}
                  </div>
                </div>
              </div>
              <button
                onClick={() => handleBuy(item)}
                disabled={score < item.price}
                className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                  score >= item.price
                    ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-200'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                ${item.price}
              </button>
            </div>
          ))}
        </div>

        {/* Not enough money warning */}
        {score < 200 && (
          <div className="mt-4 text-center text-sm text-rose-500">
            {t.notEnoughMoney}
          </div>
        )}
      </div>
    </div>
  );
};
