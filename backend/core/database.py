import os
import datetime
import time
import re
from pymongo import MongoClient
from pymongo.errors import ServerSelectionTimeoutError, ConfigurationError 
from bson.objectid import ObjectId

class KnowledgeBase:
    def __init__(self):
        # 🟢 1. 获取 URI (修复：兼容 MONGO_URI 和 MONGO_URL)
        self.uri = os.getenv("MONGO_URI") or os.getenv("MONGO_URL") or "mongodb://localhost:27017"
        
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
            
            # ✨ 验证码与订单
            self.otps_col = self.db['otps']
            self.orders_col = self.db['orders']
            

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
            self.tips_col.create_index([("hero", 1), ("enemy", 1)])
            self.corrections_col.create_index([("hero", 1), ("enemy", 1)])
            self.users_col.create_index("username", unique=True)
            self.prompt_templates_col.create_index("mode", unique=True)
            self.users_col.create_index("device_id")
            self.users_col.create_index("ip")
            self.otps_col.create_index("expire_at", expireAfterSeconds=0)
            self.orders_col.create_index("order_no", unique=True)

            
            print("✅ [Database] 索引检查完毕")
        except Exception as e:
            print(f"⚠️ [Database] 索引创建警告: {e}")

    # ==========================
    # 🔍 核心查询 (超级增强版)
    # ==========================
    def get_champion_info(self, name_or_id):
        if not name_or_id: return None
        
        # 辅助函数：尝试将 CamelCase 拆分为空格 (LeeSin -> Lee Sin)
        def split_camel_case(s):
            return re.sub(r'(?<!^)(?=[A-Z])', ' ', s)

        search_terms = set()
        search_terms.add(name_or_id) # 原始: "LeeSin"
        
        # 1. 尝试拆分驼峰命名 (针对 LCU 传来的数据)
        split_name = split_camel_case(name_or_id)
        if split_name != name_or_id:
            search_terms.add(split_name) # 添加: "Lee Sin"
            
        # 2. 尝试移除所有空格 (针对数据库有空格，输入无空格)
        no_space_name = name_or_id.replace(" ", "")
        search_terms.add(no_space_name) # 添加: "LeeSin"

        # 构造多重查询条件
        # 只要 id, name, 或 alias 匹配上述任何一种形式即可
        or_conditions = []
        for term in search_terms:
            # 精确匹配 (最快)
            or_conditions.append({"id": term})
            or_conditions.append({"name": term})
            or_conditions.append({"alias": term})
            
            # 正则忽略大小写匹配
            safe_term = re.escape(term)
            pattern = f"^{safe_term}$"
            or_conditions.append({"id": {"$regex": pattern, "$options": "i"}})
            or_conditions.append({"name": {"$regex": pattern, "$options": "i"}})
            or_conditions.append({"alias": {"$regex": pattern, "$options": "i"}})

        # 执行查询
        query = {"$or": or_conditions}
        champ = self.champions_col.find_one(query)
        
        if champ:
            return champ
        
        # print(f"⚠️ [DB Debug] 未找到英雄: {name_or_id}, 尝试过的关键词: {search_terms}")
        return None

    # ==========================
    # ✨ 验证码管理
    # ==========================
    def save_otp(self, contact, code):
        expire_time = datetime.datetime.utcnow() + datetime.timedelta(minutes=5)
        self.otps_col.update_one(
            {"contact": contact},
            {"$set": {"code": code, "expire_at": expire_time}}, 
            upsert=True
        )

    def validate_otp(self, contact, code):
        record = self.otps_col.find_one({"contact": contact})
        if not record: return False 
        if record['code'] == code:
            self.otps_col.delete_one({"contact": contact})
            return True
        return False

    # ==========================
    # 💰 充值与会员系统
    # ==========================
    def upgrade_user_role(self, username, days=30):
        now = datetime.datetime.utcnow()
        user = self.users_col.find_one({"username": username})
        if not user: return False

        current_expire = user.get("membership_expire")
        if current_expire and current_expire > now:
            new_expire = current_expire + datetime.timedelta(days=days)
        else:
            new_expire = now + datetime.timedelta(days=days)

        self.users_col.update_one(
            {"username": username},
            {"$set": {"role": "pro", "membership_expire": new_expire}}
        )
        return True

    def process_afdian_order(self, order_no, username, amount, sku_detail):
        if self.orders_col.find_one({"order_no": order_no}): return True
        user = self.users_col.find_one({"username": username})
        if not user: return False

        amount_float = float(amount)
        days_to_add = 0
        if amount_float >= 19.90: days_to_add = 30
        elif amount_float >= 6.90: days_to_add = 7
        else: days_to_add = int(amount_float * 0.5)

        if days_to_add < 1: return False

        if self.upgrade_user_role(username, days=days_to_add):
            self.orders_col.insert_one({
                "order_no": order_no, "username": username, "amount": amount,
                "days_added": days_to_add, "sku": sku_detail,
                "created_at": datetime.datetime.utcnow()
            })
            return True
        return False

    def check_membership_status(self, username):
        user = self.users_col.find_one({"username": username})
        if not user: return "user"
        if user.get("role") in ["pro", "vip", "svip"]:
            expire_at = user.get("membership_expire")
            if not expire_at: return user.get("role")
            if expire_at < datetime.datetime.utcnow():
                self.users_col.update_one({"username": username}, {"$set": {"role": "user"}})
                return "user"
            return user.get("role")
        return user.get("role", "user")

    def get_user_usage_status(self, username):
        current_role = self.check_membership_status(username)
        user = self.users_col.find_one({"username": username})
        if not user: return {}

        is_pro = current_role in ["vip", "svip", "admin", "pro"]
        now = datetime.datetime.utcnow()
        today_str = now.strftime("%Y-%m-%d")
        usage_data = user.get("usage_stats", {})
        
        r1_used = 0
        if usage_data.get("last_reset_date") == today_str:
             counts_reasoner = usage_data.get("counts_reasoner", {})
             r1_used = sum(counts_reasoner.values())

        LIMIT = 10 
        return {
            "is_pro": is_pro,
            "role": current_role,
            "r1_limit": LIMIT, 
            "r1_used": r1_used,
            "r1_remaining": max(0, LIMIT - r1_used) if not is_pro else -1
        }

    def check_and_update_usage(self, username, mode, model_type="chat"):
        current_role = self.check_membership_status(username)
        user = self.users_col.find_one({"username": username})
        if not user: return False, "用户不存在", 0

        is_pro = current_role in ["vip", "svip", "admin", "pro"]
        now = datetime.datetime.utcnow()
        today_str = now.strftime("%Y-%m-%d")
        usage_data = user.get("usage_stats", {})
        
        if usage_data.get("last_reset_date") != today_str:
            usage_data = {
                "last_reset_date": today_str, "counts_chat": {}, "counts_reasoner": {}, "last_access": {},
                "hourly_start": usage_data.get("hourly_start"), "hourly_count": 0 
            }
        
        counts_chat = usage_data.get("counts_chat", {})
        counts_reasoner = usage_data.get("counts_reasoner", {})
        last_access = usage_data.get("last_access", {})

        HOURLY_LIMIT = 100 if is_pro else 20
        hourly_start_str = usage_data.get("hourly_start")
        hourly_count = usage_data.get("hourly_count", 0)
        
        if not hourly_start_str:
            hourly_start = now
            hourly_count = 0
        else:
            hourly_start = datetime.datetime.fromisoformat(hourly_start_str)
            if (now - hourly_start).total_seconds() > 3600:
                hourly_start = now
                hourly_count = 0
        
        if hourly_count >= HOURLY_LIMIT:
            return False, f"请求频繁 ({60 - int((now - hourly_start).total_seconds() / 60)}m)", -1

        COOLDOWN_SECONDS = 5 if is_pro else 15
        last_time_str = last_access.get(mode)
        if last_time_str:
            delta = (now - datetime.datetime.fromisoformat(last_time_str)).total_seconds()
            if delta < COOLDOWN_SECONDS:
                return False, f"冷却中 ({int(COOLDOWN_SECONDS-delta)}s)", int(COOLDOWN_SECONDS-delta)

        if not is_pro and model_type == "reasoner":
            if sum(counts_reasoner.values()) >= 10:
                return False, "深度思考限额已满", -1

        if model_type == "reasoner": counts_reasoner[mode] = counts_reasoner.get(mode, 0) + 1
        else: counts_chat[mode] = counts_chat.get(mode, 0) + 1
            
        last_access[mode] = now.isoformat()
        usage_data.update({"counts_chat": counts_chat, "counts_reasoner": counts_reasoner, "last_access": last_access, "hourly_count": hourly_count + 1, "hourly_start": hourly_start.isoformat()})

        self.users_col.update_one({"username": username}, {"$set": {"usage_stats": usage_data}})
        return True, "OK", 0

    def create_user(self, username, hashed_password, role="user", email=None, device_id=None, ip=None):
        try:
            if self.users_col.find_one({"username": username}): return "USERNAME_TAKEN"
            if email and self.users_col.find_one({"email": email}): return "EMAIL_TAKEN"
            if device_id and device_id != "unknown_client_error":
                if self.users_col.count_documents({"device_id": device_id}) >= 3: return "DEVICE_LIMIT"
            if ip:
                yesterday = datetime.datetime.utcnow() - datetime.timedelta(days=1)
                if self.users_col.count_documents({"ip": ip, "created_at": {"$gte": yesterday}}) >= 5: return "IP_LIMIT"

            self.users_col.insert_one({
                "username": username, "password": hashed_password, "role": role,
                "email": email, "device_id": device_id, "ip": ip, "created_at": datetime.datetime.utcnow()
            })
            return True
        except Exception: return False 

    def get_user(self, username):
        return self.users_col.find_one({"username": username})

    # ==========================
    # 其他功能
    # ==========================
    def get_all_feedbacks(self, limit=50):
        return [dict(doc, _id=str(doc['_id'])) for doc in self.feedback_col.find().sort('_id', -1).limit(limit)]

    def get_prompt_template(self, mode: str):
        return self.prompt_templates_col.find_one({"mode": mode})

    def get_game_constants(self):
        data = self.config_col.find_one({"_id": "s15_rules"})
        return data if data else {"patch_version": "Unknown", "patch_notes": "数据缺失"}

    def get_tips_for_ui(self, hero, enemy, is_general):
        query = {"hero": hero, "enemy": "general" if is_general else enemy}
        tips = [dict(t, id=str(t['_id']), _id=None) for t in self.tips_col.find(query)]
        tips.sort(key=lambda x: len(x.get('liked_by', [])), reverse=True)
        return tips

    def add_tip(self, hero, enemy, content, author_id, is_general):
        self.tips_col.insert_one({
            "hero": hero, "enemy": "general" if is_general else enemy,
            "content": content, "author_id": author_id, "liked_by": [], "created_at": datetime.datetime.utcnow()
        })

    def toggle_like(self, tip_id, user_id):
        try:
            return self.tips_col.update_one({"_id": ObjectId(tip_id), "liked_by": {"$ne": user_id}}, {"$push": {"liked_by": user_id}}).modified_count > 0
        except: return False

    def get_tip_by_id(self, tip_id):
        try:
            tip = self.tips_col.find_one({"_id": ObjectId(tip_id)})
            return dict(tip, id=str(tip['_id']), _id=None) if tip else None
        except: return None

    def delete_tip(self, tip_id):
        try: return self.tips_col.delete_one({"_id": ObjectId(tip_id)}).deleted_count > 0
        except: return False

    def submit_feedback(self, feedback_data):
        feedback_data.update({'created_at': datetime.datetime.utcnow(), 'status': 'pending'})
        self.feedback_col.insert_one(feedback_data)

    def get_top_knowledge_for_ai(self, hero, enemy):
        gen_tips = self.get_tips_for_ui(hero, enemy, True)[:3]
        match_tips = self.get_tips_for_ui(hero, enemy, False)[:3]
        return {
            "general": [t['content'] for t in gen_tips],
            "matchup": [t['content'] for t in match_tips]
        }

    def get_corrections(self, hero, enemy):
        query = {"hero": hero, "$or": [{"enemy": enemy}, {"enemy": "general"}]}
        return [c['content'] for c in self.corrections_col.find(query)]

    # ==========================
    # 👮 管理员功能 (新增)
    # ==========================
    def get_all_users(self, limit=20, search=""):
        """获取用户列表，支持按用户名搜索"""
        query = {}
        if search:
            query = {"username": {"$regex": search, "$options": "i"}}
        
        # 为了安全，不要返回密码 hash
        projection = {"password": 0, "usage_stats": 0} 
        
        users = list(self.users_col.find(query, projection).sort("created_at", -1).limit(limit))
        
        # 处理 ObjectId 和 datetime 转字符串
        results = []
        for u in users:
            u["_id"] = str(u["_id"])
            if u.get("created_at"):
                u["created_at"] = u["created_at"].isoformat()
            if u.get("membership_expire"):
                u["membership_expire"] = u["membership_expire"].isoformat()
            results.append(u)
        return results

    def admin_update_user(self, username, action, value):
        """管理员手动修改用户"""
        user = self.users_col.find_one({"username": username})
        if not user: return False, "用户不存在"

        if action == "add_days":
            # 补单/加时长
            try:
                days = int(value)
                return self.upgrade_user_role(username, days), "充值成功"
            except:
                return False, "天数格式错误"
        
        elif action == "set_role":
            # 修改角色 (比如设为 admin, banned, vip)
            self.users_col.update_one({"username": username}, {"$set": {"role": value}})
            return True, f"角色已更新为 {value}"
            
        return False, "未知操作"