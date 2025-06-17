/**
 * ===================================
 * LIKE TELECOM - SISTEMA DE GESTÃO DE ORDENS DE SERVIÇO
 * JavaScript Principal - Sistema Modular e Responsivo
 * ===================================
 * 
 * Funcionalidades:
 * - Sistema de autenticação e controle de sessão
 * - Gestão de ordens de serviço com sistema de prioridades
 * - Dashboard com métricas em tempo real
 * - Sistema de pontuação para técnicos e ajudantes
 * - Calendário com feriados nacionais
 * - Interface responsiva e intuitiva
 * - Preparado para integração com API backend
 */

// ===================================
// CONFIGURAÇÕES GLOBAIS
// ===================================
const CONFIG = {
    APP_NAME: 'Like Telecom',
    VERSION: '1.0.0',
    API_BASE_URL: '/api', // Será usado quando integrar com backend
    STORAGE_KEY: 'liketelecom_data',
    SESSION_KEY: 'liketelecom_session',

    // Tipos de ordem e pontuações
    ORDER_TYPES: {
        installation: { name: 'Instalação', points: 5, icon: 'fas fa-tools', color: 'blue' },
        support: { name: 'Suporte', points: 3, icon: 'fas fa-headset', color: 'green' },
        removal: { name: 'Remoção de Kit', points: 1, icon: 'fas fa-box', color: 'red' }
    },

    // Status das ordens
    ORDER_STATUS: {
        pending: { name: 'Pendente', color: 'yellow', icon: 'fas fa-clock' },
        executing: { name: 'Em Execução', color: 'orange', icon: 'fas fa-cog' },
        completed: { name: 'Finalizada', color: 'green', icon: 'fas fa-check-circle' }
    },

    // Tipos de usuário e permissões
    USER_TYPES: {
        admin: { 
            name: 'Administrador', 
            permissions: ['all'] 
        },
        attendant: { 
            name: 'Atendente', 
            permissions: ['orders_create', 'orders_read', 'orders_update', 'orders_priorities', 'reports_read'] 
        },
        technician: { 
            name: 'Técnico', 
            permissions: ['orders_execute', 'orders_read_own'] 
        },
        helper: { 
            name: 'Ajudante', 
            permissions: ['orders_read_assigned'] 
        }
    },

    // Feriados nacionais 2024 (será expandido dinamicamente)
    HOLIDAYS_2024: [
        '2024-01-01', // Confraternização Universal
        '2024-02-12', // Carnaval
        '2024-02-13', // Carnaval
        '2024-03-29', // Sexta-feira Santa
        '2024-04-21', // Tiradentes
        '2024-05-01', // Dia do Trabalhador
        '2024-09-07', // Independência do Brasil
        '2024-10-12', // Nossa Senhora Aparecida
        '2024-11-02', // Finados
        '2024-11-15', // Proclamação da República
        '2024-12-25'  // Natal
    ]
};

// ===================================
// ESTADO DA APLICAÇÃO
// ===================================
const AppState = {
    currentUser: null,
    orders: [],
    users: [],
    currentSection: 'dashboard',
    filters: {
        status: '',
        type: '',
        technician: ''
    },

    // Cache para performance
    cache: {
        metrics: null,
        rankings: null,
        lastUpdate: null
    }
};

// ===================================
// UTILITÁRIOS GERAIS
// ===================================
const Utils = {
    /**
     * Gera um ID único para novos registros
     */
    generateId() {
        return 'id_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
    },

    /**
     * Formata data para exibição
     */
    formatDate(date, format = 'dd/mm/yyyy') {
        if (!date) return '';
        const d = new Date(date);
        const day = d.getDate().toString().padStart(2, '0');
        const month = (d.getMonth() + 1).toString().padStart(2, '0');
        const year = d.getFullYear();
        const hours = d.getHours().toString().padStart(2, '0');
        const minutes = d.getMinutes().toString().padStart(2, '0');

        switch (format) {
            case 'dd/mm/yyyy':
                return `${day}/${month}/${year}`;
            case 'dd/mm/yyyy hh:mm':
                return `${day}/${month}/${year} ${hours}:${minutes}`;
            case 'yyyy-mm-dd':
                return `${year}-${month}-${day}`;
            default:
                return d.toLocaleDateString('pt-BR');
        }
    },

    /**
     * Formata nome para exibição
     */
    formatName(name) {
        if (!name) return '';
        return name.split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    },

    /**
     * Valida email
     */
    validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    },

    /**
     * Verifica se é feriado
     */
    isHoliday(date) {
        const dateStr = Utils.formatDate(date, 'yyyy-mm-dd');
        return CONFIG.HOLIDAYS_2024.includes(dateStr);
    },

    /**
     * Calcula diferença em dias
     */
    daysDifference(date1, date2) {
        const oneDay = 24 * 60 * 60 * 1000;
        return Math.round(Math.abs((new Date(date1) - new Date(date2)) / oneDay));
    },

    /**
     * Debounce function para otimizar performance
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
};

// ===================================
// GERENCIAMENTO DE DADOS (LOCAL STORAGE)
// ===================================
const DataManager = {
    /**
     * Salva dados no localStorage
     */
    save(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
            return true;
        } catch (error) {
            console.error('Erro ao salvar dados:', error);
            return false;
        }
    },

    /**
     * Carrega dados do localStorage
     */
    load(key) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('Erro ao carregar dados:', error);
            return null;
        }
    },

    /**
     * Remove dados do localStorage
     */
    remove(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.error('Erro ao remover dados:', error);
            return false;
        }
    },

    /**
     * Inicializa dados padrão se não existirem
     */
    initializeDefaultData() {
        // Usuários padrão
        const defaultUsers = [
            {
                id: 'admin001',
                name: 'Administrador Sistema',
                email: 'admin@liketelecom.com',
                password: '123456', // Em produção, usar hash
                type: 'admin',
                status: 'active',
                createdAt: new Date().toISOString()
            },
            {
                id: 'att001',
                name: 'Maria Silva',
                email: 'maria@liketelecom.com',
                password: '123456',
                type: 'attendant',
                status: 'active',
                createdAt: new Date().toISOString()
            },
            {
                id: 'tec001',
                name: 'João Santos',
                email: 'joao@liketelecom.com',
                password: '123456',
                type: 'technician',
                status: 'active',
                createdAt: new Date().toISOString()
            },
            {
                id: 'tec002',
                name: 'Pedro Costa',
                email: 'pedro@liketelecom.com',
                password: '123456',
                type: 'technician',
                status: 'active',
                createdAt: new Date().toISOString()
            },
            {
                id: 'ajd001',
                name: 'Carlos Oliveira',
                email: 'carlos@liketelecom.com',
                password: '123456',
                type: 'helper',
                status: 'active',
                createdAt: new Date().toISOString()
            }
        ];

        // Ordens de exemplo
        const defaultOrders = [
            {
                id: 'ord001',
                type: 'installation',
                client: {
                    name: 'Ana Pereira',
                    phone: '(11) 99999-1234',
                    email: 'ana@email.com',
                    address: 'Rua das Flores, 123 - Vila Madalena, São Paulo - SP',
                    cep: '05432-000'
                },
                status: 'pending',
                priority: 1,
                createdAt: new Date().toISOString(),
                scheduledDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                createdBy: 'att001',
                assignedTo: null,
                helper: null,
                notes: 'Instalação de fibra óptica 100MB',
                completedAt: null
            },
            {
                id: 'ord002',
                type: 'support',
                client: {
                    name: 'Roberto Silva',
                    phone: '(11) 98888-5678',
                    email: 'roberto@email.com',
                    address: 'Av. Paulista, 1000 - Bela Vista, São Paulo - SP',
                    cep: '01310-100'
                },
                status: 'pending',
                priority: 2,
                createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
                scheduledDate: new Date().toISOString(),
                createdBy: 'att001',
                assignedTo: null,
                helper: null,
                notes: 'Cliente relatando lentidão na conexão',
                completedAt: null
            }
        ];

        // Salvar dados padrão se não existirem
        if (!this.load(CONFIG.STORAGE_KEY)) {
            const initialData = {
                users: defaultUsers,
                orders: defaultOrders,
                settings: {
                    companyLogo: null,
                    initialized: true,
                    version: CONFIG.VERSION
                }
            };
            this.save(CONFIG.STORAGE_KEY, initialData);
        }
    },

    /**
     * Carrega todos os dados da aplicação
     */
    loadAppData() {
        const data = this.load(CONFIG.STORAGE_KEY) || {};
        AppState.users = data.users || [];
        AppState.orders = data.orders || [];
        return data;
    },

    /**
     * Salva estado atual da aplicação
     */
    saveAppData() {
        const data = {
            users: AppState.users,
            orders: AppState.orders,
            settings: {
                companyLogo: null,
                version: CONFIG.VERSION,
                lastUpdate: new Date().toISOString()
            }
        };
        return this.save(CONFIG.STORAGE_KEY, data);
    }
};

