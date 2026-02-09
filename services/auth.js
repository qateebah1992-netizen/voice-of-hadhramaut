```javascript
/* ============================================
   صوت حضرموت - نظام المصادقة وإدارة المستخدمين
   ============================================ */

/**
 * نظام المصادقة وإدارة المستخدمين
 * @namespace AuthenticationSystem
 */
const AuthenticationSystem = (function() {
    'use strict';

    // التكوين
    const config = {
        tokenKey: 'hadhramaut_auth_token',
        userKey: 'hadhramaut_user_data',
        sessionKey: 'hadhramaut_session',
        refreshTokenKey: 'hadhramaut_refresh_token',
        tokenExpiryKey: 'hadhramaut_token_expiry',
        
        // مسارات API
        endpoints: {
            login: '/auth/login',
            register: '/auth/register',
            logout: '/auth/logout',
            verify: '/auth/verify',
            refresh: '/auth/refresh',
            resetPassword: '/auth/reset-password',
            changePassword: '/auth/change-password',
            profile: '/users/profile',
            updateProfile: '/users/update-profile'
        },
        
        // إعدادات الجلسة
        sessionTimeout: 24 * 60 * 60 * 1000, // 24 ساعة
        refreshThreshold: 15 * 60 * 1000, // 15 دقيقة قبل الانتهاء
        autoRefresh: true,
        
        // قيود الأمان
        maxLoginAttempts: 5,
        lockoutDuration: 15 * 60 * 1000, // 15 دقيقة
        passwordMinLength: 8,
        requireSpecialChars: true,
        requireNumbers: true
    };

    // الحالة
    const state = {
        currentUser: null,
        isAuthenticated: false,
        sessionActive: false,
        loginAttempts: 0,
        lastLoginAttempt: null,
        sessionStartTime: null,
        tokenRefreshInterval: null
    };

    // العناصر DOM
    let authElements = {
        loginForm: null,
        registerForm: null,
        logoutButton: null,
        userMenu: null,
        authModal: null
    };

    /**
     * تهيئة نظام المصادقة
     * @method init
     */
    function init() {
        cacheElements();
        setupEventListeners();
        restoreSession();
        checkSessionValidity();
        setupSessionMonitoring();
        
        console.log('✅ نظام المصادقة جاهز');
    }

    /**
     * تخزين عناصر DOM
     * @method cacheElements
     */
    function cacheElements() {
        authElements.loginForm = document.getElementById('loginForm');
        authElements.registerForm = document.getElementById('registerForm');
        authElements.logoutButton = document.getElementById('logoutButton');
        authElements.userMenu = document.getElementById('userMenu');
        authElements.authModal = document.getElementById('authModal');
    }

    /**
     * إعداد مستمعي الأحداث
     * @method setupEventListeners
     */
    function setupEventListeners() {
        // أحداث تسجيل الدخول
        if (authElements.loginForm) {
            authElements.loginForm.addEventListener('submit', handleLogin);
        }

        // أحداث التسجيل
        if (authElements.registerForm) {
            authElements.registerForm.addEventListener('submit', handleRegister);
        }

        // أحداث تسجيل الخروج
        if (authElements.logoutButton) {
            authElements.logoutButton.addEventListener('click', handleLogout);
        }

        // مراقبة النقر خارج القوائم
        document.addEventListener('click', handleDocumentClick);

        // مراقبة عدم النشاط
        document.addEventListener('mousemove', resetInactivityTimer);
        document.addEventListener('keypress', resetInactivityTimer);
        document.addEventListener('scroll', resetInactivityTimer);
    }

    /**
     * استعادة الجلسة
     * @method restoreSession
     */
    function restoreSession() {
        const token = getStoredToken();
        const userData = getStoredUserData();
        const session = getStoredSession();

        if (token && userData && session) {
            const now = Date.now();
            const sessionAge = now - session.startTime;

            if (sessionAge < config.sessionTimeout) {
                state.currentUser = userData;
                state.isAuthenticated = true;
                state.sessionActive = true;
                state.sessionStartTime = session.startTime;
                
                updateUI();
                startTokenRefresh();
                
                console.log('🔓 تم استعادة الجلسة بنجاح');
                return true;
            } else {
                clearStoredData();
                console.log('⚠️ انتهت صلاحية الجلسة');
            }
        }
        
        return false;
    }

    /**
     * التحقق من صلاحية الجلسة
     * @method checkSessionValidity
     */
    function checkSessionValidity() {
        if (!state.isAuthenticated) return;

        const now = Date.now();
        const sessionAge = now - state.sessionStartTime;

        if (sessionAge > config.sessionTimeout) {
            console.log('🔄 انتهت صلاحية الجلسة - تسجيل الخروج');
            logout(true); // تسجيل خروج صامت
        } else if (sessionAge > config.sessionTimeout - config.refreshThreshold) {
            console.log('🔄 تجديد الجلسة قريباً');
            // يمكن إضافة إشعار للمستخدم
        }
    }

    /**
     * إعداد مراقبة الجلسة
     * @method setupSessionMonitoring
     */
    function setupSessionMonitoring() {
        // التحقق من صلاحية الجلسة كل دقيقة
        setInterval(checkSessionValidity, 60 * 1000);
    }

    /**
     * التعامل مع تسجيل الدخول
     * @method handleLogin
     */
    async function handleLogin(event) {
        event.preventDefault();
        
        const form = event.target;
        const email = form.querySelector('input[name="email"]').value;
        const password = form.querySelector('input[name="password"]').value;
        const rememberMe = form.querySelector('input[name="rememberMe"]')?.checked || false;

        // التحقق من قيود الأمان
        if (checkLoginRestrictions()) {
            showAuthError('تم تجاوز عدد المحاولات المسموح بها. الرجاء المحاولة لاحقاً.');
            return;
        }

        // التحقق من صحة المدخلات
        if (!validateEmail(email)) {
            showAuthError('البريد الإلكتروني غير صحيح');
            return;
        }

        if (!validatePassword(password)) {
            showAuthError('كلمة المرور يجب أن تكون 8 أحرف على الأقل وتحتوي على أرقام وحروف خاصة');
            return;
        }

        // عرض حالة التحميل
        showAuthLoading(true);

        try {
            const credentials = { email, password, rememberMe };
            const result = await login(credentials);
            
            if (result.success) {
                showAuthSuccess('تم تسجيل الدخول بنجاح');
                
                // إعادة توجيه أو إغلاق النافذة
                setTimeout(() => {
                    const redirectUrl = getRedirectUrl();
                    if (redirectUrl) {
                        window.location.href = redirectUrl;
                    } else {
                        window.location.reload();
                    }
                }, 1500);
            } else {
                showAuthError(result.message || 'فشل تسجيل الدخول');
                recordLoginAttempt(false);
            }
        } catch (error) {
            console.error('❌ خطأ في تسجيل الدخول:', error);
            showAuthError('حدث خطأ أثناء تسجيل الدخول');
            recordLoginAttempt(false);
        } finally {
            showAuthLoading(false);
        }
    }

    /**
     * التعامل مع التسجيل
     * @method handleRegister
     */
    async function handleRegister(event) {
        event.preventDefault();
        
        const form = event.target;
        const formData = new FormData(form);
        const userData = Object.fromEntries(formData.entries());

        // التحقق من صحة البيانات
        const validationResult = validateRegistrationData(userData);
        if (!validationResult.valid) {
            showAuthError(validationResult.message);
            return;
        }

        // التحقق من كلمة المرور
        if (userData.password !== userData.confirmPassword) {
            showAuthError('كلمات المرور غير متطابقة');
            return;
        }

        // إزالة تأكيد كلمة المرور قبل الإرسال
        delete userData.confirmPassword;

        // عرض حالة التحميل
        showAuthLoading(true, 'register');

        try {
            const result = await register(userData);
            
            if (result.success) {
                showAuthSuccess('تم إنشاء الحساب بنجاح');
                
                // تسجيل الدخول تلقائياً
                setTimeout(() => {
                    const loginData = {
                        email: userData.email,
                        password: userData.password
                    };
                    
                    // استخدام نفس النموذج لتسجيل الدخول
                    handleLogin(new Event('submit', { target: form }));
                }, 1500);
            } else {
                showAuthError(result.message || 'فشل إنشاء الحساب');
            }
        } catch (error) {
            console.error('❌ خطأ في التسجيل:', error);
            showAuthError('حدث خطأ أثناء إنشاء الحساب');
        } finally {
            showAuthLoading(false, 'register');
        }
    }

    /**
     * التعامل مع تسجيل الخروج
     * @method handleLogout
     */
    async function handleLogout(event) {
        if (event) event.preventDefault();
        
        const confirmed = await showLogoutConfirmation();
        if (!confirmed) return;

        try {
            await logout();
            showAuthSuccess('تم تسجيل الخروج بنجاح');
            
            setTimeout(() => {
                window.location.href = '/';
            }, 1000);
        } catch (error) {
            console.error('❌ خطأ في تسجيل الخروج:', error);
            showAuthError('حدث خطأ أثناء تسجيل الخروج');
        }
    }

    /**
     * التعامل مع النقر على المستند
     * @method handleDocumentClick
     */
    function handleDocumentClick(event) {
        // إغلاق القوائم المنسدلة للنقر خارجها
        if (authElements.userMenu && !authElements.userMenu.contains(event.target)) {
            authElements.userMenu.classList.remove('show');
        }
    }

    /**
     * إعادة ضبط مؤشر عدم النشاط
     * @method resetInactivityTimer
     */
    function resetInactivityTimer() {
        if (state.sessionActive) {
            // يمكن إضافة منطق لمراقبة النشاط هنا
            // مثل إعادة ضبط مؤشر عدم النشاط للجلسة
        }
    }

    /**
     * تسجيل الدخول
     * @method login
     */
    async function login(credentials) {
        try {
            const response = await ApiManager.request(config.endpoints.login, {
                method: 'POST',
                body: JSON.stringify(credentials)
            });

            if (response.success) {
                // حفظ البيانات
                setStoredToken(response.data.token);
                setStoredUserData(response.data.user);
                setStoredSession({
                    startTime: Date.now(),
                    rememberMe: credentials.rememberMe
                });

                // تحديث الحالة
                state.currentUser = response.data.user;
                state.isAuthenticated = true;
                state.sessionActive = true;
                state.sessionStartTime = Date.now();
                state.loginAttempts = 0;

                // تحديث الواجهة
                updateUI();

                // بدء تجديد الرمز
                startTokenRefresh();

                // تتبع الحدث
                trackAuthEvent('login_success', { userId: response.data.user.id });

                console.log('✅ تم تسجيل الدخول بنجاح');
            }

            return response;
        } catch (error) {
            console.error('❌ فشل تسجيل الدخول:', error);
            trackAuthEvent('login_failed', { email: credentials.email });
            throw error;
        }
    }

    /**
     * تسجيل مستخدم جديد
     * @method register
     */
    async function register(userData) {
        try {
            const response = await ApiManager.request(config.endpoints.register, {
                method: 'POST',
                body: JSON.stringify(userData)
            });

            if (response.success) {
                trackAuthEvent('registration_success', { email: userData.email });
                console.log('✅ تم إنشاء الحساب بنجاح');
            }

            return response;
        } catch (error) {
            console.error('❌ فشل التسجيل:', error);
            trackAuthEvent('registration_failed', { email: userData.email });
            throw error;
        }
    }

    /**
     * تسجيل الخروج
     * @method logout
     */
    async function logout(silent = false) {
        try {
            // إرسال طلب تسجيل الخروج للخادم
            if (state.isAuthenticated) {
                await ApiManager.request(config.endpoints.logout, {
                    method: 'POST'
                });
            }
        } catch (error) {
            // حتى لو فشل طلب الخادم، نستمر في تسجيل الخروج محلياً
            console.warn('⚠️ فشل تسجيل الخروج من الخادم:', error);
        } finally {
            // مسح البيانات المحلية
            clearStoredData();
            
            // تحديث الحالة
            state.currentUser = null;
            state.isAuthenticated = false;
            state.sessionActive = false;
            state.sessionStartTime = null;
            
            // إيقاف تجديد الرمز
            stopTokenRefresh();
            
            // تحديث الواجهة
            updateUI();
            
            // تتبع الحدث
            if (!silent) {
                trackAuthEvent('logout', { userId: state.currentUser?.id });
            }
            
            console.log('✅ تم تسجيل الخروج');
        }
    }

    /**
     * التحقق من الرمز
     * @method verifyToken
     */
    async function verifyToken(token) {
        try {
            const response = await ApiManager.request(config.endpoints.verify, {
                method: 'POST',
                body: JSON.stringify({ token })
            });
            
            return response.success;
        } catch (error) {
            console.warn('⚠️ فشل التحقق من الرمز:', error);
            return false;
        }
    }

    /**
     * تجديد الرمز
     * @method refreshToken
     */
    async function refreshToken() {
        if (!state.isAuthenticated) return null;

        try {
            const refreshToken = getStoredRefreshToken();
            if (!refreshToken) return null;

            const response = await ApiManager.request(config.endpoints.refresh, {
                method: 'POST',
                body: JSON.stringify({ refreshToken })
            });

            if (response.success) {
                setStoredToken(response.data.token);
                console.log('🔄 تم تجديد الرمز بنجاح');
                return response.data.token;
            }
        } catch (error) {
            console.warn('⚠️ فشل تجديد الرمز:', error);
            // في حالة فشل التجديد، نلغي المصادقة
            await logout(true);
        }
        
        return null;
    }

    /**
     * بدء تجديد الرمز التلقائي
     * @method startTokenRefresh
     */
    function startTokenRefresh() {
        if (!config.autoRefresh) return;
        
        stopTokenRefresh();
        
        state.tokenRefreshInterval = setInterval(async () => {
            if (state.isAuthenticated) {
                await refreshToken();
            }
        }, config.refreshThreshold);
    }

    /**
     * إيقاف تجديد الرمز
     * @method stopTokenRefresh
     */
    function stopTokenRefresh() {
        if (state.tokenRefreshInterval) {
            clearInterval(state.tokenRefreshInterval);
            state.tokenRefreshInterval = null;
        }
    }

    /**
     * تحديث ملف المستخدم الشخصي
     * @method updateProfile
     */
    async function updateProfile(profileData) {
        try {
            const response = await ApiManager.request(config.endpoints.updateProfile, {
                method: 'PUT',
                body: JSON.stringify(profileData)
            });

            if (response.success) {
                // تحديث بيانات المستخدم المحلية
                state.currentUser = { ...state.currentUser, ...profileData };
                setStoredUserData(state.currentUser);
                
                // تحديث الواجهة
                updateUI();
                
                // تتبع الحدث
                trackAuthEvent('profile_updated', { userId: state.currentUser.id });
                
                console.log('✅ تم تحديث الملف الشخصي بنجاح');
            }

            return response;
        } catch (error) {
            console.error('❌ فشل تحديث الملف الشخصي:', error);
            throw error;
        }
    }

    /**
     * تغيير كلمة المرور
     * @method changePassword
     */
    async function changePassword(passwordData) {
        try {
            const response = await ApiManager.request(config.endpoints.changePassword, {
                method: 'POST',
                body: JSON.stringify(passwordData)
            });

            if (response.success) {
                trackAuthEvent('password_changed', { userId: state.currentUser.id });
                console.log('✅ تم تغيير كلمة المرور بنجاح');
            }

            return response;
        } catch (error) {
            console.error('❌ فشل تغيير كلمة المرور:', error);
            throw error;
        }
    }

    /**
     * إعادة تعيين كلمة المرور
     * @method resetPassword
     */
    async function resetPassword(email) {
        try {
            const response = await ApiManager.request(config.endpoints.resetPassword, {
                method: 'POST',
                body: JSON.stringify({ email })
            });

            if (response.success) {
                trackAuthEvent('password_reset_requested', { email });
                console.log('✅ تم إرسال رابط إعادة التعيين');
            }

            return response;
        } catch (error) {
            console.error('❌ فشل إرسال رابط إعادة التعيين:', error);
            throw error;
        }
    }

    /**
     * التحقق من قيود تسجيل الدخول
     * @method checkLoginRestrictions
     */
    function checkLoginRestrictions() {
        if (state.loginAttempts >= config.maxLoginAttempts) {
            const now = Date.now();
            const timeSinceLastAttempt = now - (state.lastLoginAttempt || 0);
            
            if (timeSinceLastAttempt < config.lockoutDuration) {
                return true;
            } else {
                // إعادة تعيين العد إذا انتهت مدة القفل
                state.loginAttempts = 0;
                state.lastLoginAttempt = null;
                return false;
            }
        }
        
        return false;
    }

    /**
     * تسجيل محاولة تسجيل الدخول
     * @method recordLoginAttempt
     */
    function recordLoginAttempt(success) {
        if (success) {
            state.loginAttempts = 0;
            state.lastLoginAttempt = null;
        } else {
            state.loginAttempts++;
            state.lastLoginAttempt = Date.now();
            
            // إشعار المستخدم بعدد المحاولات المتبقية
            const remainingAttempts = config.maxLoginAttempts - state.loginAttempts;
            if (remainingAttempts > 0) {
                showAuthWarning(`محاولات خاطئة متبقية: ${remainingAttempts}`);
            }
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
     * التحقق من صحة كلمة المرور
     * @method validatePassword
     */
    function validatePassword(password) {
        if (password.length < config.passwordMinLength) {
            return false;
        }

        if (config.requireNumbers && !/\d/.test(password)) {
            return false;
        }

        if (config.requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
            return false;
        }

        return true;
    }

    /**
     * التحقق من بيانات التسجيل
     * @method validateRegistrationData
     */
    function validateRegistrationData(userData) {
        if (!userData.name || userData.name.trim().length < 2) {
            return { valid: false, message: 'الاسم يجب أن يكون على الأقل حرفين' };
        }

        if (!validateEmail(userData.email)) {
            return { valid: false, message: 'البريد الإلكتروني غير صحيح' };
        }

        if (!validatePassword(userData.password)) {
            return { valid: false, message: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل وتحتوي على أرقام وحروف خاصة' };
        }

        if (!userData.phone || !/^\d{10,}$/.test(userData.phone)) {
            return { valid: false, message: 'رقم الهاتف غير صحيح' };
        }

        if (!userData.region || !userData.city) {
            return { valid: false, message: 'الرجاء تحديد المنطقة والمدينة' };
        }

        return { valid: true, message: '' };
    }

    /**
     * تحديث واجهة المستخدم
     * @method updateUI
     */
    function updateUI() {
        // تحديث قوائم المستخدم
        updateUserMenu();
        
        // تحديث حالة الأزرار
        updateAuthButtons();
        
        // تحديث محتوى الصفحة حسب حالة المصادقة
        updateContentVisibility();
    }

    /**
     * تحديث قائمة المستخدم
     * @method updateUserMenu
     */
    function updateUserMenu() {
        if (!authElements.userMenu) return;

        if (state.isAuthenticated && state.currentUser) {
            const userMenuHTML = `
                <div class="dropdown-menu dropdown-menu-end" aria-labelledby="userDropdown">
                    <div class="user-info px-3 py-2">
                        <div class="fw-bold">${state.currentUser.name}</div>
                        <small class="text-muted">${state.currentUser.email}</small>
                    </div>
                    <div class="dropdown-divider"></div>
                    <a class="dropdown-item" href="/pages/dashboard/profile.html">
                        <i class="fas fa-user me-2"></i>الملف الشخصي
                    </a>
                    <a class="dropdown-item" href="/pages/dashboard/settings.html">
                        <i class="fas fa-cog me-2"></i>الإعدادات
                    </a>
                    <a class="dropdown-item" href="/pages/dashboard/my-surveys.html">
                        <i class="fas fa-poll me-2"></i>استبياناتي
                    </a>
                    <div class="dropdown-divider"></div>
                    <a class="dropdown-item" href="#" id="logoutButton">
                        <i class="fas fa-sign-out-alt me-2"></i>تسجيل الخروج
                    </a>
                </div>
            `;
            
            authElements.userMenu.innerHTML = userMenuHTML;
            
            // إعادة ربط حدث تسجيل الخروج
            const newLogoutButton = document.getElementById('logoutButton');
            if (newLogoutButton) {
                newLogoutButton.addEventListener('click', handleLogout);
            }
        }
    }

    /**
     * تحديث أزرار المصادقة
     * @method updateAuthButtons
     */
    function updateAuthButtons() {
        // تحديث أزرار تسجيل الدخول/التسجيل في جميع أنحاء الموقع
        const loginButtons = document.querySelectorAll('.login-button');
        const registerButtons = document.querySelectorAll('.register-button');
        const profileButtons = document.querySelectorAll('.profile-button');
        
        if (state.isAuthenticated) {
            loginButtons.forEach(btn => btn.style.display = 'none');
            registerButtons.forEach(btn => btn.style.display = 'none');
            profileButtons.forEach(btn => btn.style.display = 'inline-block');
        } else {
            loginButtons.forEach(btn => btn.style.display = 'inline-block');
            registerButtons.forEach(btn => btn.style.display = 'inline-block');
            profileButtons.forEach(btn => btn.style.display = 'none');
        }
    }

    /**
     * تحديث رؤية المحتوى
     * @method updateContentVisibility
     */
    function updateContentVisibility() {
        // إظهار/إخفاء المحتوى حسب الصلاحيات
        const protectedElements = document.querySelectorAll('[data-auth-required]');
        const publicElements = document.querySelectorAll('[data-auth-hidden]');
        
        protectedElements.forEach(element => {
            if (state.isAuthenticated) {
                element.classList.remove('d-none');
            } else {
                element.classList.add('d-none');
            }
        });
        
        publicElements.forEach(element => {
            if (state.isAuthenticated) {
                element.classList.add('d-none');
            } else {
                element.classList.remove('d-none');
            }
        });
    }

    /**
     * عرض خطأ المصادقة
     * @method showAuthError
     */
    function showAuthError(message) {
        showAuthMessage(message, 'error');
    }

    /**
     * عرض نجاح المصادقة
     * @method showAuthSuccess
     */
    function showAuthSuccess(message) {
        showAuthMessage(message, 'success');
    }

    /**
     * عرض تحذير المصادقة
     * @method showAuthWarning
     */
    function showAuthWarning(message) {
        showAuthMessage(message, 'warning');
    }

    /**
     * عرض رسالة المصادقة
     * @method showAuthMessage
     */
    function showAuthMessage(message, type = 'info') {
        // إنشاء عنصر الرسالة
        const messageElement = document.createElement('div');
        messageElement.className = `auth-message auth-${type} animate__animated animate__fadeIn`;
        messageElement.innerHTML = `
            <div class="d-flex align-items-center">
                <i class="fas fa-${getAuthMessageIcon(type)} me-2"></i>
                <span>${message}</span>
                <button class="btn-close ms-auto" onclick="this.parentElement.parentElement.remove()"></button>
            </div>
        `;
        
        // إضافة الرسالة للنموذج المناسب
        const targetForm = document.querySelector('.auth-form.active') || 
                          authElements.loginForm || 
                          authElements.registerForm;
        
        if (targetForm) {
            const existingMessages = targetForm.querySelectorAll('.auth-message');
            existingMessages.forEach(msg => msg.remove());
            
            targetForm.insertBefore(messageElement, targetForm.firstChild);
            
            // إزالة الرسالة تلقائياً بعد 5 ثواني
            setTimeout(() => {
                if (messageElement.parentElement) {
                    messageElement.remove();
                }
            }, 5000);
        }
    }

    /**
     * الحصول على أيقونة الرسالة
     * @method getAuthMessageIcon
     */
    function getAuthMessageIcon(type) {
        const icons = {
            'success': 'check-circle',
            'error': 'exclamation-circle',
            'warning': 'exclamation-triangle',
            'info': 'info-circle'
        };
        
        return icons[type] || 'info-circle';
    }

    /**
     * عرض حالة التحميل
     * @method showAuthLoading
     */
    function showAuthLoading(show, formType = 'login') {
        const form = formType === 'login' ? authElements.loginForm : authElements.registerForm;
        if (!form) return;
        
        const submitButton = form.querySelector('button[type="submit"]');
        const loadingElement = form.querySelector('.auth-loading') || createLoadingElement();
        
        if (show) {
            submitButton.disabled = true;
            submitButton.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>جاري المعالجة...';
            
            if (!form.contains(loadingElement)) {
                form.appendChild(loadingElement);
            }
        } else {
            submitButton.disabled = false;
            submitButton.innerHTML = formType === 'login' ? 
                '<i class="fas fa-sign-in-alt me-2"></i>تسجيل الدخول' : 
                '<i class="fas fa-user-plus me-2"></i>إنشاء حساب';
            
            if (form.contains(loadingElement)) {
                loadingElement.remove();
            }
        }
    }

    /**
     * إنشاء عنصر التحميل
     * @method createLoadingElement
     */
    function createLoadingElement() {
        const element = document.createElement('div');
        element.className = 'auth-loading';
        element.innerHTML = `
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">جاري التحميل...</span>
            </div>
        `;
        return element;
    }

    /**
     * عرض تأكيد تسجيل الخروج
     * @method showLogoutConfirmation
     */
    async function showLogoutConfirmation() {
        return new Promise((resolve) => {
            // استخدام مربع حوار المتصفح
            const confirmed = confirm('هل أنت متأكد من تسجيل الخروج؟');
            resolve(confirmed);
            
            // أو استخدام مكتبة SweetAlert2 إذا كانت متوفرة
            /* 
            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    title: 'تسجيل الخروج',
                    text: 'هل أنت متأكد من تسجيل الخروج؟',
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonText: 'نعم',
                    cancelButtonText: 'إلغاء',
                    reverseButtons: true
                }).then((result) => {
                    resolve(result.isConfirmed);
                });
            } else {
                const confirmed = confirm('هل أنت متأكد من تسجيل الخروج؟');
                resolve(confirmed);
            }
            */
        });
    }

    /**
     * الحصول على رابط التوجيه
     * @method getRedirectUrl
     */
    function getRedirectUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        const redirect = urlParams.get('redirect');
        
        if (redirect) {
            // فك تشفير الرابط إذا كان مشفراً
            try {
                return decodeURIComponent(redirect);
            } catch (error) {
                console.warn('⚠️ رابط توجيه غير صالح:', redirect);
            }
        }
        
        return null;
    }

    /**
     * تتبع أحداث المصادقة
     * @method trackAuthEvent
     */
    function trackAuthEvent(eventName, data = {}) {
        const eventData = {
            ...data,
            timestamp: new Date().toISOString(),
            userId: state.currentUser?.id
        };
        
        // حفظ محلياً للتحليل
        saveAuthEvent(eventName, eventData);
        
        // إرسال للخادم إذا كان متصلاً
        if (navigator.onLine) {
            ApiManager.trackEvent(`auth_${eventName}`, eventData);
        }
    }

    /**
     * حفظ حدث المصادقة
     * @method saveAuthEvent
     */
    function saveAuthEvent(eventName, data) {
        try {
            const events = JSON.parse(localStorage.getItem('hadhramaut_auth_events') || '[]');
            events.push({
                event: eventName,
                data: data,
                timestamp: new Date().toISOString()
            });
            localStorage.setItem('hadhramaut_auth_events', JSON.stringify(events));
        } catch (error) {
            console.warn('⚠️ فشل حفظ حدث المصادقة:', error);
        }
    }

    // ========== إدارة التخزين المحلي ==========

    /**
     * حفظ الرمز محلياً
     * @method setStoredToken
     */
    function setStoredToken(token) {
        localStorage.setItem(config.tokenKey, token);
    }

    /**
     * الحصول على الرمز المحفوظ
     * @method getStoredToken
     */
    function getStoredToken() {
        return localStorage.getItem(config.tokenKey);
    }

    /**
     * حفظ بيانات المستخدم محلياً
     * @method setStoredUserData
     */
    function setStoredUserData(userData) {
        localStorage.setItem(config.userKey, JSON.stringify(userData));
    }

    /**
     * الحصول على بيانات المستخدم المحفوظة
     * @method getStoredUserData
     */
    function getStoredUserData() {
        try {
            const userJson = localStorage.getItem(config.userKey);
            return userJson ? JSON.parse(userJson) : null;
        } catch (error) {
            return null;
        }
    }

    /**
     * حفظ بيانات الجلسة
     * @method setStoredSession
     */
    function setStoredSession(sessionData) {
        localStorage.setItem(config.sessionKey, JSON.stringify(sessionData));
    }

    /**
     * الحصول على بيانات الجلسة
     * @method getStoredSession
     */
    function getStoredSession() {
        try {
            const sessionJson = localStorage.getItem(config.sessionKey);
            return sessionJson ? JSON.parse(sessionJson) : null;
        } catch (error) {
            return null;
        }
    }

    /**
     * حفظ رمز التجديد
     * @method setStoredRefreshToken
     */
    function setStoredRefreshToken(token) {
        localStorage.setItem(config.refreshTokenKey, token);
    }

    /**
     * الحصول على رمز التجديد
     * @method getStoredRefreshToken
     */
    function getStoredRefreshToken() {
        return localStorage.getItem(config.refreshTokenKey);
    }

    /**
     * مسح جميع البيانات المحفوظة
     * @method clearStoredData
     */
    function clearStoredData() {
        localStorage.removeItem(config.tokenKey);
        localStorage.removeItem(config.userKey);
        localStorage.removeItem(config.sessionKey);
        localStorage.removeItem(config.refreshTokenKey);
        localStorage.removeItem(config.tokenExpiryKey);
    }

    // ========== واجهة التصدير ==========

    return {
        // التهيئة
        init,
        config,
        state,
        
        // المصادقة
        login,
        register,
        logout,
        verifyToken,
        refreshToken,
        
        // إدارة المستخدم
        updateProfile,
        changePassword,
        resetPassword,
        
        // التحقق
        isAuthenticated: () => state.isAuthenticated,
        getCurrentUser: () => state.currentUser,
        hasPermission: (permission) => {
            if (!state.currentUser) return false;
            return state.currentUser.permissions?.includes(permission) || false;
        },
        hasRole: (role) => {
            if (!state.currentUser) return false;
            return state.currentUser.role === role;
        },
        
        // الأدوات المساعدة
        validateEmail,
        validatePassword,
        checkLoginRestrictions,
        
        // الواجهة
        showAuthError,
        showAuthSuccess,
        showAuthWarning,
        updateUI
    };
})();

/**
 * تهيئة نظام المصادقة عند تحميل الصفحة
 */
document.addEventListener('DOMContentLoaded', () => {
    AuthenticationSystem.init();
});

/**
 * تصدير نظام المصادقة للاستخدام العام
 */
window.AuthenticationSystem = AuthenticationSystem;

// تصدير افتراضي
export default AuthenticationSystem;
```
