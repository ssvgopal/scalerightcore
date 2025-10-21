const { PrismaClient } = require('@prisma/client');

class InternationalizationService {
  constructor(prisma) {
    this.prisma = prisma;
    this.isInitialized = false;
    this.supportedLanguages = ['en', 'hi', 'te', 'ta'];
    this.defaultLanguage = 'en';
    this.translations = new Map();
    this.regionalSettings = new Map();
  }

  async initialize() {
    if (this.isInitialized) return;

    try {
      // Load translations
      await this.loadTranslations();
      
      // Load regional settings
      await this.loadRegionalSettings();
      
      // Initialize language detection
      await this.initializeLanguageDetection();
      
      this.isInitialized = true;
      console.log('✅ Internationalization Service initialized');
    } catch (error) {
      console.error('Failed to initialize Internationalization Service:', error);
      throw error;
    }
  }

  async loadTranslations() {
    // Core translations
    const coreTranslations = {
      en: {
        // Common
        'common.save': 'Save',
        'common.cancel': 'Cancel',
        'common.delete': 'Delete',
        'common.edit': 'Edit',
        'common.add': 'Add',
        'common.search': 'Search',
        'common.loading': 'Loading...',
        'common.error': 'Error',
        'common.success': 'Success',
        'common.warning': 'Warning',
        'common.info': 'Information',
        
        // Navigation
        'nav.dashboard': 'Dashboard',
        'nav.farmers': 'Farmers',
        'nav.crops': 'Crops',
        'nav.analytics': 'Analytics',
        'nav.settings': 'Settings',
        'nav.profile': 'Profile',
        'nav.logout': 'Logout',
        
        // Agricultural terms
        'agriculture.farmer': 'Farmer',
        'agriculture.crop': 'Crop',
        'agriculture.planting': 'Planting',
        'agriculture.harvest': 'Harvest',
        'agriculture.irrigation': 'Irrigation',
        'agriculture.fertilizer': 'Fertilizer',
        'agriculture.pesticide': 'Pesticide',
        'agriculture.soil': 'Soil',
        'agriculture.weather': 'Weather',
        'agriculture.market': 'Market',
        
        // Voice commands
        'voice.crop_status': 'Crop Status',
        'voice.weather_info': 'Weather Information',
        'voice.market_price': 'Market Price',
        'voice.loan_status': 'Loan Status',
        'voice.insurance': 'Insurance',
        
        // Messages
        'message.farmer_created': 'Farmer created successfully',
        'message.crop_added': 'Crop added successfully',
        'message.voice_processed': 'Voice command processed',
        'message.backup_created': 'Backup created successfully',
        'message.restore_completed': 'Restore completed successfully'
      },
      
      hi: {
        // Common
        'common.save': 'सहेजें',
        'common.cancel': 'रद्द करें',
        'common.delete': 'हटाएं',
        'common.edit': 'संपादित करें',
        'common.add': 'जोड़ें',
        'common.search': 'खोजें',
        'common.loading': 'लोड हो रहा है...',
        'common.error': 'त्रुटि',
        'common.success': 'सफलता',
        'common.warning': 'चेतावनी',
        'common.info': 'जानकारी',
        
        // Navigation
        'nav.dashboard': 'डैशबोर्ड',
        'nav.farmers': 'किसान',
        'nav.crops': 'फसलें',
        'nav.analytics': 'विश्लेषण',
        'nav.settings': 'सेटिंग्स',
        'nav.profile': 'प्रोफाइल',
        'nav.logout': 'लॉग आउट',
        
        // Agricultural terms
        'agriculture.farmer': 'किसान',
        'agriculture.crop': 'फसल',
        'agriculture.planting': 'बुवाई',
        'agriculture.harvest': 'कटाई',
        'agriculture.irrigation': 'सिंचाई',
        'agriculture.fertilizer': 'उर्वरक',
        'agriculture.pesticide': 'कीटनाशक',
        'agriculture.soil': 'मिट्टी',
        'agriculture.weather': 'मौसम',
        'agriculture.market': 'बाजार',
        
        // Voice commands
        'voice.crop_status': 'फसल की स्थिति',
        'voice.weather_info': 'मौसम की जानकारी',
        'voice.market_price': 'बाजार मूल्य',
        'voice.loan_status': 'ऋण की स्थिति',
        'voice.insurance': 'बीमा',
        
        // Messages
        'message.farmer_created': 'किसान सफलतापूर्वक बनाया गया',
        'message.crop_added': 'फसल सफलतापूर्वक जोड़ी गई',
        'message.voice_processed': 'आवाज कमांड प्रोसेस किया गया',
        'message.backup_created': 'बैकअप सफलतापूर्वक बनाया गया',
        'message.restore_completed': 'पुनर्स्थापना सफलतापूर्वक पूरी हुई'
      },
      
      te: {
        // Common
        'common.save': 'సేవ్ చేయండి',
        'common.cancel': 'రద్దు చేయండి',
        'common.delete': 'తొలగించండి',
        'common.edit': 'సవరించండి',
        'common.add': 'జోడించండి',
        'common.search': 'వెతకండి',
        'common.loading': 'లోడ్ అవుతోంది...',
        'common.error': 'లోపం',
        'common.success': 'విజయం',
        'common.warning': 'హెచ్చరిక',
        'common.info': 'సమాచారం',
        
        // Navigation
        'nav.dashboard': 'డ్యాష్‌బోర్డ్',
        'nav.farmers': 'రైతులు',
        'nav.crops': 'పంటలు',
        'nav.analytics': 'విశ్లేషణ',
        'nav.settings': 'సెట్టింగ్‌లు',
        'nav.profile': 'ప్రొఫైల్',
        'nav.logout': 'లాగ్ అవుట్',
        
        // Agricultural terms
        'agriculture.farmer': 'రైతు',
        'agriculture.crop': 'పంట',
        'agriculture.planting': 'నాటడం',
        'agriculture.harvest': 'కోత',
        'agriculture.irrigation': 'నీటిపారుదల',
        'agriculture.fertilizer': 'ఎరువు',
        'agriculture.pesticide': 'కీటకనాశిని',
        'agriculture.soil': 'నేల',
        'agriculture.weather': 'వాతావరణం',
        'agriculture.market': 'మార్కెట్',
        
        // Voice commands
        'voice.crop_status': 'పంట స్థితి',
        'voice.weather_info': 'వాతావరణ సమాచారం',
        'voice.market_price': 'మార్కెట్ ధర',
        'voice.loan_status': 'లోన్ స్థితి',
        'voice.insurance': 'ఇన్సూరెన్స్',
        
        // Messages
        'message.farmer_created': 'రైతు విజయవంతంగా సృష్టించబడ్డాడు',
        'message.crop_added': 'పంట విజయవంతంగా జోడించబడింది',
        'message.voice_processed': 'వాయిస్ కమాండ్ ప్రాసెస్ చేయబడింది',
        'message.backup_created': 'బ్యాకప్ విజయవంతంగా సృష్టించబడింది',
        'message.restore_completed': 'పునరుద్ధరణ విజయవంతంగా పూర్తయింది'
      },
      
      ta: {
        // Common
        'common.save': 'சேமி',
        'common.cancel': 'ரத்து செய்',
        'common.delete': 'நீக்கு',
        'common.edit': 'திருத்து',
        'common.add': 'சேர்',
        'common.search': 'தேடு',
        'common.loading': 'ஏற்றுகிறது...',
        'common.error': 'பிழை',
        'common.success': 'வெற்றி',
        'common.warning': 'எச்சரிக்கை',
        'common.info': 'தகவல்',
        
        // Navigation
        'nav.dashboard': 'டாஷ்போர்டு',
        'nav.farmers': 'விவசாயிகள்',
        'nav.crops': 'பயிர்கள்',
        'nav.analytics': 'பகுப்பாய்வு',
        'nav.settings': 'அமைப்புகள்',
        'nav.profile': 'சுயவிவரம்',
        'nav.logout': 'வெளியேறு',
        
        // Agricultural terms
        'agriculture.farmer': 'விவசாயி',
        'agriculture.crop': 'பயிர்',
        'agriculture.planting': 'நடவு',
        'agriculture.harvest': 'அறுவடை',
        'agriculture.irrigation': 'நீர்ப்பாசனம்',
        'agriculture.fertilizer': 'உரம்',
        'agriculture.pesticide': 'பூச்சிக்கொல்லி',
        'agriculture.soil': 'மண்',
        'agriculture.weather': 'வானிலை',
        'agriculture.market': 'சந்தை',
        
        // Voice commands
        'voice.crop_status': 'பயிர் நிலை',
        'voice.weather_info': 'வானிலை தகவல்',
        'voice.market_price': 'சந்தை விலை',
        'voice.loan_status': 'கடன் நிலை',
        'voice.insurance': 'காப்பீடு',
        
        // Messages
        'message.farmer_created': 'விவசாயி வெற்றிகரமாக உருவாக்கப்பட்டது',
        'message.crop_added': 'பயிர் வெற்றிகரமாக சேர்க்கப்பட்டது',
        'message.voice_processed': 'குரல் கட்டளை செயலாக்கப்பட்டது',
        'message.backup_created': 'காப்பு வெற்றிகரமாக உருவாக்கப்பட்டது',
        'message.restore_completed': 'மீட்டமைப்பு வெற்றிகரமாக முடிந்தது'
      }
    };

    // Store translations
    for (const [lang, translations] of Object.entries(coreTranslations)) {
      this.translations.set(lang, translations);
    }

    console.log('✅ Translations loaded for languages:', this.supportedLanguages);
  }

