'use client';

import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MessageRendererProps {
  content: string;
  className?: string;
  streaming?: boolean;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="absolute top-2 right-2 p-1.5 rounded-md bg-white/10 hover:bg-white/20 text-gray-400 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
      aria-label="Copy code"
    >
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

export default function MessageRenderer({ content, className, streaming }: MessageRendererProps) {
  return (
    <div className={cn('message-markdown leading-relaxed', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          p: ({ children }) => (
            <p className="mb-2 last:mb-0 whitespace-pre-wrap">{children}</p>
          ),
          pre: ({ children }) => (
            <div className="group relative my-3">
              <pre className="bg-black/40 border border-white/10 rounded-lg p-4 overflow-x-auto text-sm">
                {children}
              </pre>
              {!streaming && typeof children === 'object' && React.isValidElement(children) && (
                <CopyButton
                  text={
                    typeof children.props?.children === 'string'
                      ? children.props.children
                      : ''
                  }
                />
              )}
            </div>
          ),
          code: ({ className: codeClassName, children, ...props }) => {
            const isInline = !codeClassName;
            if (isInline) {
              return (
                <code className="px-1.5 py-0.5 bg-white/10 rounded text-[0.9em] text-neon-cyan font-mono" {...props}>
                  {children}
                </code>
              );
            }
            return (
              <code className={cn(codeClassName, 'text-sm leading-6')} {...props}>
                {children}
              </code>
            );
          },
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto rounded-lg border border-white/10">
              <table className="w-full text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-white/5 text-left">{children}</thead>
          ),
          th: ({ children }) => (
            <th className="px-3 py-2 font-medium text-gray-300 border-b border-white/10">{children}</th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-2 border-b border-white/5">{children}</td>
          ),
          blockquote: ({ children }) => (
            <blockquote className="my-2 pl-4 border-l-2 border-neon-cyan/40 text-gray-400 italic">
              {children}
            </blockquote>
          ),
          ul: ({ children }) => (
            <ul className="my-2 ml-4 list-disc space-y-1">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="my-2 ml-4 list-decimal space-y-1">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="leading-relaxed">{children}</li>
          ),
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-neon-cyan hover:underline">
              {children}
            </a>
          ),
          h1: ({ children }) => <h1 className="text-lg font-bold mt-4 mb-2">{children}</h1>,
          h2: ({ children }) => <h2 className="text-base font-bold mt-3 mb-2">{children}</h2>,
          h3: ({ children }) => <h3 className="text-sm font-bold mt-3 mb-1">{children}</h3>,
          hr: () => <hr className="my-3 border-white/10" />,
        }}
      >
        {content}
      </ReactMarkdown>
      {streaming && (
        <span className="inline-block w-2 h-4 bg-neon-cyan/60 animate-pulse ml-0.5" />
      )}
    </div>
  );
}
