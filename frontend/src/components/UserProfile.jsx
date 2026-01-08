import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { 
  User, Edit2, MapPin, Trophy, Star, Activity, Shield, Sword, 
  Target, RefreshCw, ThumbsUp, Crown, Save, X, 
  FileText, Calendar, ChevronLeft, ChevronRight, 
  ChevronLeft as ChevronLeftIcon, Tag, Plus, Palette,
  CheckCircle2, AlertCircle, Hexagon, Sparkles, Flame, Leaf, Wind, Zap, Ghost, Trash2, Loader2
} from 'lucide-react';
import { API_BASE_URL } from '../config/constants';
import { toast } from 'react-hot-toast';

// 🔥 核心修改：引用 BadgeSystem，不再本地定义
import { TitleBadge, TITLE_TIERS, getRankTheme, cleanTitle, BadgeStyleInit } from './BadgeSystem';

const UserProfile = ({ 
    onBack, 
    onOpenAdmin, 
    accountInfo, 
    currentUser, 
    token, 
    lcuProfile, 
    handleSyncProfile, 
    championList,
    viewingTarget = null,
    onUpdateProfile 
}) => {
  
  // 基础 Profile 状态
  const [profile, setProfile] = useState({
    gameName: "加载中...",
    tag: "",
    bio: "",
    region: "艾欧尼亚",
    role: "JUNGLE",
    avatarUrl: `https://ddragon.leagueoflegends.com/cdn/14.1.1/img/profileicon/29.png`,
    rank: "Unranked",
    lp: "0",
    winRate: 0,
    kda: "0.0",
    level: 1,
    favorites: [], 
    recentActivity: [],
    activeTitle: "社区成员",
    availableTitles: ["社区成员"] 
  });

  const [myPosts, setMyPosts] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // 管理员状态
  const [tempTitles, setTempTitles] = useState([]);
  const [newTitleInput, setNewTitleInput] = useState("");
  const [selectedStyleId, setSelectedStyleId] = useState("common"); 
  
  const [matchPage, setMatchPage] = useState(1);
  const MATCHES_PER_PAGE = 6;

  // 权限判断
  const isMe = !viewingTarget || viewingTarget === currentUser;
  const isAdmin = accountInfo?.role === 'admin' || accountInfo?.role === 'root';
  const canEdit = isMe; 

  const getChampImg = (id) => {
      const champ = championList?.find(c => c.id == id || c.key == id); 
      const name = champ ? champ.key : 'LeeSin'; 
      return `https://ddragon.leagueoflegends.com/cdn/14.1.1/img/champion/${name}.png`;
  };

  const getChampName = (id) => {
      const champ = championList?.find(c => c.id == id || c.key == id);
      return champ ? champ.name : '未知';
  };

  // 核心逻辑：计算所有应显示的头衔
  const displayTitles = useMemo(() => {
      let titles = [...(profile.availableTitles || [])];
      if (!titles.includes("社区成员")) titles.unshift("社区成员");
      
      if (isMe && accountInfo) {
          const role = accountInfo.role;
          const adminTier = TITLE_TIERS.find(t => t.id === 'legendary');
          const proTier = TITLE_TIERS.find(t => t.id === 'epic');
          
          if (['admin', 'root'].includes(role) && adminTier) {
              const t = "管理员" + adminTier.marker;
              if (!titles.includes(t)) titles.unshift(t);
          }
          if (['pro', 'vip', 'svip', 'admin', 'root'].includes(role) && proTier) {
              const t = "PRO会员" + proTier.marker;
              if (!titles.includes(t)) titles.unshift(t);
          }
      }
      return titles;
  }, [profile.availableTitles, accountInfo, isMe]);

  // 数据加载
  useEffect(() => {
    const loadData = async () => {
        if (viewingTarget && viewingTarget !== currentUser) {
            try {
                const res = await axios.get(`${API_BASE_URL}/users/profile/${viewingTarget}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const data = res.data;
                const gp = data.game_profile || {};
                
                setProfile({
                    gameName: gp.gameName || data.username,
                    tag: gp.tagLine || "#HEX",
                    bio: data.bio || "这个人很懒，什么都没写。",
                    role: "JUNGLE", 
                    region: "艾欧尼亚",
                    avatarUrl: data.avatar_url,
                    rank: gp.rank || "Unranked",
                    lp: gp.lp || 0,
                    winRate: gp.winRate || 0,
                    kda: gp.kda || "0.0",
                    level: gp.level || 1,
                    favorites: gp.mastery || [],
                    recentActivity: gp.matches || [],
                    activeTitle: data.active_title || "社区成员",
                    availableTitles: [] 
                });
            } catch (error) {
                toast.error("无法加载用户数据");
                onBack();
            }
        } 
        else {
            setProfile(prev => {
                let newData = { ...prev };
                let sourceMatches = prev.recentActivity;

                const source = lcuProfile || (accountInfo?.game_profile);
                
                if (source) {
                    newData = {
                        ...newData,
                        gameName: source.gameName || prev.gameName,
                        tag: source.tagLine || prev.tag,
                        rank: source.rank || prev.rank,
                        lp: source.lp !== undefined ? source.lp : prev.lp,
                        level: source.level || prev.level,
                        avatarUrl: source.profileIconId 
                            ? `https://ddragon.leagueoflegends.com/cdn/14.1.1/img/profileicon/${source.profileIconId}.png`
                            : prev.avatarUrl,
                        favorites: source.mastery || prev.favorites,
                    };
                    if (source.matches && source.matches.length > 0) sourceMatches = source.matches;
                }

                if (accountInfo) {
                    newData.bio = accountInfo.bio || prev.bio;
                    newData.role = accountInfo.role || prev.role;
                    newData.activeTitle = accountInfo.active_title || "社区成员";
                    newData.availableTitles = accountInfo.available_titles || ["社区成员"];
                }

                if (sourceMatches && sourceMatches.length > 0) {
                    newData.recentActivity = sourceMatches;
                    let wins = 0;
                    let kills = 0, deaths = 0, assists = 0;
                    sourceMatches.forEach(m => {
                        if (m.type === 'victory') wins++;
                        const parts = (m.kda || "0/0/0").split('/').map(Number);
                        if (parts.length === 3) {
                            kills += parts[0];
                            deaths += parts[1];
                            assists += parts[2];
                        }
                    });
                    newData.winRate = Math.round((wins / sourceMatches.length) * 100);
                    const avgDeaths = deaths === 0 ? 1 : deaths;
                    newData.kda = ((kills + assists) / avgDeaths).toFixed(1) + ":1";
                }
                return newData;
            });
        }
    };
    loadData();
  }, [viewingTarget, accountInfo, lcuProfile, currentUser, token]);

  const isVip = accountInfo?.is_pro || false; 
  
  useEffect(() => {
    if (token) fetchUserPosts();
  }, [token, viewingTarget, currentUser]);

  const fetchUserPosts = async () => {
    setLoadingPosts(true);
    try {
      const targetUser = viewingTarget || currentUser;
      const res = await axios.get(`${API_BASE_URL}/tips`, {
        params: { hero: "ALL_HEROES", enemy: "ALL_MATCHUPS" } 
      });
      const allTips = res.data.general ? [...res.data.general, ...res.data.matchup] : (Array.isArray(res.data) ? res.data : []);
      const userTips = allTips.filter(t => t.author_id === targetUser);
      userTips.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setMyPosts(userTips);
    } catch (error) {
      console.error("Failed to fetch posts", error);
    } finally {
      setLoadingPosts(false);
    }
  };

  useEffect(() => {
    if (isEditing && canEdit) {
      setEditForm({ bio: profile.bio, role: profile.role });
      setTempTitles([...displayTitles]);
    }
  }, [isEditing, profile, displayTitles, canEdit]);

  const addTitle = () => {
      const val = newTitleInput.trim();
      if (!val) return;
      const selectedStyle = TITLE_TIERS.find(t => t.id === selectedStyleId) || TITLE_TIERS[TITLE_TIERS.length - 1];
      const titleWithMarker = val + selectedStyle.marker;
      
      if (!tempTitles.includes(titleWithMarker)) {
          const newTemp = [...tempTitles, titleWithMarker];
          setTempTitles(newTemp);
          setNewTitleInput("");
          toast.success(`已添加头衔: ${val}`);
          // 自动保存
          if (isAdmin) {
             axios.post(`${API_BASE_URL}/admin/user/titles`, 
                { username: currentUser, titles: newTemp },
                { headers: { Authorization: `Bearer ${token}` } }
            ).catch(e => console.error(e));
          }
      } else {
          toast.error("该头衔已存在");
      }
  };

  const removeTitle = (t) => {
      const displayT = cleanTitle(t);
      if (confirm(`确定要移除 "${displayT}" 头衔吗？`)) {
          setTempTitles(prev => prev.filter(item => item !== t));
          if (profile.activeTitle === t) {
              setProfile(p => ({...p, activeTitle: "社区成员"}));
              toast('当前佩戴的头衔已被移除，已重置为默认', { icon: '⚠️' });
          }
      }
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
        if (isAdmin) {
             await axios.post(`${API_BASE_URL}/admin/user/titles`, 
                { username: currentUser, titles: tempTitles },
                { headers: { Authorization: `Bearer ${token}` } }
            );
        }
        
        await axios.post(`${API_BASE_URL}/users/set_active_title`, 
            { active_title: profile.activeTitle }, 
            { headers: { Authorization: `Bearer ${token}` } }
        );

        setProfile(prev => ({ 
            ...prev, 
            bio: editForm.bio, 
            role: editForm.role,
            availableTitles: isAdmin ? tempTitles : prev.availableTitles 
        }));
        
        setIsEditing(false);
        toast.success("个人资料已更新");
        
        if (onUpdateProfile) onUpdateProfile();

    } catch (e) {
        toast.error("保存失败: " + (e.response?.data?.detail || e.message));
    } finally {
        setIsSaving(false);
    }
  };

  const handleQuickEquip = async (t) => {
      // 乐观更新
      setProfile(prev => ({...prev, activeTitle: t}));
      try {
          await axios.post(`${API_BASE_URL}/users/set_active_title`, 
              { active_title: t }, 
              { headers: { Authorization: `Bearer ${token}` } }
          );
          toast.success(`已佩戴: ${cleanTitle(t)}`);
          if (onUpdateProfile) onUpdateProfile();
      } catch (e) {
          toast.error("佩戴失败，网络异常");
          if (onUpdateProfile) onUpdateProfile();
      }
  };

  const onSyncClick = () => {
      setIsSyncing(true);
      if (handleSyncProfile) handleSyncProfile(); 
      else toast.error("同步功能不可用");
      setTimeout(() => { setIsSyncing(false); }, 2000);
  };

  const roleMap = { "TOP": "上单", "JUNGLE": "打野", "MIDDLE": "中单", "BOTTOM": "下路", "SUPPORT": "辅助" };
  const [activeTab, setActiveTab] = useState('matches');

  const totalMatches = profile.recentActivity.length;
  const totalPages = Math.ceil(totalMatches / MATCHES_PER_PAGE);
  const displayedMatches = profile.recentActivity.slice(
      (matchPage - 1) * MATCHES_PER_PAGE,
      matchPage * MATCHES_PER_PAGE
  );

  const rankTheme = getRankTheme(profile.rank);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col w-full h-full text-slate-100 bg-slate-900 overflow-y-auto custom-scrollbar font-sans animate-in slide-in-from-right duration-300">
      
      {/* 🔥 关键：注入 Badge 系统样式 */}
      <BadgeStyleInit />

      {/* 顶部返回按钮 */}
      <div className="absolute top-6 left-6 z-50">
         <button onClick={onBack} className="flex items-center gap-2 px-4 py-2 bg-slate-900/80 backdrop-blur-md border border-slate-700 rounded-full text-slate-300 hover:text-white hover:bg-slate-800 transition-all shadow-lg group">
            <ChevronLeft size={18} className="group-hover:-translate-x-1 transition-transform"/>
            <span className="font-bold text-sm">返回</span>
         </button>
      </div>

      <div className="relative h-60 md:h-80 bg-slate-900 overflow-hidden group shrink-0">
        <div className={`absolute inset-0 bg-[url('https://ddragon.leagueoflegends.com/cdn/img/champion/splash/LeeSin_1.jpg')] bg-cover bg-[center_20%] transition-all duration-700 ${isVip ? 'opacity-90 saturate-110' : 'opacity-60 grayscale-[30%]'}`}></div>
        <div className={`absolute inset-0 bg-gradient-to-t ${rankTheme.gradientOverlay}`}></div>
        
        {/* 操作区 (仅在看自己时显示) */}
        {isMe && (
            <div className="absolute top-6 right-6 flex gap-3 z-20">
            {(accountInfo?.role === 'admin' || accountInfo?.role === 'root') && (
                <button onClick={onOpenAdmin} className="p-2 bg-rose-900/60 hover:bg-rose-700/80 rounded-full border border-rose-500/50 text-rose-300 hover:text-white backdrop-blur-md transition-all shadow-lg shadow-rose-900/20" title="打开管理员控制台">
                    <Shield size={18} />
                </button>
            )}
            {!isEditing ? (
                <>
                    <button onClick={onSyncClick} className={`p-2 bg-slate-900/60 hover:bg-cyan-600/80 rounded-full border border-slate-600/50 text-cyan-400 hover:text-white backdrop-blur-md transition-all ${isSyncing ? 'animate-spin' : ''}`} title="一键同步 LCU 数据">
                        <RefreshCw size={18} />
                    </button>
                    <button onClick={() => setIsEditing(true)} className="p-2 bg-slate-900/60 hover:bg-blue-600/80 rounded-full border border-slate-600/50 text-blue-400 hover:text-white backdrop-blur-md transition-all" title="编辑资料">
                        <Edit2 size={18} />
                    </button>
                </>
            ) : (
                <div className="flex gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
                <button onClick={() => setIsEditing(false)} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-full text-white text-sm font-bold shadow-lg flex items-center gap-2">
                    <X size={16} /> 取消
                </button>
                <button 
                    onClick={handleSaveProfile} 
                    disabled={isSaving}
                    className={`px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 rounded-full text-white text-sm font-bold shadow-lg flex items-center gap-2 ${isSaving ? 'opacity-70 cursor-not-allowed' : ''}`}
                >
                    {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    {isSaving ? "保存中..." : "保存"}
                </button>
                </div>
            )}
            </div>
        )}
      </div>

      <div className="px-6 md:px-12 -mt-28 relative z-10 max-w-7xl mx-auto w-full pb-20">
        <div className="flex flex-col md:flex-row items-end gap-8">
          
          <div className="relative group shrink-0">
            {/* 当前佩戴头衔 */}
            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 z-30">
                <TitleBadge title={profile.activeTitle} className="shadow-2xl scale-110" />
            </div>

            <div className={`w-36 h-36 md:w-44 md:h-44 rounded-full p-1.5 shadow-2xl overflow-hidden relative z-10 bg-slate-700`}>
              <div className={`w-full h-full rounded-full border-4 overflow-hidden bg-slate-800 relative transition-colors duration-500 ${rankTheme.avatarRing}`}>
                <img src={profile.avatarUrl} alt="Avatar" className={`w-full h-full object-cover transition-transform duration-500 ${isEditing ? 'brightness-50' : 'hover:scale-110'}`}/>
                {isEditing && (
                  <div className="absolute inset-0 flex items-center justify-center cursor-pointer hover:bg-black/20">
                    <RefreshCw className="text-white opacity-80" size={32} />
                  </div>
                )}
              </div>
            </div>
            
            <div className="absolute -bottom-3 left-1/2 transform -translate-x-1/2 bg-slate-900 rounded-lg px-1 py-0.5 border border-slate-700 z-20 shadow-lg">
                <div className="bg-slate-800 text-xs font-bold px-3 py-0.5 rounded text-slate-300 whitespace-nowrap">
                    LV. {profile.level}
                </div>
            </div>
          </div>

          <div className="flex-1 md:mb-2 w-full">
            <div className="flex flex-col md:flex-row md:items-center gap-4 mb-3">
              <h1 className="text-3xl md:text-4xl font-black text-white tracking-wide drop-shadow-lg font-mono flex items-center gap-2">
                {profile.gameName} <span className="text-slate-500 text-xl">{profile.tag}</span>
              </h1>
            </div>

            {/* 非编辑模式下显示所有头衔 (点击佩戴) */}
            {!isEditing && displayTitles.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4 animate-in slide-in-from-left-2 duration-500">
                    {displayTitles.map(t => (
                        <TitleBadge 
                            key={t}
                            title={t} 
                            onClick={isMe ? () => handleQuickEquip(t) : undefined}
                            className={`
                                ${profile.activeTitle === t ? 'ring-1 ring-white/50 scale-105 shadow-lg brightness-110' : 'opacity-70 hover:opacity-100 hover:scale-105 grayscale-[0.3] hover:grayscale-0'}
                                ${isMe ? 'cursor-pointer' : 'cursor-default'}
                            `}
                        />
                    ))}
                </div>
            )}

            {/* 编辑头衔区域 */}
            {isEditing && (
                <div className="w-full mt-2 mb-6 animate-in slide-in-from-top-2 fade-in duration-300">
                    <div className="bg-[#0f1623] border border-slate-700/60 rounded-xl p-4 shadow-2xl relative overflow-hidden group/panel">
                        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#C8AA6E]/30 to-transparent"></div>
                        
                        <div className="flex items-center justify-between mb-4">
                            <label className="text-xs font-bold text-[#C8AA6E] uppercase tracking-wider flex items-center gap-2">
                                <Tag size={14} className="fill-current"/> 
                                {isAdmin ? "头衔工坊 (实时预览)" : "选择佩戴头衔"}
                            </label>
                            <span className="text-[10px] text-slate-500 font-mono">
                                当前预览: {cleanTitle(profile.activeTitle)}
                            </span>
                        </div>

                        {/* 1. 现有头衔列表 */}
                        <div className="flex flex-wrap gap-2 mb-4 min-h-[40px] bg-slate-900/30 p-2 rounded-lg border border-white/5">
                            {tempTitles.map(t => {
                                const isActive = profile.activeTitle === t;
                                return (
                                    <div key={t} className={`relative ${isActive ? 'z-10' : ''}`}>
                                        <TitleBadge 
                                            title={t} 
                                            onClick={() => setProfile(prev => ({...prev, activeTitle: t}))}
                                            showRemove={isAdmin}
                                            onRemove={removeTitle}
                                            className={isActive ? 'ring-2 ring-white shadow-lg scale-105 brightness-110' : 'opacity-80 hover:opacity-100 grayscale-[0.3] hover:grayscale-0'}
                                        />
                                        {isActive && <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-slate-900 z-20 flex items-center justify-center pointer-events-none"></div>}
                                    </div>
                                )
                            })}
                            {tempTitles.length === 0 && (
                                <span className="text-slate-600 text-xs italic py-1 flex items-center gap-2"><AlertCircle size={12}/> 暂无可用头衔</span>
                            )}
                        </div>

                        {/* 2. 管理员添加界面 (增强版：带预览) */}
                        {isAdmin && (
                            <div className="flex flex-col gap-4 p-4 bg-black/40 rounded-xl border border-white/10 relative mt-4">
                                
                                {/* 顶部：预览区 */}
                                <div className="flex items-center justify-between border-b border-white/5 pb-3">
                                    <div className="flex items-col gap-1">
                                        <div className="text-xs font-bold text-[#C8AA6E] uppercase flex items-center gap-1.5">
                                            <Palette size={14}/> 样式工坊
                                        </div>
                                        <div className="text-[10px] text-slate-500">定制专属荣耀</div>
                                    </div>
                                    
                                    {/* 核心预览 */}
                                    <div className="scale-110 origin-right">
                                        <TitleBadge 
                                            title={newTitleInput || "效果预览"} 
                                            styleOverride={TITLE_TIERS.find(t => t.id === selectedStyleId)} 
                                            className="shadow-2xl"
                                        />
                                    </div>
                                </div>

                                {/* 中间：输入与选择 */}
                                <div className="space-y-3">
                                    {/* 输入框 */}
                                    <div>
                                        <label className="text-[10px] text-slate-500 mb-1.5 block ml-1">1. 输入显示文字</label>
                                        <input 
                                            className="w-full bg-[#010A13] border border-slate-600 rounded-lg px-3 py-2 text-xs text-white focus:border-[#C8AA6E] outline-none transition-all placeholder:text-slate-700 text-center font-bold tracking-wide"
                                            placeholder="输入文字 (如: 峡谷之巅)"
                                            value={newTitleInput}
                                            onChange={e => setNewTitleInput(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && addTitle()}
                                        />
                                    </div>

                                    {/* 样式选择器 */}
                                    <div>
                                        <label className="text-[10px] text-slate-500 mb-1.5 block ml-1">2. 选择特效样式</label>
                                        <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                                            {TITLE_TIERS.filter(t => t.id !== 'common').map(tier => {
                                                const isSelected = selectedStyleId === tier.id;
                                                return (
                                                    <button 
                                                        key={tier.id}
                                                        onClick={() => setSelectedStyleId(tier.id)}
                                                        className={`
                                                            relative h-9 rounded-md border transition-all flex items-center justify-center overflow-hidden
                                                            ${isSelected ? 'border-[#C8AA6E] bg-[#C8AA6E]/10 ring-1 ring-[#C8AA6E]/50 z-10' : 'border-white/10 opacity-60 hover:opacity-100 hover:border-white/30 bg-black/20'}
                                                        `}
                                                        title={tier.label}
                                                    >
                                                        <div className="scale-[0.65] pointer-events-none">
                                                            <TitleBadge styleOverride={tier} title="Aa" />
                                                        </div>
                                                        {isSelected && <div className="absolute inset-0 border border-[#C8AA6E] rounded-md pointer-events-none shadow-[inset_0_0_10px_rgba(200,170,110,0.3)]"></div>}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </div>
                                </div>
                                
                                {/* 底部：添加按钮 */}
                                <button 
                                    onClick={addTitle} 
                                    disabled={!newTitleInput.trim()}
                                    className={`
                                        w-full py-2.5 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg
                                        ${newTitleInput.trim() 
                                            ? 'bg-gradient-to-r from-[#C8AA6E] to-[#b89b65] text-[#091428] hover:brightness-110 active:scale-95 shadow-amber-900/20' 
                                            : 'bg-slate-800 text-slate-500 cursor-not-allowed'}
                                    `}
                                >
                                    <Plus size={14} strokeWidth={3}/> 生成并入库
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Profile Info */}
            <div className="relative group mb-5">
              {isEditing ? (
                <textarea 
                  value={editForm.bio}
                  onChange={(e) => setEditForm({...editForm, bio: e.target.value})}
                  className="w-full bg-slate-800/80 border border-slate-600 text-slate-200 text-sm p-3 rounded-lg focus:outline-none focus:border-cyan-500"
                  placeholder="写下你的游戏宣言..."
                />
              ) : (
                <p className="text-slate-300 max-w-3xl leading-relaxed text-sm md:text-base border-l-4 border-cyan-500/50 pl-4 py-1 italic bg-gradient-to-r from-slate-800/40 to-transparent rounded-r">
                  "{profile.bio}"
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-3">
              <div className={`flex items-center gap-2 px-4 py-1.5 rounded text-sm font-medium shadow-sm border transition-colors ${rankTheme.bg} ${rankTheme.border} ${rankTheme.text} ${rankTheme.shadow}`}>
                <Trophy size={15} className={rankTheme.accent} />
                <span className="font-bold tracking-wide">
                    {profile.rank} {profile.rank !== 'Unranked' && profile.rank !== 'UNRANKED' ? `${profile.lp} LP` : ''}
                </span>
              </div>
              
              {isEditing ? (
                <div className="relative">
                  <select 
                    value={editForm.role}
                    onChange={(e) => setEditForm({...editForm, role: e.target.value})}
                    className="appearance-none bg-slate-800 border border-cyan-500 text-cyan-400 text-sm py-1.5 px-4 pr-8 rounded cursor-pointer focus:outline-none"
                  >
                    {Object.entries(roleMap).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                  <Target size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-cyan-500 pointer-events-none" />
                </div>
              ) : (
                <div className="flex items-center gap-2 px-4 py-1.5 bg-slate-800 border border-slate-600 rounded text-slate-300 text-sm">
                  <Target size={15} className="text-cyan-400" />
                  <span>{roleMap[profile.role]}</span>
                </div>
              )}

              <div className="flex items-center gap-2 px-4 py-1.5 bg-slate-800 border border-slate-600 rounded text-slate-400 text-sm">
                <MapPin size={15} />
                <span>{profile.region}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 下方卡片区域 */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-12">
          <div className="lg:col-span-4 space-y-6">
            <div className={`backdrop-blur-md p-6 rounded-2xl border shadow-xl relative overflow-hidden transition-colors duration-500 ${rankTheme.bg} ${rankTheme.border} ${rankTheme.glow}`}>
              <h3 className={`text-base font-bold flex items-center gap-2 mb-5 uppercase tracking-wider ${rankTheme.accent}`}>
                <Activity size={18} /> 近期战绩 (近{profile.recentActivity.length}场)
              </h3>
              <div className="grid grid-cols-2 gap-4 text-center">
                <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-700/50">
                  <div className="text-2xl font-bold text-white">{profile.winRate}%</div>
                  <div className="text-xs text-slate-500 mt-1">近期胜率</div>
                </div>
                <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-700/50">
                  <div className={`text-2xl font-bold ${rankTheme.accent}`}>{profile.kda}</div>
                  <div className="text-xs text-slate-500 mt-1">近期 KDA</div>
                </div>
              </div>
            </div>

            <div className={`backdrop-blur-md p-6 rounded-2xl border shadow-xl transition-colors duration-500 ${rankTheme.bg} ${rankTheme.border}`}>
              <h3 className={`text-base font-bold flex items-center gap-2 mb-5 uppercase tracking-wider ${rankTheme.accent}`}>
                <Star size={18} /> 常用英雄 (Mastery Top 3)
              </h3>
              <div className="space-y-3">
                {profile.favorites.map((champId, index) => (
                  <div key={index} className="flex items-center gap-3 p-2 hover:bg-slate-700/30 rounded-lg transition-colors cursor-pointer group">
                    <img 
                      src={getChampImg(champId)} 
                      alt={champId} 
                      className={`w-10 h-10 rounded-md border border-slate-600 transition-colors group-hover:${rankTheme.accent.replace('text', 'border')}`}
                    />
                    <div className="flex-1 flex justify-between items-center">
                      <span className="text-sm font-medium text-slate-300 group-hover:text-white">
                        {getChampName(champId)}
                      </span>
                      <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded">Top.{index + 1}</span>
                    </div>
                  </div>
                ))}
                {profile.favorites.length === 0 && <div className="text-xs text-slate-500 text-center">暂无数据，请点击右上角同步</div>}
              </div>
            </div>
          </div>

          <div className="lg:col-span-8">
            <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl border border-slate-700/60 shadow-xl overflow-hidden min-h-[500px] flex flex-col">
              <div className="flex border-b border-slate-700/50">
                <button 
                  onClick={() => setActiveTab('matches')}
                  className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-colors relative ${activeTab === 'matches' ? `text-white bg-slate-800/30` : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/10'}`}
                >
                  <Sword size={16} /> 近期对局战绩
                  {activeTab === 'matches' && <div className={`absolute bottom-0 left-0 w-full h-0.5 shadow-[0_-2px_10px_rgba(255,255,255,0.5)] ${rankTheme.accent.replace('text', 'bg')}`}></div>}
                </button>
                <button 
                  onClick={() => setActiveTab('posts')}
                  className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-colors relative ${activeTab === 'posts' ? 'text-cyan-400 bg-slate-800/30' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/10'}`}
                >
                  <FileText size={16} /> 社区攻略与发帖 ({myPosts.length})
                  {activeTab === 'posts' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-cyan-400 shadow-[0_-2px_10px_rgba(34,211,238,0.5)]"></div>}
                </button>
              </div>

              <div className="flex-1 p-4 bg-slate-900/20">
                {activeTab === 'matches' && (
                  <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    {displayedMatches.length > 0 ? (
                        displayedMatches.map((match) => (
                          <div key={match.id} className="relative overflow-hidden rounded-xl group hover:shadow-lg transition-all border border-slate-700/50 bg-slate-800/40 hover:bg-slate-800/60">
                            <div className={`absolute left-0 top-0 bottom-0 w-1 ${match.type === 'victory' ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                            <div className="flex items-center justify-between p-4 pl-6">
                              <div className="flex items-center gap-4">
                                <img 
                                  src={getChampImg(match.champ)} 
                                  alt={match.champ}
                                  className={`w-12 h-12 rounded-lg border-2 ${match.type === 'victory' ? 'border-emerald-500/30' : 'border-rose-500/30'}`}
                                />
                                <div>
                                  <div className={`font-bold ${match.type === 'victory' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {match.type === 'victory' ? '胜利' : '失败'}
                                  </div>
                                  <div className="text-xs text-slate-400">{match.mode} • {getChampName(match.champ)}</div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-lg font-bold text-white font-mono">{match.kda}</div>
                                <div className="text-xs text-slate-500">{match.time}</div>
                              </div>
                            </div>
                          </div>
                        ))
                    ) : (
                        <div className="flex flex-col items-center justify-center py-10 text-slate-600 gap-4 opacity-60">
                           <Sword size={40} />
                           <p>暂无战绩数据</p>
                        </div>
                    )}
                     {totalMatches > MATCHES_PER_PAGE && (
                        <div className="flex items-center justify-center gap-4 mt-4 py-2">
                            <button onClick={() => setMatchPage(p => Math.max(1, p - 1))} disabled={matchPage === 1} className="p-2 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-400 hover:text-white"><ChevronLeftIcon size={20}/></button>
                            <span className="text-sm font-bold text-slate-400">{matchPage} / {totalPages}</span>
                            <button onClick={() => setMatchPage(p => Math.min(totalPages, p + 1))} disabled={matchPage === totalPages} className="p-2 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-400 hover:text-white"><ChevronRight size={20}/></button>
                        </div>
                    )}
                  </div>
                )}
                
                {activeTab === 'posts' && (
                  <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    {loadingPosts ? (<div className="text-center py-10 text-slate-500">加载中...</div>) : myPosts.length > 0 ? (
                        myPosts.map((post) => (
                          <div key={post.id} className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4 hover:border-cyan-500/30 transition-all hover:bg-slate-800/60 group cursor-pointer relative overflow-hidden">
                            <div className="flex justify-between items-start mt-1">
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-xs px-2 py-0.5 rounded bg-slate-700 text-slate-300 border border-slate-600">{post.enemy === 'general' ? '酒馆' : post.enemy}</span>
                                  <span className="text-xs text-slate-500 ml-1 flex items-center gap-1"><Calendar size={10}/> {new Date(post.created_at).toLocaleDateString()}</span>
                                </div>
                                <h4 className="text-base font-bold text-slate-200 group-hover:text-cyan-400 transition-colors line-clamp-2">{post.content.substring(0, 50)}...</h4>
                              </div>
                              <div className="flex flex-col items-end gap-1 mt-6">
                                <div className={`flex items-center gap-1.5 px-2 py-1 rounded border bg-slate-700/30 border-slate-600/30 text-slate-500`}>
                                    <ThumbsUp size={14} />
                                    <span className="text-sm font-bold">{post.liked_by?.length || 0}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))
                    ) : (<div className="text-center py-10 text-slate-500">暂无发帖记录</div>)}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserProfile;