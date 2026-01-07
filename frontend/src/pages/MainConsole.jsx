import React, { useState, useEffect, useMemo } from 'react';
import { Shield, Users, Zap, Brain, Crosshair, RefreshCcw, ShieldAlert, RotateCcw, Trash2, GripHorizontal, Settings, HelpCircle, RefreshCw, AlertCircle, CheckCircle2, XCircle,Compass, Sparkles, Swords } from 'lucide-react';
import { Toaster, toast } from 'react-hot-toast';

// 组件引入
import AdminDashboard from '../components/AdminDashboard';
import AdminPanel from '../components/AdminPanel'; 
import Header from '../components/Header';
import ChampCard from '../components/ChampCard';
import AnalysisResult from '../components/AnalysisResult';
import CommunityTips from '../components/CommunityTips';
import AnalysisButton from '../components/AnalysisButton';
import InviteCard from '../components/InviteCard';
import ChampSelectModal from '../components/modals/ChampSelectModal'; 
import LoginModal from '../components/modals/LoginModal';
import TipModal from '../components/modals/TipModal';
import FeedbackModal from '../components/modals/FeedbackModal';
import PricingModal from '../components/modals/PricingModal';
import SettingsModal from '../components/modals/SettingsModal'; 
import DownloadModal from '../components/modals/DownloadModal';
import LandingPage from '../components/LandingPage'; 
import UserGuide from '../components/UserGuide';

const GUIDE_STEPS = [
    { target: '#console-header', title: "欢迎来到 Hex Coach", description: "这是你的 AI 战术指挥中心。在这里，你可以连接 LCU 客户端，切换分析模式，并管理你的个人设置。" },
    { target: '#left-panel-team', title: "配置我方阵容", description: "如果连接了客户端，这里会自动同步。你也可以手动点击卡片选择英雄，并调整对应的分路。" },
    { target: '#lane-assignment-panel', title: "校准分路信息 (关键)", description: "智能分配可能无法识别摇摆位。若分路显示不正确，请务必手动调整【我方】与【敌方】的分路，确保 AI 提供最精准的对策。" },
    { target: '#center-analysis-btn', title: "启动 AI 推演", description: "设置好双方阵容后，点击此按钮。AI 将基于深度思考模型，为你提供 BP 建议、对线细节或运营策略。" },
    { target: '#analysis-tabs', title: "切换分析维度", description: "想看对线技巧或打野路线？选【王者私教】。想看大局运营？选【运营指挥】。系统会根据你的位置自动调整策略。" },
    { target: '#right-panel-enemy', title: "敌方情报与社区", description: "这里显示敌方阵容。下方是【绝活社区】，你可以查看针对当前对手的玩家心得，或者分享你的见解。" },
    
    // 🔥 [新增] 第七步：共建理念 (文案一)
    { 
        target: 'body', 
        title: "我们如何一起改进", 
        description: "Hex Coach 不是一个“永远正确”的系统，它在不断学习。如果你发现 AI 判断有偏差，或有更好的理解，欢迎反馈。经过审核的有效反馈，将获得额外的【核心模型】次数或会员奖励。",
        placement: 'center' 
    }
];

