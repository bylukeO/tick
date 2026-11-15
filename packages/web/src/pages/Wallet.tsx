import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { apiRequest } from "../lib/api";
import { useAuth } from "../stores/auth.store";
import { useWallet, Ticket } from "../stores/wallet.store";
import { QrModal } from "../components/QrModal";
import { TransferModal } from "../components/TransferModal";

export const Wallet: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { setActiveQrTicket, setTransferTargetTicket } = useWallet();

  const { data, isLoading, refetch } = useQuery<{ tickets: Ticket[] }>({
    queryKey: ["wallet"],
    queryFn: () => apiRequest<{ tickets: Ticket[] }>("/api/tickets"),
    enabled: !!user,
  });

  if (!user) {
    return (
      <div className="max-w-md mx-auto text-center py-24 px-4">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Sign in to view your tickets</h2>
        <p className="text-sm text-slate-600 mb-6">Your tickets will appear here once you sign in.</p>
        <button
          onClick={() => navigate("/login")}
          className="bg-[#026cdf] hover:bg-[#0150a5] text-white font-semibold px-6 py-2.5 rounded text-sm"
          style={{ borderRadius: 4 }}
        >
          Sign In
        </button>
      </div>
    );
  }

  const tickets = data?.tickets || [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">My Tickets</h1>
        </div>
        <div className="mt-4 sm:mt-0">
          <Link
            to="/"
            className="text-sm bg-[#026cdf] hover:bg-[#0150a5] text-white px-4 py-2 rounded font-semibold"
            style={{ borderRadius: 4 }}
          >
            Find your next event
          </Link>
        </div>
      </div>

      {isLoading && <div className="py-24 text-center text-slate-500">Loading tickets...</div>}

      {tickets.length === 0 && !isLoading && (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center max-w-lg mx-auto">
          <h3 className="text-lg font-bold text-slate-900 mb-2">No tickets yet</h3>
          <p className="text-sm text-slate-600 mb-6">Find your next event and your tickets will show up here.</p>
          <Link
            to="/"
            className="inline-block bg-[#026cdf] hover:bg-[#0150a5] text-white font-semibold px-5 py-2.5 rounded text-sm"
            style={{ borderRadius: 4 }}
          >
            Find your next event
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tickets.map((ticket) => {
          const dateStr = ticket.event?.startsAt
            ? new Date(ticket.event.startsAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
            : "TBD";

          return (
            <div key={ticket.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm flex flex-col justify-between">
              <div className="p-5">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xs font-semibold text-[#026cdf] uppercase tracking-wide">{dateStr}</span>
                    <h3 className="text-lg font-bold text-slate-900 mt-1">{ticket.event?.name || "Event"}</h3>
                    <p className="text-sm text-slate-600">{ticket.event?.venue}</p>
                  </div>
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                    {ticket.status === "TRANSFER_PENDING" ? "Pending" : "Active"}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 bg-slate-50 rounded-lg p-3 my-5 text-center border border-slate-200">
                  <div>
                    <div className="text-[10px] uppercase font-bold text-slate-500">Sec</div>
                    <div className="text-lg font-bold text-slate-900">{ticket.section}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase font-bold text-slate-500">Row</div>
                    <div className="text-lg font-bold text-slate-900">{ticket.row}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase font-bold text-slate-500">Seat</div>
                    <div className="text-lg font-bold text-slate-900">{ticket.seat}</div>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center space-x-2">
                <button
                  onClick={() => setActiveQrTicket(ticket)}
                  className="flex-1 bg-[#026cdf] hover:bg-[#0150a5] text-white font-semibold py-2 px-3 rounded text-sm transition text-center"
                  style={{ borderRadius: 4 }}
                >
                  View Ticket
                </button>
                <button
                  onClick={() => setTransferTargetTicket(ticket)}
                  disabled={ticket.status === "TRANSFER_PENDING"}
                  className="flex-1 bg-white hover:bg-slate-100 disabled:opacity-40 text-slate-800 font-semibold py-2 px-3 rounded text-sm border border-slate-300 transition"
                  style={{ borderRadius: 4 }}
                >
                  Transfer
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <QrModal />
      <TransferModal onSuccess={() => refetch()} />
    </div>
  );
};
