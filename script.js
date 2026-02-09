```javascript
/* ============================================
   صوت حضرموت - الملف الرئيسي للجافاسكربت
   ============================================ */

/**
 * التطبيق الرئيسي
 * @namespace App
 */
const App = (function() {
    'use strict';

    // التكوين
    const config = {
        apiUrl: 'https://api.voiceofhadhramaut.org/v1',
        localData: 'data/surveys.json',
        animationSpeed: 300,
        refreshInterval: 30000, // 30 ثانية
        maxSurveys: 6,
        maxResults: 3
    };

    // الحالة
    const state = {
        user: null,
        surveys: [],
        results: [],
        currentPage: 'home',
        isLoading: false,
        isOnline: navigator.onLine
    };

    // العناصر DOM
    const elements = {
        loadingScreen: null,
        navbar: null,
        backToTop: null,
        activeSurveys: null,
        recentResults: null,
        newsletterForm: null,
        counters: null
    };

    /**
     * تهيئة التطبيق
     * @method init
     */
    function init() {
        cacheElements();
        setupEventListeners();
        setupServiceWorker();
        checkNetworkStatus();
        loadInitialData();
        setupAnimations();
        setupIntersectionObserver();
        
        console.log('✅ تطبيق صوت حضرموت جاهز للعمل');
    }

    /**
     * تخزين عناصر DOM
     * @method cacheElements
     */
    function cacheElements() {
        elements.loadingScreen = document.getElementById('loading-screen');
        elements.navbar = document.querySelector('.navbar');
        elements.backToTop = document.getElementById('backToTop');
        elements.activeSurveys = document.getElementById('activeSurveys');
        elements.recentResults = document.getElementById('recentResults');
        elements.newsletterForm = document.getElementById('newsletterForm');
        elements.counters = document.querySelectorAll('.counter');
    }

    /**
     * إعداد مستمعي الأحداث
     * @method setupEventListeners
     */
    function setupEventListeners() {
        // حدث التمرير
        window.addEventListener('scroll', handleScroll);
        
        // أحداث النقر
        document.addEventListener('click', handleClick);
        
        // أحداث النماذج
        if (elements.newsletterForm) {
            elements.newsletterForm.addEventListener('submit', handleNewsletterSubmit);
        }
        
        // أحداث الشبكة
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        
        // أحداث الصفحة
        window.addEventListener('beforeunload', handleBeforeUnload);
        document.addEventListener('DOMContentLoaded', handleDOMReady);
    }

    /**
     * إعداد Service Worker
     * @method setupServiceWorker
     */
    async function setupServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('/sw.js');
                console.log('✅ Service Worker مسجل:', registration.scope);
            } catch (error) {
                console.warn('⚠️ فشل تسجيل Service Worker:', error);
            }
        }
    }

    /**
     * التحقق من حالة الشبكة
     * @method checkNetworkStatus
     */
    function checkNetworkStatus() {
        state.isOnline = navigator.onLine;
        updateNetworkStatus();
    }

    /**
     * تحديث حالة الشبكة في الواجهة
     * @method updateNetworkStatus
     */
    function updateNetworkStatus() {
        const indicator = document.createElement('div');
        indicator.className = `network-status ${state.isOnline ? 'online' : 'offline'}`;
        indicator.innerHTML = `
            <i class="fas fa-${state.isOnline ? 'wifi' : 'exclamation-triangle'}"></i>
            <span>${state.isOnline ? 'متصل بالإنترنت' : 'غير متصل'}</span>
        `;
        
        // إضافة المؤشر إذا لم يكن موجوداً
        if (!document.querySelector('.network-status')) {
            document.body.appendChild(indicator);
        }
    }

    /**
     * تحميل البيانات الأولية
     * @method loadInitialData
     */
    async function loadInitialData() {
        state.isLoading = true;
        showLoading();
        
        try {
            // محاولة تحميل من API أولاً
            await Promise.all([
                loadSurveys(),
                loadResults(),
                loadUserStats()
            ]);
        } catch (error) {
            console.warn('⚠️ فشل تحميل البيانات من API:', error);
            // استخدام البيانات المحلية كنسخة احتياطية
            await loadLocalData();
        } finally {
            state.isLoading = false;
            hideLoading();
            updateUI();
        }
    }

    /**
     * تحميل الاستبيانات
     * @method loadSurveys
     */
    async function loadSurveys() {
        try {
            const response = await fetch(`${config.apiUrl}/surveys/active`);
            const data = await response.json();
            
            if (data.success) {
                state.surveys = data.data.slice(0, config.maxSurveys);
                cacheData('surveys', state.surveys);
            }
        } catch (error) {
            throw error;
        }
    }

    /**
     * تحميل النتائج
     * @method loadResults
     */
    async function loadResults() {
        try {
            const response = await fetch(`${config.apiUrl}/results/recent`);
            const data = await response.json();
            
            if (data.success) {
                state.results = data.data.slice(0, config.maxResults);
                cacheData('results', state.results);
            }
        } catch (error) {
            throw error;
        }
    }

    /**
     * تحميل إحصائيات المستخدم
     * @method loadUserStats
     */
    async function loadUserStats() {
        try {
            const response = await fetch(`${config.apiUrl}/stats`);
            const data = await response.json();
            
            if (data.success) {
                updateStats(data.data);
            }
        } catch (error) {
            throw error;
        }
    }

    /**
     * تحميل البيانات المحلية
     * @method loadLocalData
     */
    async function loadLocalData() {
        try {
            const response = await fetch(config.localData);
            const data = await response.json();
            
            state.surveys = data.surveys || [];
            state.results = data.results || [];
            
            console.log('📂 تم تحميل البيانات المحلية');
        } catch (error) {
            console.error('❌ فشل تحميل البيانات المحلية:', error);
        }
    }

    /**
     * تحديث الإحصائيات
     * @method updateStats
     */
    function updateStats(stats) {
        if (elements.counters) {
            elements.counters.forEach(counter => {
                const target = parseInt(counter.getAttribute('data-target'));
                animateCounter(counter, target);
            });
        }
    }

    /**
     * تحريك العدادات
     * @method animateCounter
     */
    function animateCounter(element, target) {
        let current = 0;
        const increment = target / 100;
        const duration = 2000; // 2 ثانية
        const stepTime = duration / 100;
        
        const timer = setInterval(() => {
            current += increment;
            if (current >= target) {
                element.textContent = target.toLocaleString();
                clearInterval(timer);
            } else {
                element.textContent = Math.floor(current).toLocaleString();
            }
        }, stepTime);
    }

    /**
     * تحديث واجهة المستخدم
     * @method updateUI
     */
    function updateUI() {
        renderActiveSurveys();
        renderRecentResults();
        updateActiveNav();
    }

    /**
     * عرض الاستبيانات النشطة
     * @method renderActiveSurveys
     */
    function renderActiveSurveys() {
        if (!elements.activeSurveys || state.surveys.length === 0) return;
        
        const surveysHTML = state.surveys.map(survey => `
            <div class="col-lg-4 col-md-6 mb-4">
                <div class="survey-card" data-id="${survey.id}">
                    <div class="survey-header">
                        <h4>${survey.title}</h4>
                        <span class="survey-category">${getCategoryName(survey.category)}</span>
                    </div>
                    <div class="survey-body">
                        <p class="survey-description">${survey.description}</p>
                        
                        <div class="survey-stats">
                            <span><i class="fas fa-users"></i> ${survey.participants} مشارك</span>
                            <span><i class="far fa-clock"></i> ${getTimeRemaining(survey.endDate)}</span>
                        </div>
                        
                        <div class="survey-progress">
                            <div class="progress-bar">
                                <div class="progress-fill" style="width: ${survey.progress}%"></div>
                            </div>
                            <small>تم إكمال ${survey.progress}%</small>
                        </div>
                        
                        <a href="pages/survey.html?id=${survey.id}" class="btn btn-primary w-100">
                            <i class="fas fa-pen"></i> ابدأ الاستبيان
                        </a>
                    </div>
                </div>
            </div>
        `).join('');
        
        elements.activeSurveys.innerHTML = surveysHTML;
    }

    /**
     * عرض النتائج الحديثة
     * @method renderRecentResults
     */
    function renderRecentResults() {
        if (!elements.recentResults || state.results.length === 0) return;
        
        const resultsHTML = state.results.map(result => `
            <div class="col-md-4 mb-4">
                <div class="result-card" data-id="${result.id}">
                    <div class="result-image">
                        <i class="fas fa-chart-pie"></i>
                    </div>
                    <div class="result-content">
                        <h4>${result.title}</h4>
                        <p>${result.summary}</p>
                        
                        <div class="result-meta">
                            <span><i class="far fa-calendar"></i> ${formatDate(result.date)}</span>
                            <span><i class="fas fa-chart-bar"></i> ${result.views} مشاهدة</span>
                        </div>
                        
                        <a href="pages/result.html?id=${result.id}" class="btn btn-outline-primary w-100 mt-3">
                            <i class="fas fa-eye"></i> عرض التقرير
                        </a>
                    </div>
                </div>
            </div>
        `).join('');
        
        elements.recentResults.innerHTML = resultsHTML;
    }

    /**
     * التعامل مع التمرير
     * @method handleScroll
     */
    function handleScroll() {
        // شريط التنقل
        if (elements.navbar) {
            if (window.scrollY > 100) {
                elements.navbar.classList.add('scrolled');
            } else {
                elements.navbar.classList.remove('scrolled');
            }
        }
        
        // زر العودة للأعلى
        if (elements.backToTop) {
            if (window.scrollY > 300) {
                elements.backToTop.classList.add('visible');
            } else {
                elements.backToTop.classList.remove('visible');
            }
        }
        
        // تحريك العناصر
        animateOnScroll();
    }

    /**
     * التعامل مع النقر
     * @method handleClick
     */
    function handleClick(event) {
        const target = event.target;
        
        // زر العودة للأعلى
        if (target.closest('#backToTop')) {
            event.preventDefault();
            scrollToTop();
        }
        
        // روابط التنقل السلس
        if (target.closest('a[href^="#"]') && target.getAttribute('href') !== '#') {
            event.preventDefault();
            const targetId = target.getAttribute('href').substring(1);
            scrollToElement(targetId);
        }
        
        // بطاقات الاستبيانات
        if (target.closest('.survey-card')) {
            const card = target.closest('.survey-card');
            const surveyId = card.getAttribute('data-id');
            trackEvent('survey_click', { survey_id: surveyId });
        }
    }

    /**
     * التعامل مع النشرة البريدية
     * @method handleNewsletterSubmit
     */
    async function handleNewsletterSubmit(event) {
        event.preventDefault();
        
        const form = event.target;
        const email = form.querySelector('input[type="email"]').value;
        
        if (!validateEmail(email)) {
            showToast('يرجى إدخال بريد إلكتروني صحيح', 'error');
            return;
        }
        
        try {
            const response = await fetch(`${config.apiUrl}/newsletter/subscribe`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            
            const data = await response.json();
            
            if (data.success) {
                showToast('تم الاشتراك بنجاح! شكراً لك', 'success');
                form.reset();
            } else {
                showToast(data.message || 'حدث خطأ أثناء الاشتراك', 'error');
            }
        } catch (error) {
            showToast('تعذر الاتصال بالخادم', 'error');
        }
    }

    /**
     * التعامل مع اتصال الشبكة
     * @method handleOnline
     */
    function handleOnline() {
        state.isOnline = true;
        updateNetworkStatus();
        showToast('تم استعادة الاتصال بالإنترنت', 'success');
        
        // محاولة مزامنة البيانات
        syncOfflineData();
    }

    /**
     * التعامل مع انقطاع الشبكة
     * @method handleOffline
     */
    function handleOffline() {
        state.isOnline = false;
        updateNetworkStatus();
        showToast('فقد الاتصال بالإنترنت', 'warning');
    }

    /**
     * التعامل مع إغلاق الصفحة
     * @method handleBeforeUnload
     */
    function handleBeforeUnload(event) {
        if (state.isLoading) {
            event.preventDefault();
            event.returnValue = 'هناك عملية تحميل قيد التنفيذ. هل تريد المغادرة؟';
        }
    }

    /**
     * التعامل مع جاهزية DOM
     * @method handleDOMReady
     */
    function handleDOMReady() {
        // إضافة فئات التحميل
        document.body.classList.add('dom-ready');
        
        // إخفاء شاشة التحميل بعد تأخير بسيط
        setTimeout(() => {
            if (elements.loadingScreen) {
                elements.loadingScreen.style.opacity = '0';
                setTimeout(() => {
                    elements.loadingScreen.style.display = 'none';
                }, 500);
            }
        }, 1000);
    }

    /**
     * إعداد التحريك
     * @method setupAnimations
     */
    function setupAnimations() {
        // إضافة فئات التحريك للعناصر
        const animatedElements = document.querySelectorAll('.animate-on-scroll');
        animatedElements.forEach(el => {
            el.classList.add('animated-element');
        });
    }

    /**
     * إعداد Intersection Observer
     * @method setupIntersectionObserver
     */
    function setupIntersectionObserver() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('in-view');
                    
                    // تحميل الصور بشكل كسول
                    if (entry.target.hasAttribute('data-src')) {
                        entry.target.src = entry.target.getAttribute('data-src');
                        entry.target.removeAttribute('data-src');
                    }
                }
            });
        }, {
            threshold: 0.1,
            rootMargin: '50px'
        });
        
        // مراقبة العناصر
        document.querySelectorAll('.lazy-load').forEach(el => observer.observe(el));
        document.querySelectorAll('.animated-element').forEach(el => observer.observe(el));
    }

    /**
     * تحريك العناصر عند التمرير
     * @method animateOnScroll
     */
    function animateOnScroll() {
        const animatedElements = document.querySelectorAll('.animated-element:not(.animated)');
        
        animatedElements.forEach(element => {
            const elementTop = element.getBoundingClientRect().top;
            const windowHeight = window.innerHeight;
            
            if (elementTop < windowHeight - 100) {
                element.classList.add('animated');
                
                // تحريك محدد حسب نوع العنصر
                if (element.classList.contains('counter')) {
                    const target = parseInt(element.getAttribute('data-target'));
                    animateCounter(element, target);
                }
            }
        });
    }

    /**
     * التمرير للأعلى
     * @method scrollToTop
     */
    function scrollToTop() {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    }

    /**
     * التمرير لعنصر
     * @method scrollToElement
     */
    function scrollToElement(elementId) {
        const element = document.getElementById(elementId);
        if (element) {
            const offset = 80; // تعويض شريط التنقل
            const elementPosition = element.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - offset;
            
            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });
        }
    }

    /**
     * تحديث التنقل النشط
     * @method updateActiveNav
     */
    function updateActiveNav() {
        const currentPath = window.location.pathname;
        const navLinks = document.querySelectorAll('.nav-link');
        
        navLinks.forEach(link => {
            link.classList.remove('active');
            
            const linkPath = link.getAttribute('href');
            if (currentPath.includes(linkPath) || 
                (currentPath === '/' && linkPath === 'index.html')) {
                link.classList.add('active');
            }
        });
    }

    /**
     * عرض شاشة التحميل
     * @method showLoading
     */
    function showLoading() {
        if (elements.loadingScreen) {
            elements.loadingScreen.style.display = 'flex';
            elements.loadingScreen.style.opacity = '1';
        }
    }

    /**
     * إخفاء شاشة التحميل
     * @method hideLoading
     */
    function hideLoading() {
        if (elements.loadingScreen) {
            elements.loadingScreen.style.opacity = '0';
            setTimeout(() => {
                elements.loadingScreen.style.display = 'none';
            }, 500);
        }
    }

    /**
     * عرض رسالة
     * @method showToast
     */
    function showToast(message, type = 'info') {
        // إزالة أي رسائل سابقة
        const existingToasts = document.querySelectorAll('.toast-message');
        existingToasts.forEach(toast => toast.remove());
        
        // إنشاء الرسالة الجديدة
        const toast = document.createElement('div');
        toast.className = `toast-message toast-${type}`;
        toast.innerHTML = `
            <div class="toast-content">
                <i class="fas fa-${getToastIcon(type)}"></i>
                <span>${message}</span>
            </div>
            <button class="toast-close">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        document.body.appendChild(toast);
        
        // إظهار الرسالة
        setTimeout(() => toast.classList.add('show'), 10);
        
        // إغلاق الرسالة تلقائياً
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 5000);
        
        // إغلاق الرسالة يدوياً
        toast.querySelector('.toast-close').addEventListener('click', () => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        });
    }

    /**
     * مزامنة البيانات المحلية
     * @method syncOfflineData
     */
    async function syncOfflineData() {
        const offlineData = getOfflineData();
        
        if (offlineData.length > 0) {
            showToast('جاري مزامنة البيانات...', 'info');
            
            try {
                const response = await fetch(`${config.apiUrl}/sync`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ data: offlineData })
                });
                
                if (response.ok) {
                    clearOfflineData();
                    showToast('تمت مزامنة البيانات بنجاح', 'success');
                }
            } catch (error) {
                console.error('❌ فشل مزامنة البيانات:', error);
            }
        }
    }

    /**
     * حفظ البيانات مؤقتاً
     * @method cacheData
     */
    function cacheData(key, data) {
        try {
            localStorage.setItem(`hadhramaut_${key}`, JSON.stringify(data));
        } catch (error) {
            console.warn('⚠️ فشل حفظ البيانات:', error);
        }
    }

    /**
     * الحصول على البيانات المحفوظة
     * @method getCachedData
     */
    function getCachedData(key) {
        try {
            const data = localStorage.getItem(`hadhramaut_${key}`);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            return null;
        }
    }

    /**
     * حفظ بيانات عدم الاتصال
     * @method saveOfflineData
     */
    function saveOfflineData(type, data) {
        try {
            const offlineData = getOfflineData();
            offlineData.push({ type, data, timestamp: new Date().toISOString() });
            localStorage.setItem('hadhramaut_offline', JSON.stringify(offlineData));
        } catch (error) {
            console.warn('⚠️ فشل حفظ بيانات عدم الاتصال:', error);
        }
    }

    /**
     * الحصول على بيانات عدم الاتصال
     * @method getOfflineData
     */
    function getOfflineData() {
        try {
            const data = localStorage.getItem('hadhramaut_offline');
            return data ? JSON.parse(data) : [];
        } catch (error) {
            return [];
        }
    }

    /**
     * مسح بيانات عدم الاتصال
     * @method clearOfflineData
     */
    function clearOfflineData() {
        localStorage.removeItem('hadhramaut_offline');
    }

    /**
     * تتبع الأحداث
     * @method trackEvent
     */
    function trackEvent(eventName, data = {}) {
        if (typeof gtag !== 'undefined') {
            gtag('event', eventName, data);
        }
        
        // حفظ محلياً للتحليل
        const analyticsData = {
            event: eventName,
            data: data,
            timestamp: new Date().toISOString(),
            page: window.location.pathname,
            userAgent: navigator.userAgent
        };
        
        saveAnalyticsEvent(analyticsData);
    }

    /**
     * حفظ حدث التحليل
     * @method saveAnalyticsEvent
     */
    function saveAnalyticsEvent(eventData) {
        try {
            const events = JSON.parse(localStorage.getItem('hadhramaut_analytics') || '[]');
            events.push(eventData);
            localStorage.setItem('hadhramaut_analytics', JSON.stringify(events));
        } catch (error) {
            console.warn('⚠️ فشل حفظ حدث التحليل:', error);
        }
    }

    /**
     * التحقق من صحة البريد الإلكتروني
     * @method validateEmail
     */
    function validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }

    /**
     * الحصول على اسم الفئة
     * @method getCategoryName
     */
    function getCategoryName(categoryId) {
        const categories = {
            'social': 'اجتماعي',
            'economic': 'اقتصادي',
            'political': 'سياسي',
            'cultural': 'ثقافي',
            'educational': 'تعليمي',
            'environmental': 'بيئي'
        };
        
        return categories[categoryId] || 'عام';
    }

    /**
     * الحصول على الوقت المتبقي
     * @method getTimeRemaining
     */
    function getTimeRemaining(endDate) {
        const now = new Date();
        const end = new Date(endDate);
        const diff = end - now;
        
        if (diff <= 0) return 'منتهي';
        
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        
        if (days > 0) return `${days} يوم`;
        if (hours > 0) return `${hours} ساعة`;
        return 'أقل من ساعة';
    }

    /**
     * تنسيق التاريخ
     * @method formatDate
     */
    function formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('ar-SA', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    /**
     * الحصول على أيقونة الرسالة
     * @method getToastIcon
     */
    function getToastIcon(type) {
        const icons = {
            'success': 'check-circle',
            'error': 'exclamation-circle',
            'warning': 'exclamation-triangle',
            'info': 'info-circle'
        };
        
        return icons[type] || 'info-circle';
    }

    // الواجهة العامة
    return {
        init: init,
        state: state,
        config: config,
        
        // طرق مساعدة عامة
        showToast: showToast,
        trackEvent: trackEvent,
        validateEmail: validateEmail,
        
        // طرق البيانات
        loadSurveys: loadSurveys,
        loadResults: loadResults,
        cacheData: cacheData,
        getCachedData: getCachedData
    };
})();

