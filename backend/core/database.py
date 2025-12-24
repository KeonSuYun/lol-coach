# backend/core/database.py

import os
import datetime
import time
from pymongo import MongoClient
from pymongo.errors import ServerSelectionTimeoutError, ConfigurationError 
from bson.objectid import ObjectId

class KnowledgeBase:
    def __init__(self):
        # 🟢 1. 获取 URI
        self.uri = os.getenv("MONGO_URI", "mongodb://localhost:27017")
        
        self._log_connection_attempt()

        try:
            self.client = MongoClient(self.uri, serverSelectionTimeoutMS=5000)
            
            # 🟢 2. 强制连通性检查
            self.client.admin.command('ping')
            
            # 🟢 3. 智能数据库选择
            try:
                # 尝试获取 URI 中指定的数据库
                self.db = self.client.get_default_database()
                print(f"✅ [Database] 使用 URI 指定的数据库: {self.db.name}")
            except (ConfigurationError, ValueError):
                # 如果 URI 没指定库名，直接使用默认 'lol_community'
                self.db = self.client['lol_community']
                print(f"✅ [Database] URI 未指定库名，使用默认数据库: {self.db.name}")
            
            # === 集合定义 ===
            self.tips_col = self.db['tips']
            self.feedback_col = self.db['feedback']
            self.config_col = self.db['config']
            self.corrections_col = self.db['corrections']
            self.users_col = self.db['users']
            self.prompt_templates_col = self.db['prompt_templates']
            self.champions_col = self.db['champions'] 

            # === 索引初始化 ===
            self._init_indexes()

        except ServerSelectionTimeoutError:
            print(f"❌ [Database] 连接超时! 请检查 MongoDB 服务是否开启，或防火墙设置。")
        except Exception as e:
            print(f"❌ [Database] 初始化发生未知错误: {e}")

    def _log_connection_attempt(self):
        """辅助函数：打印连接目标，但隐藏密码"""
        try:
            if "@" in self.uri:
                part_after_at = self.uri.split("@")[1]
                print(f"🔌 [Database] 正在尝试连接: mongodb://****:****@{part_after_at}")
            else:
                print(f"🔌 [Database] 正在尝试连接: {self.uri}")
        except:
            print("🔌 [Database] 正在尝试连接 MongoDB...")

    def _init_indexes(self):
        """创建索引，提升查询性能并保证数据唯一性"""
        try:
            # 绝活查询索引
            self.tips_col.create_index([("hero", 1), ("enemy", 1)])
            # 修正规则索引
            self.corrections_col.create_index([("hero", 1), ("enemy", 1)])
            # 用户名唯一索引
            self.users_col.create_index("username", unique=True)
            # Prompt 模式唯一索引
            self.prompt_templates_col.create_index("mode", unique=True)
            print("✅ [Database] 索引检查完毕")
        except Exception as e:
            print(f"⚠️ [Database] 索引创建警告: {e}")

    # ==========================
    # ⏱️ 频控与限流系统 (核心升级：15秒CD + 分栏目)
    # ==========================
    def check_and_update_usage(self, username, mode):
        """
        检查并更新用户的使用次数和冷却时间。
        返回: (allowed: bool, message: str, remaining_seconds: int)
        """
        user = self.users_col.find_one({"username": username})
        if not user:
            return False, "用户不存在", 0

        # 1. 获取当前状态
        now = datetime.datetime.utcnow()
        today_str = now.strftime("%Y-%m-%d")
        
        # 数据结构初始化 (兼容旧数据)
        usage_data = user.get("usage_stats", {})
        last_reset = usage_data.get("last_reset_date", "")
        
        # 2. 跨天重置逻辑
        if last_reset != today_str:
            # 新的一天，重置计数
            usage_data = {
                "last_reset_date": today_str,
                "counts": {},      # 各模式今日已用次数 { "bp": 2, "personal": 0 }
                "last_access": {}  # 各模式上次使用时间
            }
        
        counts = usage_data.get("counts", {})
        last_access = usage_data.get("last_access", {})

        # 3. 检查冷却时间 (此处修改为 15 秒)
        COOLDOWN_SECONDS = 15
        
        last_time_str = last_access.get(mode)
        if last_time_str:
            last_time = datetime.datetime.fromisoformat(last_time_str)
            delta = (now - last_time).total_seconds()
            if delta < COOLDOWN_SECONDS:
                return False, f"技能冷却中 ({int(COOLDOWN_SECONDS - delta)}s)", int(COOLDOWN_SECONDS - delta)

        # 4. 检查每日上限 (Pro/Admin 无限，普通用户 5次)
        role = user.get("role", "user")
        is_pro = role in ["vip", "svip", "admin", "pro", "HexCoach"] 
        
        current_count = counts.get(mode, 0)
        max_daily = 5 # 普通用户上限
        
        if not is_pro and current_count >= max_daily:
            return False, f"今日次数已耗尽 (普通用户每日 {max_daily} 次)", -1

        # 5. 更新数据库 (通行)
        counts[mode] = current_count + 1
        last_access[mode] = now.isoformat()
        
        usage_data["counts"] = counts
        usage_data["last_access"] = last_access
        usage_data["last_reset_date"] = today_str # 确保更新日期

        self.users_col.update_one(
            {"username": username},
            {"$set": {"usage_stats": usage_data}}
        )

        return True, "允许分析", 0

    # ==========================
    # 👤 用户系统
    # ==========================
    def create_user(self, username, hashed_password, role="user"):
        try:
            if self.users_col.find_one({"username": username}):
                return False
                
            self.users_col.insert_one({
                "username": username,
                "password": hashed_password,
                "role": role,
                "created_at": datetime.datetime.utcnow()
            })
            return True
        except:
            return False 

    def get_user(self, username):
        return self.users_col.find_one({"username": username})

    # ==========================
    # 🛡️ 管理员功能
    # ==========================
    def get_all_feedbacks(self, limit=50):
        try:
            cursor = self.feedback_col.find().sort('_id', -1).limit(limit)
            results = []
            for doc in cursor:
                doc['_id'] = str(doc['_id'])
                results.append(doc)
            return results
        except Exception as e:
            print(f"Error getting feedbacks: {e}")
            return []

    # ==========================
    # 📝 配置与Prompt
    # ==========================
    def get_prompt_template(self, mode: str):
        return self.prompt_templates_col.find_one({"mode": mode})

    def get_game_constants(self):
        try:
            data = self.config_col.find_one({"_id": "s15_rules"})
            if data: return data
            # 兜底
            return {
                "patch_version": "Unknown",
                "void_grubs_spawn": "Unknown",
                "patch_notes": "数据缺失，请运行 seed_data.py",
            }
        except Exception as e:
            return {}

    # ==========================
    # 💬 绝活社区
    # ==========================
    def get_tips_for_ui(self, hero, enemy, is_general):
        query = {"hero": hero}
        if is_general:
            query["enemy"] = "general"
        else:
            query["enemy"] = enemy
            
        tips = list(self.tips_col.find(query))
        for tip in tips:
            tip['id'] = str(tip['_id'])
            del tip['_id']
            if 'liked_by' not in tip: tip['liked_by'] = []
            
        tips.sort(key=lambda x: len(x.get('liked_by', [])), reverse=True)
        return tips

    def add_tip(self, hero, enemy, content, author_id, is_general):
        new_tip = {
            "hero": hero,
            "enemy": "general" if is_general else enemy,
            "content": content,
            "author_id": author_id,
            "liked_by": [],
            "created_at": datetime.datetime.utcnow()
        }
        self.tips_col.insert_one(new_tip)

    def toggle_like(self, tip_id, user_id):
        try:
            result = self.tips_col.update_one(
                {"_id": ObjectId(tip_id), "liked_by": {"$ne": user_id}}, 
                {"$push": {"liked_by": user_id}}
            )
            return result.modified_count > 0
        except:
            return False

    def get_tip_by_id(self, tip_id):
        try:
            tip = self.tips_col.find_one({"_id": ObjectId(tip_id)})
            if tip:
                tip['id'] = str(tip['_id'])
                del tip['_id']
            return tip
        except:
            return None

    def delete_tip(self, tip_id):
        try:
            self.tips_col.delete_one({"_id": ObjectId(tip_id)})
            return True
        except:
            return False

    # ==========================
    # 🧠 AI 辅助
    # ==========================
    def get_top_knowledge_for_ai(self, hero, enemy):
        gen_tips = self.get_tips_for_ui(hero, enemy, True)[:3]
        match_tips = self.get_tips_for_ui(hero, enemy, False)[:3]
        return {
            "general": [t['content'] for t in gen_tips],
            "matchup": [t['content'] for t in match_tips]
        }

    def get_corrections(self, hero, enemy):
        query = {
            "hero": hero,
            "$or": [{"enemy": enemy}, {"enemy": "general"}]
        }
        corrections = list(self.corrections_col.find(query))
        return [c['content'] for c in corrections]

    # ==========================
    # 📢 反馈系统
    # ==========================
    def submit_feedback(self, feedback_data):
        feedback_data['created_at'] = datetime.datetime.utcnow()
        feedback_data['status'] = 'pending' 
        self.feedback_col.insert_one(feedback_data)

    def get_champion_info(self, name_or_alias):
        # 模糊匹配英雄名
        champ = self.champions_col.find_one({"name": {"$regex":f"^{name_or_alias}$", "$options": "i"}})
        if champ: return champ
        # 别名匹配
        champ = self.champions_col.find_one({"alias": name_or_alias})
        if champ: return champ
        return None