import React from 'react';

const PricingModal = ({ isOpen, onClose, username }) => {
  if (!isOpen) return null;

  // 🔴 替换成你的爱发电个人主页链接
  const AFDIAN_URL = "https://afdian.com/a/你的爱发电ID";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#1a1c23] border border-gray-700 w-full max-w-lg rounded-xl shadow-2xl overflow-hidden">
        
        {/* 标题 */}
        <div className="bg-gradient-to-r from-yellow-600/20 to-orange-600/20 p-6 border-b border-gray-700">
          <h2 className="text-2xl font-bold text-yellow-400 flex items-center gap-2">
            💎 升级 Pro 会员
          </h2>
          <p className="text-gray-400 text-sm mt-1">解锁 DeepSeek R1 深度思考模型，无限次 AI 分析。</p>
        </div>

        {/* 内容区 */}
        <div className="p-6 space-y-6">
          
          {/* 套餐选择 (这里只是展示，点击都是跳到同一个爱发电页面) */}
          <div className="grid grid-cols-2 gap-4">
            <div className="border border-gray-600 bg-gray-800/50 p-4 rounded-lg text-center hover:border-yellow-500 transition cursor-pointer"
                 onClick={() => window.open(AFDIAN_URL, '_blank')}>
              <div className="text-gray-300">周卡畅玩</div>
              <div className="text-2xl font-bold text-yellow-400 my-1">¥6.9</div>
              <div className="text-xs text-gray-500">适合周末冲分</div>
            </div>
            <div className="border border-yellow-500 bg-yellow-500/10 p-4 rounded-lg text-center relative cursor-pointer"
                 onClick={() => window.open(AFDIAN_URL, '_blank')}>
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-yellow-500 text-black text-xs px-2 py-0.5 rounded-full font-bold">
                超值推荐
              </div>
              <div className="text-yellow-100">月卡尊享</div>
              <div className="text-2xl font-bold text-yellow-400 my-1">¥19.9</div>
              <div className="text-xs text-yellow-200/60">平均每天</div>
            </div>
          </div>

          {/* 🔴 核心提示区 */}
          <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4">
            <h3 className="text-red-400 font-bold mb-2 flex items-center">
              ⚠️ 支付必读 (非常重要)
            </h3>
            <ol className="list-decimal list-inside text-gray-300 space-y-2 text-sm">
              <li>点击上方卡片跳转至爱发电。</li>
              <li>选择方案并支付。</li>
              <li>
                <span className="text-white font-bold bg-red-600/80 px-1 rounded">
                  关键：
                </span>
                在支付页面的 <span className="font-bold">“留言”</span> 处，必须填写您的用户名：
              </li>
              <div className="bg-black/50 p-3 rounded text-center font-mono text-lg text-green-400 mt-1 select-all border border-gray-700">
                {username || "请先登录"}
              </div>
              <li className="text-xs text-gray-500 pt-1">如果忘记填写，请联系客服人工补单。</li>
            </ol>
          </div>

        </div>

        {/* 底部按钮 */}
        <div className="p-4 border-t border-gray-700 flex justify-end">
          <button 
            onClick={onClose}
            className="px-6 py-2 text-gray-400 hover:text-white transition"
          >
            暂不升级
          </button>
          <button 
            onClick={() => window.open(AFDIAN_URL, '_blank')}
            className="ml-3 px-6 py-2 bg-yellow-600 hover:bg-yellow-500 text-black font-bold rounded shadow-lg shadow-yellow-900/20 transition"
          >
            前往支付
          </button>
        </div>
      </div>
    </div>
  );
};

export default PricingModal;