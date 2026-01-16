/**
 * Shop Component
 * 아이템 구매 상점 (다리, 고속도로) - 심플한 디자인
 */

import React from 'react';
import type { Language } from '../../i18n';
import { getTranslations } from '../../i18n';

interface ShopItem {
  id: 'bridge' | 'highway';
  name: string;
  price: number;
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
    { id: 'bridge', name: t.bridge, price: 500, count: bridgeCount },
    { id: 'highway', name: t.highway, price: 300, count: highwayCount },
  ];

  const handleBuy = (item: ShopItem) => {
    if (score >= item.price) {
      onBuy(item.id, item.price);
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl shadow-xl w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-800">{t.shop}</h2>
          <div className="flex items-center gap-3">
            <span className="text-lg text-emerald-600 font-bold">${score}</span>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full hover:bg-slate-100 flex items-center justify-center transition-colors"
            >
              <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Items */}
        <div className="p-4 space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between p-4 bg-slate-50 rounded-xl"
            >
              <div className="flex-1">
                <div className="text-base font-bold text-slate-700">{item.name}</div>
                <div className="text-sm text-slate-400">
                  {language === 'ko' ? '보유' : 'Owned'}: {item.count}
                </div>
              </div>
              <button
                onClick={() => handleBuy(item)}
                disabled={score < item.price}
                className={`min-w-[80px] px-5 py-3 rounded-xl font-bold text-base transition-all active:scale-95 ${
                  score >= item.price
                    ? 'bg-slate-800 text-white hover:bg-slate-700'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                ${item.price}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
