import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Wrench, Clock, Mail, Phone } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { fetchOrgContact, OrgContact } from '@/lib/contact';

interface AppSettings {
  show_maintenance_countdown?: boolean | null;
  updated_at?: string | null;
}

const UnderConstructionPage: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [contact, setContact] = useState<OrgContact | null>(null);
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  }>({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  // Load settings and contact info
  useEffect(() => {
    let active = true;

    (async () => {
      try {
        // Load app settings
        const { data: settingsData, error: settingsError } = await supabase
          .from('app_settings')
          .select('show_maintenance_countdown, updated_at')
          .eq('id', 1)
          .maybeSingle();

        if (settingsError) throw settingsError;
        if (!active) return;
        setSettings(settingsData ?? {});

        // Load contact info
        const contactData = await fetchOrgContact();
        if (!active) return;
        setContact(contactData);
      } catch (err) {
        console.error('Failed to load settings or contact info', err);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  // Countdown timer logic
  useEffect(() => {
    if (!settings?.show_maintenance_countdown) return;

    const calculateCountdown = () => {
      // Example: Maintenance ends in 2 days (adjust as needed)
      const maintenanceEnd = new Date();
      maintenanceEnd.setDate(maintenanceEnd.getDate() + 2);

      const now = new Date().getTime();
      const distance = maintenanceEnd.getTime() - now;

      if (distance < 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }

      const days = Math.floor(distance / (1000 * 60 * 60 * 24));
      const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);

      setTimeLeft({ days, hours, minutes, seconds });
    };

    calculateCountdown();
    const timer = setInterval(calculateCountdown, 1000);

    return () => clearInterval(timer);
  }, [settings?.show_maintenance_countdown]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-white via-slate-50 to-slate-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-800">
      <div className="container px-4 mx-auto">
        <motion.div
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          className="max-w-3xl mx-auto"
        >
          <div className="bg-white dark:bg-slate-900/60 backdrop-blur-md border border-border/50 rounded-2xl shadow-lg p-10 text-center">
            <div className="flex items-center justify-center w-24 h-24 rounded-full bg-primary/10 dark:bg-primary/20 mx-auto mb-6">
              <Wrench className="w-12 h-12 text-primary" />
            </div>

            <h1 className="text-3xl sm:text-4xl font-extrabold mb-3">Site Under Construction</h1>
            <p className="text-muted-foreground mb-6">We're making some improvements — thanks for your patience!</p>

            {/* Countdown Timer */}
            {settings?.show_maintenance_countdown && (
              <div className="flex items-center justify-center gap-2 mb-6 p-4 bg-primary/5 rounded-lg">
                <Clock className="w-5 h-5 text-primary" />
                <div className="flex gap-4 text-center">
                  <div className="flex flex-col">
                    <span className="text-2xl font-bold text-primary">{String(timeLeft.days).padStart(2, '0')}</span>
                    <span className="text-xs text-muted-foreground">Days</span>
                  </div>
                  <span className="text-2xl font-bold text-muted-foreground">:</span>
                  <div className="flex flex-col">
                    <span className="text-2xl font-bold text-primary">{String(timeLeft.hours).padStart(2, '0')}</span>
                    <span className="text-xs text-muted-foreground">Hours</span>
                  </div>
                  <span className="text-2xl font-bold text-muted-foreground">:</span>
                  <div className="flex flex-col">
                    <span className="text-2xl font-bold text-primary">{String(timeLeft.minutes).padStart(2, '0')}</span>
                    <span className="text-xs text-muted-foreground">Minutes</span>
                  </div>
                  <span className="text-2xl font-bold text-muted-foreground">:</span>
                  <div className="flex flex-col">
                    <span className="text-2xl font-bold text-primary">{String(timeLeft.seconds).padStart(2, '0')}</span>
                    <span className="text-xs text-muted-foreground">Seconds</span>
                  </div>
                </div>
              </div>
            )}

            {/* Info Section */}
            <div className="flex items-center justify-center gap-3 mb-8">
              <div className="flex flex-col items-center text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">What to expect</span>
                <span>Improved UX, faster pages, new features</span>
              </div>
            </div>

            {/* Contact Section */}
            <div className="mb-8 p-4 bg-muted/30 rounded-lg">
              <div className="flex items-center justify-center gap-2 mb-3">
                <Mail className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold">Contact Us</span>
              </div>
              <div className="space-y-2">
                {contact?.email && (
                  <p className="text-sm text-muted-foreground">
                    Email:{' '}
                    <a href={`mailto:${contact.email}`} className="text-primary hover:underline font-semibold">
                      {contact.email}
                    </a>
                  </p>
                )}
                {contact?.phone && (
                  <p className="text-sm text-muted-foreground flex items-center justify-center gap-2">
                    <Phone className="w-4 h-4" />
                    Phone:{' '}
                    <a href={`tel:${contact.phone}`} className="text-primary hover:underline font-semibold">
                      {contact.phone}
                    </a>
                  </p>
                )}
                {!contact?.email && !contact?.phone && (
                  <p className="text-sm text-muted-foreground">
                    We'll be back soon. Thank you for your patience!
                  </p>
                )}
              </div>
            </div>

            <div className="mt-8 text-xs text-muted-foreground">Check back soon — follow our social links for updates.</div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default UnderConstructionPage;
