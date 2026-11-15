import React, { useState } from "react";
import { useWallet } from "../stores/wallet.store";
import { apiRequest } from "../lib/api";

interface TransferModalProps {
  onSuccess: () => void;
}

export const TransferModal: React.FC<TransferModalProps> = ({ onSuccess }) => {
  const { transferTargetTicket, setTransferTargetTicket } = useWallet();
  const [recipientEmail, setRecipientEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!transferTargetTicket) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      await apiRequest("/api/transfers", {
        method: "POST",
        body: JSON.stringify({
          ticketId: transferTargetTicket.id,
          toEmail: recipientEmail,
          password,
        }),
      });

      setTransferTargetTicket(null);
      onSuccess();
    } catch (err: any) {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md p-6 shadow-xl relative">
        <button
          onClick={() => setTransferTargetTicket(null)}
          className="absolute top-3 right-3 text-slate-500 hover:text-slate-800 text-xl font-bold w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100"
        >
          ✕
        </button>

        <div className="mb-4">
          <h3 className="text-xl font-bold text-slate-900">Transfer Tickets</h3>
          <p className="text-sm text-slate-600 mt-1">
            Sec {transferTargetTicket.section}, Row {transferTargetTicket.row}, Seat {transferTargetTicket.seat}
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded mb-4">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Recipient Email</label>
            <input
              type="email"
              required
              placeholder="Email address"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#026cdf]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-[#026cdf]"
            />
          </div>

          <div className="flex space-x-3 pt-2">
            <button
              type="button"
              onClick={() => setTransferTargetTicket(null)}
              className="flex-1 text-sm py-2.5 rounded bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 font-medium"
              style={{ borderRadius: 4 }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 text-sm py-2.5 rounded bg-[#026cdf] hover:bg-[#0150a5] disabled:opacity-50 text-white font-semibold transition"
              style={{ borderRadius: 4 }}
            >
              {isSubmitting ? "Sending..." : "Transfer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
