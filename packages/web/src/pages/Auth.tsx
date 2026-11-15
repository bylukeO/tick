import React, { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../stores/auth.store";

export const Auth: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isRegister = location.pathname === "/register";
  const { login, register, error: authError } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setLocalError(null);

    try {
      if (isRegister) {
        await register(email, password);
      } else {
        await login(email, password);
      }
      navigate("/wallet");
    } catch (err: any) {
      setLocalError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <div className="bg-white border border-slate-200 rounded-xl p-8 shadow-sm">
        <div className="text-center mb-8">
          <span className="text-2xl font-bold tracking-tight text-[#026cdf]">ticketmaster</span>
          <h2 className="text-xl font-bold text-slate-900 mt-3">
            {isRegister ? "Create Account" : "Sign In"}
          </h2>
        </div>

        {(localError || authError) && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded mb-6">
            {localError || "Something went wrong. Please try again."}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              className="w-full bg-white border border-slate-300 rounded px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-[#026cdf]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full bg-white border border-slate-300 rounded px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-[#026cdf]"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-[#026cdf] hover:bg-[#0150a5] disabled:opacity-50 text-white font-semibold py-2.5 rounded text-sm transition mt-2"
            style={{ borderRadius: 4 }}
          >
            {isSubmitting ? "Please wait..." : isRegister ? "Create Account" : "Sign In"}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-slate-200 text-center text-sm text-slate-600">
          {isRegister ? (
            <span>
              Already have an account?{" "}
              <Link to="/login" className="text-[#026cdf] hover:underline font-semibold">Sign In</Link>
            </span>
          ) : (
            <span>
              New to Ticketmaster?{" "}
              <Link to="/register" className="text-[#026cdf] hover:underline font-semibold">Sign Up</Link>
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
