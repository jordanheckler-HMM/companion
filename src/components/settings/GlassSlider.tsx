import React from 'react'

interface GlassSliderProps {
    label: string
    value: number
    min?: number
    max?: number
    step?: number
    onChange: (value: number) => void
    suffix?: string
}

export const GlassSlider: React.FC<GlassSliderProps> = ({
    label,
    value,
    min = 0,
    max = 100,
    step = 1,
    onChange,
    suffix = '%'
}) => {
    return (
        <div className="mb-4">
            <div className="flex justify-between mb-2">
                <label className="text-sm font-medium text-foreground/80">{label}</label>
                <span className="text-xs font-mono bg-foreground/5 px-1.5 py-0.5 rounded">
                    {value}{suffix}
                </span>
            </div>
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => onChange(parseInt(e.target.value))}
                className="w-full h-1.5 bg-foreground/10 rounded-lg appearance-none cursor-pointer accent-primary-accent"
            />
        </div>
    )
}
