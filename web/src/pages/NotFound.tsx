import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useTranslation } from 'react-i18next';

const NotFound = () => {
  const { t } = useTranslation();
  const location = useLocation();

  useEffect(() => {
    if (import.meta.env.DEV) console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center p-8 rounded-lg border border-border bg-card shadow-md animate-slide-in">
        <h1 className="text-5xl font-bold mb-6 text-primary">{t('notFound.code')}</h1>
        <p className="text-xl text-card-foreground mb-6">{t('notFound.message')}</p>
        <a href="/" className="text-primary hover:text-primary/80 underline transition-colors">
          {t('notFound.backToHome')}
        </a>
      </div>
    </div>
  );
};

export default NotFound;
