export const GUIDE_STEPS = [
    { target: '#console-header', title: "欢迎来到 Hex Coach", description: "这是你的 AI 战术指挥中心。在这里，你可以连接 LCU 客户端，切换分析模式，并管理你的个人设置。" },
    { target: '#left-panel-team', title: "配置我方阵容", description: "如果连接了客户端，这里会自动同步。你也可以手动点击卡片选择英雄，并调整对应的分路。" },
    { target: '#lane-assignment-panel', title: "校准分路信息 (关键)", description: "智能分配可能无法识别摇摆位。若分路显示不正确，请务必手动调整【我方】与【敌方】的分路，确保 AI 提供最精准的对策。" },
    { target: '#center-analysis-btn', title: "启动 AI 推演", description: "设置好双方阵容后，点击此按钮。AI 将基于深度思考模型，为你提供 BP 建议、对线细节或运营策略。" },
    { target: '#analysis-tabs', title: "切换分析维度", description: "想看对线技巧或打野路线？选【王者私教】。想看大局运营？选【运营指挥】。系统会根据你的位置自动调整策略。" },
    { target: '#right-panel-enemy', title: "敌方情报与社区", description: "这里显示敌方阵容。下方是【绝活社区】，你可以查看针对当前对手的玩家心得，或者分享你的见解。" },
    { 
        target: 'body', 
        title: "我们如何一起改进", 
        description: "Hex Coach 不是一个“永远正确”的系统，它在不断学习。如果你发现 AI 判断有偏差，或有更好的理解，欢迎反馈。经过审核的有效反馈，将获得额外的【核心模型】次数或会员奖励。",
        placement: 'center' 
    }
];