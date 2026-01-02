import React from 'react';
import { useGameCore } from './hooks/useGameCore';

// 页面组件引入
import LandingPage from './components/LandingPage';
import CommunityPage from './components/CommunityPage';
import UserProfile from './components/UserProfile'; // 🔥 确保引用了 UserProfile
import MainConsole from './pages/MainConsole';
import OverlayConsole from './pages/OverlayConsole'; 
import DownloadModal from './components/modals/DownloadModal'; 

export default function App() {
    const { state, actions } = useGameCore();

    if (state.isOverlay) {
        return <OverlayConsole state={state} actions={actions} />;
    }

    // 🟢 个人主页路由 (优先级高于其他)
    if (state.showProfile) {
        return (
            <UserProfile 
                onBack={() => actions.setShowProfile(false)} 
                accountInfo={state.accountInfo}
                currentUser={state.currentUser}
                token={state.token}
                lcuProfile={state.lcuProfile}
                handleSyncProfile={actions.handleSyncProfile} // 🔥 传递同步函数
                championList={state.championList}
                onOpenAdmin={() => {
                    actions.setAdminView('panel'); // 👈 1. 设定为“面板模式”(用户管理)
                    actions.setShowProfile(false);   
                    actions.setShowAdminPanel(true); 
                }} 
            />
        );
    }

    // 🟢 社区页面路由
    if (state.showCommunity) {
        return (
            <CommunityPage 
                onBack={() => actions.setShowCommunity(false)} 
                championList={state.championList} 
                currentUser={state.currentUser}   
                token={state.token}               
            />
        );
    }

    if (!state.hasStarted) {
        return (
            <>
                <DownloadModal 
                    isOpen={state.showDownloadModal} 
                    onClose={() => actions.setShowDownloadModal(false)} 
                />
                <LandingPage 
                    onEnter={() => actions.setHasStarted(true)} 
                    onOpenCommunity={() => actions.setShowCommunity(true)}
                    onDownloadClick={() => actions.setShowDownloadModal(true)} 
                />
            </>
        );
    }

    return <MainConsole state={state} actions={actions} />;
}