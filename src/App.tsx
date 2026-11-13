import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { 
  Menu,
  Sparkles,
  BookOpen,
  Gamepad2,
  Trophy,
  ChefHat,
  Leaf,
  Wand,
  Flame,
  Bell,
  User,
  Paperclip,
  Check,
  Image as ImageIcon,
  Brain,
  FileText,
  Map as MapIcon,
  Volume2,
  X,
  ChevronDown,
  ArrowRight,
  Clock,
  ArrowUp
} from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'ai';
  content: string;
  type: 'text' | 'image_analysis' | 'error_correction' | 'story' | 'cheat_sheet';
  imageUrl?: string;
  imageSearchDone?: boolean;
  conceptImages?: {
    url: string;
    thumbUrl: string;
    title: string;
    descriptionUrl: string;
    artist: string;
    license: string;
    licenseUrl: string;
  }[];
  youtubeQuery?: string;
  timestamp: number;
  analogyContext?: string;
  studyData?: {
    quiz?: QuizQuestion[];
    flashcards?: Flashcard[];
    mindmap?: MindMapNode;
  };
}

interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

interface Flashcard {
  front: string;
  back: string;
}

interface MindMapNode {
  label: string;
  children?: MindMapNode[];
}

type ContextType = 'Everyday life' | 'Minecraft' | 'Football' | 'Cooking' | 'Nature' | 'Custom';

interface Session {
  id: string;
  title: string;
  context: string;
  count: number;
  date: string;
}

const CONTEXTS: { id: ContextType; icon: React.ReactNode }[] = [
  { id: 'Everyday life', icon: <BookOpen size={16} className="transition-all duration-300 group-hover:scale-125 group-hover:rotate-6 text-[#9A5B38]" /> },
  { id: 'Minecraft', icon: <Gamepad2 size={16} className="transition-all duration-300 group-hover:scale-125 group-hover:-rotate-6 text-[#9A5B38]" /> },
  { id: 'Football', icon: <Trophy size={16} className="transition-all duration-300 group-hover:scale-125 group-hover:rotate-6 text-[#9A5B38]" /> },
  { id: 'Cooking', icon: <ChefHat size={16} className="transition-all duration-300 group-hover:scale-125 group-hover:rotate-6 text-[#9A5B38]" /> },
  { id: 'Nature', icon: <Leaf size={16} className="transition-all duration-300 group-hover:scale-125 group-hover:-rotate-6 text-[#9A5B38]" /> },
  { id: 'Custom', icon: <Wand size={16} className="transition-all duration-300 group-hover:scale-125 group-hover:rotate-45 text-[#9A5B38]" /> }
];

const INITIAL_HISTORY: Session[] = [
  { id: '1', title: 'Understanding Black Holes', context: 'Everyday life', count: 4, date: 'Today, 10:24 AM' },
  { id: '2', title: 'How CPUs Process Data', context: 'Minecraft', count: 12, date: 'Yesterday' },
];


function extractJsonPayload(raw: string): any | null {
  const text = String(raw || "").trim();
  if (!text) return null;

  const candidates = [
    text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim()
  ];

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.push(text.slice(firstBrace, lastBrace + 1));
  }

  for (const candidate of candidates) {
    try {
      let parsed: any = JSON.parse(candidate);
      // Occasionally a model wraps the JSON object inside a JSON string.
      if (typeof parsed === "string") {
        try { parsed = JSON.parse(parsed); } catch { /* keep original string */ }
      }
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
    } catch {
      // Try the next candidate.
    }
  }
  return null;
}

