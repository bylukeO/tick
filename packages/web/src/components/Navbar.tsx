import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../stores/auth.store";

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <header className="bg-[#026cdf] sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        <div className="flex items-center space-x-6">
          <Link to="/" className="flex items-center">
            <span className="text-2xl font-bold tracking-tight text-white lowercase">ticketmaster</span>
          </Link>
          <nav className="hidden md:flex space-x-5 text-sm font-medium">
            <Link to="/" className="text-white/90 hover:text-white transition">Events</Link>
            <Link to="/wallet" className="text-white/90 hover:text-white transition">My Tickets</Link>
            <Link to="/transfers" className="text-white/90 hover:text-white transition">Transfers</Link>
          </nav>
        </div>

        <div className="flex items-center space-x-3">
          {user ? (
            <button onClick={handleLogout} className="text-sm text-white/90 hover:text-white font-medium px-3 py-1.5">
              Sign Out
            </button>
          ) : (
            <div className="flex items-center space-x-2">
              <Link to="/login" className="text-sm text-white font-medium px-3 py-1.5">Sign In</Link>
              <Link to="/register" className="text-sm bg-white text-[#026cdf] font-semibold px-3 py-1.5 rounded" style={{ borderRadius: 4 }}>
                Sign Up
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
