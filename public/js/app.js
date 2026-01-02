/**
 * 财务管理系统前端主逻辑
 */

const API_BASE = '/api';
let currentUser = null;
let token = localStorage.getItem('token');

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    if (token) {
        checkAuth();
    } else {
        showLogin();
    }
    setupEventListeners();
});

// 事件监听
function setupEventListeners() {
    // 登录表单
    document.getElementById('loginForm').addEventListener('submit', function(e) {
        e.preventDefault();
        const username = document.getElementById('loginUsername').value;
        const password = document.getElementById('loginPassword').value;
        login(username, password);
    });

    // 注册表单
    document.getElementById('registerForm').addEventListener('submit', function(e) {
        e.preventDefault();
        const username = document.getElementById('registerUsername').value;
        const password = document.getElementById('registerPassword').value;
        const email = document.getElementById('registerEmail').value;
        register(username, password, email);
    });

    // 个人设置表单
    document.getElementById('profileForm').addEventListener('submit', function(e) {
        e.preventDefault();
        updateProfile();
    });
}

// 认证检查
async function checkAuth() {
    try {
        const response = await fetch(`${API_BASE}/users/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            const data = await response.json();
            currentUser = data.user;
            showMain();
            loadDashboard();
        } else {
            throw new Error('认证失败');
        }
    } catch (err) {
        localStorage.removeItem('token');
        token = null;
        showLogin();
    }
}

// 登录
async function login(username, password) {
    try {
        const response = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await response.json();
        if (response.ok) {
            token = data.token;
            localStorage.setItem('token', token);
            currentUser = data.user;
            showMain();
            loadDashboard();
        } else {
            showMessage('authMessage', data.error, 'danger');
        }
    } catch (err) {
        showMessage('authMessage', '网络错误', 'danger');
    }
}

// 注册
async function register(username, password, email) {
    try {
        const response = await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, email })
        });
        const data = await response.json();
        if (response.ok) {
            showMessage('authMessage', '注册成功，请登录', 'success');
            // 切换到登录标签
            document.querySelector('#authTab a[href="#loginTab"]').click();
        } else {
            showMessage('authMessage', data.error, 'danger');
        }
    } catch (err) {
        showMessage('authMessage', '网络错误', 'danger');
    }
}

// 退出登录
function logout() {
    localStorage.removeItem('token');
    token = null;
    currentUser = null;
    showLogin();
}

// 显示登录界面
function showLogin() {
    document.getElementById('loginSection').classList.remove('hidden');
    document.getElementById('mainContent').classList.add('hidden');
}

// 显示主界面
function showMain() {
    document.getElementById('loginSection').classList.add('hidden');
    document.getElementById('mainContent').classList.remove('hidden');
    document.getElementById('username').textContent = currentUser.username;
    
    // 默认显示仪表板区域作为首页
    // 首先隐藏所有区域
    document.querySelectorAll('#mainContent > section').forEach(s => s.classList.add('hidden'));
    // 显示仪表板区域
    document.getElementById('dashboardSection').classList.remove('hidden');
}

// 显示不同区域
function showSection(sectionId) {
    // 隐藏所有区域
    document.querySelectorAll('#mainContent > section').forEach(s => s.classList.add('hidden'));
    // 显示目标区域
    document.getElementById(sectionId + 'Section').classList.remove('hidden');
    // 加载对应数据
    switch (sectionId) {
        case 'dashboard':
            loadDashboard();
            break;
        case 'transactions':
            loadTransactions();
            loadCategoriesForFilter();
            break;
        case 'categories':
            loadCategories();
            break;
        case 'analytics':
            loadAnalytics();
            break;
        case 'profile':
            loadProfile();
            break;
    }
}

// 显示消息
function showMessage(elementId, text, type) {
    const el = document.getElementById(elementId);
    el.innerHTML = `<div class="alert alert-${type}">${text}</div>`;
    setTimeout(() => el.innerHTML = '', 3000);
}

// 加载仪表板数据
async function loadDashboard() {
    try {
        // 月度统计
        const monthlyRes = await fetch(`${API_BASE}/analytics/monthly`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const monthlyData = await monthlyRes.json();
        if (monthlyRes.ok) {
            const currentMonth = new Date().toISOString().slice(0, 7);
            const month = monthlyData.monthly.find(m => m.month === currentMonth);
            if (month) {
                document.getElementById('monthIncome').textContent = month.income.toFixed(2);
                document.getElementById('monthExpense').textContent = month.expense.toFixed(2);
                document.getElementById('monthBalance').textContent = month.balance.toFixed(2);
            }
            // 加载图表（根据用户偏好）
            loadDashboardChart();
        }

        // 加载分类图表（根据偏好）
        const chartPreference = localStorage.getItem('dashboardChartPreference') || 'trend';
        if (chartPreference === 'category' || chartPreference === 'incomeCategory') {
            const type = chartPreference === 'incomeCategory' ? 'income' : 'expense';
            await loadCategoryChart(type);
        } else {
            // 默认加载支出分类图表
            const categoryRes = await fetch(`${API_BASE}/analytics/category?type=expense`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const categoryData = await categoryRes.json();
            if (categoryRes.ok) {
                renderCategoryChart(categoryData.categories);
            }
        }

        // 交易总数
        const transRes = await fetch(`${API_BASE}/transactions?limit=1`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const transData = await transRes.json();
        if (transRes.ok) {
            document.getElementById('totalTransactions').textContent = transData.pagination.total;
        }
    } catch (err) {
        console.error('加载仪表板失败', err);
    }
}

// 渲染趋势图表
function renderTrendChart(monthly) {
    const ctx = document.getElementById('trendChart').getContext('2d');
    // 如果已有图表实例，先销毁
    if (window.trendChartInstance) {
        window.trendChartInstance.destroy();
    }
    window.trendChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: monthly.map(m => m.month),
            datasets: [
                {
                    label: '收入',
                    data: monthly.map(m => m.income),
                    borderColor: 'rgb(75, 192, 192)',
                    backgroundColor: 'rgba(75, 192, 192, 0.1)',
                    tension: 0.1,
                    fill: true
                },
                {
                    label: '支出',
                    data: monthly.map(m => m.expense),
                    borderColor: 'rgb(255, 99, 132)',
                    backgroundColor: 'rgba(255, 99, 132, 0.1)',
                    tension: 0.1,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: '月度收支趋势'
                }
            }
        }
    });
}

// 渲染分类饼图
function renderCategoryChart(categories) {
    console.log('渲染分类饼图数据:', categories);
    try {
        const canvas = document.getElementById('categoryChart');
        if (!canvas) {
            console.error('找不到canvas元素 #categoryChart');
            return;
        }
        const ctx = canvas.getContext('2d');
        // 如果已有图表实例，先销毁
        if (canvas.chart) {
            canvas.chart.destroy();
            canvas.chart = null;
        }
        
        // 过滤有效数据
        const validCategories = Array.isArray(categories) ? categories.filter(c => c && typeof c.amount === 'number' && c.amount > 0) : [];
        
        if (validCategories.length === 0) {
            // 显示空状态
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.font = '14px Arial';
            ctx.fillStyle = '#999';
            ctx.textAlign = 'center';
            ctx.fillText('暂无分类数据或金额为0', canvas.width / 2, canvas.height / 2);
            console.log('分类数据为空或无有效金额');
            return;
        }
        
        const chart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: validCategories.map(c => c.name),
                datasets: [{
                    data: validCategories.map(c => c.amount),
                    backgroundColor: validCategories.map(c => c.color || '#FF6384'),
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            font: {
                                size: 12,
                                family: 'Arial, sans-serif'
                            },
                            color: '#333'
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.raw || 0;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
                                return `${label}: ${value.toFixed(2)} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
        canvas.chart = chart;
        console.log('分类饼图渲染成功，共', validCategories.length, '个分类');
    } catch (err) {
        console.error('渲染分类饼图失败:', err);
        // 显示错误状态
        try {
            const canvas = document.getElementById('categoryChart');
            if (canvas) {
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.font = '14px Arial';
                ctx.fillStyle = '#f00';
                ctx.textAlign = 'center';
                ctx.fillText('图表渲染失败', canvas.width / 2, canvas.height / 2);
            }
        } catch (e) {
            // 忽略
        }
    }
}

// 加载交易记录
async function loadTransactions(page = 1) {
    try {
        const startDate = document.getElementById('filterStartDate').value;
        const endDate = document.getElementById('filterEndDate').value;
        const categoryId = document.getElementById('filterCategory').value;
        let url = `${API_BASE}/transactions?page=${page}&limit=20`;
        if (startDate) url += `&startDate=${startDate}`;
        if (endDate) url += `&endDate=${endDate}`;
        if (categoryId) url += `&categoryId=${categoryId}`;

        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (response.ok) {
            renderTransactions(data.transactions);
            renderPagination(data.pagination);
        }
    } catch (err) {
        console.error('加载交易失败', err);
    }
}

// 渲染交易表格
function renderTransactions(transactions) {
    const tbody = document.getElementById('transactionTableBody');
    tbody.innerHTML = '';
    transactions.forEach(t => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${t.date}</td>
            <td>${t.category_id ? '分类' + t.category_id : '未分类'}</td>
            <td>${t.description || ''}</td>
            <td class="${t.amount >= 0 ? 'text-success' : 'text-danger'}">${t.amount >= 0 ? '+' : ''}${t.amount.toFixed(2)}</td>
            <td>
                <button class="btn btn-sm btn-warning" onclick="editTransaction(${t.id})">编辑</button>
                <button class="btn btn-sm btn-danger" onclick="deleteTransaction(${t.id})">删除</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// 渲染分页
function renderPagination(pagination) {
    const ul = document.getElementById('transactionPagination');
    ul.innerHTML = '';
    for (let i = 1; i <= pagination.totalPages; i++) {
        const li = document.createElement('li');
        li.className = `page-item ${i === pagination.page ? 'active' : ''}`;
        li.innerHTML = `<a class="page-link" href="#" onclick="loadTransactions(${i})">${i}</a>`;
        ul.appendChild(li);
    }
}

// 加载分类（用于筛选下拉框）
async function loadCategoriesForFilter() {
    try {
        const response = await fetch(`${API_BASE}/categories`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (response.ok) {
            const select = document.getElementById('filterCategory');
            select.innerHTML = '<option value="">全部分类</option>';
            data.categories.forEach(c => {
                const option = document.createElement('option');
                option.value = c.id;
                option.textContent = c.name;
                select.appendChild(option);
            });
        }
    } catch (err) {
        console.error('加载分类失败', err);
    }
}

// 加载分类管理
async function loadCategories() {
    try {
        const response = await fetch(`${API_BASE}/categories`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (response.ok) {
            const incomeList = document.getElementById('incomeCategoryList');
            const expenseList = document.getElementById('expenseCategoryList');
            incomeList.innerHTML = '';
            expenseList.innerHTML = '';
            data.categories.forEach(c => {
                const li = document.createElement('li');
                li.className = 'list-group-item d-flex justify-content-between align-items-center';
                li.innerHTML = `
                    <span><i class="fas fa-tag" style="color:${c.color}"></i> ${c.name}</span>
                    <div>
                        <button class="btn btn-sm btn-warning" onclick="editCategory(${c.id})">编辑</button>
                        <button class="btn btn-sm btn-danger" onclick="deleteCategory(${c.id})">删除</button>
                    </div>
                `;
                if (c.type === 'income') {
                    incomeList.appendChild(li);
                } else {
                    expenseList.appendChild(li);
                }
            });
        }
    } catch (err) {
        console.error('加载分类失败', err);
    }
}

// 加载数据分析
async function loadAnalytics() {
    try {
        // 填充分类占比年份选择器 - 最近5年
        const yearSelect = document.getElementById('analyticsCategoryYear');
        if (yearSelect) {
            const currentYear = new Date().getFullYear();
            yearSelect.innerHTML = '';
            for (let y = currentYear; y >= currentYear - 5; y--) {
                const option = document.createElement('option');
                option.value = y;
                option.textContent = y + '年';
                if (y === currentYear) option.selected = true;
                yearSelect.appendChild(option);
            }
        }
        
        // 填充对比分析年份选择器 - 最近5年
        const comparisonYearSelect = document.getElementById('analyticsComparisonYear');
        if (comparisonYearSelect) {
            const currentYear = new Date().getFullYear();
            comparisonYearSelect.innerHTML = '';
            for (let y = currentYear; y >= currentYear - 5; y--) {
                const option = document.createElement('option');
                option.value = y;
                option.textContent = y + '年';
                if (y === currentYear) option.selected = true;
                comparisonYearSelect.appendChild(option);
            }
        }
        
        // 填充交易明细分析年份选择器
        const detailYearSelect = document.getElementById('detailYear');
        if (detailYearSelect) {
            const currentYear = new Date().getFullYear();
            detailYearSelect.innerHTML = '';
            for (let y = currentYear; y >= currentYear - 5; y--) {
                const option = document.createElement('option');
                option.value = y;
                option.textContent = y + '年';
                if (y === currentYear) option.selected = true;
                detailYearSelect.appendChild(option);
            }
        }
        
        // 加载分类选项
        await loadCategoriesForTransactionDetail();
        
        // 加载月度统计图表
        loadMonthlyAnalytics();
        
        // 加载趋势分析图表
        loadTrendAnalytics();
        
        // 加载分类占比图表
        loadCategoryAnalytics();
    } catch (err) {
        console.error('加载分析数据失败', err);
    }
}

// 加载个人设置
function loadProfile() {
    document.getElementById('profileUsername').value = currentUser.username;
    document.getElementById('profileEmail').value = currentUser.email || '';
}

// 更新个人设置
async function updateProfile() {
    const email = document.getElementById('profileEmail').value;
    const password = document.getElementById('profilePassword').value;
    const updates = {};
    if (email !== currentUser.email) updates.email = email;
    if (password) updates.password = password;

    try {
        const response = await fetch(`${API_BASE}/users/me`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(updates)
        });
        if (response.ok) {
            showMessage('profileSection', '更新成功', 'success');
        } else {
            showMessage('profileSection', '更新失败', 'danger');
        }
    } catch (err) {
        showMessage('profileSection', '网络错误', 'danger');
    }
}

// 显示添加交易模态框
function showAddTransactionModal() {
    // 加载分类下拉框
    fetch(`${API_BASE}/categories`, {
        headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(data => {
        const select = document.getElementById('transactionCategory');
        select.innerHTML = '<option value="">请选择分类</option>';
        data.categories.forEach(c => {
            const option = document.createElement('option');
            option.value = c.id;
            option.textContent = c.name;
            select.appendChild(option);
        });
    });
    document.getElementById('transactionDate').value = new Date().toISOString().split('T')[0];
    new bootstrap.Modal(document.getElementById('transactionModal')).show();
}

// 保存交易
async function saveTransaction() {
    const categoryId = document.getElementById('transactionCategory').value || null;
    const amount = parseFloat(document.getElementById('transactionAmount').value);
    const description = document.getElementById('transactionDescription').value;
    const date = document.getElementById('transactionDate').value;

    try {
        const response = await fetch(`${API_BASE}/transactions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ category_id: categoryId, amount, description, date })
        });
        if (response.ok) {
            bootstrap.Modal.getInstance(document.getElementById('transactionModal')).hide();
            loadTransactions();
            loadDashboard(); // 刷新仪表板
        } else {
            alert('添加失败');
        }
    } catch (err) {
        alert('网络错误');
    }
}

// 显示添加分类模态框
function showAddCategoryModal(type) {
    document.getElementById('categoryType').value = type;
    new bootstrap.Modal(document.getElementById('categoryModal')).show();
}

// 保存分类
async function saveCategory() {
    const name = document.getElementById('categoryName').value;
    const type = document.getElementById('categoryType').value;
    const color = document.getElementById('categoryColor').value;

    try {
        const response = await fetch(`${API_BASE}/categories`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ name, type, color })
        });
        if (response.ok) {
            bootstrap.Modal.getInstance(document.getElementById('categoryModal')).hide();
            loadCategories();
            loadCategoriesForFilter();
        } else {
            alert('添加失败');
        }
    } catch (err) {
        alert('网络错误');
    }
}

// 编辑交易（占位）
function editTransaction(id) {
    alert('编辑功能待实现');
}

// 删除交易
async function deleteTransaction(id) {
    if (!confirm('确定删除此交易？')) return;
    try {
        const response = await fetch(`${API_BASE}/transactions/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            loadTransactions();
            loadDashboard();
        } else {
            alert('删除失败');
        }
    } catch (err) {
        alert('网络错误');
    }
}

// 编辑分类（占位）
function editCategory(id) {
    alert('编辑分类功能待实现');
}

// 删除分类
async function deleteCategory(id) {
    if (!confirm('确定删除此分类？')) return;
    try {
        const response = await fetch(`${API_BASE}/categories/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            loadCategories();
            loadCategoriesForFilter();
        } else {
            alert('删除失败');
        }
    } catch (err) {
        alert('网络错误');
    }
}

// ============================================
// 缺失的分析函数 - 从修复版本中移植
// ============================================

/**
 * 加载月度统计图表
 */
async function loadMonthlyAnalytics() {
    try {
        const response = await fetch(`${API_BASE}/analytics/monthly`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (response.ok) {
            renderMonthlyChart(data.monthly, data.year);
        } else {
            console.error('月度统计查询失败', data);
        }
    } catch (err) {
        console.error('月度统计查询异常', err);
    }
}

/**
 * 渲染月度统计图表
 */
function renderMonthlyChart(monthly, year) {
    console.log('月度统计数据:', year, '数据:', monthly);
    try {
        const canvas = document.getElementById('monthlyChart');
        if (!canvas) {
            console.error('找不到canvas元素 #monthlyChart');
            return;
        }
        const ctx = canvas.getContext('2d');
        // 如果已有图表实例，先销毁
        if (canvas.chart) {
            canvas.chart.destroy();
            canvas.chart = null;
        }
        
        // 过滤有效数据
        const validMonthly = Array.isArray(monthly) ? monthly.filter(m => m && typeof m.income === 'number' && typeof m.expense === 'number') : [];
        
        if (validMonthly.length === 0) {
            // 显示空状态
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.font = '14px Arial';
            ctx.fillStyle = '#999';
            ctx.textAlign = 'center';
            ctx.fillText('暂无月度统计数据或数据不完整', canvas.width / 2, canvas.height / 2);
            console.log('月度统计数据为空');
            return;
        }
        
        const chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: validMonthly.map(m => m.month),
                datasets: [
                    {
                        label: '收入',
                        data: validMonthly.map(m => m.income),
                        backgroundColor: 'rgba(75, 192, 192, 0.5)',
                        borderColor: 'rgb(75, 192, 192)',
                        borderWidth: 1
                    },
                    {
                        label: '支出',
                        data: validMonthly.map(m => m.expense),
                        backgroundColor: 'rgba(255, 99, 132, 0.5)',
                        borderColor: 'rgb(255, 99, 132)',
                        borderWidth: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: `${year}年月度收支对比图`,
                        font: { size: 16 }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return value.toFixed(2);
                            }
                        }
                    }
                }
            }
        });
        canvas.chart = chart;
        console.log('月度统计图表渲染成功', validMonthly.length, '个月数据');
    } catch (err) {
        console.error('渲染月度统计图表失败:', err);
        // 显示错误状态
        try {
            const canvas = document.getElementById('monthlyChart');
            if (canvas) {
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.font = '14px Arial';
                ctx.fillStyle = '#f00';
                ctx.textAlign = 'center';
                ctx.fillText('图表渲染失败', canvas.width / 2, canvas.height / 2);
            }
        } catch (e) {
            // 忽略
        }
    }
}

/**
 * 加载趋势分析图表
 */
async function loadTrendAnalytics() {
    try {
        const response = await fetch(`${API_BASE}/analytics/trend?months=12`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (response.ok) {
            renderTrendAnalyticsChart(data.trend);
        } else {
            console.error('趋势分析查询失败', data);
        }
    } catch (err) {
        console.error('趋势分析查询异常', err);
    }
}

/**
 * 渲染趋势分析图表
 */
function renderTrendAnalyticsChart(trend) {
    console.log('趋势分析数据:', trend);
    try {
        const canvas = document.getElementById('trendAnalyticsChart');
        if (!canvas) {
            console.error('找不到canvas元素 #trendAnalyticsChart');
            return;
        }
        const ctx = canvas.getContext('2d');
        // 如果已有图表实例，先销毁
        if (canvas.chart) {
            canvas.chart.destroy();
            canvas.chart = null;
        }
        
        // 过滤有效数据
        const validTrend = Array.isArray(trend) ? trend.filter(t => t && typeof t.income === 'number' && typeof t.expense === 'number') : [];
        
        if (validTrend.length === 0) {
            // 显示空状态
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.font = '14px Arial';
            ctx.fillStyle = '#999';
            ctx.textAlign = 'center';
            ctx.fillText('暂无趋势分析数据或数据不完整', canvas.width / 2, canvas.height / 2);
            console.log('趋势分析数据为空');
            return;
        }
        
        const chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: validTrend.map(t => t.label),
                datasets: [
                    {
                        label: '收入',
                        data: validTrend.map(t => t.income),
                        borderColor: 'rgb(75, 192, 192)',
                        backgroundColor: 'rgba(75, 192, 192, 0.1)',
                        tension: 0.1,
                        fill: true
                    },
                    {
                        label: '支出',
                        data: validTrend.map(t => t.expense),
                        borderColor: 'rgb(255, 99, 132)',
                        backgroundColor: 'rgba(255, 99, 132, 0.1)',
                        tension: 0.1,
                        fill: true
                    },
                    {
                        label: '余额',
                        data: validTrend.map(t => t.balance),
                        borderColor: 'rgb(153, 102, 255)',
                        backgroundColor: 'rgba(153, 102, 255, 0.1)',
                        tension: 0.1,
                        fill: false,
                        borderDash: [5, 5]
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: '收支趋势分析图',
                        font: { size: 16 }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: false,
                        ticks: {
                            callback: function(value) {
                                return value.toFixed(2);
                            }
                        }
                    }
                }
            }
        });
        canvas.chart = chart;
        console.log('趋势分析图表渲染成功', validTrend.length, '个数据点');
    } catch (err) {
        console.error('渲染趋势分析图表失败:', err);
        // 显示错误状态
        try {
            const canvas = document.getElementById('trendAnalyticsChart');
            if (canvas) {
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.font = '14px Arial';
                ctx.fillStyle = '#f00';
                ctx.textAlign = 'center';
                ctx.fillText('图表渲染失败', canvas.width / 2, canvas.height / 2);
            }
        } catch (e) {
            // 忽略
        }
    }
}

/**
 * 加载分类占比图表
 */
async function loadCategoryAnalytics() {
    try {
        const type = document.getElementById('analyticsCategoryType')?.value || 'expense';
        const year = document.getElementById('analyticsCategoryYear')?.value || new Date().getFullYear();
        const quarter = document.getElementById('analyticsCategoryQuarter')?.value || '';
        const month = document.getElementById('analyticsCategoryMonth')?.value || '';
        const mode = document.getElementById('analyticsCategoryMode')?.value || 'pie';
        
        let url = `${API_BASE}/analytics/category?type=${type}&year=${year}`;
        if (quarter) url += `&quarter=${quarter}`;
        if (month) url += `&month=${month}`;
        
        console.log('分类占比查询URL:', url, '模式:', mode);
        
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (response.ok) {
            renderCategoryAnalyticsChart(data.categories, type, mode);
        } else {
            console.error('分类占比查询失败', data);
        }
    } catch (err) {
        console.error('分类占比查询异常', err);
    }
}

/**
 * 渲染分类占比图表
 */
function renderCategoryAnalyticsChart(categories, type, mode = 'pie') {
    console.log('分类占比数据:', type, '模式:', mode, '数据:', categories);
    try {
        const canvas = document.getElementById('categoryAnalyticsChart');
        if (!canvas) {
            console.error('找不到canvas元素 #categoryAnalyticsChart');
            return;
        }
        const ctx = canvas.getContext('2d');
        // 如果已有图表实例，先销毁
        if (canvas.chart) {
            canvas.chart.destroy();
            canvas.chart = null;
        }
        
        // 过滤有效数据
        const validCategories = Array.isArray(categories) ? categories.filter(c => c && typeof c.amount === 'number' && c.amount > 0) : [];
        
        if (validCategories.length === 0) {
            // 显示空状态
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.font = '14px Arial';
            ctx.fillStyle = '#999';
            ctx.textAlign = 'center';
            ctx.fillText('暂无分类数据或金额为0', canvas.width / 2, canvas.height / 2);
            console.log('分类数据为空或无有效金额');
            return;
        }
        
        // 根据模式选择图表类型
        const chartType = mode === 'bar' ? 'bar' : 'pie';
        const chartTitle = `${type === 'income' ? '收入' : '支出'}分类${mode === 'bar' ? '柱状图' : '饼图'}`;
        
        const chartConfig = {
            type: chartType,
            data: {
                labels: validCategories.map(c => c.name),
                datasets: [{
                    label: '金额',
                    data: validCategories.map(c => c.amount),
                    backgroundColor: validCategories.map(c => c.color || getRandomColor()),
                    borderColor: validCategories.map(c => c.color || getRandomColor()),
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: chartTitle,
                        font: { size: 16 }
                    },
                    legend: mode !== 'bar' ? {
                        position: 'right',
                        labels: {
                            font: {
                                size: 12,
                                family: 'Arial, sans-serif'
                            },
                            color: '#333'
                        }
                    } : { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.raw || 0;
                                if (mode === 'bar') {
                                    return `${label}: ${value.toFixed(2)}`;
                                }
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
                                return `${label}: ${value.toFixed(2)} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        };
        
        // 如果是柱状图，添加刻度配置
        if (mode === 'bar') {
            chartConfig.options.scales = {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return value.toFixed(2);
                        }
                    }
                },
                x: {
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45
                    }
                }
            };
        }
        
        const chart = new Chart(ctx, chartConfig);
        canvas.chart = chart;
        console.log(`分类占比图表渲染成功:${chartType}，共${validCategories.length}个分类`);
    } catch (err) {
        console.error('渲染分类占比图表失败:', err);
        // 显示错误状态
        try {
            const canvas = document.getElementById('categoryAnalyticsChart');
            if (canvas) {
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.font = '14px Arial';
                ctx.fillStyle = '#f00';
                ctx.textAlign = 'center';
                ctx.fillText('图表渲染失败', canvas.width / 2, canvas.height / 2);
            }
        } catch (e) {
            // 忽略
        }
    }
}

/**
 * 为交易明细分析加载分类选项
 */
async function loadCategoriesForTransactionDetail() {
    try {
        const response = await fetch(`${API_BASE}/categories`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (response.ok) {
            const select = document.getElementById('detailCategory');
            if (select) {
                select.innerHTML = '<option value="">全部分类</option>';
                data.categories.forEach(c => {
                    const option = document.createElement('option');
                    option.value = c.id;
                    option.textContent = c.name;
                    select.appendChild(option);
                });
            }
        }
    } catch (err) {
        console.error('加载分类选项失败', err);
    }
}

/**
 * 生成区分度高的颜色（改进版）
 * 使用预定义的无重复颜色板，确保颜色多样性和视觉可区分性
 * 如果调用次数超过颜色板长度，则循环使用
 */
function getRandomColor() {
    // 无重复的预设颜色板（12种高区分度颜色）
    const colors = [
        '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40',
        '#C9CBCF', '#7EB3FF', '#FF9F99', '#6BCF7F', '#FFB366', '#B366FF'
    ];
    
    // 使用简单计数器确保颜色多样性
    if (!window._colorIndex) {
        window._colorIndex = 0;
    }
    const color = colors[window._colorIndex % colors.length];
    window._colorIndex++;
    return color;
}

/**
 * 根据分类ID生成确定性颜色（用于分类颜色缺失时的后备）
 * 保证同一分类ID总是得到相同颜色
 */
function getColorByCategoryId(categoryId) {
    const colors = [
        '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40',
        '#C9CBCF', '#7EB3FF', '#FF9F99', '#6BCF7F', '#FFB366', '#B366FF'
    ];
    // 确保ID为数字，如果无效则使用索引0
    const id = parseInt(categoryId) || 1;
    const index = (id - 1) % colors.length;
    return colors[index];
}

// ============================================
// 对比分析相关函数
// ============================================

/**
 * 加载对比分析数据
 */
async function loadComparisonAnalytics() {
    try {
        const year = document.getElementById('analyticsComparisonYear')?.value || new Date().getFullYear();
        const quarter = document.getElementById('analyticsComparisonQuarter')?.value || '';
        const month = document.getElementById('analyticsComparisonMonth')?.value || '';
        
        let url = `${API_BASE}/analytics/comparison?year=${year}`;
        if (quarter) url += `&quarter=${quarter}`;
        if (month) url += `&month=${month}`;
        
        console.log('对比分析查询URL:', url);
        
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (response.ok) {
            console.log('对比分析数据:', data);
            renderComparisonPieChart(data);
            renderComparisonBarChart(data);
            renderCategoryDetails(data);
        } else {
            console.error('对比分析查询失败', data);
            // 显示空状态
            clearComparisonCharts();
            showComparisonEmptyState();
        }
    } catch (err) {
        console.error('对比分析查询异常', err);
        clearComparisonCharts();
        showComparisonEmptyState();
    }
}

/**
 * 渲染对比分析饼图
 */
function renderComparisonPieChart(comparisonData) {
    try {
        const canvas = document.getElementById('comparisonPieChart');
        if (!canvas) {
            console.error('找不到canvas元素 #comparisonPieChart');
            return;
        }
        const ctx = canvas.getContext('2d');
        
        // 如果已有图表实例，先销毁
        if (canvas.chart) {
            canvas.chart.destroy();
            canvas.chart = null;
        }
        
        // 获取收入支出总额
        const incomeTotal = comparisonData.income?.total || 0;
        const expenseTotal = comparisonData.expense?.total || 0;
        
        // 如果两个总额都为0，显示空状态
        if (incomeTotal <= 0 && expenseTotal <= 0) {
            showComparisonEmptyState('暂无对比数据');
            return;
        }
        
        const chart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: ['收入', '支出'],
                datasets: [{
                    data: [incomeTotal, expenseTotal],
                    backgroundColor: [
                        'rgba(75, 192, 192, 0.8)',
                        'rgba(255, 99, 132, 0.8)'
                    ],
                    borderColor: [
                        'rgb(75, 192, 192)',
                        'rgb(255, 99, 132)'
                    ],
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: '收入支出比例对比',
                        font: { size: 16 }
                    },
                    legend: {
                        position: 'right'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.raw || 0;
                                const total = incomeTotal + expenseTotal;
                                const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
                                return `${label}: ${value.toFixed(2)} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
        canvas.chart = chart;
    } catch (err) {
        console.error('渲染对比饼图失败:', err);
    }
}

/**
 * 渲染对比分析柱状图
 */
function renderComparisonBarChart(comparisonData) {
    try {
        const canvas = document.getElementById('comparisonBarChart');
        if (!canvas) {
            console.error('找不到canvas元素 #comparisonBarChart');
            return;
        }
        const ctx = canvas.getContext('2d');
        
        // 如果已有图表实例，先销毁
        if (canvas.chart) {
            canvas.chart.destroy();
            canvas.chart = null;
        }
        
        // 获取收入支出总额
        const incomeTotal = comparisonData.income?.total || 0;
        const expenseTotal = comparisonData.expense?.total || 0;
        
        // 如果两个总额都为0，不渲染
        if (incomeTotal <= 0 && expenseTotal <= 0) {
            return;
        }
        
        const chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['收入', '支出'],
                datasets: [{
                    label: '金额',
                    data: [incomeTotal, expenseTotal],
                    backgroundColor: [
                        'rgba(75, 192, 192, 0.5)',
                        'rgba(255, 99, 132, 0.5)'
                    ],
                    borderColor: [
                        'rgb(75, 192, 192)',
                        'rgb(255, 99, 132)'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: '收入支出金额对比',
                        font: { size: 16 }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return value.toFixed(2);
                            }
                        }
                    }
                }
            }
        });
        canvas.chart = chart;
    } catch (err) {
        console.error('渲染对比柱状图失败:', err);
    }
}

/**
 * 渲染分类详情
 */
function renderCategoryDetails(comparisonData) {
    try {
        const incomeDetailEl = document.getElementById('incomeCategoriesDetail');
        const expenseDetailEl = document.getElementById('expenseCategoriesDetail');
        
        if (!incomeDetailEl || !expenseDetailEl) {
            console.error('找不到分类详情元素');
            return;
        }
        
        // 渲染收入分类详情
        const incomeCategories = comparisonData.income?.categories || [];
        if (incomeCategories.length > 0) {
            let html = '<ul class="list-unstyled">';
            incomeCategories.forEach(cat => {
                const percentage = comparisonData.income.total > 0 ?
                    Math.round((cat.amount / comparisonData.income.total) * 100) : 0;
                html += `
                    <li class="mb-2">
                        <div class="d-flex justify-content-between">
                            <span><i class="fas fa-circle" style="color:${cat.color || '#36A2EB'}"></i> ${cat.name}</span>
                            <span>${cat.amount.toFixed(2)} (${percentage}%)</span>
                        </div>
                        <div class="progress" style="height: 4px;">
                            <div class="progress-bar" style="width: ${percentage}%; background-color: ${cat.color || '#36A2EB'}" role="progressbar"></div>
                        </div>
                    </li>
                `;
            });
            html += '</ul>';
            incomeDetailEl.innerHTML = html;
        } else {
            incomeDetailEl.innerHTML = '<div class="text-muted">暂无收入分类数据</div>';
        }
        
        // 渲染支出分类详情
        const expenseCategories = comparisonData.expense?.categories || [];
        if (expenseCategories.length > 0) {
            let html = '<ul class="list-unstyled">';
            expenseCategories.forEach(cat => {
                const percentage = comparisonData.expense.total > 0 ?
                    Math.round((cat.amount / comparisonData.expense.total) * 100) : 0;
                html += `
                    <li class="mb-2">
                        <div class="d-flex justify-content-between">
                            <span><i class="fas fa-circle" style="color:${cat.color || '#FF6384'}"></i> ${cat.name}</span>
                            <span>${cat.amount.toFixed(2)} (${percentage}%)</span>
                        </div>
                        <div class="progress" style="height: 4px;">
                            <div class="progress-bar" style="width: ${percentage}%; background-color: ${cat.color || '#FF6384'}" role="progressbar"></div>
                        </div>
                    </li>
                `;
            });
            html += '</ul>';
            expenseDetailEl.innerHTML = html;
        } else {
            expenseDetailEl.innerHTML = '<div class="text-muted">暂无支出分类数据</div>';
        }
    } catch (err) {
        console.error('渲染分类详情失败:', err);
    }
}

/**
 * 清除对比分析图表
 */
function clearComparisonCharts() {
    try {
        const pieCanvas = document.getElementById('comparisonPieChart');
        const barCanvas = document.getElementById('comparisonBarChart');
        
        if (pieCanvas && pieCanvas.chart) {
            pieCanvas.chart.destroy();
            pieCanvas.chart = null;
        }
        if (barCanvas && barCanvas.chart) {
            barCanvas.chart.destroy();
            barCanvas.chart = null;
        }
    } catch (err) {
        console.error('清除对比图表失败:', err);
    }
}

/**
 * 显示对比分析空状态
 */
function showComparisonEmptyState(message = '暂无对比数据') {
    try {
        const pieCanvas = document.getElementById('comparisonPieChart');
        const barCanvas = document.getElementById('comparisonBarChart');
        const incomeDetailEl = document.getElementById('incomeCategoriesDetail');
        const expenseDetailEl = document.getElementById('expenseCategoriesDetail');
        
        // 清除图表
        if (pieCanvas) {
            const ctx = pieCanvas.getContext('2d');
            ctx.clearRect(0, 0, pieCanvas.width, pieCanvas.height);
            ctx.font = '14px Arial';
            ctx.fillStyle = '#999';
            ctx.textAlign = 'center';
            ctx.fillText(message, pieCanvas.width / 2, pieCanvas.height / 2);
        }
        
        if (barCanvas) {
            const ctx = barCanvas.getContext('2d');
            ctx.clearRect(0, 0, barCanvas.width, barCanvas.height);
            ctx.font = '14px Arial';
            ctx.fillStyle = '#999';
            ctx.textAlign = 'center';
            ctx.fillText(message, barCanvas.width / 2, barCanvas.height / 2);
        }
        
        // 清除详情
        if (incomeDetailEl) incomeDetailEl.innerHTML = '<div class="text-muted">暂无收入分类数据</div>';
        if (expenseDetailEl) expenseDetailEl.innerHTML = '<div class="text-muted">暂无支出分类数据</div>';
    } catch (err) {
        console.error('显示对比空状态失败:', err);
    }
}

// ============================================
// 交易明细分析相关函数
// ============================================

/**
 * 初始化交易明细分析界面
 */
function initTransactionDetailAnalytics() {
    // 填充年份选择器
    const yearSelect = document.getElementById('detailYear');
    if (yearSelect) {
        const currentYear = new Date().getFullYear();
        yearSelect.innerHTML = '';
        for (let y = currentYear; y >= currentYear - 5; y--) {
            const option = document.createElement('option');
            option.value = y;
            option.textContent = y + '年';
            if (y === currentYear) option.selected = true;
            yearSelect.appendChild(option);
        }
    }
    
    // 加载分类选项
    loadCategoriesForTransactionDetail();
}

/**
 * 加载交易明细分析数据
 */
async function loadTransactionDetailAnalytics(page = 1) {
    try {
        // 获取筛选条件
        const year = document.getElementById('detailYear')?.value || new Date().getFullYear();
        const month = document.getElementById('detailMonth')?.value || '';
        const categoryId = document.getElementById('detailCategory')?.value || '';
        const type = document.getElementById('detailType')?.value || 'all';
        const keyword = document.getElementById('detailKeyword')?.value || '';
        const minAmount = document.getElementById('detailMinAmount')?.value || '';
        const maxAmount = document.getElementById('detailMaxAmount')?.value || '';
        const limit = document.getElementById('detailLimit')?.value || 20;
        const showSummary = document.getElementById('detailShowSummary')?.checked || true;
        
        // 构建查询URL
        let url = `${API_BASE}/analytics/transaction-detail?year=${year}&page=${page}&limit=${limit}`;
        if (month) url += `&month=${month}`;
        if (categoryId) url += `&categoryId=${categoryId}`;
        if (type !== 'all') url += `&type=${type}`;
        if (keyword) url += `&keyword=${encodeURIComponent(keyword)}`;
        if (minAmount) url += `&minAmount=${minAmount}`;
        if (maxAmount) url += `&maxAmount=${maxAmount}`;
        
        console.log('交易明细查询URL:', url);
        
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        
        if (response.ok) {
            // 更新统计摘要
            if (showSummary) {
                document.getElementById('detailTotalIncome').textContent = data.summary.totalIncome.toFixed(2);
                document.getElementById('detailTotalExpense').textContent = data.summary.totalExpense.toFixed(2);
                document.getElementById('detailBalance').textContent = data.summary.balance.toFixed(2);
                document.getElementById('detailTransactionCount').textContent = data.summary.transactionCount;
                document.getElementById('detailSummarySection').classList.remove('hidden');
            } else {
                document.getElementById('detailSummarySection').classList.add('hidden');
            }
            
            // 渲染表格
            renderTransactionDetailTable(data.transactions);
            
            // 渲染分页
            renderTransactionDetailPagination(data.pagination);
            
            // 隐藏空状态行
            const emptyRow = document.getElementById('detailEmptyRow');
            if (emptyRow) emptyRow.style.display = 'none';
            
        } else {
            console.error('交易明细查询失败', data);
            showMessage('detailTableBody', '查询失败: ' + (data.error || '未知错误'), 'danger');
        }
    } catch (err) {
        console.error('交易明细查询异常', err);
        showMessage('detailTableBody', '查询异常: ' + err.message, 'danger');
    }
}

/**
 * 渲染交易明细表格
 */
function renderTransactionDetailTable(transactions) {
    const tbody = document.getElementById('detailTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (!transactions || transactions.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td colspan="5" class="text-center text-muted py-5">
                <i class="fas fa-search fa-3x mb-3"></i>
                <p>没有找到符合条件的交易记录</p>
                <p class="small">请尝试调整筛选条件</p>
            </td>
        `;
        tbody.appendChild(row);
        return;
    }
    
    transactions.forEach(t => {
        const row = document.createElement('tr');
        const categoryName = t.category ? t.category.name : '未分类';
        const categoryColor = t.category ? t.category.color : '#6c757d';
        const amountClass = t.amount >= 0 ? 'text-success' : 'text-danger';
        const amountSign = t.amount >= 0 ? '+' : '';
        
        row.innerHTML = `
            <td>${t.date}</td>
            <td>
                <span class="badge" style="background-color:${categoryColor}">
                    ${categoryName}
                </span>
            </td>
            <td>${t.description || ''}</td>
            <td class="${amountClass} fw-bold">${amountSign}${t.amount.toFixed(2)}</td>
            <td>
                <button class="btn btn-sm btn-outline-primary" onclick="editTransaction(${t.id})">
                    <i class="fas fa-edit"></i>
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

/**
 * 渲染交易明细分页
 */
function renderTransactionDetailPagination(pagination) {
    const container = document.getElementById('detailPaginationContainer');
    const ul = document.getElementById('detailPagination');
    
    if (!container || !ul) return;
    
    if (!pagination || pagination.totalPages <= 1) {
        container.style.display = 'none';
        return;
    }
    
    container.style.display = 'block';
    ul.innerHTML = '';
    
    // 上一页按钮
    const prevLi = document.createElement('li');
    prevLi.className = `page-item ${pagination.hasPrev ? '' : 'disabled'}`;
    prevLi.innerHTML = `
        <a class="page-link" href="#" ${pagination.hasPrev ? `onclick="loadTransactionDetailAnalytics(${pagination.page - 1})"` : ''}>
            &laquo; 上一页
        </a>
    `;
    ul.appendChild(prevLi);
    
    // 页码按钮
    const startPage = Math.max(1, pagination.page - 2);
    const endPage = Math.min(pagination.totalPages, pagination.page + 2);
    
    for (let i = startPage; i <= endPage; i++) {
        const li = document.createElement('li');
        li.className = `page-item ${i === pagination.page ? 'active' : ''}`;
        li.innerHTML = `<a class="page-link" href="#" onclick="loadTransactionDetailAnalytics(${i})">${i}</a>`;
        ul.appendChild(li);
    }
    
    // 下一页按钮
    const nextLi = document.createElement('li');
    nextLi.className = `page-item ${pagination.hasNext ? '' : 'disabled'}`;
    nextLi.innerHTML = `
        <a class="page-link" href="#" ${pagination.hasNext ? `onclick="loadTransactionDetailAnalytics(${pagination.page + 1})"` : ''}>
            下一页 &raquo;
        </a>
    `;
    ul.appendChild(nextLi);
}

/**
 * 导出交易明细数据
 */
function exportTransactionDetail() {
    try {
        // 获取当前筛选条件
        const year = document.getElementById('detailYear')?.value || new Date().getFullYear();
        const month = document.getElementById('detailMonth')?.value || '';
        const categoryId = document.getElementById('detailCategory')?.value || '';
        const type = document.getElementById('detailType')?.value || 'all';
        const keyword = document.getElementById('detailKeyword')?.value || '';
        
        // 构建导出URL（不使用分页，获取所有数据）
        let url = `${API_BASE}/analytics/transaction-detail?year=${year}&limit=1000`;
        if (month) url += `&month=${month}`;
        if (categoryId) url += `&categoryId=${categoryId}`;
        if (type !== 'all') url += `&type=${type}`;
        if (keyword) url += `&keyword=${encodeURIComponent(keyword)}`;
        
        // 创建下载链接
        const link = document.createElement('a');
        link.href = url;
        link.download = `交易明细_${year}${month ? '_' + month + '月' : ''}_${new Date().getTime()}.json`;
        link.click();
        
        showMessage('detailTableBody', '导出请求已发送，请稍候查看下载', 'success');
    } catch (err) {
        console.error('导出失败', err);
        showMessage('detailTableBody', '导出失败: ' + err.message, 'danger');
    }
}

// ============================================
// 首页图表切换功能
// ============================================

/**
 * 切换首页图表类型
 * @param {string} chartType - 'trend'（月度趋势）、'comparison'（收支对比）、'balance'（余额趋势）、'category'（支出占比）、'incomeCategory'（收入占比）
 */
function switchDashboardChart(chartType) {
    // 保存偏好到localStorage
    localStorage.setItem('dashboardChartPreference', chartType);
    
    // 更新按钮状态
    document.querySelectorAll('.chart-switcher button').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelectorAll(`.chart-switcher button[data-chart="${chartType}"]`).forEach(btn => {
        btn.classList.add('active');
    });
    
    // 根据图表类型重新加载图表
    loadDashboardChart(chartType);
}

/**
 * 加载指定类型的首页图表
 */
async function loadDashboardChart(chartType = null) {
    if (!chartType) {
        // 从localStorage读取偏好，默认'trend'
        chartType = localStorage.getItem('dashboardChartPreference') || 'trend';
    }
    
    try {
        // 加载月度数据（用于趋势、对比、余额图表）
        const monthlyRes = await fetch(`${API_BASE}/analytics/monthly`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const monthlyData = await monthlyRes.json();
        
        if (!monthlyRes.ok) {
            console.error('加载月度数据失败');
            return;
        }
        
        switch (chartType) {
            case 'trend':
                renderTrendChart(monthlyData.monthly);
                break;
            case 'comparison':
                renderComparisonChart(monthlyData.monthly);
                break;
            case 'balance':
                renderBalanceTrendChart(monthlyData.monthly);
                break;
            case 'category':
                await loadCategoryChart('expense');
                break;
            case 'incomeCategory':
                await loadCategoryChart('income');
                break;
        }
    } catch (err) {
        console.error('加载图表数据失败', err);
    }
}

/**
 * 加载分类占比图表
 */
async function loadCategoryChart(type = 'expense') {
    try {
        const response = await fetch(`${API_BASE}/analytics/category?type=${type}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (response.ok) {
            // 更新卡片标题
            const cardHeader = document.querySelector('#dashboardSection .col-md-4 .card-header span');
            if (cardHeader) {
                cardHeader.textContent = type === 'expense' ? '支出分类占比' : '收入分类占比';
            }
            renderCategoryChart(data.categories);
        }
    } catch (err) {
        console.error('加载分类图表失败', err);
    }
}

/**
 * 渲染收支对比柱状图
 */
function renderComparisonChart(monthly) {
    const ctx = document.getElementById('trendChart').getContext('2d');
    // 如果已有图表实例，先销毁
    if (window.trendChartInstance) {
        window.trendChartInstance.destroy();
    }
    
    // 过滤有效数据
    const validMonthly = Array.isArray(monthly) ? monthly.filter(m => m && typeof m.income === 'number' && typeof m.expense === 'number') : [];
    
    if (validMonthly.length === 0) {
        // 显示空状态
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.font = '14px Arial';
        ctx.fillStyle = '#999';
        ctx.textAlign = 'center';
        ctx.fillText('暂无月度统计数据', ctx.canvas.width / 2, ctx.canvas.height / 2);
        return;
    }
    
    window.trendChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: validMonthly.map(m => m.month),
            datasets: [
                {
                    label: '收入',
                    data: validMonthly.map(m => m.income),
                    backgroundColor: 'rgba(75, 192, 192, 0.5)',
                    borderColor: 'rgb(75, 192, 192)',
                    borderWidth: 1
                },
                {
                    label: '支出',
                    data: validMonthly.map(m => m.expense),
                    backgroundColor: 'rgba(255, 99, 132, 0.5)',
                    borderColor: 'rgb(255, 99, 132)',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: '月度收支对比'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return value.toFixed(2);
                        }
                    }
                }
            }
        }
    });
}

/**
 * 渲染余额趋势折线图
 */
function renderBalanceTrendChart(monthly) {
    const ctx = document.getElementById('trendChart').getContext('2d');
    // 如果已有图表实例，先销毁
    if (window.trendChartInstance) {
        window.trendChartInstance.destroy();
    }
    
    // 过滤有效数据
    const validMonthly = Array.isArray(monthly) ? monthly.filter(m => m && typeof m.balance === 'number') : [];
    
    if (validMonthly.length === 0) {
        // 显示空状态
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.font = '14px Arial';
        ctx.fillStyle = '#999';
        ctx.textAlign = 'center';
        ctx.fillText('暂无余额统计数据', ctx.canvas.width / 2, ctx.canvas.height / 2);
        return;
    }
    
    window.trendChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: validMonthly.map(m => m.month),
            datasets: [
                {
                    label: '余额',
                    data: validMonthly.map(m => m.balance),
                    borderColor: 'rgb(153, 102, 255)',
                    backgroundColor: 'rgba(153, 102, 255, 0.1)',
                    tension: 0.1,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: '月度余额趋势'
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    ticks: {
                        callback: function(value) {
                            return value.toFixed(2);
                        }
                    }
                }
            }
        }
    });
}

