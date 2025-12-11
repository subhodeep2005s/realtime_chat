"use client";

import { useUsername } from "@/hooks/use-username";
import { client } from "@/lib/client";
import { useMutation, useQuery } from "@tanstack/react-query";

import { useParams, useRouter } from "next/navigation";
import { use, useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { useRealtime } from "@/lib/realtime-client";

function formateTimeremaining(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

const room = () => {
  const router = useRouter();
  const { username } = useUsername();
  const params = useParams();
  const roomId = params.roomId as string;
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const [copyStatus, setCopyStatus] = useState("Copy");
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null); // 10 minutes in seconds
  const { data: ttlData } = useQuery({
    queryKey: ["room-ttl", roomId],
    queryFn: async () => {
      const res = await client.room.ttl.get({ query: { roomId } });
      return res.data;
    },
  });
  useEffect(() => {
    if (ttlData?.ttl !== undefined) setTimeRemaining(ttlData.ttl);
  }, [ttlData]);

  useEffect(() => {
    if (timeRemaining === null || timeRemaining < 0) return;

    if (timeRemaining === 0) {
      router.push("/?destroyed=true");
      return;
    }

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timeRemaining, router]);

  const { data: messages, refetch } = useQuery({
    queryKey: ["messages", roomId],
    queryFn: async () => {
      const res = await client.messages.get({ query: { roomId } });
      return res.data;
    },
  });

  // auto-scroll to bottom when messages change
  useEffect(() => {
    if (!messagesContainerRef.current) return;
    messagesContainerRef.current.scrollTop =
      messagesContainerRef.current.scrollHeight;
  }, [messages?.messages?.length]);

  const { mutate: sendMessage, isPending } = useMutation({
    mutationFn: async ({ text }: { text: string }) => {
      await client.messages.post(
        {
          sender: username,
          text,
        },
        { query: { roomId } }
      );
      setInput("");
      // refetch is triggered by realtime; call manually to be safe
      refetch();
    },
  });

  useRealtime({
    channels: [roomId],
    events: ["chat.message", "chat.destroy"],
    onData: ({ event }) => {
      if (event === "chat.message") {
        // Refetch messages or optimistically update UI
        refetch();
      }
      if (event === "chat.destroy") {
        router.push("/?destroyed=true");
      }
    },
  });

  const { mutate: destroyRoom } = useMutation({
    mutationFn: async () => {
      await client.room.delete(null, { query: { roomId } });
    },
  });
  const copyLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    setCopyStatus("Copied!");

    setTimeout(() => setCopyStatus("Copy"), 2000);
  };

  return (
    <main className="flex flex-col h-screen max-h-screen overflow-hidden bg-black text-zinc-100">
      <header className="border-b border-zinc-800 p-4 flex items-center justify-between bg-zinc-900/30">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex flex-col min-w-0">
            <span className="text-xs text-zinc-500 uppercase">ROOM ID</span>
            <div className="flex items-center gap-2">
              <span className="font-bold text-green-500 truncate max-w-[160px]">
                {roomId}
              </span>
              <button
                onClick={copyLink}
                className="text-[10px] bg-zinc-800 hover:bg-zinc-700 px-2 py-0.5 rounded text-zinc-400 hover:text-zinc-200 transition-colors uppercase"
                aria-label="Copy room link"
              >
                {copyStatus}
              </button>
            </div>
          </div>
          <div className="hidden sm:block h-8 w-px bg-zinc-800" />
          <div className="flex flex-col">
            <span className="text-xs text-zinc-500 uppercase">
              self-destruct
            </span>
            <span
              className={`text-sm font-bold flex items-center gap-2 ${
                timeRemaining !== null && timeRemaining < 60
                  ? "text-red-500"
                  : "text-amber-500"
              }`}
            >
              {timeRemaining !== null
                ? formateTimeremaining(timeRemaining)
                : "--:--"}
            </span>
          </div>
        </div>

        <button
          onClick={() => {
            destroyRoom();
          }}
          className="bg-zinc-800 hover:bg-red-500 px-3 py-1.5 rounded text-zinc-400 hover:text-white font-bold transition-all group flex items-center gap-2 disabled:opacity-50"
        >
          <span className="group-hover:animate-pulse">💣</span>
          <span className="hidden sm:inline">DESTROY NOW</span>
        </button>
      </header>

      {/* Messages + Input container */}
      <div className="flex-1 flex flex-col">
        {/* Scrollable messages area */}
        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto px-4 py-4 space-y-3 scrollbar-thin"
        >
          {/* Empty state */}
          {(!messages || messages.messages.length === 0) && (
            <div className="flex items-center justify-center h-full">
              <p className="text-zinc-600 text-sm font-mono">
                No messages yet. Start the conversation!
              </p>
            </div>
          )}

          {/* Message list */}
          {messages?.messages.map((msg: any) => {
            const isMe = msg.sender === username;

            return (
              <div
                key={msg.id}
                className={`w-full flex ${
                  isMe ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[92%] sm:max-w-[78%] px-4 py-2 rounded-2xl border break-words
          ${
            isMe
              ? "bg-zinc-900/80 border-green-600/30 shadow-[0_0_6px_rgba(0,255,0,0.2)]"
              : "bg-zinc-900/60 border-zinc-700 shadow-[0_0_6px_rgba(150,150,255,0.15)]"
          }
        `}
                >
                  {/* name + time */}
                  <div className="flex items-baseline gap-2 mb-1">
                    <span
                      className={`font-bold text-xs font-mono ${
                        isMe ? "text-green-400" : "text-blue-400"
                      }`}
                    >
                      {isMe ? "YOU" : msg.sender}
                    </span>
                    <span className="text-[10px] text-zinc-500">
                      {format(new Date(msg.timestamp), "hh:mm a")}
                    </span>
                  </div>

                  {/* actual text */}
                  <p className="text-sm text-zinc-200 leading-relaxed font-mono whitespace-pre-wrap break-words">
                    {msg.text}
                  </p>

                  {/* message tail (left/right bubble) */}
                  <div
                    className={`hidden sm:block absolute w-3 h-3 rotate-45 translate-y-1
            ${
              isMe
                ? "-right-1 bg-zinc-900/80 border-green-600/30"
                : "-left-1 bg-zinc-900/60 border-zinc-700"
            }
            border border-inherit
          `}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom input */}
        <div className="border-t border-zinc-800 p-3 bg-zinc-900/30">
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-green-500 font-mono hidden sm:inline">
                {">"}
              </span>
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && input.trim()) {
                    sendMessage({ text: input });
                    inputRef.current?.focus();
                  }
                }}
                placeholder="Type message... Enter to send"
                autoFocus
                type="text"
                className="w-full bg-black border border-zinc-800 focus:border-zinc-700 focus:outline-none transition-colors text-zinc-100 placeholder:text-zinc-700 py-3 pl-10 pr-4 text-sm rounded"
              />
            </div>

            <button
              onClick={() => {
                if (!input.trim()) return;
                sendMessage({ text: input });
                inputRef.current?.focus();
              }}
              disabled={!input.trim() || isPending}
              className="bg-zinc-800 text-zinc-400 px-4 py-2 text-sm font-bold hover:text-zinc-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed rounded"
              aria-label="Send message"
            >
              SEND
            </button>
          </div>
        </div>
      </div>
    </main>
  );
};

export default room;
