import { create } from "zustand";

export interface Ticket {
  id: string;
  eventId: string;
  ownerId: string;
  section: string;
  row: string;
  seat: string;
  status: "ACTIVE" | "TRANSFER_PENDING" | "TRANSFERRED";
  qrPayload: string;
  qrPng?: string;
  originTicket?: string | null;
  transferCount: number;
  isOriginalRetained?: boolean;
  createdAt: string;
  event?: {
    id: string;
    name: string;
    venue: string;
    startsAt: string;
  };
}

interface WalletState {
  activeQrTicket: Ticket | null;
  transferTargetTicket: Ticket | null;
  setActiveQrTicket: (ticket: Ticket | null) => void;
  setTransferTargetTicket: (ticket: Ticket | null) => void;
}

export const useWallet = create<WalletState>((set) => ({
  activeQrTicket: null,
  transferTargetTicket: null,
  setActiveQrTicket: (ticket) => set({ activeQrTicket: ticket }),
  setTransferTargetTicket: (ticket) => set({ transferTargetTicket: ticket }),
}));
