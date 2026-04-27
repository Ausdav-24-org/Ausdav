import { useEffect, useState } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';

interface AppSettings {
  show_under_construction_banner?: boolean | null;
  site_under_construction?: boolean | null;
}

export function MaintenanceBanner() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let active = true;
    let pollInterval: ReturnType<typeof setInterval>;

    const loadSettings = async () => {
      try {
        const { data, error } = await supabase
          .from('app_settings')
          .select('show_under_construction_banner, site_under_construction')
          .eq('id', 1)
          .maybeSingle();

        if (error) throw error;
        if (!active) return;
        setSettings(data ?? {});
      } catch (err) {
        console.error('Failed to load banner settings', err);
      }
    };

    loadSettings();

    // Poll every 5 seconds for changes
    pollInterval = setInterval(loadSettings, 5000);

    return () => {
      active = false;
      clearInterval(pollInterval);
    };
  }, []);

  useEffect(() => {
    // Show banner if both settings are enabled and not dismissed
    setShowBanner(
      !dismissed &&
      (settings?.show_under_construction_banner || settings?.site_under_construction) === true
    );
  }, [settings, dismissed]);

  if (!showBanner) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="fixed top-16 left-0 right-0 z-40 bg-gradient-to-r from-amber-500/90 to-orange-500/90 backdrop-blur-sm"
      >
        <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-white shrink-0" />
            <p className="text-sm font-semibold text-white">
              Site Under Maintenance - We'll be back online shortly
            </p>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="shrink-0 p-1 hover:bg-white/20 rounded transition-colors"
            aria-label="Dismiss banner"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
