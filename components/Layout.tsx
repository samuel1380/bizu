import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BookOpen, GraduationCap, LayoutDashboard, MessageSquareText, Menu, X, Zap, Calendar, Sun, Moon } from 'lucide-react';
import { useTheme } from '../services/ThemeContext';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();

  const navItems = [
    { name: 'HOME', path: '/', icon: <LayoutDashboard size={20} strokeWidth={2.5} /> },
    { name: 'MATERIAIS', path: '/materials', icon: <BookOpen size={20} strokeWidth={2.5} /> },
    { name: 'ROTINA', path: '/schedule', icon: <Calendar size={20} strokeWidth={2.5} /> },
    { name: 'TREINAR', path: '/quiz', icon: <Zap size={20} strokeWidth={2.5} /> },
    { name: 'MENTOR', path: '/mentor', icon: <MessageSquareText size={20} strokeWidth={2.5} /> },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col font-sans text-slate-700 dark:text-slate-300 transition-colors duration-300">
      {/* Chunky Navbar */}
      <nav className="sticky top-0 z-50 bg-white dark:bg-slate-900 border-b-2 border-slate-200 dark:border-slate-800 transition-colors duration-300">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 group">
              <div className="text-blue-600 transform group-hover:scale-110 transition-transform duration-200">
                <GraduationCap size={32} strokeWidth={3} />
              </div>
              <span className="font-extrabold text-2xl tracking-tighter text-blue-600 dark:text-blue-400">
                bizu
              </span>
            </Link>
            
            {/* Desktop Menu */}
            <div className="hidden md:flex items-center space-x-6">
              {navItems.map((item) => (
                <Link
                  key={item.name}
                  to={item.path}
                  className={`flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-extrabold tracking-widest uppercase transition-all duration-200 ${
                    isActive(item.path)
                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-2 border-blue-200 dark:border-blue-800'
                      : 'text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-500 dark:hover:text-slate-400 border-2 border-transparent'
                  }`}
                >
                  {item.icon}
                  {item.name}
                </Link>
              ))}

              {/* Theme Toggle Button */}
              <button
                onClick={toggleTheme}
                className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-2 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all duration-200"
                aria-label="Toggle Theme"
              >
                {theme === 'light' ? <Moon size={20} strokeWidth={2.5} /> : <Sun size={20} strokeWidth={2.5} />}
              </button>
            </div>

            {/* Mobile menu button */}
            <div className="flex md:hidden items-center gap-4">
              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-2 border-slate-200 dark:border-slate-700"
              >
                {theme === 'light' ? <Moon size={20} strokeWidth={2.5} /> : <Sun size={20} strokeWidth={2.5} />}
              </button>
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              >
                {isMobileMenuOpen ? <X size={28} strokeWidth={2.5} /> : <Menu size={28} strokeWidth={2.5} />}
              </button>
            </div>
          </div>
        </div>
        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden bg-white dark:bg-slate-900 border-b-2 border-slate-200 dark:border-slate-800 absolute w-full shadow-xl z-50 transition-colors duration-300">
            <div className="px-4 py-4 space-y-2">
              {navItems.map((item) => (
                <Link
                  key={item.name}
                  to={item.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-4 rounded-2xl text-sm font-bold tracking-wider uppercase transition-all ${
                    isActive(item.path)
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-2 border-blue-200 dark:border-blue-800'
                      : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {item.icon}
                  {item.name}
                </Link>
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* Main Content */}
      <main className="flex-grow max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-500">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-white dark:bg-slate-900 border-t-2 border-slate-200 dark:border-slate-800 py-8 mt-auto transition-colors duration-300">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <p className="text-slate-400 dark:text-slate-500 font-bold text-sm">
            © 2025 BIZU APP • FEITO COM ❤️ PARA CONCURSEIROS
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Layout;