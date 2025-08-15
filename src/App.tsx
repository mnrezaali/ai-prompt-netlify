import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { GoogleGenAI, Chat } from '@google/genai';
import {
  SparklesIcon, CopyIcon, CheckIcon, SpinnerIcon, EyeIcon, EyeSlashIcon,
  ArrowLeftOnRectangleIcon, ClockIcon, TrashIcon, ChevronDownIcon, PaperAirplaneIcon, ArrowPathIcon, ArrowDownTrayIcon
} from './icons';

// Types
type AccessLevel = 'none' | 'client' | 'admin';
interface AdminSettings {
  accessSecret: string;
  isGateEnabled: boolean;
}
interface HistoryItem {
  id: string;
  prompt: string;
  timestamp: number;
  userInput: string;
  tone: string;
  targetAudience: string;
}
interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}
type ActiveTab = 'refine' | 'test';


const TONES = ["Formal", "Casual", "Humorous", "Authoritative", "Friendly", "Empathetic"];
const ADMIN_CODE = "admin-unlock-righteye";

const GENERATE_SYSTEM_INSTRUCTION = `You are an expert in designing AI assistant system prompts. A user will provide a high-level description of an assistant they want to build. Your task is to generate a comprehensive, well-structured system prompt based on their input.

The output MUST be a single block of text.

The prompt must include the following sections, clearly marked with headings:

1.  **Core Identity:** Define who the AI is.
2.  **Key Responsibilities:** List the primary tasks and functions of the AI.
3.  **Rules & Constraints:** Specify limitations, boundaries, and critical rules the AI must follow.
4.  **Interaction Style:** Describe the AI's tone, personality, and how it should communicate.
5.  **Example Opening:** Provide a sample first response to a user interaction.

**CRITICAL RULE:** Under "Rules & Constraints," you MUST ALWAYS include a disclaimer stating that the AI is not a licensed professional (e.g., financial advisor, doctor, lawyer) and its advice should not be taken as professional guidance.

Analyze the user's request for purpose, tone, and audience to tailor each section effectively. Output only the complete, final prompt.`;

const REFINE_SYSTEM_INSTRUCTION = `You are a prompt editing assistant. The user will provide a complete system prompt and a command to refine it. Your task is to rewrite the ENTIRE prompt based on the user's command, incorporating their changes seamlessly. You MUST output the complete, new version of the prompt. Do not just output the changes or a confirmation message. Output ONLY the full, updated prompt text.`;

// Helper hook for localStorage
const useLocalStorage = <T,>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] => {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(error);
      return initialValue;
    }
  });

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(error);
    }
  };

  return [storedValue, setValue];
};

