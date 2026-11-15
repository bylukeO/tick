import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { EventList } from "./pages/EventList";
import { SeatMap } from "./pages/SeatMap";
import { Wallet } from "./pages/Wallet";
import { TransferInbox } from "./pages/TransferInbox";
import { Auth } from "./pages/Auth";
import { AppLayout } from "./layouts/AppLayout";
import { useAuth } from "./stores/auth.store";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 5000,
    },
  },
});

export const AppContent: React.FC = () => {
  const { checkSession } = useAuth();

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<EventList />} />
        <Route path="/events/:id" element={<SeatMap />} />
        <Route path="/wallet" element={<Wallet />} />
        <Route path="/transfers" element={<TransferInbox />} />
        <Route path="/login" element={<Auth />} />
        <Route path="/register" element={<Auth />} />
      </Routes>
    </AppLayout>
  );
};

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;
