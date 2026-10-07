import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Play, Send, Bot, User as UserIcon, Volume2, VolumeX, ChevronLeft, ChevronRight, Maximize, Bookmark, Type, MessageSquare, Loader2 } from 'lucide-react';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { ScrollArea } from '../components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { toast } from 'sonner';
import { searchSigns, videoUrl, type SearchResult } from '../../lib/signverseApi';
import { logActivityEvent, listFavorites, addFavorite, removeFavorite } from '../../lib/activityApi';

const ALPHABET = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));

// ── Types ──────────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  type: 'user' | 'bot';
  text: string;
  results?: SearchResult[];   // one entry per word in the query
  timestamp: Date;
  isError?: boolean;
}

// ── Video Card ─────────────────────────────────────────────────────────────────
// Shows a real <video> from the Flask /api/video/<id> endpoint.

function SignVideoCard({ result, isFavorite, onToggleFavorite }: {
  result: SearchResult;
  isFavorite?: boolean;
  onToggleFavorite?: (word: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggle = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setPlaying(true); }
    else           { v.pause(); setPlaying(false); }
  };

  const toggleFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const matchColor =
    result.match_type === 'exact'  ? 'bg-green-100 text-green-700 border-green-300' :
    result.match_type === 'fuzzy'  ? 'bg-yellow-100 text-yellow-700 border-yellow-300' :
                                     'bg-red-100 text-red-700 border-red-300';

  // Word not found — show a simple tile (still bookmarkable, since the video
  // dataset may not have this word's clip yet even if the user wants to track it)
  if (!result.video || result.match_type === 'none') {
    return (
      <div className="bg-white rounded-xl p-3 flex items-center justify-between gap-3 border border-red-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
            <span className="text-lg">🤷</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800 capitalize">{result.input_word}</p>
            <span className={`text-xs px-2 py-0.5 rounded-full border ${matchColor}`}>not found</span>
          </div>
        </div>
        {onToggleFavorite && (
          <button
            onClick={() => onToggleFavorite(result.input_word)}
            title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            className={`p-1 rounded-full transition-colors shrink-0 ${isFavorite ? 'text-amber-500 hover:text-amber-600' : 'text-gray-300 hover:text-amber-400'}`}
          >
            <Bookmark className="w-4 h-4" fill={isFavorite ? 'currentColor' : 'none'} />
          </button>
        )}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl overflow-hidden border border-gray-100 shadow-sm"
    >
      {/* Word + badge */}
      <div className="flex items-center justify-between px-3 pt-3 pb-1">
        <div>
          <p className="text-sm font-semibold text-gray-800 capitalize">{result.matched_word}</p>
          {result.matched_word !== result.input_word && (
            <p className="text-xs text-gray-400">for "{result.input_word}"</p>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`text-xs px-2 py-0.5 rounded-full border ${matchColor}`}>
            {result.match_type}
          </span>
          {onToggleFavorite && (
            <button
              onClick={() => onToggleFavorite(result.matched_word ?? result.input_word)}
              title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              className={`p-1 rounded-full transition-colors ${isFavorite ? 'text-amber-500 hover:text-amber-600' : 'text-gray-300 hover:text-amber-400'}`}
            >
              <Bookmark className="w-4 h-4" fill={isFavorite ? 'currentColor' : 'none'} />
            </button>
          )}
        </div>
      </div>

      {/* Video */}
      <div ref={containerRef} className={`relative overflow-hidden bg-gray-900 ${isFullscreen ? 'w-screen h-screen' : 'mx-3 mb-3 rounded-lg aspect-video'}`}>
        <video
          ref={videoRef}
          src={videoUrl(result.video.id)}
          muted={muted}
          loop
          playsInline
          className={`w-full h-full ${isFullscreen ? 'object-contain' : 'object-cover'}`}
          onEnded={() => setPlaying(false)}
        />

        {/* Overlay controls */}
        <div className="absolute inset-0 flex items-center justify-center">
          <AnimatePresence>
            {!playing && (
              <motion.button
                key="play"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                onClick={toggle}
                className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center shadow-lg hover:bg-white transition-colors"
              >
                <Play className="w-5 h-5 text-teal-700 ml-0.5" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {/* Bottom bar */}
        <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-2 py-1 bg-gradient-to-t from-black/60 to-transparent">
          <button onClick={toggle} className="text-white/80 hover:text-white text-xs">
            {playing ? '⏸ Pause' : '▶ Play'}
          </button>
          <div className="flex items-center gap-2">
            <button onClick={() => setMuted(m => !m)} className="text-white/80 hover:text-white">
              {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            </button>
            <button onClick={toggleFullscreen} className="text-white/80 hover:text-white" title="Fullscreen">
              <Maximize className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ── Sentence result — carousel of word cards ──────────────────────────────────

function SentenceResults({ results, favorites, onToggleFavorite }: {
  results: SearchResult[];
  favorites?: Set<string>;
  onToggleFavorite?: (word: string) => void;
}) {
  const [index, setIndex] = useState(0);
  const matched = results.filter(r => r.match_type !== 'none');
  const total   = results.length;

  if (total === 0) return null;

  const isFav = (r: SearchResult) => favorites?.has((r.matched_word ?? r.input_word).toLowerCase()) ?? false;

  // Single word — no carousel chrome needed
  if (total === 1) return <SignVideoCard result={results[0]} isFavorite={isFav(results[0])} onToggleFavorite={onToggleFavorite} />;

  return (
    <div className="space-y-2">
      {/* Word pill strip */}
      <div className="flex flex-wrap gap-1">
        {results.map((r, i) => (
          <button key={i} onClick={() => setIndex(i)}
            className={`text-xs px-2 py-0.5 rounded-full border transition-all capitalize ${
              i === index
                ? 'bg-teal-700 text-white border-teal-700'
                : r.match_type === 'none'
                  ? 'bg-red-50 text-red-500 border-red-200'
                  : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-teal-50'
            }`}>
            {r.input_word}
          </button>
        ))}
      </div>

      {/* Current card */}
      <AnimatePresence mode="wait">
        <motion.div key={index} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
          <SignVideoCard result={results[index]} isFavorite={isFav(results[index])} onToggleFavorite={onToggleFavorite} />
        </motion.div>
      </AnimatePresence>

      {/* Prev / Next */}
      <div className="flex items-center justify-between text-xs text-gray-400">
        <button onClick={() => setIndex(i => Math.max(0, i - 1))} disabled={index === 0}
          className="flex items-center gap-1 disabled:opacity-30 hover:text-gray-600">
          <ChevronLeft className="w-3 h-3" /> Prev
        </button>
        <span>{index + 1} / {total} · {matched.length} found</span>
        <button onClick={() => setIndex(i => Math.min(total - 1, i + 1))} disabled={index === total - 1}
          className="flex items-center gap-1 disabled:opacity-30 hover:text-gray-600">
          Next <ChevronRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

// ── Alphabet tab — grid of A-Z, tap a letter to watch its sign video ──────────

function AlphabetGrid({ favorites, onToggleFavorite }: {
  favorites: Set<string>;
  onToggleFavorite: (word: string) => void;
}) {
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);
  const [letterResult, setLetterResult]     = useState<SearchResult | null>(null);
  const [letterLoading, setLetterLoading]   = useState(false);

  const handleLetterClick = useCallback(async (letter: string) => {
    setSelectedLetter(letter);
    setLetterResult(null);
    setLetterLoading(true);
    try {
      const data = await searchSigns(letter);
      setLetterResult(data.results[0] ?? null);
    } catch {
      setLetterResult(null);
    } finally {
      setLetterLoading(false);
    }
  }, []);

  return (
    <>
      <Card className="shadow-2xl shadow-teal-900/10 border-2 border-teal-900/10 bg-white/90 backdrop-blur-sm">
        <CardContent className="p-4 sm:p-6 space-y-5">
          {/* 26 Letters banner */}
          <div className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-teal-50 to-emerald-50 border border-teal-100 p-4">
            <div className="w-10 h-10 rounded-lg bg-teal-700 text-white flex items-center justify-center shrink-0">
              <Type className="w-5 h-5" />
            </div>
            <div>
              <p className="font-semibold text-gray-800">26 Letters</p>
              <p className="text-xs text-gray-500">Tap a letter to watch the video</p>
            </div>
          </div>

          <p className="text-xs font-semibold tracking-wide text-gray-400 uppercase">Learn the alphabet</p>

          {/* Letter grid */}
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
            {ALPHABET.map(letter => (
              <motion.button
                key={letter}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleLetterClick(letter)}
                className="aspect-square rounded-2xl bg-white border border-teal-100 shadow-sm flex items-center justify-center text-lg font-semibold text-teal-700 hover:bg-teal-50 hover:border-teal-300 transition-colors"
              >
                {letter}
              </motion.button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Letter detail dialog */}
      <Dialog open={!!selectedLetter} onOpenChange={open => !open && setSelectedLetter(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="capitalize">Letter {selectedLetter}</DialogTitle>
          </DialogHeader>

          {letterLoading ? (
            <div className="flex items-center justify-center py-10 text-gray-400">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : letterResult ? (
            <SignVideoCard
              result={letterResult}
              isFavorite={favorites.has((letterResult.matched_word ?? letterResult.input_word).toLowerCase())}
              onToggleFavorite={onToggleFavorite}
            />
          ) : (
            <p className="text-sm text-gray-500 text-center py-6">Video not available for this letter yet.</p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function SignDictionary() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'bot',
      text: "Hello!  I'm your AI sign language assistant powered by the SignTalk database. Type any word or full sentence and I'll show you the signs!",
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText]   = useState('');
  const [isTyping, setIsTyping]     = useState(false);
  const [favorites, setFavorites]   = useState<Set<string>>(new Set());
  const [view, setView]             = useState<'words' | 'alphabet'>('words');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load the signed-in user's favorites (silently ignored if not logged in)
  useEffect(() => {
    listFavorites()
      .then(data => setFavorites(new Set(data.favorites)))
      .catch(() => {});
  }, []);

  const toggleFavorite = useCallback(async (word: string) => {
    const key = word.toLowerCase();
    const wasFavorite = favorites.has(key);
    setFavorites(prev => {
      const next = new Set(prev);
      if (wasFavorite) next.delete(key); else next.add(key);
      return next;
    });
    try {
      if (wasFavorite) await removeFavorite(key); else await addFavorite(key);
    } catch (err) {
      setFavorites(prev => {
        const next = new Set(prev);
        if (wasFavorite) next.add(key); else next.delete(key);
        return next;
      });
      toast.error(err instanceof Error ? err.message : 'Sign in to save favorites');
    }
  }, [favorites]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current)
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isTyping]);

  // ── Send message ──────────────────────────────────────────

  const handleSend = useCallback(async () => {
    const query = inputText.trim();
    if (!query || isTyping) return;

    // Add user bubble immediately
    const userMsg: Message = {
      id: Date.now().toString(),
      type: 'user',
      text: query,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsTyping(true);

    try {
      const data = await searchSigns(query);
      const found = data.total_matched;
      const total = data.results.length;

      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        type: 'bot',
        text: found > 0
          ? total === 1
            ? `Here's the sign for "${data.results[0].matched_word}"!`
            : `Found ${found} of ${total} words in your sentence. Tap each word to see its sign.`
          : `Sorry, I couldn't find any signs for "${query}". Try a different word!`,
        results: data.results,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, botMsg]);
      if (found > 0) toast.success(`Found ${found} sign${found > 1 ? 's' : ''}!`);
      logActivityEvent('ai_query', { query });

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Backend unreachable';
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        type: 'bot',
        text: ` Couldn't reach the backend: ${msg}. Make sure your Flask server is running on port 5000.`,
        timestamp: new Date(),
        isError: true,
      }]);
      toast.error('Backend error — is Flask running?');
    } finally {
      setIsTyping(false);
    }
  }, [inputText, isTyping]);

  const suggestedQueries = ['hello', 'thank you', 'please help me', 'good morning', 'my name is'];

  // ── Render ────────────────────────────────────────────────

  return (
    <div className="relative">
      {/* Animated background blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {[
          { color: 'bg-teal-500/10', anim: { x:[0,100,0], y:[0,-50,0], scale:[1,1.2,1] }, dur: 20 },
          { color: 'bg-orange-500/10', anim: { x:[0,-100,0], y:[0,50,0], scale:[1,1.3,1] }, dur: 25 },
          { color: 'bg-emerald-500/10', anim: { scale:[1,1.5,1], rotate:[0,180,360] }, dur: 30 },
        ].map((b, i) => (
          <motion.div key={i}
            className={`absolute w-96 h-96 rounded-full blur-3xl ${b.color} ${i === 0 ? 'top-0 left-0' : i === 1 ? 'bottom-0 right-0' : 'top-1/2 left-1/2'}`}
            animate={b.anim as object} transition={{ duration: b.dur, repeat: Infinity, ease: 'linear' }} />
        ))}
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="relative z-10 max-w-5xl mx-auto space-y-6 px-4 sm:px-0">

        {/* Header */}
        <div className="space-y-2 text-center">
          <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }}>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold leading-[1.3] pb-1 bg-gradient-to-r from-teal-700 via-emerald-600 to-orange-500 bg-clip-text text-transparent px-4">
              AI Sign Language Assistant
            </h1>
          </motion.div>
          <p className="text-sm sm:text-base text-gray-600 px-4">Type any word or sentence and I'll show you the signs!</p>

          {/* Words / Alphabet tabs */}
          <div className="inline-flex items-center gap-1 rounded-full bg-gray-100 p-1 mx-auto">
            <button
              onClick={() => setView('words')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                view === 'words' ? 'bg-teal-700 text-white shadow' : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <MessageSquare className="w-4 h-4" /> Words
            </button>
            <button
              onClick={() => setView('alphabet')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                view === 'alphabet' ? 'bg-teal-700 text-white shadow' : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <Type className="w-4 h-4" /> Alphabet
            </button>
          </div>
        </div>

        {/* Alphabet panel */}
        {view === 'alphabet' && <AlphabetGrid favorites={favorites} onToggleFavorite={toggleFavorite} />}

        {/* Chat Container */}
        {view === 'words' && (
        <Card className="shadow-2xl shadow-teal-900/10 border-2 border-teal-900/10 bg-white/90 backdrop-blur-sm">
          <CardContent className="p-0">

            {/* Messages */}
            <ScrollArea className="h-[400px] sm:h-[500px] p-4 sm:p-6" ref={scrollRef}>
              <div className="space-y-4">
                <AnimatePresence>
                  {messages.map(message => (
                    <motion.div key={message.id}
                      initial={{ opacity: 0, y: 20, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.3 }}
                      className={`flex gap-3 ${message.type === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>

                      {/* Avatar */}
                      <motion.div whileHover={{ scale: 1.1, rotate: 5 }}
                        className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                          message.type === 'user'
                            ? 'bg-gradient-to-br from-teal-700 to-emerald-500'
                            : message.isError
                              ? 'bg-gradient-to-br from-red-400 to-orange-400'
                              : 'bg-gradient-to-br from-green-600 to-emerald-600'
                        }`}>
                        {message.type === 'user'
                          ? <UserIcon className="w-5 h-5 text-white" />
                          : <Bot className="w-5 h-5 text-white" />}
                      </motion.div>

                      {/* Bubble */}
                      <div className={`flex-1 min-w-0 ${message.type === 'user' ? 'text-right' : 'text-left'}`}>
                        <motion.div whileHover={{ scale: 1.01 }}
                          className={`inline-block max-w-[85%] rounded-2xl p-4 ${
                            message.type === 'user'
                              ? 'bg-gradient-to-r from-teal-700 to-emerald-500 text-white'
                              : message.isError
                                ? 'bg-red-50 text-red-800 border border-red-200'
                                : 'bg-gray-100 text-gray-900'
                          }`}>
                          <p className="text-sm leading-relaxed">{message.text}</p>

                          {/* Sign results */}
                          {message.results && message.results.length > 0 && (
                            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.15 }} className="mt-3">
                              <SentenceResults results={message.results} favorites={favorites} onToggleFavorite={toggleFavorite} />
                            </motion.div>
                          )}
                        </motion.div>

                        <p className="text-xs text-gray-500 mt-1 px-2">
                          {message.timestamp.toLocaleTimeString()}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {/* Typing indicator */}
                {isTyping && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="flex gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-600 to-emerald-600 flex items-center justify-center">
                      <Bot className="w-5 h-5 text-white" />
                    </div>
                    <div className="bg-gray-100 rounded-2xl p-4">
                      <div className="flex gap-1">
                        {[0, 0.2, 0.4].map((delay, i) => (
                          <motion.div key={i} animate={{ scale: [1, 1.5, 1] }}
                            transition={{ duration: 1, repeat: Infinity, delay }}
                            className="w-2 h-2 bg-gray-400 rounded-full" />
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
            </ScrollArea>

            {/* Input */}
            <div className="border-t p-4 bg-gray-50">
              {/* Suggested queries — only shown at start */}
              {messages.length <= 1 && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-4">
                  <p className="text-xs text-gray-600 mb-2">
                    Try asking:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {suggestedQueries.map((q, i) => (
                      <motion.div key={i} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                        <Badge variant="outline"
                          className="cursor-pointer hover:bg-teal-50 hover:border-teal-300"
                          onClick={() => setInputText(q)}>
                          {q}
                        </Badge>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}

              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Type a word or sentence…"
                    value={inputText}
                    onChange={e => setInputText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSend()}
                    className="pl-10 pr-4 py-6"
                  />
                </div>
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Button onClick={handleSend} disabled={!inputText.trim() || isTyping}
                    className="bg-gradient-to-r from-teal-700 via-emerald-600 to-orange-500 hover:opacity-90 h-full px-6">
                    <Send className="w-5 h-5" />
                  </Button>
                </motion.div>
              </div>
            </div>
          </CardContent>
        </Card>
        )}

        {/* Info cards */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }} className="grid md:grid-cols-3 gap-4">
          {[
            { icon: Bot, iconClass: 'text-teal-700', cardClass: 'bg-gradient-to-br from-teal-50 to-emerald-50 border-teal-200', title: 'Real Sign Database', desc: 'Backed by WLASL — thousands of real ASL signs' },
            { icon: Play, iconClass: 'text-orange-500', cardClass: 'bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200', title: 'Video Demonstrations', desc: 'Watch real video examples of every sign' },
            { icon: MessageSquare, iconClass: 'text-emerald-600', cardClass: 'bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200', title: 'Full Sentences', desc: 'Type whole sentences and see each word signed' },
          ].map(({ icon: Icon, iconClass, cardClass, title, desc }, i) => (
            <Card key={i} className={cardClass}>
              <CardContent className="pt-6 text-center">
                <Icon className={`w-10 h-10 ${iconClass} mx-auto mb-3`} />
                <h3 className="font-semibold mb-2">{title}</h3>
                <p className="text-sm text-gray-600">{desc}</p>
              </CardContent>
            </Card>
          ))}
        </motion.div>

      </motion.div>
    </div>
  );
}