const AccessGate = ({ setAccessLevel, adminSettings }: { setAccessLevel: (level: AccessLevel) => void; adminSettings: AdminSettings }) => {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const getClientCode = () => {
    const date = new Date();
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${adminSettings.accessSecret}-${day}-${month}-${year}`;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code === ADMIN_CODE) {
      setAccessLevel('admin');
    } else if (code === getClientCode()) {
      setAccessLevel('client');
    } else {
      setError('Invalid access code.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
      <div className="w-full max-w-md bg-slate-800 rounded-lg shadow-2xl p-8 animate-fade-in-up">
        <div className="text-center mb-6">
          <SparklesIcon className="w-12 h-12 mx-auto text-indigo-400" />
          <h1 className="text-2xl font-bold text-slate-100 mt-4">AI Prompt Generator</h1>
          <p className="text-slate-400">Please enter your access code.</p>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="relative mb-4">
            <input
              type={showPassword ? "text" : "password"}
              value={code}
              onChange={(e) => { setCode(e.target.value); setError(''); }}
              placeholder="Access Code"
              className="w-full bg-slate-700 border border-slate-600 rounded-md py-2 px-4 text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 px-3 flex items-center text-slate-400 hover:text-slate-200">
              {showPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
            </button>
          </div>
          {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
          <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-md transition duration-300">
            Enter
          </button>
        </form>
        {!adminSettings.isGateEnabled && (
          <div className="mt-4 text-center">
            <p className="text-slate-500 text-sm mb-2">or</p>
            <button onClick={() => setAccessLevel('client')} className="w-full bg-slate-600 hover:bg-slate-700 text-white font-bold py-2 px-4 rounded-md transition duration-300">
              Continue as Guest
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const AdminPanel = ({ settings, setSettings }: { settings: AdminSettings; setSettings: (settings: AdminSettings) => void; }) => {
  const [secret, setSecret] = useState(settings.accessSecret);
  const [isEnabled, setIsEnabled] = useState(settings.isGateEnabled);

  const handleSave = () => {
    setSettings({ accessSecret: secret, isGateEnabled: isEnabled });
    alert('Settings saved!');
  };

  return (
    <div className="bg-amber-900/20 border border-amber-500/30 rounded-lg p-4 mb-8">
      <h2 className="text-xl font-bold text-amber-300 mb-4">Admin Panel</h2>
      <div className="space-y-4">
        <div>
          <label htmlFor="accessSecret" className="block text-sm font-medium text-amber-200 mb-1">Client Access Secret</label>
          <input
            id="accessSecret"
            type="text"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            className="w-full bg-slate-700 border border-slate-600 rounded-md py-2 px-4 text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
        <div className="flex items-center">
          <input
            id="gateEnabled"
            type="checkbox"
            checked={isEnabled}
            onChange={(e) => setIsEnabled(e.target.checked)}
            className="h-4 w-4 rounded border-slate-600 bg-slate-700 text-amber-500 focus:ring-amber-500"
          />
          <label htmlFor="gateEnabled" className="ml-2 block text-sm text-amber-200">
            Enable Access Gate
          </label>
        </div>
        <button onClick={handleSave} className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold py-2 px-4 rounded-md transition duration-300">
          Save Settings
        </button>
      </div>
    </div>
  );
};

const AppHeader = () => (
    <div className="text-center mb-8 animate-fade-in-up">
        <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400 mb-2">
            AI Assistant Prompt Generator
        </h1>
        <p className="text-slate-400 max-w-2xl mx-auto">
            Describe the AI assistant you want to create. We'll use Gemini to generate a detailed, structured system prompt for you to use.
        </p>
    </div>
);

const RecommendedPromptCard = ({ icon, title, description, onClick }: { icon: React.ReactNode, title: string, description: string, onClick: () => void }) => (
    <button onClick={onClick} className="bg-slate-800 p-4 rounded-lg text-left hover:bg-slate-700/80 transition-all duration-300 border border-slate-700 hover:border-indigo-500 transform hover:-translate-y-1">
        <div className="flex items-center mb-2">
            {icon}
            <h3 className="ml-3 font-bold text-slate-200">{title}</h3>
        </div>
        <p className="text-sm text-slate-400">{description}</p>
    </button>
);

const FormattedPrompt = ({ text }: { text: string }) => {
    const parts = text.split('\n').map((line, index) => {
        if (line.match(/^\s*\*\*.+\*\*:\s*$/) || line.match(/^\d\.\s+\*\*.+\*\*:/)) {
            return <strong key={index} className="block mt-4 mb-1 text-indigo-300">{line.replace(/\*|:/g, '')}</strong>;
        }
        return <span key={index}>{line}<br /></span>;
    });
    return <div className="prose prose-invert prose-slate max-w-none">{parts}</div>;
};

const PromptOutput = ({ prompt, isLoading, error }: { prompt: string; isLoading: boolean; error: string | null }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(prompt);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (isLoading && !prompt) {
        return (
            <div className="bg-slate-800 p-6 rounded-lg border border-slate-700 animate-pulse">
                <div className="h-4 bg-slate-700 rounded w-1/4 mb-4"></div>
                <div className="h-3 bg-slate-700 rounded w-full mb-2"></div>
                <div className="h-3 bg-slate-700 rounded w-5/6 mb-4"></div>
                <div className="h-4 bg-slate-700 rounded w-1/3 mb-4"></div>
                <div className="h-3 bg-slate-700 rounded w-full mb-2"></div>
                <div className="h-3 bg-slate-700 rounded w-full mb-2"></div>
                <div className="h-3 bg-slate-700 rounded w-4/6"></div>
            </div>
        );
    }
    
    if (error) {
        return <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-6 text-red-300">{error}</div>;
    }

    if (!prompt) {
        return (
            <div className="bg-slate-800/50 border-2 border-dashed border-slate-700 rounded-lg p-10 text-center text-slate-500">
                Your generated prompt will appear here.
            </div>
        );
    }

    return (
        <div className="bg-slate-800 p-6 rounded-lg border border-slate-700 relative">
            <button onClick={handleCopy} className="absolute top-4 right-4 bg-slate-700 hover:bg-slate-600 p-2 rounded-md text-slate-400 hover:text-white transition-colors">
                {copied ? <CheckIcon className="h-5 w-5 text-green-400" /> : <CopyIcon className="h-5 w-5" />}
            </button>
            <FormattedPrompt text={prompt} />
        </div>
    );
};

const HistoryPanel = ({ history, onSelect, onClear, onClearAll }: { history: HistoryItem[], onSelect: (item: HistoryItem) => void, onClear: (id: string) => void, onClearAll: () => void }) => {
  const [isOpen, setIsOpen] = useState(false);

  if (history.length === 0) return null;

  return (
    <div className="bg-slate-800 rounded-lg mt-4">
      <button onClick={() => setIsOpen(!isOpen)} className="w-full flex justify-between items-center p-4 text-left">
        <div className="flex items-center">
            <ClockIcon className="h-5 w-5 mr-2 text-slate-400" />
            <span className="font-semibold text-slate-200">Generation History</span>
        </div>
        <ChevronDownIcon className={`h-5 w-5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="border-t border-slate-700 p-4">
          <ul className="space-y-2 max-h-60 overflow-y-auto">
            {history.map(item => (
              <li key={item.id} className="flex items-center justify-between p-2 rounded-md hover:bg-slate-700/50">
                <button onClick={() => onSelect(item)} className="text-left flex-grow">
                    <p className="text-slate-300 truncate">{item.userInput}</p>
                    <p className="text-xs text-slate-500">{new Date(item.timestamp).toLocaleString()}</p>
                </button>
                <button onClick={() => onClear(item.id)} className="p-1 text-slate-500 hover:text-red-400 ml-2">
                    <TrashIcon className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
           <button onClick={onClearAll} className="text-sm text-red-400 hover:text-red-300 mt-4 flex items-center">
                <TrashIcon className="h-4 w-4 mr-1" /> Clear All History
           </button>
        </div>
      )}
    </div>
  );
};

const ChatPanel = ({ onSendMessage, chatHistory, isLoading, onSaveRequest }: { onSendMessage: (message: string) => void, chatHistory: ChatMessage[], isLoading: boolean, onSaveRequest: () => void }) => {
    const [message, setMessage] = useState('');
    const chatContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [chatHistory]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (message.trim() && !isLoading) {
            onSendMessage(message);
            setMessage('');
        }
    };

    return (
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg">
            <div className="p-4 border-b border-slate-700 flex justify-between items-center">
                <div>
                    <h3 className="font-bold text-lg text-slate-200">Refine Prompt</h3>
                    <p className="text-sm text-slate-400">Chat with the assistant to modify your generated prompt.</p>
                </div>
                {chatHistory.length > 0 &&
                    <button onClick={onSaveRequest} className="flex items-center space-x-2 bg-slate-700 hover:bg-slate-600 text-slate-300 font-semibold py-2 px-3 rounded-lg transition duration-300 text-sm">
                        <ArrowDownTrayIcon className="h-4 w-4" />
                        <span>Export</span>
                    </button>
                }
            </div>
            <div ref={chatContainerRef} className="p-4 h-64 overflow-y-auto space-y-4">
                {chatHistory.map((msg, index) => (
                    <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-xl p-3 rounded-lg ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-200'}`}>
                            {msg.role === 'model' && index === chatHistory.length -1 && isLoading ? <FormattedPrompt text={msg.content + '...'} /> : <FormattedPrompt text={msg.content} />}
                        </div>
                    </div>
                ))}
                 {chatHistory.length === 0 && (
                    <div className="text-center text-slate-500 pt-16">
                        <p>Refine your prompt by sending a message.</p>
                        <p className="text-sm">e.g., "Make the tone more professional."</p>
                    </div>
                )}
            </div>
            <form onSubmit={handleSubmit} className="p-4 border-t border-slate-700 flex items-center">
                <input 
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="e.g., Make the tone more professional."
                    className="flex-grow bg-slate-700 border border-slate-600 rounded-l-md py-2 px-4 text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    disabled={isLoading}
                />
                <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold p-2 rounded-r-md disabled:bg-indigo-800 disabled:cursor-not-allowed" disabled={isLoading}>
                    {isLoading ? <SpinnerIcon className="h-5 w-5 animate-spin" /> : <PaperAirplaneIcon className="h-5 w-5" />}
                </button>
            </form>
        </div>
    );
};