  async loadRegionalSettings() {
    const regionalConfigs = {
      'IN': {
        currency: 'INR',
        dateFormat: 'DD/MM/YYYY',
        timeFormat: '24h',
        numberFormat: {
          decimal: '.',
          thousands: ','
        },
        phoneFormat: '+91-XXXXXXXXXX',
        addressFormat: {
          street: 'Street',
          city: 'City',
          state: 'State',
          pincode: 'Pincode'
        }
      },
      'US': {
        currency: 'USD',
        dateFormat: 'MM/DD/YYYY',
        timeFormat: '12h',
        numberFormat: {
          decimal: '.',
          thousands: ','
        },
        phoneFormat: '+1-XXX-XXX-XXXX',
        addressFormat: {
          street: 'Street',
          city: 'City',
          state: 'State',
          zipcode: 'ZIP Code'
        }
      }
    };

    for (const [region, config] of Object.entries(regionalConfigs)) {
      this.regionalSettings.set(region, config);
    }

    console.log('✅ Regional settings loaded');
  }

  async initializeLanguageDetection() {
    // Initialize language detection based on user preferences, browser settings, etc.
    console.log('✅ Language detection initialized');
  }

  // Translation methods
  translate(key, language = null, params = {}) {
    const lang = language || this.defaultLanguage;
    const translations = this.translations.get(lang);
    
    if (!translations) {
      console.warn(`No translations found for language: ${lang}`);
      return key;
    }

    let translation = translations[key];
    if (!translation) {
      console.warn(`Translation key not found: ${key} for language: ${lang}`);
      return key;
    }

    // Replace parameters in translation
    for (const [paramKey, paramValue] of Object.entries(params)) {
      translation = translation.replace(`{${paramKey}}`, paramValue);
    }

    return translation;
  }

