import { audioService } from './AudioService'
import { useStore } from '../store'

export class TextToSpeechService {
    private currentUtterance: SpeechSynthesisUtterance | null = null

    /**
     * Speak text using the configured engine
     */
    async speak(text: string): Promise<void> {
        const settings = useStore.getState().settings.voiceSettings

        if (settings.ttsEngine === 'cloud') {
            return this.speakCloud(text)
        } else {
            return this.speakLocal(text)
        }
    }

    /**
     * Stop current speech
     */
    stop(): void {
        window.speechSynthesis.cancel()
        this.currentUtterance = null
    }

    /**
     * Speak using OpenAI TTS API
     */
    private async speakCloud(text: string): Promise<void> {
        const { openaiApiKey } = useStore.getState().settings.aiSettings
        const { cloudVoice, speakingRate } = useStore.getState().settings.voiceSettings

        if (!openaiApiKey) {
            throw new Error('OpenAI API key not configured')
        }

        try {
            const response = await fetch('https://api.openai.com/v1/audio/speech', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${openaiApiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'tts-1',
                    input: text,
                    voice: cloudVoice,
                    speed: speakingRate,
                }),
            })

            if (!response.ok) {
                throw new Error(`OpenAI TTS API error: ${response.statusText}`)
            }

            const audioBuffer = await response.arrayBuffer()
            await audioService.playAudio(audioBuffer)
        } catch (error) {
            console.error('Cloud TTS error:', error)
            throw new Error('Failed to generate speech with cloud service')
        }
    }

    /**
     * Speak using macOS native voices (Web Speech API)
     */
    private async speakLocal(text: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const { localVoice, speakingRate } = useStore.getState().settings.voiceSettings

            this.currentUtterance = new SpeechSynthesisUtterance(text)

            // Find the selected voice
            const voices = audioService.getAvailableVoices()
            const selectedVoice = voices.find(v => v.name === localVoice)

            if (selectedVoice) {
                this.currentUtterance.voice = selectedVoice
            }

            this.currentUtterance.rate = speakingRate

            this.currentUtterance.onend = () => {
                this.currentUtterance = null
                resolve()
            }

            this.currentUtterance.onerror = (event) => {
                this.currentUtterance = null
                reject(new Error(`Speech synthesis error: ${event.error}`))
            }

            window.speechSynthesis.speak(this.currentUtterance)
        })
    }
}

export const textToSpeechService = new TextToSpeechService()
