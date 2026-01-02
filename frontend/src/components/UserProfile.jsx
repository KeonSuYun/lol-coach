import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  User, Edit2, MapPin, Trophy, Star, Activity, Shield, Sword, 
  Target, RefreshCw, ThumbsUp, Crown, Save, X, 
  FileText, Zap, Calendar, ChevronLeft, ChevronRight, 
  ChevronLeft as ChevronLeftIcon, Tag, Plus, Palette,
  CheckCircle2, AlertCircle, Flame, Leaf, Wind, Ghost, Hexagon, Sparkles
} from 'lucide-react';
import { API_BASE_URL } from '../config/constants';
import { toast } from 'react-hot-toast';

// 🔥🔥🔥 1. 全局样式注入 (最新版：含边缘遮罩流光) 🔥🔥🔥
const BADGE_CUSTOM_STYLES = `
  @keyframes border-flow {
    0% { transform: translateX(-150%) skewX(-15deg); }
    40%, 100% { transform: translateX(150%) skewX(-15deg); }
  }
  @keyframes spin-slow {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  @keyframes breathe {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.85; transform: scale(1.02); }
  }
  
  /* 流光动画：6秒一次，更加缓慢优雅 */
  .animate-flow-slow {
    animation: border-flow 6s ease-in-out infinite;
  }
  
  /* 微呼吸：非常柔和 */
  .animate-breathe {
    animation: breathe 5s ease-in-out infinite;
  }
  
  .animate-spin-slow {
    animation: spin-slow 4s linear infinite;
  }

  /* 🔥 核心：边缘遮罩技术 🔥 */
  /* 这会让内部变为空心，只显示 padding 大小的边缘区域 */
  .mask-border-only {
    -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
    padding: 1.5px; /* 控制流光边框的粗细 */
  }
`;