const TestChatPanel = ({ onSendMessage, chatHistory, isLoading, onClear, onSaveRequest }: { onSendMessage: (message: string) => void, chatHistory: ChatMessage[], isLoading: boolean, onClear: () => void, onSaveRequest: () => void }) => {
    const [message, setMessage] = useState('');
    const chatContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [chatHistory]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (message.trim() && !isLoading) {
            onSendMessage(message);
            setMessage('');
        }
    };

    return (
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg">
            <div className="p-4 border-b border-slate-700 flex justify-between items-center">
                <div>
                    <h3 className="font-bold text-lg text-slate-200">Test Your Prompt</h3>
                    <p className="text-sm text-slate-400">Interact with an AI assistant using your generated prompt.</p>
                </div>
                <div className="flex items-center space-x-2">
                    {chatHistory.length > 0 &&
                         <button onClick={onSaveRequest} className="flex items-center space-x-2 bg-slate-700 hover:bg-slate-600 text-slate-300 font-semibold py-2 px-3 rounded-lg transition duration-300 text-sm">
                            <ArrowDownTrayIcon className="h-4 w-4" />
                            <span>Export</span>
                        </button>
                    }
                    <button onClick={onClear} className="flex items-center space-x-2 bg-slate-700 hover:bg-slate-600 text-slate-300 font-semibold py-2 px-3 rounded-lg transition duration-300 text-sm">
                        <ArrowPathIcon className="h-4 w-4" />
                        <span>Clear</span>
                    </button>
                </div>
            </div>
            <div ref={chatContainerRef} className="p-4 h-64 overflow-y-auto space-y-4">
                {chatHistory.map((msg, index) => (
                    <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-xl p-3 rounded-lg ${msg.role === 'user' ? 'bg-green-600 text-white' : 'bg-slate-700 text-slate-200'}`}>
                            {msg.role === 'model' && index === chatHistory.length - 1 && isLoading ? <FormattedPrompt text={msg.content + '...'} /> : <FormattedPrompt text={msg.content} />}
                        </div>
                    </div>
                ))}
                {chatHistory.length === 0 && (
                    <div className="text-center text-slate-500 pt-16">
                        <p>Start the conversation by sending a message.</p>
                    </div>
                )}
            </div>
            <form onSubmit={handleSubmit} className="p-4 border-t border-slate-700 flex items-center">
                <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Send a message..."
                    className="flex-grow bg-slate-700 border border-slate-600 rounded-l-md py-2 px-4 text-slate-200 focus:outline-none focus:ring-2 focus:ring-green-500"
                    disabled={isLoading}
                />
                <button type="submit" className="bg-green-600 hover:bg-green-700 text-white font-bold p-2 rounded-r-md disabled:bg-green-800 disabled:cursor-not-allowed" disabled={isLoading}>
                    {isLoading ? <SpinnerIcon className="h-5 w-5 animate-spin" /> : <PaperAirplaneIcon className="h-5 w-5" />}
                </button>
            </form>
        </div>
    );
};

const SaveChatModal = ({ isOpen, onClose, onSave, filename, setFilename }: { isOpen: boolean, onClose: () => void, onSave: () => void, filename: string, setFilename: (name: string) => void }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" aria-modal="true" role="dialog">
            <div className="bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-md animate-fade-in-up">
                <h2 className="text-xl font-bold text-slate-100 mb-4">Save Conversation</h2>
                <p className="text-slate-400 mb-4">Enter a filename for your conversation text file.</p>
                <div>
                    <label htmlFor="filename" className="block text-sm font-medium text-slate-300 mb-1">Filename</label>
                    <input
                        id="filename"
                        type="text"
                        value={filename}
                        onChange={(e) => setFilename(e.target.value)}
                        className="w-full bg-slate-700 border border-slate-600 rounded-md py-2 px-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                </div>
                <div className="mt-6 flex justify-end space-x-4">
                    <button onClick={onClose} className="bg-slate-600 hover:bg-slate-700 text-white font-bold py-2 px-4 rounded-md transition duration-300">
                        Cancel
                    </button>
                    <button onClick={onSave} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-md transition duration-300">
                        Save
                    </button>
                </div>
            </div>
        </div>
    );
};


export default function App() {
    const [adminSettings, setAdminSettings] = useLocalStorage<AdminSettings>('prompt-gen-admin-settings', { accessSecret: 'CLIENT', isGateEnabled: true });
    const [accessLevel, setAccessLevel] = useLocalStorage<AccessLevel>('prompt-gen-access-level', 'none');
    
    const [userInput, setUserInput] = useState('');
    const [tone, setTone] = useState(TONES[0]);
    const [targetAudience, setTargetAudience] = useState('');

    const [generatedPrompt, setGeneratedPrompt] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [history, setHistory] = useLocalStorage<HistoryItem[]>('prompt-gen-history', []);
    
    const [activeTab, setActiveTab] = useState<ActiveTab>('refine');

    // State for refining prompt
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
    const [isChatLoading, setIsChatLoading] = useState(false);
    const originalPromptForChat = useRef('');
    
    // State for testing prompt
    const [testChatHistory, setTestChatHistory] = useState<ChatMessage[]>([]);
    const [isTestChatLoading, setIsTestChatLoading] = useState(false);
    const testChatRef = useRef<Chat | null>(null);
    
    // State for save modal
    const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
    const [chatToSave, setChatToSave] = useState<'refine' | 'test' | null>(null);
    const [filename, setFilename] = useState('');

    const ai = useMemo(() => {
        if (!import.meta.env.VITE_API_KEY) {
            return null;
        }
        try {
            return new GoogleGenAI({ apiKey: import.meta.env.VITE_API_KEY });
        } catch (e) {
            console.error("Failed to initialize GoogleGenAI:", e);
            setError("Failed to initialize AI. Ensure API key is valid.");
            return null;
        }
    }, []);
    
    const resetChatStates = () => {
        setChatHistory([]);
        setTestChatHistory([]);
        testChatRef.current = null;
        setActiveTab('refine');
        setError(null);
    };

    const handleGeneratePrompt = useCallback(async (
        input: string,
        genTone: string,
        genAudience: string
    ) => {
        if (!ai) {
            setError("AI client not initialized. Please configure your API key.");
            return;
        }

        setIsLoading(true);
        setError(null);
        setGeneratedPrompt('');
        resetChatStates();

        try {
            const fullPrompt = `Generate a system prompt for an AI assistant.
      
            **Assistant's Purpose:** ${input}
            **Desired Tone:** ${genTone}
            **Target Audience:** ${genAudience}`;
            
            const stream = await ai.models.generateContentStream({
                model: 'gemini-2.5-flash',
                contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
                config: {
                  systemInstruction: GENERATE_SYSTEM_INSTRUCTION,
                },
            });

            let finalPrompt = '';
            for await (const chunk of stream) {
                const chunkText = chunk.text;
                if (chunkText) {
                    finalPrompt += chunkText;
                    setGeneratedPrompt(prev => prev + chunkText);
                }
            }
            
            originalPromptForChat.current = finalPrompt;

            setHistory(prev => [{
                id: crypto.randomUUID(),
                prompt: finalPrompt,
                timestamp: Date.now(),
                userInput: input,
                tone: genTone,
                targetAudience: genAudience,
            }, ...prev.slice(0, 49)]); // Keep history to 50 items

        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : 'An unknown error occurred.');
        } finally {
            setIsLoading(false);
        }
    }, [ai, setHistory]);

    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        handleGeneratePrompt(userInput, tone, targetAudience);
    };

    const handleRecommendedClick = (title: string, description: string) => {
        const input = `${title}. ${description}`;
        setUserInput(input);
        handleGeneratePrompt(input, 'Professional', 'General users');
    }

    const handleSelectHistory = (item: HistoryItem) => {
        setUserInput(item.userInput);
        setTone(item.tone);
        setTargetAudience(item.targetAudience);
        setGeneratedPrompt(item.prompt);
        originalPromptForChat.current = item.prompt;
        resetChatStates();
    }

    const handleClearHistoryItem = (id: string) => {
        setHistory(prev => prev.filter(item => item.id !== id));
    }
    
    const handleClearAllHistory = () => {
        if (window.confirm('Are you sure you want to clear all generation history?')) {
            setHistory([]);
        }
    }

    const handleSendMessage = useCallback(async (message: string) => {
        if (!ai) {
            setError("AI client not initialized. Please configure your API key.");
            return;
        }
        setIsChatLoading(true);
        const currentChatHistory = [...chatHistory, { role: 'user' as const, content: message }, { role: 'model' as const, content: '' }];
        setChatHistory(currentChatHistory);

        try {
            const chat: Chat = ai.chats.create({
                model: 'gemini-2.5-flash',
                config: {
                    systemInstruction: REFINE_SYSTEM_INSTRUCTION,
                },
                history: [{ role: 'model', parts: [{ text: originalPromptForChat.current }] }]
            });
              
            const stream = await chat.sendMessageStream({ message });

            let finalResponse = '';
            for await (const chunk of stream) {
                const chunkText = chunk.text;
                if (chunkText) {
                    finalResponse += chunkText;
                    setChatHistory(prev => {
                        const newHistory = [...prev];
                        newHistory[newHistory.length - 1].content = finalResponse;
                        return newHistory;
                    });
                }
            }

            setGeneratedPrompt(finalResponse);
            originalPromptForChat.current = finalResponse;
        } catch (err) {
            console.error(err);
            const errorMsg = err instanceof Error ? err.message : 'An unknown error occurred.';
            setChatHistory(prev => {
                const newHistory = [...prev];
                newHistory[newHistory.length-1].content = `Error: ${errorMsg}`;
                return newHistory;
            });
        } finally {
            setIsChatLoading(false);
        }
    }, [ai, chatHistory]);
    
    const handleSendTestMessage = useCallback(async (message: string) => {
        if (!ai || !generatedPrompt) {
            setError("AI client not initialized or no prompt generated.");
            return;
        }
        setIsTestChatLoading(true);
        setTestChatHistory(prev => [...prev, { role: 'user', content: message }, { role: 'model', content: '' }]);

        try {
            if (!testChatRef.current) {
                testChatRef.current = ai.chats.create({
                    model: 'gemini-2.5-flash',
                    config: {
                        systemInstruction: generatedPrompt,
                    },
                });
            }

            const stream = await testChatRef.current.sendMessageStream({ message });

            let finalResponse = '';
            for await (const chunk of stream) {
                const chunkText = chunk.text;
                if (chunkText) {
                    finalResponse += chunkText;
                    setTestChatHistory(prev => {
                        const newHistory = [...prev];
                        newHistory[newHistory.length - 1].content = finalResponse;
                        return newHistory;
                    });
                }
            }
        } catch (err) {
            console.error("Test Chat Error:", err);
            const errorMsg = err instanceof Error ? err.message : 'An unknown error occurred.';
            setTestChatHistory(prev => {
                const newHistory = [...prev];
                newHistory[newHistory.length-1].content = `Error: ${errorMsg}`;
                return newHistory;
            });
        } finally {
            setIsTestChatLoading(false);
        }
    }, [ai, generatedPrompt]);

    const handleClearTestChat = () => {
        setTestChatHistory([]);
        testChatRef.current = null;
    };
    
    const handleOpenSaveModal = (type: 'refine' | 'test') => {
        setChatToSave(type);
        const defaultFilename = `${type}-conversation-${new Date().toISOString().split('T')[0]}.txt`;
        setFilename(defaultFilename);
        setIsSaveModalOpen(true);
    };

    const handleSaveToFile = () => {
        const historyToSave = chatToSave === 'refine' ? chatHistory : testChatHistory;
        const promptForContext = chatToSave === 'refine' ? originalPromptForChat.current : generatedPrompt;

        let fileContent = `Conversation from AI Prompt Generator\n`;
        fileContent += `Date: ${new Date().toLocaleString()}\n`;
        fileContent += `\n====================\n`;
        fileContent += `SYSTEM PROMPT USED:\n`;
        fileContent += `====================\n\n`;
        fileContent += `${promptForContext}\n\n`;
        fileContent += `====================\n`;
        fileContent += `CONVERSATION:\n`;
        fileContent += `====================\n\n`;

        historyToSave.forEach(msg => {
            const prefix = msg.role === 'user' ? 'User:' : 'Assistant:';
            fileContent += `${prefix}\n${msg.content}\n\n`;
        });

        const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename.endsWith('.txt') ? filename : `${filename}.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        setIsSaveModalOpen(false);
        setChatToSave(null);
    };

    const handleLogout = () => {
        setAccessLevel('none');
    };

    if (accessLevel === 'none') {
        return <AccessGate setAccessLevel={setAccessLevel} adminSettings={adminSettings} />;
    }

    return (
        <div className="min-h-screen bg-slate-900 text-slate-200">
            <div className="absolute top-4 right-4">
                <button onClick={handleLogout} className="flex items-center space-x-2 bg-slate-700 hover:bg-slate-600 text-slate-300 font-semibold py-2 px-4 rounded-lg transition duration-300">
                    <ArrowLeftOnRectangleIcon className="h-5 w-5" />
                    <span>Logout</span>
                </button>
            </div>
            <main className="max-w-4xl mx-auto px-4 py-12">
                <AppHeader />
                
                {accessLevel === 'admin' && <AdminPanel settings={adminSettings} setSettings={setAdminSettings} />}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                    {/* Left Column: Input Form */}
                    <div className="space-y-6">
                        <form onSubmit={handleFormSubmit} className="space-y-4 bg-slate-800 p-6 rounded-lg border border-slate-700">
                            <div>
                                <label htmlFor="userInput" className="block text-sm font-medium text-slate-300 mb-1">Describe your AI Assistant</label>
                                <textarea
                                    id="userInput"
                                    rows={5}
                                    value={userInput}
                                    onChange={(e) => setUserInput(e.target.value)}
                                    placeholder="e.g., A helpful assistant for planning family vacations..."
                                    className="w-full bg-slate-700 border border-slate-600 rounded-md py-2 px-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    required
                                />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="tone" className="block text-sm font-medium text-slate-300 mb-1">Tone</label>
                                    <select
                                        id="tone"
                                        value={tone}
                                        onChange={(e) => setTone(e.target.value)}
                                        className="w-full bg-slate-700 border border-slate-600 rounded-md py-2 px-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    >
                                        {TONES.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="audience" className="block text-sm font-medium text-slate-300 mb-1">Target Audience</label>
                                    <input
                                        id="audience"
                                        type="text"
                                        value={targetAudience}
                                        onChange={(e) => setTargetAudience(e.target.value)}
                                        placeholder="e.g., Busy parents"
                                        className="w-full bg-slate-700 border border-slate-600 rounded-md py-2 px-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        required
                                    />
                                </div>
                            </div>
                            <button type="submit" disabled={isLoading || !ai} className="w-full flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-800 disabled:cursor-not-allowed text-white font-bold py-2.5 px-4 rounded-md transition duration-300">
                                {isLoading ? <SpinnerIcon className="w-5 h-5 animate-spin mr-2" /> : <SparklesIcon className="w-5 h-5 mr-2" />}
                                {isLoading ? 'Generating...' : !ai ? 'API Key Missing' : 'Generate Prompt'}
                            </button>
                        </form>

                        <div className="space-y-2">
                             <h3 className="text-lg font-semibold text-slate-300">Or try one of these...</h3>
                             <div className="grid grid-cols-1 gap-3">
                                <RecommendedPromptCard 
                                    icon={<SparklesIcon className="h-6 w-6 text-green-400" />}
                                    title="Tutor"
                                    description="An expert tutor on any subject, explaining complex topics simply."
                                    onClick={() => handleRecommendedClick('Expert Tutor', 'An AI that can act as an expert tutor on any subject requested by the user. It should be able to break down complex topics into simple, understandable concepts.')}
                                />
                                <RecommendedPromptCard 
                                    icon={<SparklesIcon className="h-6 w-6 text-blue-400" />}
                                    title="Code Reviewer"
                                    description="A meticulous assistant that reviews code for errors and best practices."
                                    onClick={() => handleRecommendedClick('Code Reviewer', 'An AI assistant that reviews code snippets provided by the user. It should identify bugs, suggest improvements for readability and performance, and enforce best practices.')}
                                />
                                <RecommendedPromptCard 
                                    icon={<SparklesIcon className="h-6 w-6 text-purple-400" />}
                                    title="Team and Leadership Coach"
                                    description="A coach that helps managers improve team dynamics and leadership skills."
                                    onClick={() => handleRecommendedClick('Team and Leadership Coach', 'An AI coach designed to help managers and team leads improve their leadership skills, resolve team conflicts, and foster a positive and productive work environment.')}
                                />
                                <RecommendedPromptCard 
                                    icon={<SparklesIcon className="h-6 w-6 text-yellow-400" />}
                                    title="Productivity Coach"
                                    description="An assistant to help users manage tasks, set goals, and improve focus."
                                    onClick={() => handleRecommendedClick('Productivity Coach', 'An AI assistant focused on helping users manage their time, prioritize tasks using frameworks like the Eisenhower Matrix, and build effective habits to combat procrastination.')}
                                />
                                <RecommendedPromptCard 
                                    icon={<SparklesIcon className="h-6 w-6 text-pink-400" />}
                                    title="Mental Health Advisor"
                                    description="A supportive companion offering mental wellness tips and exercises."
                                    onClick={() => handleRecommendedClick('Mental Health Advisor', 'A supportive and empathetic AI companion that provides information on mental wellness, offers guided breathing exercises, and suggests mindfulness techniques. CRITICAL: This AI must not provide medical advice and must strongly advise users to consult a qualified healthcare professional.')}
                                />
                                <RecommendedPromptCard 
                                    icon={<SparklesIcon className="h-6 w-6 text-orange-400" />}
                                    title="Entrepreneur Coach"
                                    description="A guide for entrepreneurs to navigate startup challenges and business strategy."
                                    onClick={() => handleRecommendedClick('Entrepreneur Coach', 'An AI mentor for entrepreneurs that provides guidance on business strategy, fundraising, marketing, and navigating the challenges of building a startup.')}
                                />
                             </div>
                        </div>
                    </div>

                    {/* Right Column: Output */}
                    <div className="space-y-4">
                        <PromptOutput prompt={generatedPrompt} isLoading={isLoading} error={error} />
                        <HistoryPanel history={history} onSelect={handleSelectHistory} onClear={handleClearHistoryItem} onClearAll={handleClearAllHistory} />
                    </div>
                </div>

                {generatedPrompt && !isLoading && (
                    <div className="mt-8 animate-fade-in-up">
                         <div className="flex space-x-2 border-b border-slate-700 mb-4">
                            <button
                                onClick={() => setActiveTab('refine')}
                                className={`py-2 px-4 font-semibold rounded-t-lg transition-colors border-b-2 ${activeTab === 'refine' ? 'bg-slate-800/50 text-indigo-300 border-indigo-400' : 'text-slate-400 hover:bg-slate-800/20 border-transparent'}`}
                                aria-current={activeTab === 'refine'}
                            >
                                Refine Prompt
                            </button>
                            <button
                                onClick={() => setActiveTab('test')}
                                className={`py-2 px-4 font-semibold rounded-t-lg transition-colors border-b-2 ${activeTab === 'test' ? 'bg-slate-800/50 text-green-300 border-green-400' : 'text-slate-400 hover:bg-slate-800/20 border-transparent'}`}
                                aria-current={activeTab === 'test'}
                            >
                                Test Chat
                            </button>
                        </div>
                        
                        {activeTab === 'refine' && (
                            <ChatPanel onSendMessage={handleSendMessage} chatHistory={chatHistory} isLoading={isChatLoading} onSaveRequest={() => handleOpenSaveModal('refine')} />
                        )}
                        
                        {activeTab === 'test' && (
                            <TestChatPanel onSendMessage={handleSendTestMessage} chatHistory={testChatHistory} isLoading={isTestChatLoading} onClear={handleClearTestChat} onSaveRequest={() => handleOpenSaveModal('test')} />
                        )}
                    </div>
                )}
            </main>
            <SaveChatModal 
                isOpen={isSaveModalOpen} 
                onClose={() => setIsSaveModalOpen(false)}
                onSave={handleSaveToFile}
                filename={filename}
                setFilename={setFilename}
            />
        </div>
    );
}