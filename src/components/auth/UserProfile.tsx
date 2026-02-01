import { useState } from 'react'
import { useStore } from '../../store'
import { SupabaseService } from '../../services/SupabaseService'
import { LogOut, User, ChevronUp } from 'lucide-react'
import { AuthModal } from './AuthModal'
import * as Popover from '@radix-ui/react-popover'
import * as Avatar from '@radix-ui/react-avatar'

export function UserProfile() {
    const session = useStore(state => state.supabaseSession)
    const setSession = useStore(state => state.setSupabaseSession)
    const [authOpen, setAuthOpen] = useState(false)

    const handleSignOut = async () => {
        await SupabaseService.signOut()
        setSession(null)
    }

    const userEmail = session?.user?.email
    const userInitial = userEmail ? userEmail[0].toUpperCase() : '?'

    if (!session) {
        return (
            <>
                <button
                    onClick={() => setAuthOpen(true)}
                    className="w-full mt-2 flex items-center justify-center gap-2 p-2 rounded-md bg-purple-600/10 text-purple-400 hover:bg-purple-600/20 transition-colors border border-purple-600/20"
                >
                    <User className="h-4 w-4" />
                    <span className="text-sm font-medium">Sign In</span>
                </button>
                <AuthModal open={authOpen} onOpenChange={setAuthOpen} />
            </>
        )
    }

    return (
        <Popover.Root>
            <Popover.Trigger asChild>
                <button className="w-full mt-auto pt-4 border-t border-gray-800 flex items-center gap-3 hover:bg-gray-800/50 p-2 rounded-md transition-colors group outline-none">
                    <Avatar.Root className="h-8 w-8 rounded-full bg-indigo-600 flex items-center justify-center text-white font-medium text-sm">
                        <Avatar.Fallback>{userInitial}</Avatar.Fallback>
                    </Avatar.Root>
                    <div className="flex-1 text-left overflow-hidden">
                        <p className="text-sm font-medium text-white truncate">{userEmail}</p>
                        <p className="text-xs text-gray-400 truncate">Free Plan</p>
                    </div>
                    <ChevronUp className="h-4 w-4 text-gray-500 group-hover:text-gray-300" />
                </button>
            </Popover.Trigger>

            <Popover.Portal>
                <Popover.Content
                    className="w-64 rounded-xl glass border border-white/20 shadow-2xl p-2 mb-2 z-[100] flex flex-col gap-1.5 animate-in fade-in zoom-in-95 duration-200 outline-none"
                    side="top"
                    align="start"
                    sideOffset={8}
                >
                    <div className="px-3 py-2.5 border-b border-white/10 mb-1">
                        <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] mb-1.5">Authenticated As</p>
                        <p className="text-sm font-semibold text-white truncate mb-2">{userEmail}</p>
                        <div className="flex items-center gap-2 px-2 py-1 rounded-full bg-accent/20 border border-accent/20 w-fit">
                            <div className="h-1.5 w-1.5 rounded-full bg-[rgb(var(--accent-rgb))] animate-pulse" />
                            <span className="text-[10px] font-bold text-[rgb(var(--accent-rgb))] uppercase tracking-wider">Free Plan</span>
                        </div>
                    </div>

                    <button
                        onClick={handleSignOut}
                        className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-all group outline-none"
                    >
                        <div className="p-2 rounded-md bg-red-500/10 group-hover:bg-red-500/20 transition-colors">
                            <LogOut className="h-4 w-4" />
                        </div>
                        <span className="font-semibold">Sign Out</span>
                    </button>
                    <Popover.Arrow className="fill-white/10" />
                </Popover.Content>
            </Popover.Portal>
        </Popover.Root>
    )
}
