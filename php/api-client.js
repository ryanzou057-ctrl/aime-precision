/**
 * AIME Precision - PHP API 客户端
 * 前端调用示例
 */

const API_BASE = '/api';

// 存储Token
let authToken = localStorage.getItem('auth_token') || '';

// API请求封装
async function api(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };

    if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
    }

    const response = await fetch(url, {
        ...options,
        headers
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || 'API请求失败');
    }

    return data;
}

// ========== 认证 API ==========
const Auth = {
    // 注册
    register: (email, password, name) =>
        api('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ email, password, name })
        }),

    // 登录
    login: (email, password) =>
        api('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        }),

    // 获取当前用户
    me: () => api('/auth/me'),

    // 修改密码
    changePassword: (oldPassword, newPassword) =>
        api('/auth/change-password', {
            method: 'POST',
            body: JSON.stringify({ old_password: oldPassword, new_password: newPassword })
        }),

    // 保存Token
    setToken: (token) => {
        authToken = token;
        localStorage.setItem('auth_token', token);
    },

    // 清除Token
    logout: () => {
        authToken = '';
        localStorage.removeItem('auth_token');
    }
};

// ========== 产品 API ==========
const Products = {
    // 获取产品列表
    list: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return api(`/products${query ? '?' + query : ''}`);
    },

    // 获取单个产品
    get: (id) => api(`/products/${id}`),

    // 创建产品
    create: (data) => {
        const formData = new FormData();
        Object.keys(data).forEach(key => {
            if (key === 'image' && data[key]) {
                formData.append('image', data[key]);
            } else {
                formData.append(key, data[key]);
            }
        });
        return fetch(`${API_BASE}/products`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` },
            body: formData
        }).then(r => r.json());
    },

    // 更新产品
    update: (id, data) => {
        const formData = new FormData();
        Object.keys(data).forEach(key => {
            formData.append(key, data[key]);
        });
        return fetch(`${API_BASE}/products/${id}`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${authToken}` },
            body: formData
        }).then(r => r.json());
    },

    // 删除产品
    delete: (id) =>
        api(`/products/${id}`, { method: 'DELETE' }),

    // 更改状态 (draft/active/archived)
    updateStatus: (id, status) =>
        api(`/products/${id}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status })
        }),

    // 上架
    publish: (id) =>
        api(`/products/${id}/publish`, { method: 'POST' }),

    // 下架
    unpublish: (id) =>
        api(`/products/${id}/unpublish`, { method: 'POST' }),

    // 归档
    archive: (id) =>
        api(`/products/${id}/archive`, { method: 'POST' }),

    // 批量操作
    bulk: (action, productIds) =>
        api('/products/bulk', {
            method: 'POST',
            body: JSON.stringify({ action, product_ids: productIds })
        })
};

// ========== 订单 API ==========
const Orders = {
    // 获取订单列表
    list: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return api(`/orders${query ? '?' + query : ''}`);
    },

    // 获取单个订单
    get: (id) => api(`/orders/${id}`),

    // 创建订单
    create: (data) =>
        api('/orders', {
            method: 'POST',
            body: JSON.stringify(data)
        }),

    // 更新状态
    updateStatus: (id, status) =>
        api(`/orders/${id}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status })
        }),

    // 退款
    refund: (id, amount, reason) =>
        api(`/orders/${id}/refund`, {
            method: 'POST',
            body: JSON.stringify({ amount, reason })
        }),

    // 取消订单
    cancel: (id, reason) =>
        api(`/orders/${id}/cancel`, {
            method: 'POST',
            body: JSON.stringify({ reason })
        }),

    // 获取订单统计
    stats: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return api(`/orders/stats${query ? '?' + query : ''}`);
    }
};

// ========== 管理 API ==========
const Admin = {
    // 获取仪表盘数据
    dashboard: () => api('/admin/dashboard'),

    // 获取用户列表
    users: () => api('/admin/users'),

    // 创建用户
    createUser: (data) =>
        api('/admin/users', {
            method: 'POST',
            body: JSON.stringify(data)
        }),

    // 更新用户
    updateUser: (id, data) =>
        api(`/admin/users/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        }),

    // 删除用户
    deleteUser: (id) =>
        api(`/admin/users/${id}/delete`, { method: 'DELETE' }),

    // 获取分类
    categories: () => api('/admin/categories'),

    // 创建分类
    createCategory: (data) =>
        api('/admin/categories', {
            method: 'POST',
            body: JSON.stringify(data)
        }),

    // 获取设置
    settings: () => api('/admin/settings'),

    // 更新设置
    updateSettings: (settings) =>
        api('/admin/settings', {
            method: 'PUT',
            body: JSON.stringify(settings)
        })
};

// 导出
window.API = { Auth, Products, Orders, Admin };
