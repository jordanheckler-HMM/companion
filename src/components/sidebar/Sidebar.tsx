import { useState } from 'react'
import { Home, FileText, Puzzle, Settings, ChevronLeft, ChevronRight, Calendar, Github, Database, Bot, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useStore } from '@/store'
import logo from '@/assets/logo.png'
import { UserProfile } from '@/components/auth/UserProfile'
import { LayoutGrid } from 'lucide-react'



interface NavItemProps {
  icon: React.ElementType
  label: string
  collapsed: boolean
  active?: boolean
  onClick?: () => void
}

function NavItem({ icon: Icon, label, collapsed, active, onClick }: NavItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 w-full px-3 py-2.5 rounded-lg transition-all text-sm font-medium relative group',
        'hover:glass hover:text-foreground',
        active && 'glass text-foreground',
        !active && 'text-muted-foreground',
        collapsed && 'justify-center'
      )}
    >
      {active && (
        <div
          className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full"
          style={{ backgroundColor: 'rgb(var(--accent-rgb))' }}
        />
      )}
      <Icon className={cn("h-4 w-4 flex-shrink-0", active && "text-[rgb(var(--accent-rgb))]")} />
      {!collapsed && <span className="truncate">{label}</span>}
    </button>
  )
}

interface SidebarProps {
  currentView?: string
  onViewChange?: (view: string) => void
}

const APP_CONFIG: Record<string, { icon: any, label: string, view: string }> = {
  'Google Calendar': { icon: Calendar, label: 'Google Calendar', view: 'calendar' },
  'Notion': { icon: Database, label: 'Notion', view: 'notion' },
  'GitHub': { icon: Github, label: 'GitHub', view: 'github' },
  'Supabase': { icon: Database, label: 'Supabase', view: 'supabase' }
}


export function Sidebar({ currentView = 'home', onViewChange }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(true)
  const { settings } = useStore()

  const connectedApps = [
    (settings.aiSettings.googleCalendarApiKey || settings.aiSettings.googleCalendarOAuthToken) ? 'Google Calendar' : null,
    settings.aiSettings.notionApiKey ? 'Notion' : null,
    settings.aiSettings.githubApiKey ? 'GitHub' : null,
    settings.aiSettings.toolsEnabled?.supabase?.enabled ? 'Supabase' : null
  ].filter(Boolean) as string[]


  return (
    <aside
      className={cn(
        'h-screen glass-sidebar transition-all duration-300 flex flex-col border-r border-white/10 relative z-[70] flex-shrink-0',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Header */}
      <div className={cn(
        "p-4 border-b border-white/10 flex items-center gap-3",
        collapsed && "flex-col px-2 py-6 gap-4"
      )}>
        <div className="h-8 w-8 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center relative bg-black shadow-lg border border-white/20">
          <img
            src={logo}
            alt="Logo"
            className="w-full h-full object-cover scale-110 mix-blend-screen"
          />
          <div className="absolute inset-0 bg-accent mix-blend-color opacity-70 pointer-events-none" />
        </div>
        {!collapsed && (
          <h1 className="font-bold text-lg transition-opacity duration-300 truncate">
            Companion
          </h1>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "glass-hover p-1.5 rounded-md transition-all",
            !collapsed && "ml-auto"
          )}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        <NavItem
          icon={Home}
          label="Home"
          collapsed={collapsed}
          active={currentView === 'home'}
          onClick={() => onViewChange?.('home')}
        />
        <NavItem
          icon={FileText}
          label="Files"
          collapsed={collapsed}
          active={currentView === 'files'}
          onClick={() => onViewChange?.('files')}
        />
        <NavItem
          icon={Bot}
          label="Agents"
          collapsed={collapsed}
          active={currentView === 'agents'}
          onClick={() => onViewChange?.('agents')}
        />
        <NavItem
          icon={Puzzle}
          label="Integrations"
          collapsed={collapsed}
          active={currentView === 'integrations'}
          onClick={() => onViewChange?.('integrations')}
        />
        <NavItem
          icon={Users}
          label="Teams"
          collapsed={collapsed}
          active={currentView === 'teams'}
          onClick={() => onViewChange?.('teams')}
        />

        <div className="h-px bg-white/10 my-2" />

        <NavItem
          icon={LayoutGrid}
          label="Agent Store"
          collapsed={collapsed}
          active={currentView === 'store'}
          onClick={() => onViewChange?.('store')}
        />


        {/* Divider */}
        {connectedApps.length > 0 && <div className="h-px bg-white/10 my-2" />}

        {/* Connected Apps Section */}
        {connectedApps.length > 0 && !collapsed && (
          <div className="px-3 py-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Connected
            </p>
          </div>
        )}

        {/* Connected Apps List */}
        {connectedApps.map((appName) => {
          const config = APP_CONFIG[appName]
          if (!config) return null

          return (
            <NavItem
              key={appName}
              icon={config.icon}
              label={config.label}
              collapsed={collapsed}
              active={currentView === config.view}
              onClick={() => onViewChange?.(config.view)}
            />
          )
        })}
      </nav>


      <div className="mt-auto border-t border-white/10">
        <UserProfile />
      </div>

      {/* Footer */}

      <div className="p-2 border-t border-white/10">
        <Button
          variant="ghost"
          size={collapsed ? 'icon' : 'default'}
          className="w-full glass-hover justify-start"
          onClick={() => onViewChange?.('settings')}
        >
          <Settings className="h-4 w-4" />
          {!collapsed && <span className="ml-2">Settings</span>}
        </Button>
      </div>
    </aside>
  )
}