// 🔥🔥🔥 2. 头衔配置系统 (视觉+逻辑合并版) 🔥🔥🔥
const TITLE_TIERS = [
  {
    id: 'challenger',
    label: "巅峰/王者系",
    marker: '\u200B', // 零宽空格
    keywords: ["王者", "Challenger", "巅峰", "第一", "Top1", "King"],
    style: "bg-gradient-to-r from-slate-900 via-amber-600 to-slate-900 text-amber-100 border-amber-400/60 shadow-[0_0_15px_rgba(245,158,11,0.5)] ring-1 ring-amber-300/40",
    icon: <Hexagon size={12} className="fill-amber-400 text-amber-100 animate-spin-slow" />,
    animation: "animate-breathe", 
    hasFlow: true, 
    glow: "shadow-amber-500/40"
  },
  {
    id: 'legendary',
    label: "官方/传说系",
    marker: '\u200C', // 零宽非连接符
    keywords: ["Admin", "GM", "Root", "官方", "S级", "Legend", "管理员"],
    style: "bg-gradient-to-r from-red-950/90 via-rose-900/80 to-red-950/90 text-rose-100 border-rose-500/60 shadow-[0_0_15px_rgba(244,63,94,0.4)] ring-1 ring-rose-400/30",
    icon: <Shield size={12} className="fill-rose-500/20" />,
    animation: "animate-breathe",
    hasFlow: true,
    glow: "shadow-rose-500/30"
  },
  {
    id: 'void',
    label: "虚空/深渊系",
    marker: '\u200D', // 零宽连接符
    keywords: ["虚空", "Void", "进化", "吞噬", "深渊", "Kaisa"],
    style: "bg-gradient-to-r from-violet-950 via-fuchsia-900 to-purple-950 text-fuchsia-100 border-fuchsia-500/60 shadow-[0_0_15px_rgba(192,38,211,0.4)]",
    icon: <Sparkles size={12} className="text-fuchsia-400" />,
    animation: "", 
    hasFlow: true,
    glow: "shadow-fuchsia-500/30"
  },
  {
    id: 'fire',
    label: "火焰/战斗系",
    marker: '\u2060', // 词连接符
    keywords: ["火焰", "地狱", "红莲", "燃烧", "龙魂", "Ignite"],
    style: "bg-gradient-to-r from-orange-950 via-red-900 to-orange-950 text-orange-100 border-orange-500/60 shadow-[0_0_15px_rgba(249,115,22,0.4)]",
    icon: <Flame size={12} className="fill-orange-500/20 text-orange-400" />,
    animation: "",
    hasFlow: true,
    glow: "shadow-orange-500/30"
  },
  {
    id: 'epic',
    label: "职业/核心系",
    marker: '\u2062', // 不可见乘号
    keywords: ["PRO", "核心", "绝活", "MVP", "职业", "冠军", "LPL"],
    style: "bg-gradient-to-r from-amber-900/90 via-yellow-900/80 to-amber-900/90 text-amber-100 border-amber-500/60 shadow-[0_0_10px_rgba(245,158,11,0.3)]",
    icon: <Crown size={12} className="fill-amber-500/20" />,
    animation: "",
    hasFlow: true,
    glow: "shadow-amber-500/20"
  },
  {
    id: 'nature',
    label: "自然/治疗系",
    marker: '\u2064', // 不可见加号
    keywords: ["自然", "艾欧尼亚", "绽灵", "森林", "守护", "Heal"],
    style: "bg-gradient-to-r from-emerald-950 via-teal-900 to-green-950 text-emerald-100 border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.3)]",
    icon: <Leaf size={12} className="text-emerald-400" />,
    animation: "",
    hasFlow: false,
    glow: "shadow-emerald-500/20"
  },
  {
    id: 'ice',
    label: "极地/冰霜系",
    marker: '\u2063', // 不可见分隔符
    keywords: ["冰霜", "弗雷尔卓德", "极地", "凛冬", "Cold"],
    style: "bg-gradient-to-r from-cyan-950 via-sky-900 to-blue-950 text-sky-100 border-sky-400/50 shadow-[0_0_10px_rgba(56,189,248,0.3)]",
    icon: <Wind size={12} className="text-sky-300" />,
    animation: "",
    hasFlow: false,
    glow: "shadow-sky-500/20"
  },
  {
    id: 'rare',
    label: "专家/大师系",
    marker: '\u2061', // 函数应用
    keywords: ["作者", "攻略", "大师", "宗师", "钻石", "峡谷", "专家"],
    style: "bg-gradient-to-r from-blue-900/90 to-cyan-900/90 text-cyan-100 border-cyan-500/50 shadow-[0_0_8px_rgba(6,182,212,0.2)]",
    icon: <Zap size={12} className="fill-cyan-500/20" />,
    animation: "",
    hasFlow: false,
    glow: "shadow-cyan-500/20"
  },
  {
    id: 'shadow',
    label: "暗影/潜行系",
    marker: '', 
    keywords: ["暗影", "刺客", "潜行", "幽灵", "Ninja"],
    style: "bg-gradient-to-r from-slate-950 via-slate-800 to-slate-950 text-slate-200 border-slate-600 shadow-[0_0_8px_rgba(148,163,184,0.1)]",
    icon: <Ghost size={12} className="text-slate-400" />,
    animation: "",
    hasFlow: false,
    glow: ""
  },
  {
    id: 'common',
    label: "默认/普通系",
    marker: '', 
    keywords: [], 
    style: "bg-slate-800/80 text-slate-300 border-slate-600/60 hover:bg-slate-700 transition-colors",
    icon: <User size={12} />,
    animation: "",
    hasFlow: false,
    glow: ""
  }
];

// 辅助：获取头衔配置
const getTitleConfig = (title) => {
  if (!title) return TITLE_TIERS[TITLE_TIERS.length - 1];
  
  // 1. 优先检查隐形标记
  const markerMatch = TITLE_TIERS.find(tier => tier.marker && title.includes(tier.marker));
  if (markerMatch) return markerMatch;

  // 2. 其次检查关键词
  const keywordMatch = TITLE_TIERS.find(tier => tier.keywords.some(k => title.toLowerCase().includes(k.toLowerCase())));
  
  return keywordMatch || TITLE_TIERS[TITLE_TIERS.length - 1]; 
};

// 辅助：清洗标题
const cleanTitle = (title) => {
    if (!title) return "";
    let clean = title;
    TITLE_TIERS.forEach(tier => {
        if (tier.marker) clean = clean.replaceAll(tier.marker, "");
    });
    return clean;
};

