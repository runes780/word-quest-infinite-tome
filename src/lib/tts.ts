let speechSynth: SpeechSynthesis | null = null;

function getSynth() {
    if (typeof window === 'undefined') return null;
    if (!speechSynth) {
        speechSynth = window.speechSynthesis || null;
    }
    return speechSynth;
}

export function speakText(text: string, lang: string) {
    const synth = getSynth();
    if (!synth || !text) return;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 1;
    utterance.pitch = 1;
    synth.speak(utterance);
}

export function stopSpeech() {
    const synth = getSynth();
    if (!synth) return;
    synth.cancel();
}