// ===================================
// SISTEMA DE AUTENTICAÇÃO
// ===================================
const AuthManager = {
    /**
     * Efetua login no sistema
     */
    async login(email, password, userType) {
        try {
            // Simular delay de rede
            await new Promise(resolve => setTimeout(resolve, 500));

            // Buscar usuário
            const user = AppState.users.find(u => 
                u.email === email && 
                u.password === password && 
                u.type === userType &&
                u.status === 'active'
            );

            if (!user) {
                throw new Error('Credenciais inválidas ou usuário inativo');
            }

            // Criar sessão
            const session = {
                userId: user.id,
                userType: user.type,
                userName: user.name,
                loginTime: new Date().toISOString(),
                expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString() // 8 horas
            };

            DataManager.save(CONFIG.SESSION_KEY, session);
            AppState.currentUser = { ...user, session };

            return { success: true, user: AppState.currentUser };

        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    /**
     * Efetua logout
     */
    logout() {
        DataManager.remove(CONFIG.SESSION_KEY);
        AppState.currentUser = null;
        window.location.reload();
    },

    /**
     * Verifica se há sessão ativa
     */
    checkSession() {
        const session = DataManager.load(CONFIG.SESSION_KEY);

        if (!session) return false;

        // Verificar se sessão expirou
        if (new Date() > new Date(session.expiresAt)) {
            this.logout();
            return false;
        }

        // Buscar dados do usuário
        const user = AppState.users.find(u => u.id === session.userId);
        if (!user || user.status !== 'active') {
            this.logout();
            return false;
        }

        AppState.currentUser = { ...user, session };
        return true;
    },

    /**
     * Verifica permissão do usuário atual
     */
    hasPermission(permission) {
        if (!AppState.currentUser) return false;

        const userType = AppState.currentUser.type;
        const userPermissions = CONFIG.USER_TYPES[userType]?.permissions || [];

        return userPermissions.includes('all') || userPermissions.includes(permission);
    },

    /**
     * Renova sessão
     */
    renewSession() {
        const session = DataManager.load(CONFIG.SESSION_KEY);
        if (session) {
            session.expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
            DataManager.save(CONFIG.SESSION_KEY, session);
        }
    }
};

// ===================================
// GERENCIAMENTO DE ORDENS DE SERVIÇO
// ===================================
const OrderManager = {
    /**
     * Cria nova ordem de serviço
     */
    createOrder(orderData) {
        try {
            const order = {
                id: Utils.generateId(),
                type: orderData.type,
                client: {
                    name: orderData.clientName,
                    phone: orderData.clientPhone,
                    email: orderData.clientEmail,
                    address: orderData.clientAddress,
                    cep: orderData.clientCep
                },
                status: 'pending',
                priority: this.getNextPriority(),
                createdAt: new Date().toISOString(),
                scheduledDate: orderData.scheduledDate,
                createdBy: AppState.currentUser.id,
                assignedTo: null,
                helper: null,
                notes: orderData.notes || '',
                completedAt: null
            };

            AppState.orders.push(order);
            DataManager.saveAppData();

            return { success: true, order };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    /**
     * Obtém próxima prioridade disponível
     */
    getNextPriority() {
        const pendingOrders = AppState.orders.filter(o => o.status === 'pending');
        const maxPriority = Math.max(...pendingOrders.map(o => o.priority), 0);
        return maxPriority + 1;
    },

    /**
     * Atualiza prioridades das ordens
     */
    updatePriorities(orderIds) {
        try {
            orderIds.forEach((orderId, index) => {
                const order = AppState.orders.find(o => o.id === orderId);
                if (order) {
                    order.priority = index + 1;
                }
            });

            DataManager.saveAppData();
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    /**
     * Técnico aceita ordem de serviço
     */
    acceptOrder(orderId, technicianId, helperId = null) {
        try {
            const order = AppState.orders.find(o => o.id === orderId);
            if (!order) {
                throw new Error('Ordem não encontrada');
            }

            if (order.status !== 'pending') {
                throw new Error('Ordem não está disponível para aceitar');
            }

            order.status = 'executing';
            order.assignedTo = technicianId;
            order.helper = helperId;
            order.startedAt = new Date().toISOString();

            DataManager.saveAppData();
            return { success: true, order };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    /**
     * Finaliza ordem de serviço
     */
    completeOrder(orderId, completionData) {
        try {
            const order = AppState.orders.find(o => o.id === orderId);
            if (!order) {
                throw new Error('Ordem não encontrada');
            }

            if (order.status !== 'executing') {
                throw new Error('Ordem não está em execução');
            }

            order.status = 'completed';
            order.completedAt = new Date().toISOString();
            order.completionNotes = completionData.notes || '';
            order.executionTime = completionData.executionTime || '';
            order.equipmentUsed = completionData.equipment || '';

            // Calcular pontos para técnico e ajudante
            const points = CONFIG.ORDER_TYPES[order.type].points;
            this.addPointsToUser(order.assignedTo, points);
            if (order.helper) {
                this.addPointsToUser(order.helper, points);
            }

            DataManager.saveAppData();
            return { success: true, order };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    /**
     * Retorna ordem para pendente
     */
    returnToPending(orderId, justification) {
        try {
            const order = AppState.orders.find(o => o.id === orderId);
            if (!order) {
                throw new Error('Ordem não encontrada');
            }

            order.status = 'pending';
            order.assignedTo = null;
            order.helper = null;
            order.justification = justification;
            order.returnedAt = new Date().toISOString();

            // Mover para o final da fila de prioridades
            const pendingOrders = AppState.orders.filter(o => o.status === 'pending' && o.id !== orderId);
            const maxPriority = Math.max(...pendingOrders.map(o => o.priority), 0);
            order.priority = maxPriority + 1;

            DataManager.saveAppData();
            return { success: true, order };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    /**
     * Adiciona pontos a um usuário
     */
    addPointsToUser(userId, points) {
        const user = AppState.users.find(u => u.id === userId);
        if (user) {
            const currentMonth = new Date().getMonth();
            const currentYear = new Date().getFullYear();

            if (!user.monthlyPoints) {
                user.monthlyPoints = {};
            }

            const monthKey = `${currentYear}-${currentMonth}`;
            if (!user.monthlyPoints[monthKey]) {
                user.monthlyPoints[monthKey] = 0;
            }

            user.monthlyPoints[monthKey] += points;
        }
    },

    /**
     * Obtém ordens filtradas
     */
    getFilteredOrders(filters = {}) {
        let filteredOrders = [...AppState.orders];

        if (filters.status) {
            filteredOrders = filteredOrders.filter(o => o.status === filters.status);
        }

        if (filters.type) {
            filteredOrders = filteredOrders.filter(o => o.type === filters.type);
        }

        if (filters.technician) {
            filteredOrders = filteredOrders.filter(o => o.assignedTo === filters.technician);
        }

        // Para técnicos: mostrar apenas ordens próprias ou próxima da fila
        if (AppState.currentUser?.type === 'technician') {
            const ownOrders = filteredOrders.filter(o => o.assignedTo === AppState.currentUser.id);
            const nextPending = this.getNextPendingOrder();

            if (nextPending && !ownOrders.find(o => o.id === nextPending.id)) {
                return [...ownOrders, nextPending];
            }
            return ownOrders;
        }

        // Para ajudantes: apenas ordens onde está designado
        if (AppState.currentUser?.type === 'helper') {
            filteredOrders = filteredOrders.filter(o => o.helper === AppState.currentUser.id);
        }

        return filteredOrders.sort((a, b) => {
            if (a.status === 'pending' && b.status === 'pending') {
                return a.priority - b.priority;
            }
            return new Date(b.createdAt) - new Date(a.createdAt);
        });
    },

    /**
     * Obtém próxima ordem pendente por prioridade
     */
    getNextPendingOrder() {
        const pendingOrders = AppState.orders
            .filter(o => o.status === 'pending')
            .sort((a, b) => a.priority - b.priority);

        return pendingOrders[0] || null;
    }
};

// ===================================
// GERENCIAMENTO DE USUÁRIOS
// ===================================
const UserManager = {
    /**
     * Cria novo usuário (apenas Admin)
     */
    createUser(userData) {
        try {
            if (!AuthManager.hasPermission('all')) {
                throw new Error('Sem permissão para criar usuários');
            }

            // Verificar se email já existe
            const existingUser = AppState.users.find(u => u.email === userData.email);
            if (existingUser) {
                throw new Error('Email já cadastrado');
            }

            const user = {
                id: Utils.generateId(),
                name: userData.name,
                email: userData.email,
                password: userData.password, // Em produção, usar hash
                type: userData.type,
                status: 'active',
                createdAt: new Date().toISOString(),
                monthlyPoints: {}
            };

            AppState.users.push(user);
            DataManager.saveAppData();

            return { success: true, user };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    /**
     * Atualiza usuário
     */
    updateUser(userId, userData) {
        try {
            if (!AuthManager.hasPermission('all')) {
                throw new Error('Sem permissão para editar usuários');
            }

            const user = AppState.users.find(u => u.id === userId);
            if (!user) {
                throw new Error('Usuário não encontrado');
            }

            // Verificar se novo email já existe em outro usuário
            if (userData.email && userData.email !== user.email) {
                const existingUser = AppState.users.find(u => u.email === userData.email && u.id !== userId);
                if (existingUser) {
                    throw new Error('Email já cadastrado');
                }
            }

            Object.assign(user, {
                ...userData,
                updatedAt: new Date().toISOString()
            });

            DataManager.saveAppData();
            return { success: true, user };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    /**
     * Obtém ranking de usuários por pontuação
     */
    getRankings() {
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        const monthKey = `${currentYear}-${currentMonth}`;

        const technicians = AppState.users
            .filter(u => u.type === 'technician' && u.status === 'active')
            .map(u => ({
                ...u,
                points: u.monthlyPoints?.[monthKey] || 0
            }))
            .sort((a, b) => b.points - a.points);

        const helpers = AppState.users
            .filter(u => u.type === 'helper' && u.status === 'active')
            .map(u => ({
                ...u,
                points: u.monthlyPoints?.[monthKey] || 0
            }))
            .sort((a, b) => b.points - a.points);

        return { technicians, helpers };
    }
};

// ===================================
// SISTEMA DE NOTIFICAÇÕES
// ===================================
const NotificationManager = {
    /**
     * Mostra notificação na tela
     */
    show(message, type = 'info', duration = 5000) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div class="flex items-center justify-between">
                <span>${message}</span>
                <button class="ml-4 text-white hover:text-gray-200" onclick="this.parentElement.parentElement.remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;

        document.body.appendChild(notification);

        // Mostrar notificação
        setTimeout(() => notification.classList.add('show'), 100);

        // Remover automaticamente
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, duration);
    },

    /**
     * Notificação de sucesso
     */
    success(message) {
        this.show(message, 'success');
    },

    /**
     * Notificação de erro
     */
    error(message) {
        this.show(message, 'error');
    },

    /**
     * Notificação de aviso
     */
    warning(message) {
        this.show(message, 'warning');
    },

    /**
     * Notificação de informação
     */
    info(message) {
        this.show(message, 'info');
    }
};

// ===================================
// CALENDÁRIO COM FERIADOS
// ===================================
const CalendarManager = {
    /**
     * Gera calendário para um mês específico
     */
    generateCalendar(year, month) {
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDayOfWeek = firstDay.getDay();

        const calendar = [];
        const today = new Date();

        // Dias do mês anterior para preencher início
        for (let i = startingDayOfWeek - 1; i >= 0; i--) {
            const prevMonthDay = new Date(year, month, -i);
            calendar.push({
                date: prevMonthDay,
                isCurrentMonth: false,
                isToday: false,
                isHoliday: Utils.isHoliday(prevMonthDay),
                isDisabled: true
            });
        }

        // Dias do mês atual
        for (let day = 1; day <= daysInMonth; day++) {
            const currentDate = new Date(year, month, day);
            const isToday = currentDate.toDateString() === today.toDateString();
            const isHoliday = Utils.isHoliday(currentDate);

            calendar.push({
                date: currentDate,
                isCurrentMonth: true,
                isToday,
                isHoliday,
                isDisabled: isHoliday || currentDate < today
            });
        }

        // Dias do próximo mês para preencher final
        const remainingDays = 42 - calendar.length; // 6 semanas * 7 dias
        for (let day = 1; day <= remainingDays; day++) {
            const nextMonthDay = new Date(year, month + 1, day);
            calendar.push({
                date: nextMonthDay,
                isCurrentMonth: false,
                isToday: false,
                isHoliday: Utils.isHoliday(nextMonthDay),
                isDisabled: true
            });
        }

        return calendar;
    },

    /**
     * Verifica se data pode ser agendada
     */
    canSchedule(date) {
        const targetDate = new Date(date);
        const today = new Date();

        // Não pode agendar no passado
        if (targetDate < today) return false;

        // Não pode agendar em feriados
        if (Utils.isHoliday(targetDate)) return false;

        return true;
    }
};

// ===================================
// INTERFACE E CONTROLE DE UI
// ===================================
const UIManager = {
    /**
     * Inicializa a interface
     */
    init() {
        this.setupEventListeners();
        this.setupSidebar();
        this.updateUserInterface();
    },

    /**
     * Configura event listeners
     */
    setupEventListeners() {
        // Login form
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', this.handleLogin.bind(this));
        }

        // Logout button
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', AuthManager.logout);
        }

        // Navigation links
        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const section = link.getAttribute('href').substring(1);
                this.showSection(section);
            });
        });

        // Mobile menu toggle
        const menuToggle = document.getElementById('menuToggle');
        const sidebar = document.getElementById('sidebar');
        const sidebarOverlay = document.getElementById('sidebarOverlay');

        if (menuToggle && sidebar && sidebarOverlay) {
            menuToggle.addEventListener('click', () => {
                sidebar.classList.toggle('-translate-x-full');
                sidebarOverlay.classList.toggle('hidden');
            });

            sidebarOverlay.addEventListener('click', () => {
                sidebar.classList.add('-translate-x-full');
                sidebarOverlay.classList.add('hidden');
            });
        }

        // Order filters
        const statusFilter = document.getElementById('statusFilter');
        const typeFilter = document.getElementById('typeFilter');
        const technicianFilter = document.getElementById('technicianFilter');

        [statusFilter, typeFilter, technicianFilter].forEach(filter => {
            if (filter) {
                filter.addEventListener('change', Utils.debounce(() => {
                    this.updateOrderFilters();
                    this.renderOrders();
                }, 300));
            }
        });

        // New order button
        const newOrderBtn = document.getElementById('newOrderBtn');
        if (newOrderBtn) {
            newOrderBtn.addEventListener('click', () => this.showNewOrderModal());
        }

        // Manage priorities button
        const managePrioritiesBtn = document.getElementById('managePrioritiesBtn');
        if (managePrioritiesBtn) {
            managePrioritiesBtn.addEventListener('click', () => this.showManagePrioritiesModal());
        }

        // Modal close buttons
        const closeButtons = document.querySelectorAll('[id$="Modal"] .fa-times');
        closeButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modal = e.target.closest('[id$="Modal"]');
                if (modal) modal.classList.add('hidden');
            });
        });
    },

    /**
     * Configura sidebar responsiva
     */
    setupSidebar() {
        const sidebar = document.getElementById('sidebar');
        if (window.innerWidth >= 1024) {
            sidebar.classList.remove('-translate-x-full');
        }

        window.addEventListener('resize', () => {
            if (window.innerWidth >= 1024) {
                sidebar.classList.remove('-translate-x-full');
                document.getElementById('sidebarOverlay').classList.add('hidden');
            }
        });
    },

    /**
     * Atualiza interface baseada no usuário logado
     */
    updateUserInterface() {
        if (!AppState.currentUser) return;

        const userInfo = document.getElementById('userInfo');
        if (userInfo) {
            userInfo.textContent = `${AppState.currentUser.name} (${CONFIG.USER_TYPES[AppState.currentUser.type].name})`;
        }

        // Mostrar/ocultar menus baseado em permissões
        const usersMenu = document.getElementById('usersMenu');
        const reportsMenu = document.getElementById('reportsMenu');
        const newOrderBtn = document.getElementById('newOrderBtn');
        const managePrioritiesBtn = document.getElementById('managePrioritiesBtn');
        const rankingsSection = document.getElementById('rankingsSection');

        // Admin vê tudo
        if (AppState.currentUser.type === 'admin') {
            usersMenu?.classList.remove('hidden');
            reportsMenu?.classList.remove('hidden');
            newOrderBtn?.classList.remove('hidden');
            managePrioritiesBtn?.classList.remove('hidden');
            rankingsSection?.classList.remove('hidden');
        } 
        // Atendente vê ordens e relatórios
        else if (AppState.currentUser.type === 'attendant') {
            newOrderBtn?.classList.remove('hidden');
            managePrioritiesBtn?.classList.remove('hidden');
            reportsMenu?.classList.remove('hidden');
            rankingsSection?.classList.remove('hidden');
        }
        // Técnico e ajudante interface limitada
        else {
            usersMenu?.classList.add('hidden');
            reportsMenu?.classList.add('hidden');
            newOrderBtn?.classList.add('hidden');
            managePrioritiesBtn?.classList.add('hidden');
            rankingsSection?.classList.add('hidden');
        }
    },

    /**
     * Mostra seção específica
     */
    showSection(sectionName) {
        // Ocultar todas as seções
        const sections = document.querySelectorAll('.content-section');
        sections.forEach(section => section.classList.add('hidden'));

        // Remover classe active de todos os links
        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => link.classList.remove('active'));

        // Mostrar seção selecionada
        const targetSection = document.getElementById(`${sectionName}Section`);
        if (targetSection) {
            targetSection.classList.remove('hidden');
            targetSection.classList.add('fade-in');
        }

        // Adicionar classe active no link atual
        const activeLink = document.querySelector(`a[href="#${sectionName}"]`);
        if (activeLink) {
            activeLink.classList.add('active');
        }

        AppState.currentSection = sectionName;

        // Carregar dados da seção
        switch (sectionName) {
            case 'dashboard':
                this.renderDashboard();
                break;
            case 'orders':
                this.renderOrders();
                break;
            case 'users':
                this.renderUsers();
                break;
            case 'calendar':
                this.renderCalendar();
                break;
            case 'reports':
                this.renderReports();
                break;
        }
    },

    /**
     * Manipula login
     */
    async handleLogin(e) {
        e.preventDefault();

        const form = e.target;
        const submitBtn = form.querySelector('button[type="submit"]');
        const messageDiv = document.getElementById('loginMessage');

        // Mostrar loading
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Entrando...';
        messageDiv.classList.add('hidden');

        const formData = new FormData(form);
        const email = formData.get('email');
        const password = formData.get('password');
        const userType = formData.get('userType');

        const result = await AuthManager.login(email, password, userType);

        if (result.success) {
            // Login bem-sucedido
            document.getElementById('loginScreen').classList.add('hidden');
            document.getElementById('mainApp').classList.remove('hidden');
            this.updateUserInterface();
            this.showSection('dashboard');
            NotificationManager.success(`Bem-vindo, ${result.user.name}!`);
        } else {
            // Erro no login
            messageDiv.textContent = result.error;
            messageDiv.className = 'mt-4 text-center text-sm text-red-600';
            messageDiv.classList.remove('hidden');
        }

        // Restaurar botão
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-sign-in-alt mr-2"></i>Entrar';
    },

    /**
     * Renderiza dashboard
     */
    renderDashboard() {
        this.updateMetrics();
        if (AuthManager.hasPermission('reports_read') || AuthManager.hasPermission('all')) {
            this.updateRankings();
        }
    },

    /**
     * Atualiza métricas do dashboard
     */
    updateMetrics() {
        const today = new Date();
        const todayStr = Utils.formatDate(today, 'yyyy-mm-dd');
        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();

        // Contar ordens
        const pendingOrders = AppState.orders.filter(o => o.status === 'pending');
        const executingOrders = AppState.orders.filter(o => o.status === 'executing');
        const completedToday = AppState.orders.filter(o => 
            o.status === 'completed' && 
            Utils.formatDate(o.completedAt, 'yyyy-mm-dd') === todayStr
        );
        const monthlyOrders = AppState.orders.filter(o => {
            const orderDate = new Date(o.createdAt);
            return orderDate.getMonth() === currentMonth && orderDate.getFullYear() === currentYear;
        });

        // Atualizar elementos
        document.getElementById('pendingCount').textContent = pendingOrders.length;
        document.getElementById('executingCount').textContent = executingOrders.length;
        document.getElementById('completedCount').textContent = completedToday.length;
        document.getElementById('monthlyCount').textContent = monthlyOrders.length;
    },

    /**
     * Atualiza rankings
     */
    updateRankings() {
        const rankings = UserManager.getRankings();

        this.renderRanking('techniciansRanking', rankings.technicians);
        this.renderRanking('helpersRanking', rankings.helpers);
    },

    /**
     * Renderiza ranking específico
     */
    renderRanking(containerId, users) {
        const container = document.getElementById(containerId);
        if (!container) return;

        if (users.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-center">Nenhum usuário encontrado</p>';
            return;
        }

        container.innerHTML = users.slice(0, 5).map((user, index) => {
            const positionClass = index === 0 ? 'first' : index === 1 ? 'second' : index === 2 ? 'third' : 'other';
            return `
                <div class="ranking-item">
                    <div class="ranking-position ${positionClass}">
                        ${index + 1}
                    </div>
                    <div class="flex-1">
                        <div class="font-semibold text-gray-800">${user.name}</div>
                        <div class="text-sm text-gray-600">${user.points} pontos</div>
                    </div>
                    ${index === 0 ? '<i class="fas fa-crown text-yellow-500"></i>' : ''}
                </div>
            `;
        }).join('');
    },

    /**
     * Atualiza filtros de ordens
     */
    updateOrderFilters() {
        const statusFilter = document.getElementById('statusFilter');
        const typeFilter = document.getElementById('typeFilter');
        const technicianFilter = document.getElementById('technicianFilter');

        AppState.filters = {
            status: statusFilter?.value || '',
            type: typeFilter?.value || '',
            technician: technicianFilter?.value || ''
        };

        // Povoar filtro de técnicos
        if (technicianFilter && technicianFilter.children.length <= 1) {
            const technicians = AppState.users.filter(u => u.type === 'technician' && u.status === 'active');
            technicians.forEach(tech => {
                const option = document.createElement('option');
                option.value = tech.id;
                option.textContent = tech.name;
                technicianFilter.appendChild(option);
            });
        }
    },

    /**
     * Renderiza lista de ordens
     */
    renderOrders() {
        const ordersList = document.getElementById('ordersList');
        if (!ordersList) return;

        const filteredOrders = OrderManager.getFilteredOrders(AppState.filters);

        if (filteredOrders.length === 0) {
            ordersList.innerHTML = `
                <div class="p-8 text-center text-gray-500">
                    <i class="fas fa-clipboard-list text-4xl mb-4"></i>
                    <p class="text-lg">Nenhuma ordem de serviço encontrada</p>
                    <p class="text-sm">Ajuste os filtros ou crie uma nova ordem</p>
                </div>
            `;
            return;
        }

        ordersList.innerHTML = filteredOrders.map(order => this.renderOrderCard(order)).join('');
    },

    /**
     * Renderiza card de ordem individual
     */
    renderOrderCard(order) {
        const orderType = CONFIG.ORDER_TYPES[order.type];
        const orderStatus = CONFIG.ORDER_STATUS[order.status];
        const assignedUser = order.assignedTo ? AppState.users.find(u => u.id === order.assignedTo) : null;
        const helperUser = order.helper ? AppState.users.find(u => u.id === order.helper) : null;

        return `
            <div class="order-card priority-${order.priority}" data-order-id="${order.id}">
                <div class="flex items-start justify-between">
                    <div class="flex-1">
                        <div class="flex items-center space-x-3 mb-2">
                            <div class="priority-indicator priority-${order.priority <= 3 ? order.priority === 1 ? 'high' : order.priority === 2 ? 'medium' : 'low' : 'low'}"></div>
                            <div>
                                <span class="text-sm font-semibold text-gray-600">OS #${order.id.slice(-6)}</span>
                                <span class="status-badge status-${order.status} ml-2">${orderStatus.name}</span>
                            </div>
                            <div class="text-right">
                                <span class="text-xs text-gray-500">Prioridade ${order.priority}</span>
                            </div>
                        </div>

                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                            <div>
                                <h4 class="font-semibold text-gray-800 mb-1">
                                    <i class="${orderType.icon} mr-2 text-${orderType.color}-600"></i>
                                    ${orderType.name} (${orderType.points} pts)
                                </h4>
                                <p class="text-gray-600">${order.client.name}</p>
                                <p class="text-sm text-gray-500">${order.client.phone}</p>
                            </div>
                            <div>
                                <p class="text-sm text-gray-600 mb-1">
                                    <i class="fas fa-map-marker-alt mr-1"></i>
                                    ${order.client.address}
                                </p>
                                <p class="text-sm text-gray-500">
                                    <i class="fas fa-calendar mr-1"></i>
                                    Agendado: ${Utils.formatDate(order.scheduledDate, 'dd/mm/yyyy')}
                                </p>
                            </div>
                        </div>

                        ${assignedUser ? `
                            <div class="flex items-center space-x-4 text-sm text-gray-600 mb-2">
                                <span><i class="fas fa-user mr-1"></i>Técnico: ${assignedUser.name}</span>
                                ${helperUser ? `<span><i class="fas fa-user-friends mr-1"></i>Ajudante: ${helperUser.name}</span>` : ''}
                            </div>
                        ` : ''}

                        ${order.notes ? `
                            <p class="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                                <i class="fas fa-sticky-note mr-1"></i>
                                ${order.notes}
                            </p>
                        ` : ''}
                    </div>

                    <div class="flex flex-col space-y-2 ml-4">
                        ${this.getOrderActions(order)}
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Obtém ações disponíveis para uma ordem
     */
    getOrderActions(order) {
        const actions = [];

        // Botão de ver detalhes (todos podem ver)
        actions.push(`
            <button onclick="UIManager.showOrderDetails('${order.id}')" 
                    class="btn btn-outline text-xs px-3 py-1">
                <i class="fas fa-eye mr-1"></i>Detalhes
            </button>
        `);

        // Ações específicas por status e permissão
        if (order.status === 'pending') {
            // Técnico pode aceitar se for a próxima da fila
            if (AppState.currentUser?.type === 'technician') {
                const nextOrder = OrderManager.getNextPendingOrder();
                if (nextOrder && nextOrder.id === order.id) {
                    actions.push(`
                        <button onclick="UIManager.acceptOrder('${order.id}')" 
                                class="btn btn-primary text-xs px-3 py-1">
                            <i class="fas fa-play mr-1"></i>Aceitar
                        </button>
                    `);
                }
            }

            // Admin/Atendente pode editar
            if (AuthManager.hasPermission('orders_update') || AuthManager.hasPermission('all')) {
                actions.push(`
                    <button onclick="UIManager.editOrder('${order.id}')" 
                            class="btn btn-secondary text-xs px-3 py-1">
                        <i class="fas fa-edit mr-1"></i>Editar
                    </button>
                `);
            }
        } else if (order.status === 'executing' && order.assignedTo === AppState.currentUser?.id) {
            // Técnico pode finalizar ou retornar para pendente
            actions.push(`
                <button onclick="UIManager.completeOrder('${order.id}')" 
                        class="btn btn-primary text-xs px-3 py-1">
                    <i class="fas fa-check mr-1"></i>Finalizar
                </button>
            `);
            actions.push(`
                <button onclick="UIManager.returnToPending('${order.id}')" 
                        class="btn btn-secondary text-xs px-3 py-1">
                    <i class="fas fa-undo mr-1"></i>Não finalizada
                </button>
            `);
        }

        return actions.join('');
    }
};

// ===================================
// FUNÇÕES DE MODAL E INTERAÇÕES
// ===================================

// Extensão do UIManager para incluir funções de modal
Object.assign(UIManager, {
    /**
     * Mostra modal de nova ordem
     */
    showNewOrderModal() {
        if (!AuthManager.hasPermission('orders_create') && !AuthManager.hasPermission('all')) {
            NotificationManager.error('Sem permissão para criar ordens');
            return;
        }

        const modal = document.getElementById('newOrderModal');
        const form = document.getElementById('newOrderForm');

        // Gerar formulário
        form.innerHTML = `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label class="form-label">Tipo de Serviço</label>
                    <select name="type" required class="form-input">
                        <option value="">Selecione o tipo</option>
                        <option value="installation">Instalação (5 pontos)</option>
                        <option value="support">Suporte (3 pontos)</option>
                        <option value="removal">Remoção de Kit (1 ponto)</option>
                    </select>
                </div>
                <div>
                    <label class="form-label">Data de Agendamento</label>
                    <input type="date" name="scheduledDate" required class="form-input" 
                           min="${Utils.formatDate(new Date(), 'yyyy-mm-dd')}">
                </div>
            </div>

            <div class="form-group">
                <label class="form-label">Nome do Cliente</label>
                <input type="text" name="clientName" required class="form-input">
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label class="form-label">Telefone</label>
                    <input type="tel" name="clientPhone" required class="form-input" 
                           placeholder="(11) 99999-9999">
                </div>
                <div>
                    <label class="form-label">Email</label>
                    <input type="email" name="clientEmail" class="form-input">
                </div>
            </div>

            <div class="form-group">
                <label class="form-label">Endereço Completo</label>
                <textarea name="clientAddress" required class="form-input" rows="3"></textarea>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label class="form-label">CEP</label>
                    <input type="text" name="clientCep" required class="form-input" 
                           placeholder="00000-000">
                </div>
            </div>

            <div class="form-group">
                <label class="form-label">Observações</label>
                <textarea name="notes" class="form-input" rows="3" 
                          placeholder="Detalhes específicos do serviço..."></textarea>
            </div>

            <div class="flex justify-end space-x-3 mt-6">
                <button type="button" onclick="document.getElementById('newOrderModal').classList.add('hidden')" 
                        class="btn btn-outline">Cancelar</button>
                <button type="submit" class="btn btn-primary">Criar Ordem</button>
            </div>
        `;

        // Event listener para submissão
        form.onsubmit = (e) => {
            e.preventDefault();
            this.handleCreateOrder(new FormData(form));
        };

        modal.classList.remove('hidden');
    },

    /**
     * Processa criação de nova ordem
     */
    async handleCreateOrder(formData) {
        const orderData = Object.fromEntries(formData);

        // Validar data de agendamento
        if (!CalendarManager.canSchedule(orderData.scheduledDate)) {
            NotificationManager.error('Data selecionada não pode ser agendada (feriado ou data passada)');
            return;
        }

        const result = OrderManager.createOrder(orderData);

        if (result.success) {
            NotificationManager.success('Ordem de serviço criada com sucesso!');
            document.getElementById('newOrderModal').classList.add('hidden');
            this.renderOrders();
            this.updateMetrics();
        } else {
            NotificationManager.error(`Erro ao criar ordem: ${result.error}`);
        }
    },

    /**
     * Mostra detalhes da ordem
     */
    showOrderDetails(orderId) {
        const order = AppState.orders.find(o => o.id === orderId);
        if (!order) return;

        const modal = document.getElementById('orderDetailsModal');
        const content = document.getElementById('orderDetailsContent');

        const orderType = CONFIG.ORDER_TYPES[order.type];
        const orderStatus = CONFIG.ORDER_STATUS[order.status];
        const assignedUser = order.assignedTo ? AppState.users.find(u => u.id === order.assignedTo) : null;
        const helperUser = order.helper ? AppState.users.find(u => u.id === order.helper) : null;
        const createdByUser = AppState.users.find(u => u.id === order.createdBy);

        content.innerHTML = `
            <div class="space-y-6">
                <div class="flex items-center justify-between">
                    <h3 class="text-xl font-bold text-gray-800">OS #${order.id.slice(-6)}</h3>
                    <span class="status-badge status-${order.status}">${orderStatus.name}</span>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <h4 class="font-semibold text-gray-800 mb-3">Informações do Serviço</h4>
                        <div class="space-y-2">
                            <p><strong>Tipo:</strong> 
                                <i class="${orderType.icon} mr-1"></i>
                                ${orderType.name} (${orderType.points} pontos)
                            </p>
                            <p><strong>Prioridade:</strong> ${order.priority}</p>
                            <p><strong>Data de Criação:</strong> ${Utils.formatDate(order.createdAt, 'dd/mm/yyyy hh:mm')}</p>
                            <p><strong>Agendamento:</strong> ${Utils.formatDate(order.scheduledDate, 'dd/mm/yyyy')}</p>
                            <p><strong>Criado por:</strong> ${createdByUser?.name || 'N/A'}</p>
                        </div>
                    </div>

                    <div>
                        <h4 class="font-semibold text-gray-800 mb-3">Dados do Cliente</h4>
                        <div class="space-y-2">
                            <p><strong>Nome:</strong> ${order.client.name}</p>
                            <p><strong>Telefone:</strong> ${order.client.phone}</p>
                            ${order.client.email ? `<p><strong>Email:</strong> ${order.client.email}</p>` : ''}
                            <p><strong>Endereço:</strong> ${order.client.address}</p>
                            ${order.client.cep ? `<p><strong>CEP:</strong> ${order.client.cep}</p>` : ''}
                        </div>
                    </div>
                </div>

                ${assignedUser || helperUser ? `
                    <div>
                        <h4 class="font-semibold text-gray-800 mb-3">Equipe Designada</h4>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            ${assignedUser ? `
                                <div class="bg-gray-50 p-3 rounded">
                                    <p class="font-medium">Técnico Responsável</p>
                                    <p class="text-gray-600">${assignedUser.name}</p>
                                </div>
                            ` : ''}
                            ${helperUser ? `
                                <div class="bg-gray-50 p-3 rounded">
                                    <p class="font-medium">Ajudante</p>
                                    <p class="text-gray-600">${helperUser.name}</p>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                ` : ''}

                ${order.notes ? `
                    <div>
                        <h4 class="font-semibold text-gray-800 mb-3">Observações</h4>
                        <div class="bg-gray-50 p-3 rounded">
                            <p class="text-gray-600">${order.notes}</p>
                        </div>
                    </div>
                ` : ''}

                ${order.completionNotes ? `
                    <div>
                        <h4 class="font-semibold text-gray-800 mb-3">Relatório de Execução</h4>
                        <div class="bg-green-50 p-3 rounded">
                            <p class="text-gray-600">${order.completionNotes}</p>
                            ${order.executionTime ? `<p class="text-sm text-gray-500 mt-2">Tempo de execução: ${order.executionTime}</p>` : ''}
                            ${order.equipmentUsed ? `<p class="text-sm text-gray-500">Equipamentos: ${order.equipmentUsed}</p>` : ''}
                        </div>
                    </div>
                ` : ''}

                ${order.justification ? `
                    <div>
                        <h4 class="font-semibold text-gray-800 mb-3">Justificativa de Não Finalização</h4>
                        <div class="bg-yellow-50 p-3 rounded">
                            <p class="text-gray-600">${order.justification}</p>
                        </div>
                    </div>
                ` : ''}

                <div class="flex justify-end">
                    <button onclick="document.getElementById('orderDetailsModal').classList.add('hidden')" 
                            class="btn btn-outline">Fechar</button>
                </div>
            </div>
        `;

        modal.classList.remove('hidden');
    },

    /**
     * Técnico aceita ordem
     */
    async acceptOrder(orderId) {
        // Mostrar seleção de ajudante
        const helpers = AppState.users.filter(u => u.type === 'helper' && u.status === 'active');

        let helperId = null;
        if (helpers.length > 0) {
            const helperOptions = helpers.map(h => `<option value="${h.id}">${h.name}</option>`).join('');
            const select = document.createElement('select');
            select.innerHTML = `<option value="">Sem ajudante</option>${helperOptions}`;
            select.className = 'form-input';

            // Criar modal simples para seleção
            const modalHtml = `
                <div class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
                    <div class="bg-white rounded-lg p-6 w-96">
                        <h3 class="text-lg font-semibold mb-4">Selecionar Ajudante</h3>
                        <div class="mb-4">
                            <label class="form-label">Ajudante (opcional)</label>
                            ${select.outerHTML}
                        </div>
                        <div class="flex justify-end space-x-3">
                            <button onclick="this.closest('.fixed').remove()" class="btn btn-outline">Cancelar</button>
                            <button onclick="UIManager.confirmAcceptOrder('${orderId}', this.closest('.fixed').querySelector('select').value)" 
                                    class="btn btn-primary">Aceitar Ordem</button>
                        </div>
                    </div>
                </div>
            `;

            document.body.insertAdjacentHTML('beforeend', modalHtml);
        } else {
            this.confirmAcceptOrder(orderId, null);
        }
    },

    /**
     * Confirma aceitação da ordem
     */
    confirmAcceptOrder(orderId, helperId) {
        const result = OrderManager.acceptOrder(orderId, AppState.currentUser.id, helperId);

        // Remover modal de seleção se existir
        document.querySelectorAll('.fixed.inset-0').forEach(modal => modal.remove());

        if (result.success) {
            NotificationManager.success('Ordem aceita com sucesso!');
            this.renderOrders();
            this.updateMetrics();
        } else {
            NotificationManager.error(`Erro ao aceitar ordem: ${result.error}`);
        }
    },

    /**
     * Finaliza ordem de serviço
     */
    completeOrder(orderId) {
        const modalHtml = `
            <div class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
                <div class="bg-white rounded-lg p-6 w-full max-w-2xl mx-4">
                    <h3 class="text-lg font-semibold mb-4">Finalizar Ordem de Serviço</h3>
                    <form id="completeOrderForm" class="space-y-4">
                        <div>
                            <label class="form-label">Serviço Realizado</label>
                            <textarea name="notes" required class="form-input" rows="3" 
                                      placeholder="Descreva o serviço realizado..."></textarea>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label class="form-label">Tempo de Execução</label>
                                <input type="text" name="executionTime" class="form-input" 
                                       placeholder="Ex: 2h 30min">
                            </div>
                            <div>
                                <label class="form-label">Equipamentos Utilizados</label>
                                <input type="text" name="equipment" class="form-input" 
                                       placeholder="Ex: Roteador X, Cabo 50m">
                            </div>
                        </div>
                        <div class="flex justify-end space-x-3 mt-6">
                            <button type="button" onclick="this.closest('.fixed').remove()" 
                                    class="btn btn-outline">Cancelar</button>
                            <button type="submit" class="btn btn-primary">Finalizar Ordem</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        document.getElementById('completeOrderForm').onsubmit = (e) => {
            e.preventDefault();
            const formData = Object.fromEntries(new FormData(e.target));

            const result = OrderManager.completeOrder(orderId, formData);

            document.querySelectorAll('.fixed.inset-0').forEach(modal => modal.remove());

            if (result.success) {
                NotificationManager.success('Ordem finalizada com sucesso!');
                this.renderOrders();
                this.updateMetrics();
            } else {
                NotificationManager.error(`Erro ao finalizar ordem: ${result.error}`);
            }
        };
    },

    /**
     * Retorna ordem para pendente
     */
    returnToPending(orderId) {
        const modalHtml = `
            <div class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
                <div class="bg-white rounded-lg p-6 w-full max-w-lg mx-4">
                    <h3 class="text-lg font-semibold mb-4">Retornar para Pendente</h3>
                    <form id="returnToPendingForm">
                        <div class="mb-4">
                            <label class="form-label">Justificativa (obrigatório)</label>
                            <textarea name="justification" required class="form-input" rows="4" 
                                      placeholder="Explique por que a ordem não pôde ser finalizada..."></textarea>
                        </div>
                        <div class="flex justify-end space-x-3">
                            <button type="button" onclick="this.closest('.fixed').remove()" 
                                    class="btn btn-outline">Cancelar</button>
                            <button type="submit" class="btn btn-secondary">Confirmar</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        document.getElementById('returnToPendingForm').onsubmit = (e) => {
            e.preventDefault();
            const justification = new FormData(e.target).get('justification');

            const result = OrderManager.returnToPending(orderId, justification);

            document.querySelectorAll('.fixed.inset-0').forEach(modal => modal.remove());

            if (result.success) {
                NotificationManager.warning('Ordem retornada para pendente');
                this.renderOrders();
                this.updateMetrics();
            } else {
                NotificationManager.error(`Erro ao retornar ordem: ${result.error}`);
            }
        };
    },

    /**
     * Renderiza placeholder para outras seções
     */
    renderUsers() {
        // Placeholder para gestão de usuários
        console.log('Renderizando seção de usuários...');
    },

    renderCalendar() {
        // Placeholder para calendário
        console.log('Renderizando calendário...');
    },

    renderReports() {
        // Placeholder para relatórios
        console.log('Renderizando relatórios...');
    }
});

// ===================================
// INICIALIZAÇÃO DA APLICAÇÃO
// ===================================
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Iniciando Like Telecom Sistema de Gestão v' + CONFIG.VERSION);

    try {
        // Inicializar dados padrão
        DataManager.initializeDefaultData();

        // Carregar dados da aplicação
        DataManager.loadAppData();

        // Verificar sessão ativa
        const hasActiveSession = AuthManager.checkSession();

        if (hasActiveSession) {
            // Usuário já logado, mostrar aplicação
            document.getElementById('loginScreen').classList.add('hidden');
            document.getElementById('mainApp').classList.remove('hidden');

            // Inicializar interface
            UIManager.init();
            UIManager.showSection('dashboard');

            // Configurar auto-renovação de sessão
            setInterval(() => {
                AuthManager.renewSession();
            }, 30 * 60 * 1000); // A cada 30 minutos

            console.log('✅ Sessão ativa encontrada. Usuário:', AppState.currentUser.name);
        } else {
            // Mostrar tela de login
            document.getElementById('loginScreen').classList.remove('hidden');
            document.getElementById('mainApp').classList.add('hidden');

            console.log('🔐 Nenhuma sessão ativa. Exibindo tela de login.');
        }

        // Configurar atualização automática de métricas
        setInterval(() => {
            if (AppState.currentUser && AppState.currentSection === 'dashboard') {
                UIManager.updateMetrics();
            }
        }, 60000); // A cada minuto

        console.log('✅ Sistema inicializado com sucesso!');

    } catch (error) {
        console.error('❌ Erro ao inicializar sistema:', error);

        // Exibir erro para o usuário
        document.body.innerHTML = `
            <div class="min-h-screen flex items-center justify-center bg-red-50">
                <div class="text-center">
                    <i class="fas fa-exclamation-triangle text-6xl text-red-500 mb-4"></i>
                    <h1 class="text-2xl font-bold text-red-800 mb-2">Erro ao Inicializar Sistema</h1>
                    <p class="text-red-600 mb-4">Ocorreu um erro inesperado. Tente recarregar a página.</p>
                    <button onclick="window.location.reload()" class="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700">
                        Recarregar Página
                    </button>
                </div>
            </div>
        `;
    }
});

// ===================================
// EXPORTAR PARA ESCOPO GLOBAL (para depuração)
// ===================================
if (typeof window !== 'undefined') {
    window.LikeTelecom = {
        CONFIG,
        AppState,
        Utils,
        DataManager,
        AuthManager,
        OrderManager,
        UserManager,
        NotificationManager,
        CalendarManager,
        UIManager
    };

    console.log('📦 Objetos exportados para window.LikeTelecom');
}

// ===================================
// MANIPULADORES DE ERRO GLOBAIS
// ===================================
window.addEventListener('error', function(e) {
    console.error('Erro JavaScript não tratado:', e.error);
    NotificationManager?.error('Ocorreu um erro inesperado. Verifique o console para detalhes.');
});

window.addEventListener('unhandledrejection', function(e) {
    console.error('Promise rejeitada não tratada:', e.reason);
    NotificationManager?.error('Erro de operação assíncrona. Verifique sua conexão.');
});

// Fim do arquivo script.js
console.log('📄 Script principal carregado completamente');