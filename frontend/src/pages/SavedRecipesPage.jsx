import React, { useEffect, useState, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from "../context/AuthContext";
import DarkModeToggle from '../components/DarkModeToggle';
import LogoutButton from '../components/LogoutButton';
import HomeButton from '../components/HomeButton';
import CookHistoryButton from '../components/CookHistoryButton';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../config';
import Particles from '../components/Particle';
import { toast } from 'react-toastify';
import styled from 'styled-components';

const SavedRecipesPage = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good Morning' : hour < 18 ? 'Good Afternoon' : 'Good Evening';

  const [recipes, setRecipes] = useState([]);
  const [language, setLanguage] = useState({});
  const [showLanguageSelect, setShowLanguageSelect] = useState({});
  const [cookingHistory, setCookingHistory] = useState([]);

  useEffect(() => {
    const fetchRecipes = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`${API_URL}/api/recipe/user`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setRecipes(res.data.recipes);
      } catch (err) {
        console.error(err);
        toast('Failed to fetch saved recipes');
      }
    };

    const fetchCookingHistory = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`${API_URL}/api/recipe/cooked`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setCookingHistory(res.data.history || []);
      } catch (err) {
        console.error(err);
      }
    };

    fetchRecipes();
    fetchCookingHistory();
  }, []);

  const updateRecipe = async (id, title, content) => {
    try {
      const token = localStorage.getItem('token');
      await axios.patch(
        `${API_URL}/api/recipe/${id}`,
        { title, content },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      toast('✅ Recipe updated!');
    } catch (err) {
      console.error(err);
      toast('❌ Failed to update recipe');
    }
  };

  const deleteRecipe = async (id) => {
    const confirm = window.confirm('Delete this recipe?');
    if (!confirm) return;

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_URL}/api/recipe/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setRecipes((prev) => prev.filter((r) => r._id !== id));
    } catch (err) {
      console.error(err);
      toast('❌ Failed to delete recipe');
    }
  };

  const handleChange = (id, field, value) => {
    setRecipes((prev) =>
      prev.map((r) => (r._id === id ? { ...r, [field]: value } : r))
    );
  };

  const toggleLanguage = (id) => {
    setLanguage((prev) => ({
      ...prev,
      [id]: prev[id] === 'hi' ? 'en' : 'hi',
    }));
  };

  const getLanguageContent = (recipe, lang) => {
    const parts = recipe.content.split(/[*]{2}Hindi Translation[:：]?[*]{2}/i);
    return lang === 'hi'
      ? parts[1]?.trim() || '❌ Hindi version not available.'
      : parts[0]?.trim();
  };

  const extractTitle = (content, lang) => {
    const parts = content.split(/[*]{2}Hindi Translation[:：]?[*]{2}/i);
    const text = lang === 'hi' ? parts[1] : parts[0];
    if (!text) return 'Untitled Recipe';
    // Split into lines, ignore empty and translation header lines
    const lines = text.split('\n').map(line => line.trim()).filter(line =>
      line && !line.toLowerCase().includes('translation')
    );
    console.log('extractTitle lines:', lines); // DEBUG
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

  const extractNutrition = (content) => {
    const nutritionBlock = content.match(/\*\*Approximate Nutritional Value\*\*([^*]+)/);
    if (!nutritionBlock) return [];

    const nutritionLines = nutritionBlock[1]
      .split('\n')
      .filter(line => line.trim().startsWith('*'))
      .map(line => {
        const [label, value] = line.replace('*', '').split(':').map(s => s.trim());
        return { label, value };
      })
      .filter(item => item.label && item.value);

    return nutritionLines;
  };

  const handleStartCooking = async (recipe, selectedLang) => {
    try {
      const token = localStorage.getItem('token');
      
      // Check if recipe exists in cooking history
      const existingRecipe = cookingHistory.find(h => h.title === recipe.title);
      if (existingRecipe) {
        const continueCooking = window.confirm('This recipe is already in your cooking history. Would you like to continue cooking from where you left off?');
        if (continueCooking) {
          // Get the last step from localStorage
          const recipeKey = recipe.title.replace(/\s+/g, '_');
          const progress = localStorage.getItem(`cookingProgress_${recipeKey}`);
          const lastStep = progress ? JSON.parse(progress).currentStep : 0;
          
          // Navigate to cooking page with existing progress
          navigate('/cook', {
            state: {
              recipe: { title: recipe.title, content: recipe.content },
              lang: selectedLang,
              currentStep: lastStep
            }
          });
          return;
        }
      }

      // If not in history or user wants to start fresh, proceed with normal flow
      await axios.post(
        `${API_URL}/api/recipe/cooked`,
        {
          title: recipe.title,
          content: recipe.content,
          language: selectedLang
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Set up localStorage progress for this recipe
      const recipeKey = recipe.title.replace(/\s+/g, '_');
      localStorage.setItem(
        `cookingProgress_${recipeKey}`,
        JSON.stringify({
          recipe: { title: recipe.title, content: recipe.content },
          currentStep: 0,
          lang: selectedLang,
          lastLeftAt: new Date().toISOString()
        })
      );
      localStorage.setItem('cookingProgress', JSON.stringify({
        recipe: { title: recipe.title, content: recipe.content },
        currentStep: 0,
        lang: selectedLang
      }));
      localStorage.setItem('cookingLang', selectedLang);
      
      // Navigate to cooking page
      navigate('/cook', {
        state: {
          recipe: { title: recipe.title, content: recipe.content },
          lang: selectedLang
        }
      });
    } catch (err) {
      console.error(err);
      toast('Please Login to start cooking');
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

  return (
    <SavedRecipesWrapper>
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
          <h1 className="page-title">📚 Saved Recipes</h1>
          
          {recipes.length === 0 ? (
            <div className="empty-state">
              <p className="empty-text">No saved recipes yet. Let's start cooking to save them!</p>
              <button
                onClick={() => navigate('/camera')}
                className="start-cooking-btn"
              >
                Start Cooking 🍳
              </button>
            </div>
          ) : (
            <div className="recipes-grid">
              {recipes.map((recipe) => {
                const lang = language[recipe._id] || 'en';
                const { ingredients, steps } = extractSections(recipe.content, lang);
                return (
                  <div key={recipe._id} className="recipe-card">
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
                    
                    {/* Nutritional Information */}
                    {extractNutrition(recipe.content).length > 0 && (
                      <div className="nutrition-section">
                        <h3 className="section-title">Nutritional Information:</h3>
                        <div className="nutrition-grid">
                          {extractNutrition(recipe.content).map((item, index) => (
                            <div key={index} className="nutrition-item">
                              <span className="nutrition-label">{item.label}:</span> {item.value}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
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
                      <button
                        onClick={() => handleStartCooking(recipe, lang)}
                        className="cook-btn"
                      >
                        Start Cooking
                      </button>
                      <button
                        onClick={() => deleteRecipe(recipe._id)}
                        className="delete-btn"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </SavedRecipesWrapper>
  );
};

export default SavedRecipesPage;

// Styled Components
const SavedRecipesWrapper = styled.div`
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

  .recipes-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
    gap: 24px;
  }

  .recipe-card {
    background: rgba(255,255,255,0.7);
    border-radius: 20px;
    padding: 24px;
    box-shadow: 0 4px 32px 0 rgba(0,0,0,0.08);
    transition: transform 0.3s ease, box-shadow 0.3s ease;
  }

  .recipe-card:hover {
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

  .nutrition-section {
    margin: 16px 0;
    padding: 16px;
    background: rgba(247, 250, 252, 0.8);
    border-radius: 12px;
  }

  .section-title {
    font-weight: 600;
    margin-bottom: 8px;
    color: #22543d;
    font-size: 1rem;
  }

  .nutrition-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 8px;
  }

  .nutrition-item {
    font-size: 0.875rem;
  }

  .nutrition-label {
    font-weight: 500;
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

  .delete-btn {
    padding: 10px 20px;
    background: #e53e3e;
    color: white;
    border: none;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    flex: 1;
    box-shadow: 0 2px 8px rgba(229, 62, 62, 0.3);
  }

  .delete-btn:hover {
    background: #c53030;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(229, 62, 62, 0.4);
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
    
    .recipes-grid {
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
    
    .recipes-grid {
      grid-template-columns: 1fr;
      gap: 16px;
    }
    
    .recipe-card {
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
    
    .nutrition-grid {
      grid-template-columns: 1fr;
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
    
    .recipe-card {
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
    
    .cook-btn,
    .delete-btn {
      padding: 8px 16px;
      font-size: 0.9rem;
    }
  }

  /* Landscape Mobile */
  @media (max-width: 768px) and (orientation: landscape) {
    .empty-state {
      padding: 32px 24px;
    }
    
    .recipes-grid {
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    }
  }
`;
