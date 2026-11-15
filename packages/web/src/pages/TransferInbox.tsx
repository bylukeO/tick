import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "../lib/api";
import { useAuth } from "../stores/auth.store";
import { useTransfers, TransferRecord } from "../stores/transfers.store";

export const TransferInbox: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { filter, setFilter } = useTransfers();
  const [password, setPassword] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{
    incoming: TransferRecord[];
    outgoing: TransferRecord[];
  }>({
    queryKey: ["transfers"],
    queryFn: () =>
      apiRequest<{ incoming: TransferRecord[]; outgoing: TransferRecord[] }>("/api/transfers"),
    enabled: !!user,
  });

  const acceptMutation = useMutation({
    mutationFn: (transferId: string) =>
      apiRequest(`/api/transfers/${transferId}/accept`, {
        method: "POST",
        body: JSON.stringify({ password }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transfers"] });
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      setProcessingId(null);
      setPassword("");
    },
    onError: () => setProcessingId(null),
  });

  const revokeMutation = useMutation({
    mutationFn: (transferId: string) =>
      apiRequest(`/api/transfers/${transferId}/revoke`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transfers"] });
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      setProcessingId(null);
    },
    onError: () => setProcessingId(null),
  });

  if (!user) {
    return (
      <div className="max-w-md mx-auto text-center py-24 px-4">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Transfers</h2>
        <p className="text-sm text-slate-600 mb-6">Sign in to view your transfers.</p>
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

  const incoming = data?.incoming || [];
  const outgoing = data?.outgoing || [];

  let displayedTransfers: Array<TransferRecord & { direction: "in" | "out" }> = [];
  if (filter === "incoming" || filter === "all") {
    displayedTransfers.push(...incoming.map((t) => ({ ...t, direction: "in" as const })));
  }
  if (filter === "outgoing" || filter === "all") {
    displayedTransfers.push(...outgoing.map((t) => ({ ...t, direction: "out" as const })));
  }

  displayedTransfers.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const handleAccept = (id: string) => {
    if (!password) return;
    setProcessingId(id);
    acceptMutation.mutate(id);
  };

  const handleRevoke = (id: string) => {
    setProcessingId(id);
    revokeMutation.mutate(id);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Transfers</h1>
        </div>

        <div className="flex items-center space-x-2 mt-4 sm:mt-0 bg-white p-1 rounded border border-slate-200">
          {(["all", "incoming", "outgoing"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-3 py-1.5 rounded text-sm font-semibold capitalize transition ${
                filter === tab ? "bg-[#026cdf] text-white" : "text-slate-600 hover:text-slate-900"
              }`}
              style={{ borderRadius: 4 }}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {isLoading && <div className="py-24 text-center text-slate-500">Loading transfers...</div>}

      {displayedTransfers.length === 0 && !isLoading && (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center max-w-lg mx-auto">
          <h3 className="text-lg font-bold text-slate-900 mb-2">No transfers yet</h3>
          <p className="text-sm text-slate-600">Tickets you send or receive will appear here.</p>
        </div>
      )}

      {incoming.some((t) => t.status === "PENDING") && (
        <div className="mb-4 max-w-sm">
          <label className="block text-sm font-medium text-slate-700 mb-1">Password to accept tickets</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-[#026cdf]"
          />
        </div>
      )}

      <div className="space-y-4">
        {displayedTransfers.map((item) => {
          const isPending = item.status === "PENDING";
          const isIncoming = item.direction === "in";

          return (
            <div
              key={item.id}
              className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                    {isIncoming ? "Received" : "Sent"}
                  </span>
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                    {item.status === "ACCEPTED" ? "Accepted" : item.status === "PENDING" ? "Pending" : item.status}
                  </span>
                  <span className="text-xs text-slate-500">{new Date(item.createdAt).toLocaleString()}</span>
                </div>

                <div className="text-sm text-slate-900 font-medium">
                  {isIncoming ? (
                    <span>From <strong>{item.fromUser?.email}</strong></span>
                  ) : (
                    <span>To <strong>{item.toUser?.email}</strong></span>
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-3 pt-2 md:pt-0 border-t md:border-t-0 border-slate-200">
                {isPending && isIncoming && (
                  <button
                    onClick={() => handleAccept(item.id)}
                    disabled={processingId === item.id || !password}
                    className="text-sm bg-[#026cdf] hover:bg-[#0150a5] disabled:opacity-50 text-white font-semibold px-4 py-2 rounded transition"
                    style={{ borderRadius: 4 }}
                  >
                    {processingId === item.id ? "Accepting..." : "Accept Tickets"}
                  </button>
                )}

                {isPending && !isIncoming && (
                  <button
                    onClick={() => handleRevoke(item.id)}
                    disabled={processingId === item.id}
                    className="text-sm bg-white hover:bg-slate-100 disabled:opacity-50 text-slate-800 font-semibold px-4 py-2 rounded border border-slate-300 transition"
                    style={{ borderRadius: 4 }}
                  >
                    {processingId === item.id ? "Canceling..." : "Cancel Transfer"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
