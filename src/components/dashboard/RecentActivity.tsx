import { useActivityStore, CommunicationTurn } from "../../stores/useActivityStore";
import { useEffect } from "react";
import { Clock, Bot, User } from "lucide-react";
import { format } from "date-fns";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../ui/tabs";
import { useTranslation } from 'react-i18next';
import { ChatInput } from "./ChatInput";

export function RecentActivity() {
    const { turns, fetchRecentActivity, setupListeners } = useActivityStore();
    const { t } = useTranslation();

    useEffect(() => {
        fetchRecentActivity();
        const cleanup = setupListeners();
        return () => {
            cleanup.then(fn => fn());
        };
    }, []);

    return (
        <div className="bg-white/50 dark:bg-white/[0.02] border border-border/40 dark:border-border/40 shadow-sm rounded-xl flex flex-col h-full min-h-[400px] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
                <h2 className="text-[13px] font-medium text-foreground/90">{t('dashboard.gateway_communication')}</h2>
                <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span className="text-[11px] font-medium text-muted-foreground">{t('dashboard.live')}</span>
                </div>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="turn" className="flex-1 flex flex-col overflow-hidden">
                <div className="px-4 py-2 border-b border-border/20">
                    <TabsList>
                        <TabsTrigger value="turn">Turn</TabsTrigger>
                        <TabsTrigger value="session">Session</TabsTrigger>
                        <TabsTrigger value="events">Events</TabsTrigger>
                        <TabsTrigger value="docs">Docs</TabsTrigger>
                    </TabsList>
                </div>

                {/* Turn Content */}
                <TabsContent value="turn" className="flex-1 overflow-y-auto px-4 py-3 mt-0">
                    {turns.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 text-center space-y-3">
                            <Clock className="w-8 h-8 stroke-[1] text-muted-foreground/30" />
                            <div className="space-y-1">
                                <p className="text-[12px] font-medium text-muted-foreground/60">{t('dashboard.no_recent_communication')}</p>
                                <p className="text-[10px] text-muted-foreground/40 max-w-[240px]">
                                    Real-time communication logs will appear here once the gateway starts processing API requests.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {turns.map((turn) => (
                                <TurnCard key={turn.id} turn={turn} />
                            ))}
                        </div>
                    )}
                </TabsContent>

                {/* Other Tabs */}
                <TabsContent value="session" className="flex-1 overflow-y-auto px-4 py-3 mt-0">
                    <div className="flex flex-col items-center justify-center py-10 text-center space-y-3">
                        <p className="text-[12px] text-muted-foreground/60">Session view coming soon</p>
                    </div>
                </TabsContent>

                <TabsContent value="events" className="flex-1 overflow-y-auto px-4 py-3 mt-0">
                    <div className="flex flex-col items-center justify-center py-10 text-center space-y-3">
                        <p className="text-[12px] text-muted-foreground/60">Events view coming soon</p>
                    </div>
                </TabsContent>

                <TabsContent value="docs" className="flex-1 overflow-y-auto px-4 py-3 mt-0">
                    <div className="flex flex-col items-center justify-center py-10 text-center space-y-3">
                        <p className="text-[12px] text-muted-foreground/60">Docs view coming soon</p>
                    </div>
                </TabsContent>
            </Tabs>

            <ChatInput />
        </div>
    );
}

function TurnCard({ turn }: { turn: CommunicationTurn }) {
    if (!turn.nodes || turn.nodes.length === 0) return null;

    // 找到 Engineer 和 Agent 节点
    const engineerNode = turn.nodes.find(n => n.role === 'engineer');
    const agentNode = turn.nodes.find(n => n.role === 'agent');

    return (
        <div className="bg-white dark:bg-zinc-900/50 border border-border/40 rounded-xl p-4 shadow-sm">
            {/* Engineer */}
            {engineerNode && (
                <div className="flex gap-3 mb-3">
                    <div className="flex flex-col items-center">
                        <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 border border-border/40 flex items-center justify-center flex-shrink-0">
                            <User className="w-4 h-4 text-zinc-600 dark:text-zinc-400" strokeWidth={1.5} />
                        </div>
                        {/* 虚线连接 */}
                        {agentNode && (
                            <div className="flex-1 w-px border-l border-dashed border-zinc-300 dark:border-zinc-700 my-2 min-h-[20px]" />
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                                <span className="text-[12px] font-medium text-foreground">Engineer</span>
                                <span className="text-[10px] text-muted-foreground/60">
                                    {format(engineerNode.timestamp, 'yyyy.MM.dd HH:mm:ss')}
                                </span>
                            </div>
                            <span className="text-[10px] text-muted-foreground/70 bg-muted/50 px-2 py-0.5 rounded">
                                {engineerNode.channel}
                            </span>
                        </div>
                        {engineerNode.content && (
                            <p className="text-[12px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                                {engineerNode.content}
                            </p>
                        )}
                    </div>
                </div>
            )}

            {/* Agent */}
            {agentNode && (
                <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 border border-border/40 flex items-center justify-center flex-shrink-0">
                        <Bot className="w-4 h-4 text-zinc-600 dark:text-zinc-400" strokeWidth={1.5} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-[12px] font-medium text-foreground">Agent</span>
                            <span className="text-[10px] text-muted-foreground/60">
                                {format(agentNode.timestamp, 'yyyy.MM.dd HH:mm:ss')}
                            </span>
                        </div>
                        {agentNode.content && (
                            <p className="text-[12px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                                {agentNode.content}
                            </p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
