import { useStore } from '../store'


export class SpeechToTextService {
    /**
     * Transcribe audio to text using the configured engine
     */
    async transcribe(audioBlob: Blob): Promise<string> {
        const settings = useStore.getState().settings.voiceSettings

        if (settings.sttEngine === 'cloud') {
            return this.transcribeCloud(audioBlob)
        } else {
            return this.transcribeLocal(audioBlob)
        }
    }

    /**
     * Transcribe using OpenAI Whisper API
     */
    private async transcribeCloud(audioBlob: Blob): Promise<string> {
        const { openaiApiKey } = useStore.getState().settings.aiSettings

        if (!openaiApiKey) {
            throw new Error('OpenAI API key not configured')
        }

        const formData = new FormData()
        formData.append('file', audioBlob, 'audio.webm')
        formData.append('model', 'whisper-1')

        try {
            const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${openaiApiKey}`,
                },
                body: formData,
            })

            if (!response.ok) {
                throw new Error(`OpenAI API error: ${response.statusText}`)
            }

            const data = await response.json()
            return data.text
        } catch (error) {
            console.error('Cloud STT error:', error)
            throw new Error('Failed to transcribe audio with cloud service')
        }
    }

    /**
     * Transcribe using local Whisper.cpp (via Tauri sidecar)
     * TODO: Implement Whisper.cpp sidecar integration
     */
    private async transcribeLocal(_audioBlob: Blob): Promise<string> {
        // For now, fall back to Web Speech API as a placeholder
        // This will be replaced with Whisper.cpp sidecar
        return this.transcribeWebSpeechAPI()
    }

    /**
     * Fallback: Use browser's Web Speech API (less accurate)
     */
    private async transcribeWebSpeechAPI(): Promise<string> {
        return new Promise((resolve, reject) => {
            const recognition = new (window as any).webkitSpeechRecognition()
            recognition.continuous = false
            recognition.interimResults = false

            recognition.onresult = (event: any) => {
                const transcript = event.results[0][0].transcript
                resolve(transcript)
            }

            recognition.onerror = (event: any) => {
                reject(new Error(`Speech recognition error: ${event.error}`))
            }

            recognition.start()
        })
    }
}

export const speechToTextService = new SpeechToTextService()
