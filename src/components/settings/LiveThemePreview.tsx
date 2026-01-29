import React from 'react'
import { useSettings } from '../../store'

export const LiveThemePreview: React.FC = () => {
    const settings = useSettings()

    // Calculate dynamic styles based on settings
    const glassBg = settings.theme === 'glass-obsidian' ? '10 10 12' : '255 255 255'
    const opacity = settings.glassIntensity / 100
    const tintOpacity = (settings.glassIntensity / 100) * (settings.accentTintStrength / 100)
    const blur = settings.glassBlur / 2.5

    return (
        <div className="mt-4 p-4 rounded-xl border border-foreground/5 bg-black/20 overflow-hidden relative min-h-[120px] flex items-center justify-center">
            {/* Background patterns to show transparency */}
            <div className="absolute inset-0 opacity-20 pointer-events-none">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary-accent rounded-full blur-3xl" />
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-primary-accent opacity-50 rounded-full blur-3xl" />
                <div className="grid grid-cols-8 gap-2 w-full h-full opacity-10">
                    {Array.from({ length: 32 }).map((_, i) => (
                        <div key={i} className="bg-foreground w-1 h-1 rounded-full" />
                    ))}
                </div>
            </div>

            {/* The preview pane */}
            <div
                className="w-full max-w-[200px] p-4 rounded-lg shadow-2xl border relative z-10"
                style={{
                    background: `linear-gradient(135deg, rgba(${glassBg}, ${opacity}), rgba(var(--accent-rgb), ${tintOpacity}))`,
                    backdropFilter: `blur(${blur}px)`,
                    WebkitBackdropFilter: `blur(${blur}px)`,
                    borderColor: `rgba(255, 255, 255, ${opacity * 0.5})`
                }}
            >
                <div className="h-2 w-12 bg-primary-accent rounded-full mb-3 mb-2" />
                <div className="space-y-1.5">
                    <div className="h-1.5 w-full bg-foreground/20 rounded-full" />
                    <div className="h-1.5 w-3/4 bg-foreground/15 rounded-full" />
                    <div className="h-1.5 w-5/6 bg-foreground/10 rounded-full" />
                </div>
                <p className="mt-3 text-[10px] font-medium text-foreground tracking-tight opacity-80">
                    PREVIEW WINDOW
                </p>
            </div>
        </div>
    )
}
