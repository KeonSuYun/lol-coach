import React, { useState, useEffect } from 'react';
import { X, User, Lock, Mail, MessageSquare, Loader2 } from 'lucide-react';
import axios from 'axios';
import FingerprintJS from '@fingerprintjs/fingerprintjs';
import { API_BASE_URL } from '../../config/constants';

export default function LoginModal({ 
    isOpen, 
    onClose, 
    authMode, 
    setAuthMode, 
    authForm, 
    setAuthForm, 
    handleLogin, 
    handleRegister 
}) {
    // === 内部状态 ===
    const [countdown, setCountdown] = useState(0);
    const [isSending, setIsSending] = useState(false); // 发送按钮的加载状态
    const [deviceId, setDeviceId] = useState(null);

    // === 1. 初始化：获取设备指纹 (Device Fingerprint) ===
    useEffect(() => {
        // 仅当弹窗打开且未获取过指纹时执行
        if (isOpen && !deviceId) {
            const getFingerprint = async () => {
                try {
                    const fp = await FingerprintJS.load();
                    const result = await fp.get();
                    const visitorId = result.visitorId;
                    
                    setDeviceId(visitorId);
                    
                    // 将设备ID 注入到父组件的 authForm 中，以便注册时发送给后端
                    setAuthForm(prev => ({
                        ...prev,
                        device_id: visitorId
                    }));
                    
                    console.log("Device Fingerprint Loaded:", visitorId);
                } catch (error) {
                    console.error("Failed to load device fingerprint:", error);
                    // 即使失败也允许继续，后端会标记为 unknown
                    setAuthForm(prev => ({ ...prev, device_id: "unknown_client_error" }));
                }
            };
            getFingerprint();
        }
    }, [isOpen, deviceId, setAuthForm]);

    // === 2. 倒计时逻辑 ===
    useEffect(() => {
        let timer;
        if (countdown > 0) {
            timer = setTimeout(() => setCountdown(c => c - 1), 1000);
        }
        return () => clearTimeout(timer);
    }, [countdown]);

    // === 3. 发送邮箱验证码 ===
    const sendEmail = async () => {
        // 简单正则校验
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!authForm.email || !emailRegex.test(authForm.email)) {
            alert("请输入正确的电子邮箱地址");
            return;
        }

        setIsSending(true);
        try {
            // 调用后端发送接口
            await axios.post(`${API_BASE_URL}/send-email`, { 
                email: authForm.email 
            });
            
            alert("验证码已发送！请查收邮件（若未收到请检查垃圾箱）。");
            setCountdown(60); // 开启60秒冷却
        } catch (error) {
            console.error("Send Email Error:", error);
            const errorMsg = error.response?.data?.detail || "发送失败，请稍后重试";
            alert(errorMsg);
        } finally {
            setIsSending(false);
        }
    };

    // 如果弹窗未打开，不渲染任何内容
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            {/* 弹窗主体 */}
            <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-md p-6 relative shadow-2xl shadow-black/50 scale-100 transition-all">
                
                {/* 关闭按钮 */}
                <button 
                    onClick={onClose} 
                    className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors p-1 rounded-full hover:bg-slate-800"
                >
                    <X size={20} />
                </button>

                {/* 标题 */}
                <h2 className="text-2xl font-bold text-white mb-2 text-center">
                    {authMode === 'login' ? '登录 HexCoach' : '注册新账号'}
                </h2>
                <p className="text-slate-500 text-xs text-center mb-6">
                    {authMode === 'login' ? '欢迎回来，召唤师' : '加入我们，开启最强王者之路'}
                </p>

                {/* 表单区域 */}
                <div className="flex flex-col gap-4">
                    
                    {/* 1. 用户名输入框 */}
                    <div className="relative group">
                        <User className="absolute left-3 top-3 text-slate-500 group-focus-within:text-blue-400 transition-colors" size={18} />
                        <input
                            type="text"
                            placeholder="用户名"
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg py-2.5 pl-10 pr-4 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:bg-slate-800/80 transition-all"
                            value={authForm.username}
                            onChange={e => setAuthForm({ ...authForm, username: e.target.value })}
                        />
                    </div>

                    {/* 2. 密码输入框 */}
                    <div className="relative group">
                        <Lock className="absolute left-3 top-3 text-slate-500 group-focus-within:text-blue-400 transition-colors" size={18} />
                        <input
                            type="password"
                            placeholder="密码"
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg py-2.5 pl-10 pr-4 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:bg-slate-800/80 transition-all"
                            value={authForm.password}
                            onChange={e => setAuthForm({ ...authForm, password: e.target.value })}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    authMode === 'login' ? handleLogin() : handleRegister();
                                }
                            }}
                        />
                    </div>

                    {/* 🔥 仅注册模式显示：邮箱 & 验证码 */}
                    {authMode === 'register' && (
                        <div className="flex flex-col gap-4 animate-in slide-in-from-top-2 duration-300">
                            
                            {/* 3. 邮箱输入框 */}
                            <div className="relative group">
                                <Mail className="absolute left-3 top-3 text-slate-500 group-focus-within:text-blue-400 transition-colors" size={18} />
                                <input
                                    type="email"
                                    placeholder="电子邮箱 (用于接收验证码)"
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg py-2.5 pl-10 pr-4 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:bg-slate-800/80 transition-all"
                                    value={authForm.email || ''}
                                    onChange={e => setAuthForm({ ...authForm, email: e.target.value })}
                                />
                            </div>

                            {/* 4. 验证码输入框 + 发送按钮 */}
                            <div className="flex gap-2">
                                <div className="relative flex-1 group">
                                    <MessageSquare className="absolute left-3 top-3 text-slate-500 group-focus-within:text-blue-400 transition-colors" size={18} />
                                    <input
                                        type="text"
                                        placeholder="邮箱验证码"
                                        className="w-full bg-slate-800 border border-slate-700 rounded-lg py-2.5 pl-10 pr-4 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:bg-slate-800/80 transition-all"
                                        value={authForm.verify_code || ''}
                                        onChange={e => setAuthForm({ ...authForm, verify_code: e.target.value })}
                                    />
                                </div>
                                
                                <button
                                    onClick={sendEmail}
                                    disabled={countdown > 0 || isSending}
                                    className={`px-4 rounded-lg font-bold text-sm min-w-[100px] flex items-center justify-center transition-all
                                    ${(countdown > 0 || isSending)
                                        ? 'bg-slate-700 text-slate-500 cursor-not-allowed border border-slate-600' 
                                        : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20 active:scale-95 border border-blue-500/50'}`}
                                >
                                    {isSending ? (
                                        <Loader2 size={16} className="animate-spin" />
                                    ) : countdown > 0 ? (
                                        `${countdown}s`
                                    ) : (
                                        '获取验证码'
                                    )}
                                </button>
                            </div>
                            
                            {/* 安全提示 */}
                            <div className="text-[10px] text-slate-500 px-1">
                                * 为了防止恶意注册，我们将记录您的设备指纹 ID: 
                                <span className="font-mono ml-1 text-slate-400">
                                    {deviceId ? `${deviceId.substring(0, 8)}...` : '获取中...'}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* 提交按钮 */}
                    <button
                        onClick={authMode === 'login' ? handleLogin : handleRegister}
                        className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-bold py-3 rounded-lg shadow-lg shadow-orange-900/20 transition-all mt-2 active:scale-[0.98] border border-orange-500/20"
                    >
                        {authMode === 'login' ? '立即登录' : '确认注册'}
                    </button>

                    {/* 切换模式 */}
                    <div className="text-center text-xs text-slate-500 mt-2 select-none">
                        {authMode === 'login' ? '还没有账号？' : '已有账号？'}
                        <button
                            onClick={() => {
                                setAuthMode(authMode === 'login' ? 'register' : 'login');
                                // 切换时清空敏感字段，保留用户名方便切换回来
                                setAuthForm(prev => ({ 
                                    ...prev, 
                                    password: '', 
                                    verify_code: '' 
                                }));
                            }}
                            className="text-blue-400 hover:text-blue-300 ml-1 font-bold underline decoration-dotted transition-colors"
                        >
                            {authMode === 'login' ? '免费注册' : '去登录'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}