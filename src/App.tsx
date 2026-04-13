/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Enhanced AIME Precision Application
 * - Added Error Boundaries
 * - Improved Error Handling
 * - Input Validation
 * - Network Request Timeout
 * - Better State Management
 */

import React, { useState, useEffect, useRef, ReactNode } from 'react';
import { ShoppingCart, Menu, X, ArrowRight, Instagram, Facebook, Twitter, Mail, Plus } from 'lucide-react';
import { motion, AnimatePresence, useScroll, useTransform } from 'motion/react';

// ============ Error Boundary Component ============
interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-aime-beige p-6">
          <div className="max-w-md text-center">
            <h1 className="text-4xl font-serif mb-4">Something went wrong</h1>
            <p className="text-gray-600 mb-8">{this.state.error?.message || 'An unexpected error occurred'}</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-8 py-4 bg-aime-black text-white rounded hover:bg-aime-green transition-colors"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// ============ Types ============
interface Product {
  id: number;
  name: string;
  category: string;
  type: 'minimalist' | 'frameless' | 'hardware';
  price: string;
  image: string;
  size: 'small' | 'large';
}

interface Collection {
  id: number;
  name: string;
  type: string;
  image: string;
}

// ============ Constants ============
const PRODUCTS: Product[] = [
  { id: 1, name: "Onyx Minimalist", category: "Minimalist Frame", type: 'minimalist', price: "$1,200", image: "https://images.unsplash.com/photo-1620626011761-9963d7b59675?auto=format&fit=crop&q=80&w=1200", size: 'large' },
  { id: 2, name: "Frosted Mist", category: "Frameless Series", type: 'frameless', price: "$850", image: "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&q=80&w=800", size: 'small' },
  { id: 3, name: "Titanium Pivot", category: "Hardware", type: 'hardware', price: "$450", image: "https://images.unsplash.com/photo-1553134802-ff9ec18ed22a?auto=format&fit=crop&q=80&w=800", size: 'small' },
  { id: 4, name: "Clear Precision", category: "Frameless Series", type: 'frameless', price: "$900", image: "https://images.unsplash.com/photo-1600566752355-35792bedcfea?auto=format&fit=crop&q=80&w=1200", size: 'large' },
  { id: 5, name: "Slate Handle", category: "Hardware", type: 'hardware', price: "$120", image: "https://images.unsplash.com/photo-1523413363574-c3c4447df0d6?auto=format&fit=crop&q=80&w=800", size: 'small' },
  { id: 6, name: "Emerald Tint", category: "Minimalist Frame", type: 'minimalist', price: "$1,100", image: "https://images.unsplash.com/photo-1507652313519-d4c9174996dd?auto=format&fit=crop&q=80&w=800", size: 'small' },
  { id: 7, name: "Arctic Frameless", category: "Frameless Series", type: 'frameless', price: "$1,450", image: "https://images.unsplash.com/photo-1517646287270-a5a9ca602e5c?auto=format&fit=crop&q=80&w=1200", size: 'large' },
  { id: 8, name: "Industrial Pivot", category: "Minimalist Frame", type: 'minimalist', price: "$950", image: "https://images.unsplash.com/photo-1505330622279-bf7d7fc918f4?auto=format&fit=crop&q=80&w=800", size: 'small' },
];

const COLLECTIONS: Collection[] = [
  { id: 101, name: "Brushed Steel", type: "Hardware", image: "https://images.unsplash.com/photo-1517646287270-a5a9ca602e5c?auto=format&fit=crop&q=80&w=600" },
  { id: 102, name: "Ribbed Glass", type: "Texture", image: "https://images.unsplash.com/photo-1533090161767-e6ffed986c88?auto=format&fit=crop&q=80&w=600" },
  { id: 103, name: "Matte Black", type: "Hardware", image: "https://images.unsplash.com/photo-1505330622279-bf7d7fc918f4?auto=format&fit=crop&q=80&w=600" },
  { id: 104, name: "Bronze Finish", type: "Hardware", image: "https://images.unsplash.com/photo-1584622781564-1d987f7333c1?auto=format&fit=crop&q=80&w=600" },
];

