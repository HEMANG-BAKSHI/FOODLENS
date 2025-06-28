import React, { useEffect, useState, useContext } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../config';
import Modal from 'react-modal';
import Particles from '../components/Particle';
import { toast } from 'react-toastify';
import { AuthContext } from '../context/AuthContext';
import DarkModeToggle from '../components/DarkModeToggle';
import LogoutButton from '../components/LogoutButton';
import HomeButton from '../components/HomeButton';
import SavedRecipesButton from '../components/SavedRecipesButton';
import styled from 'styled-components';

const CookHistoryPage = () => {
  const { user } = useContext(AuthContext);
  const [cookingHistory, setCookingHistory] = useState([]);
  const [language, setLanguage] = useState({});
  const [showLanguageSelect, setShowLanguageSelect] = useState({});
  const [langModal, setLangModal] = useState({ show: false, recipe: null, step: 0, defaultLang: 'en' });
  const [editModal, setEditModal] = useState({ open: false, recipe: null, lang: 'en', title: '', content: '' });
  const [inlineLangModal, setInlineLangModal] = useState({ show: false, recipeId: null, step: 0, defaultLang: 'en', recipe: null });
  const navigate = useNavigate();
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good Morning' : hour < 18 ? 'Good Afternoon' : 'Good Evening';

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`${API_URL}/api/recipe/cooked`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setCookingHistory(res.data.history);
      } catch (err) {
        console.error(err);
        toast('Failed to load cook history');
      }
    };
    fetchHistory();
  }, []);

  const getLanguageContent = (recipe, lang) => {
    const parts = recipe.content.split(/[*]{2}Hindi Translation[:：]?[*]{2}/i);
    return lang === 'hi'
      ? parts[1]?.trim() || '❌ Hindi version not available.'
      : parts[0]?.trim();
  };

  const toggleLanguage = (id) => {
    setLanguage((prev) => {
      const newLang = prev[id] === 'hi' ? 'en' : 'hi';
      setLangPref(newLang);
      return {
        ...prev,
        [id]: newLang,
      };
    });
  };

  // Get last step for a recipe from localStorage
  const getLastStep = (id) => {
    const progress = localStorage.getItem(`cookingProgress_${id}`);
    if (progress) {
      try {
        const { currentStep } = JSON.parse(progress);
        return typeof currentStep === 'number' ? currentStep : 0;
      } catch {
        return 0;
      }
    }
    return 0;
  };

  // Save language preference
  const setLangPref = (lang) => {
    localStorage.setItem('cookingLang', lang);
  };
  // Get language preference
  const getLangPref = () => {
    return localStorage.getItem('cookingLang') || 'en';
  };

  // Check if recipe is completed (last step)
  const isCompleted = (recipe, instructions) => {
    // First check localStorage
    const recipeKey = recipe.title.replace(/\s+/g, '_');
    const progress = localStorage.getItem(`cookingProgress_${recipeKey}`);
    if (progress) {
      try {
        const { currentStep, completed } = JSON.parse(progress);
        if (completed) return true;
        return currentStep >= instructions.length - 1;
      } catch {
        return false;
      }
    }
    return false;
  };

  // Parse instructions from recipe content
  const getInstructions = (content, lang) => {
    const parts = content.split(/[*]{2}Hindi Translation[:：]?[*]{2}/i);
    const contentToUse = lang === 'hi' ? parts[1] || '' : parts[0];
    const match = contentToUse.match(/\*\*(?:Instructions|निर्देश):\*\*\s*\n([\s\S]*?)(?=\*\*Approximate|$)/i);
    if (match) {
      return match[1]
        .split('\n')
        .filter(line => line.trim().match(/^\d+\./))
        .map(line => line.trim().replace(/^\d+\.\s*/, '').trim());
    }
    return [];
  };

  // Get continue-later info for a recipe from localStorage
  const getContinueLaterInfo = (recipe) => {
    const recipeKey = recipe.title.replace(/\s+/g, '_');
    const progress = localStorage.getItem(`cookingProgress_${recipeKey}`);
    if (progress) {
      try {
        const { currentStep, lastLeftAt, lang } = JSON.parse(progress);
        return { currentStep, lastLeftAt, lang };
      } catch {
        return null;
      }
    }
    return null;
  };

  const handleContinueCooking = (recipe, lang, step) => {
    // Save progress to localStorage for CookingPage to pick up
    localStorage.setItem('cookingProgress', JSON.stringify({
      recipe: { title: recipe.title, content: recipe.content },
      currentStep: step,
      lang
    }));
    localStorage.setItem('cookingLang', lang);
    navigate('/cook', {
      state: {
        recipe: { title: recipe.title, content: recipe.content },
        lang
      }
    });
  };

  const handleRecook = async (recipe, lang) => {
    try {
      const token = localStorage.getItem('token');
      
      // Update the existing recipe in cooking history to start fresh
      await axios.patch(
        `${API_URL}/api/recipe/cooked/${recipe._id}`,
        {
          currentStep: 0,
          completed: false
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Reset localStorage progress
      const recipeKey = recipe.title.replace(/\s+/g, '_');
      localStorage.setItem(
        `cookingProgress_${recipeKey}`,
        JSON.stringify({
          recipe: { title: recipe.title, content: recipe.content },
          currentStep: 0,
          lang: lang,
          lastLeftAt: new Date().toISOString(),
          completed: false
        })
      );
      localStorage.setItem('cookingProgress', JSON.stringify({
        recipe: { title: recipe.title, content: recipe.content },
        currentStep: 0,
        lang: lang
      }));
      localStorage.setItem('cookingLang', lang);

      // Navigate to cooking page
      navigate('/cook', {
        state: {
          recipe: { title: recipe.title, content: recipe.content },
          lang: lang,
          currentStep: 0
        }
      });
    } catch (err) {
      console.error(err);
      toast('Failed to start recooking');
    }
  };

  // Handler for yellow Continue Cooking button
  const handlePromptLanguage = (recipe, continueInfo) => {
    const stepToResume = continueInfo?.currentStep || 0;
    const langToUse = continueInfo?.lang || getLangPref() || 'en';
    setInlineLangModal({ show: true, recipeId: recipe._id, step: stepToResume, defaultLang: langToUse, recipe });
  };

  const handleSelectLang = (lang) => {
    const { recipe, step } = inlineLangModal;
    setInlineLangModal({ show: false, recipeId: null, step: 0, defaultLang: 'en', recipe: null });
    handleContinueCooking(recipe, lang, step);
  };

  const handleSaveToSavedRecipes = async (recipe) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_URL}/api/recipe`,
        {
          title: recipe.title,
          content: recipe.content
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast('✅ Recipe saved to your collection!');
    } catch (err) {
      console.error(err);
      toast('❌ Failed to save recipe');
    }
  };

  // Helper to extract ingredients and steps
  const extractSections = (content, lang) => {
    const parts = content.split(/[*]{2}Hindi Translation[:：]?[*]{2}/i);
    const text = lang === 'hi' ? parts[1] : parts[0];
    if (!text) return { ingredients: [], steps: [] };
    // Ingredients
    const ingredientsMatch = text.match(/\*\*(?:Ingredients|सामग्री):\*\*\s*\n([\s\S]*?)(?=\*\*(?:Instructions|निर्देश):\*\*|$)/i);
    const ingredients = ingredientsMatch
      ? ingredientsMatch[1].split('\n').filter(line => line.trim().startsWith('*')).map(line => line.replace(/^\*\s*/, '').trim())
      : [];
    // Steps
    const stepsMatch = text.match(/\*\*(?:Instructions|निर्देश):\*\*\s*\n([\s\S]*)/i);
    const steps = stepsMatch
      ? stepsMatch[1].split('\n').filter(line => line.trim().match(/^\d+\./)).map(line => line.replace(/^\d+\.\s*/, '').trim())
      : [];
    return { ingredients, steps };
  };

  const extractTitle = (content, lang) => {
    const parts = content.split(/[*]{2}Hindi Translation[:：]?[*]{2}/i);
    const text = lang === 'hi' ? parts[1] : parts[0];
    if (!text) return 'Untitled Recipe';
    // Split into lines, ignore empty and translation header lines
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

  return (
    <CookHistoryWrapper>
      <div className="particle-bg">
        <Particles
          particleCount={200}
          particleColors={["#48bb78", "#38a169", "#ffffff"]}
          particleSpread={10}
          speed={0.15}
          alphaParticles={true}
        />
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
          <h1 className="page-title">🍳 Cook History</h1>
          
          {cookingHistory.length === 0 ? (
            <div className="empty-state">
              <p className="empty-text">No cooking history yet. Start cooking to see your progress!</p>
              <button
                onClick={() => navigate('/camera')}
                className="start-cooking-btn"
              >
                Start Cooking 🍳
              </button>
            </div>
          ) : (
            <div className="history-grid">
              {cookingHistory.map((recipe) => {
                const lang = language[recipe._id] || 'en';
                const { ingredients, steps } = extractSections(recipe.content, lang);
                const instructions = getInstructions(recipe.content, lang);
                const continueInfo = getContinueLaterInfo(recipe);
                const completed = isCompleted(recipe, instructions);
                
                return (
                  <div key={recipe._id} className="history-card">
                    <div className="recipe-header">
                      <h2 className="recipe-title">
                        {extractTitle(recipe.content, lang)}
                      </h2>
                      <button
                        onClick={() => toggleLanguage(recipe._id)}
                        className="language-toggle"
                      >
                        {lang === 'hi' ? 'Switch to English 🇬🇧' : 'Switch to Hindi 🇮🇳'}
                      </button>
                    </div>
                    
                    {/* Progress Status */}
                    <div className="progress-section">
                      {continueInfo ? (
                        <div className="continue-info">
                          <span className="status-badge continue">🔄 Continue Cooking</span>
                          <p className="progress-text">
                            Last left at step {continueInfo.currentStep + 1} of {instructions.length}
                          </p>
                          <p className="last-cooked">
                            Last cooked: {new Date(continueInfo.lastLeftAt).toLocaleDateString()}
                          </p>
                        </div>
                      ) : completed ? (
                        <div className="completed-info">
                          <span className="status-badge completed">✅ Completed</span>
                          <p className="progress-text">You've completed this recipe!</p>
                        </div>
                      ) : (
                        <div className="not-started-info">
                          <span className="status-badge not-started">⏳ Not Started</span>
                          <p className="progress-text">Ready to start cooking!</p>
                        </div>
                      )}
                    </div>
                    
                    {/* Ingredients Section */}
                    <div className="ingredients-section">
                      <h3 className="section-title">Ingredients Required:</h3>
                      <ul className="ingredients-list">
                        {ingredients.length > 0 ? ingredients.map((ing, idx) => (
                          <li key={idx}>{ing}</li>
                        )) : <li>No ingredients found.</li>}
                      </ul>
                    </div>
                    
                    {/* Steps Section */}
                    <div className="steps-section">
                      <h3 className="section-title">Steps:</h3>
                      <ol className="steps-list">
                        {steps.length > 0 ? steps.map((step, idx) => (
                          <li key={idx}>{step}</li>
                        )) : <li>No steps found.</li>}
                      </ol>
                    </div>
                    
                    {/* Action buttons */}
                    <div className="action-buttons">
                      {continueInfo ? (
                        <button
                          onClick={() => handlePromptLanguage(recipe, continueInfo)}
                          className="continue-btn"
                        >
                          Continue Cooking
                        </button>
                      ) : (
                        <button
                          onClick={() => handleRecook(recipe, lang)}
                          className="cook-btn"
                        >
                          {completed ? 'Cook Again' : 'Start Cooking'}
                        </button>
                      )}
                      <button
                        onClick={() => handleSaveToSavedRecipes(recipe)}
                        className="save-btn"
                      >
                        Save to Recipes
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Language Selection Modal */}
      <Modal
        isOpen={inlineLangModal.show}
        onRequestClose={() => setInlineLangModal({ show: false, recipeId: null, step: 0, defaultLang: 'en', recipe: null })}
        className="modal-content"
        overlayClassName="modal-overlay"
      >
        <div className="modal-header">
          <h2>Select Language</h2>
          <button
            onClick={() => setInlineLangModal({ show: false, recipeId: null, step: 0, defaultLang: 'en', recipe: null })}
            className="close-btn"
          >
            ×
          </button>
        </div>
        <div className="modal-body">
          <p>Choose your preferred language to continue cooking:</p>
          <div className="language-options">
            <button
              onClick={() => handleSelectLang('en')}
              className="lang-btn"
            >
              English 🇬🇧
            </button>
            <button
              onClick={() => handleSelectLang('hi')}
              className="lang-btn"
            >
              Hindi 🇮🇳
            </button>
          </div>
        </div>
      </Modal>
    </CookHistoryWrapper>
  );
};

export default CookHistoryPage;

// Styled Components
const CookHistoryWrapper = styled.div`
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
    max-width: 1200px;
    margin: 0 auto;
    width: 100%;
  }

  .page-title {
    font-size: clamp(2rem, 6vw, 2.5rem);
    font-weight: 700;
    color: #22543d;
    text-align: center;
    margin-bottom: 32px;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 64px 32px;
    background: rgba(255,255,255,0.7);
    border-radius: 24px;
    box-shadow: 0 4px 32px 0 rgba(0,0,0,0.08);
    text-align: center;
  }

  .empty-text {
    font-size: clamp(1rem, 4vw, 1.25rem);
    color: #4a5568;
    margin-bottom: 24px;
  }

  .start-cooking-btn {
    padding: 12px 32px;
    background: #38a169;
    color: white;
    border: none;
    border-radius: 12px;
    font-weight: 600;
    font-size: 1.1rem;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 4px 12px rgba(56, 161, 105, 0.3);
  }

  .start-cooking-btn:hover {
    background: #2f855a;
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(56, 161, 105, 0.4);
  }

  .history-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
    gap: 24px;
  }

  .history-card {
    background: rgba(255,255,255,0.7);
    border-radius: 20px;
    padding: 24px;
    box-shadow: 0 4px 32px 0 rgba(0,0,0,0.08);
    transition: transform 0.3s ease, box-shadow 0.3s ease;
  }

  .history-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 48px 0 rgba(0,0,0,0.12);
  }

  .recipe-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 16px;
    gap: 16px;
  }

  .recipe-title {
    font-size: clamp(1.25rem, 4vw, 1.5rem);
    font-weight: 600;
    color: #22543d;
    margin: 0;
    flex: 1;
  }

  .language-toggle {
    padding: 6px 12px;
    background: transparent;
    color: #3182ce;
    border: 1px solid #3182ce;
    border-radius: 8px;
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.3s ease;
    white-space: nowrap;
  }

  .language-toggle:hover {
    background: #3182ce;
    color: white;
  }

  .progress-section {
    margin: 16px 0;
    padding: 16px;
    background: rgba(247, 250, 252, 0.8);
    border-radius: 12px;
  }

  .status-badge {
    display: inline-block;
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 0.875rem;
    font-weight: 600;
    margin-bottom: 8px;
  }

  .status-badge.continue {
    background: #fef3c7;
    color: #92400e;
  }

  .status-badge.completed {
    background: #d1fae5;
    color: #065f46;
  }

  .status-badge.not-started {
    background: #e5e7eb;
    color: #374151;
  }

  .progress-text {
    margin: 4px 0;
    font-size: 0.9rem;
    color: #4a5568;
  }

  .last-cooked {
    margin: 4px 0;
    font-size: 0.8rem;
    color: #6b7280;
    font-style: italic;
  }

  .section-title {
    font-weight: 600;
    margin-bottom: 8px;
    color: #22543d;
    font-size: 1rem;
  }

  .ingredients-section,
  .steps-section {
    margin: 16px 0;
  }

  .ingredients-list,
  .steps-list {
    padding-left: 20px;
  }

  .ingredients-list li,
  .steps-list li {
    margin-bottom: 4px;
    color: #4a5568;
    font-size: 0.9rem;
  }

  .action-buttons {
    display: flex;
    gap: 12px;
    margin-top: 20px;
  }

  .continue-btn {
    padding: 10px 20px;
    background: #f59e0b;
    color: white;
    border: none;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    flex: 1;
    box-shadow: 0 2px 8px rgba(245, 158, 11, 0.3);
  }

  .continue-btn:hover {
    background: #d97706;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(245, 158, 11, 0.4);
  }

  .cook-btn {
    padding: 10px 20px;
    background: #38a169;
    color: white;
    border: none;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    flex: 1;
    box-shadow: 0 2px 8px rgba(56, 161, 105, 0.3);
  }

  .cook-btn:hover {
    background: #2f855a;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(56, 161, 105, 0.4);
  }

  .save-btn {
    padding: 10px 20px;
    background: #3182ce;
    color: white;
    border: none;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    flex: 1;
    box-shadow: 0 2px 8px rgba(49, 130, 206, 0.3);
  }

  .save-btn:hover {
    background: #2c5aa0;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(49, 130, 206, 0.4);
  }

  /* Modal Styles */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
  }

  .modal-content {
    background: white;
    border-radius: 16px;
    padding: 0;
    max-width: 400px;
    width: 90%;
    max-height: 90vh;
    overflow: auto;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px 24px;
    border-bottom: 1px solid #e5e7eb;
  }

  .modal-header h2 {
    margin: 0;
    color: #22543d;
    font-size: 1.25rem;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: #6b7280;
    padding: 0;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    transition: background-color 0.2s;
  }

  .close-btn:hover {
    background-color: #f3f4f6;
  }

  .modal-body {
    padding: 24px;
  }

  .modal-body p {
    margin-bottom: 20px;
    color: #4a5568;
  }

  .language-options {
    display: flex;
    gap: 12px;
  }

  .lang-btn {
    flex: 1;
    padding: 12px 16px;
    background: #3182ce;
    color: white;
    border: none;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
  }

  .lang-btn:hover {
    background: #2c5aa0;
    transform: translateY(-1px);
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
    
    .history-grid {
      grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
      gap: 20px;
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
    
    .page-title {
      font-size: 2rem;
      margin-bottom: 24px;
    }
    
    .empty-state {
      padding: 48px 24px;
      border-radius: 16px;
    }
    
    .history-grid {
      grid-template-columns: 1fr;
      gap: 16px;
    }
    
    .history-card {
      padding: 20px;
      border-radius: 16px;
    }
    
    .recipe-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 12px;
    }
    
    .language-toggle {
      align-self: flex-start;
    }
    
    .action-buttons {
      flex-direction: column;
      gap: 8px;
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
    
    .page-title {
      font-size: 1.75rem;
      margin-bottom: 20px;
    }
    
    .empty-state {
      padding: 32px 16px;
      border-radius: 12px;
    }
    
    .empty-text {
      font-size: 1rem;
    }
    
    .start-cooking-btn {
      padding: 10px 24px;
      font-size: 1rem;
    }
    
    .history-card {
      padding: 16px;
      border-radius: 12px;
    }
    
    .recipe-title {
      font-size: 1.25rem;
    }
    
    .section-title {
      font-size: 0.9rem;
    }
    
    .ingredients-list li,
    .steps-list li {
      font-size: 0.85rem;
    }
    
    .continue-btn,
    .cook-btn,
    .save-btn {
      padding: 8px 16px;
      font-size: 0.9rem;
    }
  }

  /* Landscape Mobile */
  @media (max-width: 768px) and (orientation: landscape) {
    .empty-state {
      padding: 32px 24px;
    }
    
    .history-grid {
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    }
  }
`;
