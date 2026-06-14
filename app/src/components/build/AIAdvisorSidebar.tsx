"use client";

import React, { useState, useEffect, useRef } from "react";
import { Sparkles, X, Send, AlertTriangle, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface AIAdvisorSidebarProps {
  buildState: {
    name: string;
    intent: string;
    frameSize: string;
    auw: number;
    twr: number;
    components: any[];
    warnings: any[];
  };
}

export default function AIAdvisorSidebar({ buildState }: AIAdvisorSidebarProps) {
  const [collapsed, setCollapsed] = useState(true);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Greetings, pilot. I am your FPV Hangar AI Advisor. I have analyzed your active build configuration. Ask me anything about tip speeds, motor KV, battery cells, or safety warnings.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isOffline, setIsOffline] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Check if API key is configured on mount/expand
  useEffect(() => {
    if (collapsed) return;
    
    // Test check
    fetch("/api/v1/ai/advisor-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "Ping" }],
        buildState,
      }),
    }).then(async (res) => {
      if (res.status === 503) {
        const data = await res.json();
        if (data.error?.code === "NO_API_KEY") {
          setIsOffline(true);
        }
      } else {
        setIsOffline(false);
      }
    }).catch(() => {
      // ignore, let actual message send handle it
    });
  }, [collapsed, buildState]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading || isOffline) return;

    const userMessage: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/v1/ai/advisor-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(m => ({ role: m.role, content: m.content })),
          buildState,
        }),
      });

      if (response.status === 503) {
        const data = await response.json();
        if (data.error?.code === "NO_API_KEY") {
          setIsOffline(true);
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: "Uplink offline: Gemini AI Advisor requires a valid API key to stream calculations.",
            },
          ]);
          return;
        }
      }

      if (!response.ok) {
        throw new Error("Telemetry link failed.");
      }

      // Read streamed text
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Failed to read stream.");
      }

      const decoder = new TextDecoder();
      let done = false;
      let assistantText = "";

      // Add a placeholder assistant message that we will stream into
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          const chunk = decoder.decode(value, { stream: !done });
          assistantText += chunk;
          
          setMessages((prev) => {
            const updated = [...prev];
            if (updated.length > 0) {
              updated[updated.length - 1] = {
                role: "assistant",
                content: assistantText,
              };
            }
            return updated;
          });
        }
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to stream telemetry recommendations.");
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "⚠️ Error linking with Advisor. Please retry." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`fixed top-16 right-0 bottom-0 z-35 flex transition-all duration-300 ${
        collapsed ? "w-0" : "w-[380px]"
      }`}
    >
      {/* Tab handle button */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute left-[-42px] top-1/2 -translate-y-1/2 bg-slate-900 border border-r-0 border-slate-800 text-slate-400 hover:text-white p-2.5 rounded-l-xl shadow-2xl transition cursor-pointer flex items-center justify-center gap-1.5 focus:outline-none"
      >
        {collapsed ? (
          <div className="flex flex-col items-center gap-1">
            <Sparkles className="w-4.5 h-4.5 text-cyan-400 animate-pulse" />
            <ChevronLeft className="w-3.5 h-3.5" />
          </div>
        ) : (
          <ChevronRight className="w-4 h-4 text-cyan-400" />
        )}
      </button>

      {/* Sidebar Content Panel */}
      <div className="w-full h-full bg-slate-950/90 backdrop-blur-xl border-l border-slate-900 flex flex-col relative select-none">
        {/* Header */}
        <div className="p-4 border-b border-slate-900 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6.5 h-6.5 bg-cyan-950 border border-cyan-800/40 rounded-md flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-white">
                Telemetry Advisor
              </h3>
              <div className="flex items-center gap-1">
                <span className={`w-1.5 h-1.5 rounded-full ${isOffline ? "bg-rose-500 animate-pulse" : "bg-cyan-500 animate-ping"}`} />
                <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">
                  {isOffline ? "Sync Offline" : "Uplink Active"}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={() => setCollapsed(true)}
            className="p-1 text-slate-500 hover:text-white rounded-lg hover:bg-slate-900 transition cursor-pointer"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Chat Window */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 select-text">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex flex-col max-w-[85%] ${
                msg.role === "user" ? "ml-auto items-end" : "mr-auto items-start"
              }`}
            >
              <span className="text-[8px] font-black uppercase text-slate-500 tracking-wider mb-0.5">
                {msg.role === "user" ? "Pilot" : "Advisor"}
              </span>
              <div
                className={`p-3 rounded-xl text-xs leading-relaxed border ${
                  msg.role === "user"
                    ? "bg-indigo-950/20 text-indigo-100 border-indigo-850 shadow-md shadow-indigo-950/10"
                    : "bg-slate-900/30 text-slate-300 border-slate-850/50"
                }`}
              >
                {/* Simplified markdown line-break formatter */}
                <p className="whitespace-pre-wrap font-medium">{msg.content}</p>
              </div>
            </div>
          ))}

          {loading && messages[messages.length - 1]?.role !== "assistant" && (
            <div className="flex flex-col items-start max-w-[85%] mr-auto">
              <span className="text-[8px] font-black uppercase text-slate-500 tracking-wider mb-0.5">
                Advisor
              </span>
              <div className="p-3 bg-slate-900/20 border border-slate-850/30 rounded-xl text-slate-500 text-xs flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Offline Overlay overlay */}
        {isOffline && (
          <div className="absolute inset-0 top-15 bg-slate-950/90 backdrop-blur-sm z-30 flex flex-col items-center justify-center p-6 text-center">
            <div className="w-12 h-12 bg-amber-950/60 border border-amber-800/40 rounded-2xl flex items-center justify-center text-amber-500 mb-4 animate-bounce">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h4 className="text-xs font-black tracking-widest text-white uppercase mb-2">
              Gemini Uplink Offline
            </h4>
            <p className="text-[10px] text-slate-400 leading-relaxed max-w-[240px] mb-5">
              The AI Advisor requires an external API Key to process calculations. Please declare a valid
              <code className="text-cyan-400 bg-slate-900 px-1 py-0.5 rounded font-mono mx-1">GOOGLE_GENERATIVE_AI_API_KEY</code>
              in your server environment.
            </p>
            <button
              onClick={() => setIsOffline(false)}
              className="px-4 py-2 border border-slate-800 hover:border-slate-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition cursor-pointer flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Reconnect
            </button>
          </div>
        )}

        {/* Message Input Box */}
        <form onSubmit={handleSend} className="p-3 border-t border-slate-900 flex gap-2">
          <input
            type="text"
            disabled={loading || isOffline}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isOffline ? "Uplink offline..." : "Inquire about build safety/telemetry..."}
            className="flex-1 px-3 py-2 bg-slate-950/60 border border-slate-800 rounded-xl focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition outline-none text-xs text-white placeholder-slate-600 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={loading || !input.trim() || isOffline}
            className="p-2.5 bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 disabled:opacity-50 text-slate-950 font-bold rounded-xl transition cursor-pointer flex items-center justify-center"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
