// src/components/modals/LoginModal.jsx
import React from 'react';
import { X } from 'lucide-react';

const LoginModal = ({ isOpen, onClose, authMode, setAuthMode, authForm, setAuthForm, handleLogin, handleRegister }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] backdrop-blur-sm">
        <div className="bg-slate-900 border border-slate-700 p-6 rounded-xl w-80 shadow-2xl relative">
            <h3 className="text-white font-bold mb-4 text-center tracking-wide">{authMode==='login'?'登录 HEXCOACH':'注册新账号'}</h3>
            <div className="flex flex-col gap-3">
                <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 uppercase font-bold">Username</label>
                    <input 
                        className="w-full bg-black border border-slate-700 rounded p-2 text-white text-sm focus:border-blue-500 outline-none transition-colors" 
                        value={authForm.username} 
                        onChange={e=>setAuthForm({...authForm, username: e.target.value})}
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 uppercase font-bold">Password</label>
                    <input 
                        type="password"
                        className="w-full bg-black border border-slate-700 rounded p-2 text-white text-sm focus:border-blue-500 outline-none transition-colors" 
                        value={authForm.password} 
                        onChange={e=>setAuthForm({...authForm, password: e.target.value})}
                        onKeyDown={e => e.key === 'Enter' && (authMode==='login' ? handleLogin() : handleRegister())}
                    />
                </div>
                <button onClick={authMode==='login' ? handleLogin : handleRegister} className="mt-2 bg-blue-600 text-white py-2 rounded font-bold hover:bg-blue-500 transition-all shadow-lg shadow-blue-900/20">
                    {authMode==='login' ? '登 录' : '注 册'}
                </button>
                <div className="text-center text-xs text-slate-500 mt-2">
                    {authMode==='login' ? '没有账号? ' : '已有账号? '}
                    <span className="text-blue-400 cursor-pointer hover:underline" onClick={()=>setAuthMode(authMode==='login'?'register':'login')}>
                        {authMode==='login' ? '去注册' : '去登录'}
                    </span>
                </div>
            </div>
            <button onClick={onClose} className="absolute top-3 right-3 text-slate-600 hover:text-white transition-colors"><X size={16}/></button>
        </div>
    </div>
  );
};

export default LoginModal;