  getSupportedLanguages() {
    return this.supportedLanguages;
  }

  getDefaultLanguage() {
    return this.defaultLanguage;
  }

  setDefaultLanguage(language) {
    if (this.supportedLanguages.includes(language)) {
      this.defaultLanguage = language;
      return true;
    }
    return false;
  }

  // Regional formatting methods
  formatCurrency(amount, region = 'IN', language = 'en') {
    const regionalConfig = this.regionalSettings.get(region);
    if (!regionalConfig) {
      return amount.toString();
    }

    const currencySymbols = {
      'INR': '₹',
      'USD': '$',
      'EUR': '€'
    };

    const symbol = currencySymbols[regionalConfig.currency] || regionalConfig.currency;
    const formattedAmount = this.formatNumber(amount, region);
    
    return `${symbol} ${formattedAmount}`;
  }

  formatNumber(number, region = 'IN') {
    const regionalConfig = this.regionalSettings.get(region);
    if (!regionalConfig) {
      return number.toString();
    }

    return number.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  formatDate(date, region = 'IN', language = 'en') {
    const regionalConfig = this.regionalSettings.get(region);
    if (!regionalConfig) {
      return date.toLocaleDateString();
    }

    const locales = {
      'IN': 'en-IN',
      'US': 'en-US'
    };

    return date.toLocaleDateString(locales[region] || 'en-IN');
  }

  formatPhone(phone, region = 'IN') {
    const regionalConfig = this.regionalSettings.get(region);
    if (!regionalConfig) {
      return phone;
    }

    // Simple phone formatting - in production, use a proper library
    return phone.replace(/(\d{2})(\d{5})(\d{5})/, '$1-$2-$3');
  }

  // Language detection methods
  detectLanguageFromHeader(acceptLanguage) {
    if (!acceptLanguage) {
      return this.defaultLanguage;
    }

    const languages = acceptLanguage
      .split(',')
      .map(lang => lang.split(';')[0].trim())
      .map(lang => lang.split('-')[0]);

    for (const lang of languages) {
      if (this.supportedLanguages.includes(lang)) {
        return lang;
      }
    }

    return this.defaultLanguage;
  }

  detectLanguageFromUser(user) {
    if (user && user.preferredLanguage) {
      return user.preferredLanguage;
    }
    return this.defaultLanguage;
  }

  // Database methods for user language preferences
  async setUserLanguagePreference(userId, language) {
    try {
      if (!this.supportedLanguages.includes(language)) {
        throw new Error(`Unsupported language: ${language}`);
      }

      await this.prisma.user.update({
        where: { id: userId },
        data: { preferredLanguage: language }
      });

      return true;
    } catch (error) {
      console.error('Failed to set user language preference:', error);
      throw error;
    }
  }

  async getUserLanguagePreference(userId) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { preferredLanguage: true }
      });

      return user?.preferredLanguage || this.defaultLanguage;
    } catch (error) {
      console.error('Failed to get user language preference:', error);
      return this.defaultLanguage;
    }
  }

  // API response localization
  localizeResponse(data, language = null, region = null) {
    const lang = language || this.defaultLanguage;
    const reg = region || 'IN';

    if (typeof data === 'string') {
      return this.translate(data, lang);
    }

    if (Array.isArray(data)) {
      return data.map(item => this.localizeResponse(item, lang, reg));
    }

    if (typeof data === 'object' && data !== null) {
      const localized = {};
      for (const [key, value] of Object.entries(data)) {
        if (typeof value === 'string' && value.startsWith('i18n:')) {
          localized[key] = this.translate(value.substring(5), lang);
        } else {
          localized[key] = this.localizeResponse(value, lang, reg);
        }
      }
      return localized;
    }

    return data;
  }

  // Voice command localization
  getLocalizedVoiceCommands(language = null) {
    const lang = language || this.defaultLanguage;
    
    const voiceCommands = {
      en: {
        'crop_status': 'What is the status of my crops?',
        'weather_info': 'What is the weather forecast?',
        'market_price': 'What are the current market prices?',
        'loan_status': 'What is my loan status?',
        'insurance': 'Tell me about my insurance'
      },
      hi: {
        'crop_status': 'मेरी फसलों की स्थिति क्या है?',
        'weather_info': 'मौसम का पूर्वानुमान क्या है?',
        'market_price': 'वर्तमान बाजार मूल्य क्या हैं?',
        'loan_status': 'मेरी ऋण की स्थिति क्या है?',
        'insurance': 'मेरे बीमा के बारे में बताएं'
      },
      te: {
        'crop_status': 'నా పంటల స్థితి ఏమిటి?',
        'weather_info': 'వాతావరణ అంచనా ఏమిటి?',
        'market_price': 'ప్రస్తుత మార్కెట్ ధరలు ఏమిటి?',
        'loan_status': 'నా లోన్ స్థితి ఏమిటి?',
        'insurance': 'నా ఇన్సూరెన్స్ గురించి చెప్పండి'
      },
      ta: {
        'crop_status': 'எனது பயிர்களின் நிலை என்ன?',
        'weather_info': 'வானிலை முன்னறிவிப்பு என்ன?',
        'market_price': 'தற்போதைய சந்தை விலைகள் என்ன?',
        'loan_status': 'எனது கடன் நிலை என்ன?',
        'insurance': 'எனது காப்பீட்டைப் பற்றி சொல்லுங்கள்'
      }
    };

    return voiceCommands[lang] || voiceCommands[this.defaultLanguage];
  }

  // Error message localization
  getLocalizedErrorMessage(error, language = null) {
    const lang = language || this.defaultLanguage;
    
    const errorMessages = {
      en: {
        'validation.required': 'This field is required',
        'validation.email': 'Please enter a valid email address',
        'validation.phone': 'Please enter a valid phone number',
        'auth.unauthorized': 'You are not authorized to perform this action',
        'auth.token_expired': 'Your session has expired, please login again',
        'database.connection_error': 'Database connection error',
        'api.rate_limit': 'Too many requests, please try again later'
      },
      hi: {
        'validation.required': 'यह फ़ील्ड आवश्यक है',
        'validation.email': 'कृपया एक वैध ईमेल पता दर्ज करें',
        'validation.phone': 'कृपया एक वैध फ़ोन नंबर दर्ज करें',
        'auth.unauthorized': 'आपको इस क्रिया को करने की अनुमति नहीं है',
        'auth.token_expired': 'आपका सत्र समाप्त हो गया है, कृपया फिर से लॉगिन करें',
        'database.connection_error': 'डेटाबेस कनेक्शन त्रुटि',
        'api.rate_limit': 'बहुत सारे अनुरोध, कृपया बाद में पुनः प्रयास करें'
      },
      te: {
        'validation.required': 'ఈ ఫీల్డ్ అవసరం',
        'validation.email': 'దయచేసి చెల్లుబాటు అయ్యే ఇమెయిల్ చిరునామా నమోదు చేయండి',
        'validation.phone': 'దయచేసి చెల్లుబాటు అయ్యే ఫోన్ నంబర్ నమోదు చేయండి',
        'auth.unauthorized': 'ఈ చర్యను చేయడానికి మీకు అనుమతి లేదు',
        'auth.token_expired': 'మీ సెషన్ గడువు ముగిసింది, దయచేసి మళ్లీ లాగిన్ చేయండి',
        'database.connection_error': 'డేటాబేస్ కనెక్షన్ లోపం',
        'api.rate_limit': 'చాలా అభ్యర్థనలు, దయచేసి తర్వాత మళ్లీ ప్రయత్నించండి'
      },
      ta: {
        'validation.required': 'இந்த புலம் தேவை',
        'validation.email': 'தயவுசெய்து சரியான மின்னஞ்சல் முகவரியை உள்ளிடவும்',
        'validation.phone': 'தயவுசெய்து சரியான தொலைபேசி எண்ணை உள்ளிடவும்',
        'auth.unauthorized': 'இந்த செயலைச் செய்ய உங்களுக்கு அனுமதி இல்லை',
        'auth.token_expired': 'உங்கள் அமர்வு காலாவதியாகிவிட்டது, தயவுசெய்து மீண்டும் உள்நுழையவும்',
        'database.connection_error': 'தரவுத்தள இணைப்பு பிழை',
        'api.rate_limit': 'பல கோரிக்கைகள், தயவுசெய்து பின்னர் மீண்டும் முயற்சிக்கவும்'
      }
    };

    const messages = errorMessages[lang] || errorMessages[this.defaultLanguage];
    return messages[error] || error;
  }

  // Utility methods
  isLanguageSupported(language) {
    return this.supportedLanguages.includes(language);
  }

  getLanguageName(language) {
    const languageNames = {
      'en': 'English',
      'hi': 'हिन्दी',
      'te': 'తెలుగు',
      'ta': 'தமிழ்'
    };
    
    return languageNames[language] || language;
  }

  getRegionName(region) {
    const regionNames = {
      'IN': 'India',
      'US': 'United States'
    };
    
    return regionNames[region] || region;
  }
}

module.exports = InternationalizationService;