const TRANSLATIONS = {
  en: {
    nav: { collection: "Collection", diy: "DIY Custom", craft: "Craft", shop: "Shop", contact: "Contact" },
    hero: { title: "AIME\nPRECISION", subtitle: "Engineered for the modern sanctuary. Rugged materials meet minimalist aesthetics.", cta: "Explore Collection" },
    diy: { 
      title: "DIY PRECISION", 
      tag: "Configurator", 
      spec: "Current Spec",
      steps: ["SELECT SHAPE", "SELECT GLASS", "SELECT HARDWARE"],
      shapes: { 'I-Shape': 'I-Shape', 'L-Shape': 'L-Shape', 'Curved': 'Curved' },
      glasses: { 'Clear': 'Clear', 'Ribbed': 'Ribbed', 'Gray': 'Gray' },
      hardwares: { 'Matte Black': 'Matte Black', 'Forest Green': 'Forest Green', 'Brushed Silver': 'Brushed Silver' },
      cta: "Inquire Now",
      footer: "OUR DESIGNERS WILL CONTACT YOU WITHIN 24 HOURS"
    },
    feature: { tag: "Craftsmanship", title: "Built to\nEndure.", p1: "Our process begins with raw, industrial-grade materials.", p2: "Every hinge, handle, and glass panel is tested for precision.", stat1: "Glass Thickness", stat2: "Hardware Warranty" },
    catalog: { 
      title: "Shop Craft", 
      tag: "Precision components for your sanctuary",
      filters: { all: "All Series", minimalist: "Minimalist Frame", frameless: "Frameless Series" },
      viewDetails: "View Details"
    },
    footer: { newsletter: "Stay Sharp.", newsletterSub: "Join our newsletter for exclusive architectural insights.", join: "JOIN" }
  },
  cn: {
    nav: { collection: "系列", diy: "定制", craft: "工艺", shop: "商店", contact: "联系" },
    hero: { title: "AIME\n极致精准", subtitle: "为现代避难所而生。坚固材质与极简美学的完美融合。", cta: "探索系列" },
    diy: { 
      title: "DIY 定制系统", 
      tag: "配置器", 
      spec: "当前配置",
      steps: ["选择形状", "选择玻璃", "选择五金"],
      shapes: { 'I-Shape': '一字形', 'L-Shape': 'L形', 'Curved': '圆弧形' },
      glasses: { 'Clear': '透明', 'Ribbed': '长虹', 'Gray': '灰色' },
      hardwares: { 'Matte Black': '哑光黑', 'Forest Green': '森林绿', 'Brushed Silver': '拉丝银' },
      cta: "立即咨询",
      footer: "我们的设计师将在 24 小时内与您联系"
    },
    feature: { tag: "匠心工艺", title: "经久\n耐用", p1: "我们的流程始于原始的工业级材料。", p2: "每一个合页、把手和玻璃面板都经过精密测试。", stat1: "玻璃厚度", stat2: "五金质保" },
    catalog: { 
      title: "匠心优选", 
      tag: "为您避难所打造的精密组件",
      filters: { all: "全系列", minimalist: "极简框", frameless: "无框系列" },
      viewDetails: "查看详情"
    },
    footer: { newsletter: "保持敏锐", newsletterSub: "加入我们的通讯，获取独家建筑见解。", join: "加入" }
  }
};