// 🔥🔥🔥 3. 段位主题生成器 (最新版) 🔥🔥🔥
const getRankTheme = (rank) => {
    const r = (rank || "").toLowerCase();
    
    // 默认主题
    let theme = {
        border: "border-slate-700/60",
        bg: "bg-slate-800/40",
        text: "text-slate-300",
        accent: "text-slate-400",
        shadow: "shadow-lg",
        glow: "",
        avatarRing: "border-slate-800",
        gradientOverlay: "from-slate-900/0 via-slate-900/0 to-slate-900"
    };

    if (r.includes('challenger') || r.includes('王者')) {
        theme = {
            border: "border-amber-400/50",
            bg: "bg-amber-950/20",
            text: "text-amber-100",
            accent: "text-amber-400",
            shadow: "shadow-amber-900/20",
            glow: "shadow-[0_0_20px_rgba(245,158,11,0.3)]",
            avatarRing: "border-amber-500",
            gradientOverlay: "from-amber-500/10 via-transparent to-slate-900"
        };
    } else if (r.includes('grandmaster') || r.includes('宗师')) {
        theme = {
            border: "border-rose-500/50",
            bg: "bg-rose-950/20",
            text: "text-rose-100",
            accent: "text-rose-400",
            shadow: "shadow-rose-900/20",
            glow: "shadow-[0_0_20px_rgba(244,63,94,0.3)]",
            avatarRing: "border-rose-500",
            gradientOverlay: "from-rose-500/10 via-transparent to-slate-900"
        };
    } else if (r.includes('master') || r.includes('大师')) {
        theme = {
            border: "border-purple-500/50",
            bg: "bg-purple-950/20",
            text: "text-purple-100",
            accent: "text-purple-400",
            shadow: "shadow-purple-900/20",
            glow: "shadow-[0_0_20px_rgba(168,85,247,0.3)]",
            avatarRing: "border-purple-500",
            gradientOverlay: "from-purple-500/10 via-transparent to-slate-900"
        };
    } else if (r.includes('diamond') || r.includes('钻')) {
        theme = {
            border: "border-cyan-400/50",
            bg: "bg-cyan-950/20",
            text: "text-cyan-100",
            accent: "text-cyan-400",
            shadow: "shadow-cyan-900/20",
            glow: "shadow-[0_0_20px_rgba(34,211,238,0.3)]",
            avatarRing: "border-cyan-400",
            gradientOverlay: "from-cyan-500/10 via-transparent to-slate-900"
        };
    } else if (r.includes('platinum') || r.includes('铂金')) {
        theme = {
            border: "border-teal-400/50",
            bg: "bg-teal-950/20",
            text: "text-teal-100",
            accent: "text-teal-400",
            shadow: "shadow-teal-900/20",
            glow: "shadow-[0_0_15px_rgba(45,212,191,0.2)]",
            avatarRing: "border-teal-400",
            gradientOverlay: "from-teal-500/10 via-transparent to-slate-900"
        };
    } else if (r.includes('gold') || r.includes('黄金')) {
        theme = {
            border: "border-yellow-500/40",
            bg: "bg-yellow-950/10",
            text: "text-yellow-100",
            accent: "text-yellow-400",
            shadow: "shadow-yellow-900/10",
            glow: "shadow-[0_0_15px_rgba(234,179,8,0.2)]",
            avatarRing: "border-yellow-500",
            gradientOverlay: "from-yellow-500/5 via-transparent to-slate-900"
        };
    }

    return theme;
};

