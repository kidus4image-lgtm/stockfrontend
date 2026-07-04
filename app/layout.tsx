import type { Metadata } from 'next';
import './globals.css';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Sidebar from '../components/Sidebar';
import TopNav from '../components/TopNav';
import ChatBotWrapper from '../components/ChatBotWrapper';
import GlobalSearchWrapper from '../components/GlobalSearchWrapper';
import PushManager from '../components/PushManager';
import ApiFetchInterceptor from '../components/ApiFetchInterceptor';
import SettingsProviderWrapper from '../components/SettingsProviderWrapper';

export const metadata: Metadata = {
  title: 'Nexlify',
  description: 'Premium retail inventory and cash flow dashboard.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#174f49" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body>
        <SettingsProviderWrapper>
          <ApiFetchInterceptor />
          <PushManager />
          <TopNav />
          <ToastContainer position="top-right" autoClose={3000} style={{ zIndex: 999999 }} />
          <div className="layout-container">
            <Sidebar />
            <main className="main-content">
              {children}
            </main>
          </div>
          <ChatBotWrapper />
          <GlobalSearchWrapper />
        </SettingsProviderWrapper>
      </body>
    </html>
  );
}
