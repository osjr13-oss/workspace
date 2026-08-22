"use client";

import { useState } from "react";
import {
  ArrowRight,
  Brain,
  CheckCircle2,
  FileText,
  Globe,
  MessageSquare,
  Sparkles
} from "lucide-react";
import { motion } from "framer-motion";

export function LandingPreview() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-900/5">
      {/* Mock App Window Header */}
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 bg-slate-50/70 rounded-t-xl">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
            <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
            <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
          </div>
          <span className="ml-2 font-mono text-[11px] font-semibold text-slate-400">
            selrano.com/chats
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Memory Synchronized
          </span>
        </div>
      </div>

      {/* Mock Studio Body */}
      <div className="p-5 sm:p-7 space-y-6">
        {/* User Message */}
        <div className="flex justify-end">
          <div className="max-w-[85%] rounded-2xl border border-slate-200 bg-slate-100/90 px-4 py-3 text-xs sm:text-sm font-medium text-slate-900 shadow-xs">
            How should we structure our caching layer for high-burst SSE streaming without breaking state?
          </div>
        </div>

        {/* Assistant Response with Grounded Tools */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-900 text-white">
              <Brain size={13} />
            </div>
            <span className="text-xs font-bold text-slate-900">Selrano</span>
            <span className="text-[10px] text-slate-400">Recalled 2 workspace facts</span>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 text-xs sm:text-sm leading-relaxed text-slate-700 space-y-2">
            <p>
              Based on your Postgres constraints from last week and your 500ms latency target:
            </p>
            <ul className="list-disc pl-4 space-y-1 text-slate-600">
              <li>
                Decouple token emission from DB writes using an in-memory queue.
              </li>
              <li>
                Maintain buffer state in Redis with automatic eviction upon stream completion{" "}
                <span className="inline-flex items-center gap-0.5 rounded-full bg-blue-100 px-1.5 py-0.2 text-[9px] font-bold text-blue-700">
                  <Globe size={9} /> [1]
                </span>
                .
              </li>
            </ul>
          </div>
        </div>

        {/* Floating Composer Mock */}
        <div className="rounded-xl border border-slate-200 bg-white p-2.5 flex items-center justify-between shadow-xs">
          <span className="text-xs text-slate-400 px-2">
            Ask a follow-up, or distill this into a project note...
          </span>
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 text-white">
            <ArrowRight size={14} />
          </div>
        </div>
      </div>
    </div>
  );
}
