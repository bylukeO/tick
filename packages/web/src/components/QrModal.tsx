import React from "react";
import { useWallet } from "../stores/wallet.store";

export const QrModal: React.FC = () => {
  const { activeQrTicket, setActiveQrTicket } = useWallet();

  if (!activeQrTicket) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-sm p-6 shadow-xl relative">
        <button
          onClick={() => setActiveQrTicket(null)}
          className="absolute top-3 right-3 text-slate-500 hover:text-slate-800 text-xl font-bold w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100"
        >
          ✕
        </button>

        <div className="text-center mb-4">
          <h3 className="text-lg font-bold text-slate-900 mt-1">{activeQrTicket.event?.name || "Event"}</h3>
          <p className="text-sm text-slate-600">{activeQrTicket.event?.venue}</p>
        </div>

        <div className="bg-white rounded-lg p-4 flex flex-col items-center justify-center mx-auto w-64 h-64 border border-slate-200 mb-4">
          {activeQrTicket.qrPng ? (
            <img src={activeQrTicket.qrPng} alt="Ticket barcode" className="w-full h-full object-contain" />
          ) : (
            <span className="text-xs text-slate-500">Unable to load ticket</span>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2 bg-slate-50 rounded-lg p-3 text-center mb-4 border border-slate-200">
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-500">Sec</div>
            <div className="text-base font-bold text-slate-900">{activeQrTicket.section}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-500">Row</div>
            <div className="text-base font-bold text-slate-900">{activeQrTicket.row}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-500">Seat</div>
            <div className="text-base font-bold text-slate-900">{activeQrTicket.seat}</div>
          </div>
        </div>

        <button
          onClick={() => setActiveQrTicket(null)}
          className="w-full bg-[#026cdf] hover:bg-[#0150a5] text-white font-semibold py-2.5 rounded text-sm"
          style={{ borderRadius: 4 }}
        >
          Close
        </button>
      </div>
    </div>
  );
};
