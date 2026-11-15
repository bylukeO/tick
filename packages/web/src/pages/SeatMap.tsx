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

  const { data, isLoading, error } = useQuery<EventDetailResponse>({
    queryKey: ["event", id],
    queryFn: () => apiRequest<EventDetailResponse>(`/api/events/${id}`),
    enabled: !!id,
  });

  const claimMutation = useMutation({
    mutationFn: (seatInfo: { section: string; row: string; seat: string }) =>
      apiRequest<{ ticket: any; qrPng: string }>("/api/tickets/claim", {
        method: "POST",
        body: JSON.stringify({
          eventId: id,
          section: seatInfo.section,
          row: seatInfo.row,
          seat: seatInfo.seat,
          password: (window.prompt("Enter your password to confirm") || ""),
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
      claimMutation.mutate(selectedSeat);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <span className="text-xs font-semibold uppercase text-blue-400 tracking-wider">
            Interactive Seat Selection
          </span>
          <h1 className="text-3xl font-extrabold text-white mt-1">{event.name}</h1>
          <p className="text-sm text-slate-400">{event.venue}</p>
        </div>

        <div className="flex items-center space-x-6 text-xs bg-slate-800/80 p-3 rounded-xl border border-slate-700">
          <div className="flex items-center space-x-2">
            <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
            <span className="text-slate-300">Available</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-3 h-3 rounded-full bg-blue-500"></span>
            <span className="text-slate-300">Selected</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-3 h-3 rounded-full bg-slate-600"></span>
            <span className="text-slate-500">Claimed</span>
          </div>
        </div>
      </div>

      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 overflow-x-auto shadow-2xl flex flex-col items-center">
        <div className="w-full max-w-2xl bg-gradient-to-b from-blue-900/40 to-transparent border-t-4 border-blue-500 rounded-t-3xl py-3 text-center mb-8">
          <span className="text-xs font-black tracking-widest uppercase text-blue-300">
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
                className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 flex flex-col items-center"
              >
                <div className="text-sm font-bold text-slate-300 mb-4 tracking-wider">
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

                            let btnClass = "bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer";
                            if (isClaimed) {
                              btnClass = "bg-slate-700/60 text-slate-500 cursor-not-allowed opacity-40";
                            } else if (isSelected) {
                              btnClass = "bg-blue-500 ring-2 ring-white text-white font-bold";
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
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-4 flex items-center space-x-6">
          <div>
            <div className="text-xs text-slate-400">Selected Reservation</div>
            <div className="text-sm font-bold text-white">
              Sec {selectedSeat.section}, Row {selectedSeat.row}, Seat {selectedSeat.seat}
            </div>
          </div>
          <button
            onClick={handleClaim}
            disabled={claimMutation.isPending}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold px-6 py-2.5 rounded-xl text-sm transition"
          >
            {claimMutation.isPending ? "Claiming..." : "Claim Ticket"}
          </button>
        </div>
      )}

      {claimMutation.isError && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-30 bg-rose-950 border border-rose-800 text-rose-300 px-4 py-2 rounded-xl text-xs">
          {(claimMutation.error as any)?.message || "Claim failed"}
        </div>
      )}
    </div>
  );
};
