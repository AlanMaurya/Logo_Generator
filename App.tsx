
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { generateLogoImage, generateLogoVideo } from './services/geminiService';
import { fileToBase64 } from './utils';

type AspectRatio = '16:9' | '9:16';

// FIX: Define a named interface for aistudio to resolve conflicts with other global declarations.
// This resolves the error "Property 'aistudio' must be of type 'AIStudio'".
interface AIStudio {
  hasSelectedApiKey: () => Promise<boolean>;
  openSelectKey: () => Promise<void>;
}

// Extend the global Window interface for aistudio
declare global {
  interface Window {
    aistudio: AIStudio;
  }
}

const LoadingSpinner: React.FC<{className?: string}> = ({ className }) => (
    <svg className={`animate-spin -ml-1 mr-3 h-5 w-5 text-white ${className}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);

const videoLoadingMessages = [
    "Warming up the animation engine...",
    "Teaching the pixels to dance...",
    "Composing a symphony of light and motion...",
    "This can take a few minutes, please be patient...",
    "Rendering the final masterpiece...",
    "Almost there, adding the final sparkle...",
];

export default function App() {
    const [logoPrompt, setLogoPrompt] = useState<string>('A minimalist, geometric fox logo, clean lines, orange and white.');
    const [animationPrompt, setAnimationPrompt] = useState<string>('The fox logo winks, and then futuristic digital circuits glow behind it.');
    
    const [generatedLogo, setGeneratedLogo] = useState<string | null>(null);
    const [generatedVideo, setGeneratedVideo] = useState<string | null>(null);
    const [logoToAnimate, setLogoToAnimate] = useState<string | null>(null);

    const [isGeneratingLogo, setIsGeneratingLogo] = useState<boolean>(false);
    const [isGeneratingVideo, setIsGeneratingVideo] = useState<boolean>(false);
    
    const [error, setError] = useState<string | null>(null);
    const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
    
    const [hasApiKey, setHasApiKey] = useState(false);
    const [videoLoadingMessage, setVideoLoadingMessage] = useState(videoLoadingMessages[0]);
    
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        // FIX: Use ReturnType<typeof setInterval> for browser compatibility instead of NodeJS.Timeout.
        let interval: ReturnType<typeof setInterval>;
        if (isGeneratingVideo) {
            interval = setInterval(() => {
                setVideoLoadingMessage(prev => {
                    const currentIndex = videoLoadingMessages.indexOf(prev);
                    const nextIndex = (currentIndex + 1) % videoLoadingMessages.length;
                    return videoLoadingMessages[nextIndex];
                });
            }, 4000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [isGeneratingVideo]);

    const handleGenerateLogo = useCallback(async () => {
        if (!logoPrompt.trim()) {
            setError('Please enter a description for your logo.');
            return;
        }
        setIsGeneratingLogo(true);
        setError(null);
        setGeneratedLogo(null);
        setLogoToAnimate(null);
        setGeneratedVideo(null);

        try {
            const imageB64 = await generateLogoImage(logoPrompt);
            const imageUrl = `data:image/jpeg;base64,${imageB64}`;
            setGeneratedLogo(imageUrl);
            setLogoToAnimate(imageUrl);
        } catch (e: any) {
            setError(e.message || 'Failed to generate logo.');
            console.error(e);
        } finally {
            setIsGeneratingLogo(false);
        }
    }, [logoPrompt]);

    const handleGenerateVideo = useCallback(async () => {
        if (!logoToAnimate) {
            setError('Please generate or upload a logo to animate.');
            return;
        }
        if (!animationPrompt.trim()) {
            setError('Please enter a prompt for the animation.');
            return;
        }
        
        try {
            // Re-check API key right before use
            const keySelected = await window.aistudio.hasSelectedApiKey();
            setHasApiKey(keySelected);
            if (!keySelected) {
                setError("Please select an API key to generate videos.");
                return;
            }

            setIsGeneratingVideo(true);
            setError(null);
            setGeneratedVideo(null);

            // Extract base64 data from data URL
            const base64Data = logoToAnimate.split(',')[1];
            const videoUrl = await generateLogoVideo(animationPrompt, base64Data, aspectRatio);
            setGeneratedVideo(videoUrl);

        } catch (e: any) {
            console.error(e);
            let errorMessage = e.message || 'An unknown error occurred during video generation.';
            if (errorMessage.includes("Requested entity was not found")) {
                errorMessage = "API Key not found or invalid. Please re-select your API key.";
                setHasApiKey(false);
            }
            setError(errorMessage);
        } finally {
            setIsGeneratingVideo(false);
        }
    }, [logoToAnimate, animationPrompt, aspectRatio]);

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            try {
                setError(null);
                const base64 = await fileToBase64(file);
                setLogoToAnimate(base64 as string);
                setGeneratedVideo(null); // Clear previous video
            } catch (err) {
                setError("Failed to read the uploaded file.");
                console.error(err);
            }
        }
    };
    
    const checkApiKey = useCallback(async () => {
        try {
            const keySelected = await window.aistudio.hasSelectedApiKey();
            setHasApiKey(keySelected);
        } catch (e) {
            console.error("aistudio not available", e);
        }
    }, []);
    
    useEffect(() => {
        checkApiKey();
    }, [checkApiKey]);
    
    const handleSelectKey = async () => {
        try {
            await window.aistudio.openSelectKey();
            // Assume success and optimistically update state to allow user to proceed
            setHasApiKey(true);
            setError(null); // Clear previous errors
        } catch (e) {
            console.error("Could not open API key selection", e);
            setError("Failed to open API key selector. Please try again.");
        }
    };

    return (
        <div className="bg-gray-900 min-h-screen text-gray-100 font-sans p-4 sm:p-6 md:p-8">
            <div className="max-w-6xl mx-auto">
                <header className="text-center mb-10">
                    <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">
                        AI Logo Animator
                    </h1>
                    <p className="mt-2 text-lg text-gray-400">
                        From Concept to Motion in Two Steps.
                    </p>
                </header>

                {error && (
                    <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded-lg relative mb-6" role="alert">
                        <strong className="font-bold">Error: </strong>
                        <span className="block sm:inline">{error}</span>
                    </div>
                )}
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Step 1: Design Logo */}
                    <div className="bg-gray-800 p-6 rounded-2xl shadow-lg border border-gray-700 flex flex-col">
                        <div className="flex items-center mb-4">
                            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-600 text-white font-bold text-lg mr-3">1</span>
                            <h2 className="text-2xl font-bold">Design Your Logo</h2>
                        </div>
                        <p className="text-gray-400 mb-4">Describe the logo you want to create. Be as specific as possible for the best results.</p>
                        <textarea
                            className="w-full p-3 bg-gray-700 rounded-lg text-gray-200 border border-gray-600 focus:ring-2 focus:ring-purple-500 focus:outline-none transition duration-200 h-28 resize-none"
                            placeholder="e.g., A majestic lion wearing a crown, in a vector art style..."
                            value={logoPrompt}
                            onChange={(e) => setLogoPrompt(e.target.value)}
                            disabled={isGeneratingLogo}
                        />
                        <button
                            onClick={handleGenerateLogo}
                            disabled={isGeneratingLogo}
                            className="mt-4 w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white font-bold py-3 px-4 rounded-lg transition duration-200 flex items-center justify-center"
                        >
                            {isGeneratingLogo ? <><LoadingSpinner /> Generating...</> : 'Generate Logo'}
                        </button>
                        <div className="mt-6 flex-grow flex items-center justify-center bg-gray-900/50 rounded-lg min-h-[256px] p-4">
                            {isGeneratingLogo && <LoadingSpinner className="h-10 w-10"/>}
                            {!isGeneratingLogo && generatedLogo && (
                                <img src={generatedLogo} alt="Generated Logo" className="max-w-full max-h-64 object-contain rounded-md" />
                            )}
                            {!isGeneratingLogo && !generatedLogo && (
                                <p className="text-gray-500">Your generated logo will appear here.</p>
                            )}
                        </div>
                    </div>

                    {/* Step 2: Animate Logo */}
                    <div className={`bg-gray-800 p-6 rounded-2xl shadow-lg border border-gray-700 flex flex-col transition-opacity duration-500 ${!logoToAnimate ? 'opacity-50' : 'opacity-100'}`}>
                        <div className="flex items-center mb-4">
                            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-pink-600 text-white font-bold text-lg mr-3">2</span>
                            <h2 className="text-2xl font-bold">Animate Your Logo</h2>
                        </div>
                        
                        <div className="flex-grow flex flex-col">
                            {!logoToAnimate && (
                                <div className="flex-grow flex items-center justify-center text-center text-gray-500">
                                    <p>Generate or upload a logo to begin animation.</p>
                                </div>
                            )}

                            {logoToAnimate && (
                                <>
                                    <div className="relative bg-gray-900/50 rounded-lg p-2 mb-4 h-32 flex items-center justify-center">
                                        <img src={logoToAnimate} alt="Logo to animate" className="max-h-full max-w-full object-contain rounded-md" />
                                        <button onClick={() => fileInputRef.current?.click()} className="absolute bottom-2 right-2 bg-gray-700/80 hover:bg-gray-600 text-white text-xs py-1 px-2 rounded-md backdrop-blur-sm">
                                            Upload different
                                        </button>
                                        <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
                                    </div>
                                    <p className="text-gray-400 mb-2 text-sm">Describe how you want to animate this logo.</p>
                                    <textarea
                                        className="w-full p-3 bg-gray-700 rounded-lg text-gray-200 border border-gray-600 focus:ring-2 focus:ring-pink-500 focus:outline-none transition duration-200 h-24 resize-none"
                                        placeholder="e.g., The logo zooms in with a glitch effect..."
                                        value={animationPrompt}
                                        onChange={(e) => setAnimationPrompt(e.target.value)}
                                        disabled={isGeneratingVideo}
                                    />
                                    
                                    <div className="mt-4">
                                        <p className="text-gray-400 mb-2 text-sm">Aspect Ratio:</p>
                                        <div className="grid grid-cols-2 gap-2">
                                            <button onClick={() => setAspectRatio('16:9')} disabled={isGeneratingVideo} className={`p-2 rounded-lg text-sm font-medium border-2 transition ${aspectRatio === '16:9' ? 'bg-pink-600 border-pink-500' : 'bg-gray-700 border-gray-600 hover:border-pink-500'}`}>Landscape (16:9)</button>
                                            <button onClick={() => setAspectRatio('9:16')} disabled={isGeneratingVideo} className={`p-2 rounded-lg text-sm font-medium border-2 transition ${aspectRatio === '9:16' ? 'bg-pink-600 border-pink-500' : 'bg-gray-700 border-gray-600 hover:border-pink-500'}`}>Portrait (9:16)</button>
                                        </div>
                                    </div>

                                    {!hasApiKey ? (
                                        <div className="mt-4 text-center bg-yellow-900/50 p-4 rounded-lg">
                                            <p className="text-yellow-300 mb-2">Video generation requires an API key.</p>
                                            <p className="text-xs text-yellow-400 mb-3">Billing is required for Veo. <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="underline hover:text-yellow-200">Learn more</a>.</p>
                                            <button onClick={handleSelectKey} className="bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-2 px-4 rounded-lg">
                                                Select API Key
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={handleGenerateVideo}
                                            disabled={isGeneratingVideo}
                                            className="mt-4 w-full bg-pink-600 hover:bg-pink-700 disabled:bg-gray-600 text-white font-bold py-3 px-4 rounded-lg transition duration-200 flex items-center justify-center"
                                        >
                                            {isGeneratingVideo ? <><LoadingSpinner /> Animating...</> : 'Generate Animation'}
                                        </button>
                                    )}

                                    <div className="mt-6 flex-grow flex items-center justify-center bg-gray-900/50 rounded-lg min-h-[256px] p-2">
                                        {isGeneratingVideo && (
                                            <div className="text-center">
                                                <LoadingSpinner className="h-10 w-10 mx-auto"/>
                                                <p className="mt-4 text-gray-400">{videoLoadingMessage}</p>
                                            </div>
                                        )}
                                        {!isGeneratingVideo && generatedVideo && (
                                            <video src={generatedVideo} controls autoPlay loop className="max-w-full max-h-full rounded-md" />
                                        )}
                                        {!isGeneratingVideo && !generatedVideo && (
                                            <p className="text-gray-500 text-center">Your animated logo will appear here.</p>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}