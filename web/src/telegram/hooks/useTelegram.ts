import { useEffect, useState, useCallback } from 'react';
import WebApp from '@twa-dev/sdk';

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  photo_url?: string;
}

export interface TelegramTheme {
  bg_color: string;
  text_color: string;
  hint_color: string;
  link_color: string;
  button_color: string;
  button_text_color: string;
  secondary_bg_color: string;
}

interface UseTelegramReturn {
  // State
  isReady: boolean;
  isTelegram: boolean;
  user: TelegramUser | null;
  startParam: string | null;
  theme: TelegramTheme | null;
  colorScheme: 'light' | 'dark';
  viewportHeight: number;
  viewportStableHeight: number;
  isExpanded: boolean;

  // Actions
  ready: () => void;
  expand: () => void;
  close: () => void;
  showAlert: (message: string) => void;
  showConfirm: (message: string) => Promise<boolean>;
  showPopup: (params: { title?: string; message: string; buttons?: Array<{ id: string; type?: string; text: string }> }) => Promise<string>;
  openLink: (url: string, options?: { try_instant_view?: boolean }) => void;
  openTelegramLink: (url: string) => void;
  sendData: (data: string) => void;
  enableClosingConfirmation: () => void;
  disableClosingConfirmation: () => void;
  setHeaderColor: (color: string) => void;
  setBackgroundColor: (color: string) => void;

  // Main Button
  showMainButton: (text: string, onClick: () => void) => void;
  hideMainButton: () => void;
  setMainButtonLoading: (loading: boolean) => void;

  // Back Button
  showBackButton: (onClick: () => void) => void;
  hideBackButton: () => void;

  // Haptic Feedback
  hapticImpact: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
  hapticNotification: (type: 'error' | 'success' | 'warning') => void;
  hapticSelection: () => void;
}