// ============================================
// 服务器关闭功能
// ============================================

/**
 * 关闭服务器函数
 * 显示确认对话框，创建进度模态框，发送关闭请求到服务器
 * 处理服务器响应并更新用户界面
 */
async function shutdownServer() {
    if (!confirm('您确定要关闭服务器吗？关闭后所有用户将无法访问，需要重新启动服务器才能继续使用。')) return;
    
    // 创建进度模态框HTML
    const modalHtml = `
        <div class="modal fade show" style="display: block; background-color: rgba(0,0,0,0.5);" id="shutdownModal">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header bg-warning">
                        <h5 class="modal-title">正在关闭服务器...</h5>
                    </div>
                    <div class="modal-body">
                        <div class="text-center">
                            <div class="spinner-border text-primary mb-3" role="status">
                                <span class="visually-hidden">正在处理...</span>
                            </div>
                            <p id="shutdownMessage">正在发送关闭请求到服务器...</p>
                            <div class="progress mb-3">
                                <div class="progress-bar progress-bar-striped progress-bar-animated" id="shutdownProgress" style="width: 0%"></div>
                            </div>
                            <div id="shutdownDetails" class="small text-muted"></div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" onclick="hideShutdownModal()">取消</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // 创建模态框容器
    const modalContainer = document.createElement('div');
    modalContainer.id = 'shutdownModalContainer';
    modalContainer.innerHTML = modalHtml;
    document.body.appendChild(modalContainer);
    
    try {
        // 更新初始进度和消息
        updateShutdownMessage('正在发送关闭请求...', 10);
        
        // 发送关闭请求到服务器
        const response = await fetch('/api/shutdown', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            updateShutdownMessage('服务器已接收到关闭命令，正在保存数据...', 30);
            
            // 模拟进度条增加（实际进度取决于服务器处理）
            let progress = 30;
            const progressInterval = setInterval(() => {
                progress += 10;
                if (progress > 80) {
                    clearInterval(progressInterval);
                    progress = 80;
                }
                updateShutdownProgress(progress);
            }, 500);
            
            // 5秒后假设服务器关闭完成
            setTimeout(() => {
                clearInterval(progressInterval);
                updateShutdownMessage('服务器已安全关闭', 100);
                updateShutdownProgress(100);
                
                // 显示最终状态和用户操作选项
                setTimeout(() => {
                    updateShutdownMessage('<div class="alert alert-success">服务器已成功关闭</div><p class="mt-3">您现在可以执行以下操作：</p>', 100);
                    const details = document.getElementById('shutdownDetails');
                    details.innerHTML = `
                        <div class="d-grid gap-2">
                            <button class="btn btn-primary" onclick="window.location.reload()">尝试重新连接（如果服务器重启）</button>
                            <button class="btn btn-outline-secondary" onclick="window.close()">关闭浏览器标签页</button>
                            <button class="btn btn-outline-secondary" onclick="hideShutdownModal()">继续查看当前页面</button>
                        </div>
                    `;
                }, 1000);
            }, 5000);
            
        } else {
            const data = await response.json();
            updateShutdownMessage(`关闭失败: ${data.error || '未知错误'}`, 0);
            updateShutdownDetails('<button class="btn btn-warning" onclick="hideShutdownModal()">关闭</button>');
        }
    } catch (err) {
        // 网络错误，可能服务器已关闭
        updateShutdownMessage('服务器连接已中断，可能已成功关闭', 100);
        updateShutdownProgress(100);
        
        setTimeout(() => {
            updateShutdownMessage('<div class="alert alert-success">服务器可能已成功关闭</div><p>网络连接已断开，这通常表示服务器已停止响应。</p>', 100);
            updateShutdownDetails(`
                <p>您可以在3秒后尝试重新连接或关闭页面。</p>
                <div class="d-grid gap-2">
                    <button class="btn btn-primary" onclick="window.location.reload()">尝试重新连接</button>
                    <button class="btn btn-outline-secondary" onclick="window.close()">关闭浏览器标签页</button>
                    <button class="btn btn-outline-secondary" onclick="hideShutdownModal()">继续查看当前页面</button>
                </div>
            `);
        }, 1000);
    }
}

/**
 * 隐藏关闭服务器模态框
 */
function hideShutdownModal() {
    const modalContainer = document.getElementById('shutdownModalContainer');
    if (modalContainer) {
        modalContainer.remove();
    }
}

/**
 * 更新关闭服务器的进度消息
 * @param {string} message - 要显示的消息
 * @param {number} progress - 进度百分比（0-100）
 */
function updateShutdownMessage(message, progress) {
    const msgEl = document.getElementById('shutdownMessage');
    if (msgEl) msgEl.innerHTML = message;
    updateShutdownProgress(progress);
}

/**
 * 更新关闭服务器的进度条
 * @param {number} percent - 进度百分比（0-100）
 */
function updateShutdownProgress(percent) {
    const progressEl = document.getElementById('shutdownProgress');
    if (progressEl) {
        progressEl.style.width = percent + '%';
        progressEl.setAttribute('aria-valuenow', percent);
    }
}

/**
 * 更新关闭服务器的详细信息区域
 * @param {string} html - 要显示的HTML内容
 */
function updateShutdownDetails(html) {
    const detailsEl = document.getElementById('shutdownDetails');
    if (detailsEl) detailsEl.innerHTML = html;
}

// ============================================
// 功能完整性检查
// ============================================

/**
 * 在控制台输出当前可用的函数（用于调试）
 */
function listAvailableFunctions() {
    console.log('可用函数列表:');
    console.log('- shutdownServer(): 关闭服务器');
    console.log('- hideShutdownModal(): 隐藏关闭服务器模态框');
    console.log('- updateShutdownMessage(): 更新关闭进度消息');
    console.log('- updateShutdownProgress(): 更新关闭进度条');
    console.log('- updateShutdownDetails(): 更新关闭详细信息');
}
