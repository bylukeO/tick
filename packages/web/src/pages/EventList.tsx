import React, { useMemo, useState } from "react";
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

const artwork = [
  "from-violet-950 via-indigo-800 to-sky-500",
  "from-rose-950 via-fuchsia-800 to-orange-400",
  "from-slate-950 via-slate-700 to-cyan-500",
  "from-amber-950 via-orange-700 to-rose-400",
];

function formatEventDate(value: string) {
  const date = new Date(value);
  return {
    month: date.toLocaleDateString(undefined, { month: "short" }).toUpperCase(),
    day: date.toLocaleDateString(undefined, { day: "2-digit" }),
    details: date.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }),
  };
}

export const EventList: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedVenue, setSelectedVenue] = useState("ALL");

  const { data, isLoading, error } = useQuery<{ events: EventItem[] }>({
    queryKey: ["events"],
    queryFn: () => apiRequest<{ events: EventItem[] }>("/api/events"),
  });

  const events = data?.events || [];
  const venues = useMemo(() => Array.from(new Set(events.map((event) => event.venue))), [events]);
  const filteredEvents = useMemo(() => events.filter((event) => {
    const query = searchTerm.trim().toLowerCase();
    const matchesSearch = !query || event.name.toLowerCase().includes(query) || event.venue.toLowerCase().includes(query);
    return matchesSearch && (selectedVenue === "ALL" || event.venue === selectedVenue);
  }), [events, searchTerm, selectedVenue]);

  const totalAvailable = events.reduce((sum, event) => sum + Math.max(0, 200 - event.totalClaimed), 0);

  return (
    <div className="min-h-screen bg-slate-50">
      <section className="relative isolate overflow-hidden bg-slate-950">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(99,102,241,0.42),_transparent_52%),radial-gradient(ellipse_at_bottom_left,_rgba(14,165,233,0.22),_transparent_45%)]" />
        <div className="relative mx-auto max-w-7xl px-4 pb-12 pt-12 sm:px-6 sm:pb-16 sm:pt-16 lg:px-8">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold tracking-wide text-indigo-100">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              YOUR NEXT NIGHT OUT STARTS HERE
            </span>
            <h1 className="mt-5 text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl">
              Find your next
              <span className="block bg-gradient-to-r from-indigo-300 via-sky-200 to-white bg-clip-text text-transparent">live moment.</span>
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-slate-300 sm:text-lg">
              Discover shows, explore the seats, and keep every ticket in one place.
            </p>
          </div>

          <div className="mt-8 grid max-w-3xl gap-3 rounded-2xl border border-white/10 bg-white p-3 shadow-2xl shadow-black/20 sm:grid-cols-[1fr_220px]">
            <label className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3 focus-within:ring-2 focus-within:ring-indigo-500">
              <span className="text-xl text-slate-400" aria-hidden="true">⌕</span>
              <span className="sr-only">Search events or venues</span>
              <input
                type="search"
                placeholder="Search events or venues"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="min-w-0 flex-1 bg-transparent text-sm font-medium text-slate-900 outline-none placeholder:font-normal placeholder:text-slate-400"
              />
            </label>
            <label className="flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-3 focus-within:ring-2 focus-within:ring-indigo-500">
              <span className="text-xs font-semibold text-slate-500">VENUE</span>
              <span className="sr-only">Filter by venue</span>
              <select
                value={selectedVenue}
                onChange={(event) => setSelectedVenue(event.target.value)}
                className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-800 outline-none"
              >
                <option value="ALL">All venues</option>
                {venues.map((venue) => <option key={venue} value={venue}>{venue}</option>)}
              </select>
            </label>
          </div>

          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-300">
            <span><strong className="text-white">{events.length}</strong> events listed</span>
            <span><strong className="text-white">{totalAvailable.toLocaleString()}</strong> seats available</span>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-9 sm:px-6 sm:py-12 lg:px-8">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-600">The lineup</p>
            <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">Events worth showing up for</h2>
          </div>
          <span className="hidden rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-500 ring-1 ring-slate-200 sm:inline-flex">
            {filteredEvents.length} results
          </span>
        </div>

        {isLoading && (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((item) => <div key={item} className="h-80 animate-pulse rounded-2xl bg-white ring-1 ring-slate-200" />)}
          </div>
        )}

        {error && (
          <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
            We couldn’t load the event lineup. Please refresh and try again.
          </div>
        )}

        {!isLoading && !error && filteredEvents.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
            <div className="text-3xl" aria-hidden="true">⌕</div>
            <h3 className="mt-3 text-lg font-bold text-slate-900">No events found</h3>
            <p className="mt-1 text-sm text-slate-500">Try another search or choose a different venue.</p>
            <button onClick={() => { setSearchTerm(""); setSelectedVenue("ALL"); }} className="mt-5 rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700">
              Clear filters
            </button>
          </div>
        )}

        {!isLoading && !error && filteredEvents.length > 0 && (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filteredEvents.map((event, index) => {
              const date = formatEventDate(event.startsAt);
              const available = Math.max(0, 200 - event.totalClaimed);
              const fill = Math.min(100, Math.max(0, (event.totalClaimed / 200) * 100));
              return (
                <article key={event.id} className="group overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/80 transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-900/10">
                  <div className={`relative flex h-44 items-end overflow-hidden bg-gradient-to-br ${artwork[index % artwork.length]} p-5`}>
                    <div className="absolute -right-8 -top-12 h-44 w-44 rounded-full border border-white/20" />
                    <div className="absolute -right-1 top-4 h-28 w-28 rounded-full border border-white/20" />
                    <div className="absolute bottom-5 right-7 h-16 w-16 rotate-12 rounded-2xl border border-white/20 bg-white/10 backdrop-blur-sm" />
                    <div className="relative flex w-full items-end justify-between gap-4">
                      <span className="max-w-[70%] text-xs font-bold uppercase tracking-[0.2em] text-white/75">Live experience</span>
                      <div className="min-w-14 rounded-xl bg-white px-2.5 py-2 text-center shadow-lg">
                        <span className="block text-[10px] font-extrabold tracking-widest text-indigo-600">{date.month}</span>
                        <span className="block text-2xl font-black leading-7 text-slate-950">{date.day}</span>
                      </div>
                    </div>
                  </div>
                  <div className="p-5">
                    <p className="text-xs font-semibold text-slate-500">{date.details}</p>
                    <h3 className="mt-1 text-xl font-extrabold tracking-tight text-slate-950">{event.name}</h3>
                    <p className="mt-1 flex items-center gap-2 text-sm text-slate-500">
                      <span className="text-indigo-500" aria-hidden="true">⌖</span>{event.venue}
                    </p>
                    <div className="mt-5 border-t border-slate-100 pt-4">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-500">Seat availability</span>
                        <span className="font-bold text-slate-800">{available} <span className="font-medium text-slate-400">/ 200</span></span>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-indigo-500" style={{ width: `${fill}%` }} />
                      </div>
                    </div>
                    <Link to={`/events/${event.id}`} className="mt-5 flex min-h-11 items-center justify-center rounded-xl bg-slate-950 px-4 text-sm font-bold text-white transition group-hover:bg-indigo-600">
                      Explore seats <span className="ml-2 transition group-hover:translate-x-1" aria-hidden="true">→</span>
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