// 🔥🔥🔥 [核心配置] 英雄适用性数据库 V4.0 🔥🔥🔥
const HERO_FARMING_CONFIG = {
    // ==========================================
    // === Type 1: 节奏/GANK型 (Rhythm/Combat) ===
    // 特征：Tier 0 (默认标准模式)，标准模式分高，野核模式分低
    // ==========================================

    // --- 1.1 战士/对抗 (Fighter/Combat) ---
    "LeeSin":   { tier: 0, farming_stars: 2, standard_stars: 5, reason_farming: "野核模式：效率低，浪费前期强势期", reason_standard: "标准模式：T0级前期节奏，野区单挑与Gank极强" },
    "XinZhao":  { tier: 0, farming_stars: 2, standard_stars: 5, reason_farming: "野核模式：缺乏AOE速刷手段，拖后期乏力", reason_standard: "标准模式：捅脸单挑强，适合主动入侵找节奏" },
    "Viego":    { tier: 0, farming_stars: 3, standard_stars: 5, reason_farming: "野核模式：虽有收割能力，但纯刷容易丢失节奏", reason_standard: "标准模式：捡魂收割机制，团战上限极高" },
    "Vi":       { tier: 0, farming_stars: 3, standard_stars: 5, reason_farming: "野核模式：有W刷野尚可，但核心是锁头抓人", reason_standard: "标准模式：Q闪开团，大招必中，专治花里胡哨" },
    "Wukong":   { tier: 0, farming_stars: 2, standard_stars: 5, reason_farming: "野核模式：除了神分那一波，刷野并不快", reason_standard: "标准模式：隐身切入，大招两段击飞，最强团控战士" },
    "Olaf":     { tier: 0, farming_stars: 4, standard_stars: 5, reason_farming: "野核模式：虽然丢斧子刷得快，但更适合砍人", reason_standard: "标准模式：诸神黄昏免控，疯狗一样冲脸C位" },
    "Warwick":  { tier: 0, farming_stars: 2, standard_stars: 5, reason_farming: "野核模式：没有提亚马特之前刷野很慢", reason_standard: "标准模式：鲜血追猎，全图加速，低分段战神" },
    "Briar":    { tier: 0, farming_stars: 3, standard_stars: 5, reason_farming: "野核模式：虽然有回复，但失控机制容易送", reason_standard: "标准模式：全图大招支援，疯狗吸血，残局战神" },
    "Pantheon": { tier: 0, farming_stars: 2, standard_stars: 5, reason_farming: "野核模式：刷野极慢，后期乏力", reason_standard: "标准模式：W稳定点控，大招半图支援跳后排" },

    // --- 1.2 绝食/GANK (Heavy Ganker) ---
    "JarvanIV": { tier: 0, farming_stars: 1, standard_stars: 5, reason_farming: "野核模式：刷野伤且慢，无法发挥EQ二连优势", reason_standard: "标准模式：绝食流代表，二级抓下/三级越塔" },
    "Nunu":     { tier: 0, farming_stars: 3, standard_stars: 5, reason_farming: "野核模式：吃野怪快但CARRY能力差", reason_standard: "标准模式：推球跑图，控龙与抓人效率极高" },
    "Twitch":   { tier: 0, farming_stars: 1, standard_stars: 5, reason_farming: "野核模式：身板脆刷野慢，不抓人就废了", reason_standard: "标准模式：隐身一级抓人，通过恶心线上滚雪球" },
    "Sylas":    { tier: 0, farming_stars: 2, standard_stars: 5, reason_farming: "野核模式：前期刷野像坐牢，必须去线上'借'钱", reason_standard: "标准模式：偷取关键大招（如石头人/阿木木）逆天改命" },
    "Poppy":    { tier: 0, farming_stars: 2, standard_stars: 5, reason_farming: "野核模式：Q有百分比但手短，更需要跑图", reason_standard: "标准模式：W防突进神技，E壁咚，R锤飞关键前排" },

    // --- 1.3 刺客/爆发 (Assassin) ---
    "Evelynn":  { tier: 0, farming_stars: 4, standard_stars: 5, reason_farming: "野核模式：6级前需速刷，但核心是杀人叠层数", reason_standard: "标准模式：隐身抓人，高爆发秒C位" },
    "Talon":    { tier: 0, farming_stars: 3, standard_stars: 5, reason_farming: "野核模式：翻墙是为了跑图杀人，不是为了刷F6", reason_standard: "标准模式：全图游走，利用高机动性抓崩三路" },
    "Shaco":    { tier: 0, farming_stars: 1, standard_stars: 5, reason_farming: "野核模式：纯刷是最差的玩法，必须搞事", reason_standard: "标准模式：绝食骚扰，通过折磨对手心态获胜" },
    "KhaZix":   { tier: 0, farming_stars: 3, standard_stars: 5, reason_farming: "野核模式：孤立无援适合野区单挑，但需要人头", reason_standard: "标准模式：进化技能，蜻蜓点水，收割残局" },
    "Rengar":   { tier: 0, farming_stars: 3, standard_stars: 5, reason_farming: "野核模式：草丛跳跃刷野快，但大招是核心", reason_standard: "标准模式：落地秒杀，寻找脆皮提款" },
    "Qiyana":   { tier: 0, farming_stars: 2, standard_stars: 5, reason_farming: "野核模式：刷野伤，极其依赖装备优势", reason_standard: "标准模式：水元素禁锢，大招推墙奇迹团" },
    "Nocturne": { tier: 0, farming_stars: 4, standard_stars: 5, reason_farming: "野核模式：速6虽然重要，但本质是关灯抓单", reason_standard: "标准模式：关灯让对面丧失视野，定点秒杀C位" },

    // --- 1.4 双修/前期 (Hybrid/Early) ---
    "Elise":    { tier: 0, farming_stars: 1, standard_stars: 5, reason_farming: "野核模式：刷野最慢梯队，后期超级兵", reason_standard: "标准模式：越塔女皇，必须在20分钟前结束比赛" },
    "RekSai":   { tier: 0, farming_stars: 2, standard_stars: 5, reason_farming: "野核模式：虽然有AOE，但机制决定必须进攻", reason_standard: "标准模式：隧道挖掘，听声辨位，前期压制力强" },
    "Gragas":   { tier: 0, farming_stars: 2, standard_stars: 5, reason_farming: "野核模式：AP流可刷，但肉装流必须做事", reason_standard: "标准模式：E闪开团，几何桶分割战场" },

    // ==========================================
    // === Type 2: 野核/发育型 (Wild Core) ===
    // 特征：Tier 4/5 (默认野核模式)，野核模式分高，标准模式分低
    // ==========================================

    // --- 2.1 AP野核 (AP Carry) ---
    "Lillia":       { tier: 5, farming_stars: 5, standard_stars: 3, reason_farming: "野核模式：移速拉扯，多刷一组野就多一分胜算", reason_standard: "标准模式：缺乏硬控，Gank依赖E技能命中" },
    "Karthus":      { tier: 5, farming_stars: 5, standard_stars: 2, reason_farming: "野核模式：全图支援，利用刷野拉开等级差", reason_standard: "标准模式：Gank能力极弱，只能反蹲或捡漏" },
    "Taliyah":      { tier: 5, farming_stars: 5, standard_stars: 3, reason_farming: "野核模式：AOE足，刷野快，后期控场法师", reason_standard: "标准模式：虽有大招支援，但发育优先" },
    "Brand":        { tier: 5, farming_stars: 5, standard_stars: 2, reason_farming: "野核模式：被动百分比伤害，刷野速度极快", reason_standard: "标准模式：腿短无位移，容易被抓" },
    "Zyra":         { tier: 5, farming_stars: 5, standard_stars: 2, reason_farming: "野核模式：植物抗怪无伤刷野，经济转化率高", reason_standard: "标准模式：控制不稳定，身板脆" },
    "Fiddlesticks": { tier: 5, farming_stars: 5, standard_stars: 4, reason_farming: "野核模式：多野怪同时拉刷，速6是唯一真理", reason_standard: "标准模式：视野排空后的跳大是恐怖游戏" },
    "Morgana":      { tier: 5, farming_stars: 5, standard_stars: 2, reason_farming: "野核模式：W刷野不仅快还能吸血，无伤打野", reason_standard: "标准模式：只能摸奖Q，容易被反烂" },
    "Ekko":         { tier: 4, farming_stars: 4, standard_stars: 4, reason_farming: "野核模式：三环刷野快，大招容错，吃装备", reason_standard: "标准模式：W立场预判，越塔强杀" },
    "Diana":        { tier: 4, farming_stars: 5, standard_stars: 3, reason_farming: "野核模式：被动攻速，速6质变，纳什之牙", reason_standard: "标准模式：依赖Q技能突进，6级前较弱" },
    "Nidalee":      { tier: 4, farming_stars: 5, standard_stars: 4, reason_farming: "野核模式：刷野天花板，等级压制是核心", reason_standard: "标准模式：标枪摸奖，人形态加血，操作难度高" },

    // --- 2.2 AD野核 (AD Carry) ---
    "Graves":       { tier: 4, farming_stars: 5, standard_stars: 4, reason_farming: "野核模式：纯爷们反野，把对面野区当自己家", reason_standard: "标准模式：烟雾弹Gank，配合线上推塔" },
    "Kindred":      { tier: 4, farming_stars: 5, standard_stars: 3, reason_farming: "野核模式：印记成长需求，必须入侵吞噬野怪", reason_standard: "标准模式：依赖队友保护，印记刷新看运气" },
    "MasterYi":     { tier: 4, farming_stars: 5, standard_stars: 2, reason_farming: "野核模式：吞噬野区，后期砍瓜切菜", reason_standard: "标准模式：前期无控，只能收割残局" },
    "Belveth":      { tier: 4, farming_stars: 5, standard_stars: 3, reason_farming: "野核模式：无限攻速成长，必须拿虚空鱼", reason_standard: "标准模式：Q技能多段位移，E技能减伤" },
    "Hecarim":      { tier: 4, farming_stars: 5, standard_stars: 3, reason_farming: "野核模式：Q技能AOE，贪婪刷野叠装备", reason_standard: "标准模式：疾跑一开，谁也不爱，主要靠冲阵" },
    "Jax":          { tier: 4, farming_stars: 4, standard_stars: 3, reason_farming: "野核模式：刷野速度中等但成长性极高", reason_standard: "标准模式：反击风暴晕人，后期单带无解" },
    "Kayn":         { tier: 3, farming_stars: 4, standard_stars: 4, reason_farming: "野核模式：蓝凯秒人，红凯回血，都需要装备", reason_standard: "标准模式：穿墙游走，蹭能量变身" },
    "Jayce":        { tier: 4, farming_stars: 4, standard_stars: 3, reason_farming: "野核模式：锤形态AOE刷野，需要大量经济支撑Poke", reason_standard: "标准模式：加强炮消耗，如无经济压制则作用有限" },
    "Teemo":        { tier: 4, farming_stars: 4, standard_stars: 2, reason_farming: "野核模式：6级后蘑菇阵控图，恶心对面野区", reason_standard: "标准模式：正面团战弱，容易被针对" },

    // --- 2.3 坦克/特殊野核 (Tank/Special) ---
    "Shyvana":      { tier: 4, farming_stars: 5, standard_stars: 2, reason_farming: "野核模式：速6变龙，控龙属性加成", reason_standard: "标准模式：没大招超级兵，只能反蹲" },
    "DrMundo":      { tier: 4, farming_stars: 5, standard_stars: 3, reason_farming: "野核模式：E技能拍死野怪，经济转化为坦度", reason_standard: "标准模式：去哪全凭心情，吸收成吨伤害" },
    "Udyr":         { tier: 3, farming_stars: 4, standard_stars: 4, reason_farming: "野核模式：觉醒R刷野极快，跑图流", reason_standard: "标准模式：E技能加速晕人，形态切换灵活" },

    // ==========================================
    // === Type 3: 工具人/功能型 (Utility/Tank) ===
    // 特征：Tier 0 (默认标准模式)，标准模式分高，不吃资源
    // ==========================================

    "Sejuani":  { tier: 0, farming_stars: 2, standard_stars: 5, reason_farming: "野核模式：肉装为主，刷野慢，CARRY难", reason_standard: "标准模式：被动抗性，大招开团，配合近战队友" },
    "Rammus":   { tier: 0, farming_stars: 1, standard_stars: 5, reason_farming: "野核模式：被法师折磨，刷野效率低", reason_standard: "标准模式：物理克星，Q加速抓人，嘲讽必杀" },
    "Amumu":    { tier: 0, farming_stars: 2, standard_stars: 5, reason_farming: "野核模式：虽然E技能刷野快，但容易被反", reason_standard: "标准模式：QW粘人，R大团控，也是个好工具人" },
    "Zac":      { tier: 0, farming_stars: 2, standard_stars: 5, reason_farming: "野核模式：捡碎片回血，但单挑能力弱", reason_standard: "标准模式：超远E开团，分割战场，多重控制" },
    "Maokai":   { tier: 0, farming_stars: 2, standard_stars: 5, reason_farming: "野核模式：树苗探视野，自身伤害不足", reason_standard: "标准模式：W稳定点控，R大范围封路" },
    "Ivern":    { tier: 0, farming_stars: 1, standard_stars: 5, reason_farming: "野核模式：我是辅助，为什么要让我C？", reason_standard: "标准模式：种草护盾，召唤小菊，纯辅助玩法" },
    "Skarner":  { tier: 0, farming_stars: 2, standard_stars: 5, reason_farming: "野核模式：重做后偏肉坦控制", reason_standard: "标准模式：E技能穿墙，R压制拉人" },
    "Volibear": { tier: 0, farming_stars: 3, standard_stars: 5, reason_farming: "野核模式：被动闪电链刷野不错，但手短", reason_standard: "标准模式：大招屏蔽防御塔，越塔神技" },
    "Malphite": { tier: 0, farming_stars: 2, standard_stars: 5, reason_farming: "野核模式：前期缺蓝刷得慢，除了大招没别的", reason_standard: "标准模式：只要大招撞得好，0-5也能赢团战" },
    "Shen":     { tier: 0, farming_stars: 1, standard_stars: 5, reason_farming: "野核模式：清野巨慢，甚至需要提亚马特", reason_standard: "标准模式：大招全图保人，E闪嘲讽开团" },
    "Gwen":     { tier: 3, farming_stars: 4, standard_stars: 3, reason_farming: "野核模式：真实伤害，W规避技能，后期大核", reason_standard: "标准模式：留人能力差，依赖疾跑" },
    "Aatrox":   { tier: 3, farming_stars: 3, standard_stars: 4, reason_farming: "野核模式：吸血续航，野区单挑强", reason_standard: "标准模式：多段击飞，团战天神下凡" }
};

