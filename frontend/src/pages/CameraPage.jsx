// src/pages/CameraPage.jsx
import React, { useState, useRef, useEffect, useContext } from 'react';
import ImageUploader from '../components/ImageUploader';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import DarkModeToggle from '../components/DarkModeToggle';
import { AuthContext } from "../context/AuthContext";
import LogoutButton from '../components/LogoutButton';
import SavedRecipesButton from '../components/SavedRecipesButton';
import HomeButton from '../components/HomeButton';
import { API_URL } from '../config';
import Particles from '../components/Particle';
import { toast } from 'react-toastify';
import styled from 'styled-components';

const CameraPage = () => {
  const { user } = useContext(AuthContext);
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good Morning' : hour < 18 ? 'Good Afternoon' : 'Good Evening';

  const [image, setImage] = useState(null);
  const [detections, setDetections] = useState([]);
  const imageRef = useRef();
  const [imgDims, setImgDims] = useState({ width: 640, height: 640 });
  const navigate = useNavigate();

  const handleImageChange = (file) => {
    const imageUrl = URL.createObjectURL(file);
    setImage(imageUrl);
    detectVegetables(file);
  };

  useEffect(() => {
    if (imageRef.current) {
      const { width, height } = imageRef.current.getBoundingClientRect();
      setImgDims({ width, height });
    }
  }, [image]);

  const detectVegetables = async (file) => {
    const formData = new FormData();
    formData.append('image', file);

    try {
      const res = await axios.post(`${API_URL}/api/detect`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setDetections(res.data.detected);
    } catch (err) {
      console.error('Detection error:', err);
      toast('Failed to detect vegetables.');
    }
  };

  const handleContinue = () => {
    navigate('/recipe', { state: { detectedVeggies: detections } });
  };

  return (
    <CameraWrapper>
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

        {/* Centered Content */}
        <div className="center-content">
          <h2 className="title">🥕 Detect Vegetables</h2>
          <ImageUploader onImageSelected={handleImageChange} />
          
          {image && (
            <div className="image-preview">
              <img
                ref={imageRef}
                src={image}
                alt="Uploaded"
                className="max-w-full rounded-lg border"
                onLoad={() => {
                  const { width, height } = imageRef.current.getBoundingClientRect();
                  setImgDims({ width, height });
                }}
              />
            </div>
          )}

          {detections.length > 0 && (
            <div className="detections">
              <h3 className="subtitle">Detected Vegetables:</h3>
              <ul>
                {detections.map((det, idx) => (
                  <li key={idx}>
                    ✅ {det.label} ({det.confidence}%)
                  </li>
                ))}
              </ul>
              <button
                className="next-btn"
                onClick={handleContinue}
              >
                Next: Generate Recipe
              </button>
            </div>
          )}
        </div>
      </div>
    </CameraWrapper>
  );
};

export default CameraPage;

// Styled Components
const CameraWrapper = styled.div`
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

  .center-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 120px 16px 24px 16px;
    max-width: 480px;
    margin: 0 auto;
    background: rgba(255,255,255,0.7);
    border-radius: 24px;
    box-shadow: 0 4px 32px 0 rgba(0,0,0,0.08);
    min-height: 60vh;
    width: 100%;
  }

  .title {
    font-size: clamp(1.25rem, 5vw, 1.5rem);
    font-weight: 600;
    margin-bottom: 24px;
    color: #2f855a;
    text-align: center;
  }

  .image-preview {
    margin: 24px 0 0 0;
    display: flex;
    justify-content: center;
    align-items: center;
    max-width: 100%;
  }

  .image-preview img {
    max-width: 100%;
    height: auto;
    border-radius: 12px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.1);
  }

  .detections {
    margin-top: 32px;
    width: 100%;
    text-align: center;
  }

  .subtitle {
    font-weight: 600;
    margin-bottom: 12px;
    color: #22543d;
    font-size: 1.1rem;
  }

  .detections ul {
    list-style: none;
    padding: 0;
    margin-bottom: 16px;
  }

  .detections li {
    margin-bottom: 8px;
    font-size: 1rem;
    color: #22543d;
    padding: 8px 12px;
    background: rgba(72, 187, 120, 0.1);
    border-radius: 8px;
    display: inline-block;
    margin: 4px;
  }

  .next-btn {
    padding: 12px 24px;
    background: #38a169;
    color: #fff;
    border: none;
    border-radius: 12px;
    font-weight: 600;
    font-size: 1rem;
    cursor: pointer;
    transition: all 0.3s ease;
    margin-top: 16px;
    box-shadow: 0 4px 12px rgba(56, 161, 105, 0.3);
  }

  .next-btn:hover {
    background: #2f855a;
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(56, 161, 105, 0.4);
  }

  /* Tablet Styles */
  @media (max-width: 1024px) {
    .header-content {
      padding: 14px 20px;
    }
    
    .header-left {
      gap: 20px;
    }
    
    .center-content {
      padding: 100px 12px 20px 12px;
      margin: 0 16px;
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
    
    .center-content {
      padding: 90px 12px 16px 12px;
      margin: 0 12px;
      border-radius: 16px;
      min-height: 50vh;
    }
    
    .title {
      font-size: 1.25rem;
      margin-bottom: 20px;
    }
    
    .detections li {
      font-size: 0.9rem;
      padding: 6px 10px;
    }
    
    .next-btn {
      padding: 10px 20px;
      font-size: 0.9rem;
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
    
    .center-content {
      padding: 80px 8px 12px 8px;
      margin: 0 8px;
      border-radius: 12px;
    }
    
    .title {
      font-size: 1.1rem;
      margin-bottom: 16px;
    }
    
    .detections li {
      font-size: 0.85rem;
      padding: 4px 8px;
      margin: 2px;
    }
    
    .next-btn {
      padding: 8px 16px;
      font-size: 0.85rem;
    }
  }

  /* Landscape Mobile */
  @media (max-width: 768px) and (orientation: landscape) {
    .center-content {
      min-height: 40vh;
      padding: 70px 8px 12px 8px;
    }
    
    .title {
      margin-bottom: 12px;
    }
  }
`;
