import React from 'react';
import { useGameCore } from './hooks/useGameCore';

// 页面组件引入
import LandingPage from './components/LandingPage';
import CommunityPage from './components/CommunityPage';
import MainConsole from './pages/MainConsole';
import OverlayConsole from './pages/OverlayConsole'; // 🟢 悬浮窗页面

export default function App() {
    // 1. 从 Hook 中获取所有状态(state)和操作方法(actions)
    const { state, actions } = useGameCore();

    // =================================================================
    // 🟢 路由逻辑 A：悬浮窗模式 (Overlay Mode)
    // =================================================================
    if (state.isOverlay) {
        return <OverlayConsole state={state} actions={actions} />;
    }

    // =================================================================
    // 🟢 路由逻辑 B：社区页面 (Community Page)
    // =================================================================
    if (state.showCommunity) {
        return (
            <CommunityPage 
                onBack={() => actions.setShowCommunity(false)} 
                championList={state.championList} // 🟢 修复：传递英雄数据
                currentUser={state.currentUser}   // 🟢 修复：传递用户数据，修复点赞发帖
                token={state.token}               // 🟢 修复：传递 Token
            />
        );
    }

    // =================================================================
    // 🟢 路由逻辑 C：落地页 (Landing Page)
    // =================================================================
    if (!state.hasStarted) {
        return (
            <LandingPage 
                onEnter={() => actions.setHasStarted(true)} 
                onOpenCommunity={() => actions.setShowCommunity(true)}
            />
        );
    }

    // =================================================================
    // 🟢 路由逻辑 D：主控台 (Main Console)
    // =================================================================
    return <MainConsole state={state} actions={actions} />;
}