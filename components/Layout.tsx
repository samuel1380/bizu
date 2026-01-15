import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BookOpen, GraduationCap, LayoutDashboard, MessageSquareText, Menu, X, Zap, Calendar } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();

  const navItems = [
    { name: 'HOME', path: '/', icon: <LayoutDashboard size={20} strokeWidth={2.5} /> },
    { name: 'MATERIAIS', path: '/materials', icon: <BookOpen size={20} strokeWidth={2.5} /> },
    { name: 'ROTINA', path: '/schedule', icon: <Calendar size={20} strokeWidth={2.5} /> },
    { name: 'TREINAR', path: '/quiz', icon: <Zap size={20} strokeWidth={2.5} /> },
    { name: 'MENTOR', path: '/mentor', icon: <MessageSquareText size={20} strokeWidth={2.5} /> },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-700">
      {/* Chunky Navbar */}
      <nav className="sticky top-0 z-50 bg-white border-b-2 border-slate-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 group">
              <div className="text-blue-600 transform group-hover:scale-110 transition-transform duration-200">
                <GraduationCap size={32} strokeWidth={3} />
              </div>
              <span className="font-extrabold text-2xl tracking-tighter text-blue-600">
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
                      ? 'bg-blue-50 text-blue-600 border-2 border-blue-200'
                      : 'text-slate-400 hover:bg-slate-100 hover:text-slate-500 border-2 border-transparent'
                  }`}
                >
                  {item.icon}
                  {item.name}
                </Link>
              ))}
            </div>

            {/* Mobile menu button */}
            <div className="flex md:hidden">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                {isMobileMenuOpen ? <X size={28} strokeWidth={2.5} /> : <Menu size={28} strokeWidth={2.5} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden bg-white border-b-2 border-slate-200 absolute w-full shadow-xl z-50">
            <div className="px-4 py-4 space-y-2">
              {navItems.map((item) => (
                <Link
                  key={item.name}
                  to={item.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-4 rounded-2xl text-sm font-bold tracking-wider uppercase transition-all ${
                    isActive(item.path)
                      ? 'bg-blue-100 text-blue-600 border-2 border-blue-200'
                      : 'text-slate-500 hover:bg-slate-100'
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
      <footer className="bg-white border-t-2 border-slate-200 py-8 mt-auto">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <div className="flex justify-center items-center gap-2 mb-4 opacity-40">
             <GraduationCap size={24} />
             <span className="font-black text-xl tracking-tighter">bizu</span>
          </div>
          <p className="text-slate-400 text-xs font-bold tracking-widest uppercase">
            Aprenda do seu jeito. Grátis para sempre.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Layout;