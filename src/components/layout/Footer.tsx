import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Facebook, Instagram, Youtube, Phone, Mail, MapPin, Heart, LogIn, ArrowUpRight, Sparkles } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useQuery } from '@tanstack/react-query';
import { fetchOrgContact, OrgContact } from '@/lib/contact';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import logo from '@/assets/logo/AUSDAV_llogo.png';

const Footer: React.FC = () => {
  const { t } = useLanguage();
  const location = useLocation();

  // Defensive check to hide footer while quiz UI is active (fallback if body class isn't applied)
  const hideFooter = (typeof window !== 'undefined') && (
    document.body.classList.contains('quiz-open') ||
    (location.pathname.startsWith('/quiz') && new URLSearchParams(location.search).has('school'))
  );

  const [footerMessage, setFooterMessage] = useState('');
  const { data: orgContact } = useQuery<OrgContact | null, Error>({
    queryKey: ['org_contact'],
    queryFn: fetchOrgContact,
    staleTime: 1000 * 60 * 5,
  });

  const quickLinks = [
    { href: '/', label: t('nav.home') },
    { href: '/about', label: t('nav.about') },
    { href: '/exam', label: t('nav.exam') },
    { href: '/resources', label: t('nav.resources') },
    { href: '/events', label: t('nav.events') },
    { href: '/committee', label: t('nav.committee') },
    { href: '/donate', label: t('nav.donate') },
  ];

  const socialLinks = [
    { icon: Facebook, href: 'https://www.facebook.com/ausdavmail/', label: 'Facebook' },
    // { icon: Instagram, href: '#', label: 'Instagram' },
    // { icon: Youtube, href: '#', label: 'YouTube' },
  ];

  return (
    <footer className={`${hideFooter ? 'hidden' : ''} relative bg-background overflow-hidden site-hidden-when-quiz`}>
      {/* Gradient background */}
      <div
        className="absolute inset-0 opacity-50"
        style={{ backgroundImage: 'var(--gradient-hero)' }}
      />
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
      
      <div className="container mx-auto px-4 py-16 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Logo & About */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="space-y-6"
          >
            <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-3 group">
              <div className="w-14 h-14 rounded-full flex items-center justify-center neon-glow">
                {/* <Sparkles className="w-7 h-7 text-primary-foreground" />
                 */}
                 <img src={logo} alt="AUSDAV" />
              </div>
                 </Link>
              <div>
                <h3 className="font-bold text-xl tracking-tight">AUSDAV</h3>
                <p className="text-xs text-muted-foreground">Est. 1993</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              All University Students' Development Association Vavuniya
            </p>
            <div className="flex gap-3">
              <Button asChild variant="donate" size="sm" className="flex-1">
                <Link to="/donate">
                  <Heart className="w-4 h-4 mr-1.5" />
                  {t('nav.donate')}
                </Link>
              </Button>
              {/* <Button asChild variant="outline" size="sm" className="flex-1 border-border/50 hover:border-primary/50">
                <Link to="/login">
                  <LogIn className="w-4 h-4 mr-1.5" />
                  Login
                </Link>
              </Button> */}
            </div>
          </motion.div>

          {/* Quick Links */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
          >
            <h4 className="font-bold text-lg mb-6">{t('footer.quickLinks')}</h4>
            <ul className="space-y-3">
              {quickLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    to={link.href}
                    className="group flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
                  >
                    <ArrowUpRight className="w-4 h-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                    <span className="group-hover:translate-x-1 transition-transform">{link.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Contact */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
          >
            <h4 className="font-bold text-lg mb-6">{t('footer.contact')}</h4>
            {/** Fetch contact settings from DB; fallback to static text if missing */}
            {(() => {
              const address = orgContact?.address ?? 'Vavuniya, Northern Province, Sri Lanka';
              const phoneStr = orgContact?.phone ?? '+94 XX XXX XXXX';
              const emailStr = orgContact?.email ?? 'info@ausdav.org';

              return (
                <ul className="space-y-4">
                  <li className="flex items-start gap-3 text-sm text-muted-foreground group">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                      <MapPin className="w-4 h-4 text-primary" />
                    </div>
                    <span className="pt-1">{address}</span>
                  </li>
                  <li className="flex items-center gap-3 text-sm text-muted-foreground group">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                      <Phone className="w-4 h-4 text-primary" />
                    </div>
                    <span>{phoneStr}</span>
                  </li>
                  <li className="flex items-center gap-3 text-sm text-muted-foreground group">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                      <Mail className="w-4 h-4 text-primary" />
                    </div>
                    <span>{emailStr}</span>
                  </li>
                </ul>
              );
            })()}
          </motion.div>

          {/* Social */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
          >
            <h4 className="font-bold text-lg mb-6">{t('footer.followUs')}</h4>
            <div className="flex gap-3">
              {socialLinks.map((social) => (
                <motion.a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  whileHover={{ scale: 1.1, y: -3 }}
                  className="w-11 h-11 rounded-xl glass-card flex items-center justify-center hover:border-primary/30 transition-colors"
                  aria-label={social.label}
                >
                  <social.icon className="w-5 h-5 text-muted-foreground hover:text-primary transition-colors" />
                </motion.a>
              ))}
              {/* WhatsApp */}
              {/* <motion.a
                href="#"
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ scale: 1.1, y: -3 }}
                className="w-11 h-11 rounded-xl glass-card flex items-center justify-center hover:border-primary/30 transition-colors"
                aria-label="WhatsApp"
              >
                <svg className="w-5 h-5 text-muted-foreground" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
              </motion.a> */}
            </div>
            
            {/* Feedback box */}
            <div className="mt-8 p-4 glass-card rounded-xl">
              <p className="text-xs text-muted-foreground mb-2">Send us feedback</p>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                }}
                className="space-y-2"
              >
                <div>
                  <textarea
                    id="footer-feedback"
                    name="message"
                    placeholder="Share a thoughts, suggestions or issues..."
                    className="w-full rounded-lg p-2 bg-muted/50 text-sm text-foreground"
                    rows={3}
                    value={footerMessage}
                    onChange={(e) => setFooterMessage(e.target.value)}
                  />
                </div>
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    className="h-9 px-4"
                    onClick={async () => {
                      const message = footerMessage.trim();
                      if (!message) {
                        toast({ title: 'Empty', description: 'Please enter feedback before sending' });
                        return;
                      }
                      try {
                        const resp = await fetch('/functions/v1/submit-feedback', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ message }),
                        });
                        if (resp.ok) {
                          toast({ title: 'Thanks', description: 'Feedback submitted' });
                          setFooterMessage('');
                          return;
                        }
                        if (resp.status === 429) {
                          toast({ title: 'Rate limited', description: 'Too many submissions, try later' });
                          return;
                        }
                        // fallback to direct insert
                        const { error } = await (supabase as any).from('feedback').insert([{ message, type: null, is_read: false }]);
                        if (error) throw error;
                        toast({ title: 'Thanks', description: 'Feedback submitted' });
                        setFooterMessage('');
                      } catch (err) {
                        console.error('Footer feedback failed', err);
                        toast({ title: 'Error', description: 'Could not submit feedback' });
                      }
                    }}
                  >
                    Send
                  </Button>
                </div>
              </form>
            </div>
          </motion.div>
        </div>

        {/* Copyright */}
        <motion.div 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="border-t border-border/20 mt-5 pt-5 text-center py-5 "
        >
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} AUSDAV. {t('footer.rights')}
          </p>
        </motion.div>
      </div>
    </footer>
  );
};

export default Footer;