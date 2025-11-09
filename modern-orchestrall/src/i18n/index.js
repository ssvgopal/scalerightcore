// src/i18n/index.js - Minimal i18n dictionaries and helpers

const dictionaries = {
  en: {
    appTitle: 'Orchestrall AI - Professional Admin Dashboard',
    overview: 'Overview',
    dashboard: 'Dashboard',
    analytics: 'Analytics',
    reports: 'Reports',
    dataManagement: 'Data Management',
    system: 'System',
    plugins: 'Plugins',
    users: 'Users',
    settings: 'Settings',
    dashboardOverview: 'Dashboard Overview',
    connected: 'Connected',
    disconnected: 'Disconnected',
    refreshSuccess: 'Data refreshed successfully',
    refreshFailed: 'Failed to refresh data',
  },
  hi: {
    appTitle: 'ऑर्केस्ट्रल एआई - प्रोफेशनल एडमिन डैशबोर्ड',
    overview: 'ओवरव्यू',
    dashboard: 'डैशबोर्ड',
    analytics: 'एनालिटिक्स',
    reports: 'रिपोर्ट्स',
    dataManagement: 'डेटा प्रबंधन',
    system: 'सिस्टम',
    plugins: 'प्लगइन्स',
    users: 'उपयोगकर्ता',
    settings: 'सेटिंग्स',
    dashboardOverview: 'डैशबोर्ड अवलोकन',
    connected: 'कनेक्टेड',
    disconnected: 'डिसकनेक्टेड',
    refreshSuccess: 'डेटा सफलतापूर्वक रिफ्रेश हुआ',
    refreshFailed: 'डेटा रिफ्रेश विफल',
  },
  te: {
    appTitle: 'ఆర్కేస్ట్రాల్ AI - ప్రొఫెషనల్ అడ్మిన్ డ్యాష్‌బోర్డ్',
    overview: 'అవలోకనం',
    dashboard: 'డ్యాష్‌బోర్డ్',
    analytics: 'విశ్లేషణలు',
    reports: 'నివేదికలు',
    dataManagement: 'డేటా నిర్వహణ',
    system: 'సిస్టమ్',
    plugins: 'ప్లగిన్లు',
    users: 'వినియోగదారులు',
    settings: 'సెట్టింగ్‌లు',
    dashboardOverview: 'డ్యాష్‌బోర్డ్ అవలోకనం',
    connected: 'కనెక్ట్ అయింది',
    disconnected: 'కనెక్ట్ కాలేదు',
    refreshSuccess: 'డేటా విజయవంతంగా రిఫ్రెష్ అయింది',
    refreshFailed: 'డేటా రిఫ్రెష్ విఫలమైంది',
  },
  ta: {
    appTitle: 'Orchestrall AI - தொழில்முறை நிர்வாக டாஷ்போர்டு',
    overview: 'மேலோட்டம்',
    dashboard: 'டாஷ்போர்டு',
    analytics: 'பகுப்பாய்வு',
    reports: 'அறிக்கைகள்',
    dataManagement: 'தரவு மேலாண்மை',
    system: 'அமைப்பு',
    plugins: 'செருகுகள்',
    users: 'பயனர்கள்',
    settings: 'அமைப்புகள்',
    dashboardOverview: 'டாஷ்போர்டு மேலோட்டம்',
    connected: 'இணைக்கப்பட்டது',
    disconnected: 'இணைக்கப்படவில்லை',
    refreshSuccess: 'தரவு வெற்றிகரமாக புதுப்பிக்கப்பட்டது',
    refreshFailed: 'தரவு புதுப்பிப்பு தோல்வியுற்றது',
  },
};

function getLang(req) {
  const q = (req.query && (req.query.lang || req.query.locale)) || '';
  if (q && dictionaries[q]) return q;
  const al = (req.headers['accept-language'] || '').split(',')[0].trim().slice(0,2);
  return dictionaries[al] ? al : 'en';
}

function getDict(lang) {
  return dictionaries[lang] || dictionaries.en;
}

module.exports = { getLang, getDict };


