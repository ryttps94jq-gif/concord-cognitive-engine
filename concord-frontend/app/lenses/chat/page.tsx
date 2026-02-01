'use client';

import { useState, useRef, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { useLensNav } from '@/hooks/useLensNav';
import { Send, Sparkles } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  ts?: string;
  refs?: Array<{ id: string; title: string; lineageHash: string }>;
}

export default function ChatLensPage() {
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<'overview' | 'deep' | 'creative'>('overview');
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  useLensNav('chat');

  // Match backend: POST /api/chat expects { message, mode }
  const chatMutation = useMutation({
    mutationFn: async (message: string) => {
      const res = await api.post('/api/chat', { message, mode });
      return res.data;
    },
    onSuccess: (data) => {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.reply || 'No response',
          ts: new Date().toISOString(),
          refs: data.refs,
        },
      ]);
      queryClient.invalidateQueries({ queryKey: ['dtus'] });
    },
  });

  const handleSend = () => {
    if (!input.trim() || chatMutation.isPending) return;
    setMessages((prev) => [
      ...prev,
      { role: 'user', content: input, ts: new Date().toISOString() },
    ]);
    chatMutation.mutate(input);
    setInput('');
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b border-lattice-border">
        <div className="flex items-center gap-3">
          <span className="text-2xl">💬</span>
          <div>
            <h1 className="text-xl font-bold">Chat Lens</h1>
            <p className="text-sm text-gray-400">
              Mode-aware conversation with DTU retrieval
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(['overview', 'deep', 'creative'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1 rounded text-sm capitalize ${
                mode === m
                  ? 'bg-neon-blue/20 text-neon-blue'
                  : 'bg-lattice-surface text-gray-400 hover:text-white'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <Sparkles className="w-12 h-12 mx-auto mb-4 text-neon-blue/50" />
            <p>Start a conversation with Concord</p>
            <p className="text-sm mt-2">
              Ask questions, forge DTUs, or explore your knowledge graph
            </p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${
              msg.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            <div
              className={`max-w-[80%] p-4 rounded-xl ${
                msg.role === 'user'
                  ? 'bg-neon-blue/20 text-white'
                  : 'bg-lattice-surface border border-lattice-border'
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
              {msg.refs && msg.refs.length > 0 && (
                <div className="mt-3 pt-3 border-t border-lattice-border">
                  <p className="text-xs text-gray-400 mb-2">Referenced DTUs:</p>
                  <div className="flex flex-wrap gap-1">
                    {msg.refs.slice(0, 5).map((ref) => (
                      <span
                        key={ref.id}
                        className="text-xs px-2 py-1 bg-neon-purple/20 text-neon-purple rounded"
                        title={ref.id}
                      >
                        {ref.title}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
        {chatMutation.isPending && (
          <div className="flex justify-start">
            <div className="bg-lattice-surface border border-lattice-border p-4 rounded-xl">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-neon-blue rounded-full animate-bounce" />
                <span className="w-2 h-2 bg-neon-blue rounded-full animate-bounce delay-100" />
                <span className="w-2 h-2 bg-neon-blue rounded-full animate-bounce delay-200" />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-lattice-border">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask Concord anything..."
            className="input-lattice flex-1"
            disabled={chatMutation.isPending}
          />
          <button
            onClick={handleSend}
            disabled={chatMutation.isPending || !input.trim()}
            className="btn-neon px-6 flex items-center gap-2"
          >
            <Send className="w-4 h-4" />
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
