import React, { useState, useEffect, useContext, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import DarkModeToggle from '../components/DarkModeToggle';
import { AuthContext } from "../context/AuthContext";
import LogoutButton from '../components/LogoutButton';
import SavedRecipesButton from '../components/SavedRecipesButton';
import HomeButton from '../components/HomeButton';
import CookHistoryButton from '../components/CookHistoryButton';
import { API_URL } from '../config';
import { initAudio, playTick, stopAllSounds } from '../utils/soundUtils';
import Particle from '../components/Particle';
import { toast } from 'react-toastify';
import styled from 'styled-components';

const CookingPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good Morning' : hour < 18 ? 'Good Afternoon' : 'Good Evening';

  const [recipe, setRecipe] = useState(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [timer, setTimer] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [lang, setLang] = useState('en');
  const [ingredients, setIngredients] = useState([]);
  const [instructions, setInstructions] = useState([]);
  // Chat state
  const [chatHistory, setChatHistory] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatOpen, setIsChatOpen] = useState(false);
  // Track handled suggestions by index
  const [handledSuggestions, setHandledSuggestions] = useState({});
  const [savedRecipes, setSavedRecipes] = useState([]);

  const speechSynthesisRef = useRef(window.speechSynthesis);

  // Load saved progress on mount
  useEffect(() => {
    const savedProgress = localStorage.getItem('cookingProgress');
    if (savedProgress) {
      const { recipe: savedRecipe, currentStep: savedStep, lang: savedLang } = JSON.parse(savedProgress);
      setRecipe(savedRecipe);
      setCurrentStep(savedStep);
      setLang(savedLang);
    } else {
      const recipeData = location.state?.recipe;
      const language = location.state?.lang || 'en';
      
      if (recipeData) {
        setRecipe(recipeData);
        setLang(language);
      } else {
        navigate('/camera');
      }
    }
  }, [location.state, navigate]);

  // Save progress whenever it changes
  useEffect(() => {
    if (recipe && instructions.length > 0) {
      const recipeKey = recipe.title.replace(/\s+/g, '_');
      const progressData = {
        recipe,
        currentStep,
        lang,
        lastLeftAt: new Date().toISOString()
      };

      // Save general cooking progress
      localStorage.setItem('cookingProgress', JSON.stringify(progressData));

      // If the user has completed the recipe, mark it as completed
      if (currentStep === instructions.length - 1) {
        // Save to localStorage
        localStorage.setItem(`cookingProgress_${recipeKey}`, JSON.stringify({
          ...progressData,
          completed: true
        }));

        // Update backend to mark as completed
        const updateCookedRecipe = async () => {
          try {
            const token = localStorage.getItem('token');
            await axios.patch(`${API_URL}/api/recipe/cooked/${recipe._id}`, {
              completed: true,
              currentStep: currentStep
            }, {
              headers: { Authorization: `Bearer ${token}` }
            });
          } catch (err) {
            console.error('Failed to update recipe completion status:', err);
          }
        };
        updateCookedRecipe();
      } else {
        // If not completed, just update the progress
        localStorage.setItem(`cookingProgress_${recipeKey}`, JSON.stringify(progressData));
      }
    }
  }, [recipe, currentStep, lang, instructions]);

  // Parse recipe content when recipe changes
  useEffect(() => {
    if (recipe) {
      const content = recipe.content;
      
      // Split content into English and Hindi sections
      const sections = content.split(/\*\*Hindi Translation\*\*/i);
      const englishContent = sections[0];
      const hindiContent = sections[1] || '';
      
      // Extract ingredients and instructions based on language
      const contentToUse = lang === 'hi' ? hindiContent : englishContent;
      
      // Extract ingredients
      const ingredientsMatch = contentToUse.match(/\*\*(?:Ingredients|सामग्री):\*\*\s*\n\*([\s\S]*?)(?=\*\*(?:Instructions|निर्देश):\*\*|\*\*Approximate|$)/i);
      if (ingredientsMatch) {
        const ingredientsList = ingredientsMatch[1]
          .split('\n')
          .filter(line => line.trim().startsWith('*'))
          .map(line => line.trim().replace(/^\*\s*/, '').trim());
        setIngredients(ingredientsList);
      }

      // Extract instructions
      const instructionsMatch = contentToUse.match(/\*\*(?:Instructions|निर्देश):\*\*\s*\n([\s\S]*?)(?=\*\*Approximate|$)/i);
      if (instructionsMatch) {
        const instructionsList = instructionsMatch[1]
          .split('\n')
          .filter(line => line.trim().match(/^\d+\./))
          .map(line => line.trim().replace(/^\d+\.\s*/, '').trim());
        setInstructions(instructionsList);
      }
    }
  }, [recipe, lang]);

  // Fetch saved recipes on mount
  useEffect(() => {
    const fetchSavedRecipes = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`${API_URL}/api/recipe/user`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setSavedRecipes(res.data.recipes || []);
      } catch (err) {
        setSavedRecipes([]);
      }
    };
    fetchSavedRecipes();
  }, []);

  const startTimer = (minutes) => {
    if (timer) {
      clearInterval(timer);
    }
    setTimeLeft(minutes * 60);
    setIsTimerRunning(true);
    
    // Initialize audio and start ticking
    initAudio();
    
    const newTimer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(newTimer);
          setIsTimerRunning(false);
          stopAllSounds();
          return 0;
        }
        // Play tick sound
        playTick();
        return prev - 1;
      });
    }, 1000);
    setTimer(newTimer);
  };

  const stopTimer = () => {
    if (timer) {
      clearInterval(timer);
      setTimer(null);
      setIsTimerRunning(false);
      stopAllSounds();
    }
  };

  // Clean up audio on component unmount
  useEffect(() => {
    return () => {
      stopAllSounds();
    };
  }, []);

  const nextStep = () => {
    if (currentStep < instructions.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const extractTimeFromStep = (step) => {
    const timeMatch = step.match(/(\d+)\s*(?:minutes?|mins?|मिनट)/i);
    return timeMatch ? parseInt(timeMatch[1]) : null;
  };

  const handleContinueLater = () => {
    navigate('/cook-history');
  };

  const handleToggleLanguage = () => {
    setLang(lang === 'en' ? 'hi' : 'en');
  };

  const handleSendChat = async (message) => {
    if (!message.trim()) return;

    const newMessage = {
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    };

    setChatHistory(prev => [...prev, newMessage]);
    setChatInput('');

    try {
      const res = await axios.post(`${API_URL}/api/chat`, {
        message: message,
        recipe: recipe.title,
        currentStep: currentStep + 1,
        totalSteps: instructions.length,
        currentInstruction: instructions[currentStep],
        chatHistory: chatHistory.slice(-5) // Send last 5 messages for context
      });

      const assistantMessage = {
        role: 'assistant',
        content: res.data.response,
        timestamp: new Date().toISOString(),
        suggestions: res.data.suggestions || []
      };

      setChatHistory(prev => [...prev, assistantMessage]);
    } catch (err) {
      console.error('Chat error:', err);
      const errorMessage = {
        role: 'assistant',
        content: 'Sorry, I\'m having trouble responding right now. Please try again.',
        timestamp: new Date().toISOString()
      };
      setChatHistory(prev => [...prev, errorMessage]);
    }
  };

  const handleAcceptSuggestion = async (msg, idx) => {
    const suggestion = msg.suggestions[idx];
    if (!suggestion) return;

    // Mark this suggestion as handled
    setHandledSuggestions(prev => ({
      ...prev,
      [`${msg.timestamp}-${idx}`]: true
    }));

    // Add the suggestion to chat history
    const userMessage = {
      role: 'user',
      content: suggestion,
      timestamp: new Date().toISOString()
    };

    setChatHistory(prev => [...prev, userMessage]);

    try {
      const res = await axios.post(`${API_URL}/api/chat`, {
        message: suggestion,
        recipe: recipe.title,
        currentStep: currentStep + 1,
        totalSteps: instructions.length,
        currentInstruction: instructions[currentStep],
        chatHistory: chatHistory.slice(-5)
      });

      const assistantMessage = {
        role: 'assistant',
        content: res.data.response,
        timestamp: new Date().toISOString(),
        suggestions: res.data.suggestions || []
      };

      setChatHistory(prev => [...prev, assistantMessage]);
    } catch (err) {
      console.error('Chat error:', err);
      const errorMessage = {
        role: 'assistant',
        content: 'Sorry, I\'m having trouble responding right now. Please try again.',
        timestamp: new Date().toISOString()
      };
      setChatHistory(prev => [...prev, errorMessage]);
    }
  };

  const handleRejectSuggestion = (msg, idx) => {
    setHandledSuggestions(prev => ({
      ...prev,
      [`${msg.timestamp}-${idx}`]: true
    }));
  };

  const extractTitle = (content, lang) => {
    const parts = content.split(/[*]{2}Hindi Translation[:：]?[*]{2}/i);
    const text = lang === 'hi' ? parts[1] : parts[0];
    if (!text) return 'Untitled Recipe';
    
    const lines = text.split('\n').map(line => line.trim()).filter(line =>
      line && !line.toLowerCase().includes('translation')
    );
    
    for (let line of lines) {
      if (lang === 'hi') {
        const match = line.match(/^\*\*नाम:\*\*\s*(.+)$/);
        if (match) return match[1].trim();
      } else {
        const match = line.match(/^\*\*Name:\*\*\s*(.+)$/);
        if (match) return match[1].trim();
      }
    }
    return 'Untitled Recipe';
  };

  const speakStep = (text) => {
    if (speechSynthesisRef.current) {
      speechSynthesisRef.current.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang === 'hi' ? 'hi-IN' : 'en-US';
      utterance.rate = 0.8;
      speechSynthesisRef.current.speak(utterance);
    }
  };

  const handleSaveRecipe = async () => {
    try {
      const token = localStorage.getItem('token');
      const title = extractTitle(recipe.content, lang);
      
      // Check if recipe already exists in saved recipes
      const existingRecipe = savedRecipes.find(r => r.title === title);
      if (existingRecipe) {
        toast('Recipe already saved!');
        return;
      }

      await axios.post(
        `${API_URL}/api/recipe`,
        { 
          title, 
          content: recipe.content 
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast('✅ Recipe saved to your collection!');
      
      // Update saved recipes list
      setSavedRecipes(prev => [...prev, { title, content: recipe.content }]);
    } catch (err) {
      console.error(err);
      toast('❌ Failed to save recipe');
    }
  };

  if (!recipe) {
    return (
      <CookingWrapper>
        <div className="particle-bg">
          <Particle />
        </div>
        <div className="error-message">
          ❌ No recipe found. Please go back and generate a recipe first.
        </div>
      </CookingWrapper>
    );
  }

  const currentInstruction = instructions[currentStep];
  const timeForStep = extractTimeFromStep(currentInstruction);
  const isLastStep = currentStep === instructions.length - 1;
  const isFirstStep = currentStep === 0;

  return (
    <CookingWrapper>
      <div className="particle-bg">
        <Particle />
      </div>
      
      <div className="main-content">
        {/* Header Bar */}
        <div className="header-bar">
          <div className="header-content">
            <div className="header-left">
              <h1 className="greeting">
                {greeting}, {user?.name}! 🌱
              </h1>
              <div className="nav-buttons">
                <HomeButton />
                <SavedRecipesButton />
                <CookHistoryButton />
              </div>
            </div>
            <div className="header-right">
              <DarkModeToggle />
              <LogoutButton />
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="content-area">
          <div className="recipe-header">
            <h1 className="recipe-title">
              {extractTitle(recipe.content, lang)}
            </h1>
            <div className="recipe-actions">
              <button
                onClick={handleToggleLanguage}
                className="language-btn"
              >
                {lang === 'hi' ? 'Switch to English 🇬🇧' : 'Switch to Hindi 🇮🇳'}
              </button>
              <button
                onClick={handleSaveRecipe}
                className="save-btn"
              >
                💾 Save Recipe
              </button>
            </div>
          </div>

          <div className="cooking-container">
            {/* Progress Section */}
            <div className="progress-section">
              <div className="progress-bar">
                <div 
                  className="progress-fill"
                  style={{ width: `${((currentStep + 1) / instructions.length) * 100}%` }}
                />
              </div>
              <div className="progress-text">
                Step {currentStep + 1} of {instructions.length}
              </div>
            </div>

            {/* Current Step */}
            <div className="step-section">
              <h2 className="step-title">
                Step {currentStep + 1}
              </h2>
              <div className="step-content">
                <p className="step-text">{currentInstruction}</p>
                <div className="step-actions">
                  <button
                    onClick={() => speakStep(currentInstruction)}
                    className="speak-btn"
                  >
                    🔊 Speak
                  </button>
                  {timeForStep && (
                    <button
                      onClick={() => startTimer(timeForStep)}
                      className="timer-btn"
                      disabled={isTimerRunning}
                    >
                      ⏱️ {timeForStep} min
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Timer Display */}
            {isTimerRunning && (
              <div className="timer-section">
                <div className="timer-display">
                  <span className="timer-text">
                    {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                  </span>
                  <button
                    onClick={stopTimer}
                    className="stop-timer-btn"
                  >
                    ⏹️ Stop Timer
                  </button>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="navigation-buttons">
              <button
                onClick={prevStep}
                disabled={isFirstStep}
                className="nav-btn prev-btn"
              >
                ← Previous
              </button>
              <button
                onClick={nextStep}
                disabled={isLastStep}
                className="nav-btn next-btn"
              >
                Next →
              </button>
            </div>

            {/* Completion Message */}
            {isLastStep && (
              <div className="completion-section">
                <h2 className="completion-title">🎉 Congratulations!</h2>
                <p className="completion-text">
                  You've completed the recipe! Your dish is ready to serve.
                </p>
                <button
                  onClick={handleContinueLater}
                  className="continue-later-btn"
                >
                  View Cooking History
                </button>
              </div>
            )}

            {/* Chat Section */}
            <div className="chat-section">
              <button
                onClick={() => setIsChatOpen(!isChatOpen)}
                className="chat-toggle-btn"
              >
                {isChatOpen ? '✕ Close Chat' : '💬 Cooking Assistant'}
              </button>
              
              {isChatOpen && (
                <div className="chat-container">
                  <div className="chat-messages">
                    {chatHistory.map((msg, idx) => (
                      <div key={idx} className={`chat-message ${msg.role}`}>
                        <div className="message-content">{msg.content}</div>
                        {msg.suggestions && msg.suggestions.length > 0 && (
                          <div className="suggestions">
                            {msg.suggestions.map((suggestion, suggestionIdx) => (
                              <button
                                key={suggestionIdx}
                                onClick={() => handleAcceptSuggestion(msg, suggestionIdx)}
                                onContextMenu={(e) => {
                                  e.preventDefault();
                                  handleRejectSuggestion(msg, suggestionIdx);
                                }}
                                className={`suggestion-btn ${
                                  handledSuggestions[`${msg.timestamp}-${suggestionIdx}`] ? 'handled' : ''
                                }`}
                                disabled={handledSuggestions[`${msg.timestamp}-${suggestionIdx}`]}
                              >
                                {suggestion}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="chat-input-container">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSendChat(chatInput)}
                      placeholder="Ask for cooking help..."
                      className="chat-input"
                    />
                    <button
                      onClick={() => handleSendChat(chatInput)}
                      className="send-btn"
                    >
                      Send
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </CookingWrapper>
  );
};

export default CookingPage;

// Styled Components
const CookingWrapper = styled.div`
  min-height: 100vh;
  width: 100vw;
  position: relative;
  overflow-x: hidden;

  .particle-bg {
    position: fixed;
    inset: 0;
    z-index: 0;
  }

  .main-content {
    position: relative;
    z-index: 1;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  .header-bar {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 100;
    background: rgba(255,255,255,0.95);
    box-shadow: 0 2px 16px 0 rgba(0,0,0,0.07);
    border-radius: 0 0 24px 24px;
  }

  .header-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 24px;
    width: 100%;
    max-width: 1200px;
    margin: 0 auto;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 24px;
    flex: 1;
  }

  .greeting {
    font-size: clamp(1.25rem, 4vw, 1.75rem);
    font-weight: 700;
    color: #22543d;
    margin: 0;
    white-space: nowrap;
  }

  .nav-buttons {
    display: flex;
    gap: 12px;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .content-area {
    flex: 1;
    padding: 120px 24px 32px 24px;
    max-width: 800px;
    margin: 0 auto;
    width: 100%;
  }

  .error-message {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(255,255,255,0.9);
    padding: 24px;
    border-radius: 16px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.1);
    font-size: 1.2rem;
    color: #e53e3e;
    text-align: center;
    z-index: 10;
  }

  .recipe-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
    gap: 16px;
  }

  .recipe-title {
    font-size: clamp(1.5rem, 5vw, 2rem);
    font-weight: 700;
    color: #22543d;
    margin: 0;
    flex: 1;
  }

  .recipe-actions {
    display: flex;
    gap: 12px;
  }

  .language-btn,
  .save-btn {
    padding: 8px 16px;
    border: none;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    font-size: 0.9rem;
  }

  .language-btn {
    background: transparent;
    color: #3182ce;
    border: 1px solid #3182ce;
  }

  .language-btn:hover {
    background: #3182ce;
    color: white;
  }

  .save-btn {
    background: #38a169;
    color: white;
  }

  .save-btn:hover {
    background: #2f855a;
    transform: translateY(-1px);
  }

  .cooking-container {
    background: rgba(255,255,255,0.7);
    border-radius: 20px;
    padding: 24px;
    box-shadow: 0 4px 32px 0 rgba(0,0,0,0.08);
  }

  .progress-section {
    margin-bottom: 24px;
  }

  .progress-bar {
    width: 100%;
    height: 8px;
    background: rgba(203, 213, 224, 0.5);
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: 8px;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #38a169, #48bb78);
    border-radius: 4px;
    transition: width 0.3s ease;
  }

  .progress-text {
    text-align: center;
    font-weight: 600;
    color: #22543d;
    font-size: 0.9rem;
  }

  .step-section {
    margin-bottom: 24px;
  }

  .step-title {
    font-size: 1.5rem;
    font-weight: 600;
    color: #22543d;
    margin-bottom: 16px;
  }

  .step-content {
    background: rgba(247, 250, 252, 0.8);
    border-radius: 12px;
    padding: 20px;
  }

  .step-text {
    font-size: 1.1rem;
    line-height: 1.6;
    color: #2d3748;
    margin-bottom: 16px;
  }

  .step-actions {
    display: flex;
    gap: 12px;
  }

  .speak-btn,
  .timer-btn {
    padding: 8px 16px;
    border: none;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    font-size: 0.9rem;
  }

  .speak-btn {
    background: #3182ce;
    color: white;
  }

  .speak-btn:hover {
    background: #2c5aa0;
  }

  .timer-btn {
    background: #f59e0b;
    color: white;
  }

  .timer-btn:hover:not(:disabled) {
    background: #d97706;
  }

  .timer-btn:disabled {
    background: #9ca3af;
    cursor: not-allowed;
  }

  .timer-section {
    margin-bottom: 24px;
  }

  .timer-display {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
    background: rgba(245, 158, 11, 0.1);
    border-radius: 12px;
    padding: 16px;
  }

  .timer-text {
    font-size: 2rem;
    font-weight: 700;
    color: #92400e;
    font-family: monospace;
  }

  .stop-timer-btn {
    padding: 8px 16px;
    background: #e53e3e;
    color: white;
    border: none;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
  }

  .stop-timer-btn:hover {
    background: #c53030;
  }

  .navigation-buttons {
    display: flex;
    gap: 16px;
    margin-bottom: 24px;
  }

  .nav-btn {
    flex: 1;
    padding: 12px 24px;
    border: none;
    border-radius: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    font-size: 1rem;
  }

  .prev-btn {
    background: #718096;
    color: white;
  }

  .prev-btn:hover:not(:disabled) {
    background: #4a5568;
  }

  .next-btn {
    background: #38a169;
    color: white;
  }

  .next-btn:hover:not(:disabled) {
    background: #2f855a;
  }

  .nav-btn:disabled {
    background: #cbd5e0;
    cursor: not-allowed;
  }

  .completion-section {
    text-align: center;
    margin-bottom: 24px;
    padding: 24px;
    background: rgba(209, 250, 229, 0.8);
    border-radius: 12px;
  }

  .completion-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: #065f46;
    margin-bottom: 12px;
  }

  .completion-text {
    font-size: 1.1rem;
    color: #047857;
    margin-bottom: 16px;
  }

  .continue-later-btn {
    padding: 12px 24px;
    background: #3182ce;
    color: white;
    border: none;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
  }

  .continue-later-btn:hover {
    background: #2c5aa0;
  }

  .chat-section {
    margin-top: 24px;
  }

  .chat-toggle-btn {
    width: 100%;
    padding: 12px;
    background: #3182ce;
    color: white;
    border: none;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
  }

  .chat-toggle-btn:hover {
    background: #2c5aa0;
  }

  .chat-container {
    margin-top: 16px;
    background: rgba(247, 250, 252, 0.8);
    border-radius: 12px;
    overflow: hidden;
  }

  .chat-messages {
    max-height: 300px;
    overflow-y: auto;
    padding: 16px;
  }

  .chat-message {
    margin-bottom: 16px;
  }

  .chat-message.user {
    text-align: right;
  }

  .chat-message.assistant {
    text-align: left;
  }

  .message-content {
    display: inline-block;
    padding: 8px 12px;
    border-radius: 12px;
    max-width: 80%;
    word-wrap: break-word;
  }

  .chat-message.user .message-content {
    background: #3182ce;
    color: white;
  }

  .chat-message.assistant .message-content {
    background: #e2e8f0;
    color: #2d3748;
  }

  .suggestions {
    margin-top: 8px;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .suggestion-btn {
    padding: 4px 8px;
    background: #38a169;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 0.8rem;
    cursor: pointer;
    transition: all 0.3s ease;
  }

  .suggestion-btn:hover:not(:disabled) {
    background: #2f855a;
  }

  .suggestion-btn.handled {
    background: #9ca3af;
    cursor: not-allowed;
  }

  .chat-input-container {
    display: flex;
    padding: 16px;
    gap: 8px;
    border-top: 1px solid rgba(203, 213, 224, 0.3);
  }

  .chat-input {
    flex: 1;
    padding: 8px 12px;
    border: 1px solid #cbd5e0;
    border-radius: 6px;
    font-size: 0.9rem;
  }

  .send-btn {
    padding: 8px 16px;
    background: #38a169;
    color: white;
    border: none;
    border-radius: 6px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
  }

  .send-btn:hover {
    background: #2f855a;
  }

  /* Tablet Styles */
  @media (max-width: 1024px) {
    .header-content {
      padding: 14px 20px;
    }
    
    .header-left {
      gap: 20px;
    }
    
    .content-area {
      padding: 100px 20px 24px 20px;
    }
    
    .recipe-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 12px;
    }
    
    .recipe-actions {
      width: 100%;
      justify-content: space-between;
    }
  }

  /* Mobile Styles */
  @media (max-width: 768px) {
    .header-content {
      padding: 12px 16px;
    }
    
    .header-left {
      gap: 16px;
    }
    
    .greeting {
      font-size: 1.1rem;
    }
    
    .nav-buttons {
      gap: 8px;
    }
    
    .header-right {
      gap: 8px;
    }
    
    .content-area {
      padding: 90px 16px 20px 16px;
    }
    
    .recipe-title {
      font-size: 1.5rem;
    }
    
    .cooking-container {
      padding: 20px;
      border-radius: 16px;
    }
    
    .step-text {
      font-size: 1rem;
    }
    
    .step-actions {
      flex-direction: column;
      gap: 8px;
    }
    
    .speak-btn,
    .timer-btn {
      width: 100%;
      padding: 10px 16px;
    }
    
    .navigation-buttons {
      flex-direction: column;
      gap: 8px;
    }
    
    .nav-btn {
      padding: 12px 16px;
    }
    
    .timer-display {
      flex-direction: column;
      gap: 12px;
    }
    
    .timer-text {
      font-size: 1.5rem;
    }
    
    .recipe-actions {
      flex-direction: column;
      gap: 8px;
    }
    
    .language-btn,
    .save-btn {
      width: 100%;
      padding: 10px 16px;
    }
  }

  /* Small Mobile Styles */
  @media (max-width: 480px) {
    .header-content {
      padding: 10px 12px;
    }
    
    .greeting {
      font-size: 1rem;
    }
    
    .nav-buttons {
      gap: 6px;
    }
    
    .header-right {
      gap: 6px;
    }
    
    .content-area {
      padding: 80px 12px 16px 12px;
    }
    
    .recipe-title {
      font-size: 1.25rem;
    }
    
    .cooking-container {
      padding: 16px;
      border-radius: 12px;
    }
    
    .step-title {
      font-size: 1.25rem;
    }
    
    .step-text {
      font-size: 0.9rem;
    }
    
    .timer-text {
      font-size: 1.25rem;
    }
    
    .completion-title {
      font-size: 1.25rem;
    }
    
    .completion-text {
      font-size: 1rem;
    }
    
    .chat-messages {
      max-height: 200px;
    }
    
    .message-content {
      max-width: 90%;
      font-size: 0.85rem;
    }
  }

  /* Landscape Mobile */
  @media (max-width: 768px) and (orientation: landscape) {
    .content-area {
      padding: 70px 16px 16px 16px;
    }
    
    .chat-messages {
      max-height: 150px;
    }
  }
`;
