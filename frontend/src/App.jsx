import React, { useState } from 'react';
import { ShieldAlert } from 'lucide-react'; 
import MainConsole from './pages/MainConsole';
import OverlayConsole from './pages/OverlayConsole';
import CommunityPage from './components/CommunityPage';
import UserProfile from './components/UserProfile';
import { useGameCore } from './hooks/useGameCore';

// 引入管理组件
import AdminDashboard from './components/AdminDashboard';
import AdminPanel from './components/AdminPanel';
// 🔥 引入销售仪表盘
import SalesDashboard from './components/SalesDashboard';

function App() {
  const { state, actions } = useGameCore();
  
  // 解构需要的状态和动作
  const { showAdminPanel, adminView, token, currentUser, isOverlay, roleMapping } = state;
  const { setShowAdminPanel, setAdminView } = actions;

  // 🔥 新增：查看他人主页的状态
  const [viewingProfileId, setViewingProfileId] = useState(null);

  // 🔥 监听 URL 中的销售邀请码 (?ref=xxx)
  React.useEffect(() => {
      const params = new URLSearchParams(window.location.search);
      const refCode = params.get('ref');
      if (refCode) {
          localStorage.setItem('sales_ref', refCode);
          window.history.replaceState({}, document.title, window.location.pathname);
      }
  }, []);

  // 渲染主内容的辅助函数
  const renderContent = () => {
    // 1. 游戏内覆盖模式 (优先级最高)
    if (state.isOverlay) {
      return <OverlayConsole state={state} actions={actions} />;
    }

    // 2. 个人主页 (支持查看他人)
    // 🔥 如果 viewingProfileId 存在，或者 showProfile 为 true
    if (state.showProfile || viewingProfileId) {
        return (
            <UserProfile 
                onBack={() => {
                    actions.setShowProfile(false);
                    setViewingProfileId(null); // 清除查看目标
                }}
                accountInfo={state.accountInfo}
                token={state.token}
                championList={state.championList}
                currentUser={state.currentUser}
                lcuProfile={state.lcuProfile}
                handleSyncProfile={actions.handleSyncProfile}
                onOpenAdmin={() => { 
                    actions.setAdminView('dashboard'); 
                    actions.setShowAdminPanel(true); 
                }}
                // 🔥 传入目标ID (如果是查看自己，viewingProfileId 为 null，UserProfile 内部会处理)
                viewingTarget={viewingProfileId || state.currentUser} 
                
                // 🔥🔥🔥 关键修复：传入数据刷新回调，解决“出去就没了”的问题 🔥🔥🔥
                onUpdateProfile={() => actions.fetchUserInfo()}
            />
        )
    }

    // 3. 绝活社区
    if (state.showCommunity) {
      return (
        <CommunityPage 
          onBack={() => actions.setShowCommunity(false)}
          onShowProfile={() => actions.setShowProfile(true)}
          onLogout={actions.logout}
          onShowSettings={() => actions.setShowSettingsModal(true)}
          onShowAdmin={() => { 
              actions.setAdminView('dashboard'); 
              actions.setShowAdminPanel(true); 
          }}
          championList={state.championList} 
          roleMapping={state.roleMapping} 
          currentUser={state.currentUser}
          token={state.token}
          accountInfo={state.accountInfo}
          userRank={state.userRank}
        />
      );
    }

    // 4. 主控台 (默认视图)
    // 🔥 注入 onViewProfile 回调，以便 Header -> MessageModal 调用
    return <MainConsole 
        state={state} 
        actions={{
            ...actions, 
            onViewProfile: (targetId) => setViewingProfileId(targetId) 
        }} 
    />;
  };

  return (
    <>
      {/* 1. 核心页面内容 */}
      {renderContent()}

      {/* 2. 全局挂载：销售合伙人仪表盘 */}
      <SalesDashboard 
          isOpen={state.showSalesDashboard} 
          onClose={() => actions.setShowSalesDashboard(false)} 
          username={state.currentUser}
          token={state.token}
      />

      {/* 3. 全局挂载：管理员面板 */}
      {showAdminPanel && token && (
          adminView === 'panel' ? (
              <AdminPanel 
                  token={token} 
                  onBack={() => setShowAdminPanel(false)} 
              />
          ) : (
              <AdminDashboard 
                  token={token} 
                  username={currentUser} 
                  onClose={() => setShowAdminPanel(false)} 
              />
          )
      )}

      {/* 4. 全局挂载：管理员悬浮球 (Overlay模式除外) */}
      {currentUser && ["admin", "root"].includes(currentUser) && !isOverlay && (
          <button 
              onClick={() => {
                  setAdminView('dashboard');
                  setShowAdminPanel(true);
              }} 
              className="fixed bottom-6 left-6 z-[9999] bg-red-600/90 hover:bg-red-500 text-white p-3 rounded-full shadow-lg backdrop-blur hover:scale-110 transition-all animate-in fade-in zoom-in duration-300"
              title="管理员控制台"
          >
              <ShieldAlert size={20} />
          </button>
      )}
    </>
  );
}

export default App;