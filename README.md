An AI-powered for intelligent vegetable detection and personalized recipe generation.
FoodLens combines computer vision and generative AI to help users discover healthy, sustainable recipes from ingredients they already have with multilingual support, nutrition information, and cooking assistance.

Features:
  Vegetable detection with YOLOv8m (87% mAP@0.5 on 15,000-image dataset)
  Detect multiple vegetables in a single image (camera or file upload)
  Personalized recipe generation using Google Gemini 1.5 Flash
  Multilingual output (English / Hindi)
  User preferences for serving size, cuisine, diet, allergies, time, health goals, spice level
  Nutritional labels and approximate macros per serving
  Adaptive cooking mode with:
    Contextual chatbot support while cooking
    Save and edit favorite recipes
    Cook history tracking
    Secure authentication (Google OAuth2.0)
    JWT-based user sessions
    Responsive (React + Vite)
    Scalable multi-region deployment on Google Cloud (US + India) with auto-failover
    MongoDB Atlas for persistent data

Tech Stack:
  Frontend: React (Vite), Tailwind CSS
  Backend: Node.js, Express.js
  Computer Vision: YOLOv8m (ONNX runtime on server side)
  Generative AI: Gemini 1.5 Flash via Google Generative AI SDK
  Database: MongoDB Atlas
  Authentication: Firebase (Google Login), JWT, bcrypt
  
Hosting:
  Backend on Google App Engine (multi-region with fallback)
  Frontend on Firebase Hosting
