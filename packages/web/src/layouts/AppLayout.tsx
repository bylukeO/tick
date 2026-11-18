import React from "react";
import { Navbar } from "../components/Navbar";

export const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans text-slate-900">
      <Navbar />
      <main className="flex-1 pb-24 md:pb-0">{children}</main>
    </div>
  );
};

export default AppLayout;
