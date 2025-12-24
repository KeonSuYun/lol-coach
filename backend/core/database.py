# backend/core/database.py

import os
import datetime
import time
from pymongo import MongoClient
from pymongo.errors import ServerSelectionTimeoutError, ConfigurationError # 引入新异常
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
            
            # 🟢 3. 智能数据库选择 (修复版)
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
            self.champions_col = self.db['champions'] # 确保加上这行

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
                # 格式通常是 mongodb://user:pass@host...
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
            # Prompt 模式唯一索引 (如 'bp_coach' 只能有一条)
            self.prompt_templates_col.create_index("mode", unique=True)
            print("✅ [Database] 索引检查完毕")
        except Exception as e:
            print(f"⚠️ [Database] 索引创建警告: {e}")

    def create_user(self, username, hashed_password, role="user"):
            """创建用户，默认为普通用户"""
            if self.db.users.find_one({"username": username}):
                return False
            
            user_doc = {
                "username": username,
                "password": hashed_password,
                "role": role,  # ✨ 强制写入角色字段
                "created_at": datetime.datetime.utcnow()
            }
            self.db.users.insert_one(user_doc)
            return True

    # ==========================
    # 👤 用户系统 (User Auth)
    # ==========================
    def create_user(self, username, password_hash):
        try:
            self.users_col.insert_one({
                "username": username,
                "password": password_hash,
                "role": "user",
                "created_at": datetime.datetime.utcnow()
            })
            return True
        except:
            return False # 触发唯一索引冲突
    # ==========================
    # 👤 管理员
    # ==========================
 
    def get_all_feedbacks(self, limit=50):
        """
        获取最新的反馈列表 (管理员专用)
        按 _id 倒序排列 (即时间倒序)
        """
        try:
            # 假设你的集合名是 'feedback' (取决于 submit_feedback 怎么写的)
            # 如果之前代码是 db.submit_feedback(...) 且没指定集合，请检查之前的 submit_feedback 实现
            # 通常我们在 submit_feedback 里写的是: self.db.feedback.insert_one(...)
            
            cursor = self.db.feedback.find().sort('_id', -1).limit(limit)
            
            results = []
            for doc in cursor:
                doc['_id'] = str(doc['_id']) # 将 ObjectId 转为字符串，否则 JSON 报错
                results.append(doc)
            return results
        except Exception as e:
            print(f"Error getting feedbacks: {e}")
            return []

    def get_user(self, username):
        return self.users_col.find_one({"username": username})

    # ==========================
    # 📝 Prompt 动态配置 (核心资产解耦)
    # ==========================
    def get_prompt_template(self, mode: str):
        """
        从数据库获取 Prompt 模板。
        如果在数据库找不到，返回 None，Server 层需要处理兜底逻辑。
        """
        return self.prompt_templates_col.find_one({"mode": mode})

    # ==========================
    # ⚙️ 基础配置 (S15 Config)
    # ==========================
    def get_game_constants(self):
        """从数据库获取 S15 游戏常量"""
        try:
            # 去 constants 集合查找 _id 为 s15_rules 的文档
            data = self.db.constants.find_one({"_id": "s15_rules"})
            
            if data:
                return data
            
            # 💡 兜底策略：如果数据库还没播种，返回一个默认值，防止报错
            print("⚠️ 警告: 数据库中未找到峡谷规则，使用默认空值")
            return {
                "patch_version": "Unknown",
                "void_grubs_spawn": "Unknown",
                "patch_notes": "数据缺失，请运行 seed_data.py",
                "jungle_xp_mechanic": "数据缺失",
                "jungle_routes_meta": "数据缺失"
            }
            
        except Exception as e:
            print(f"Error fetching constants: {e}")
            return {}

    # ==========================
    # 💬 绝活社区 & AI 知识库
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
    # 🧠 AI 接口
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
        champ = self.champions_col.find_one({"name": {"$regex":f"^{name_or_alias}$", "$options": "i"}})
        if champ: return champ
        champ = self.champions_col.find_one({"alias": name_or_alias})
        if champ: return champ
        return None