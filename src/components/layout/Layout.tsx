import React from 'react';
import Navbar from './Navbar';
import Footer from './Footer';
import MobileNavWidget from '@/components/MobileNavWidget';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      {/* non-static container required by framer-motion for correct viewport/scroll offsets */}
      <main className="relative flex-1 pb-24 lg:pb-0">{children}</main>
      <div className="site-hidden-when-quiz"><MobileNavWidget /></div>
      <Footer />
    </div>
  );
};

export default Layout;
