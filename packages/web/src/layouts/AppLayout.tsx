import React, { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Navbar } from "../components/Navbar";
import { isStandalone } from "../pwa";
import { useAuth } from "../stores/auth.store";

export const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const standalone = useMemo(() => (typeof window !== "undefined" ? isStandalone() : false), []);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen text-slate-900 flex flex-col font-sans" style={{ backgroundColor: "#ffffff" }}>
      <div className={standalone ? "safe-top bg-[#026cdf] sticky top-0 z-40" : ""}>
        {standalone ? (
          <header>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
              <div className="flex items-center space-x-5">
                <Link to="/" className="flex items-center">
                  <span className="text-xl font-bold tracking-tight text-white lowercase">ticketmaster</span>
                </Link>
                <nav className="flex space-x-4 text-sm font-medium">
                  <Link to="/" className="text-white/90 hover:text-white transition">Events</Link>
                  <Link to="/wallet" className="text-white/90 hover:text-white transition">My Tickets</Link>
                  <Link to="/transfers" className="text-white/90 hover:text-white transition">Transfers</Link>
                </nav>
              </div>
              <div className="flex items-center space-x-3">
                {user ? (
                  <button onClick={handleLogout} className="text-sm text-white/90 hover:text-white">Sign Out</button>
                ) : (
                  <Link to="/login" className="text-sm text-white">Sign In</Link>
                )}
              </div>
            </div>
          </header>
        ) : (
          <Navbar />
        )}
      </div>

      <main className={`flex-1 bg-white ${standalone ? "safe-bottom" : ""}`}>{children}</main>
    </div>
  );
};

export default AppLayout;
