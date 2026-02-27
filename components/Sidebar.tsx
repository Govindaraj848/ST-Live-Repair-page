
import * as React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, FileText, Database } from 'lucide-react';

export const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === '/' && location.pathname === '/') return true;
    if (path !== '/' && location.pathname.startsWith(path)) return true;
    return false;
  };

  return (
    <div className="fixed top-0 left-0 h-screen z-[100] flex bg-[#1a4b8c] text-white shadow-2xl transition-all duration-300 ease-in-out w-3 hover:w-64 group overflow-hidden border-r border-blue-900">
      
      {/* Collapsed State Visual Cue - A thin strip indicator */}
      <div className="absolute top-0 left-0 w-3 h-full bg-[#102a52] flex flex-col items-center justify-center group-hover:opacity-0 transition-opacity duration-200">
         <div className="w-0.5 h-12 bg-white/30 rounded-full mb-1"></div>
         <div className="w-0.5 h-12 bg-white/30 rounded-full mb-1"></div>
         <div className="w-0.5 h-12 bg-white/30 rounded-full"></div>
      </div>

      {/* Expanded Content */}
      <div className="w-64 flex flex-col h-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 delay-75 min-w-[16rem] bg-[#1a4b8c]">
        <div className="p-4 font-bold text-xl text-center border-b border-blue-800 bg-[#153e75] whitespace-nowrap flex items-center justify-center gap-2">
           Jewelry Manager
        </div>
        <div className="flex flex-col gap-2 p-2 mt-4">
          <button
            onClick={() => navigate('/')}
            className={`flex items-center px-6 py-4 rounded-lg transition-all duration-200 whitespace-nowrap ${
              isActive('/') 
                ? 'bg-blue-700 text-white shadow-lg' 
                : 'hover:bg-blue-800/50 text-blue-200 hover:text-white'
            }`}
            title="Home"
          >
            <Home className="w-6 h-6 mr-3 shrink-0" />
            <span className="font-medium text-lg">Home</span>
          </button>

          <button
            onClick={() => navigate('/report')}
            className={`flex items-center px-6 py-4 rounded-lg transition-all duration-200 whitespace-nowrap ${
              isActive('/report') 
                ? 'bg-blue-700 text-white shadow-lg' 
                : 'hover:bg-blue-800/50 text-blue-200 hover:text-white'
            }`}
            title="Report"
          >
            <FileText className="w-6 h-6 mr-3 shrink-0" />
            <span className="font-medium text-lg">Report</span>
          </button>

          <button
            onClick={() => navigate('/dataset')}
            className={`flex items-center px-6 py-4 rounded-lg transition-all duration-200 whitespace-nowrap ${
              isActive('/dataset') 
                ? 'bg-blue-700 text-white shadow-lg' 
                : 'hover:bg-blue-800/50 text-blue-200 hover:text-white'
            }`}
            title="Data Set"
          >
            <Database className="w-6 h-6 mr-3 shrink-0" />
            <span className="font-medium text-lg">Data Set</span>
          </button>
        </div>
        
        <div className="mt-auto p-4 text-center text-xs text-blue-300 opacity-60 whitespace-nowrap">
          v1.1
        </div>
      </div>
    </div>
  );
};
