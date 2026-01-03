import React from 'react';
import { ShieldAlert } from 'lucide-react'; 
import MainConsole from './pages/MainConsole';
import OverlayConsole from './pages/OverlayConsole';
import CommunityPage from './components/CommunityPage';
import UserProfile from './components/UserProfile';
import { useGameCore } from './hooks/useGameCore';

// 引入管理组件
import AdminDashboard from './components/AdminDashboard';
import AdminPanel from './components/AdminPanel';

function App() {
  const { state, actions } = useGameCore();
  
  // 解构需要的状态和动作
  const { showAdminPanel, adminView, token, currentUser, isOverlay, roleMapping } = state;
  const { setShowAdminPanel, setAdminView } = actions;

  // 渲染主内容的辅助函数
  const renderContent = () => {
    // 1. 游戏内覆盖模式 (优先级最高)
    if (state.isOverlay) {
      return <OverlayConsole state={state} actions={actions} />;
    }

    // 2. 个人主页 (优先级高于社区，这样在社区点头像能跳转过来)
    if (state.showProfile) {
        return (
            <UserProfile 
                onBack={() => actions.setShowProfile(false)}
                accountInfo={state.accountInfo}
                token={state.token}
                championList={state.championList} // 👈 必须加这个，头像才能正常显示
                currentUser={state.currentUser}   // 👈 用于判断是不是自己的主页
                lcuProfile={state.lcuProfile}     // 👈 用于显示同步的 LCU 数据
                handleSyncProfile={actions.handleSyncProfile} // 👈 让右上角的"同步按钮"生效
            />
        )
    }

    // 3. 绝活社区
    if (state.showCommunity) {
      return (
        <CommunityPage 
          onBack={() => actions.setShowCommunity(false)}
          
          // 🔥 关键：传入导航和登出方法
          onShowProfile={() => actions.setShowProfile(true)}
          onLogout={actions.logout}
          
          // 🔥🔥🔥 [新增] 传入设置和管理面板的方法，以便在社区页调用
          onShowSettings={() => actions.setShowSettingsModal(true)}
          onShowAdmin={() => { 
              actions.setAdminView('dashboard'); 
              actions.setShowAdminPanel(true); 
          }}
          
          // 数据透传
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
    return <MainConsole state={state} actions={actions} />;
  };

  return (
    <>
      {/* 1. 核心页面内容 */}
      {renderContent()}

      {/* 2. 全局挂载：管理员面板 (仅限管理员且已登录) */}
      {showAdminPanel && token && (
          adminView === 'panel' ? (
              <AdminPanel 
                  token={token} 
                  onBack={() => setShowAdminPanel(false)} 
              />
          ) : (
              <AdminDashboard 
                  token={token} 
                  onClose={() => setShowAdminPanel(false)} 
              />
          )
      )}

      {/* 3. 全局挂载：管理员悬浮球 (Overlay模式除外) */}
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