function normalizeStudyResponse(raw: string, query: string) {
  const parsed = extractJsonPayload(raw);
  if (!parsed) {
    // If the response looks like broken JSON, never show the raw object/code to learners.
    const looksLikeJson = /^\s*[\[{]/.test(raw || "");
    return {
      content: looksLikeJson
        ? `I couldn't format the explanation correctly this time. Please try asking about **${query}** again.`
        : (raw || `I couldn't generate an explanation for **${query}**. Please try again.`),
      youtube_search_query: query,
      studyData: undefined
    };
  }

  const content = typeof parsed.content === "string" ? parsed.content.trim() : "";
  const nestedStudyData = parsed.studyData && typeof parsed.studyData === "object"
    ? parsed.studyData
    : {};

  const quiz = Array.isArray(nestedStudyData.quiz)
    ? nestedStudyData.quiz.filter((item: any) =>
        item && typeof item.question === "string" &&
        Array.isArray(item.options) && item.options.length >= 2 &&
        Number.isInteger(item.correctIndex) &&
        item.correctIndex >= 0 && item.correctIndex < item.options.length
      )
    : undefined;

  const flashcards = Array.isArray(nestedStudyData.flashcards)
    ? nestedStudyData.flashcards.filter((item: any) =>
        item && typeof item.front === "string" && typeof item.back === "string"
      )
    : undefined;

  const isMindMapNode = (node: any, depth = 0): boolean =>
    !!node && typeof node.label === "string" && depth < 12 &&
    (node.children === undefined ||
      (Array.isArray(node.children) && node.children.every((child: any) => isMindMapNode(child, depth + 1))));

  const mindmap = isMindMapNode(nestedStudyData.mindmap) ? nestedStudyData.mindmap : undefined;

  return {
    content: content || `I received study data for **${query}**, but the explanation text was missing. Please try again.`,
    youtube_search_query: typeof parsed.youtube_search_query === "string"
      ? parsed.youtube_search_query
      : query,
    studyData: {
      ...(quiz?.length ? { quiz } : {}),
      ...(flashcards?.length ? { flashcards } : {}),
      ...(mindmap ? { mindmap } : {})
    }
  };
}

export default function EasyPeasyApp() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [context, setContext] = useState<ContextType>('Everyday life');
  const [customContext, setCustomContext] = useState('');
  const [activeModal, setActiveModal] = useState<{ type: 'quiz' | 'flashcards' | 'mindmap'; data: any } | null>(null);
  const [cheatSheetMode, setCheatSheetMode] = useState(false);
  
  const [isContextOpen, setIsContextOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [history, setHistory] = useState<Session[]>(INITIAL_HISTORY);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const contextDropdownRef = useRef<HTMLDivElement>(null);


  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  useEffect(() => {
    return () => window.speechSynthesis.cancel();
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (contextDropdownRef.current && !contextDropdownRef.current.contains(event.target as Node)) {
        setIsContextOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const searchConceptImages = async (query: string) => {
    try {
      const response = await fetch(`/api/search-image?q=${encodeURIComponent(query)}`);
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || `Image search failed (${response.status}).`);
      }

      return Array.isArray(data.images) ? data.images : [];
    } catch (error) {
      console.error('Wikimedia image search error:', error);
      return [];
    }
  };

  const handleSend = async (textToSend?: string) => {
    const query = textToSend || input;
    if (!query.trim()) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: query,
      type: 'text',
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    const currentLens = context === 'Custom' && customContext ? customContext : context;

    try {

      const prompt = `You are EasyPeasyAI, a warm, intelligent study pal. Explain the topic: "${query}" using the analogy lens of "${currentLens}".
      Provide a rich, well-structured explanation using markdown.


      IMPORTANT FORMATTING RULES:
      - Always write chemical formulas using Unicode subscripts.
      - Never use LaTeX notation or dollar signs for chemical formulas.
      - Write H₂O instead of H_2O or $H_2O$.
      - Write CO₂ instead of CO_2 or $CO_2$.
      - Write O₂ instead of O_2 or $O_2$.
      - Write C₆H₁₂O₆ instead of C6H12O6.
      - Use proper scientific symbols and subscripts.
      - Keep all explanations clean and readable in Markdown.

      You MUST respond in valid JSON format with this exact structure:
      {
        "content": "Your detailed markdown explanation here...",
        "youtube_search_query": "${query}",
        "studyData": {
          "quiz": [
            {
              "question": "What is a key takeaway about ${query}?",
              "options": ["Option A", "Option B", "Option C", "Option D"],
              "correctIndex": 0,
              "explanation": "Explanation of the correct answer."
            }
          ],
          "flashcards": [
            { "front": "${query}", "back": "Core definition or concept." }
          ],
          "mindmap": {
            "label": "${query}",
            "children": [
              {
                "label": "Main idea / definition",
                "children": [
                  { "label": "Meaning in simple words" },
                  { "label": "Why it matters" }
                ]
              },
              {
                "label": "How it works",
                "children": [
                  { "label": "Step or mechanism 1" },
                  { "label": "Step or mechanism 2" }
                ]
              },
              {
                "label": "Key components",
                "children": [
                  { "label": "Important part 1" },
                  { "label": "Important part 2" }
                ]
              },
              {
                "label": "Examples & applications",
                "children": [
                  { "label": "Real-world example" },
                  { "label": "Practical use" }
                ]
              },
              {
                "label": "Advantages, limits & connections",
                "children": [
                  { "label": "Main benefit" },
                  { "label": "Limitation or related concept" }
                ]
              }
            ]
          }
        }
      }`;

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ prompt })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate response.');
      }

      const rawText = typeof data.text === 'string' ? data.text : '';
      const parsedData = normalizeStudyResponse(rawText, query);

      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        content: parsedData.content,
        type: cheatSheetMode ? 'cheat_sheet' : 'text',
        youtubeQuery: parsedData.youtube_search_query || query,
        timestamp: Date.now(),
        analogyContext: currentLens,
        studyData: parsedData.studyData,
        imageSearchDone: false
      };

      setMessages(prev => [...prev, aiMsg]);
      setHistory(prev => [{ id: Date.now().toString(), title: query, context: currentLens, count: 1, date: 'Just now' }, ...prev]);

      // Search Wikimedia Commons in the background; the explanation appears immediately.
      void searchConceptImages(query).then((images) => {
        setMessages(prev =>
          prev.map(message =>
            message.id === aiMsg.id
              ? { ...message, conceptImages: images, imageSearchDone: true }
              : message
          )
        );
      });
    } catch (err: any) {
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        content: `Error connecting to Gemini API: ${err.message || "Please verify your API key in .env"}.`,
        type: 'text',
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSpeak = (id: string, text: string) => {
    if (speakingId === id) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onend = () => setSpeakingId(null);
    window.speechSynthesis.speak(utterance);
    setSpeakingId(id);
  };

  return (
    <div className="min-h-screen bg-[#F4F1EA] text-[#2C2622] flex flex-col font-['DM_Sans',sans-serif]">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-[#F4F1EA]/90 backdrop-blur-md border-b border-[#E6E1D6] px-6 py-4 flex items-center justify-between transition-all shadow-xs">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="p-2.5 rounded-2xl bg-[#E6E1D6] hover:bg-[#D9D3C5] transition-all text-[#9A5B38] active:scale-95 group shadow-xs"
            title="Open Study History"
          >
            <Menu size={20} className="transition-transform duration-300 group-hover:rotate-90 group-hover:scale-110" />
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#9A5B38] text-white flex items-center justify-center shadow-md transform hover:rotate-12 hover:scale-110 transition-transform duration-300 font-bold">
              <Sparkles size={20} className="animate-pulse" />
            </div>
            <div>
              <h1 className="font-bold text-lg tracking-tight font-['Playfair_Display',serif] text-[#2C2622]">EasyPeasyAI</h1>
              <p className="text-xs text-[#7A7067] font-medium">Your Study Pal</p>
            </div>
          </div>
        </div>

        {/* Analogy Selector */}
        <div className="relative" ref={contextDropdownRef}>
          <button
            onClick={() => setIsContextOpen(!isContextOpen)}
            className="flex items-center gap-2.5 px-4 py-2 rounded-full border border-[#E6E1D6] bg-[#FFFFFF] hover:border-[#9A5B38]/50 transition-all shadow-xs active:scale-95 group"
          >
            <span className="text-xs text-[#7A7067] font-medium">Explain through</span>
            <span className="flex items-center gap-1.5 font-bold text-[#9A5B38]">
              {CONTEXTS.find(c => c.id === context)?.icon}
              {context === 'Custom' && customContext ? customContext : context}
            </span>
            <ChevronDown size={14} className={`transition-transform duration-300 text-[#9A5B38] group-hover:translate-y-0.5 group-hover:scale-125 ${isContextOpen ? 'rotate-180' : ''}`} />
          </button>

          {isContextOpen && (
            <div className="absolute right-0 mt-3 w-72 bg-[#FFFFFF] rounded-3xl shadow-xl border border-[#E6E1D6] p-4 z-50 animate-in fade-in slide-in-from-top-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#7A7067] px-3 py-1">Choose a world</h3>
              <p className="text-xs text-[#7A7067] px-3 mb-3">Make the idea feel familiar</p>
              
              <div className="space-y-1">
                {CONTEXTS.map(c => (
                  <button
                    key={c.id}
                    onClick={() => { setContext(c.id); setIsContextOpen(false); }}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-sm transition-all group ${context === c.id ? 'bg-[#F4ECE4] text-[#9A5B38] font-bold shadow-xs' : 'hover:bg-[#F4F1EA] text-[#2C2622]'}`}
                  >
                    <span className="flex items-center gap-2.5">{c.icon} {c.id}</span>
                    {context === c.id && <Check size={16} className="text-[#9A5B38] animate-bounce" />}
                  </button>
                ))}
              </div>

              <div className="mt-3 pt-3 border-t border-[#E6E1D6] px-2">
                <input
                  type="text"
                  placeholder="e.g. jazz, gardening..."
                  value={customContext}
                  onChange={(e) => setCustomContext(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { setContext('Custom'); setIsContextOpen(false); } }}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-[#E6E1D6] bg-[#F4F1EA] text-[#2C2622] focus:outline-none focus:border-[#9A5B38] transition-colors"
                />
              </div>
            </div>
          )}
        </div>

        {/* Right Nav */}
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#FFFFFF] border border-[#E6E1D6] text-[#9A5B38] text-xs font-bold shadow-xs">
            <Flame size={14} className="text-[#D97706] animate-bounce" />
            <span>12 Day Streak</span>
          </div>
          <button className="p-2.5 rounded-full bg-[#FFFFFF] border border-[#E6E1D6] hover:border-[#9A5B38]/50 text-[#7A7067] hover:text-[#9A5B38] transition-all active:scale-95 group shadow-xs">
            <Bell size={18} className="transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110" />
          </button>
          <div className="w-9 h-9 rounded-full bg-[#E6E1D6] flex items-center justify-center text-[#2C2622] font-bold text-sm shadow-xs transform hover:scale-110 transition-transform cursor-pointer">
            <User size={18} />
          </div>
        </div>
      </header>

      {/* History Sidebar */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-xs transition-opacity" onClick={() => setIsSidebarOpen(false)}></div>
          <div className="relative w-80 sm:w-96 bg-[#FFFFFF] h-full shadow-2xl p-6 flex flex-col z-10 border-r border-[#E6E1D6] animate-in slide-in-from-left duration-300">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="font-['Playfair_Display',serif] text-2xl font-bold text-[#2C2622]">Your desk</h2>
                <p className="text-xs text-[#7A7067]">Study history & past notes</p>
              </div>
              <button onClick={() => setIsSidebarOpen(false)} className="p-2 rounded-xl hover:bg-[#F4F1EA] transition-all text-[#2C2622] active:scale-95 group">
                <X size={18} className="transition-transform duration-300 group-hover:rotate-90" />
              </button>
            </div>

            <button 
              onClick={() => { setMessages([]); setIsSidebarOpen(false); }}
              className="w-full py-3.5 px-4 rounded-2xl bg-[#9A5B38] text-white font-bold text-sm flex items-center justify-center gap-2 mb-6 hover:bg-[#834B2E] transition-all shadow-md active:scale-95 group"
            >
              <Sparkles size={16} className="transition-transform duration-300 group-hover:rotate-180 group-hover:scale-125" /> Start something new
            </button>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {history.map(session => (
                <div key={session.id} className="p-4 rounded-2xl bg-[#F4F1EA] border border-[#E6E1D6] hover:border-[#9A5B38] hover:shadow-sm transition-all cursor-pointer group">
                  <h4 className="font-bold text-sm mb-1 text-[#2C2622] group-hover:text-[#9A5B38] transition-colors">{session.title}</h4>
                  <div className="flex items-center justify-between text-xs text-[#7A7067]">
                    <span className="px-2.5 py-0.5 rounded-full bg-[#FFFFFF] text-[#9A5B38] font-bold border border-[#E6E1D6]">{session.context}</span>
                    <span className="flex items-center gap-1"><Clock size={12} /> {session.date}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-[#E6E1D6] text-xs text-[#7A7067] text-center font-medium">
              ✦ Your Study Pal · Always in your corner
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-8 flex flex-col justify-between">
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center my-auto animate-in fade-in duration-500">
            <span className="text-xs font-bold uppercase tracking-widest text-[#9A5B38] mb-3">A quieter way to understand</span>
            <h2 className="text-4xl sm:text-6xl font-['Playfair_Display',serif] font-normal text-[#2C2622] mb-5 leading-tight">
              Make room for <br /><span className="italic text-[#9A5B38]">the lightbulb moment.</span>
            </h2>
            <p className="text-[#7A7067] max-w-lg mx-auto text-base sm:text-lg mb-8 leading-relaxed font-medium">
              Ask anything difficult. I’ll meet you there with a clear explanation, a useful analogy, and a few ways to remember it.
            </p>
            <div className="text-xs text-[#9A5B38] font-bold flex items-center gap-2 bg-[#FFFFFF] px-4 py-2 rounded-full border border-[#E6E1D6] shadow-xs">
              <span>✦ Your Study Pal</span>
              <span>·</span>
              <span>Built for curious minds</span>
            </div>
          </div>
        ) : (
          <div className="space-y-8 mb-8">
            {messages.map(msg => (
              <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-in fade-in duration-300`}>
                {msg.role === 'user' ? (
                  <div className="bg-[#9A5B38] text-white px-6 py-4 rounded-3xl rounded-tr-sm max-w-lg text-base shadow-sm font-bold">
                    {msg.content}
                  </div>
                ) : (
                  <div className="w-full bg-[#FFFFFF] rounded-[32px] p-8 border border-[#E6E1D6] shadow-sm space-y-6">
                    <div className="flex items-center justify-between pb-4 border-b border-[#E6E1D6]">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-[#9A5B38] text-white flex items-center justify-center font-bold text-xs shadow-xs">
                          <Sparkles size={16} />
                        </div>
                        <span className="font-bold text-sm text-[#2C2622]">Your Study Pal</span>
                        <span className="text-xs text-[#7A7067]">· Just now</span>
                      </div>
                      <span className="px-3 py-1 rounded-full bg-[#F4F1EA] text-[#9A5B38] text-xs font-bold border border-[#E6E1D6]">
                        {msg.analogyContext} Lens
                      </span>
                    </div>

                    <div className="prose prose-base max-w-none text-[#2C2622] font-normal leading-relaxed">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>

                    {msg.conceptImages && msg.conceptImages.length > 0 && (
                      <section className="rounded-2xl border border-[#E6E1D6] bg-[#F4F1EA] p-3 space-y-3">
                        <div className="flex items-center justify-between gap-2 px-1">
                          <div className="text-xs font-bold text-[#7A7067] uppercase tracking-wider flex items-center gap-1.5">
                            <ImageIcon size={14} className="text-[#9A5B38]" /> Images from Wikimedia Commons
                          </div>
                          <span className="text-[10px] text-[#7A7067]">Community-sourced</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {msg.conceptImages.map((image, index) => (
                            <figure key={`${image.descriptionUrl}-${index}`} className="min-w-0 overflow-hidden rounded-xl border border-[#E6E1D6] bg-white">
                              <a href={image.descriptionUrl} target="_blank" rel="noopener noreferrer" className="block">
                                <img
                                  src={image.thumbUrl || image.url}
                                  alt={image.title}
                                  loading="lazy"
                                  className="w-full h-48 object-contain bg-[#F8F7F3]"
                                  onError={(event) => {
                                    const target = event.currentTarget;
                                    if (target.src !== image.url) target.src = image.url;
                                  }}
                                />
                              </a>
                              <figcaption className="p-3 space-y-1.5">
                                <a href={image.descriptionUrl} target="_blank" rel="noopener noreferrer" className="block text-xs font-bold text-[#2C2622] hover:text-[#9A5B38] line-clamp-2">
                                  {image.title}
                                </a>
                                <p className="text-[10px] text-[#7A7067]">
                                  {image.artist ? `By ${image.artist} · ` : ''}{image.license || 'License details on source page'}
                                </p>
                                <a href={image.licenseUrl || image.descriptionUrl} target="_blank" rel="noopener noreferrer" className="inline-block text-[10px] font-bold text-[#9A5B38] hover:underline">
                                  View source & license ↗
                                </a>
                              </figcaption>
                            </figure>
                          ))}
                        </div>
                      </section>
                    )}
                    {msg.imageSearchDone && (!msg.conceptImages || msg.conceptImages.length === 0) && (
                      <p className="text-xs text-[#8A7C70] px-1">
                        No suitable Wikimedia images were found for this topic. Try a more specific topic name.
                      </p>
                    )}
                    {!msg.imageSearchDone && (
                      <p className="text-xs text-[#8A7C70] px-1">Finding relevant learning images…</p>
                    )}

                    {msg.studyData && (
                      <div className="flex flex-wrap gap-3 pt-4 border-t border-[#E6E1D6]">
                        <button 
                          onClick={() => handleSpeak(msg.id, msg.content)}
                          className="flex items-center gap-2 px-4 py-2 rounded-2xl border border-[#E6E1D6] bg-[#F4F1EA] hover:bg-[#E6E1D6] text-xs font-bold transition-all active:scale-95 text-[#9A5B38] group shadow-xs"
                        >
                          <Volume2 size={16} className="transition-transform duration-300 group-hover:scale-125" /> 
                          {speakingId === msg.id ? 'Pause' : 'Read aloud'}
                        </button>
                        {msg.studyData.quiz && (
                          <button 
                            onClick={() => setActiveModal({ type: 'quiz', data: msg.studyData?.quiz })}
                            className="flex items-center gap-2 px-4 py-2 rounded-2xl border border-[#E6E1D6] bg-[#F4F1EA] hover:bg-[#E6E1D6] text-xs font-bold transition-all active:scale-95 text-[#9A5B38] group shadow-xs"
                          >
                            <Brain size={16} className="transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110" /> Quiz
                          </button>
                        )}
                        {msg.studyData.flashcards && (
                          <button 
                            onClick={() => setActiveModal({ type: 'flashcards', data: msg.studyData?.flashcards })}
                            className="flex items-center gap-2 px-4 py-2 rounded-2xl border border-[#E6E1D6] bg-[#F4F1EA] hover:bg-[#E6E1D6] text-xs font-bold transition-all active:scale-95 text-[#9A5B38] group shadow-xs"
                          >
                            <FileText size={16} className="transition-transform duration-300 group-hover:-rotate-12 group-hover:scale-110" /> Cards
                          </button>
                        )}
                        {msg.studyData.mindmap && (
                          <button 
                            onClick={() => setActiveModal({ type: 'mindmap', data: msg.studyData?.mindmap })}
                            className="flex items-center gap-2 px-4 py-2 rounded-2xl border border-[#E6E1D6] bg-[#F4F1EA] hover:bg-[#E6E1D6] text-xs font-bold transition-all active:scale-95 text-[#9A5B38] group shadow-xs"
                          >
                            <MapIcon size={16} className="transition-transform duration-300 group-hover:scale-125 group-hover:rotate-6" /> Map
                          </button>
                        )}
                        {msg.youtubeQuery && (
                          <a 
                            href={`https://www.youtube.com/results?search_query=${encodeURIComponent(msg.youtubeQuery)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-4 py-2 rounded-2xl border border-red-200 bg-red-50 hover:bg-red-100 text-xs font-bold transition-all active:scale-95 text-red-700 ml-auto group shadow-xs"
                          >
                            <svg className="w-4 h-4 fill-current transition-transform duration-300 group-hover:scale-125" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg> Watch Video
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="w-full bg-[#FFFFFF] rounded-[32px] p-8 border border-[#E6E1D6] shadow-sm space-y-4 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-[#E6E1D6]"></div>
                  <div className="h-4 bg-[#E6E1D6] rounded w-32"></div>
                </div>
                <div className="h-4 bg-[#E6E1D6] rounded w-full"></div>
                <div className="h-4 bg-[#E6E1D6] rounded w-5/6"></div>
                <div className="h-48 bg-[#F4F1EA] rounded-2xl border border-[#E6E1D6] flex items-center justify-center text-xs font-bold text-[#7A7067]">
                  ✦ Generating visual explanation & study cards...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Input Composer */}
        <div className="w-full bg-[#FFFFFF] rounded-[32px] p-5 border border-[#E6E1D6] shadow-md transition-all focus-within:border-[#9A5B38]">
          <div className="text-xs text-[#7A7067] mb-3 px-1 flex items-center justify-between font-bold">
            <span>01 — Ask a question · <span className="text-[#9A5B38]">{context} Lens</span></span>
          </div>
          
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="What are you trying to make sense of?"
            rows={2}
            className="w-full resize-none border-none focus:outline-none text-[#2C2622] placeholder-[#7A7067] text-base bg-transparent font-medium"
          />

          <div className="flex items-center justify-between pt-4 border-t border-[#E6E1D6] mt-3">
            <div className="flex items-center gap-3">
              <button className="p-2 rounded-xl text-[#7A7067] hover:text-[#9A5B38] hover:bg-[#F4F1EA] transition-all active:scale-95 group">
                <Paperclip size={18} className="transition-transform duration-300 group-hover:rotate-45 group-hover:scale-110" />
              </button>
              <button 
                onClick={() => setCheatSheetMode(!cheatSheetMode)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 group ${cheatSheetMode ? 'bg-[#F4ECE4] text-[#9A5B38] shadow-xs' : 'text-[#7A7067] hover:bg-[#F4F1EA]'}`}
              >
                <FileText size={16} className="transition-transform duration-300 group-hover:-rotate-12 group-hover:scale-110" /> Cheat sheet
              </button>
            </div>

            <button
              onClick={() => handleSend()}
              disabled={isLoading || !input.trim()}
              className="px-5 py-2.5 rounded-2xl bg-[#9A5B38] text-white hover:bg-[#834B2E] disabled:opacity-50 transition-all flex items-center gap-2 text-sm font-bold shadow-sm active:scale-95 group"
            >
              <span>Ask away</span>
              <ArrowUp size={16} className="transition-transform duration-300 group-hover:-translate-y-1 group-hover:scale-110" />
            </button>
          </div>
        </div>
        <div className="text-center text-xs text-[#7A7067] mt-3 font-medium">
          Press Enter to ask · Shift + Enter for a new line
        </div>
      </main>

      {/* Interactive Quiz / Flashcards / Mindmap Modal */}
      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div className={`bg-[#FFFFFF] text-[#2C2622] w-full ${activeModal.type === 'mindmap' ? 'max-w-6xl' : 'max-w-xl'} rounded-[30px] p-5 sm:p-8 shadow-2xl border border-[#E6E1D6] relative animate-in zoom-in-95 duration-200 max-h-[92vh] overflow-y-auto`}>
            <button 
              onClick={() => setActiveModal(null)}
              className="absolute top-6 right-6 p-2.5 rounded-full hover:bg-[#F4F1EA] transition-all text-[#2C2622] active:scale-95 group"
            >
              <X size={20} className="transition-transform duration-300 group-hover:rotate-90 group-hover:scale-110" />
            </button>

            <h3 className="font-['Playfair_Display',serif] text-2xl font-bold mb-6 capitalize flex items-center gap-3 text-[#9A5B38]">
              {activeModal.type === 'quiz' && <Brain size={24} className="animate-pulse" />}
              {activeModal.type === 'flashcards' && <FileText size={24} />}
              {activeModal.type === 'mindmap' && <MapIcon size={24} />}
              {activeModal.type} Session
            </h3>

            {activeModal.type === 'quiz' && (
              <InteractiveQuiz questions={activeModal.data} />
            )}

            {activeModal.type === 'flashcards' && (
              <InteractiveFlashcards cards={activeModal.data} />
            )}

            {activeModal.type === 'mindmap' && (
              <InteractiveMindMap root={activeModal.data as MindMapNode} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Sub-component for interactive quiz
function InteractiveQuiz({ questions }: { questions: QuizQuestion[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [showResult, setShowResult] = useState(false);

  const q = questions[currentIndex];

  const handleSelect = (idx: number) => {
    if (selectedOption !== null) return;
    setSelectedOption(idx);
    if (idx === q.correctIndex) {
      setScore(s => s + 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setSelectedOption(null);
    } else {
      setShowResult(true);
    }
  };

  if (showResult) {
    return (
      <div className="text-center py-8 space-y-4">
        <div className="w-16 h-16 rounded-full bg-[#F4ECE4] text-[#9A5B38] flex items-center justify-center mx-auto text-2xl font-bold animate-bounce">
          🏆
        </div>
        <h4 className="text-2xl font-bold font-['Playfair_Display',serif]">Quiz Completed!</h4>
        <p className="text-base text-[#7A7067]">You scored <span className="font-bold text-[#9A5B38]">{score}</span> out of {questions.length}</p>
        <button 
          onClick={() => { setCurrentIndex(0); setSelectedOption(null); setScore(0); setShowResult(false); }}
          className="mt-4 px-6 py-3 rounded-2xl bg-[#9A5B38] text-white font-bold text-sm shadow-sm active:scale-95 transition-transform"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center text-xs font-bold text-[#7A7067] uppercase tracking-wider">
        <span>Question {currentIndex + 1} of {questions.length}</span>
        <span>Score: {score}</span>
      </div>
      <h4 className="text-lg font-bold text-[#2C2622] leading-snug">{q.question}</h4>
      <div className="space-y-3">
        {q.options.map((opt, i) => {
          let btnStyle = "border-[#E6E1D6] bg-[#F4F1EA] hover:bg-[#E6E1D6]/50 text-[#2C2622]";
          if (selectedOption !== null) {
            if (i === q.correctIndex) btnStyle = "bg-emerald-50 border-emerald-500 text-emerald-800 font-bold";
            else if (i === selectedOption) btnStyle = "bg-rose-50 border-rose-500 text-rose-800 font-bold";
            else btnStyle = "opacity-40 border-[#E6E1D6] bg-[#F4F1EA]";
          }
          return (
            <button
              key={i}
              onClick={() => handleSelect(i)}
              disabled={selectedOption !== null}
              className={`w-full text-left p-4 rounded-2xl border text-sm font-medium transition-all ${btnStyle}`}
            >
              {opt}
            </button>
          );
        })}
      </div>

      {selectedOption !== null && (
        <div className="p-4 rounded-2xl bg-[#F4F1EA] border border-[#E6E1D6] space-y-2 animate-in fade-in">
          <p className="text-xs font-bold text-[#9A5B38]">Explanation:</p>
          <p className="text-sm text-[#7A7067] leading-relaxed">{q.explanation}</p>
          <button
            onClick={handleNext}
            className="mt-3 w-full py-3 rounded-xl bg-[#9A5B38] text-white font-bold text-sm shadow-xs flex items-center justify-center gap-2 active:scale-95 transition-transform group"
          >
            <span>{currentIndex < questions.length - 1 ? 'Next Question' : 'View Results'}</span>
            <ArrowRight size={16} className="transition-transform duration-300 group-hover:translate-x-1" />
          </button>
        </div>
      )}
    </div>
  );
}

// Sub-component for interactive flashcards
function InteractiveFlashcards({ cards }: { cards: Flashcard[] }) {
  const [index, setIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  if (!cards || cards.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-[#7A7067]">
        No flashcards were generated for this topic.
      </div>
    );
  }

  const card = cards[index];

  const goToCard = (nextIndex: number) => {
    setIndex(nextIndex);
    setIsFlipped(false);
  };

  const flipCard = () => setIsFlipped(current => !current);

  return (
    <div className="space-y-6 text-center py-4">
      <div className="flex items-center justify-between text-xs font-bold text-[#7A7067] uppercase tracking-wider">
        <span>Card {index + 1} of {cards.length}</span>
        <span>{isFlipped ? 'Answer' : 'Question'}</span>
      </div>

      {/* The outer element provides perspective; the inner element actually rotates. */}
      <div
        style={{
          perspective: '1200px',
          WebkitPerspective: '1200px',
          width: '100%',
          height: '280px'
        }}
      >
        <div
          role="button"
          tabIndex={0}
          aria-label={isFlipped ? 'Flashcard answer. Activate to show question.' : 'Flashcard question. Activate to reveal answer.'}
          aria-pressed={isFlipped}
          onClick={flipCard}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              flipCard();
            }
          }}
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            cursor: 'pointer',
            transformStyle: 'preserve-3d',
            WebkitTransformStyle: 'preserve-3d',
            transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
            transition: 'transform 700ms cubic-bezier(0.2, 0.75, 0.25, 1)',
            willChange: 'transform'
          }}
        >
          {/* FRONT: question */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '2rem',
              borderRadius: '1.5rem',
              border: '2px solid #E6E1D6',
              background: '#F4F1EA',
              boxShadow: 'inset 0 2px 8px rgba(44,38,34,0.06)',
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              transform: 'rotateY(0deg)'
            }}
          >
            <span className="text-xs font-bold uppercase tracking-widest text-[#9A5B38] mb-4">
              Term / Question
            </span>
            <h4 className="text-xl font-bold text-[#2C2622] leading-snug">
              {card.front}
            </h4>
            <span className="text-xs font-medium text-[#9A5B38] mt-6">
              Click or press Enter to reveal answer
            </span>
          </div>

          {/* BACK: answer. It is pre-rotated so it faces the user after the parent flips. */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '2rem',
              borderRadius: '1.5rem',
              border: '2px solid #834B2E',
              background: '#9A5B38',
              boxShadow: '0 8px 24px rgba(44,38,34,0.12)',
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)'
            }}
          >
            <span className="text-xs font-bold uppercase tracking-widest text-white/75 mb-4">
              Answer
            </span>
            <h4 className="text-lg font-semibold text-white leading-relaxed">
              {card.back}
            </h4>
            <span className="text-xs font-medium text-white/75 mt-6">
              Click or press Enter to see question
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap justify-between items-center gap-3 pt-2">
        <button
          type="button"
          onClick={() => goToCard(Math.max(0, index - 1))}
          disabled={index === 0}
          className="px-5 py-2.5 rounded-xl border border-[#E6E1D6] text-xs font-bold disabled:opacity-30 hover:bg-[#E6E1D6] active:scale-95 transition-all text-[#2C2622]"
        >
          Previous
        </button>

        <button
          type="button"
          onClick={flipCard}
          className="px-5 py-2.5 rounded-xl bg-[#F4ECE4] text-[#9A5B38] border border-[#E6E1D6] text-xs font-bold hover:bg-[#E6E1D6] active:scale-95 transition-all"
        >
          {isFlipped ? 'Show Question' : 'Flip Card'}
        </button>

        <button
          type="button"
          onClick={() => goToCard(Math.min(cards.length - 1, index + 1))}
          disabled={index === cards.length - 1}
          className="px-5 py-2.5 rounded-xl bg-[#9A5B38] text-white text-xs font-bold disabled:opacity-30 shadow-xs active:scale-95 transition-all"
        >
          Next
        </button>
      </div>
    </div>
  );
}


// A navigable, multi-level mind map. Branches can be expanded independently,
// searched, and expanded/collapsed as a whole without losing the original data.
function countMindMapNodes(node: MindMapNode | undefined): number {
  if (!node) return 0;
  return 1 + (node.children || []).reduce((total, child) => total + countMindMapNodes(child), 0);
}

function collectMindMapPaths(node: MindMapNode, path = 'root', result: string[] = []): string[] {
  result.push(path);
  (node.children || []).forEach((child, index) => collectMindMapPaths(child, `${path}.${index}`, result));
  return result;
}

function InteractiveMindMap({ root }: { root: MindMapNode }) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(['root']));
  const [search, setSearch] = useState('');
  const totalNodes = countMindMapNodes(root);
  const branchCount = root?.children?.length || 0;
  const query = search.trim().toLowerCase();

  const toggle = (path: string) => {
    setExpanded(previous => {
      const next = new Set(previous);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const expandAll = () => setExpanded(new Set(collectMindMapPaths(root)));
  const collapseAll = () => setExpanded(new Set(['root']));

  if (!root || !root.label) {
    return <div className="py-10 text-center text-sm text-[#7A7067]">A mind map could not be generated for this topic.</div>;
  }

  return (
    <div className="space-y-5 pt-2">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#9A5B38]">Visual learning map</p>
          <p className="text-sm text-[#7A7067] mt-1">Open any branch to explore the details. Follow the connections from the main idea outward.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={expandAll} className="px-3.5 py-2 rounded-xl bg-[#F4ECE4] text-[#9A5B38] text-xs font-bold hover:bg-[#EADBCD] transition-colors">Expand all</button>
          <button type="button" onClick={collapseAll} className="px-3.5 py-2 rounded-xl border border-[#E6E1D6] text-[#7A7067] text-xs font-bold hover:bg-[#F4F1EA] transition-colors">Collapse all</button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9A5B38] text-sm">⌕</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Find a concept in this map..." className="w-full pl-9 pr-4 py-3 rounded-2xl bg-[#F8F6F1] border border-[#E6E1D6] text-sm text-[#2C2622] placeholder:text-[#A39A8F] focus:outline-none focus:border-[#9A5B38]" />
        </div>
        <div className="flex gap-2 text-[11px] font-bold text-[#7A7067]">
          <span className="px-3 py-2 rounded-xl bg-[#F4F1EA] border border-[#E6E1D6]">{totalNodes} concepts</span>
          <span className="px-3 py-2 rounded-xl bg-[#F4F1EA] border border-[#E6E1D6]">{branchCount} main branches</span>
        </div>
      </div>

      <div className="rounded-[26px] border border-[#E6E1D6] bg-[radial-gradient(#D9D0C3_0.8px,transparent_0.8px)] [background-size:18px_18px] p-4 sm:p-7 overflow-x-auto">
        <div className="min-w-[280px] flex flex-col items-center">
          <div className="relative max-w-2xl w-full">
            <div className="rounded-3xl bg-gradient-to-br from-[#9A5B38] to-[#754329] text-white px-6 py-5 sm:px-9 sm:py-6 text-center shadow-lg shadow-[#9A5B38]/20 border border-white/20">
              <span className="block text-[10px] font-bold uppercase tracking-[0.22em] text-white/70 mb-2">Central concept</span>
              <h4 className="text-lg sm:text-2xl font-bold leading-snug">{root.label}</h4>
              <span className="inline-flex mt-3 px-3 py-1 rounded-full bg-white/15 text-[10px] font-semibold text-white/85">Starting point</span>
            </div>
          </div>

          {root.children && root.children.length > 0 ? (
            <>
              <div className="w-px h-8 bg-[#BFA58F]" />
              <div className="w-full border-t-2 border-[#D9C8B8]" />
              <div className="w-full grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-x-4 gap-y-5 pt-0">
                {root.children.map((child, index) => (
                  <MindMapBranch key={`${index}-${child.label}`} node={child} path={`root.${index}`} depth={1} expanded={expanded} onToggle={toggle} query={query} />
                ))}
              </div>
            </>
          ) : (
            <p className="text-xs text-[#8A7C70] mt-5">No branches were returned for this topic.</p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#8A7C70]">
        <span>Tip: select a branch card to reveal its subtopics.</span>
        <span>{query ? 'Matching text is highlighted' : 'Your map stays focused on the key ideas'}</span>
      </div>
    </div>
  );
}

function MindMapBranch({
  node, path, depth, expanded, onToggle, query
}: {
  node: MindMapNode;
  path: string;
  depth: number;
  expanded: Set<string>;
  onToggle: (path: string) => void;
  query: string;
}) {
  const children = node.children || [];
  const isOpen = expanded.has(path);
  const hasChildren = children.length > 0;
  const isMatch = !!query && node.label.toLowerCase().includes(query);
  const palettes = [
    { bar: 'bg-[#9A5B38]', tint: 'bg-[#F4ECE4]', text: 'text-[#854B2C]', border: 'border-[#D8B9A2]' },
    { bar: 'bg-[#55766A]', tint: 'bg-[#EAF1EC]', text: 'text-[#426456]', border: 'border-[#B9D0C3]' },
    { bar: 'bg-[#69799A]', tint: 'bg-[#EDF0F6]', text: 'text-[#536382]', border: 'border-[#C4CCDE]' },
    { bar: 'bg-[#A17A3F]', tint: 'bg-[#F6F0E3]', text: 'text-[#87642F]', border: 'border-[#DFCEAA]' },
    { bar: 'bg-[#8A6D91]', tint: 'bg-[#F2EDF3]', text: 'text-[#735779]', border: 'border-[#D4C4D8]' }
  ];
  const palette = palettes[(depth - 1) % palettes.length];

  return (
    <div className="min-w-0 flex flex-col items-center">
      <div className="w-px h-5 bg-[#D9C8B8]" />
      <div className={`w-full rounded-2xl border ${isMatch ? 'border-[#D97706] ring-2 ring-[#D97706]/20' : 'border-[#E6E1D6]'} bg-white shadow-sm hover:shadow-md transition-all overflow-hidden`}>
        <div className={`h-1.5 ${palette.bar}`} />
        <button type="button" onClick={() => hasChildren && onToggle(path)} disabled={!hasChildren} aria-expanded={hasChildren ? isOpen : undefined} className={`w-full text-left p-4 flex items-start gap-3 ${hasChildren ? 'cursor-pointer' : 'cursor-default'} hover:bg-[#FCFBF8] transition-colors`}>
          <span className={`shrink-0 w-7 h-7 rounded-lg ${palette.tint} ${palette.text} flex items-center justify-center text-xs font-extrabold`}>{depth}</span>
          <span className="min-w-0 flex-1">
            <span className={`block text-sm font-bold leading-snug ${isMatch ? 'text-[#B45309]' : 'text-[#302923]'}`}>{node.label}</span>
            <span className="flex items-center gap-2 mt-2 text-[10px] font-semibold text-[#8A7C70]">
              {hasChildren ? `${children.length} subtopic${children.length === 1 ? '' : 's'}` : 'Key detail'}
              {hasChildren && <span className={`ml-auto px-2 py-1 rounded-full ${palette.tint} ${palette.text}`}>{isOpen ? '− Hide' : '+ Explore'}</span>}
            </span>
          </span>
        </button>
      </div>
      {hasChildren && isOpen && (
        <div className="w-full ml-3 pl-3 border-l-2 border-dashed border-[#D9C8B8] flex flex-col gap-1 pt-1 animate-in fade-in slide-in-from-top-1 duration-200">
          {children.map((child, index) => (
            <MindMapBranch key={`${index}-${child.label}`} node={child} path={`${path}.${index}`} depth={depth + 1} expanded={expanded} onToggle={onToggle} query={query} />
          ))}
        </div>
      )}
    </div>
  );
}