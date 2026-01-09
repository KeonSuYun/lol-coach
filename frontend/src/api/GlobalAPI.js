import axios from 'axios';
import { API_BASE_URL } from '../config/constants';

// 1. 定义全局缓存容器 (防止重复请求)
const CACHE = {
    tips: {},      // 缓存攻略数据
};

// 2. 创建 Axios 实例
const apiClient = axios.create({
    baseURL: API_BASE_URL
});

// 3. 核心：带缓存的攻略获取函数
export const fetchMatchTips = async (heroName, enemyName) => {
    // 如果英雄名无效，直接返回空
    if (!heroName) return { general: [], matchup: [] };

    // 生成唯一缓存键 (例如: "Yasuo_vs_Yone")
    const cacheKey = `${heroName}_vs_${enemyName || 'None'}`;

    // ✅ A. 命中缓存：直接返回，不发请求！(拦截刷屏的关键)
    if (CACHE.tips[cacheKey]) {
        return CACHE.tips[cacheKey];
    }

    // ❌ B. 未命中：发起网络请求
    try {
        console.log("🌐 [Network] 请求攻略数据:", cacheKey);
        const res = await apiClient.get('/tips', {
            params: { 
                hero: heroName, 
                enemy: enemyName || "None" 
            }
        });
        
        // 写入缓存
        CACHE.tips[cacheKey] = res.data;
        return res.data;
    } catch (error) {
        console.error("获取攻略失败:", error);
        // 出错返回空结构，防止前端报错
        return { general: [], matchup: [] }; 
    }
};

// 4. (可选) 清理缓存的方法
export const clearApiCache = () => {
    CACHE.tips = {};
};