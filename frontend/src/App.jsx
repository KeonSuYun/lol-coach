import React, { useState, useMemo, useEffect } from 'react';
import { ShieldAlert } from 'lucide-react'; 
import MainConsole from './pages/MainConsole';
import OverlayConsole from './pages/OverlayConsole';
import CommunityPage from './components/CommunityPage';
import UserProfile from './components/UserProfile';
import { useGameCore } from './hooks/useGameCore';

// 引入管理组件
import AdminDashboard from './components/AdminDashboard';
import AdminPanel from './components/AdminPanel';
// 引入销售仪表盘
import SalesDashboard from './components/SalesDashboard';
// 引入 MiniHUD 组件
import MiniHUD from './components/MiniHUD';

function App() {
  const { state, actions } = useGameCore();
  
  // 解构需要的状态和动作
  const { showAdminPanel, adminView, token, currentUser, isOverlay, aiResults, analyzeType } = state;
  const { setShowAdminPanel, setAdminView } = actions;

  // 查看他人主页的状态
  const [viewingProfileId, setViewingProfileId] = useState(null);

  // 本地视觉配置状态 (用于驱动 MiniHUD 的缩放/透明度)
  const [visualConfig, setVisualConfig] = useState({ 
      transparency: 5, 
      fontSize: 1.0, 
      volume: 1.0 
  });

  // 鼠标锁定状态 (用于控制 MiniHUD 的编辑边框)
  const [isMouseLocked, setIsMouseLocked] = useState(true);

  // 监听 URL 中的销售邀请码
  useEffect(() => {
      const params = new URLSearchParams(window.location.search);
      const refCode = params.get('ref');
      if (refCode) {
          localStorage.setItem('sales_ref', refCode);
          window.history.replaceState({}, document.title, window.location.pathname);
      }
  }, []);

  // 监听主进程消息 (视觉配置 + 鼠标状态)
  useEffect(() => {
      if (window.require) {
          const { ipcRenderer } = window.require('electron');
          
          // 初始化读取视觉配置
          const saved = localStorage.getItem('hex_visual_config');
          if (saved) {
              try { setVisualConfig(JSON.parse(saved)); } catch(e){}
          }

          // 监听视觉更新
          const handleUpdate = (e, cfg) => {
              if (cfg) setVisualConfig(cfg);
          };

          // 监听鼠标穿透状态
          const handleMouseStatus = (e, locked) => setIsMouseLocked(locked);
          
          ipcRenderer.on('update-visuals', handleUpdate);
          ipcRenderer.on('mouse-ignore-status', handleMouseStatus);
          
          // 初始化获取鼠标状态
          ipcRenderer.invoke('get-mouse-status').then(setIsMouseLocked);

          return () => {
              ipcRenderer.removeListener('update-visuals', handleUpdate);
              ipcRenderer.removeListener('mouse-ignore-status', handleMouseStatus);
          };
      }
  }, []);

  // HUD 数据解析逻辑
  const hudData = useMemo(() => {
      const raw = aiResults?.[analyzeType];
      if (!raw) return null;

      let dashboard = null;
      // 1. 如果已经是对象
      if (typeof raw === 'object') {
          dashboard = raw.dashboard;
      } 
      // 2. 如果是字符串 (流式传输中或未解析)
      else if (typeof raw === 'string') {
          try {
              // 简单的容错解析，尝试找到 dashboard 字段
              const clean = raw.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
              const start = clean.indexOf('{');
              const end = clean.lastIndexOf('}');
              if (start !== -1 && end !== -1) {
                  const validJson = clean.substring(start, end + 1);
                  const parsed = JSON.parse(validJson);
                  dashboard = parsed.dashboard;
              }
          } catch (e) {
              // 解析失败忽略
          }
      }

      if (!dashboard) return null;

      // 优先返回团队卡片 (Team 模式)，其次是普通 HUD (Jungle 模式)
      return dashboard.team_top_left_cards || dashboard.hud || null;
  }, [aiResults, analyzeType]);

  // 渲染主内容的辅助函数
  const renderContent = () => {
    // 1. 游戏内覆盖模式 (优先级最高)
    if (state.isOverlay) {
      
      const params = new URLSearchParams(window.location.search);
      const overlayType = params.get('type');

      // 场景 A: 如果是 HUD 小窗口 -> 渲染 MiniHUD
      if (overlayType === 'hud') {
          return (
              <div className="w-screen h-screen flex items-start justify-start p-2 pointer-events-none">
                  {/* 传入 isLocked 状态，实现所见即所得的编辑提示 */}
                  <MiniHUD 
                      data={hudData} 
                      visualConfig={visualConfig} 
                      isLocked={isMouseLocked} 
                  />
              </div>
          );
      }

      // 场景 B: 如果是 Console 主窗口 -> 渲染 OverlayConsole
      return <OverlayConsole state={state} actions={actions} />;
    }

    // 2. 个人主页
    if (state.showProfile || viewingProfileId) {
        return (
            <UserProfile 
                onBack={() => {
                    actions.setShowProfile(false);
                    setViewingProfileId(null); 
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
                viewingTarget={viewingProfileId || state.currentUser} 
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
      {renderContent()}

      {/* 全局挂载：销售合伙人仪表盘 */}
      <SalesDashboard 
          isOpen={state.showSalesDashboard} 
          onClose={() => actions.setShowSalesDashboard(false)} 
          username={state.currentUser}
          token={state.token}
      />

      {/* 全局挂载：管理员面板 */}
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

      {/* 全局挂载：管理员悬浮球 (Overlay模式除外) */}
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