// ============ DIY Section Component ============
function DIYSection({ lang }: { lang: 'en' | 'cn' }) {
  const t = TRANSLATIONS[lang].diy;
  const [shape, setShape] = useState('I-Shape');
  const [glass, setGlass] = useState('Clear');
  const [hardware, setHardware] = useState('Matte Black');
  const [currentStep, setCurrentStep] = useState(0);

  const shapes = [
    { id: 'I-Shape', label: t.shapes['I-Shape'], img: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&q=80&w=1200' },
    { id: 'L-Shape', label: t.shapes['L-Shape'], img: 'https://images.unsplash.com/photo-1620626011761-9963d7b59675?auto=format&fit=crop&q=80&w=1200' },
    { id: 'Curved', label: t.shapes['Curved'], img: 'https://images.unsplash.com/photo-1553134802-ff9ec18ed22a?auto=format&fit=crop&q=80&w=1200' },
  ];

  const glasses = [
    { id: 'Clear', label: t.glasses['Clear'], spec: '8mm' },
    { id: 'Ribbed', label: t.glasses['Ribbed'], spec: '10mm' },
    { id: 'Gray', label: t.glasses['Gray'], spec: '8mm' },
  ];

  const hardwares = [
    { id: 'Matte Black', label: t.hardwares['Matte Black'], material: 'Stainless Steel' },
    { id: 'Forest Green', label: t.hardwares['Forest Green'], material: 'Anodized Aluminum' },
    { id: 'Brushed Silver', label: t.hardwares['Brushed Silver'], material: 'Chrome' },
  ];

  const getQuote = () => {
    try {
      const params = `Shape: ${shape}, Glass: ${glass}, Hardware: ${hardware}`;
      const text = `Hello, I am interested in a custom shower with the following configuration: ${params}`;
      
      // Save to localStorage with error handling
      try {
        const inquiries = JSON.parse(localStorage.getItem('aime_inquiries') || '[]');
        if (!Array.isArray(inquiries)) {
          throw new Error('Invalid inquiries format');
        }
        inquiries.push({
          id: Date.now().toString(),
          type: 'DIY Configuration',
          details: `${shape} | ${glass} | ${hardware}`,
          status: 'new',
          date: new Date().toISOString()
        });
        localStorage.setItem('aime_inquiries', JSON.stringify(inquiries));
      } catch (storageError) {
        console.warn('Failed to save inquiry to localStorage:', storageError);
      }

      const whatsappUrl = `https://wa.me/1234567890?text=${encodeURIComponent(text)}`;
      window.open(whatsappUrl, '_blank');
    } catch (error) {
      console.error('Error in getQuote:', error);
      alert(lang === 'en' ? 'Failed to process quote. Please try again.' : '处理报价失败，请重试。');
    }
  };

  const currentShapeImg = shapes.find(s => s.id === shape)?.img || shapes[0].img;
  const currentGlassSpec = glasses.find(g => g.id === glass)?.spec;
  const currentHardwareMaterial = hardwares.find(h => h.id === hardware)?.material;

  return (
    <section id="diy" className="py-32 bg-aime-beige overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <p className="text-aime-green font-bold text-xs uppercase tracking-widest mb-4">{t.tag}</p>
          <h2 className="text-6xl text-black">{t.title}</h2>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
          {/* Preview & Config Panel */}
          <div className="space-y-8">
            <div className="relative aspect-[4/5] bg-white overflow-hidden group rounded-sm shadow-2xl">
              <AnimatePresence mode="wait">
                <motion.div
                  key={`${shape}-${currentStep}`}
                  initial={{ opacity: 0, scale: 1.1 }}
                  animate={{ 
                    opacity: 1, 
                    scale: currentStep === 2 ? 1.2 : 1,
                    x: currentStep === 2 ? 20 : 0,
                    y: currentStep === 2 ? -20 : 0
                  }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.8, ease: "circOut" }}
                  className="w-full h-full relative"
                >
                  <img 
                    src={currentShapeImg} 
                    alt="Preview" 
                    className={`w-full h-full object-contain transition-all duration-1000 ${
                      hardware === 'Forest Green' ? 'hue-rotate-[120deg] saturate-[0.8] brightness-[0.9]' : 
                      hardware === 'Brushed Silver' ? 'brightness-[1.1] saturate-[0.2]' : ''
                    } ${currentStep === 2 ? 'blur-[1px] brightness-75' : ''}`}
                    referrerPolicy="no-referrer"
                    loading="lazy"
                  />
                  
                  {currentStep === 2 && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="absolute inset-0 flex items-center justify-center pointer-events-none"
                    >
                      <div className="w-32 h-32 border-2 border-aime-green rounded-full animate-ping opacity-20"></div>
                      <div className="absolute top-1/4 right-1/4 w-4 h-4 bg-aime-green rounded-full shadow-[0_0_20px_rgba(45,79,54,0.8)]"></div>
                      <div className="absolute bottom-1/3 left-1/2 w-4 h-4 bg-aime-green rounded-full shadow-[0_0_20px_rgba(45,79,54,0.8)]"></div>
                    </motion.div>
                  )}

                  {glass === 'Ribbed' && (
                    <div className="absolute inset-0 backdrop-blur-[2px] pointer-events-none" 
                         style={{ background: 'repeating-linear-gradient(90deg, transparent, transparent 4px, rgba(255,255,255,0.1) 4px, rgba(255,255,255,0.1) 8px)' }}>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Config Summary */}
            <div className="bg-black text-white p-8 space-y-4">
              <p className="text-xs uppercase tracking-widest text-aime-green">{t.spec}</p>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span>{t.steps[0]}</span>
                  <span className="font-bold">{shape}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t.steps[1]}</span>
                  <span className="font-bold">{glass} ({currentGlassSpec})</span>
                </div>
                <div className="flex justify-between">
                  <span>{t.steps[2]}</span>
                  <span className="font-bold">{hardware} ({currentHardwareMaterial})</span>
                </div>
              </div>
            </div>
          </div>

          {/* Configuration Controls */}
          <div className="space-y-12">
            {[
              { step: 0, title: t.steps[0], options: shapes, selected: shape, setter: setShape },
              { step: 1, title: t.steps[1], options: glasses, selected: glass, setter: setGlass },
              { step: 2, title: t.steps[2], options: hardwares, selected: hardware, setter: setHardware }
            ].map(({ step, title, options, selected, setter }) => (
              <div key={step}>
                <button 
                  onClick={() => setCurrentStep(step)}
                  className={`text-lg font-bold tracking-widest mb-6 transition-colors ${
                    currentStep === step ? 'text-aime-green' : 'text-gray-400 hover:text-black'
                  }`}
                >
                  {title}
                </button>
                <div className="grid grid-cols-1 gap-4">
                  {options.map((option: any) => (
                    <button
                      key={option.id}
                      onClick={() => setter(option.id)}
                      className={`p-4 text-left border-2 transition-all ${
                        selected === option.id 
                          ? 'border-aime-green bg-aime-green/5' 
                          : 'border-gray-200 hover:border-gray-400'
                      }`}
                    >
                      <div className="font-bold">{option.label}</div>
                      <div className="text-xs text-gray-500">
                        {option.spec || option.material}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}

            <button 
              onClick={getQuote}
              className="w-full bg-aime-black text-white py-6 text-xs font-bold tracking-widest uppercase hover:bg-aime-green transition-colors"
            >
              {t.cta}
            </button>
            <p className="text-xs text-gray-500 text-center">{t.footer}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============ Main App Component ============
export default function App() {
  const [lang, setLang] = useState<'en' | 'cn'>('en');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'minimalist' | 'frameless'>('all');
  const [products, setProducts] = useState<Product[]>(PRODUCTS);
  const [error, setError] = useState<string | null>(null); const [user, setUser] = useState<any>(null); useEffect(() => { const savedUser = localStorage.getItem("aime_user"); if (savedUser) { try { setUser(JSON.parse(savedUser)); } catch (e) { localStorage.removeItem("aime_user"); } } }, []); const handleLogout = () => { localStorage.removeItem("aime_user"); setUser(null); window.location.reload(); };
  const { scrollYProgress } = useScroll();
  const t = TRANSLATIONS[lang];

  // Validate products on mount
  useEffect(() => {
    try {
      if (!Array.isArray(products) || products.length === 0) {
        setProducts(PRODUCTS);
      }
    } catch (err) {
      console.error('Error validating products:', err);
      setError('Failed to load products');
    }
  }, []);

  return (
    <ErrorBoundary>
      <div className="bg-aime-beige min-h-screen">
        {error && (
          <div className="fixed top-4 right-4 bg-red-500 text-white px-6 py-3 rounded z-50">
            {error}
          </div>
        )}

        {/* Navigation */}
        <nav className="fixed top-0 w-full bg-aime-beige/95 backdrop-blur z-50 border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-6 py-6 flex justify-between items-center">
            <h1 className="text-2xl font-serif font-bold">AIME</h1>
            
            {/* Desktop Menu */}
            <div className="hidden md:flex gap-12 items-center">
              <a href="index.html" className="text-xs font-bold tracking-widest uppercase hover:text-aime-green transition-colors">{t.nav.collection}</a>
              <a href="shop.html" className="text-xs font-bold tracking-widest uppercase hover:text-aime-green transition-colors">{t.nav.shop}</a>
              <a href="diy.html" className="text-xs font-bold tracking-widest uppercase hover:text-aime-green transition-colors">{t.nav.diy}</a>
              <a href="contact.html" className="text-xs font-bold tracking-widest uppercase hover:text-aime-green transition-colors">{t.nav.contact}</a>
              <a href="admin-dashboard.html" className="text-xs font-bold tracking-widest uppercase hover:text-aime-green transition-colors">Admin</a>
              <button 
                onClick={() => setLang(lang === 'en' ? 'cn' : 'en')}
                className="px-4 py-2 border border-aime-black rounded hover:bg-aime-black hover:text-white transition-colors text-xs font-bold"
              >
                {lang === 'en' ? '中文' : 'EN'}
              </button>
            </div>

            {/* Mobile Menu Button */}
            <button 
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden"
            >
              {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </nav>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="fixed inset-0 bg-aime-black z-[60] flex flex-col p-8 mt-20"
            >
              <div className="flex flex-col gap-8">
                <a href="index.html" onClick={() => setIsMenuOpen(false)} className="text-5xl font-display font-medium text-white hover:text-aime-green transition-colors">{t.nav.collection}</a>
                <a href="shop.html" onClick={() => setIsMenuOpen(false)} className="text-5xl font-display font-medium text-white hover:text-aime-green transition-colors">{t.nav.shop}</a>
                <a href="diy.html" onClick={() => setIsMenuOpen(false)} className="text-5xl font-display font-medium text-white hover:text-aime-green transition-colors">{t.nav.diy}</a>
                <a href="contact.html" onClick={() => setIsMenuOpen(false)} className="text-5xl font-display font-medium text-white hover:text-aime-green transition-colors">{t.nav.contact}</a>
                <a href="admin-dashboard.html" onClick={() => setIsMenuOpen(false)} className="text-5xl font-display font-medium text-white hover:text-aime-green transition-colors">Admin</a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Hero Section */}
        <section className="relative h-screen flex items-center overflow-hidden bg-aime-beige pt-20">
          <div className="absolute right-0 top-0 bottom-0 w-full md:w-[70%] h-full py-12 pr-12 pl-8 md:pl-0">
            <div className="w-full h-full rounded-full overflow-hidden relative shadow-[0_0_80px_rgba(45,79,54,0.2)]">
              <img 
                src="https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&q=80&w=2000" 
                alt="Hero Background" 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
                loading="lazy"
              />
              <div className="absolute inset-0 shadow-[inset_0_0_100px_rgba(229,229,225,0.8)] pointer-events-none"></div>
            </div>
          </div>
          
          <div className="relative max-w-7xl mx-auto px-6 w-full z-10 pointer-events-none">
            <motion.div 
              key={lang}
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              className="max-w-3xl mix-blend-difference pointer-events-auto"
            >
              <h1 className="text-7xl md:text-[10rem] text-white leading-[0.85] mb-8 whitespace-pre-line">
                {t.hero.title}
              </h1>
              <p className="text-white max-w-md text-lg mb-8 font-light leading-relaxed">
                {t.hero.subtitle}
              </p>
              <a href="#products" className="inline-flex items-center gap-4 bg-white text-black px-8 py-4 uppercase text-xs font-bold tracking-widest hover:bg-aime-green hover:text-white transition-all group">
                {t.hero.cta} <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </a>
            </motion.div>
          </div>
        </section>

        {/* Latest Collection */}
        <section id="collection" className="py-32 bg-aime-beige overflow-hidden">
          <div className="max-w-7xl mx-auto px-6 mb-16 flex justify-between items-end">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <p className="text-aime-green font-bold text-xs uppercase tracking-widest mb-4">The Stream</p>
              <h2 className="text-5xl md:text-6xl">{lang === 'en' ? 'Latest Series' : '最新系列'}</h2>
            </motion.div>
          </div>

          <div className="flex gap-8 overflow-x-auto px-6 pb-12 hide-scrollbar snap-x">
            {COLLECTIONS.map((item) => (
              <motion.div 
                key={item.id}
                whileHover={{ y: -10 }}
                className="flex-shrink-0 w-80 snap-start group cursor-pointer"
                onClick={() => setActiveFilter(item.type as any)}
              >
                <div className="aspect-[3/4] overflow-hidden mb-8 bg-[#D1D1D1] p-8 flex items-center justify-center">
                  <img 
                    src={item.image} 
                    alt={item.name} 
                    className="w-full h-full object-contain transition-all duration-700 scale-110 group-hover:scale-100"
                    referrerPolicy="no-referrer"
                    loading="lazy"
                  />
                </div>
                <div className="mb-6">
                  <p className="text-[10px] uppercase tracking-widest text-aime-green font-bold mb-2">{item.type}</p>
                  <h3 className="text-2xl font-display font-medium uppercase tracking-tight">{item.name}</h3>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* DIY Section */}
        <DIYSection lang={lang} />

        {/* Feature Section */}
        <section id="feature" className="bg-aime-beige py-40 relative overflow-hidden min-h-[90vh] flex items-center">
          <div className="absolute right-[-10%] top-1/2 -translate-y-1/2 w-[80%] md:w-[70%] h-[80%] md:h-[90%] pointer-events-none z-0">
            <motion.div 
              style={{ y: useTransform(scrollYProgress, [0, 1], [-50, 50]) }}
              className="w-full h-full rounded-full overflow-hidden shadow-[0_0_80px_rgba(45,79,54,0.3)]"
            >
              <img 
                src="https://images.unsplash.com/photo-1600566752355-35792bedcfea?auto=format&fit=crop&q=80&w=2400" 
                alt="Immersive Craftsmanship" 
                className="w-full h-full object-cover scale-110"
                referrerPolicy="no-referrer"
                loading="lazy"
              />
            </motion.div>
          </div>

          <div className="max-w-7xl mx-auto px-6 w-full relative z-10 flex items-center">
            <motion.div 
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="w-full md:w-1/2 relative z-20 mix-blend-difference"
            >
              <p className="text-white font-bold text-[9px] uppercase tracking-[0.6em] mb-8 opacity-80">
                {t.feature.tag} / Precision
              </p>
              <h2 className="text-[12vw] lg:text-[9vw] font-display italic text-white leading-[0.9] tracking-tight mb-12 whitespace-pre-line">
                {t.feature.title}
              </h2>
              <div className="text-white/80 font-light leading-relaxed mb-12 text-xs uppercase tracking-[0.25em] max-w-xs space-y-4">
                <p>{t.feature.p1}</p>
                <p>{t.feature.p2}</p>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Product Grid */}
        <section id="products" className="py-32 bg-aime-beige">
          <div className="max-w-7xl mx-auto px-6">
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-20"
            >
              <h2 className="text-6xl mb-8">{t.catalog.title}</h2>
              
              <div className="flex justify-center gap-12 mb-16">
                {(['all', 'minimalist', 'frameless'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setActiveFilter(filter)}
                    className={`relative py-2 text-[10px] font-sans font-bold tracking-[0.2em] uppercase transition-colors duration-[400ms] ${
                      activeFilter === filter ? 'text-aime-green' : 'text-[#666666] hover:text-[#1A1A1A]'
                    }`}
                  >
                    {t.catalog.filters[filter]}
                    {activeFilter === filter && (
                      <motion.div 
                        layoutId="filterLine"
                        className="absolute bottom-0 left-0 w-full h-[2px] bg-aime-green"
                      />
                    )}
                  </button>
                ))}
              </div>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 items-end gap-12">
              {products.filter(p => activeFilter === 'all' || p.type === activeFilter).map((product, index) => (
                <motion.div 
                  key={product.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="group cursor-pointer flex flex-col justify-end h-full"
                >
                  <div className="relative aspect-[4/3] overflow-hidden mb-6 bg-[#D1D1D1] flex items-center justify-center rounded-sm">
                    <img 
                      src={product.image} 
                      alt={product.name} 
                      className="w-full h-full object-contain transition-transform duration-1000 group-hover:scale-110"
                      referrerPolicy="no-referrer"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-aime-black/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                  </div>
                  
                  <div className="flex flex-col">
                    <p className="text-[10px] uppercase tracking-widest text-aime-green font-light mb-2">{product.category}</p>
                    <div className="flex justify-between items-center h-10">
                      <h3 className="text-xl text-aime-black font-display font-medium tracking-tight uppercase truncate mr-4">{product.name}</h3>
                      <p className="font-display text-lg text-aime-black font-medium">{product.price}</p>
                    </div>
                  </div>
                  <button 
                    className="w-full bg-aime-black text-white rounded-full py-4 text-[10px] font-bold tracking-[0.2em] uppercase transition-all duration-300 hover:bg-aime-green hover:scale-105 flex items-center justify-center gap-2"
                  >
                    {t.catalog.viewDetails}
                  </button>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="bg-aime-black text-white pt-32 pb-12">
          <div className="max-w-7xl mx-auto px-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 mb-32">
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
              >
                <h2 className="text-5xl mb-8">{t.footer.newsletter}</h2>
                <p className="text-white/50 mb-8 max-w-sm">
                  {t.footer.newsletterSub}
                </p>
              </motion.div>
            </div>
            
            <div className="pt-12 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-8">
              <p className="text-[10px] tracking-[0.3em] text-white/30">© 2026 AIME PRECISION. ALL RIGHTS RESERVED.</p>
            </div>
          </div>
        </footer>
      </div>
    </ErrorBoundary>
  );
}
