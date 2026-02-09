```javascript
/* ============================================
   صوت حضرموت - خدمات API والتواصل مع الخادم
   ============================================ */

/**
 * مدير خدمات API
 * @namespace ApiManager
 */
const ApiManager = (function() {
    'use strict';

    // التكوين
    const config = {
        baseUrl: 'https://api.voiceofhadhramaut.org/v1',
        endpoints: {
            surveys: '/surveys',
            results: '/results',
            users: '/users',
            auth: '/auth',
            analytics: '/analytics',
            newsletter: '/newsletter'
        },
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Accept-Language': 'ar'
        },
        timeout: 30000, // 30 ثانية
        retryAttempts: 3,
        cacheDuration: 5 * 60 * 1000 // 5 دقائق
    };

    // التخزين المؤقت
    const cache = new Map();
    const pendingRequests = new Map();

    /**
     * تهيئة خدمات API
     * @method init
     */
    function init() {
        setupInterceptors();
        setupCacheCleanup();
        console.log('✅ خدمات API جاهزة');
    }

    /**
     * إعداد المعترضات
     * @method setupInterceptors
     */
    function setupInterceptors() {
        // يمكن إضافة معترضات axios هنا إذا تم استخدام axios
    }

    /**
     * إعداد تنظيف الذاكرة المؤقتة
     * @method setupCacheCleanup
     */
    function setupCacheCleanup() {
        // تنظيف الذاكرة المؤقتة كل ساعة
        setInterval(() => {
            const now = Date.now();
            for (const [key, value] of cache.entries()) {
                if (now - value.timestamp > config.cacheDuration) {
                    cache.delete(key);
                }
            }
        }, 60 * 60 * 1000);
    }

    /**
     * الطلب العام
     * @method request
     */
    async function request(endpoint, options = {}) {
        const cacheKey = generateCacheKey(endpoint, options);
        const isCacheable = options.method === 'GET' && !options.noCache;
        
        // التحقق من التخزين المؤقت
        if (isCacheable && cache.has(cacheKey)) {
            const cached = cache.get(cacheKey);
            if (Date.now() - cached.timestamp < config.cacheDuration) {
                return Promise.resolve(cached.data);
            }
            cache.delete(cacheKey);
        }
        
        // التحقق من الطلبات المتكررة
        if (pendingRequests.has(cacheKey)) {
            return pendingRequests.get(cacheKey);
        }
        
        const url = `${config.baseUrl}${endpoint}`;
        const requestOptions = {
            method: options.method || 'GET',
            headers: { ...config.headers, ...options.headers },
            timeout: options.timeout || config.timeout,
            ...options
        };
        
        // إضافة التوثيق إذا كان المستخدم مسجلاً
        const token = getAuthToken();
        if (token) {
            requestOptions.headers.Authorization = `Bearer ${token}`;
        }
        
        const requestPromise = fetchWithRetry(url, requestOptions, options.retryAttempts || config.retryAttempts)
            .then(async response => {
                const data = await handleResponse(response);
                
                // تخزين في الذاكرة المؤقتة
                if (isCacheable && response.ok) {
                    cache.set(cacheKey, {
                        data,
                        timestamp: Date.now()
                    });
                }
                
                pendingRequests.delete(cacheKey);
                return data;
            })
            .catch(error => {
                pendingRequests.delete(cacheKey);
                throw error;
            });
        
        pendingRequests.set(cacheKey, requestPromise);
        return requestPromise;
    }

    /**
     * الطلب مع إعادة المحاولة
     * @method fetchWithRetry
     */
    async function fetchWithRetry(url, options, attempts) {
        for (let i = 0; i < attempts; i++) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), options.timeout);
                
                const response = await fetch(url, {
                    ...options,
                    signal: controller.signal
                });
                
                clearTimeout(timeoutId);
                return response;
            } catch (error) {
                if (i === attempts - 1) throw error;
                
                // انتظار متزايد قبل إعادة المحاولة
                await delay(Math.pow(2, i) * 1000);
            }
        }
    }

    /**
     * التعامل مع الاستجابة
     * @method handleResponse
     */
    async function handleResponse(response) {
        const contentType = response.headers.get('content-type');
        let data;
        
        if (contentType && contentType.includes('application/json')) {
            data = await response.json();
        } else {
            data = await response.text();
        }
        
        if (!response.ok) {
            throw new ApiError(
                data.message || 'حدث خطأ في الخادم',
                response.status,
                data.errors
            );
        }
        
        return data;
    }

    /**
     * توليد مفتاح التخزين المؤقت
     * @method generateCacheKey
     */
    function generateCacheKey(endpoint, options) {
        const params = options.body ? JSON.stringify(options.body) : '';
        return `${endpoint}_${options.method}_${params}`;
    }

    /**
     * الحصول على رمز التوثيق
     * @method getAuthToken
     */
    function getAuthToken() {
        return localStorage.getItem('hadhramaut_auth_token');
    }

    /**
     * حفظ رمز التوثيق
     * @method setAuthToken
     */
    function setAuthToken(token) {
        localStorage.setItem('hadhramaut_auth_token', token);
    }

    /**
     * مسح رمز التوثيق
     * @method clearAuthToken
     */
    function clearAuthToken() {
        localStorage.removeItem('hadhramaut_auth_token');
    }

    /**
     * تأخير
     * @method delay
     */
    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // ========== خدمات الاستبيانات ==========

    /**
     * الحصول على جميع الاستبيانات
     * @method getSurveys
     */
    async function getSurveys(params = {}) {
        const queryString = buildQueryString(params);
        return request(`${config.endpoints.surveys}${queryString}`);
    }

    /**
     * الحصول على الاستبيانات النشطة
     * @method getActiveSurveys
     */
    async function getActiveSurveys(limit = 10) {
        return request(`${config.endpoints.surveys}/active?limit=${limit}`);
    }

    /**
     * الحصول على استبيان محدد
     * @method getSurvey
     */
    async function getSurvey(id) {
        return request(`${config.endpoints.surveys}/${id}`);
    }

    /**
     * إنشاء استبيان جديد
     * @method createSurvey
     */
    async function createSurvey(surveyData) {
        return request(config.endpoints.surveys, {
            method: 'POST',
            body: JSON.stringify(surveyData)
        });
    }

    /**
     * تحديث استبيان
     * @method updateSurvey
     */
    async function updateSurvey(id, surveyData) {
        return request(`${config.endpoints.surveys}/${id}`, {
            method: 'PUT',
            body: JSON.stringify(surveyData)
        });
    }

    /**
     * حذف استبيان
     * @method deleteSurvey
     */
    async function deleteSurvey(id) {
        return request(`${config.endpoints.surveys}/${id}`, {
            method: 'DELETE'
        });
    }

    /**
     * المشاركة في استبيان
     * @method submitSurveyResponse
     */
    async function submitSurveyResponse(surveyId, responses) {
        return request(`${config.endpoints.surveys}/${surveyId}/responses`, {
            method: 'POST',
            body: JSON.stringify(responses)
        });
    }

    // ========== خدمات النتائج ==========

    /**
     * الحصول على النتائج
     * @method getResults
     */
    async function getResults(params = {}) {
        const queryString = buildQueryString(params);
        return request(`${config.endpoints.results}${queryString}`);
    }

    /**
     * الحصول على النتائج الحديثة
     * @method getRecentResults
     */
    async function getRecentResults(limit = 5) {
        return request(`${config.endpoints.results}/recent?limit=${limit}`);
    }

    /**
     * الحصول على نتيجة محددة
     * @method getResult
     */
    async function getResult(id) {
        return request(`${config.endpoints.results}/${id}`);
    }

    /**
     * إنشاء نتيجة جديدة
     * @method createResult
     */
    async function createResult(resultData) {
        return request(config.endpoints.results, {
            method: 'POST',
            body: JSON.stringify(resultData)
        });
    }

    // ========== خدمات المستخدمين ==========

    /**
     * تسجيل الدخول
     * @method login
     */
    async function login(credentials) {
        const response = await request(`${config.endpoints.auth}/login`, {
            method: 'POST',
            body: JSON.stringify(credentials),
            noCache: true
        });
        
        if (response.token) {
            setAuthToken(response.token);
            setUserData(response.user);
        }
        
        return response;
    }

    /**
     * تسجيل مستخدم جديد
     * @method register
     */
    async function register(userData) {
        const response = await request(config.endpoints.users, {
            method: 'POST',
            body: JSON.stringify(userData),
            noCache: true
        });
        
        if (response.token) {
            setAuthToken(response.token);
            setUserData(response.user);
        }
        
        return response;
    }

    /**
     * تسجيل الخروج
     * @method logout
     */
    async function logout() {
        try {
            await request(`${config.endpoints.auth}/logout`, {
                method: 'POST',
                noCache: true
            });
        } finally {
            clearAuthToken();
            clearUserData();
        }
    }

    /**
     * الحصول على بيانات المستخدم الحالي
     * @method getCurrentUser
     */
    async function getCurrentUser() {
        const userData = getUserData();
        if (userData) {
            return Promise.resolve(userData);
        }
        
        return request(`${config.endpoints.users}/me`);
    }

    /**
     * تحديث بيانات المستخدم
     * @method updateUser
     */
    async function updateUser(userData) {
        const response = await request(`${config.endpoints.users}/me`, {
            method: 'PUT',
            body: JSON.stringify(userData)
        });
        
        setUserData(response.user);
        return response;
    }

    /**
     * حفظ بيانات المستخدم محلياً
     * @method setUserData
     */
    function setUserData(user) {
        localStorage.setItem('hadhramaut_user', JSON.stringify(user));
    }

    /**
     * الحصول على بيانات المستخدم محلياً
     * @method getUserData
     */
    function getUserData() {
        const userJson = localStorage.getItem('hadhramaut_user');
        return userJson ? JSON.parse(userJson) : null;
    }

    /**
     * مسح بيانات المستخدم محلياً
     * @method clearUserData
     */
    function clearUserData() {
        localStorage.removeItem('hadhramaut_user');
    }

    // ========== خدمات التحليلات ==========

    /**
     * الحصول على الإحصائيات
     * @method getStats
     */
    async function getStats() {
        return request(config.endpoints.analytics);
    }

    /**
     * الحصول على إحصائيات الاستبيان
     * @method getSurveyStats
     */
    async function getSurveyStats(surveyId) {
        return request(`${config.endpoints.analytics}/surveys/${surveyId}`);
    }

    /**
     * تتبع حدث
     * @method trackEvent
     */
    async function trackEvent(eventName, data = {}) {
        // حفظ محلياً أولاً
        saveEventLocally(eventName, data);
        
        // محاولة الإرسال للخادم
        if (navigator.onLine) {
            try {
                await request(`${config.endpoints.analytics}/events`, {
                    method: 'POST',
                    body: JSON.stringify({
                        event: eventName,
                        data: data,
                        timestamp: new Date().toISOString()
                    })
                });
                
                // مسح الأحداث المحفوظة بعد الإرسال الناجح
                clearSentEvents();
            } catch (error) {
                console.warn('⚠️ فشل إرسال الحدث:', error);
            }
        }
    }

    /**
     * حفظ الحدث محلياً
     * @method saveEventLocally
     */
    function saveEventLocally(eventName, data) {
        try {
            const events = JSON.parse(localStorage.getItem('hadhramaut_events') || '[]');
            events.push({
                event: eventName,
                data: data,
                timestamp: new Date().toISOString()
            });
            localStorage.setItem('hadhramaut_events', JSON.stringify(events));
        } catch (error) {
            console.warn('⚠️ فشل حفظ الحدث محلياً:', error);
        }
    }

    /**
     * مسح الأحداث المرسلة
     * @method clearSentEvents
     */
    function clearSentEvents() {
        localStorage.removeItem('hadhramaut_events');
    }

    // ========== خدمات النشرة البريدية ==========

    /**
     * الاشتراك في النشرة البريدية
     * @method subscribeToNewsletter
     */
    async function subscribeToNewsletter(email) {
        return request(config.endpoints.newsletter, {
            method: 'POST',
            body: JSON.stringify({ email })
        });
    }

    /**
     * إلغاء الاشتراك من النشرة البريدية
     * @method unsubscribeFromNewsletter
     */
    async function unsubscribeFromNewsletter(email) {
        return request(`${config.endpoints.newsletter}/unsubscribe`, {
            method: 'POST',
            body: JSON.stringify({ email })
        });
    }

    // ========== خدمات الملفات ==========

    /**
     * رفع ملف
     * @method uploadFile
     */
    async function uploadFile(file, options = {}) {
        const formData = new FormData();
        formData.append('file', file);
        
        if (options.surveyId) {
            formData.append('surveyId', options.surveyId);
        }
        
        return request('/upload', {
            method: 'POST',
            headers: {
                'Accept': 'application/json'
            },
            body: formData
        });
    }

    /**
     * تحميل ملف
     * @method downloadFile
     */
    async function downloadFile(fileId) {
        return request(`/files/${fileId}`, {
            headers: {
                'Accept': 'application/octet-stream'
            }
        });
    }

    // ========== خدمات الذكاء الاصطناعي ==========

    /**
     * تحليل المشاعر
     * @method analyzeSentiment
     */
    async function analyzeSentiment(text) {
        return request('/ai/sentiment', {
            method: 'POST',
            body: JSON.stringify({ text })
        });
    }

    /**
     * تحليل النصوص العربية
     * @method analyzeArabicText
     */
    async function analyzeArabicText(text, options = {}) {
        return request('/ai/analyze/arabic', {
            method: 'POST',
            body: JSON.stringify({ text, ...options })
        });
    }

    /**
     * توليد تقرير تلقائي
     * @method generateReport
     */
    async function generateReport(surveyId, options = {}) {
        return request(`/ai/reports/generate/${surveyId}`, {
            method: 'POST',
            body: JSON.stringify(options)
        });
    }

    // ========== خدمات التخزين المؤقت ==========

    /**
     * مسح الذاكرة المؤقتة
     * @method clearCache
     */
    function clearCache() {
        cache.clear();
    }

    /**
     * مسح ذاكرة تخزين محددة
     * @method clearCacheForKey
     */
    function clearCacheForKey(key) {
        cache.delete(key);
    }

    // ========== أدوات مساعدة ==========

    /**
     * بناء سلسلة الاستعلام
     * @method buildQueryString
     */
    function buildQueryString(params) {
        if (!params || Object.keys(params).length === 0) {
            return '';
        }
        
        const queryParams = new URLSearchParams();
        
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                if (Array.isArray(value)) {
                    value.forEach(item => queryParams.append(`${key}[]`, item));
                } else {
                    queryParams.append(key, value);
                }
            }
        });
        
        const queryString = queryParams.toString();
        return queryString ? `?${queryString}` : '';
    }

    /**
     * فحص حالة الخادم
     * @method healthCheck
     */
    async function healthCheck() {
        try {
            const startTime = Date.now();
            const response = await fetch(`${config.baseUrl}/health`, {
                method: 'GET',
                timeout: 5000
            });
            const endTime = Date.now();
            
            return {
                status: response.ok ? 'healthy' : 'unhealthy',
                responseTime: endTime - startTime,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                status: 'offline',
                responseTime: null,
                timestamp: new Date().toISOString(),
                error: error.message
            };
        }
    }

    /**
     * الحصول على حالة النظام
     * @method getSystemStatus
     */
    async function getSystemStatus() {
        return request('/system/status');
    }

    // ========== فئات الأخطاء ==========

    /**
     * خطأ API مخصص
     * @class ApiError
     */
    class ApiError extends Error {
        constructor(message, status, errors = []) {
            super(message);
            this.name = 'ApiError';
            this.status = status;
            this.errors = errors;
            this.timestamp = new Date().toISOString();
        }
        
        toJSON() {
            return {
                name: this.name,
                message: this.message,
                status: this.status,
                errors: this.errors,
                timestamp: this.timestamp
            };
        }
    }

    /**
     * خطأ الشبكة
     * @class NetworkError
     */
    class NetworkError extends Error {
        constructor(message) {
            super(message);
            this.name = 'NetworkError';
            this.timestamp = new Date().toISOString();
        }
    }

    /**
     * خطأ التحقق من الصحة
     * @class ValidationError
     */
    class ValidationError extends Error {
        constructor(message, fieldErrors = {}) {
            super(message);
            this.name = 'ValidationError';
            this.fieldErrors = fieldErrors;
            this.timestamp = new Date().toISOString();
        }
    }

    // ========== واجهة التصدير ==========

    return {
        // التهيئة
        init,
        config,
        
        // الطلبات العامة
        request,
        healthCheck,
        getSystemStatus,
        
        // الاستبيانات
        getSurveys,
        getActiveSurveys,
        getSurvey,
        createSurvey,
        updateSurvey,
        deleteSurvey,
        submitSurveyResponse,
        
        // النتائج
        getResults,
        getRecentResults,
        getResult,
        createResult,
        
        // المستخدمون والمصادقة
        login,
        register,
        logout,
        getCurrentUser,
        updateUser,
        getAuthToken,
        setAuthToken,
        clearAuthToken,
        
        // التحليلات
        getStats,
        getSurveyStats,
        trackEvent,
        
        // النشرة البريدية
        subscribeToNewsletter,
        unsubscribeFromNewsletter,
        
        // الملفات
        uploadFile,
        downloadFile,
        
        // الذكاء الاصطناعي
        analyzeSentiment,
        analyzeArabicText,
        generateReport,
        
        // التخزين المؤقت
        clearCache,
        clearCacheForKey,
        
        // الأدوات المساعدة
        buildQueryString,
        delay,
        
        // فئات الأخطاء
        ApiError,
        NetworkError,
        ValidationError
    };
})();

/**
 * مصادقة المستخدم
 * @namespace AuthService
 */
const AuthService = (function() {
    'use strict';
    
    let currentUser = null;
    
    /**
     * التحقق من تسجيل الدخول
     * @method isAuthenticated
     */
    function isAuthenticated() {
        const token = ApiManager.getAuthToken();
        return !!token;
    }
    
    /**
     * الحصول على المستخدم الحالي
     * @method getCurrentUser
     */
    async function getCurrentUser() {
        if (currentUser) {
            return currentUser;
        }
        
        if (!isAuthenticated()) {
            return null;
        }
        
        try {
            currentUser = await ApiManager.getCurrentUser();
            return currentUser;
        } catch (error) {
            console.warn('⚠️ فشل تحميل بيانات المستخدم:', error);
            return null;
        }
    }
    
    /**
     * تحديث بيانات المستخدم
     * @method updateUser
     */
    async function updateUser(userData) {
        try {
            const response = await ApiManager.updateUser(userData);
            currentUser = response.user;
            return response;
        } catch (error) {
            console.error('❌ فشل تحديث بيانات المستخدم:', error);
            throw error;
        }
    }
    
    /**
     * التحقق من الصلاحيات
     * @method hasPermission
     */
    function hasPermission(permission) {
        if (!currentUser) return false;
        
        const userPermissions = currentUser.permissions || [];
        const userRole = currentUser.role || 'user';
        
        // الأدوار الإدارية لها جميع الصلاحيات
        if (['admin', 'moderator'].includes(userRole)) {
            return true;
        }
        
        return userPermissions.includes(permission);
    }
    
    /**
     * التحقق من الدور
     * @method hasRole
     */
    function hasRole(role) {
        if (!currentUser) return false;
        return currentUser.role === role;
    }
    
    /**
     * تسجيل الدخول
     * @method login
     */
    async function login(credentials) {
        try {
            const response = await ApiManager.login(credentials);
            currentUser = response.user;
            return response;
        } catch (error) {
            console.error('❌ فشل تسجيل الدخول:', error);
            throw error;
        }
    }
    
    /**
     * تسجيل مستخدم جديد
     * @method register
     */
    async function register(userData) {
        try {
            const response = await ApiManager.register(userData);
            currentUser = response.user;
            return response;
        } catch (error) {
            console.error('❌ فشل التسجيل:', error);
            throw error;
        }
    }
    
    /**
     * تسجيل الخروج
     * @method logout
     */
    async function logout() {
        try {
            await ApiManager.logout();
            currentUser = null;
            return true;
        } catch (error) {
            console.error('❌ فشل تسجيل الخروج:', error);
            throw error;
        }
    }
    
    /**
     * إعادة تعيين كلمة المرور
     * @method resetPassword
     */
    async function resetPassword(email) {
        // تنفيذ منطق إعادة تعيين كلمة المرور
        console.log('إعادة تعيين كلمة المرور لـ:', email);
        return { success: true, message: 'تم إرسال رابط إعادة التعيين' };
    }
    
    return {
        isAuthenticated,
        getCurrentUser,
        updateUser,
        hasPermission,
        hasRole,
        login,
        register,
        logout,
        resetPassword,
        currentUser: () => currentUser
    };
})();

/**
 * خدمة البيانات المحلية
 * @namespace LocalDataService
 */
const LocalDataService = (function() {
    'use strict';
    
    const STORAGE_KEYS = {
        SURVEYS: 'hadhramaut_surveys',
        RESULTS: 'hadhramaut_results',
        USER_RESPONSES: 'hadhramaut_user_responses',
        SETTINGS: 'hadhramaut_settings',
        OFFLINE_DATA: 'hadhramaut_offline_data'
    };
    
    /**
     * حفظ الاستبيانات محلياً
     * @method saveSurveys
     */
    function saveSurveys(surveys) {
        try {
            localStorage.setItem(STORAGE_KEYS.SURVEYS, JSON.stringify(surveys));
            return true;
        } catch (error) {
            console.warn('⚠️ فشل حفظ الاستبيانات محلياً:', error);
            return false;
        }
    }
    
    /**
     * الحصول على الاستبيانات المحفوظة
     * @method getSurveys
     */
    function getSurveys() {
        try {
            const surveysJson = localStorage.getItem(STORAGE_KEYS.SURVEYS);
            return surveysJson ? JSON.parse(surveysJson) : [];
        } catch (error) {
            console.warn('⚠️ فشل قراءة الاستبيانات المحفوظة:', error);
            return [];
        }
    }
    
    /**
     * حفظ النتائج محلياً
     * @method saveResults
     */
    function saveResults(results) {
        try {
            localStorage.setItem(STORAGE_KEYS.RESULTS, JSON.stringify(results));
            return true;
        } catch (error) {
            console.warn('⚠️ فشل حفظ النتائج محلياً:', error);
            return false;
        }
    }
    
    /**
     * الحصول على النتائج المحفوظة
     * @method getResults
     */
    function getResults() {
        try {
            const resultsJson = localStorage.getItem(STORAGE_KEYS.RESULTS);
            return resultsJson ? JSON.parse(resultsJson) : [];
        } catch (error) {
            console.warn('⚠️ فشل قراءة النتائج المحفوظة:', error);
            return [];
        }
    }
    
    /**
     * حفظ رد المستخدم
     * @method saveUserResponse
     */
    function saveUserResponse(surveyId, responses) {
        try {
            const userResponses = getUserResponses();
            userResponses[surveyId] = {
                responses,
                timestamp: new Date().toISOString()
            };
            
            localStorage.setItem(STORAGE_KEYS.USER_RESPONSES, JSON.stringify(userResponses));
            return true;
        } catch (error) {
            console.warn('⚠️ فشل حفظ رد المستخدم:', error);
            return false;
        }
    }
    
    /**
     * الحصول على ردود المستخدم
     * @method getUserResponses
     */
    function getUserResponses() {
        try {
            const responsesJson = localStorage.getItem(STORAGE_KEYS.USER_RESPONSES);
            return responsesJson ? JSON.parse(responsesJson) : {};
        } catch (error) {
            console.warn('⚠️ فشل قراءة ردود المستخدم:', error);
            return {};
        }
    }
    
    /**
     * الحصول على رد محدد
     * @method getUserResponse
     */
    function getUserResponse(surveyId) {
        const responses = getUserResponses();
        return responses[surveyId] || null;
    }
    
    /**
     * حفظ الإعدادات
     * @method saveSettings
     */
    function saveSettings(settings) {
        try {
            localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
            return true;
        } catch (error) {
            console.warn('⚠️ فشل حفظ الإعدادات:', error);
            return false;
        }
    }
    
    /**
     * الحصول على الإعدادات
     * @method getSettings
     */
    function getSettings() {
        try {
            const settingsJson = localStorage.getItem(STORAGE_KEYS.SETTINGS);
            return settingsJson ? JSON.parse(settingsJson) : {
                theme: 'light',
                language: 'ar',
                notifications: true
            };
        } catch (error) {
            console.warn('⚠️ فشل قراءة الإعدادات:', error);
            return {
                theme: 'light',
                language: 'ar',
                notifications: true
            };
        }
    }
    
    /**
     * حفظ بيانات عدم الاتصال
     * @method saveOfflineData
     */
    function saveOfflineData(type, data) {
        try {
            const offlineData = getOfflineData();
            offlineData.push({
                type,
                data,
                timestamp: new Date().toISOString(),
                id: Utils.generateId()
            });
            
            localStorage.setItem(STORAGE_KEYS.OFFLINE_DATA, JSON.stringify(offlineData));
            return true;
        } catch (error) {
            console.warn('⚠️ فشل حفظ بيانات عدم الاتصال:', error);
            return false;
        }
    }
    
    /**
     * الحصول على بيانات عدم الاتصال
     * @method getOfflineData
     */
    function getOfflineData() {
        try {
            const dataJson = localStorage.getItem(STORAGE_KEYS.OFFLINE_DATA);
            return dataJson ? JSON.parse(dataJson) : [];
        } catch (error) {
            console.warn('⚠️ فشل قراءة بيانات عدم الاتصال:', error);
            return [];
        }
    }
    
    /**
     * مسح بيانات عدم الاتصال
     * @method clearOfflineData
     */
    function clearOfflineData() {
        localStorage.removeItem(STORAGE_KEYS.OFFLINE_DATA);
    }
    
    /**
     * مسح جميع البيانات المحلية
     * @method clearAllData
     */
    function clearAllData() {
        Object.values(STORAGE_KEYS).forEach(key => {
            localStorage.removeItem(key);
        });
    }
    
    /**
     * التحقق من سعة التخزين
     * @method checkStorageQuota
     */
    function checkStorageQuota() {
        try {
            const total = 5 * 1024 * 1024; // 5MB
            let used = 0;
            
            for (let key in localStorage) {
                if (localStorage.hasOwnProperty(key)) {
                    used += localStorage[key].length * 2; // تقدير الحجم
                }
            }
            
            const percentage = (used / total) * 100;
            
            return {
                used: used,
                total: total,
                percentage: percentage,
                status: percentage > 90 ? 'critical' : percentage > 70 ? 'warning' : 'good'
            };
        } catch (error) {
            return {
                used: 0,
                total: 0,
                percentage: 0,
                status: 'unknown'
            };
        }
    }
    
    return {
        saveSurveys,
        getSurveys,
        saveResults,
        getResults,
        saveUserResponse,
        getUserResponses,
        getUserResponse,
        saveSettings,
        getSettings,
        saveOfflineData,
        getOfflineData,
        clearOfflineData,
        clearAllData,
        checkStorageQuota
    };
})();

/**
 * خدمة المزامنة
 * @namespace SyncService
 */
const SyncService = (function() {
    'use strict';
    
    let isSyncing = false;
    let lastSyncTime = null;
    
    /**
     * مزامنة جميع البيانات
     * @method syncAllData
     */
    async function syncAllData() {
        if (isSyncing) {
            console.log('📡 المزامنة قيد التنفيذ بالفعل');
            return;
        }
        
        if (!navigator.onLine) {
            console.log('📡 غير متصل بالإنترنت - تأجيل المزامنة');
            return;
        }
        
        isSyncing = true;
        
        try {
            console.log('🔄 بدء مزامنة البيانات...');
            
            // 1. مزامنة بيانات عدم الاتصال
            await syncOfflineData();
            
            // 2. تحديث البيانات المحلية من الخادم
            await updateLocalData();
            
            // 3. مزامنة ردود المستخدم
            await syncUserResponses();
            
            lastSyncTime = new Date();
            console.log('✅ تمت مزامنة البيانات بنجاح');
            
            // إشعار النجاح
            App.showToast('تمت مزامنة البيانات بنجاح', 'success');
            
        } catch (error) {
            console.error('❌ فشل مزامنة البيانات:', error);
            App.showToast('فشل مزامنة البيانات', 'error');
        } finally {
            isSyncing = false;
        }
    }
    
    /**
     * مزامنة بيانات عدم الاتصال
     * @method syncOfflineData
     */
    async function syncOfflineData() {
        const offlineData = LocalDataService.getOfflineData();
        
        if (offlineData.length === 0) {
            return;
        }
        
        console.log(`📡 جاري مزامنة ${offlineData.length} عنصر...`);
        
        const successfulSyncs = [];
        const failedSyncs = [];
        
        for (const item of offlineData) {
            try {
                // إرسال البيانات للخادم حسب النوع
                switch (item.type) {
                    case 'survey_response':
                        await ApiManager.submitSurveyResponse(item.data.surveyId, item.data.responses);
                        break;
                    case 'survey_creation':
                        await ApiManager.createSurvey(item.data);
                        break;
                    case 'user_feedback':
                        await ApiManager.request('/feedback', {
                            method: 'POST',
                            body: JSON.stringify(item.data)
                        });
                        break;
                    default:
                        console.warn(`⚠️ نوع بيانات غير معروف: ${item.type}`);
                }
                
                successfulSyncs.push(item.id);
            } catch (error) {
                console.warn(`⚠️ فشل مزامنة العنصر ${item.id}:`, error);
                failedSyncs.push(item);
            }
        }
        
        // مسح العناصر التي تمت مزامنتها بنجاح
        if (successfulSyncs.length > 0) {
            const remainingData = offlineData.filter(item => !successfulSyncs.includes(item.id));
            LocalDataService.saveOfflineData(remainingData);
        }
        
        // حفظ العناصر الفاشلة مرة أخرى
        if (failedSyncs.length > 0) {
            // يمكن إضافة منطق لإعادة المحاولة لاحقاً
            console.log(`🔄 ${failedSyncs.length} عنصر فشلت مزامنته`);
        }
    }
    
    /**
     * تحديث البيانات المحلية
     * @method updateLocalData
     */
    async function updateLocalData() {
        try {
            // تحديث الاستبيانات
            const surveys = await ApiManager.getActiveSurveys();
            LocalDataService.saveSurveys(surveys);
            
            // تحديث النتائج
            const results = await ApiManager.getRecentResults();
            LocalDataService.saveResults(results);
            
            console.log('✅ تم تحديث البيانات المحلية');
        } catch (error) {
            console.warn('⚠️ فشل تحديث البيانات المحلية:', error);
        }
    }
    
    /**
     * مزامنة ردود المستخدم
     * @method syncUserResponses
     */
    async function syncUserResponses() {
        const userResponses = LocalDataService.getUserResponses();
        const surveyIds = Object.keys(userResponses);
        
        for (const surveyId of surveyIds) {
            const response = userResponses[surveyId];
            
            // التحقق إذا كان الرد قد تم إرساله مسبقاً
            if (!response.synced) {
                try {
                    await ApiManager.submitSurveyResponse(surveyId, response.responses);
                    
                    // تحديث حالة المزامنة
                    response.synced = true;
                    response.syncTime = new Date().toISOString();
                    userResponses[surveyId] = response;
                    
                    LocalDataService.saveUserResponse(surveyId, response.responses);
                    
                    console.log(`✅ تم مزامنة رد الاستبيان ${surveyId}`);
                } catch (error) {
                    console.warn(`⚠️ فشل مزامنة رد الاستبيان ${surveyId}:`, error);
                }
            }
        }
    }
    
    /**
     * الحصول على حالة المزامنة
     * @method getSyncStatus
     */
    function getSyncStatus() {
        return {
            isSyncing,
            lastSyncTime,
            offlineDataCount: LocalDataService.getOfflineData().length,
            unsyncedResponses: Object.keys(LocalDataService.getUserResponses())
                .filter(surveyId => !LocalDataService.getUserResponses()[surveyId]?.synced).length
        };
    }
    
    /**
     * بدء المزامنة التلقائية
     * @method startAutoSync
     */
    function startAutoSync(interval = 5 * 60 * 1000) { // كل 5 دقائق
        // مزامنة فورية عند اتصال الإنترنت
        window.addEventListener('online', () => {
            console.log('🌐 اتصال بالإنترنت - بدء المزامنة...');
            syncAllData();
        });
        
        // مزامنة دورية
        setInterval(() => {
            if (navigator.onLine) {
                syncAllData();
            }
        }, interval);
        
        console.log('🔄 تم تفعيل المزامنة التلقائية');
    }
    
    return {
        syncAllData,
        getSyncStatus,
        startAutoSync,
        isSyncing: () => isSyncing,
        lastSyncTime: () => lastSyncTime
    };
})();

/**
 * تهيئة خدمات API عند تحميل الصفحة
 */
document.addEventListener('DOMContentLoaded', () => {
    ApiManager.init();
    SyncService.startAutoSync();
});

/**
 * تصدير الكائنات للاستخدام العام
 */
window.ApiManager = ApiManager;
window.AuthService = AuthService;
window.LocalDataService = LocalDataService;
window.SyncService = SyncService;

// تصدير افتراضي
export { ApiManager, AuthService, LocalDataService, SyncService };
```
