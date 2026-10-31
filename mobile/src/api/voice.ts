// Voice / dictation helpers mirroring web composer.js + voice.js + speech.js (ds-bot 0.2.4).
// Web uses browser SpeechRecognition + speechSynthesis (and optional DSH Voice Input plugin).
// Mobile uses Android SpeechRecognizer (expo-speech-recognition) + expo-speech TTS — same UX, no server API.

export const VOICE = {
  dictate: '听写',
  stopDictate: '停止听写',
  startVoice: '开始语音对话',
  voiceChat: '语音对话',
  listening: '在听',
  thinking: '思考中',
  thinkingEllipsis: '思考中…',
  speaking: '在说',
  paused: '已暂停',
  recognizing: '识别中…',
  unsupported: '这个设备不支持语音对话',
  dictateUnsupported: '这个设备不支持听写',
  micBlocked: '麦克风权限被阻止了',
  couldntHear: '没听清',
  couldntStart: '无法开始听写',
  pause: '暂停',
  resume: '继续听',
  end: '结束语音对话',
  withName: (name: string) => `和 ${name} 语音对话`,
};

/** Strip markdown / code so TTS reads clean prose (web voice.js plainSpeech). */
export function plainSpeech(text: string): string {
  return String(text ?? '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`#>|~-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function dictationErrorNote(code?: string): string {
  if (code === 'not-allowed' || code === 'service-not-allowed' || code === 'audio-capture') return VOICE.micBlocked;
  if (code === 'aborted' || code === 'no-speech' || code === 'no-match' || code === 'speech-timeout') return '';
  return VOICE.couldntHear;
}
