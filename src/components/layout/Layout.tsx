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
      <main className="flex-1 pb-24 lg:pb-0">{children}</main>
      <MobileNavWidget />
      <Footer />
    </div>
  );
};

export default Layout;
