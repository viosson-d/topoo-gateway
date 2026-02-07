import { useState, useRef, useEffect } from "react";
import { Send, Loader2 } from "lucide-react";
import { Button } from "../ui/button";
import { useTranslation } from "react-i18next";
import { useAccountStore } from "../../stores/useAccountStore";

export function ChatInput() {
    const { t } = useTranslation();
    const [input, setInput] = useState("");
    const [sending, setSending] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const currentAccount = useAccountStore((state) => state.currentAccount);

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
        }
    }, [input]);

    const handleSend = async () => {
        if (!input.trim() || sending) return;

        setSending(true);
        const message = input.trim();
        setInput(""); // Optimistic clear

        try {
            // Default to port 8045, or read from config if we had access to it easily.
            // For MVP, hardcoding localhost:8045 is acceptable as per plan.
            const response = await fetch("http://127.0.0.1:8045/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    // Authorization is usually not needed for local loopback unless Admin auth is on
                    // But if we have a current account, we might want to use it? 
                    // Actually, the proxy usually handles auth bypass for localhost or we need an API key.
                    // Let's try without auth first, or use a dummy key if needed.
                    "Authorization": "Bearer sk-antigravity-local"
                },
                body: JSON.stringify({
                    model: "gemini-3-flash", // Default fast model (v3)
                    messages: [
                        { role: "user", content: message }
                    ],
                    stream: false // Simple non-stream for this quick input
                })
            });

            if (!response.ok) {
                console.error("Failed to send message", response.status, await response.text());
                // In a real app we'd show a toast here
            }
        } catch (error) {
            console.error("Network error sending message", error);
        } finally {
            setSending(false);
            // Height reset
            if (textareaRef.current) {
                textareaRef.current.style.height = "auto";
            }
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="p-4 border-t border-border/40 bg-white/50 dark:bg-zinc-900/50">
            <div className="relative flex items-end gap-2 bg-white dark:bg-zinc-800 border border-border/40 rounded-xl p-2 shadow-sm focus-within:ring-1 focus-within:ring-primary/20 transition-all">
                <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={t('dashboard.chat_placeholder', "Message Gateway...")}
                    className="flex-1 max-h-[200px] min-h-[24px] bg-transparent border-none resize-none text-[13px] placeholder:text-muted-foreground/50 focus:outline-none py-1.5 px-1 custom-scrollbar"
                    rows={1}
                    disabled={sending}
                />
                <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 rounded-lg hover:bg-primary/10 hover:text-primary shrink-0 transition-colors"
                    onClick={handleSend}
                    disabled={!input.trim() || sending}
                >
                    {sending ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : (
                        <Send className="h-4 w-4 text-muted-foreground/70" />
                    )}
                </Button>
            </div>
            <div className="mt-2 flex justify-between items-center px-1">
                <span className="text-[10px] text-muted-foreground/40">
                    {currentAccount ? `Active: ${currentAccount.name || currentAccount.email}` : "No active account"}
                </span>
                <span className="text-[10px] text-muted-foreground/40">
                    Enter to send, Shift+Enter for new line
                </span>
            </div>
        </div>
    );
}
