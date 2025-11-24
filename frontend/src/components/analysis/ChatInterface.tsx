import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Loader2, Send, Bot, User, Sparkles } from 'lucide-react'

interface ChatInterfaceProps {
    onCriteriaChange: (criteria: any) => void
    onStartAnalysis: () => void
    isRunning: boolean
}

interface Message {
    role: 'user' | 'assistant'
    content: string
    timestamp: Date
    suggestions?: string[]
}

export function ChatInterface({ onCriteriaChange, onStartAnalysis, isRunning }: ChatInterfaceProps) {
    const [messages, setMessages] = useState<Message[]>([
        {
            role: 'assistant',
            content: 'Hello! Describe your acquisition target (e.g., "Profitable logistics companies in Sweden with >50M revenue").',
            timestamp: new Date(),
            suggestions: ["Find profitable SaaS companies", "Construction companies in Stockholm", "High growth e-commerce"]
        }
    ])
    const [input, setInput] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [currentCriteria, setCurrentCriteria] = useState<any>(null)
    const [matchCount, setMatchCount] = useState<number | null>(null)
    const scrollRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
    }, [messages])

    const sendMessage = async (text: string) => {
        if (!text.trim()) return

        const userMsg = text
        setInput('')
        setMessages(prev => [...prev, { role: 'user', content: userMsg, timestamp: new Date() }])
        setIsLoading(true)

        try {
            const response = await fetch('/api/analysis/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: userMsg,
                    current_criteria: currentCriteria
                })
            })

            const data = await response.json()

            setMessages(prev => [...prev, {
                role: 'assistant',
                content: `${data.message}\n\nFound ${data.count} matching companies.`,
                timestamp: new Date(),
                suggestions: data.suggestions
            }])

            setCurrentCriteria(data.criteria)
            setMatchCount(data.count)
            onCriteriaChange(data.criteria)

        } catch (error) {
            console.error('Chat error:', error)
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: 'Sorry, I encountered an error analyzing your request.',
                timestamp: new Date()
            }])
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="flex flex-col h-full bg-white">
            {/* Chat Header */}
            <div className="p-4 border-b border-gray-200 flex items-center gap-2 bg-gray-50">
                <Sparkles className="w-5 h-5 text-blue-600" />
                <div>
                    <h2 className="font-semibold text-gray-900">AI Sourcing Agent</h2>
                    <p className="text-xs text-gray-500">Powered by GPT-4o-mini</p>
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-hidden relative">
                <ScrollArea className="h-full p-4" ref={scrollRef}>
                    <div className="space-y-4 pb-4">
                        {messages.map((msg, idx) => (
                            <div key={idx} className={`flex flex-col gap-2 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                                <div className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                                    <div className={`
                                        w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0
                                        ${msg.role === 'assistant' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'}
                                    `}>
                                        {msg.role === 'assistant' ? <Bot size={16} /> : <User size={16} />}
                                    </div>
                                    <div className={`
                                        rounded-lg p-3 text-sm
                                        ${msg.role === 'assistant'
                                            ? 'bg-blue-50 text-gray-800 border border-blue-100'
                                            : 'bg-gray-100 text-gray-900'}
                                    `}>
                                        <div className="whitespace-pre-wrap">{msg.content}</div>
                                    </div>
                                </div>

                                {/* Suggestions Chips */}
                                {msg.role === 'assistant' && msg.suggestions && msg.suggestions.length > 0 && (
                                    <div className="flex flex-wrap gap-2 ml-11 mt-1">
                                        {msg.suggestions.map((suggestion, sIdx) => (
                                            <button
                                                key={sIdx}
                                                onClick={() => sendMessage(suggestion)}
                                                disabled={isLoading}
                                                className="text-xs bg-white border border-blue-200 text-blue-700 px-3 py-1.5 rounded-full hover:bg-blue-50 transition-colors text-left"
                                            >
                                                {suggestion}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                        {isLoading && (
                            <div className="flex gap-3">
                                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                                    <Bot size={16} />
                                </div>
                                <div className="bg-gray-50 rounded-lg p-3">
                                    <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                                </div>
                            </div>
                        )}
                    </div>
                </ScrollArea>
            </div>

            {/* Stats & Actions */}
            {matchCount !== null && (
                <div className="px-4 py-2 bg-blue-50 border-t border-blue-100 flex justify-between items-center">
                    <span className="text-sm text-blue-700 font-medium">
                        {matchCount} Matches
                    </span>
                    <Button
                        size="sm"
                        onClick={onStartAnalysis}
                        disabled={isRunning || matchCount === 0}
                        className="bg-blue-600 hover:bg-blue-700"
                    >
                        {isRunning ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <Sparkles className="w-3 h-3 mr-2" />}
                        Run Deep Analysis
                    </Button>
                </div>
            )}

            {/* Input Area */}
            <div className="p-4 border-t border-gray-200 bg-white">
                <form
                    onSubmit={(e) => { e.preventDefault(); sendMessage(input); }}
                    className="flex gap-2"
                >
                    <Input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Describe your target..."
                        className="flex-1"
                        disabled={isLoading || isRunning}
                    />
                    <Button type="submit" size="icon" disabled={isLoading || isRunning || !input.trim()}>
                        <Send className="w-4 h-4" />
                    </Button>
                </form>
            </div>
        </div>
    )
}
