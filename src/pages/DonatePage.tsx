import React from 'react';
import { motion } from 'framer-motion';
import { Heart, Building2, Phone, Mail, Copy, Check } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import BG1 from "@/assets/AboutUs/BG1.jpg";
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { fetchOrgContact, OrgContact } from '@/lib/contact';

const DonatePage: React.FC = () => {
  const { t, language } = useLanguage();
  const [copied, setCopied] = React.useState<string | null>(null);

  const { data: orgContact } = useQuery<OrgContact | null, Error>({
    queryKey: ['org_contact'],
    queryFn: fetchOrgContact,
    staleTime: 1000 * 60 * 5,
  });

  const bankDetails = {
    bankName: orgContact?.bank_name ?? 'Bank of Ceylon',
    accountName: orgContact?.account_name ?? 'AUSDAV',
    accountNumber: orgContact?.account_number ?? '12345678901234',
    branch: orgContact?.branch ?? 'Vavuniya Branch',
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopied(field);
    toast.success(language === 'en' ? 'Copied to clipboard!' : 'கிளிப்போர்டுக்கு நகலெடுக்கப்பட்டது!');
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      {/* Hero Section with Background Image */}
      <section
        className="relative min-h-screen bg-cover bg-center flex items-center justify-center"
        style={{
          backgroundImage: `linear-gradient(rgba(15, 23, 42, 0.6), rgba(15, 23, 42, 0.6)), url('${BG1}')`,
          backgroundAttachment: "fixed",
        }}
      >
        <div className="container mx-auto px-4">
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            className="relative w-full"
          >
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center max-w-3xl mx-auto"
            >
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-cyan-500/20 flex items-center justify-center">
              <Heart className="w-10 h-10 text-cyan-400" />
            </div>
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-6">
              {t('donate.title')}
            </h1>
            <p className="text-xl md:text-2xl text-slate-300 max-w-3xl mx-auto">
              {t('donate.subtitle')}
            </p>
          </motion.div>
        </motion.div>
        </div>
      </section>

      {/* Donation Info */}
      <section className="relative py-20 px-4 bg-slate-800/50">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-start">
            {/* Bank Details */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="rounded-2xl p-8 border border-cyan-500/40 bg-card backdrop-blur-sm shadow-2xl"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-full bg-cyan-500/20 flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-cyan-400" />
                </div>
                <h2 className="text-2xl font-serif font-bold text-foreground">
                  {t('donate.bank.title')}
                </h2>
              </div>

              <div className="space-y-4">
                {[
                  { label: language === 'en' ? 'Bank Name' : 'வங்கி பெயர்', value: bankDetails.bankName, key: 'bank' },
                  { label: language === 'en' ? 'Account Name' : 'கணக்கு பெயர்', value: bankDetails.accountName, key: 'name' },
                  { label: language === 'en' ? 'Account Number' : 'கணக்கு எண்', value: bankDetails.accountNumber, key: 'number' },
                  { label: language === 'en' ? 'Branch' : 'கிளை', value: bankDetails.branch, key: 'branch' },
                ].map((item) => (
                  <div key={item.key} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div>
                      <p className="text-sm text-muted-foreground">{item.label}</p>
                      <p className="font-medium text-foreground">{item.value}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => copyToClipboard(String(item.value ?? ''), item.key)}
                      className="flex-shrink-0"
                    >
                      {copied === item.key ? (
                        <Check className="w-4 h-4 text-cyan-400" />
                      ) : (
                        <Copy className="w-4 h-4 text-cyan-400" />
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Contact */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="space-y-6"
            >
              <div className="rounded-2xl p-8 border border-cyan-500/40 bg-card backdrop-blur-sm shadow-2xl">
                <h2 className="text-2xl font-bold mb-6 text-white">
                  {t('donate.contact.title')}
                </h2>

                <div className="space-y-4">
                  <a
                    href={`tel:${orgContact?.phone ?? '+94XXXXXXXX'}`}
                    className="flex items-center gap-3 p-4 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center">
                      <Phone className="w-5 h-5 text-cyan-400" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {language === 'en' ? 'Call us' : 'எங்களை அழைக்கவும்'}
                      </p>
                      <p className="font-medium text-foreground">{orgContact?.phone ?? '+94 XX XXX XXXX'}</p>
                    </div>
                  </a>

                  <a
                    href={`mailto:${orgContact?.email ?? 'donate@ausdav.org'}`}
                    className="flex items-center gap-3 p-4 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center">
                      <Mail className="w-5 h-5 text-cyan-400" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {language === 'en' ? 'Email us' : 'மின்னஞ்சல் அனுப்பவும்'}
                      </p>
                      <p className="font-medium text-foreground">{orgContact?.email ?? 'donate@ausdav.org'}</p>
                    </div>
                  </a>
                </div>
              </div>
              
            </motion.div>
          </div>

          {/* Thank You Message */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mt-12 max-w-2xl mx-auto"
          >
            <p className="text-slate-300 text-lg">
              {language === 'en'
                ? 'Your generous contribution helps us provide educational resources, conduct seminars, and support students in need. Every donation makes a difference.'
                : 'உங்கள் தாராள பங்களிப்பு கல்வி வளங்களை வழங்கவும், கருத்தரங்குகளை நடத்தவும், தேவைப்படும் மாணவர்களுக்கு ஆதரவளிக்கவும் உதவுகிறது. ஒவ்வொரு நன்கொடையும் ஒரு மாற்றத்தை ஏற்படுத்துகிறது.'}
            </p>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default DonatePage;