// 🔥🔥🔥 子组件：头衔徽章 (核心升级：支持 mask-border-only 流光) 🔥🔥🔥
const TitleBadge = ({ title, onClick, showRemove, onRemove, className = "", styleOverride = null }) => {
    if (!title && !styleOverride) return null;
    
    // 如果传入了 styleOverride (预览用)，直接使用；否则根据 title 计算
    const config = styleOverride || getTitleConfig(title);
    const displayText = styleOverride ? title : cleanTitle(title);

    return (
        <div 
            onClick={onClick}
            className={`
                relative group flex items-center justify-center gap-1.5 px-3 py-1 rounded-full text-[10px] md:text-xs font-bold border tracking-wide select-none transition-all duration-300 overflow-hidden
                ${config.style} 
                ${config.animation}
                ${onClick ? 'cursor-pointer hover:scale-105 active:scale-95' : ''}
                ${className}
            `}
        >
             {/* 🔥 核心升级：边缘遮罩流光 */}
            {config.hasFlow && (
                <div className="absolute inset-0 rounded-full mask-border-only pointer-events-none z-0">
                    <div className="w-full h-full bg-gradient-to-r from-transparent via-white/80 to-transparent -translate-x-full animate-flow-slow" />
                </div>
            )}
            
            <span className="opacity-90 relative z-10 shrink-0 flex items-center">{config.icon}</span>
            <span className="relative z-10 drop-shadow-md whitespace-nowrap">{displayText}</span>

            {showRemove && (
                <button 
                    onClick={(e) => { e.stopPropagation(); onRemove && onRemove(title); }}
                    className="absolute right-0 top-0 bottom-0 px-1.5 bg-black/20 hover:bg-black/50 text-white/50 hover:text-white transition-colors flex items-center justify-center backdrop-blur-sm opacity-0 group-hover:opacity-100 z-20"
                    title="移除此头衔"
                >
                    <X size={10}/>
                </button>
            )}
        </div>
    );
};

