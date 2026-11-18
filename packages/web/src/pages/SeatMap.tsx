import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../lib/api";
import { useAuth } from "../stores/auth.store";
import { useWallet } from "../stores/wallet.store";

interface ClaimedSeat {
  ticketId: string;
  section: string;
  row: string;
  seat: string;
  status: string;
  ownerId: string;
}

interface EventDetailResponse {
  event: {
    id: string;
    name: string;
    venue: string;
    startsAt: string;
    seatMap: Record<string, Record<string, string[]>>;
  };
  claimedSeats: ClaimedSeat[];
}

export const SeatMap: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { setActiveQrTicket } = useWallet();

  const [selectedSeat, setSelectedSeat] = useState<{
    section: string;
    row: string;
    seat: string;
  } | null>(null);
  const [claimPassword, setClaimPassword] = useState("");

  const { data, isLoading, error } = useQuery<EventDetailResponse>({
    queryKey: ["event", id],
    queryFn: () => apiRequest<EventDetailResponse>(`/api/events/${id}`),
    enabled: !!id,
  });

  const claimMutation = useMutation({
    mutationFn: (seatInfo: { section: string; row: string; seat: string; password: string }) =>
      apiRequest<{ ticket: any; qrPng: string }>("/api/tickets/claim", {
        method: "POST",
        body: JSON.stringify({
          eventId: id,
          section: seatInfo.section,
          row: seatInfo.row,
          seat: seatInfo.seat,
          password: seatInfo.password,
        }),
      }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["event", id] });
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      setActiveQrTicket({
        ...result.ticket,
        qrPng: result.qrPng,
        event: data?.event,
      });
      setClaimPassword("");
      navigate("/wallet");
    },
  });

  if (isLoading) {
    return <div className="py-24 text-center text-slate-400">Loading seat map...</div>;
  }

  if (error || !data) {
    return (
      <div className="max-w-4xl mx-auto p-8 text-center text-rose-300">
        Something went wrong. Please try again.
      </div>
    );
  }

  const { event, claimedSeats } = data;
  const claimedSet = new Set(claimedSeats.map((s) => `${s.section}-${s.row}-${s.seat}`));

  const sections = Object.keys(event.seatMap || {});

  const handleSeatClick = (section: string, row: string, seat: string) => {
    const key = `${section}-${row}-${seat}`;
    if (claimedSet.has(key)) return;

    if (
      selectedSeat?.section === section &&
      selectedSeat?.row === row &&
      selectedSeat?.seat === seat
    ) {
      setSelectedSeat(null);
    } else {
      setSelectedSeat({ section, row, seat });
    }
  };

  const handleClaim = () => {
    if (!user) {
      navigate("/login");
      return;
    }
    if (selectedSeat) {
      claimMutation.mutate({ ...selectedSeat, password: claimPassword });
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <span className="text-xs font-semibold uppercase text-indigo-600 tracking-wider">
            Interactive Seat Selection
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-950 mt-1">{event.name}</h1>
          <p className="text-sm text-slate-500">{event.venue}</p>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center space-x-2">
            <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
            <span className="text-slate-600">Available</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-3 h-3 rounded-full bg-blue-500"></span>
            <span className="text-slate-300">Selected</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-3 h-3 rounded-full bg-slate-600"></span>
            <span className="text-slate-400">Claimed</span>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 overflow-x-auto shadow-sm flex flex-col items-center">
        <div className="w-full min-w-[320px] max-w-2xl bg-gradient-to-b from-indigo-100 to-transparent border-t-4 border-indigo-500 rounded-t-3xl py-3 text-center mb-8">
          <span className="text-xs font-black tracking-widest uppercase text-indigo-700">
            STAGE / PERFORMANCE AREA
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
          {sections.map((section) => {
            const rowMap = event.seatMap[section];
            const rows = Object.keys(rowMap || {});

            return (
              <div
                key={section}
                className="bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-5 flex flex-col items-center"
              >
                <div className="text-sm font-bold text-slate-700 mb-4 tracking-wider">
                  SECTION {section}
                </div>

                <div className="space-y-3">
                  {rows.map((row) => {
                    const seats = rowMap[row] || [];
                    return (
                      <div key={row} className="flex items-center space-x-2">
                        <span className="text-[10px] font-mono text-slate-500 w-4 text-right">
                          {row}
                        </span>
                        <div className="flex space-x-1.5">
                          {seats.map((seat) => {
                            const isClaimed = claimedSet.has(`${section}-${row}-${seat}`);
                            const isSelected =
                              selectedSeat?.section === section &&
                              selectedSeat?.row === row &&
                              selectedSeat?.seat === seat;

                            let btnClass = "bg-emerald-500 hover:bg-emerald-600 text-white cursor-pointer";
                            if (isClaimed) {
                              btnClass = "bg-slate-200 text-slate-400 cursor-not-allowed";
                            } else if (isSelected) {
                              btnClass = "bg-indigo-600 ring-2 ring-indigo-200 text-white font-bold";
                            }

                            return (
                              <button
                                key={seat}
                                disabled={isClaimed}
                                onClick={() => handleSeatClick(section, row, seat)}
                                title={`Sec ${section}, Row ${row}, Seat ${seat}`}
                                className={`w-7 h-7 rounded-md text-[11px] font-semibold flex items-center justify-center transition ${btnClass}`}
                              >
                                {seat}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {selectedSeat && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-30 w-[calc(100%-2rem)] max-w-xl bg-white border border-slate-200 rounded-2xl shadow-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium text-slate-500">Selected seat</div>
            <div className="text-sm font-bold text-slate-950">
              Sec {selectedSeat.section}, Row {selectedSeat.row}, Seat {selectedSeat.seat}
            </div>
            <input
              type="password"
              autoComplete="current-password"
              value={claimPassword}
              onChange={(event) => setClaimPassword(event.target.value)}
              placeholder="Confirm with your password"
              aria-label="Account password to confirm ticket claim"
              className="mt-2 min-h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10"
            />
          </div>
          <button
            onClick={handleClaim}
            disabled={claimMutation.isPending || !claimPassword}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold px-6 py-2.5 rounded-xl text-sm transition"
          >
            {claimMutation.isPending ? "Claiming..." : "Claim Ticket"}
          </button>
        </div>
      )}

      {claimMutation.isError && (
        <div className="fixed bottom-40 md:bottom-24 left-1/2 -translate-x-1/2 z-30 bg-rose-50 border border-rose-200 text-rose-700 px-4 py-2 rounded-xl text-xs">
          {(claimMutation.error as any)?.message || "Claim failed"}
        </div>
      )}
    </div>
  );
};
