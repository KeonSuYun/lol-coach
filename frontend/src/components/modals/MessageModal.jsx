import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
// 🔥 1. 引入 Ban (禁止) 图标
import { MessageSquare, X, Send, Plus, Loader2, User, Trash2, Ban, ExternalLink } from 'lucide-react';
import { API_BASE_URL } from '../../config/constants';
import { toast } from 'react-hot-toast';

export default function MessageModal({ isOpen, onClose, onMarkAllRead, currentUser }) {
    const [conversations, setConversations] = useState([]);
    const [activeChatId, setActiveChatId] = useState(null); 
    
    const [chatData, setChatData] = useState({ messages: [], contactInfo: null });
    
    const [inputValue, setInputValue] = useState("");
    const [loading, setLoading] = useState(false);
    
    // 🔥 新增：加载更多状态
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);

    const [newChatInput, setNewChatInput] = useState(""); 
    const [showNewChat, setShowNewChat] = useState(false); 

    const messagesEndRef = useRef(null);
    const scrollContainerRef = useRef(null); 
    
    const token = localStorage.getItem('access_token'); 

    // 辅助函数：统一处理头像URL
    const fixAvatarUrl = (url) => {
        if (!url) return "https://ddragon.leagueoflegends.com/cdn/14.1.1/img/profileicon/29.png";
        return url.replace(/cdn\/[\d\.]+\/img/, "cdn/14.1.1/img");
    };

    const scrollToBottom = (smooth = true) => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
        }
    };

    // 1. 获取会话列表 (🔥 修复：支持静默轮询，不闪烁 Loading)
    const fetchConversations = async (isPolling = false) => {
        if (!token) return;
        if (!isPolling) setLoading(true); // 只有首次才转圈圈
        try {
            const res = await axios.get(`${API_BASE_URL}/messages/conversations`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            // 确保没有 ID 为空的条目
            const validChats = res.data.filter(c => c.id && c.id !== "null" && c.id !== "");
            setConversations(validChats);
            
            // 如果刚打开且没有选中，默认选第一个
            if (!activeChatId && validChats.length > 0 && !isPolling) {
                setActiveChatId(validChats[0].id);
            }
        } catch (error) {
            console.error("Failed to fetch conversations", error);
        } finally {
            if (!isPolling) setLoading(false);
        }
    };

    // 2. 获取聊天记录 (🔥 修复：支持分页 'more' 和轮询 'poll')
    const fetchChatHistory = async (chatId, type = 'init') => { // type: 'init' | 'poll' | 'more'
        if (!token || !chatId) return;
        
        let beforeTime = null;
        // 如果是加载更多，取最上面一条的时间作为游标
        if (type === 'more') {
            if (chatData.messages.length > 0) {
                beforeTime = chatData.messages[0].iso_time; 
            }
            setLoadingMore(true);
        }

        try {
            const res = await axios.get(`${API_BASE_URL}/messages/${chatId}`, {
                headers: { Authorization: `Bearer ${token}` },
                params: { before: beforeTime } // 传给后端分页
            });
            
            const newMsgs = res.data.messages;

            if (type === 'init') {
                // 初始化：直接覆盖
                setChatData(res.data);
                setHasMore(newMsgs.length >= 50); // 如果一次拿满50条，说明可能还有更多
                setTimeout(() => scrollToBottom(false), 100);
            } 
            else if (type === 'poll') {
                // 轮询：只追加新消息
                setChatData(prev => {
                    const lastId = prev.messages.length > 0 ? prev.messages[prev.messages.length - 1].id : null;
                    // 过滤出比本地更新的消息
                    const incoming = newMsgs.filter(m => m.id !== lastId && !prev.messages.find(pm => pm.id === m.id));
                    if (incoming.length > 0) {
                        setTimeout(() => scrollToBottom(true), 100); // 有新消息才滚到底
                        return { ...prev, messages: [...prev.messages, ...incoming] };
                    }
                    return prev;
                });
            }
            else if (type === 'more') {
                // 加载历史：拼接到头部
                if (newMsgs.length > 0) {
                    // 记录滚动高度，保持位置不变
                    const container = scrollContainerRef.current;
                    const oldHeight = container ? container.scrollHeight : 0;
                    
                    setChatData(prev => ({
                        ...prev,
                        messages: [...newMsgs, ...prev.messages]
                    }));
                    
                    // 恢复滚动位置
                    setTimeout(() => {
                        if (container) {
                            container.scrollTop = container.scrollHeight - oldHeight;
                        }
                    }, 0);
                } else {
                    setHasMore(false); // 没有更多历史了
                }
            }
            
            // 标记已读 (轮询时不重复触发)
            if (type !== 'poll') {
                setConversations(prev => prev.map(c => c.id === chatId ? { ...c, unread: false } : c));
                if (onMarkAllRead) onMarkAllRead();
            }
        } catch (error) {
            console.error("Failed to fetch chat history", error);
        } finally {
            setLoadingMore(false);
        }
    };

    // 🔥 3. 列表轮询 (自动刷新新消息红点)
    useEffect(() => {
        if (isOpen) {
            fetchConversations(false); // 首次加载
            const listTimer = setInterval(() => fetchConversations(true), 5000); // 5秒轮询
            return () => clearInterval(listTimer);
        }
    }, [isOpen]);

    // 🔥 4. 消息轮询 (自动刷新聊天内容)
    useEffect(() => {
        if (activeChatId) {
            fetchChatHistory(activeChatId, 'init');
            const timer = setInterval(() => {
                fetchChatHistory(activeChatId, 'poll');
            }, 3000);
            return () => clearInterval(timer);
        }
    }, [activeChatId]);

    const handleSend = async () => {
        if (!inputValue.trim() || !activeChatId) return;
        
        const tempMsg = {
            id: 'temp-' + Date.now(),
            sender: currentUser.loginId, 
            content: inputValue,
            time: "发送中...",
            read: false
        };
        
        setChatData(prev => ({
            ...prev,
            messages: [...prev.messages, tempMsg]
        }));
        setInputValue("");
        setTimeout(() => scrollToBottom(true), 50);

        try {
            await axios.post(`${API_BASE_URL}/messages`, {
                receiver: activeChatId,
                content: tempMsg.content
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            // 发送成功后刷新一下 (为了拿到真实时间)
            fetchChatHistory(activeChatId, 'poll'); 
            fetchConversations(true); 
        } catch (error) {
            toast.error(error.response?.data?.detail || "发送失败");
        }
    };

    // 🔥 拉黑/解除拉黑 用户
    const handleBlockUser = async () => {
        if (!activeChatId) return;
        if (!confirm(`确定要切换用户 [${activeChatId}] 的黑名单状态吗？\n\n⛔ 拉黑后：将拒收对方消息\n✅ 解除后：恢复正常通讯`)) return;

        try {
            const res = await axios.post(`${API_BASE_URL}/users/block`, {
                target_username: activeChatId
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            if (res.data.is_blocked) {
                toast.success("🚫 已拉黑该用户");
                onClose(); 
            } else {
                toast.success("✅ 已解除黑名单");
            }
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.detail || "操作失败");
        }
    };

    const handleDeleteChat = async (e, chatId) => {
        e.stopPropagation(); 
        if (!confirm("确定要彻底删除该对话吗？记录将无法找回。")) return;
        
        setConversations(prev => prev.filter(c => c.id !== chatId));
        if (activeChatId === chatId) {
            setActiveChatId(null);
            setChatData({ messages: [], contactInfo: null });
        }

        try {
            await axios.delete(`${API_BASE_URL}/messages/${chatId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            toast.success("会话已删除");
        } catch (error) {
            toast.error("删除出错");
            fetchConversations(true);
        }
    };

    // 🔥 发起新会话 (修复版：支持昵称搜索 + 防重跳转)
    const startNewChat = async () => {
        const target = newChatInput.trim();
        if (!target) return;
        
        if (target === currentUser.loginId) {
            toast.error("不能给自己发消息");
            return;
        }

        // 1. 本地初步检查
        let existingChat = conversations.find(c => 
            c.id === target || (c.nickname && c.nickname.toLowerCase() === target.toLowerCase())
        );

        if (existingChat) {
            setActiveChatId(existingChat.id);
            setShowNewChat(false);
            setNewChatInput("");
            toast("已存在于列表中", { icon: '👉' });
            return;
        }

        const toastId = toast.loading("正在查找用户...");
        try {
            // 调用后端搜索 (支持搜昵称)
            const res = await axios.get(`${API_BASE_URL}/users/profile/${target}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            const userInfo = res.data; 
            toast.dismiss(toastId);
            
            // 2. 拿到真实ID后，再次检查列表是否已存在
            const realIdChat = conversations.find(c => c.id === userInfo.username);
            
            if (realIdChat) {
                setActiveChatId(realIdChat.id);
                // 顺便更新下头像/昵称
                setConversations(prev => prev.map(c => 
                    c.id === realIdChat.id 
                    ? { ...c, nickname: userInfo.nickname, avatar: userInfo.avatar } 
                    : c
                ));
                toast("已存在于列表中", { icon: '👉' });
            } else {
                const newChat = {
                    id: userInfo.username,
                    nickname: userInfo.nickname,
                    sender: userInfo.username,
                    content: "新会话", 
                    time: "刚刚",
                    unread: false,
                    avatar: userInfo.avatar
                };
                setConversations(prev => [newChat, ...prev]);
                setActiveChatId(userInfo.username);
            }

            setShowNewChat(false);
            setNewChatInput("");
            
        } catch (error) {
            toast.dismiss(toastId);
            if (error.response && error.response.status === 404) {
                toast.error("未找到用户 (请尝试 登录账号 或 游戏昵称)");
            } else {
                toast.error("查询失败");
            }
        }
    };

    const activeContactInfo = chatData.contactInfo || conversations.find(c => c.id === activeChatId) || {};
    
    let activeAvatar = fixAvatarUrl(activeContactInfo.avatar);
    if (activeChatId === 'admin' || activeChatId === 'root') {
        activeAvatar = "https://ddragon.leagueoflegends.com/cdn/14.1.1/img/profileicon/588.png";
    }
    const activeDisplayName = activeContactInfo.nickname || activeContactInfo.id || activeChatId;
    const activeUsername = activeContactInfo.username || activeContactInfo.id || activeChatId;

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#010a13]/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
          <div className="bg-[#091428] w-full max-w-4xl h-[650px] rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.6)] border border-[#1e2328] flex overflow-hidden ring-1 ring-cyan-500/20 relative" onClick={(e) => e.stopPropagation()}>
            <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-cyan-500/5 rounded-full blur-[100px] pointer-events-none"></div>

            {/* === 左侧列表 === */}
            <div className="w-80 border-r border-[#1e2328] bg-[#0c1626] flex flex-col shrink-0">
              <div className="p-4 border-b border-[#1e2328] flex justify-between items-center">
                <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <MessageSquare className="text-cyan-500" size={18} />
                  海克斯通讯
                </h2>
                <button onClick={() => setShowNewChat(!showNewChat)} className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-cyan-400 transition-colors">
                    <Plus size={18}/>
                </button>
              </div>

              {showNewChat && (
                  <div className="p-2 border-b border-white/5 bg-[#131b2d] animate-in slide-in-from-top-2">
                      <div className="flex gap-2">
                          <input 
                              className="flex-1 bg-[#091428] border border-slate-700 rounded px-2 py-1 text-xs text-white outline-none focus:border-cyan-500"
                              placeholder="输入 用户名 或 游戏昵称..." 
                              value={newChatInput}
                              onChange={e => setNewChatInput(e.target.value)}
                              onKeyDown={e => e.key === 'Enter' && startNewChat()}
                              autoFocus
                          />
                          <button onClick={startNewChat} className="bg-cyan-600 text-white px-3 py-1 rounded text-xs hover:bg-cyan-500">确定</button>
                      </div>
                  </div>
              )}
              
              <div className="overflow-y-auto flex-1 p-2 space-y-1 custom-scrollbar">
                {loading ? (
                    <div className="text-center py-10 text-slate-500 text-xs flex flex-col items-center gap-2">
                        <Loader2 className="animate-spin" size={16}/> 加载会话...
                    </div>
                ) : conversations.length === 0 ? (
                    <div className="text-center py-10 text-slate-500 text-xs">暂无消息，点击右上角 + 发起聊天</div>
                ) : (
                    conversations.map((chat) => {
                        let chatAvatar = fixAvatarUrl(chat.avatar);
                        if (chat.id === 'admin' || chat.id === 'root') {
                            chatAvatar = "https://ddragon.leagueoflegends.com/cdn/14.1.1/img/profileicon/588.png";
                        }
                        if (!chat.id) return null; 

                        return (
                            <div 
                                key={chat.id} 
                                onClick={() => setActiveChatId(chat.id)}
                                className={`group p-3 rounded-lg cursor-pointer transition-all border flex items-center gap-3 relative ${
                                activeChatId === chat.id 
                                ? 'bg-cyan-950/40 border-cyan-500/30 shadow-[inset_0_0_20px_rgba(6,182,212,0.1)]' 
                                : 'border-transparent hover:bg-white/5 hover:border-white/5'
                                }`}
                            >
                                <div className="w-10 h-10 rounded-full border border-slate-600 bg-black overflow-hidden shrink-0">
                                    <img 
                                        src={chatAvatar} 
                                        className="w-full h-full object-cover" 
                                        alt="" 
                                        onError={(e) => e.target.src = "https://ddragon.leagueoflegends.com/cdn/14.1.1/img/profileicon/29.png"}
                                    />
                                </div>
                                
                                <div className="flex-1 overflow-hidden">
                                    <div className="flex justify-between items-start mb-1">
                                        <div className="flex flex-col min-w-0">
                                            <span className={`font-bold text-sm truncate ${chat.unread ? 'text-cyan-300' : 'text-slate-300'}`}>
                                                {chat.nickname || chat.id}
                                            </span>
                                            <span className="text-[10px] text-slate-500 font-mono truncate">
                                                @{chat.id}
                                            </span>
                                        </div>
                                        <span className="text-[10px] text-slate-600 whitespace-nowrap ml-1">{chat.time}</span>
                                    </div>
                                    <div className="flex justify-between items-center mt-1">
                                        <p className={`text-xs truncate ${chat.unread ? 'text-slate-200' : 'text-slate-500'}`}>
                                            {chat.content}
                                        </p>
                                        {chat.unread && (
                                            <span className="block w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_5px_rgba(34,211,238,0.8)] ml-2 shrink-0"></span>
                                        )}
                                    </div>
                                </div>

                                <button 
                                    onClick={(e) => handleDeleteChat(e, chat.id)}
                                    className="absolute right-2 bottom-2 p-1.5 bg-red-900/80 text-red-300 rounded opacity-0 group-hover:opacity-100 hover:bg-red-600 hover:text-white transition-all z-10"
                                    title="删除会话"
                                >
                                    <Trash2 size={12} />
                                </button>
                            </div>
                        );
                    })
                )}
              </div>
            </div>

            {/* === 右侧主聊天区 === */}
            {/* === 右侧主聊天区 === */}
            <div className="flex-1 flex flex-col bg-[#091428] relative min-w-0">
              
              <div className="h-14 border-b border-[#1e2328] flex items-center justify-between px-6 bg-[#0c1626]/50">
                <div className="flex items-center gap-3">
                  {activeChatId ? (
                      <>
                        <div className="w-8 h-8 rounded-full border border-cyan-500/30 shadow-lg overflow-hidden shrink-0">
                            <img 
                                src={activeAvatar} 
                                className="w-full h-full object-cover" 
                                alt="" 
                                onError={(e) => e.target.src = "https://ddragon.leagueoflegends.com/cdn/14.1.1/img/profileicon/29.png"}
                            />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-slate-200">{activeDisplayName}</span>
                                <span className="text-[10px] text-slate-500 font-mono bg-white/5 px-1.5 py-0.5 rounded">@{activeUsername}</span>
                            </div>
                        </div>
                      </>
                  ) : (
                      <div className="text-sm text-slate-500">未选择会话</div>
                  )}
                </div>
                
                {/* 🔥 右上角按钮组 */}
                <div className="flex items-center gap-1">
                    {activeChatId && (
                        <>
                            {/* 🔥 新增：查看主页按钮 */}
                            <button 
                                onClick={() => {
                                    if (onViewProfile) onViewProfile(activeChatId);
                                }}
                                className="text-slate-500 hover:text-[#C8AA6E] transition-colors p-2 hover:bg-[#C8AA6E]/10 rounded-full group relative"
                                title="查看对方主页"
                            >
                                <User size={18} />
                            </button>

                            <button 
                                onClick={handleBlockUser}
                                className="text-slate-500 hover:text-red-500 transition-colors p-2 hover:bg-red-500/10 rounded-full group relative"
                                title="拉黑/解除拉黑"
                            >
                                <Ban size={18} />
                            </button>
                        </>
                    )}
                    
                    <button 
                        onClick={onClose} 
                        className="text-slate-500 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-full"
                    >
                        <X size={20} />
                    </button>
                </div>
              </div>

              {/* 🔥 消息列表：支持下拉加载 */}
              <div 
                ref={scrollContainerRef}
                className="flex-1 p-6 overflow-y-auto space-y-4 custom-scrollbar bg-slate-900/50"
                onScroll={(e) => {
                    // 滚动到顶部触发加载更多
                    if (e.target.scrollTop === 0 && !loadingMore && hasMore) {
                        fetchChatHistory(activeChatId, 'more');
                    }
                }}
              >
                {/* 加载更多提示 */}
                {loadingMore && (
                    <div className="text-center py-2 text-xs text-slate-500 flex justify-center">
                        <Loader2 size={14} className="animate-spin mr-1"/> 加载历史记录...
                    </div>
                )}

                {!activeChatId ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-600 gap-4 opacity-50">
                        <MessageSquare size={48} strokeWidth={1} />
                        <div className="text-sm">选择左侧联系人开始聊天</div>
                    </div>
                ) : chatData.messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-600 gap-2 opacity-50">
                        <span className="text-xs">暂无消息，打个招呼吧！</span>
                    </div>
                ) : (
                    chatData.messages.map((msg, idx) => {
                        const isMe = msg.sender === currentUser.loginId;
                        let currentAvatar = isMe ? currentUser.avatarUrl : activeAvatar;
                        currentAvatar = fixAvatarUrl(currentAvatar);

                        return (
                            <div key={msg.id || idx} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-lg overflow-hidden border ${isMe ? 'border-amber-500/50' : 'border-cyan-500/50'}`}>
                                    <img 
                                        src={currentAvatar} 
                                        alt={msg.sender}
                                        className="w-full h-full object-cover"
                                        onError={(e) => e.target.src = "https://ddragon.leagueoflegends.com/cdn/14.1.1/img/profileicon/29.png"}
                                    />
                                </div>
                                <div className={`max-w-[75%] ${isMe ? 'text-right' : 'text-left'}`}>
                                    <div className="text-[10px] text-slate-500 mb-1 px-1">
                                        {msg.time}
                                    </div>
                                    <div className={`p-3 rounded-xl text-sm leading-relaxed shadow-lg inline-block text-left break-words ${
                                        isMe 
                                        ? 'bg-blue-600 text-white rounded-tr-none' 
                                        : 'bg-[#131b2d] text-slate-300 border border-cyan-500/20 rounded-tl-none'
                                    }`}>
                                        {msg.content}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="p-4 border-t border-[#1e2328] bg-[#0c1626]">
                <div className="relative group">
                  <input 
                    type="text" 
                    placeholder={activeChatId ? `发送给 ${activeDisplayName}...` : "请先选择联系人"}
                    disabled={!activeChatId}
                    className="w-full bg-[#091428] text-slate-200 text-sm rounded-xl pl-4 pr-12 py-3.5 border border-[#1e2328] focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 focus:outline-none transition-all shadow-inner placeholder:text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  />
                  <button 
                    onClick={handleSend}
                    disabled={!activeChatId || !inputValue.trim()}
                    className="absolute right-2 top-2 p-1.5 text-slate-500 hover:text-cyan-400 hover:bg-cyan-950/30 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Send size={18} />
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>
    );
}