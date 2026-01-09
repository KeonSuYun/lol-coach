<div align="center">

# HexCoach

英雄联盟 AI 战术副驾 (League of Legends AI Co-Pilot)

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Python](https://img.shields.io/badge/python-3.10+-3776AB?logo=python&logoColor=white)
![DeepSeek](https://img.shields.io/badge/AI-DeepSeek%20V3%2FR1-4b44ce)
![License](https://img.shields.io/badge/license-Proprietary-red)

<p align="center">
  <strong>拒绝死板查战绩，打造具备“王者级意识”的虚拟教练</strong>
</p>

</div>

**HexCoach (海克斯教练)** 是一款基于 **DeepSeek-V3/R1** 大模型的英雄联盟实时战术辅助系统。它不仅仅是一个数据查询工具，更是一个内置了 **S16 物理地理公理** 和 **动态决策引擎** 的智能副驾。它能结合实时阵容、段位和版本数据，为你提供从开局路线规划到团战画面的全流程战术指导，彻底告别“公式化”游戏。

## Highlights

### 深度思考战术引擎

- **双模驱动**：支持 **DeepSeek-V3** (极速响应) 和 **DeepSeek-R1** (深度思维链推理)。
- **动态思维链 (CoT)**：根据“强度曲线 (Power Spikes)”和“ROI”动态决策，拒绝死记硬背。
- **角色智能定性**：自动判断你是“野核”、“节奏位”还是“工具人”，定制专属获胜剧本。

### S16 防幻觉地理系统

- **绝对坐标系**：内置召唤师峡谷物理象限，杜绝“刷完F6顺路去蛤蟆”等反人类建议。
- **S16 新机制适配**：完美支持无帮开野 (Leashless Start)、门牙塔重生、虚空巢虫资源置换法则。

### RAG 混合专家知识库

- **绝活哥经验库**：集成社区高赞实战技巧 (Tips)，只推经过验证的干货。
- **错误修正层**：拥有最高优先级的 `Corrections` 库，强制修正 AI 对特定交互（如亚索风墙挡不住赛娜普攻）的认知偏差。

### 全栈生态闭环

- **LCU 实时联动**：读取客户端数据并智能过滤，精准投喂 AI，节省 Token 成本。
- **社区酒馆**：内置 Wiki 与互动社区，分享攻略赚取时长。
- **商业化系统**：完善的邀请码裂变、会员权限管理及支付接口。

## Tech Stack

| 层级 | 技术栈 | 说明 |
|------|--------|------|
| **前端 Web** | React 19 + Vite + TailwindCSS | 主控台界面 |
| **客户端** | Electron 39 + Koffi (Win32 FFI) | 游戏内悬浮窗 |
| **后端 API** | FastAPI + Uvicorn + Pydantic | RESTful API + WebSocket |
| **数据库** | MongoDB | 用户系统、知识库、订单 |
| **AI 引擎** | DeepSeek-V3/R1 (OpenAI SDK) | 战术分析核心 |
| **安全认证** | OAuth2 + JWT + Bcrypt | Token 7天有效期 |
| **部署** | Docker + UV 包管理器 | 容器化部署 |

## Team & Contributors

HexCoach 项目的诞生与维护离不开团队成员的共同努力：

- KeonSuYun - 项目创始人 & 首席架构师 & 主要开发者
- KilluaAoki - 贡献者

## License

Copyright © 2026 KeonSuYun. All Rights Reserved.

本软件为私有商业软件 (Proprietary Software)，非开源软件。

- 禁止复制：未经版权所有者书面许可，严禁复制、分发、修改或将本项目代码用于任何商业/非商业用途。
- 保留权利：本项目的所有代码、文档、设计及技术概念均归版权所有者所有，受著作权法保护。
- 竞业限制：任何接触本项目源码的人员需遵守相关保密协议。

本项目严禁未经授权者进行任何形式的分发、复制或商业使用。

