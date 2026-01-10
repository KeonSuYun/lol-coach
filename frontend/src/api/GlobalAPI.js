import axios from 'axios';
import { API_BASE_URL } from '../config/constants';

// 1. 定义全局内存缓存 (即使组件重渲染，这个变量也不会清空)
const CACHE = {
    tips: {}, 
};

// 2. 创建 Axios 实例
const apiClient = axios.create({
    baseURL: API_BASE_URL
});

/**
 * 核心：带缓存的攻略获取函数
 * 作用：拦截重复请求，保护服务器
 */
export const fetchMatchTips = async (heroName, enemyName) => {
    // 基础校验
    if (!heroName || heroName === "None") return { general: [], matchup: [] };

    // 生成唯一缓存键 (例如: "Yasuo_vs_Yone")
    const cacheKey = `${heroName}_vs_${enemyName || 'None'}`;

    // ✅ A. 命中缓存：直接返回内存数据，不发网络请求！
    if (CACHE.tips[cacheKey]) {
        // console.log("🚀 [Cache] 命中攻略缓存:", cacheKey);
        return CACHE.tips[cacheKey];
    }

    // ❌ B. 未命中：发起真正的网络请求
    try {
        console.log("🌐 [Network] 请求服务器:", cacheKey);
        const res = await apiClient.get('/tips', {
            params: { 
                hero: heroName, 
                enemy: enemyName || "None" 
            }
        });
        
        // 写入缓存，下次就不请求了
        CACHE.tips[cacheKey] = res.data;
        return res.data;
    } catch (error) {
        console.error("获取攻略失败:", error);
        return { general: [], matchup: [] }; // 返回空结构防崩
    }
};

// (可选) 清理缓存
export const clearApiCache = () => {
    CACHE.tips = {};
};