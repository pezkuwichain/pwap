import React from 'react';
import { Link, NavLink } from 'react-router-dom';

const PezkuwiChainLogo: React.FC = () => {
  return (
    <img src="/PezkuwiChain_Logo_Horizontal_Green_White.png" alt="PezkuwiChain Logo" className="h-8" />
  );
};

const Header: React.FC = () => {
  const linkStyle = "text-white hover:text-green-400 transition-colors";
  const activeLinkStyle = { color: '#34D399' }; // green-400

  return (
    <header className="bg-gray-900 text-white p-4 fixed top-0 left-0 right-0 z-[1000]">
      <div className="container mx-auto flex justify-between items-center">
        <Link to="/">
          <PezkuwiChainLogo />
        </Link>
        <nav>
          <ul className="flex space-x-4">
            <li><NavLink to="/explorer" className={linkStyle} style={({ isActive }) => isActive ? activeLinkStyle : undefined}>Explorer</NavLink></li>
            <li><NavLink to="/docs" className={linkStyle} style={({ isActive }) => isActive ? activeLinkStyle : undefined}>Docs</NavLink></li>
            <li><NavLink to="/wallet" className={linkStyle} style={({ isActive }) => isActive ? activeLinkStyle : undefined}>Wallet</NavLink></li>
            <li><NavLink to="/api" className={linkStyle} style={({ isActive }) => isActive ? activeLinkStyle : undefined}>API</NavLink></li>
            <li><NavLink to="/faucet" className={linkStyle} style={({ isActive }) => isActive ? activeLinkStyle : undefined}>Faucet</NavLink></li>
            <li><NavLink to="/developers" className={linkStyle} style={({ isActive }) => isActive ? activeLinkStyle : undefined}>Developers</NavLink></li>
            <li><NavLink to="/grants" className={linkStyle} style={({ isActive }) => isActive ? activeLinkStyle : undefined}>Grants</NavLink></li>
            <li><NavLink to="/wiki" className={linkStyle} style={({ isActive }) => isActive ? activeLinkStyle : undefined}>Wiki</NavLink></li>
            <li><NavLink to="/forum" className={linkStyle} style={({ isActive }) => isActive ? activeLinkStyle : undefined}>Forum</NavLink></li>
            <li><NavLink to="/telemetry" className={linkStyle} style={({ isActive }) => isActive ? activeLinkStyle : undefined}>Telemetry</NavLink></li>
          </ul>
        </nav>
      </div>
    </header>
  );
};

const Footer: React.FC = () => {
  return (
    <footer className="bg-gray-900 text-white p-4">
      <div className="container mx-auto text-center">
        <p>&copy; {new Date().getFullYear()} PezkuwiChain. All rights reserved.</p>
      </div>
    </footer>
  );
};

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <div className="flex-grow overflow-auto pt-16"> {/* Add padding-top equal to header height */}
        <main className="container mx-auto p-4">
          {children}
        </main>
      </div>
      <Footer />
    </div>
  );
};

export default Layout;
