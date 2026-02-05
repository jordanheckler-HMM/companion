import React, { useState } from 'react'
import { ChevronDown } from 'lucide-react'

interface SettingsSectionProps {
    title: string
    children: React.ReactNode
    defaultOpen?: boolean
}

export const SettingsSection: React.FC<SettingsSectionProps> = ({
    title,
    children,
    defaultOpen = true
}) => {
    const [isOpen, setIsOpen] = useState(defaultOpen)

    return (
        <div className="mb-3 border-b border-foreground/5 pb-3 last:border-0 last:pb-0">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex w-full items-center justify-between py-1.5 text-left transition-colors hover:text-accent-foreground"
            >
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-foreground/60">
                    {title}
                </h3>
                <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform duration-200 ${isOpen ? '' : '-rotate-90'}`}
                />
            </button>

            <div className={`mt-2 overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                {children}
            </div>
        </div>
    )
}
