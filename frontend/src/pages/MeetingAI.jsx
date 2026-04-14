import { useState, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Mic, MicOff, Sparkles, Trash2, Copy, Check, Loader2, Radio } from 'lucide-react';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';

export default function MeetingAI() {
  const { user } = useOutletContext();
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimText, setInterimText] = useState('');
  const [summary, setSummary] = useState('');
  const [summarizing, setSummarizing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const recognitionRef = useRef(null);
  const transcriptRef = useRef('');
  const transcriptEndRef = useRef(null);

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript, interimText]);

  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('Speech recognition is not supported in this browser. Please use Chrome or Edge.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += text + ' ';
        } else {
          interim += text;
        }
      }
      if (final) {
        setTranscript(prev => prev + final);
      }
      setInterimText(interim);
    };

    recognition.onerror = (e) => {
      if (e.error !== 'no-speech') {
        setError(`Microphone error: ${e.error}`);
        setIsListening(false);
      }
    };

    recognition.onend = () => {
      if (recognitionRef.current) {
        recognitionRef.current.start();
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
    setError('');
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
    setInterimText('');
  };

  const handleSummarize = async () => {
    const text = transcript.trim();
    if (!text) return;
    setSummarizing(true);
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are an expert meeting assistant. Analyze the following meeting transcript and provide:

1. **Meeting Summary** — A concise 2-3 sentence overview of what was discussed.
2. **Key Points** — Bullet list of the most important topics and decisions.
3. **Action Items** — Specific tasks or follow-ups mentioned, with owner if identifiable.
4. **Decisions Made** — Any clear decisions or conclusions reached.

Be concise and actionable. Format using markdown.

Transcript:
${text}`,
      model: 'claude_sonnet_4_6',
    });
    setSummary(result);
    setSummarizing(false);
  };

  const handleCopy = () => {
    const full = `TRANSCRIPT:\n${transcript}\n\nSUMMARY:\n${summary}`;
    navigator.clipboard.writeText(full);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClear = () => {
    stopListening();
    setTranscript('');
    setInterimText('');
    setSummary('');
    setError('');
  };

  const wordCount = transcript.trim().split(/\s+/).filter(Boolean).length;

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 animate-fade-in">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-cal font-semibold text-foreground flex items-center gap-2">
              <Radio className="w-6 h-6 text-primary" />
              Meeting AI
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Real-time transcription & AI-powered meeting summaries</p>
          </div>
          {transcript && (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={handleCopy} className="gap-1.5">
                {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied' : 'Copy All'}
              </Button>
              <Button variant="ghost" size="sm" onClick={handleClear} className="gap-1.5 text-destructive hover:text-destructive">
                <Trash2 className="w-3.5 h-3.5" /> Clear
              </Button>
            </div>
          )}
        </div>

        {error && (
          <div className="mb-4 p-3 bg-destructive/10 border border-destructive/30 rounded-xl text-sm text-destructive">
            {error}
          </div>
        )}

        <Card className="p-6 border border-border/60 mb-6">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <button
              onClick={isListening ? stopListening : startListening}
              className={cn(
                'relative w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-lg select-none',
                isListening
                  ? 'bg-red-500 hover:bg-red-600 text-white'
                  : 'bg-primary hover:bg-primary/90 text-primary-foreground'
              )}
            >
              {isListening && (
                <span className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-40" />
              )}
              {isListening ? <MicOff className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
            </button>

            <div className="flex-1 text-center sm:text-left">
              <p className="font-semibold text-foreground text-lg">
                {isListening ? 'Listening...' : 'Ready to record'}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {isListening
                  ? 'Speak clearly — everything is being transcribed in real time.'
                  : 'Press the mic button to start transcribing your meeting.'}
              </p>
              {wordCount > 0 && (
                <Badge variant="outline" className="mt-2 text-xs">
                  {wordCount} words transcribed
                </Badge>
              )}
            </div>

            <Button
              onClick={handleSummarize}
              disabled={!transcript.trim() || summarizing}
              className="gap-2 shrink-0"
            >
              {summarizing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {summarizing ? 'Summarizing...' : 'Summarize'}
            </Button>
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border border-border/60 flex flex-col">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h2 className="font-semibold text-foreground text-sm flex items-center gap-2">
                {isListening && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
                Live Transcript
              </h2>
              {transcript && (
                <button onClick={() => { setTranscript(''); setInterimText(''); }} className="text-xs text-muted-foreground hover:text-destructive transition-colors">
                  Clear
                </button>
              )}
            </div>
            <div className="flex-1 p-5 overflow-y-auto max-h-80 scrollbar-thin">
              {!transcript && !interimText ? (
                <div className="flex flex-col items-center justify-center h-32 text-center">
                  <Mic className="w-8 h-8 text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground">Transcript will appear here as you speak</p>
                </div>
              ) : (
                <div className="text-sm text-foreground leading-relaxed">
                  <span>{transcript}</span>
                  {interimText && (
                    <span className="text-muted-foreground italic">{interimText}</span>
                  )}
                  <div ref={transcriptEndRef} />
                </div>
              )}
            </div>
          </Card>

          <Card className="border border-border/60 flex flex-col">
            <div className="px-5 py-4 border-b border-border flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <h2 className="font-semibold text-foreground text-sm">AI Summary</h2>
            </div>
            <div className="flex-1 p-5 overflow-y-auto max-h-80 scrollbar-thin">
              {summarizing ? (
                <div className="flex flex-col items-center justify-center h-32 gap-3">
                  <Loader2 className="w-7 h-7 text-primary animate-spin" />
                  <p className="text-sm text-muted-foreground">Analyzing meeting content...</p>
                </div>
              ) : summary ? (
                <ReactMarkdown className="text-sm prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_ul]:my-1 [&_li]:my-0.5 [&_h2]:text-sm [&_h2]:font-semibold [&_h3]:text-sm [&_h3]:font-semibold [&_strong]:font-semibold">
                  {summary}
                </ReactMarkdown>
              ) : (
                <div className="flex flex-col items-center justify-center h-32 text-center">
                  <Sparkles className="w-8 h-8 text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground">Click "Summarize" to get an AI-powered summary of your meeting</p>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
