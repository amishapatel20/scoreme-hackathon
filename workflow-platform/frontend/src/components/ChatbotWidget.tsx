import { Bot, MessageCircle, Send, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { useChatbot } from '../hooks/useChatbot'
import { Button } from './ui/button'
import { Input } from './ui/input'

export function ChatbotWidget() {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const { messages, isTyping, sendMessage, clear } = useChatbot()
  const bodyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const body = bodyRef.current
    if (body) body.scrollTop = body.scrollHeight
  }, [messages, isTyping, open])

  return (
    <div className="fixed bottom-5 right-5 z-50">
      {open ? (
        <div className="w-[min(92vw,380px)] rounded-xl border border-border bg-card shadow-2xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2 font-medium">
              <Bot className="h-4 w-4 text-primary" /> Workflow Assistant
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={clear}>Clear</Button>
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)} aria-label="Close chat">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div ref={bodyRef} className="max-h-80 space-y-3 overflow-y-auto p-4 text-sm">
            {messages.map((msg) => (
              <div key={msg.id} className={msg.role === 'user' ? 'text-right' : 'text-left'}>
                <div
                  className={
                    msg.role === 'user'
                      ? 'ml-10 inline-block rounded-lg bg-primary px-3 py-2 text-primary-foreground'
                      : 'mr-10 inline-block rounded-lg bg-muted px-3 py-2 text-foreground'
                  }
                >
                  {msg.text}
                </div>
              </div>
            ))}
            {isTyping ? (
              <div className="text-left">
                <div className="mr-10 inline-flex items-center gap-2 rounded-lg bg-muted px-3 py-2">
                  <span className="spinner" /> Thinking...
                </div>
              </div>
            ) : null}
          </div>

          <form
            className="flex gap-2 border-t border-border p-3"
            onSubmit={(e) => {
              e.preventDefault()
              void sendMessage(input)
              setInput('')
            }}
          >
            <Input
              placeholder="Ask about a request, rules, or platform usage..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <Button type="submit" aria-label="Send">
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      ) : (
        <Button className="h-12 w-12 rounded-full" onClick={() => setOpen(true)} aria-label="Open chatbot">
          <MessageCircle className="h-5 w-5" />
        </Button>
      )}
    </div>
  )
}
