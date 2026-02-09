```javascript
/* ============================================
   صوت حضرموت - نظام التحليلات والإحصاءات
   ============================================ */

/**
 * نظام التحليلات والإحصاءات
 * @namespace AnalyticsSystem
 */
const AnalyticsSystem = (function() {
    'use strict';

    // التكوين
    const config = {
        // إعدادات التتبع
        trackingEnabled: true,
        anonymizeIP: true,
        respectDNT: true, // احترام تفضيلات "عدم التتبع"
        
        // مسارات API
        endpoints: {
            track: '/analytics/track',
            pageview: '/analytics/pageview',
            event: '/analytics/event',
            survey: '/analytics/survey',
            user: '/analytics/user',
            export: '/analytics/export'
        },
        
        // إعدادات التخزين
        storageKey: 'hadhramaut_analytics',
        maxQueueSize: 100,
        flushInterval: 30000, // 30 ثانية
        sessionTimeout: 30 * 60 * 1000, // 30 دقيقة
        
        // تصنيفات الأحداث
        eventCategories: {
            SURVEY: 'survey',
            USER: 'user',
            SYSTEM: 'system',
            ERROR: 'error',
            PERFORMANCE: 'performance'
        },
        
        // أنواع الأحداث
        eventTypes: {
            VIEW: 'view',
            CLICK: 'click',
            SUBMIT: 'submit',
            COMPLETE: 'complete',
            ERROR: 'error',
            DOWNLOAD: 'download',
            SHARE: 'share'
        }
    };

    // الحالة
    const state = {
        sessionId: null,
        userId: null,
        pageStartTime: null,
        currentPage: null,
        previousPage: null,
        eventQueue: [],
        isFlushing: false,
        sessionStartTime: null,
        pageViewCount: 0,
        surveyInteractions: {}
    };

    /**
     * تهيئة نظام التحليلات
     * @method init
     */
    function init() {
        if (!config.trackingEnabled) {
            console.log('📊 التحليلات معطلة');
            return;
        }

        // التحقق من تفضيلات المستخدم
        if (config.respectDNT && navigator.doNotTrack === '1') {
            console.log('📊 تحليلات DNT محترمة');
            config.trackingEnabled = false;
            return;
        }

        // تهيئة الجلسة
        initializeSession();
        
        // تتبع عرض الصفحة
        trackPageView();
        
        // إعداد مراقبة الأحداث
        setupEventListeners();
        
        // إعداد الفلاش التلقائي
        setupAutoFlush();
        
        // مراقبة الأداء
        trackPerformance();
        
        console.log('📊 نظام التحليلات جاهز');
    }

    /**
     * تهيئة الجلسة
     * @method initializeSession
     */
    function initializeSession() {
        // التحقق من وجود جلسة نشطة
        const savedSession = getStoredSession();
        const now = Date.now();
        
        if (savedSession && now - savedSession.timestamp < config.sessionTimeout) {
            state.sessionId = savedSession.sessionId;
            state.userId = savedSession.userId;
            state.sessionStartTime = savedSession.sessionStartTime;
            state.pageViewCount = savedSession.pageViewCount || 0;
        } else {
            // إنشاء جلسة جديدة
            state.sessionId = generateSessionId();
            state.sessionStartTime = now;
            state.pageViewCount = 0;
            
            // الحصول على معرف المستخدم إذا كان مسجلاً
            const user = AuthenticationSystem.getCurrentUser();
            state.userId = user ? user.id : generateAnonymousId();
        }
        
        // حفظ الجلسة
        saveSession();
    }

    /**
     * تتبع عرض الصفحة
     * @method trackPageView
     */
    function trackPageView() {
        const pageUrl = window.location.pathname + window.location.search;
        const pageTitle = document.title;
        
        state.previousPage = state.currentPage;
        state.currentPage = pageUrl;
        state.pageStartTime = Date.now();
        state.pageViewCount++;
        
        const pageViewData = {
            sessionId: state.sessionId,
            userId: state.userId,
            pageUrl: pageUrl,
            pageTitle: pageTitle,
            referrer: document.referrer || null,
            previousPage: state.previousPage,
            pageViewNumber: state.pageViewCount,
            timestamp: new Date().toISOString(),
            deviceInfo: getDeviceInfo(),
            connectionInfo: getConnectionInfo()
        };
        
        // تتبع وقت تحميل الصفحة
        if (window.performance && window.performance.timing) {
            const timing = window.performance.timing;
            pageViewData.loadTime = timing.loadEventEnd - timing.navigationStart;
            pageViewData.domReadyTime = timing.domContentLoadedEventEnd - timing.navigationStart;
        }
        
        // إضافة للطابور
        addToQueue({
            type: 'pageview',
            category: config.eventCategories.SYSTEM,
            action: 'page_view',
            data: pageViewData
        });
        
        // تحديث الجلسة
        saveSession();
        
        console.log('📄 تتبع عرض الصفحة:', pageUrl);
    }

    /**
     * إعداد مراقبة الأحداث
     * @method setupEventListeners
     */
    function setupEventListeners() {
        // تتبع نقرات الروابط
        document.addEventListener('click', trackLinkClicks, true);
        
        // تتبع أحداث النماذج
        document.addEventListener('submit', trackFormSubmissions, true);
        
        // تتبع التمرير
        let scrollTimeout;
        window.addEventListener('scroll', () => {
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(trackScrollDepth, 100);
        });
        
        // تتبع تغيير حجم النافذة
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(trackViewportChange, 100);
        });
        
        // تتبع خروج المستخدم
        document.addEventListener('visibilitychange', trackVisibilityChange);
        
        // تتبع الأخطاء
        window.addEventListener('error', trackError);
        window.addEventListener('unhandledrejection', trackPromiseRejection);
    }

    /**
     * تتبع نقرات الروابط
     * @method trackLinkClicks
     */
    function trackLinkClicks(event) {
        const target = event.target.closest('a');
        if (!target) return;
        
        const linkData = {
            href: target.href,
            text: target.textContent.trim(),
            className: target.className,
            id: target.id,
            target: target.target,
            position: getElementPosition(target),
            timestamp: new Date().toISOString()
        };
        
        addToQueue({
            type: 'event',
            category: config.eventCategories.USER,
            action: config.eventTypes.CLICK,
            label: 'link_click',
            data: linkData
        });
    }

    /**
     * تتبع إرسال النماذج
     * @method trackFormSubmissions
     */
    function trackFormSubmissions(event) {
        const form = event.target;
        const formData = {
            id: form.id,
            className: form.className,
            action: form.action,
            method: form.method,
            fields: getFormFields(form),
            timestamp: new Date().toISOString()
        };
        
        addToQueue({
            type: 'event',
            category: config.eventCategories.USER,
            action: config.eventTypes.SUBMIT,
            label: 'form_submit',
            data: formData
        });
    }

    /**
     * تتبع عمق التمرير
     * @method trackScrollDepth
     */
    function trackScrollDepth() {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const windowHeight = window.innerHeight || document.documentElement.clientHeight;
        const documentHeight = document.documentElement.scrollHeight;
        
        const scrollPercentage = Math.round((scrollTop + windowHeight) / documentHeight * 100);
        
        // تتبع عند نقاط محددة
        const milestones = [25, 50, 75, 90, 100];
        if (milestones.includes(scrollPercentage)) {
            addToQueue({
                type: 'event',
                category: config.eventCategories.USER,
                action: 'scroll',
                label: `scroll_depth_${scrollPercentage}`,
                data: {
                    percentage: scrollPercentage,
                    scrollTop: scrollTop,
                    windowHeight: windowHeight,
                    documentHeight: documentHeight,
                    timestamp: new Date().toISOString()
                }
            });
        }
    }

    /**
     * تتبع تغيير حجم العرض
     * @method trackViewportChange
     */
    function trackViewportChange() {
        addToQueue({
            type: 'event',
            category: config.eventCategories.SYSTEM,
            action: 'viewport_change',
            label: 'viewport_resize',
            data: {
                width: window.innerWidth,
                height: window.innerHeight,
                devicePixelRatio: window.devicePixelRatio,
                timestamp: new Date().toISOString()
            }
        });
    }

    /**
     * تتبع تغيير الرؤية
     * @method trackVisibilityChange
     */
    function trackVisibilityChange() {
        const isHidden = document.hidden;
        const visibilityData = {
            hidden: isHidden,
            visibilityState: document.visibilityState,
            timeOnPage: Date.now() - state.pageStartTime,
            timestamp: new Date().toISOString()
        };
        
        addToQueue({
            type: 'event',
            category: config.eventCategories.USER,
            action: isHidden ? 'page_hide' : 'page_show',
            label: 'visibility_change',
            data: visibilityData
        });
    }

    /**
     * تتبع الأخطاء
     * @method trackError
     */
    function trackError(event) {
        const errorData = {
            message: event.message,
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno,
            error: event.error ? event.error.toString() : null,
            timestamp: new Date().toISOString()
        };
        
        addToQueue({
            type: 'event',
            category: config.eventCategories.ERROR,
            action: config.eventTypes.ERROR,
            label: 'javascript_error',
            data: errorData
        });
    }

    /**
     * تتبع رفض Promise
     * @method trackPromiseRejection
     */
    function trackPromiseRejection(event) {
        const rejectionData = {
            reason: event.reason ? event.reason.toString() : null,
            timestamp: new Date().toISOString()
        };
        
        addToQueue({
            type: 'event',
            category: config.eventCategories.ERROR,
            action: config.eventTypes.ERROR,
            label: 'promise_rejection',
            data: rejectionData
        });
    }

    /**
     * تتبع الأداء
     * @method trackPerformance
     */
    function trackPerformance() {
        if (!window.performance || !window.performance.timing) return;
        
        // تتبع عند تحميل الصفحة
        window.addEventListener('load', () => {
            setTimeout(() => {
                const timing = window.performance.timing;
                const perfData = {
                    navigationStart: timing.navigationStart,
                    domLoading: timing.domLoading,
                    domInteractive: timing.domInteractive,
                    domContentLoaded: timing.domContentLoadedEventEnd,
                    loadEventEnd: timing.loadEventEnd,
                    redirectTime: timing.redirectEnd - timing.redirectStart,
                    dnsTime: timing.domainLookupEnd - timing.domainLookupStart,
                    tcpTime: timing.connectEnd - timing.connectStart,
                    requestTime: timing.responseEnd - timing.requestStart,
                    domProcessingTime: timing.domComplete - timing.domLoading,
                    pageLoadTime: timing.loadEventEnd - timing.navigationStart,
                    timestamp: new Date().toISOString()
                };
                
                addToQueue({
                    type: 'event',
                    category: config.eventCategories.PERFORMANCE,
                    action: 'performance',
                    label: 'page_load',
                    data: perfData
                });
            }, 0);
        });
    }

    /**
     * تتبع الاستبيان
     * @method trackSurvey
     */
    function trackSurvey(surveyId, action, data = {}) {
        const surveyData = {
            surveyId: surveyId,
            action: action,
            userId: state.userId,
            sessionId: state.sessionId,
            timestamp: new Date().toISOString(),
            ...data
        };
        
        // تحديث تفاعلات الاستبيان
        if (!state.surveyInteractions[surveyId]) {
            state.surveyInteractions[surveyId] = {
                views: 0,
                starts: 0,
                completes: 0,
                lastInteraction: null
            };
        }
        
        switch (action) {
            case 'view':
                state.surveyInteractions[surveyId].views++;
                break;
            case 'start':
                state.surveyInteractions[surveyId].starts++;
                break;
            case 'complete':
                state.surveyInteractions[surveyId].completes++;
                break;
        }
        
        state.surveyInteractions[surveyId].lastInteraction = new Date().toISOString();
        
        addToQueue({
            type: 'survey',
            category: config.eventCategories.SURVEY,
            action: action,
            label: `survey_${action}`,
            data: surveyData
        });
        
        console.log(`📊 تتبع الاستبيان: ${surveyId} - ${action}`);
    }

    /**
     * تتبع حدث مخصص
     * @method trackEvent
     */
    function trackEvent(category, action, label = null, data = {}) {
        const eventData = {
            category: category,
            action: action,
            label: label,
            userId: state.userId,
            sessionId: state.sessionId,
            timestamp: new Date().toISOString(),
            pageUrl: state.currentPage,
            ...data
        };
        
        addToQueue({
            type: 'event',
            category: category,
            action: action,
            label: label,
            data: eventData
        });
        
        console.log(`📊 تتبع حدث: ${category}.${action}${label ? '.' + label : ''}`);
    }

    /**
     * إضافة حدث للطابور
     * @method addToQueue
     */
    function addToQueue(event) {
        if (!config.trackingEnabled) return;
        
        // التحقق من حجم الطابور
        if (state.eventQueue.length >= config.maxQueueSize) {
            console.warn('📊 طابور التحليلات ممتلئ، جاري الفلاش...');
            flushQueue();
        }
        
        // إضافة الحدث
        state.eventQueue.push(event);
        
        // حفظ محلياً
        saveQueue();
        
        // فلاش فوري للأحداث المهمة
        if (isCriticalEvent(event)) {
            flushQueue();
        }
    }

    /**
     * فلاش الطابور للخادم
     * @method flushQueue
     */
    async function flushQueue() {
        if (state.isFlushing || state.eventQueue.length === 0) return;
        
        state.isFlushing = true;
        
        try {
            const eventsToSend = [...state.eventQueue];
            state.eventQueue = [];
            
            // إرسال للخادم
            if (navigator.onLine) {
                const response = await ApiManager.request(config.endpoints.track, {
                    method: 'POST',
                    body: JSON.stringify({
                        sessionId: state.sessionId,
                        userId: state.userId,
                        events: eventsToSend
                    })
                });
                
                if (response.success) {
                    console.log(`📊 تم إرسال ${eventsToSend.length} حدث بنجاح`);
                    clearQueueStorage();
                } else {
                    // إعادة الأحداث للطابور في حالة الفشل
                    state.eventQueue = [...eventsToSend, ...state.eventQueue];
                    saveQueue();
                    console.warn('📊 فشل إرسال الأحداث، تم الاحتفاظ بها محلياً');
                }
            } else {
                // حفظ محلياً في حالة عدم الاتصال
                state.eventQueue = [...eventsToSend, ...state.eventQueue];
                saveQueue();
                console.log('📊 غير متصل، تم حفظ الأحداث محلياً');
            }
        } catch (error) {
            console.error('📊 خطأ في فلاش الطابور:', error);
            saveQueue(); // التأكد من حفظ الطابور
        } finally {
            state.isFlushing = false;
        }
    }

    /**
     * إعداد الفلاش التلقائي
     * @method setupAutoFlush
     */
    function setupAutoFlush() {
        setInterval(() => {
            if (state.eventQueue.length > 0) {
                flushQueue();
            }
        }, config.flushInterval);
        
        // فلاش عند مغادرة الصفحة
        window.addEventListener('beforeunload', () => {
            if (state.eventQueue.length > 0 && navigator.sendBeacon) {
                const data = JSON.stringify({
                    sessionId: state.sessionId,
                    userId: state.userId,
                    events: state.eventQueue
                });
                
                navigator.sendBeacon(`${config.baseUrl}${config.endpoints.track}`, data);
                clearQueueStorage();
            }
        });
    }

    /**
     * التحقق من حدث حرج
     * @method isCriticalEvent
     */
    function isCriticalEvent(event) {
        const criticalActions = [
            config.eventTypes.SUBMIT,
            config.eventTypes.COMPLETE,
            config.eventTypes.ERROR
        ];
        
        return criticalActions.includes(event.action) || 
               event.category === config.eventCategories.ERROR;
    }

    // ========== أدوات مساعدة ==========

    /**
     * توليد معرف الجلسة
     * @method generateSessionId
     */
    function generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * توليد معرف مجهول
     * @method generateAnonymousId
     */
    function generateAnonymousId() {
        // محاولة الحصول من localStorage
        let anonymousId = localStorage.getItem('hadhramaut_anonymous_id');
        
        if (!anonymousId) {
            anonymousId = 'anon_' + Math.random().toString(36).substr(2, 9) + 
                         '_' + Date.now().toString(36);
            localStorage.setItem('hadhramaut_anonymous_id', anonymousId);
        }
        
        return anonymousId;
    }

    /**
     * الحصول على معلومات الجهاز
     * @method getDeviceInfo
     */
    function getDeviceInfo() {
        return {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language,
            screenWidth: screen.width,
            screenHeight: screen.height,
            colorDepth: screen.colorDepth,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            cookiesEnabled: navigator.cookieEnabled,
            online: navigator.onLine
        };
    }

    /**
     * الحصول على معلومات الاتصال
     * @method getConnectionInfo
     */
    function getConnectionInfo() {
        const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        
        if (connection) {
            return {
                effectiveType: connection.effectiveType,
                downlink: connection.downlink,
                rtt: connection.rtt,
                saveData: connection.saveData
            };
        }
        
        return null;
    }

    /**
     * الحصول على موضع العنصر
     * @method getElementPosition
     */
    function getElementPosition(element) {
        const rect = element.getBoundingClientRect();
        return {
            x: Math.round(rect.left + window.pageXOffset),
            y: Math.round(rect.top + window.pageYOffset),
            width: Math.round(rect.width),
            height: Math.round(rect.height)
        };
    }

    /**
     * الحصول على حقول النموذج
     * @method getFormFields
     */
    function getFormFields(form) {
        const fields = [];
        const formElements = form.elements;
        
        for (let i = 0; i < formElements.length; i++) {
            const element = formElements[i];
            if (element.name && !element.disabled) {
                fields.push({
                    name: element.name,
                    type: element.type,
                    required: element.required
                });
            }
        }
        
        return fields;
    }

    // ========== إدارة التخزين ==========

    /**
     * حفظ الجلسة
     * @method saveSession
     */
    function saveSession() {
        const sessionData = {
            sessionId: state.sessionId,
            userId: state.userId,
            sessionStartTime: state.sessionStartTime,
            pageViewCount: state.pageViewCount,
            timestamp: Date.now()
        };
        
        localStorage.setItem('hadhramaut_analytics_session', JSON.stringify(sessionData));
    }

    /**
     * الحصول على الجلسة المحفوظة
     * @method getStoredSession
     */
    function getStoredSession() {
        try {
            const sessionJson = localStorage.getItem('hadhramaut_analytics_session');
            return sessionJson ? JSON.parse(sessionJson) : null;
        } catch (error) {
            return null;
        }
    }

    /**
     * حفظ الطابور
     * @method saveQueue
     */
    function saveQueue() {
        try {
            const queueData = {
                events: state.eventQueue,
                timestamp: Date.now()
            };
            
            localStorage.setItem(config.storageKey, JSON.stringify(queueData));
        } catch (error) {
            console.warn('📊 فشل حفظ طابور التحليلات:', error);
        }
    }

    /**
     * تحميل الطابور المحفوظ
     * @method loadQueue
     */
    function loadQueue() {
        try {
            const queueJson = localStorage.getItem(config.storageKey);
            if (queueJson) {
                const queueData = JSON.parse(queueJson);
                state.eventQueue = queueData.events || [];
                console.log(`📊 تم تحميل ${state.eventQueue.length} حدث من التخزين المحلي`);
            }
        } catch (error) {
            console.warn('📊 فشل تحميل طابور التحليلات:', error);
            state.eventQueue = [];
        }
    }

    /**
     * مسح تخزين الطابور
     * @method clearQueueStorage
     */
    function clearQueueStorage() {
        localStorage.removeItem(config.storageKey);
    }

    // ========== التقارير والإحصائيات ==========

    /**
     * الحصول على إحصائيات الاستبيان
     * @method getSurveyStats
     */
    async function getSurveyStats(surveyId, timeframe = '30d') {
        try {
            const response = await ApiManager.request(`${config.endpoints.survey}/${surveyId}/stats`, {
                method: 'GET',
                params: { timeframe }
            });
            
            return response.data || {};
        } catch (error) {
            console.error('📊 خطأ في الحصول على إحصائيات الاستبيان:', error);
            return getLocalSurveyStats(surveyId);
        }
    }

    /**
     * الحصول على إحصائيات الاستبيان المحلية
     * @method getLocalSurveyStats
     */
    function getLocalSurveyStats(surveyId) {
        const interactions = state.surveyInteractions[surveyId] || {
            views: 0,
            starts: 0,
            completes: 0,
            lastInteraction: null
        };
        
        return {
            views: interactions.views,
            starts: interactions.starts,
            completes: interactions.completes,
            completionRate: interactions.starts > 0 ? 
                (interactions.completes / interactions.starts * 100).toFixed(2) : 0,
            lastInteraction: interactions.lastInteraction
        };
    }

    /**
     * الحصول على إحصائيات المستخدم
     * @method getUserStats
     */
    async function getUserStats(userId = null) {
        const targetUserId = userId || state.userId;
        
        try {
            const response = await ApiManager.request(`${config.endpoints.user}/stats/${targetUserId}`);
            return response.data || {};
        } catch (error) {
            console.error('📊 خطأ في الحصول على إحصائيات المستخدم:', error);
            return {
                sessionCount: 1,
                totalPageViews: state.pageViewCount,
                surveysCompleted: Object.values(state.surveyInteractions)
                    .filter(interaction => interaction.completes > 0).length
            };
        }
    }

    /**
     * تصدير البيانات
     * @method exportData
     */
    async function exportData(format = 'json', filters = {}) {
        try {
            const response = await ApiManager.request(config.endpoints.export, {
                method: 'POST',
                body: JSON.stringify({ format, filters })
            });
            
            if (response.success && response.data) {
                // تنزيل الملف
                downloadFile(response.data, `analytics_export.${format}`);
                return true;
            }
        } catch (error) {
            console.error('📊 خطأ في تصدير البيانات:', error);
        }
        
        return false;
    }

    /**
     * تنزيل الملف
     * @method downloadFile
     */
    function downloadFile(content, filename) {
        const blob = new Blob([content], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * إنشاء لوحة تحكم التحليلات
     * @method createDashboard
     */
    function createDashboard(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        const dashboardHTML = `
            <div class="analytics-dashboard">
                <div class="dashboard-header">
                    <h3><i class="fas fa-chart-line me-2"></i>لوحة تحكم التحليلات</h3>
                    <div class="dashboard-controls">
                        <button class="btn btn-sm btn-outline-primary" onclick="AnalyticsSystem.refreshDashboard()">
                            <i class="fas fa-sync-alt"></i> تحديث
                        </button>
                        <button class="btn btn-sm btn-outline-secondary" onclick="AnalyticsSystem.exportData()">
                            <i class="fas fa-download"></i> تصدير
                        </button>
                    </div>
                </div>
                
                <div class="dashboard-stats row mt-3">
                    <div class="col-md-3">
                        <div class="stat-card">
                            <div class="stat-icon bg-primary">
                                <i class="fas fa-eye"></i>
                            </div>
                            <div class="stat-content">
                                <h4 id="totalViews">0</h4>
                                <p>إجمالي المشاهدات</p>
                            </div>
                        </div>
                    </div>
                    
                    <div class="col-md-3">
                        <div class="stat-card">
                            <div class="stat-icon bg-success">
                                <i class="fas fa-users"></i>
                            </div>
                            <div class="stat-content">
                                <h4 id="uniqueVisitors">0</h4>
                                <p>زائرين فريدين</p>
                            </div>
                        </div>
                    </div>
                    
                    <div class="col-md-3">
                        <div class="stat-card">
                            <div class="stat-icon bg-info">
                                <i class="fas fa-poll"></i>
                            </div>
                            <div class="stat-content">
                                <h4 id="surveysCompleted">0</h4>
                                <p>استبيانات مكتملة</p>
                            </div>
                        </div>
                    </div>
                    
                    <div class="col-md-3">
                        <div class="stat-card">
                            <div class="stat-icon bg-warning">
                                <i class="fas fa-clock"></i>
                            </div>
                            <div class="stat-content">
                                <h4 id="avgTimeOnSite">0</h4>
                                <p>متوسط الوقت (دقيقة)</p>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="row mt-4">
                    <div class="col-md-8">
                        <div class="chart-container">
                            <canvas id="analyticsChart"></canvas>
                        </div>
                    </div>
                    
                    <div class="col-md-4">
                        <div class="top-pages">
                            <h5>الصفحات الأكثر زيارة</h5>
                            <ul class="list-group" id="topPagesList">
                                <!-- سيتم ملؤه ديناميكياً -->
                            </ul>
                        </div>
                    </div>
                </div>
                
                <div class="row mt-4">
                    <div class="col-md-6">
                        <div class="device-stats">
                            <h5>أجهزة الزوار</h5>
                            <canvas id="deviceChart"></canvas>
                        </div>
                    </div>
                    
                    <div class="col-md-6">
                        <div class="survey-stats">
                            <h5>أداء الاستبيانات</h5>
                            <canvas id="surveyChart"></canvas>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        container.innerHTML = dashboardHTML;
        
        // تحميل البيانات وعرضها
        loadDashboardData();
    }

    /**
     * تحميل بيانات لوحة التحكم
     * @method loadDashboardData
     */
    async function loadDashboardData() {
        try {
            // تحميل البيانات من API
            const [stats, pages, devices, surveys] = await Promise.all([
                getDashboardStats(),
                getTopPages(),
                getDeviceStats(),
                getSurveyPerformance()
            ]);
            
            // تحديث الإحصائيات
            updateDashboardStats(stats);
            
            // تحديث القوائم
            updateTopPages(pages);
            
            // إنشاء الرسوم البيانية
            createAnalyticsChart(stats.trend);
            createDeviceChart(devices);
            createSurveyChart(surveys);
            
        } catch (error) {
            console.error('📊 خطأ في تحميل بيانات لوحة التحكم:', error);
            showErrorMessage('تعذر تحميل بيانات التحليلات');
        }
    }

    /**
     * تحديث لوحة التحكم
     * @method refreshDashboard
     */
    function refreshDashboard() {
        loadDashboardData();
        showSuccessMessage('تم تحديث البيانات');
    }

    // ========== أدوات التصور ==========

    /**
     * إنشاء رسم بياني للتحليلات
     * @method createAnalyticsChart
     */
    function createAnalyticsChart(trendData) {
        const ctx = document.getElementById('analyticsChart');
        if (!ctx) return;
        
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: trendData.labels || [],
                datasets: [{
                    label: 'المشاهدات',
                    data: trendData.views || [],
                    borderColor: '#1a5f7a',
                    backgroundColor: 'rgba(26, 95, 122, 0.1)',
                    tension: 0.4
                }, {
                    label: 'المستخدمون',
                    data: trendData.users || [],
                    borderColor: '#ffc107',
                    backgroundColor: 'rgba(255, 193, 7, 0.1)',
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'top',
                        rtl: true
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false
                        }
                    },
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }

    /**
     * إنشاء رسم بياني للأجهزة
     * @method createDeviceChart
     */
    function createDeviceChart(deviceData) {
        const ctx = document.getElementById('deviceChart');
        if (!ctx) return;
        
        new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: deviceData.labels || [],
                datasets: [{
                    data: deviceData.data || [],
                    backgroundColor: [
                        '#1a5f7a',
                        '#2d829e',
                        '#48bb78',
                        '#ed8936',
                        '#9f7aea'
                    ]
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                        rtl: true
                    }
                }
            }
        });
    }

    /**
     * إنشاء رسم بياني للاستبيانات
     * @method createSurveyChart
     */
    function createSurveyChart(surveyData) {
        const ctx = document.getElementById('surveyChart');
        if (!ctx) return;
        
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: surveyData.labels || [],
                datasets: [{
                    label: 'معدل الإكمال %',
                    data: surveyData.completionRates || [],
                    backgroundColor: '#48bb78'
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100
                    }
                }
            }
        });
    }

    // ========== رسائل النظام ==========

    /**
     * عرض رسالة نجاح
     * @method showSuccessMessage
     */
    function showSuccessMessage(message) {
        App.showToast(message, 'success');
    }

    /**
     * عرض رسالة خطأ
     * @method showErrorMessage
     */
    function showErrorMessage(message) {
        App.showToast(message, 'error');
    }

    // ========== واجهة التصدير ==========

    return {
        // التهيئة
        init,
        config,
        
        // التتبع
        trackPageView,
        trackSurvey,
        trackEvent,
        trackError,
        
        // التقارير
        getSurveyStats,
        getUserStats,
        exportData,
        
        // لوحة التحكم
        createDashboard,
        refreshDashboard,
        loadDashboardData,
        
        // إدارة البيانات
        flushQueue,
        loadQueue,
        
        // الحالة
        getState: () => ({ ...state }),
        getSessionId: () => state.sessionId,
        getUserId: () => state.userId
    };
})();

/**
 * تهيئة نظام التحليلات عند تحميل الصفحة
 */
document.addEventListener('DOMContentLoaded', () => {
    AnalyticsSystem.init();
});

/**
 * تحميل الطابور المحفوظ عند التحميل
 */
AnalyticsSystem.loadQueue();

/**
 * تصدير نظام التحليلات للاستخدام العام
 */
window.AnalyticsSystem = AnalyticsSystem;

// تصدير افتراضي
export default AnalyticsSystem;
```