export function useTelegram(): UseTelegramReturn {
  const [isReady, setIsReady] = useState(false);
  const [isTelegram, setIsTelegram] = useState(false);
  const [user, setUser] = useState<TelegramUser | null>(null);
  const [startParam, setStartParam] = useState<string | null>(null);
  const [theme, setTheme] = useState<TelegramTheme | null>(null);
  const [colorScheme, setColorScheme] = useState<'light' | 'dark'>('dark');
  const [viewportHeight, setViewportHeight] = useState(window.innerHeight);
  const [viewportStableHeight, setViewportStableHeight] = useState(window.innerHeight);
  const [isExpanded, setIsExpanded] = useState(false);

  // Initialize Telegram WebApp
  useEffect(() => {
    try {
      // Check if running in Telegram WebApp environment
      const tg = WebApp;

      if (tg && tg.initData) {
        setIsTelegram(true);

        // Get user info
        if (tg.initDataUnsafe?.user) {
          setUser(tg.initDataUnsafe.user as TelegramUser);
        }

        // Get start parameter (referral code, etc.)
        if (tg.initDataUnsafe?.start_param) {
          setStartParam(tg.initDataUnsafe.start_param);
        }

        // Get theme
        if (tg.themeParams) {
          setTheme(tg.themeParams as TelegramTheme);
        }

        // Get color scheme
        setColorScheme(tg.colorScheme as 'light' | 'dark' || 'dark');

        // Get viewport
        setViewportHeight(tg.viewportHeight || window.innerHeight);
        setViewportStableHeight(tg.viewportStableHeight || window.innerHeight);
        setIsExpanded(tg.isExpanded || false);

        // Listen for viewport changes
        tg.onEvent('viewportChanged', (event: { isStateStable: boolean }) => {
          setViewportHeight(tg.viewportHeight);
          if (event.isStateStable) {
            setViewportStableHeight(tg.viewportStableHeight);
          }
        });

        // Listen for theme changes
        tg.onEvent('themeChanged', () => {
          setTheme(tg.themeParams as TelegramTheme);
          setColorScheme(tg.colorScheme as 'light' | 'dark' || 'dark');
        });

        // Signal that app is ready
        tg.ready();
        setIsReady(true);

        // Expand by default for better UX
        tg.expand();

        if (import.meta.env.DEV) {
          console.log('[Telegram] Mini App initialized');
          console.log('[Telegram] User:', tg.initDataUnsafe?.user);
          console.log('[Telegram] Start param:', tg.initDataUnsafe?.start_param);
        }
      } else {
        // Not running in Telegram, but still mark as ready
        setIsReady(true);
        if (import.meta.env.DEV) {
          console.log('[Telegram] Not running in Telegram WebApp environment');
        }
      }
    } catch (err) {
      console.error('[Telegram] Initialization error:', err);
      setIsReady(true); // Mark as ready even on error for graceful fallback
    }
  }, []);

  // Actions
  const ready = useCallback(() => {
    if (isTelegram) WebApp.ready();
  }, [isTelegram]);

  const expand = useCallback(() => {
    if (isTelegram) {
      WebApp.expand();
      setIsExpanded(true);
    }
  }, [isTelegram]);

  const close = useCallback(() => {
    if (isTelegram) WebApp.close();
  }, [isTelegram]);

  const showAlert = useCallback((message: string) => {
    if (isTelegram) {
      WebApp.showAlert(message);
    } else {
      alert(message);
    }
  }, [isTelegram]);

  const showConfirm = useCallback((message: string): Promise<boolean> => {
    return new Promise((resolve) => {
      if (isTelegram) {
        WebApp.showConfirm(message, (confirmed) => {
          resolve(confirmed);
        });
      } else {
        resolve(confirm(message));
      }
    });
  }, [isTelegram]);

  const showPopup = useCallback((params: { title?: string; message: string; buttons?: Array<{ id: string; type?: string; text: string }> }): Promise<string> => {
    return new Promise((resolve) => {
      if (isTelegram) {
        WebApp.showPopup(params, (buttonId) => {
          resolve(buttonId || '');
        });
      } else {
        // Fallback for non-Telegram environment
        const result = confirm(params.message);
        resolve(result ? 'ok' : 'cancel');
      }
    });
  }, [isTelegram]);

  const openLink = useCallback((url: string, options?: { try_instant_view?: boolean }) => {
    if (isTelegram) {
      WebApp.openLink(url, options);
    } else {
      window.open(url, '_blank');
    }
  }, [isTelegram]);

  const openTelegramLink = useCallback((url: string) => {
    if (isTelegram) {
      WebApp.openTelegramLink(url);
    } else {
      window.open(url, '_blank');
    }
  }, [isTelegram]);

  const sendData = useCallback((data: string) => {
    if (isTelegram) WebApp.sendData(data);
  }, [isTelegram]);

  const enableClosingConfirmation = useCallback(() => {
    if (isTelegram) WebApp.enableClosingConfirmation();
  }, [isTelegram]);

  const disableClosingConfirmation = useCallback(() => {
    if (isTelegram) WebApp.disableClosingConfirmation();
  }, [isTelegram]);

  const setHeaderColor = useCallback((color: string) => {
    if (isTelegram) WebApp.setHeaderColor(color as `#${string}`);
  }, [isTelegram]);

  const setBackgroundColor = useCallback((color: string) => {
    if (isTelegram) WebApp.setBackgroundColor(color as `#${string}`);
  }, [isTelegram]);

  // Main Button
  const showMainButton = useCallback((text: string, onClick: () => void) => {
    if (isTelegram) {
      WebApp.MainButton.setText(text);
      WebApp.MainButton.onClick(onClick);
      WebApp.MainButton.show();
    }
  }, [isTelegram]);

  const hideMainButton = useCallback(() => {
    if (isTelegram) WebApp.MainButton.hide();
  }, [isTelegram]);

  const setMainButtonLoading = useCallback((loading: boolean) => {
    if (isTelegram) {
      if (loading) {
        WebApp.MainButton.showProgress();
      } else {
        WebApp.MainButton.hideProgress();
      }
    }
  }, [isTelegram]);

  // Back Button
  const showBackButton = useCallback((onClick: () => void) => {
    if (isTelegram) {
      WebApp.BackButton.onClick(onClick);
      WebApp.BackButton.show();
    }
  }, [isTelegram]);

  const hideBackButton = useCallback(() => {
    if (isTelegram) WebApp.BackButton.hide();
  }, [isTelegram]);

  // Haptic Feedback
  const hapticImpact = useCallback((style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => {
    if (isTelegram) WebApp.HapticFeedback.impactOccurred(style);
  }, [isTelegram]);

  const hapticNotification = useCallback((type: 'error' | 'success' | 'warning') => {
    if (isTelegram) WebApp.HapticFeedback.notificationOccurred(type);
  }, [isTelegram]);

  const hapticSelection = useCallback(() => {
    if (isTelegram) WebApp.HapticFeedback.selectionChanged();
  }, [isTelegram]);

  return {
    isReady,
    isTelegram,
    user,
    startParam,
    theme,
    colorScheme,
    viewportHeight,
    viewportStableHeight,
    isExpanded,
    ready,
    expand,
    close,
    showAlert,
    showConfirm,
    showPopup,
    openLink,
    openTelegramLink,
    sendData,
    enableClosingConfirmation,
    disableClosingConfirmation,
    setHeaderColor,
    setBackgroundColor,
    showMainButton,
    hideMainButton,
    setMainButtonLoading,
    showBackButton,
    hideBackButton,
    hapticImpact,
    hapticNotification,
    hapticSelection,
  };
}
