import { useActivityStore, CommunicationTurn, MessageNode } from "../../stores/useActivityStore";
import { useState } from "react";
import { Clock, Bot, User } from "lucide-react"; // Using basic icons for avatars if images not provided
import { format } from "date-fns";
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs';
import { useTranslation } from 'react-i18next';
import { ChatInput } from "./ChatInput";

type TabType = 'turn' | 'session' | 'events' | 'docs';

export function RecentActivity() {
    const { turns } = useActivityStore();
    const [activeTab, setActiveTab] = useState<TabType>('turn');
    const { t } = useTranslation(); // Hook initialization

    const tabs: { id: TabType; label: string }[] = [
        { id: 'turn', label: t('dashboard.tabs.turn') },
        { id: 'session', label: t('dashboard.tabs.session') },
        { id: 'events', label: t('dashboard.tabs.events') },
        { id: 'docs', label: t('dashboard.tabs.docs') },
    ];

    return (
        <div className="bg-white/50 dark:bg-white/[0.02] border border-border/40 dark:border-border/40 shadow-sm rounded-xl flex flex-col h-full min-h-[400px] overflow-hidden">
            {/* Header: Seamless, no background */}
            <div className="flex items-center justify-between px-4 py-3">
                <h2 className="text-[13px] font-medium text-foreground/90">{t('dashboard.gateway_communication')}</h2>
                <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span className="text-[11px] font-medium text-muted-foreground">{t('dashboard.live')}</span>
                </div>
            </div>

            {/* Tabs */}
            <div className="px-4 pb-2">
                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabType)} className="w-full">
                    <TabsList className="grid w-full grid-cols-4">
                        {tabs.map((tab) => (
                            <TabsTrigger key={tab.id} value={tab.id} className="text-xs">
                                {tab.label}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                </Tabs>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto px-4 py-2">
                {activeTab === 'turn' ? (
                    <div className="space-y-5 pb-4">
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
                            turns.map((turn) => (
                                <TurnItem key={turn.id} turn={turn} />
                            ))
                        )}
                    </div>
                ) : (
                    <div className="flex items-center justify-center h-40 text-muted-foreground/40 text-[12px]">
                        {t('dashboard.coming_soon')}
                    </div>
                )}
            </div>

            {activeTab === 'turn' && (
                <ChatInput />
            )}
        </div>
    );
}

function TurnItem({ turn }: { turn: CommunicationTurn }) {
    // We assume nodes are ordered: Engineer (Request) -> Agent (Response).
    // The design shows a continuous timeline for a "Turn".

    // Safety check for empty turn
    if (!turn.nodes || turn.nodes.length === 0) return null;

    return (
        <div className="relative">
            {/* Timeline Line: A dashed line connecting the top node to the bottom of the turn group */}
            {/* It should start from the center of the first avatar and go down. */}
            {/* Since nodes are stacked, we can just draw a line from the first avatar down to the last avatar. */}

            <div className="flex flex-col gap-0">
                {turn.nodes.map((node, index) => {
                    const isLast = index === turn.nodes.length - 1;
                    return (
                        <MessageItem
                            key={node.id}
                            node={node}
                            isLast={isLast}
                        />
                    );
                })}
            </div>
        </div>
    );
}

function MessageItem({ node, isLast }: { node: MessageNode, isLast: boolean }) {
    return (
        <div className="relative flex gap-3 min-h-[60px]">
            {/* Left Column: Avatar & Timeline */}
            <div className="flex flex-col items-center w-8 shrink-0">
                <div className="relative z-10 w-7 h-7 rounded-full bg-zinc-100 dark:bg-zinc-800 border border-border/40 flex items-center justify-center overflow-hidden">
                    {node.role === 'engineer' ? (
                        // Use a simple stylistic representation or image if available
                        <User className="w-4 h-4 text-zinc-600 dark:text-zinc-400" strokeWidth={1.5} />
                    ) : (
                        <Bot className="w-4 h-4 text-zinc-600 dark:text-zinc-400" strokeWidth={1.5} />
                    )}


                </div>

                {/* Timeline Connector */}
                {/* Only render if not the last item in a turn, OR (advanced) if we want to connect turns? Design seems to show per-card grouping via frame, but timeline inside. */}
                {/* Figma shows a dashed line extending downwards from the avatar. */}
                {!isLast && (
                    <div className="flex-1 w-px border-l border-dashed border-zinc-300 dark:border-zinc-700 my-2" />
                )}
            </div>

            {/* Right Column: Content */}
            <div className="flex-1 flex flex-col gap-1 pb-4">
                {/* Header: Compact Single Line */}
                <div className="flex items-baseline justify-between mb-1 min-w-0">
                    <div className="flex items-baseline gap-2 min-w-0 overflow-hidden">
                        <span className="text-[12px] font-medium text-foreground leading-none truncate flex-shrink-0">{node.name}</span>
                        <span className="text-[10px] font-medium text-muted-foreground/50 leading-none truncate tabular-nums">
                            {format(node.timestamp, 'yyyy.MM.dd HH:mm:ss')}
                        </span>
                    </div>
                    <span className="text-[10px] font-medium text-muted-foreground/70 bg-muted/50 px-1.5 py-0.5 rounded-[4px] border border-border/20 flex-shrink-0 ml-2">
                        {node.channel}
                    </span>
                </div>



                {/* Message Content Card */}
                <div className="w-full bg-white dark:bg-zinc-900/50 border border-border/40 rounded-xl min-h-[48px] p-3 shadow-sm">
                    {node.content && (
                        <p className="text-[13px] text-zinc-600 dark:text-zinc-300 leading-relaxed font-normal">
                            {node.content}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
