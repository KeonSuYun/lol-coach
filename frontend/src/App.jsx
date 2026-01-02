import React from 'react';
import { useGameCore } from './hooks/useGameCore';

// 页面组件引入
import LandingPage from './components/LandingPage';
import CommunityPage from './components/CommunityPage';
import UserProfile from './components/UserProfile'; 
import MainConsole from './pages/MainConsole';
import OverlayConsole from './pages/OverlayConsole'; 
import DownloadModal from './components/modals/DownloadModal'; 

export default function App() {
    const { state, actions } = useGameCore();

    if (state.isOverlay) {
        return <OverlayConsole state={state} actions={actions} />;
    }

    // 计算显示名称
    const lcuName = state.accountInfo?.game_profile?.gameName;
    const displayUser = (lcuName && lcuName !== "Unknown") ? lcuName : state.currentUser;

    if (state.showProfile) {
        return (
            <UserProfile 
                onBack={() => actions.setShowProfile(false)} 
                accountInfo={state.accountInfo}
                currentUser={state.currentUser}
                token={state.token}
                lcuProfile={state.lcuProfile}
                handleSyncProfile={actions.handleSyncProfile} 
                championList={state.championList}
                onOpenAdmin={() => {
                    actions.setAdminView('panel'); 
                    actions.setShowProfile(false);   
                    actions.setShowAdminPanel(true); 
                }} 
            />
        );
    }

    if (state.showCommunity) {
        return (
            <CommunityPage 
                onBack={() => actions.setShowCommunity(false)} 
                championList={state.championList} 
                currentUser={displayUser}
                userRole={state.userRole} 
                token={state.token}
                
                // 🔥 [新增] 传递个人菜单所需的所有数据和回调
                accountInfo={state.accountInfo}
                lcuStatus={state.lcuStatus}
                onLogout={actions.logout}
                onShowLogin={() => actions.setShowLoginModal(true)}
                onShowPricing={() => actions.setShowPricingModal(true)}
                onShowSettings={() => actions.setShowSettingsModal(true)}
                onShowProfile={() => actions.setShowProfile(true)}
                onShowAdmin={() => {
                    actions.setAdminView('dashboard');
                    actions.setShowAdminPanel(true);
                }}
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