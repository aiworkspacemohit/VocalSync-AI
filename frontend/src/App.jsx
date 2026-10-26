import React, { useState, useEffect } from 'react';
import BiometricStudio from './pages/BiometricStudio';
import VideoMeeting from './pages/VideoMeeting';

export default function App() {
  // Multipage routing state: 'studio' (existing Biometric Studio) or 'meet' (Google Meet video conference)
  const [currentPage, setCurrentPage] = useState(() => {
    const path = window.location.pathname.toLowerCase();
    const hash = window.location.hash.toLowerCase();
    if (path.includes('/meet') || hash.includes('meet')) {
      return 'meet';
    }
    return 'studio';
  });

  // Listen to browser back/forward history navigation
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname.toLowerCase();
      const hash = window.location.hash.toLowerCase();
      if (path.includes('/meet') || hash.includes('meet')) {
        setCurrentPage('meet');
      } else {
        setCurrentPage('studio');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateTo = (page) => {
    setCurrentPage(page);
    const targetUrl = page === 'meet' ? '/meet' : '/';
    window.history.pushState({}, '', targetUrl);
  };

  return (
    <div className="w-full h-full min-h-screen bg-slate-950">
      {currentPage === 'meet' ? (
        <VideoMeeting onNavigateToStudio={() => navigateTo('studio')} />
      ) : (
        <BiometricStudio onNavigateToMeet={() => navigateTo('meet')} />
      )}
    </div>
  );
}
