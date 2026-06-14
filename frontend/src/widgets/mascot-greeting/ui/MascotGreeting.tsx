import React from "react";

export function MascotGreeting() {
  return (
    <div className="bento-card col-8 hero-greeting">
      <div className="hero-text-content">
        <h1 className="hero-title">Привет, Администратор! 🐻</h1>
        <p className="hero-description">
          Добро пожаловать в панель управления платформы «Сириус 27». Все службы запущены и готовы к обработке персональных данных в безопасном контуре.
        </p>
      </div>
      <div className="hero-mascot-container">
        <svg
          viewBox="0 0 100 100"
          className="mascot-svg"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Background circle - Teal */}
          <circle cx="50" cy="50" r="45" fill="#1CA0C4" stroke="#8DC63F" strokeWidth="3" />
          
          {/* Bear Ears */}
          <circle cx="35" cy="40" r="10" fill="#8B5A2B" />
          <circle cx="35" cy="40" r="6" fill="#F4A460" />
          <circle cx="65" cy="40" r="10" fill="#8B5A2B" />
          <circle cx="65" cy="40" r="6" fill="#F4A460" />
          
          {/* Bear Head */}
          <circle cx="50" cy="53" r="23" fill="#A0522D" />
          
          {/* Bear Face details */}
          {/* Muzzle */}
          <ellipse cx="50" cy="60" rx="11" ry="8" fill="#F4A460" />
          
          {/* Eyes */}
          <circle cx="43" cy="50" r="2.5" fill="#1E293B" />
          <circle cx="57" cy="50" r="2.5" fill="#1E293B" />
          {/* Eye highlights */}
          <circle cx="44" cy="49" r="0.8" fill="#FFFFFF" />
          <circle cx="58" cy="49" r="0.8" fill="#FFFFFF" />
          
          {/* Nose */}
          <polygon points="47,56 53,56 50,60" fill="#1E293B" />
          
          {/* Smile */}
          <path
            d="M 46 62 Q 50 66 54 62"
            stroke="#1E293B"
            strokeWidth="1.5"
            fill="none"
            strokeLinecap="round"
          />
          
          {/* Rosy Cheeks */}
          <circle cx="35" cy="56" r="3" fill="#FA8072" opacity="0.6" />
          <circle cx="65" cy="56" r="3" fill="#FA8072" opacity="0.6" />
        </svg>
      </div>
    </div>
  );
}
