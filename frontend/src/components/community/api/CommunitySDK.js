import axios from 'axios';
// 确保路径正确：api目录 -> community目录 -> components目录 -> src目录 -> config目录
import { API_BASE_URL } from '../../../config/constants';

const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
};

// 静态配置
export const TAVERN_TOPICS = [
    { id: 'all', label: '全部动态', icon: 'Layers' },
    { id: 'teamup', label: '寻找队友', icon: 'UserPlus' },
    { id: 'skin', label: '皮肤鉴赏', icon: 'Sparkles' },
    { id: 'chat', label: '酒馆闲聊', icon: 'BookOpen' }, 
    { id: 'rant', label: '吐槽大会', icon: 'MessageCircle' },
];

export const CATEGORIES = [
    { id: 'mechanic', label: '机制技巧' },
    { id: 'matchup', label: '对位详解' },
    { id: 'build', label: '出装符文' },
    { id: 'teamfight', label: '团战思路' },
    { id: 'jungle', label: '游走节奏' }
];

export const CommunitySDK = {
    // 1. 获取英雄列表 (增强版：防崩溃)
    getChampionList: async () => {
        try {
            // 尝试从缓存读取
            const stored = localStorage.getItem('champions_data');
            if (stored) {
                try {
                    const parsed = JSON.parse(stored);
                    // 校验：必须是数组且长度大于0
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        return parsed;
                    }
                } catch (err) {
                    console.warn("Cached champion data corrupted, clearing...", err);
                    localStorage.removeItem('champions_data');
                }
            }
            
            // 缓存无效或不存在，发起请求
            console.log("Fetching champion list from API...");
            const res = await axios.get('https://game.gtimg.cn/images/lol/act/img/js/heroList/hero_list.js');
            
            // 校验返回数据
            if (res.data && Array.isArray(res.data.hero)) {
                // 存入缓存
                localStorage.setItem('champions_data', JSON.stringify(res.data.hero));
                return res.data.hero;
            }
            
            return [];
        } catch (e) {
            console.error("Failed to fetch champion list", e);
            return [];
        }
    },

    getHeroGuides: async (heroId) => {
        try {
            const params = heroId ? { heroId } : {};
            const res = await axios.get(`${API_BASE_URL}/community/posts`, { params });
            return res.data;
        } catch (e) {
            console.error("Failed to fetch posts", e);
            return [];
        }
    },

    getTavernPosts: async () => {
        try {
            const res = await axios.get(`${API_BASE_URL}/community/tavern`);
            return res.data;
        } catch (e) {
            console.error("Failed to fetch tavern posts", e);
            return [];
        }
    },

    getHeroWikiSummary: async (heroId) => {
        try {
            if (!heroId) return null;
            const res = await axios.get(`${API_BASE_URL}/community/wiki/${heroId}`);
            // 确保返回的是对象且非空，否则返回 null
            return (res.data && Object.keys(res.data).length > 0) ? res.data : null;
        } catch (e) {
            // console.error("Wiki fetch failed", e); // 可选：屏蔽 404 报错日志
            return null;
        }
    },

    publishGuide: async (guideData) => {
        const res = await axios.post(`${API_BASE_URL}/community/posts`, guideData, { headers: getAuthHeaders() });
        return res.data;
    },

    publishTavernPost: async (postData) => {
        const res = await axios.post(`${API_BASE_URL}/community/tavern`, postData, { headers: getAuthHeaders() });
        return res.data;
    },

    deletePost: async (postId) => {
        await axios.delete(`${API_BASE_URL}/community/posts/${postId}`, { headers: getAuthHeaders() });
        return true;
    },

    deleteTavernPost: async (postId) => {
        await axios.delete(`${API_BASE_URL}/community/tavern/${postId}`, { headers: getAuthHeaders() });
        return true;
    },

    updatePost: async (postId, updates) => {
        await axios.put(`${API_BASE_URL}/community/posts/${postId}`, updates, { headers: getAuthHeaders() });
        return true;
    },

    updateTavernPost: async (postId, updates) => {
        await axios.put(`${API_BASE_URL}/community/tavern/${postId}`, updates, { headers: getAuthHeaders() });
        return true;
    },

    getComments: async (postId) => {
        try {
            const res = await axios.get(`${API_BASE_URL}/community/comments/${postId}`);
            return res.data;
        } catch (e) {
            return [];
        }
    },

    publishComment: async (postId, content) => {
        const res = await axios.post(`${API_BASE_URL}/community/comments`, { postId, content }, {
            headers: getAuthHeaders()
        });
        return res.data;
    }
};