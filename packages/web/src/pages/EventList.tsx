import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { apiRequest } from "../lib/api";

interface EventItem {
  id: string;
  name: string;
  venue: string;
  startsAt: string;
  totalClaimed: number;
}

export const EventList: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedVenue, setSelectedVenue] = useState<string>("ALL");

  const { data, isLoading, error } = useQuery<{ events: EventItem[] }>({
    queryKey: ["events"],
    queryFn: () => apiRequest<{ events: EventItem[] }>("/api/events"),
  });

  const events = data?.events || [];
  const venues = Array.from(new Set(events.map((e) => e.venue)));

  const filteredEvents = events.filter((e) => {
    const matchesSearch =
      e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.venue.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesVenue = selectedVenue === "ALL" || e.venue === selectedVenue;
    return matchesSearch && matchesVenue;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 bg-white">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight sm:text-4xl">
          Discover Live Events
        </h1>


        <div className="mt-6 flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search for events or venues"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#026cdf]"
            />
          </div>
          <div className="w-full sm:w-64">
            <select
              value={selectedVenue}
              onChange={(e) => setSelectedVenue(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-[#026cdf]"
            >
              <option value="ALL">All Venues</option>
              {venues.map((venue) => (
                <option key={venue} value={venue}>
                  {venue}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="py-24 text-center text-slate-400">Loading...</div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-300 text-sm">
          Something went wrong. Please try again.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredEvents.map((event) => {
          const dateStr = new Date(event.startsAt).toLocaleDateString(undefined, {
            weekday: "short",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });

          return (
            <div
              key={event.id}
              className="bg-slate-800/50 hover:bg-slate-800 border border-slate-700 rounded-2xl p-6 transition flex flex-col justify-between"
            >
              <div>
                <span className="text-[11px] font-semibold text-blue-400 uppercase tracking-wider">
                  {dateStr}
                </span>
                <h3 className="text-xl font-bold text-white mt-1">{event.name}</h3>
                <p className="text-sm text-slate-400 mt-1 flex items-center">
                  <span className="inline-block w-2 h-2 rounded-full bg-slate-500 mr-2"></span>
                  {event.venue}
                </p>

                <div className="mt-4 pt-4 border-t border-slate-700/50 flex justify-between text-xs text-slate-400">
                  <span>Available Seats:</span>
                  <span className="font-semibold text-slate-200">
                    {200 - event.totalClaimed} / 200
                  </span>
                </div>
              </div>

              <div className="mt-6">
                <Link
                  to={`/events/${event.id}`}
                  className="w-full block text-center bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 rounded-xl text-sm transition"
                >
                  Select Seats
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