export default function MainConsole({ state, actions }) {
    const { 
        version, lcuStatus, userRole, currentUser, useThinkingModel, accountInfo, userRank,
        blueTeam, redTeam, myTeamRoles, userSlot, enemyLaneAssignments, myLaneAssignments,
        aiResults, analyzeType, isModeAnalyzing, viewMode, activeTab,
        showChampSelector, selectingSlot, selectingIsEnemy, roleMapping, championList,
        token, authMode, authForm, showLoginModal, showTipModal, inputContent, tipTarget, tips, tipTargetEnemy,
        showAdminPanel, showSettingsModal, currentShortcuts, sendChatTrigger,
        showFeedbackModal, showPricingModal,
        mapSide, showDownloadModal, hasStarted,
        adminView 
    } = state;

    const {
        setHasStarted, setUserRole, logout, setShowLoginModal, setUseThinkingModel, setShowPricingModal, setUserRank,
        handleClearSession, handleCardClick, setMyLaneAssignments, setEnemyLaneAssignments,
        handleAnalyze, setAiResults, setAnalyzingStatus, setAnalyzeType, setViewMode, setActiveTab,
        setShowChampSelector, setSelectingSlot, setUserSlot, handleSelectChampion,
        handleLogin, handleRegister, setAuthMode, setAuthForm,
        setShowSettingsModal, setShowAdminPanel, setInputContent, setShowTipModal, setShowFeedbackModal,
        handlePostTip, handleReportError, handleLike, handleDeleteTip, handleSaveShortcuts, setTipTarget, handleTabClick,
        setMapSide, setShowDownloadModal,handleClearAnalysis,
        setAdminView
    } = actions;

    const [showGuide, setShowGuide] = useState(false);
    const [isFarmingMode, setIsFarmingMode] = useState(false);
    const effectiveMode = useMemo(() => {
        if (analyzeType === 'personal' && userRole === 'JUNGLE' && isFarmingMode) {
            return 'role_jungle_farming';
        }
        return analyzeType;
    }, [analyzeType, userRole, isFarmingMode]);
    
    useEffect(() => {
        const currentHero = blueTeam[userSlot];
        
        // 1. 如果当前格子有英雄
        if (currentHero && currentHero.name) {
            // 反查分路表：找找看 myLaneAssignments 里，哪个位置填的是这个英雄的名字
            // 例如：myLaneAssignments['JUNGLE'] === '法外狂徒'
            const assignedRole = Object.keys(myLaneAssignments).find(
                role => myLaneAssignments[role] === currentHero.name
            );

            // 如果在分路表里找到了位置，强制同步 userRole
            if (assignedRole) {
                if (userRole !== assignedRole) {
                    // console.log(`🔄 强同步：从分路表检测到 ${currentHero.name} 是 ${assignedRole}`);
                    setUserRole(assignedRole);
                }
                return; // 找到了就结束，以此为准
            }
        }

        // 2. 兜底逻辑：如果没有英雄，或者分路表里没找到，再回退到按 Slot 位置判断
        if (myTeamRoles && myTeamRoles[userSlot]) {
            const slotRole = myTeamRoles[userSlot];
            if (slotRole && slotRole !== userRole) {
                setUserRole(slotRole);
            }
        }
    }, [userSlot, blueTeam, myLaneAssignments, myTeamRoles, userRole]);
    // 🔥 [优化] 智能自动开关逻辑
    useEffect(() => {
        const hero = blueTeam[userSlot];
        if (hero && userRole === 'JUNGLE') {
            const config = HERO_FARMING_CONFIG[hero.key];
            // 如果是 T3 以上的野核英雄
            if (config && config.tier >= 3) {
                // 自动开启，但不弹窗
                if (!isFarmingMode) {
                    setIsFarmingMode(true);
                }
            } else {
                // 否则自动关闭
                if (isFarmingMode) {
                    setIsFarmingMode(false);
                }
            }
        }
    }, [blueTeam, userSlot, userRole]);

    const modelType = useThinkingModel ? 'reasoner' : 'chat';
    const setModelType = (type) => setUseThinkingModel(type === 'reasoner');

    const currentHeroConfig = useMemo(() => {
        const hero = blueTeam[userSlot];
        if (!hero) return null;
        
        const config = HERO_FARMING_CONFIG[hero.key];
        
        // 兜底逻辑：如果数据库没这个英雄
        if (!config) return { tier: 0, stars: 3, reason: "暂无特定数据，建议按需选择" };

        return {
            ...config,
            // 🌟 核心：根据开关状态，动态切换展示的星级
            stars: isFarmingMode ? config.farming_stars : config.standard_stars,
            // 🌟 核心：根据开关状态，动态切换展示的理由
            reason: isFarmingMode ? config.reason_farming : config.reason_standard
        };
    }, [blueTeam, userSlot, isFarmingMode]);

    useEffect(() => {
        if (hasStarted) {
            const hasSeenGuide = localStorage.getItem('has_seen_guide_v2');
            if (!hasSeenGuide) {
                const timer = setTimeout(() => setShowGuide(true), 1000);
                return () => clearTimeout(timer);
            }
        }
    }, [hasStarted]);
    
    const handleGuideComplete = () => {
        setShowGuide(false);
        localStorage.setItem('has_seen_guide_v2', 'true');
        toast.success("新手引导已完成！祝你排位连胜！", { icon: '🏆' });
    };
    
    const getEnemySideLabel = () => {
        if (mapSide === 'blue') return '(红色方)';
        if (mapSide === 'red') return '(蓝色方)';
        return '';
    };

    const handleShowCommunity = () => {
        actions.setShowCommunity(true);
    };

    useEffect(() => {
        if (hasStarted && lcuStatus !== 'connected' && !blueTeam[userSlot]) {
            const timer = setTimeout(() => {
                toast((t) => (
                    <div className="flex flex-col gap-3 min-w-[260px] animate-in slide-in-from-right duration-300">
                        <div className="flex items-center gap-3 border-b border-white/10 pb-2">
                            <span className="text-2xl animate-bounce">👋</span>
                            <div>
                                <span className="font-bold text-slate-200 text-sm block">不知道如何开始？</span>
                                <span className="text-[10px] text-slate-500 block">HexCoach 战术助手</span>
                            </div>
                        </div>
                        <div className="text-xs text-slate-400 leading-relaxed">
                            <p className="mb-1">检测到您尚未连接游戏客户端。</p>
                            <p>您可以直接点击左侧 <span className="text-[#C8AA6E] font-bold border border-[#C8AA6E]/30 px-1 rounded bg-[#C8AA6E]/10">圆圈卡片</span> 手动选择英雄，即可立即体验 AI 分析功能！</p>
                        </div>
                        <div className="flex gap-2 pt-1">
                            <button 
                                className="flex-1 bg-gradient-to-r from-[#0AC8B9] to-[#089186] text-[#091428] text-xs font-bold py-2 px-3 rounded shadow-lg hover:brightness-110 active:scale-95 transition-all"
                                onClick={() => { 
                                    toast.dismiss(t.id); 
                                    setShowGuide(true); 
                                }}
                            >
                                演示给我看
                            </button>
                            <button 
                                className="px-3 py-2 text-slate-500 hover:text-slate-300 text-xs font-medium transition-colors"
                                onClick={() => toast.dismiss(t.id)}
                            >
                                我知道了
                            </button>
                        </div>
                    </div>
                ), { 
                    duration: 15000, 
                    position: 'bottom-right',
                    style: {
                        background: 'rgba(15, 23, 42, 0.95)',
                        border: '1px solid rgba(200, 170, 110, 0.4)',
                        padding: '16px',
                        boxShadow: '0 10px 40px -10px rgba(0,0,0,0.8)',
                        backdropFilter: 'blur(10px)',
                        maxWidth: '350px'
                    }
                });
            }, 10000); 
            
            return () => clearTimeout(timer);
        }
    }, [hasStarted, lcuStatus, blueTeam, userSlot]);

    if (!hasStarted) {
        return (
            <>
                <Toaster position="top-right" />
                <DownloadModal isOpen={showDownloadModal} onClose={() => setShowDownloadModal(false)} />
                <LandingPage onEnter={() => setHasStarted(true)} version={version} onOpenCommunity={() => actions.setShowCommunity(true)} onDownloadClick={() => setShowDownloadModal(true)} />
            </>
        );
    }

    return (
        <div className="min-h-screen">
            <Toaster position="top-right" />
            
            <UserGuide isOpen={showGuide} steps={GUIDE_STEPS} onClose={handleGuideComplete} onComplete={handleGuideComplete} />
            <DownloadModal isOpen={showDownloadModal} onClose={() => setShowDownloadModal(false)} />

            <div className="fixed top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#C8AA6E]/50 to-transparent z-50"></div>
            
            <div className="relative z-10 flex flex-col items-center p-4 md:p-8 pt-24 max-w-[1800px] mx-auto">
                <div id="console-header" className="w-full relative group/header-guide">
                    <Header
                        version={version} lcuStatus={lcuStatus} userRole={userRole} setUserRole={setUserRole}
                        currentUser={currentUser} logout={logout} setShowLoginModal={setShowLoginModal}
                        useThinkingModel={useThinkingModel} setUseThinkingModel={setUseThinkingModel}
                        setShowPricingModal={setShowPricingModal} accountInfo={accountInfo}
                        userRank={userRank} setUserRank={setUserRank}
                        modelType={modelType} setModelType={setModelType}
                        onGoHome={() => setHasStarted(false)} onShowCommunity={handleShowCommunity}
                        onShowDownload={() => setShowDownloadModal(true)}
                        onShowSettings={setShowSettingsModal}
                        onShowAdmin={() => { setAdminView('dashboard'); setShowAdminPanel(true); }}
                        onShowProfile={() => actions.setShowProfile(true)}
                        onShowGuide={() => setShowGuide(true)} 
                        onShowSales={() => actions.setShowSalesDashboard(true)}
                        onViewProfile={actions.onViewProfile}
                    />
                </div>

                <div className="w-full mt-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    
                    {/* 左侧：我方 (Ally) */}
                    <div className="lg:col-span-3 flex flex-col gap-5 lg:sticky lg:top-8">
                        {/* 1. 阵容面板 */}
                        <div id="left-panel-team" className="bg-[#091428] border border-[#C8AA6E]/30 rounded shadow-lg relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-[#0AC8B9] to-transparent opacity-50"></div>
                            <div className="flex items-center justify-between px-3 py-2 bg-[#010A13]/80 border-b border-[#C8AA6E]/10">
                                <div className="flex items-center gap-2 text-[#0AC8B9]">
                                    <Shield size={14} />
                                    <span className="text-xs font-bold tracking-[0.15em] text-[#F0E6D2] uppercase">我方阵容</span>
                                </div>
                                <button onClick={handleClearSession} className="text-slate-500 hover:text-red-400 transition-colors opacity-50 hover:opacity-100" title="清空对局"><Trash2 size={12}/></button>
                            </div>
                            <div className="flex items-center justify-center py-1.5 bg-black/40 border-b border-[#C8AA6E]/10 gap-2">
                                <button onClick={() => setMapSide('blue')} className={`flex items-center gap-1.5 px-3 py-1 rounded text-[10px] font-bold transition-all duration-200 border ${mapSide === 'blue' ? 'bg-blue-900/60 border-blue-500 text-blue-300 shadow-[0_0_8px_rgba(59,130,246,0.3)]' : 'bg-transparent border-transparent text-slate-600 hover:text-slate-400 hover:bg-white/5'}`}>
                                    <div className={`w-1.5 h-1.5 rounded-full ${mapSide === 'blue' ? 'bg-blue-400' : 'bg-slate-700'}`}></div>
                                    我是蓝方 (左下)
                                </button>
                                <div className="w-[1px] h-3 bg-slate-800"></div>
                                <button onClick={() => setMapSide('red')} className={`flex items-center gap-1.5 px-3 py-1 rounded text-[10px] font-bold transition-all duration-200 border ${mapSide === 'red' ? 'bg-red-900/60 border-red-500 text-red-300 shadow-[0_0_8px_rgba(239,68,68,0.3)]' : 'bg-transparent border-transparent text-slate-600 hover:text-slate-400 hover:bg-white/5'}`}>
                                    <div className={`w-1.5 h-1.5 rounded-full ${mapSide === 'red' ? 'bg-red-400' : 'bg-slate-700'}`}></div>
                                    我是红方 (右上)
                                </button>
                            </div>
                            <div className="p-1 space-y-1 bg-black/30">
                                {blueTeam.map((c, i) => (
                                    <div key={i} onClick={() => handleCardClick(i, false)} className={`cursor-pointer transition-all duration-300 rounded-sm overflow-hidden ${userSlot === i ? 'bg-[#0AC8B9]/10 border-l-2 border-[#0AC8B9]' : 'hover:bg-white/5 border-l-2 border-transparent'}`}>
                                        <ChampCard champ={c} idx={i} isEnemy={false} userSlot={userSlot} onSelectMe={setUserSlot} role={Object.keys(myLaneAssignments).find(k => myLaneAssignments[k] === c?.name) || myTeamRoles[i]} />
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* 2. 分路面板 */}
                        <div id="lane-assignment-panel" className="p-3 bg-[#091428] border border-[#C8AA6E]/20 rounded shadow-lg relative">
                            <div className="absolute -top-[1px] left-1/2 -translate-x-1/2 w-1/3 h-[1px] bg-[#C8AA6E]/50"></div>
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <div className="w-1 h-3 bg-[#0AC8B9] rounded-full"></div>
                                    <span className="text-[10px] font-bold text-[#F0E6D2] tracking-widest uppercase">本局分路</span>
                                </div>
                                <button 
                                    onClick={() => actions.autoAssignLanes(false)} // false 代表我方
                                    className="text-slate-600 hover:text-[#0AC8B9] transition-colors" 
                                    title="重新智能分析分路"
                                >
                                    <RefreshCcw size={10} />
                                </button>
                            </div>
                            <div className="flex flex-col gap-2">
                                {["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"].map(role => {
                                     const lcuDefaultHero = blueTeam.find((_, i) => myTeamRoles[i] === role)?.name || "";
                                     const isAssigned = !!myLaneAssignments[role];
                                     return (
                                        <div key={role} className="flex items-center justify-between gap-2 group">
                                            <label className="text-[9px] uppercase text-slate-500 font-bold w-8 text-right group-hover:text-[#0AC8B9] transition-colors">{role.substring(0,3)}</label>
                                            <div className={`flex-1 relative h-6 rounded bg-black border transition-all ${isAssigned ? 'border-[#0AC8B9] shadow-[0_0_5px_rgba(10,200,185,0.2)]' : 'border-[#C8AA6E]/10 hover:border-[#C8AA6E]/30'}`}>
                                                <select className="w-full h-full bg-transparent text-[10px] text-center font-bold text-slate-300 outline-none appearance-none cursor-pointer absolute inset-0 z-10" value={myLaneAssignments[role] || lcuDefaultHero} onChange={(e) => setMyLaneAssignments({...myLaneAssignments, [role]: e.target.value})}>
                                                    <option value="">-</option>
                                                    {blueTeam.map((c, i) => c?.name ? <option key={i} value={c.name}>{c.name}</option> : null)}
                                                </select>
                                            </div>
                                        </div>
                                     )
                                })}
                            </div>
                        </div>

                        {/* 3. 邀请有礼卡片 */}
                        {token && currentUser && (
                            <InviteCard token={token} username={currentUser} accountInfo={accountInfo} onUpdateSuccess={() => { actions.fetchUserInfo(); }} />
                        )}
                    </div>
                    
                    {/* 中间：核心分析台 */}
                    <div className="lg:col-span-6 flex flex-col gap-0 min-h-[600px]">
                        <div id="center-analysis-btn" className="mb-4 px-1">
                            <AnalysisButton 
                                selectedHero={blueTeam[userSlot]} 
                                onOpenChampSelect={() => { setSelectingSlot(-1); setShowChampSelector(true); }} 
                                
                                // 🔥 [核心修复 2] 使用计算好的 
                                onAnalyze={() => {
                                    handleAnalyze(effectiveMode, true);
                                }}
                                
                                isAnalyzing={isModeAnalyzing(effectiveMode)}
                            />
                        </div>
                        
                        {/* 🔥 选项卡面板 + 野核开关集成 */}
                        {/* 🟢 [修复] 移除 overflow-hidden 以解决 Tooltip 遮挡问题 */}
                        <div id="analysis-tabs" className="bg-[#010A13] border border-[#C8AA6E]/30 rounded-t-lg relative z-30 shadow-2xl">
                            {/* Tabs Grid */}
                            <div className="grid grid-cols-3 gap-0">
                                {[
                                    { id: 'bp', label: 'BP 推荐', icon: <Users size={18}/>, desc: '阵容优劣' },
                                    { id: 'personal', label: '王者私教', icon: <Zap size={18}/>, desc: '对线/打野' }, 
                                    { id: 'team', label: '运营指挥', icon: <Brain size={18}/>, desc: '大局决策' },
                                ].map(tab => {
                                    const isActive = analyzeType === tab.id;
                                    return (
                                        <button key={tab.id} onClick={() => handleTabClick(tab.id)} className={`relative group flex flex-col items-center justify-center py-4 transition-all duration-300 border-r border-[#C8AA6E]/10 last:border-r-0 first:rounded-tl-lg last:rounded-tr-lg ${isActive ? 'bg-gradient-to-b from-[#091428] to-[#050C18]' : 'bg-[#010A13] hover:bg-[#091428]/40'}`}>
                                            <div className={`flex items-center gap-2 mb-0.5 ${isActive ? 'text-[#F0E6D2] drop-shadow-[0_0_5px_rgba(200,170,110,0.5)]' : 'text-slate-500 group-hover:text-slate-300'}`}>
                                                {tab.icon}
                                                <span className="font-bold tracking-widest text-sm md:text-base">{tab.label}</span>
                                            </div>
                                            <span className="text-[10px] text-slate-600 font-mono tracking-wider">{tab.desc}</span>
                                            {isActive && <div className="absolute bottom-0 left-0 w-full h-[2px] bg-[#C8AA6E] shadow-[0_0_15px_#C8AA6E]"></div>}
                                        </button>
                                    )
                                })}
                            </div>

                            {/* 🔥 野核模式开关区域 (优化后样式) */}
                            {/* 🔥 战术风格选择器 (方案一：分段控制 + 方案二：智能推荐) */}
                            {userRole === 'JUNGLE' && analyzeType === 'personal' && (
                                <div className="mt-0 pt-3 pb-3 px-4 border-t border-white/5 animate-in fade-in slide-in-from-top-1 bg-[#091428]">
                                    <div className="flex items-center justify-between">
                                        
                                        {/* 左侧：标题与智能推荐标签 */}
                                        <div className="flex flex-col gap-1">
                                            <div className="flex items-center gap-2 select-none">
                                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                                    <Compass size={14} className={isFarmingMode ? "text-amber-500" : "text-[#0AC8B9]"} />
                                                    战术风格偏好
                                                </span>

                                                {/* 🤖 智能评级标签 (AI Rating) + 悬浮显示适配分析 */}
                                                {currentHeroConfig && (
                                                    <div className="relative group/badge cursor-help">
                                                        {/* 1. 标签本体: 始终显示，根据星级变色 */}
                                                        <span className={`text-[9px] px-1.5 py-0.5 rounded flex items-center gap-1 border transition-all ${
                                                            currentHeroConfig.stars >= 5 
                                                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse' 
                                                                : currentHeroConfig.stars >= 3
                                                                    ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                                                    : 'bg-red-500/10 text-red-400 border-red-500/20'
                                                        }`}>
                                                            {currentHeroConfig.stars >= 5 ? <Sparkles size={8} /> : (currentHeroConfig.stars <= 2 ? <AlertCircle size={8}/> : <CheckCircle2 size={8}/>)}
                                                            AI 评级: {currentHeroConfig.stars}星
                                                        </span>

                                                        {/* 2. 悬浮窗: 英雄适配度分析 */}
                                                        <div className="absolute bottom-full left-0 mb-2 w-64 bg-[#091428]/95 border border-white/10 p-3 rounded-xl shadow-2xl opacity-0 group-hover/badge:opacity-100 transition-all duration-200 pointer-events-none z-50 backdrop-blur-md translate-y-2 group-hover/badge:translate-y-0">
                                                            <div className="flex items-center gap-1.5 mb-2 pb-2 border-b border-white/5">
                                                                <Zap size={12} className="text-amber-500"/> 
                                                                <span className="text-slate-200 text-xs font-bold">英雄适配度分析</span>
                                                            </div>
                                                            <div className={`p-2 rounded border text-xs font-bold flex items-center gap-2 mb-2 ${
                                                                currentHeroConfig.stars >= 4 ? 'bg-amber-500/10 border-amber-500/30 text-amber-200' :
                                                                currentHeroConfig.stars === 3 ? 'bg-blue-500/10 border-blue-500/30 text-blue-200' :
                                                                'bg-red-500/10 border-red-500/30 text-red-300'
                                                            }`}>
                                                                {currentHeroConfig.stars >= 4 ? <CheckCircle2 size={14}/> : <Swords size={14}/>}
                                                                <span>{blueTeam[userSlot]?.name || "当前英雄"}：{currentHeroConfig.stars}星适配</span>
                                                            </div>
                                                            <div className="text-[10px] text-slate-400 leading-relaxed pl-1">
                                                                {currentHeroConfig.reason}
                                                            </div>
                                                            {/* 小三角 */}
                                                            <div className="absolute bottom-[-6px] left-4 w-3 h-3 bg-[#091428]/95 border-r border-b border-white/10 transform rotate-45"></div>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* ❓ 问号图标 + 悬浮显示模块功能介绍 */}
                                                <div className="group/help relative cursor-help ml-1">
                                                    <HelpCircle size={12} className="text-slate-600 hover:text-slate-300 transition-colors" />
                                                    
                                                    {/* 悬浮窗 2：模块功能介绍 */}
                                                    <div className="absolute bottom-full left-0 mb-2 w-64 bg-[#091428]/95 border border-white/10 p-3 rounded-xl shadow-2xl opacity-0 group-hover/help:opacity-100 transition-all duration-200 pointer-events-none z-50 backdrop-blur-md translate-y-2 group-hover/help:translate-y-0">
                                                         <div className="flex items-center gap-1.5 mb-2 pb-2 border-b border-white/5">
                                                            <Compass size={12} className="text-[#0AC8B9]"/> 
                                                            <span className="text-slate-200 text-xs font-bold">战术风格说明</span>
                                                         </div>
                                                         <div className="space-y-2">
                                                            <div>
                                                                <div className="text-[10px] text-[#0AC8B9] font-bold mb-0.5">⚔️ 标准节奏 (Standard)</div>
                                                                <div className="text-[10px] text-slate-400 leading-relaxed">
                                                                    适用于盲僧、皇子等节奏型英雄。AI 将侧重分析 Gank 路线、反蹲时机与线上施压。
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <div className="text-[10px] text-amber-500 font-bold mb-0.5">💰 野核发育 (Farm)</div>
                                                                <div className="text-[10px] text-slate-400 leading-relaxed">
                                                                    适用于男枪、死歌等发育型英雄。AI 将侧重规划刷野循环、入侵反野与控龙置换。
                                                                </div>
                                                            </div>
                                                         </div>
                                                         {/* 小三角 */}
                                                         <div className="absolute bottom-[-6px] left-1 w-3 h-3 bg-[#091428]/95 border-r border-b border-white/10 transform rotate-45"></div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* 右侧：分段控制器 */}
                                        <div className="flex bg-slate-800/50 p-1 rounded-lg border border-white/5 relative">
                                            {/* 选项 A: 节奏 (Gank) */}
                                            <button
                                                onClick={() => setIsFarmingMode(false)}
                                                className={`group/btn relative px-3 py-1.5 rounded-md text-[10px] md:text-xs font-bold flex items-center gap-1.5 transition-all ${
                                                    !isFarmingMode 
                                                    ? 'bg-[#0AC8B9] text-[#091428] shadow-lg shadow-[#0AC8B9]/20' 
                                                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                                                }`}
                                            >
                                                <Swords size={12} /> 标准节奏
                                                
                                                {/* 悬浮提示框 */}
                                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-48 p-2 bg-[#091428] border border-[#0AC8B9]/30 rounded-lg shadow-xl opacity-0 group-hover/btn:opacity-100 transition-all duration-200 pointer-events-none z-50">
                                                    <div className="text-[10px] text-[#0AC8B9] text-center leading-relaxed">
                                                        <span className="font-bold block mb-1">侧重 Gank 与反蹲</span>
                                                        <span className="text-slate-400">牺牲刷野换取线上优势<br/>(如: 盲僧/皇子/蜘蛛)</span>
                                                    </div>
                                                    {/* 小三角 */}
                                                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#0AC8B9]/30"></div>
                                                </div>
                                            </button>

                                            {/* 选项 B: 野核 (Farm) */}
                                            <button
                                                onClick={() => setIsFarmingMode(true)}
                                                className={`group/btn relative px-3 py-1.5 rounded-md text-[10px] md:text-xs font-bold flex items-center gap-1.5 transition-all ${
                                                    isFarmingMode 
                                                    ? 'bg-amber-500 text-[#091428] shadow-lg shadow-amber-500/20' 
                                                    : 'text-slate-400 hover:text-slate-300 hover:bg-white/5'
                                                }`}
                                            >
                                                <RefreshCw size={12} className={isFarmingMode ? "animate-spin-slow" : ""} /> 野核发育

                                                {/* 悬浮提示框 */}
                                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-48 p-2 bg-[#091428] border border-amber-500/30 rounded-lg shadow-xl opacity-0 group-hover/btn:opacity-100 transition-all duration-200 pointer-events-none z-50">
                                                    <div className="text-[10px] text-amber-400 text-center leading-relaxed">
                                                        <span className="font-bold block mb-1">侧重 极致刷野与反野</span>
                                                        <span className="text-slate-400">用经济差接管比赛<br/>(如: 男枪/死歌/莉莉娅)</span>
                                                    </div>
                                                    {/* 小三角 */}
                                                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-amber-500/30"></div>
                                                </div>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* 内容 */}
                        <div className="relative flex-1 flex flex-col bg-[#091428] border-x border-b border-[#C8AA6E]/30 rounded-b-lg shadow-lg p-1">
                            <div className="absolute inset-0 opacity-5 pointer-events-none z-0 bg-[url('/hex-pattern.png')]"></div>
                            <div className="relative z-10 min-h-[500px] h-auto">
                                <AnalysisResult
                                    aiResult={aiResults[effectiveMode]} 
                                    isAnalyzing={isModeAnalyzing(effectiveMode)}
                                    viewMode={viewMode}
                                    setViewMode={setViewMode}
                                    activeTab={activeTab}
                                    setActiveTab={setActiveTab}
                                    setShowFeedbackModal={setShowFeedbackModal}
                                    setFeedbackContent={setInputContent}
                                    sendChatTrigger={sendChatTrigger}
                                    forceTab={undefined}
                                    onClear={() => handleClearAnalysis(effectiveMode)}
                                />
                            </div>
                        </div>
                    </div>
                    
                    {/* 右侧：敌方 (Enemy) */}
                    <div className="lg:col-span-3 flex flex-col gap-5 sticky top-8">
                        <div id="right-panel-enemy" className="flex flex-col gap-5">
                            <div className="bg-[#1a0505] border border-red-900/30 rounded shadow-lg relative overflow-hidden">
                                <div className="flex items-center justify-between px-3 py-2 bg-[#2a0a0a]/50 border-b border-red-900/20">
                                    <div className="flex items-center gap-2 text-red-500">
                                        <Crosshair size={14} />
                                        <span className="text-xs font-bold tracking-[0.15em] text-red-200 uppercase">
                                            敌方阵容
                                            <span className="ml-2 text-[10px] opacity-70">{getEnemySideLabel()}</span>
                                        </span>
                                    </div>
                                </div>
                                <div className="p-1 space-y-1 bg-black/20">
                                    {redTeam.map((c, i) => (
                                        <div key={i} onClick={() => handleCardClick(i, true)} className="cursor-pointer hover:bg-red-900/10 rounded transition-colors border-l-2 border-transparent hover:border-red-800">
                                            <ChampCard champ={c} idx={i} isEnemy={true} userSlot={userSlot} role={Object.keys(enemyLaneAssignments).find(k => enemyLaneAssignments[k] === c?.name)?.substring(0,3) || ""} />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="p-3 bg-[#1a0505] border border-red-900/20 rounded shadow-lg relative">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <div className="w-1 h-3 bg-red-600 rounded-full"></div>
                                        <span className="text-[10px] font-bold text-red-200 tracking-widest uppercase">敌方分路</span>
                                    </div>
                                    <button 
                                        onClick={() => actions.autoAssignLanes(true)} // true 代表敌方
                                        className="text-slate-600 hover:text-red-400 transition-colors"
                                        title="重新智能分析分路"
                                    >
                                        <RefreshCcw size={10} />
                                    </button></div>
                                <div className="flex flex-col gap-2">
                                    {["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"].map(role => (
                                        <div key={role} className="flex items-center justify-between gap-2 group">
                                            <label className="text-[9px] uppercase text-slate-600 font-bold w-8 text-right group-hover:text-red-400 transition-colors">{role.substring(0,3)}</label>
                                            <div className={`flex-1 relative h-6 rounded bg-[#0a0202] border transition-all ${enemyLaneAssignments[role] ? 'border-red-600/50 shadow-[0_0_5px_rgba(220,38,38,0.2)]' : 'border-red-900/20 hover:border-red-900/40'}`}>
                                                <select className="w-full h-full bg-transparent text-[10px] text-center font-bold text-slate-300 outline-none appearance-none cursor-pointer absolute inset-0 z-10" value={enemyLaneAssignments[role]} onChange={(e) => setEnemyLaneAssignments({...enemyLaneAssignments, [role]: e.target.value})}>
                                                    <option value="">-</option>
                                                    {redTeam.map((c, i) => c?.name ? <option key={i} value={c.name}>{c.name}</option> : null)}
                                                </select>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            
                            <div id="community-section" className="flex-1 min-h-[300px] bg-[#091428] border border-[#C8AA6E]/20 rounded shadow-xl overflow-hidden flex flex-col scroll-mt-28">
                                <CommunityTips
                                    tips={tips} currentUser={currentUser} currentHero={blueTeam[userSlot]?.name} currentTarget={tipTarget || enemyLaneAssignments[userRole]}
                                    allies={blueTeam} enemies={redTeam} onTargetChange={(newTarget) => setTipTarget(newTarget)} userRole={userRole}
                                    onOpenPostModal={(target) => { if(!currentUser) setShowLoginModal(true); else { setTipTargetEnemy(target); setShowTipModal(true); } }}
                                    onLike={handleLike} onDelete={handleDeleteTip}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} authMode={authMode} setAuthMode={setAuthMode} authForm={authForm} setAuthForm={setAuthForm} handleLogin={handleLogin} handleRegister={handleRegister} />
                <TipModal isOpen={showTipModal} onClose={() => setShowTipModal(false)} content={inputContent} setContent={setInputContent} onSubmit={(target, category) => handlePostTip(target, category)} heroName={blueTeam[userSlot]?.name || "英雄"} activeTab="wiki" championList={championList} />
                <FeedbackModal isOpen={showFeedbackModal} onClose={() => setShowFeedbackModal(false)} content={inputContent} setContent={setInputContent} onSubmit={handleReportError} />
                <PricingModal isOpen={showPricingModal} onClose={() => setShowPricingModal(false)} username={currentUser} />
                <SettingsModal isOpen={showSettingsModal} onClose={() => setShowSettingsModal(false)} currentShortcuts={currentShortcuts} onSave={handleSaveShortcuts} />
                <ChampSelectModal
                    isOpen={showChampSelector}
                    onClose={() => setShowChampSelector(false)}
                    championList={selectingSlot === -1 ? blueTeam.filter(c => c !== null) : championList}
                    onSelect={(hero) => {
                        if (selectingSlot === -1) {
                            const idx = blueTeam.findIndex(c => c && c.key === hero.key);
                            if (idx !== -1) { setUserSlot(idx); if (myTeamRoles[idx]) setUserRole(myTeamRoles[idx]); }
                            setShowChampSelector(false);
                        } else { handleSelectChampion(hero); }
                    }}
                    roleMapping={roleMapping} 
                    initialRoleIndex={selectingSlot === -1 ? undefined : (selectingIsEnemy ? ["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"].indexOf(Object.keys(enemyLaneAssignments).find(k => enemyLaneAssignments[k] === redTeam[selectingSlot]?.name)) : ["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"].indexOf(myTeamRoles[selectingSlot]))}
                />

                {showAdminPanel && token && (
                    adminView === 'panel' ? <AdminPanel token={token} onBack={() => setShowAdminPanel(false)} /> : <AdminDashboard token={token} username={currentUser} onClose={() => setShowAdminPanel(false)} />
                )}

                {currentUser && ["admin", "root"].includes(currentUser) && (
                    <button onClick={() => setShowAdminPanel(true)} className="fixed bottom-6 left-6 z-50 bg-red-600/90 hover:bg-red-500 text-white p-3 rounded-full shadow-lg backdrop-blur hover:scale-110 transition-all"><ShieldAlert size={20} /></button>
                )}
            </div>
        </div>
    );
}