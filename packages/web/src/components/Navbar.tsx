import React from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../stores/auth.store";

const navItems = [
  { to: "/", label: "Discover", icon: "⌕" },
  { to: "/wallet", label: "My tickets", icon: "▣" },
  { to: "/transfers", label: "Transfers", icon: "↗" },
];

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2.5" aria-label="StagePass home">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-lg font-black text-white shadow-sm">S</span>
            <span className="text-xl font-extrabold tracking-tight text-slate-950">StagePass</span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex" aria-label="Main navigation">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  `rounded-full px-4 py-2 text-sm font-semibold transition ${isActive ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"}`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {user ? (
              <>
                <span className="hidden max-w-36 truncate text-sm text-slate-500 sm:block">{user.email}</span>
                <button onClick={handleLogout} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50">
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="rounded-full px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">Sign in</Link>
                <Link to="/register" className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700">Create account</Link>
              </>
            )}
          </div>
        </div>
      </header>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-3 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 backdrop-blur-xl md:hidden" aria-label="Mobile navigation">
        <div className="mx-auto grid max-w-md grid-cols-3 gap-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-semibold transition ${isActive ? "bg-indigo-50 text-indigo-700" : "text-slate-500 hover:bg-slate-50"}`
              }
            >
              <span className="text-xl leading-5" aria-hidden="true">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </>
  );
};
