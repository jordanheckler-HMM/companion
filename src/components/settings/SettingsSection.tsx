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
        <div className="mb-4 border-b border-foreground/5 pb-4 last:border-0 last:pb-0">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex w-full items-center justify-between py-2 text-left transition-colors hover:text-accent-foreground"
            >
                <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground/60">
                    {title}
                </h3>
                <ChevronDown
                    className={`h-4 w-4 transition-transform duration-200 ${isOpen ? '' : '-rotate-90'}`}
                />
            </button>

            <div className={`mt-2 overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                {children}
            </div>
        </div>
    )
}