/**
 * مدير الاستبيانات
 * @namespace SurveyManager
 */
const SurveyManager = (function() {
    'use strict';
    
    // التخزين المؤقت
    let surveysCache = null;
    
    /**
     * تحميل الاستبيانات النشطة
     * @method loadActiveSurveys
     */
    async function loadActiveSurveys() {
        try {
            // التحقق من التخزين المؤقت أولاً
            const cached = App.getCachedData('surveys');
            if (cached && cached.length > 0) {
                surveysCache = cached;
                renderSurveys(cached);
            }
            
            // تحميل من API
            const response = await fetch(`${App.config.apiUrl}/surveys/active`);
            const data = await response.json();
            
            if (data.success) {
                surveysCache = data.data;
                App.cacheData('surveys', data.data);
                renderSurveys(data.data);
            }
        } catch (error) {
            console.warn('⚠️ فشل تحميل الاستبيانات:', error);
            // استخدام بيانات وهمية للعرض
            renderMockSurveys();
        }
    }
    
    /**
     * عرض الاستبيانات
     * @method renderSurveys
     */
    function renderSurveys(surveys) {
        const container = document.getElementById('activeSurveys');
        if (!container) return;
        
        const limitedSurveys = surveys.slice(0, App.config.maxSurveys);
        const surveysHTML = limitedSurveys.map(createSurveyCard).join('');
        
        container.innerHTML = surveysHTML;
        setupSurveyInteractions();
    }
    
    /**
     * إنشاء بطاقة استبيان
     * @method createSurveyCard
     */
    function createSurveyCard(survey) {
        return `
            <div class="col-lg-4 col-md-6 mb-4">
                <div class="survey-card" data-id="${survey.id}">
                    <div class="survey-header">
                        <h4>${survey.title}</h4>
                        <span class="survey-category">${survey.category}</span>
                    </div>
                    <div class="survey-body">
                        <p class="survey-description">${survey.description}</p>
                        
                        <div class="survey-stats">
                            <span><i class="fas fa-users"></i> ${survey.participants} مشارك</span>
                            <span><i class="far fa-clock"></i> ${survey.duration}</span>
                        </div>
                        
                        <div class="survey-progress">
                            <div class="progress-bar">
                                <div class="progress-fill" style="width: ${survey.progress}%"></div>
                            </div>
                            <small>تم إكمال ${survey.progress}%</small>
                        </div>
                        
                        <button class="btn btn-primary w-100 start-survey" data-id="${survey.id}">
                            <i class="fas fa-pen"></i> ابدأ الاستبيان
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * إعداد تفاعلات الاستبيانات
     * @method setupSurveyInteractions
     */
    function setupSurveyInteractions() {
        document.querySelectorAll('.start-survey').forEach(button => {
            button.addEventListener('click', handleSurveyStart);
        });
    }
    
    /**
     * التعامل مع بدء الاستبيان
     * @method handleSurveyStart
     */
    function handleSurveyStart(event) {
        const surveyId = event.target.getAttribute('data-id');
        const survey = surveysCache?.find(s => s.id === surveyId);
        
        if (survey) {
            App.trackEvent('survey_started', { survey_id: surveyId });
            
            // التحقق إذا كان المستخدم مسجلاً
            if (App.state.user) {
                window.location.href = `pages/survey.html?id=${surveyId}`;
            } else {
                // توجيه لتسجيل الدخول
                App.showToast('يرجى تسجيل الدخول للمشاركة في الاستبيان', 'info');
                setTimeout(() => {
                    window.location.href = 'pages/dashboard/login.html?redirect=survey_' + surveyId;
                }, 1500);
            }
        }
    }
    
    /**
     * عرض استبيانات وهمية
     * @method renderMockSurveys
     */
    function renderMockSurveys() {
        const mockSurveys = [
            {
                id: '1',
                title: 'جودة الخدمات الصحية في حضرموت',
                category: 'صحي',
                description: 'استبيان لتقييم جودة الخدمات الصحية المقدمة في المستشفيات والمراكز الصحية',
                participants: 1250,
                duration: '5 أيام متبقية',
                progress: 65
            },
            {
                id: '2',
                title: 'تحديات سوق العمل للشباب',
                category: 'اقتصادي',
                description: 'دراسة تحديات توظيف الشباب الحضرمي والفرص المتاحة',
                participants: 890,
                duration: '3 أيام متبقية',
                progress: 42
            },
            {
                id: '3',
                title: 'الحفاظ على التراث الحضرمي',
                category: 'ثقافي',
                description: 'استطلاع حول سبل الحفاظ على التراث الثقافي الحضرمي',
                participants: 1560,
                duration: '7 أيام متبقية',
                progress: 78
            }
        ];
        
        renderSurveys(mockSurveys);
    }
    
    // الواجهة العامة
    return {
        loadActiveSurveys: loadActiveSurveys,
        renderSurveys: renderSurveys
    };
})();

/**
 * مدير النتائج
 * @namespace ResultsManager
 */
const ResultsManager = (function() {
    'use strict';
    
    /**
     * تحميل النتائج الحديثة
     * @method loadRecentResults
     */
    async function loadRecentResults() {
        try {
            const response = await fetch(`${App.config.apiUrl}/results/recent`);
            const data = await response.json();
            
            if (data.success) {
                renderResults(data.data.slice(0, App.config.maxResults));
                App.cacheData('results', data.data);
            }
        } catch (error) {
            console.warn('⚠️ فشل تحميل النتائج:', error);
            renderMockResults();
        }
    }
    
    /**
     * عرض النتائج
     * @method renderResults
     */
    function renderResults(results) {
        const container = document.getElementById('recentResults');
        if (!container) return;
        
        const resultsHTML = results.map(createResultCard).join('');
        container.innerHTML = resultsHTML;
        setupResultInteractions();
    }
    
    /**
     * إنشاء بطاقة نتيجة
     * @method createResultCard
     */
    function createResultCard(result) {
        return `
            <div class="col-md-4 mb-4">
                <div class="result-card" data-id="${result.id}">
                    <div class="result-image">
                        <i class="fas fa-chart-${getChartIcon(result.type)}"></i>
                    </div>
                    <div class="result-content">
                        <h4>${result.title}</h4>
                        <p>${result.summary}</p>
                        
                        <div class="result-meta">
                            <span><i class="far fa-calendar"></i> ${result.date}</span>
                            <span><i class="fas fa-chart-bar"></i> ${result.views} مشاهدة</span>
                        </div>
                        
                        <a href="pages/result.html?id=${result.id}" class="btn btn-outline-primary w-100 mt-3">
                            <i class="fas fa-eye"></i> عرض التقرير
                        </a>
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * إعداد تفاعلات النتائج
     * @method setupResultInteractions
     */
    function setupResultInteractions() {
        document.querySelectorAll('.result-card').forEach(card => {
            card.addEventListener('click', handleResultClick);
        });
    }
    
    /**
     * التعامل مع النقر على النتيجة
     * @method handleResultClick
     */
    function handleResultClick(event) {
        const card = event.currentTarget;
        const resultId = card.getAttribute('data-id');
        
        App.trackEvent('result_viewed', { result_id: resultId });
    }
    
    /**
     * الحصول على أيقونة الرسم البياني
     * @method getChartIcon
     */
    function getChartIcon(type) {
        const icons = {
            'bar': 'bar-chart',
            'pie': 'pie-chart',
            'line': 'line-chart',
            'doughnut': 'chart-pie'
        };
        
        return icons[type] || 'chart-bar';
    }
    
    /**
     * عرض نتائج وهمية
     * @method renderMockResults
     */
    function renderMockResults() {
        const mockResults = [
            {
                id: '1',
                title: 'تقرير جودة التعليم 2024',
                summary: 'تحليل شامل لواقع التعليم في محافظات حضرموت',
                date: 'يناير 2024',
                views: 2450,
                type: 'bar'
            },
            {
                id: '2',
                title: 'استطلاع الرأي السياسي',
                summary: 'اتجاهات الرأي العام حول القضايا السياسية',
                date: 'ديسمبر 2023',
                views: 3120,
                type: 'pie'
            },
            {
                id: '3',
                title: 'دراسة البنية التحتية',
                summary: 'تقييم حالة الطرق والخدمات الأساسية',
                date: 'نوفمبر 2023',
                views: 1890,
                type: 'line'
            }
        ];
        
        renderResults(mockResults);
    }
    
    // الواجهة العامة
    return {
        loadRecentResults: loadRecentResults,
        renderResults: renderResults
    };
})();

/**
 * مدير الرسوم البيانية
 * @namespace ChartManager
 */
const ChartManager = (function() {
    'use strict';
    
    let charts = {};
    
    /**
     * تهيئة مخطط المشاعر
     * @method initSentimentChart
     */
    function initSentimentChart() {
        const ctx = document.getElementById('sentimentChart');
        if (!ctx) return;
        
        charts.sentiment = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['إيجابي', 'محايد', 'سلبي'],
                datasets: [{
                    data: [65, 25, 10],
                    backgroundColor: [
                        '#48bb78', // أخضر
                        '#4299e1', // أزرق
                        '#f56565'  // أحمر
                    ],
                    borderWidth: 2,
                    borderColor: 'rgba(255, 255, 255, 0.2)'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        rtl: true,
                        labels: {
                            color: '#ffffff',
                            font: {
                                family: 'Cairo',
                                size: 14
                            },
                            padding: 20
                        }
                    },
                    tooltip: {
                        rtl: true,
                        titleFont: {
                            family: 'Cairo'
                        },
                        bodyFont: {
                            family: 'Cairo'
                        }
                    }
                }
            }
        });
    }
    
    /**
     * تهيئة المخطط العائم
     * @method initFloatingChart
     */
    function initFloatingChart() {
        const container = document.getElementById('floatingChart');
        if (!container) return;
        
        // إنشاء عنصر canvas للمخطط
        const canvas = document.createElement('canvas');
        container.appendChild(canvas);
        
        charts.floating = new Chart(canvas, {
            type: 'line',
            data: {
                labels: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو'],
                datasets: [{
                    label: 'معدل المشاركة',
                    data: [65, 59, 80, 81, 56, 72],
                    borderColor: '#ffc107',
                    backgroundColor: 'rgba(255, 193, 7, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        enabled: false
                    }
                },
                scales: {
                    x: {
                        display: false
                    },
                    y: {
                        display: false
                    }
                },
                interaction: {
                    intersect: false
                }
            }
        });
    }
    
    /**
     * تحديث المخططات
     * @method updateCharts
     */
    function updateCharts(data) {
        if (charts.sentiment && data.sentiment) {
            charts.sentiment.data.datasets[0].data = data.sentiment;
            charts.sentiment.update();
        }
    }
    
    /**
     * تدمير المخططات
     * @method destroyCharts
     */
    function destroyCharts() {
        Object.values(charts).forEach(chart => {
            if (chart) chart.destroy();
        });
        charts = {};
    }
    
    // الواجهة العامة
    return {
        initSentimentChart: initSentimentChart,
        initFloatingChart: initFloatingChart,
        updateCharts: updateCharts,
        destroyCharts: destroyCharts,
        charts: charts
    };
})();

