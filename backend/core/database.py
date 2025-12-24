import os
import datetime
from pymongo import MongoClient
from bson.objectid import ObjectId

class KnowledgeBase:
    def __init__(self):
        # 🟢 自动连接 MongoDB
        self.uri = os.getenv("MONGO_URI", "mongodb://localhost:27017")
        try:
            self.client = MongoClient(self.uri, serverSelectionTimeoutMS=5000)
            self.db = self.client['lol_community']
            
            # === 集合定义 ===
            self.tips_col = self.db['tips']
            self.feedback_col = self.db['feedback']       # 存用户报错
            self.config_col = self.db['config']           # 存 S15 赛季数据
            self.corrections_col = self.db['corrections'] # 存管理员确认的真理
            self.users_col = self.db['users']             # 存用户信息
            self.tips_col.create_index([("hero", 1), ("enemy", 1)])
            self.corrections_col.create_index([("hero", 1), ("enemy", 1)])
            print(f"✅ 成功连接到数据库: {self.db.name}")
        except Exception as e:
            print(f"❌ 数据库连接失败: {e}")

    # ==========================
    # 👤 用户系统 (User Auth)
    # ==========================
    def create_user(self, username, password_hash):
        """创建新用户，防止重名"""
        if self.users_col.find_one({"username": username}):
            return False # 用户名已存在
        
        self.users_col.insert_one({
            "username": username,
            "password": password_hash,
            "role": "user", # 默认为普通用户，'admin' 需手动改库
            "created_at": datetime.datetime.utcnow()
        })
        return True
    
    def get_prompt_template(self, mode: str):
    
        return self.db.prompt_templates.find_one({"mode": mode})
    
    def get_user(self, username):
        """获取用户信息 (用于登录校验)"""
        return self.users_col.find_one({"username": username})

    # ==========================
    # ⚙️ 基础配置 (S15 Config)
    # ==========================
    def get_game_constants(self):
        """获取赛季固定参数，支持热更新"""
        config = self.config_col.find_one({"type": "s15_constants"})
        if config:
            return config.get('data', {})
        
        # 兜底默认值 (防止数据库为空时报错)
        return {
            "void_grubs_spawn": "6:00",
            "void_grubs_count": "3 (每波)",
            "atakhan_spawn": "20:00",
            "patch_notes": "S15赛季: 虚空巢虫提供推塔真实伤害，Atakhan 会根据优势方自动在中路或下路生成。"
        }

    # ==========================
    # 💬 绝活社区 (Tips)
    # ==========================
    def get_tips_for_ui(self, hero, enemy, is_general):
        """前端展示用：按点赞倒序"""
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
            
        # 按点赞数倒序
        tips.sort(key=lambda x: len(x.get('liked_by', [])), reverse=True)
        return tips

    def add_tip(self, hero, enemy, content, author_id, is_general):
        """发布绝活"""
        new_tip = {
            "hero": hero,
            "enemy": "general" if is_general else enemy,
            "content": content,
            "author_id": author_id, # 这里存 username
            "liked_by": [],
            "created_at": datetime.datetime.utcnow()
        }
        self.tips_col.insert_one(new_tip)

    def toggle_like(self, tip_id, user_id):
        """点赞 (原子操作)"""
        try:
            result = self.tips_col.update_one(
                {"_id": ObjectId(tip_id), "liked_by": {"$ne": user_id}}, 
                {"$push": {"liked_by": user_id}}
            )
            return result.modified_count > 0
        except:
            return False

    def get_tip_by_id(self, tip_id):
        """获取单条评论 (用于删除时的权限验证)"""
        try:
            tip = self.tips_col.find_one({"_id": ObjectId(tip_id)})
            if tip:
                tip['id'] = str(tip['_id'])
                del tip['_id']
            return tip
        except:
            return None

    def delete_tip(self, tip_id):
        """物理删除评论"""
        try:
            self.tips_col.delete_one({"_id": ObjectId(tip_id)})
            return True
        except:
            return False

    # ==========================
    # 🧠 AI 专用接口 (Core Logic)
    # ==========================
    def get_top_knowledge_for_ai(self, hero, enemy):
        """获取普通社区建议 (参考级，各取前3)"""
        gen_tips = self.get_tips_for_ui(hero, enemy, True)[:3]
        match_tips = self.get_tips_for_ui(hero, enemy, False)[:3]
        return {
            "general": [t['content'] for t in gen_tips],
            "matchup": [t['content'] for t in match_tips]
        }

    def get_corrections(self, hero, enemy):
        """获取管理员审核通过的修正信息 (最高优先级 RAG)"""
        query = {
            "hero": hero,
            "$or": [{"enemy": enemy}, {"enemy": "general"}]
        }
        corrections = list(self.corrections_col.find(query))
        return [c['content'] for c in corrections]

    # ==========================
    # 📢 反馈系统 (Feedback)
    # ==========================
    def submit_feedback(self, feedback_data):
        """用户提交反馈 -> 进入待审核队列"""
        feedback_data['created_at'] = datetime.datetime.utcnow()
        feedback_data['status'] = 'pending' 
        self.feedback_col.insert_one(feedback_data)