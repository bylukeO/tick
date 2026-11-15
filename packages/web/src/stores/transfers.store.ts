import { create } from "zustand";

export interface TransferRecord {
  id: string;
  ticketId: string;
  fromUserId: string;
  toUserId: string;
  status: "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED";
  proofHash: string;
  senderSig: string;
  receiverSig?: string | null;
  createdAt: string;
  acceptedAt?: string | null;
  ticket?: any;
  fromUser?: { id: string; email: string };
  toUser?: { id: string; email: string };
}

interface TransfersState {
  filter: "all" | "incoming" | "outgoing";
  setFilter: (filter: "all" | "incoming" | "outgoing") => void;
}

export const useTransfers = create<TransfersState>((set) => ({
  filter: "all",
  setFilter: (filter) => set({ filter }),
}));