/**
 * مكتبة المساعدة
 * @namespace Utils
 */
const Utils = (function() {
    'use strict';
    
    /**
     * تنسيق الأرقام
     * @method formatNumber
     */
    function formatNumber(num) {
        return new Intl.NumberFormat('ar-SA').format(num);
    }
    
    /**
     * تنسيق التاريخ العربي
     * @method formatArabicDate
     */
    function formatArabicDate(date) {
        const options = {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            timeZone: 'Asia/Riyadh'
        };
        
        return date.toLocaleDateString('ar-SA', options);
    }
    
    /**
     * تقصير النص
     * @method truncateText
     */
    function truncateText(text, maxLength = 100) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }
    
    /**
     * توليد معرف فريد
     * @method generateId
     */
    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
    
    /**
     * تأخير
     * @method delay
     */
    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * التحقق من دعم المتصفح
     * @method checkBrowserSupport
     */
    function checkBrowserSupport() {
        const features = {
            'serviceWorker': 'serviceWorker' in navigator,
            'fetch': 'fetch' in window,
            'promises': 'Promise' in window,
            'intersectionObserver': 'IntersectionObserver' in window
        };
        
        const unsupported = Object.entries(features)
            .filter(([_, supported]) => !supported)
            .map(([feature]) => feature);
        
        if (unsupported.length > 0) {
            console.warn('⚠️ الميزات غير المدعومة:', unsupported);
            return false;
        }
        
        return true;
    }
    
    /**
     * نسخ النص للحافظة
     * @method copyToClipboard
     */
    async function copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (error) {
            console.warn('⚠️ فشل النسخ للحافظة:', error);
            
            // طريقة بديلة
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            
            return true;
        }
    }
    
    /**
     * الحصول على بارامترات URL
     * @method getUrlParams
     */
    function getUrlParams() {
        const params = {};
        const queryString = window.location.search.substring(1);
        const pairs = queryString.split('&');
        
        pairs.forEach(pair => {
            const [key, value] = pair.split('=');
            if (key) {
                params[decodeURIComponent(key)] = decodeURIComponent(value || '');
            }
        });
        
        return params;
    }
    
    /**
     * قياس أداء الصفحة
     * @method measurePerformance
     */
    function measurePerformance() {
        if ('performance' in window) {
            const timing = performance.timing;
            const loadTime = timing.loadEventEnd - timing.navigationStart;
            const domReadyTime = timing.domContentLoadedEventEnd - timing.navigationStart;
            
            return {
                loadTime,
                domReadyTime,
                pageLoadTime: loadTime - domReadyTime
            };
        }
        return null;
    }
    
    // الواجهة العامة
    return {
        formatNumber,
        formatArabicDate,
        truncateText,
        generateId,
        delay,
        checkBrowserSupport,
        copyToClipboard,
        getUrlParams,
        measurePerformance
    };
})();

/**
 * تهيئة التطبيق عند تحميل الصفحة
 */
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        App.init();
    });
} else {
    App.init();
}

/**
 * الكشف عن المتصفحات القديمة
 */
if (!Utils.checkBrowserSupport()) {
    document.addEventListener('DOMContentLoaded', () => {
        const warning = document.createElement('div');
        warning.className = 'browser-warning';
        warning.innerHTML = `
            <div class="warning-content">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>تنبيه!</h3>
                <p>متصفحك قديم وقد لا يدعم جميع ميزات الموقع. ننصحك بتحديث متصفحك.</p>
                <button class="btn btn-sm btn-primary" onclick="this.parentElement.parentElement.remove()">
                    فهمت
                </button>
            </div>
        `;
        document.body.appendChild(warning);
    });
}

/**
 * تصدير الكائنات للاستخدام العام
 */
window.App = App;
window.SurveyManager = SurveyManager;
window.ResultsManager = ResultsManager;
window.ChartManager = ChartManager;
window.Utils = Utils;

// تصدير افتراضي
export { App, SurveyManager, ResultsManager, ChartManager, Utils };
```