const UserProfile = ({ onBack, onOpenAdmin, accountInfo, currentUser, token, lcuProfile, handleSyncProfile, championList }) => {
  // 注入样式
  useEffect(() => {
    const styleSheet = document.createElement("style");
    styleSheet.innerText = BADGE_CUSTOM_STYLES;
    document.head.appendChild(styleSheet);
    return () => document.head.removeChild(styleSheet);
  }, []);

  const [profile, setProfile] = useState({
    gameName: currentUser || "未登录用户",
    tag: "#HEX",
    bio: "这个人很懒，什么都没写。",
    region: "艾欧尼亚",
    role: "JUNGLE",
    avatarUrl: `https://ddragon.leagueoflegends.com/cdn/14.1.1/img/profileicon/29.png`,
    rank: "Unranked",
    lp: "0",
    winRate: 0,
    kda: "0.0",
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
  
  // 管理员状态
  const [tempTitles, setTempTitles] = useState([]);
  const [newTitleInput, setNewTitleInput] = useState("");
  const [selectedStyleId, setSelectedStyleId] = useState("common"); 
  
  const [matchPage, setMatchPage] = useState(1);
  const MATCHES_PER_PAGE = 6;
  const isAdmin = accountInfo?.role === 'admin' || accountInfo?.role === 'root';

  const getChampImg = (id) => {
      const champ = championList?.find(c => c.id == id || c.key == id); 
      const name = champ ? champ.key : 'LeeSin'; 
      return `https://ddragon.leagueoflegends.com/cdn/14.1.1/img/champion/${name}.png`;
  };

  const getChampName = (id) => {
      const champ = championList?.find(c => c.id == id || c.key == id);
      return champ ? champ.name : '未知';
  };

  useEffect(() => {
    setProfile(prev => {
        let newData = { ...prev };
        let sourceMatches = prev.recentActivity;

        if (lcuProfile) {
            newData = {
                ...newData,
                gameName: lcuProfile.gameName || prev.gameName,
                tag: lcuProfile.tagLine || prev.tag,
                rank: lcuProfile.rank || prev.rank,
                lp: lcuProfile.lp !== undefined ? lcuProfile.lp : prev.lp, // ✨ 修复：同步 LCU 的胜点
                level: lcuProfile.level || prev.level,
                avatarUrl: lcuProfile.profileIconId 
                    ? `https://ddragon.leagueoflegends.com/cdn/14.1.1/img/profileicon/${lcuProfile.profileIconId}.png`
                    : prev.avatarUrl,
                favorites: lcuProfile.mastery || prev.favorites,
            };
            if (lcuProfile.matches && lcuProfile.matches.length > 0) sourceMatches = lcuProfile.matches;
        } else if (accountInfo && accountInfo.game_profile) {
             const saved = accountInfo.game_profile;
             newData = {
                ...newData,
                gameName: saved.gameName || prev.gameName,
                tag: saved.tagLine || prev.tag,
                rank: saved.rank || prev.rank,
                lp: saved.lp !== undefined ? saved.lp : prev.lp, // ✨ 修复：同步数据库的胜点
                level: saved.level || prev.level,
                avatarUrl: saved.profileIconId 
                    ? `https://ddragon.leagueoflegends.com/cdn/14.1.1/img/profileicon/${saved.profileIconId}.png`
                    : prev.avatarUrl,
                favorites: saved.mastery || prev.favorites,
                bio: accountInfo.bio || prev.bio, 
                role: accountInfo.role || prev.role
             };
             if (saved.matches && saved.matches.length > 0) sourceMatches = saved.matches;
        }

        if (accountInfo) {
            newData.activeTitle = accountInfo.active_title || "社区成员";
            newData.availableTitles = accountInfo.available_titles || ["社区成员"];
        }

        if (sourceMatches && sourceMatches.length > 0) {
            newData.recentActivity = sourceMatches;
            let wins = 0;
            let kills = 0, deaths = 0, assists = 0;
            sourceMatches.forEach(m => {
                if (m.type === 'victory') wins++;
                const parts = m.kda.split('/').map(Number);
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
  }, [lcuProfile, accountInfo]);

  const isVip = accountInfo?.is_pro || false;
  
  useEffect(() => {
    if (token && currentUser) fetchMyContent();
  }, [token, currentUser]);

  const fetchMyContent = async () => {
    setLoadingPosts(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/tips`, {
        params: { hero: "ALL_HEROES", enemy: "ALL_MATCHUPS" } 
      });
      const allTips = res.data.general ? [...res.data.general, ...res.data.matchup] : (Array.isArray(res.data) ? res.data : []);
      const myOwnTips = allTips.filter(t => t.author_id === currentUser);
      myOwnTips.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setMyPosts(myOwnTips);
    } catch (error) {
      console.error("Failed to fetch posts", error);
    } finally {
      setLoadingPosts(false);
    }
  };

  // 🔥🔥🔥 核心：初始化编辑状态时的自动授权逻辑 (含去重与标记绑定) 🔥🔥🔥
  useEffect(() => {
    if (isEditing) {
      setEditForm({ bio: profile.bio, role: profile.role });
      
      let currentTitles = [...(profile.availableTitles || ["社区成员"])];
      
      // 定义官方专属头衔
      const adminTier = TITLE_TIERS.find(t => t.id === 'legendary');
      const adminTitleFull = "管理员" + adminTier.marker; 

      const proTier = TITLE_TIERS.find(t => t.id === 'epic');
      const proTitleFull = "PRO会员" + proTier.marker;

      // 严格判定：只有是管理员，才自动注入管理员头衔
      if (isAdmin) {
          const hasAdminTitle = currentTitles.some(t => t.includes("管理员") && t.includes(adminTier.marker));
          if (!hasAdminTitle) currentTitles.unshift(adminTitleFull);
      }

      // 严格判定：只有是Pro会员，才自动注入PRO头衔
      if (isVip) {
          const hasProTitle = currentTitles.some(t => t.includes("PRO") && t.includes(proTier.marker));
          if (!hasProTitle) currentTitles.unshift(proTitleFull);
      }
      
      setTempTitles(currentTitles);
    }
  }, [isEditing, profile, isAdmin, isVip]);

  const addTitle = () => {
      const val = newTitleInput.trim();
      if (!val) return;

      const selectedStyle = TITLE_TIERS.find(t => t.id === selectedStyleId) || TITLE_TIERS[TITLE_TIERS.length - 1];
      const titleWithMarker = val + selectedStyle.marker;

      if (!tempTitles.includes(titleWithMarker)) {
          setTempTitles([...tempTitles, titleWithMarker]);
          setNewTitleInput("");
          toast.success(`已添加头衔: ${val}`);
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
              if (isAdmin) {
                 axios.post(`${API_BASE_URL}/users/set_active_title`, { active_title: "社区成员" }, { headers: { Authorization: `Bearer ${token}` } });
              }
              toast('当前佩戴的头衔已被移除，已重置为默认', { icon: '⚠️' });
          }
      }
  };

  const handleSaveProfile = async () => {
    try {
        if (isAdmin) {
             await axios.post(`${API_BASE_URL}/admin/user/titles`, 
                { username: currentUser, titles: tempTitles },
                { headers: { Authorization: `Bearer ${token}` } }
            );
        }
        setProfile(prev => ({ 
            ...prev, 
            bio: editForm.bio, 
            role: editForm.role,
            availableTitles: isAdmin ? tempTitles : prev.availableTitles 
        }));
        setIsEditing(false);
        toast.success("个人资料已更新");
    } catch (e) {
        toast.error("保存失败: " + (e.response?.data?.detail || e.message));
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
      
      <div className="absolute top-6 left-6 z-50">
         <button onClick={onBack} className="flex items-center gap-2 px-4 py-2 bg-slate-900/80 backdrop-blur-md border border-slate-700 rounded-full text-slate-300 hover:text-white hover:bg-slate-800 transition-all shadow-lg group">
            <ChevronLeft size={18} className="group-hover:-translate-x-1 transition-transform"/>
            <span className="font-bold text-sm">返回</span>
         </button>
      </div>

      <div className="relative h-60 md:h-80 bg-slate-900 overflow-hidden group shrink-0">
        <div className={`absolute inset-0 bg-[url('https://ddragon.leagueoflegends.com/cdn/img/champion/splash/LeeSin_1.jpg')] bg-cover bg-[center_20%] transition-all duration-700 ${isVip ? 'opacity-90 saturate-110' : 'opacity-60 grayscale-[30%]'}`}></div>
        <div className={`absolute inset-0 bg-gradient-to-t ${rankTheme.gradientOverlay}`}></div>
        
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
              <button onClick={handleSaveProfile} className="px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 rounded-full text-white text-sm font-bold shadow-lg flex items-center gap-2">
                <Save size={16} /> 保存
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="px-6 md:px-12 -mt-28 relative z-10 max-w-7xl mx-auto w-full pb-20">
        <div className="flex flex-col md:flex-row items-end gap-8">
          
          <div className="relative group shrink-0">
            {/* 🔥 当前佩戴头衔 */}
            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 z-30">
                <TitleBadge title={profile.activeTitle} className="shadow-2xl scale-110" />
            </div>

            {/* 🔥🔥🔥 核心修改：移除 animate-spin-slow 动画 🔥🔥🔥 */}
            <div className={`w-36 h-36 md:w-44 md:h-44 rounded-full p-1.5 shadow-2xl overflow-hidden relative z-10 ${isVip ? 'bg-gradient-to-b from-amber-300 via-yellow-500 to-amber-700' : 'bg-slate-700'}`}>
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

            {/* 🔥🔥🔥 头衔管理面板 🔥🔥🔥 */}
            {isEditing && (
                <div className="w-full mt-2 mb-6 animate-in slide-in-from-top-2 fade-in duration-300">
                    <div className="bg-[#0f1623] border border-slate-700/60 rounded-xl p-4 shadow-2xl relative overflow-hidden group/panel">
                        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#C8AA6E]/30 to-transparent"></div>
                        
                        <div className="flex items-center justify-between mb-4">
                            <label className="text-xs font-bold text-[#C8AA6E] uppercase tracking-wider flex items-center gap-2">
                                <Tag size={14} className="fill-current"/> 
                                {isAdmin ? "头衔管理仓库 (点击佩戴 / 移除)" : "选择佩戴头衔"}
                            </label>
                            <span className="text-[10px] text-slate-500 font-mono">
                                当前: {cleanTitle(profile.activeTitle)}
                            </span>
                        </div>

                        {/* 1. 现有头衔列表 */}
                        <div className="flex flex-wrap gap-2 mb-4 min-h-[40px] bg-slate-900/30 p-2 rounded-lg border border-white/5">
                            {(isAdmin ? tempTitles : profile.availableTitles).map(t => {
                                const isActive = profile.activeTitle === t;
                                return (
                                    <div key={t} className={`relative ${isActive ? 'z-10' : ''}`}>
                                        <TitleBadge 
                                            title={t} 
                                            onClick={() => {
                                                setProfile(prev => ({...prev, activeTitle: t}));
                                                axios.post(`${API_BASE_URL}/users/set_active_title`, { active_title: t }, { headers: { Authorization: `Bearer ${token}` } })
                                                    .then(() => toast.success(`已佩戴: ${cleanTitle(t)}`));
                                            }}
                                            showRemove={isAdmin}
                                            onRemove={removeTitle}
                                            className={isActive ? 'ring-2 ring-white shadow-lg scale-105 brightness-110' : 'opacity-80 hover:opacity-100 grayscale-[0.3] hover:grayscale-0'}
                                        />
                                        {isActive && <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-slate-900 z-20 flex items-center justify-center pointer-events-none"></div>}
                                    </div>
                                )
                            })}
                            {(isAdmin ? tempTitles : profile.availableTitles).length === 0 && (
                                <span className="text-slate-600 text-xs italic py-1 flex items-center gap-2"><AlertCircle size={12}/> 暂无可用头衔</span>
                            )}
                        </div>

                        {/* 2. 管理员添加界面 (可视化选择器) */}
                        {isAdmin && (
                            <div className="flex flex-col gap-3 p-3 bg-black/30 rounded-lg border border-white/5 relative">
                                <div className="text-[10px] text-slate-500 font-bold uppercase flex items-center gap-1">
                                    <Palette size={10}/> 新增头衔 (先选特效，再输文字)
                                </div>
                                
                                {/* 特效选择器 (Grid) */}
                                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                                     {TITLE_TIERS.filter(t => t.id !== 'common').map(tier => {
                                         const isSelected = selectedStyleId === tier.id;
                                         return (
                                             <button 
                                                key={tier.id}
                                                onClick={() => setSelectedStyleId(tier.id)}
                                                className={`
                                                    relative h-8 rounded-md border transition-all flex items-center justify-center overflow-hidden
                                                    ${isSelected ? 'border-white ring-1 ring-white/50 scale-105 z-10' : 'border-white/10 opacity-60 hover:opacity-100 hover:scale-105'}
                                                `}
                                                title={tier.label}
                                             >
                                                 {/* 直接渲染 Badge 预览 (不带字) */}
                                                 <div className="scale-75 pointer-events-none">
                                                     <TitleBadge styleOverride={tier} title=" " />
                                                 </div>
                                                 {isSelected && <CheckCircle2 size={14} className="absolute top-0 right-0 text-white drop-shadow relative z-20"/>}
                                             </button>
                                         )
                                     })}
                                </div>

                                {/* 输入框与添加按钮 */}
                                <div className="flex gap-2 items-center mt-1">
                                    <div className="flex-1 relative">
                                        <input 
                                            className="w-full bg-[#010A13] border border-slate-600 rounded px-3 py-1.5 text-xs text-white focus:border-[#C8AA6E] outline-none transition-colors placeholder:text-slate-600 pl-8"
                                            placeholder="输入头衔显示文字 (如: 峡谷之巅)"
                                            value={newTitleInput}
                                            onChange={e => setNewTitleInput(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && addTitle()}
                                        />
                                        <div className="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none">
                                            {TITLE_TIERS.find(t=>t.id===selectedStyleId)?.icon}
                                        </div>
                                    </div>
                                    
                                    <button onClick={addTitle} className="px-4 py-1.5 bg-[#C8AA6E] text-[#091428] rounded text-xs font-bold hover:bg-[#b89b65] flex items-center gap-1 shadow-lg shadow-amber-900/20 active:scale-95 transition-all whitespace-nowrap">
                                        <Plus size={14} strokeWidth={3}/> 添加
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Role Tags */}
            <div className="flex flex-wrap gap-2 mb-4">
              {accountInfo?.role === 'admin' && (
                <div className="flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-bold border shadow-sm uppercase tracking-wide bg-rose-900/20 text-rose-300 border-rose-500/30">
                  <Shield size={10} /> 管理员
                </div>
              )}
            </div>
            
            <div className="relative group mb-5">
              {isEditing ? (
                <textarea 
                  value={editForm.bio}
                  onChange={(e) => setEditForm({...editForm, bio: e.target.value})}
                  className="w-full bg-slate-800/80 border border-slate-600 text-slate-200 text-sm p-3 rounded-lg focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 resize-none h-20"
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