# keonsuyun/lol-coach/lol-coach-d0f75bde0672be53f3ae70724a64a8292b64aea6/backend/core/database.py

import os
import datetime
import time
import re
from pymongo import MongoClient
from pymongo.errors import ServerSelectionTimeoutError, ConfigurationError 
from bson.objectid import ObjectId

class KnowledgeBase:
    def __init__(self):
        # 🟢 1. 获取 URI (兼容 MONGO_URI 和 MONGO_URL)
        self.uri = os.getenv("MONGO_URI") or os.getenv("MONGO_URL") or "mongodb://localhost:27017"
        
        self._log_connection_attempt()

        try:
            self.client = MongoClient(self.uri, serverSelectionTimeoutMS=5000)
            
            # 🟢 2. 强制连通性检查
            self.client.admin.command('ping')
            
            # 🟢 3. 智能数据库选择
            try:
                self.db = self.client.get_default_database()
                print(f"✅ [Database] 使用 URI 指定的数据库: {self.db.name}")
            except (ConfigurationError, ValueError):
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
            self.otps_col = self.db['otps']
            self.orders_col = self.db['orders']

            # === 索引初始化 ===
            self._init_indexes()

        except ServerSelectionTimeoutError:
            print(f"❌ [Database] 连接超时! 请检查 MongoDB 服务。")
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
            # ✨ 增强索引：支持对位查询和社区混合排序 (真实玩家优先)
            self.tips_col.create_index([("hero", 1), ("enemy", 1)])
            self.tips_col.create_index([("is_fake", 1), ("liked_by", -1)]) 
            
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
    # 🔍 核心查询 (保留你原有的英雄名称模糊匹配逻辑)
    # ==========================
    def get_champion_info(self, name_or_id):
        """支持 LCU 传来的 CamelCase 匹配 (如 LeeSin -> Lee Sin)"""
        if not name_or_id: return None
        
        def split_camel_case(s):
            return re.sub(r'(?<!^)(?=[A-Z])', ' ', s)

        search_terms = set()
        search_terms.add(name_or_id)
        
        split_name = split_camel_case(name_or_id)
        if split_name != name_or_id: search_terms.add(split_name)
            
        no_space_name = name_or_id.replace(" ", "")
        search_terms.add(no_space_name)

        or_conditions = []
        for term in search_terms:
            or_conditions.append({"id": term})
            or_conditions.append({"name": term})
            or_conditions.append({"alias": term})
            
            safe_term = re.escape(term)
            pattern = f"^{safe_term}$"
            or_conditions.append({"id": {"$regex": pattern, "$options": "i"}})
            or_conditions.append({"name": {"$regex": pattern, "$options": "i"}})
            or_conditions.append({"alias": {"$regex": pattern, "$options": "i"}})

        return self.champions_col.find_one({"$or": or_conditions})

    # ==========================
    # ✨ 验证码管理
    # ==========================
    def save_otp(self, contact, code):
        """保存验证码，5分钟过期"""
        expire_time = datetime.datetime.utcnow() + datetime.timedelta(minutes=5)
        self.otps_col.update_one(
            {"contact": contact},
            {"$set": {"code": code, "expire_at": expire_time}}, 
            upsert=True
        )

    def validate_otp(self, contact, code):
        """验证并删除验证码"""
        record = self.otps_col.find_one({"contact": contact})
        if not record: return False 
        if record['code'] == code:
            self.otps_col.delete_one({"contact": contact})
            return True
        return False

    # ==========================
    # 💰 充值与会员系统 (完善累加逻辑)
    # ==========================
    def upgrade_user_role(self, username, days=30):
        """升级会员，支持在现有过期时间上累加"""
        now = datetime.datetime.utcnow()
        user = self.users_col.find_one({"username": username})
        if not user: return False

        current_expire = user.get("membership_expire")
        # 如果当前未过期，在过期时间基础上累加；否则从现在开始加
        base_time = current_expire if current_expire and current_expire > now else now
        new_expire = base_time + datetime.timedelta(days=days)

        self.users_col.update_one(
            {"username": username},
            {"$set": {"role": "pro", "membership_expire": new_expire, "is_pro": True}}
        )
        return True

    def process_afdian_order(self, order_no, username, amount, sku_detail):
        """处理爱发电订单"""
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
        """检查并自动清理过期会员"""
        user = self.users_col.find_one({"username": username})
        if not user: return "user"
        role = user.get("role", "user")
        if role in ["pro", "vip", "svip"]:
            expire_at = user.get("membership_expire")
            if not expire_at: return role
            if expire_at < datetime.datetime.utcnow():
                self.users_col.update_one({"username": username}, {"$set": {"role": "user"}})
                return "user"
            return role
        return role

    def get_user_usage_status(self, username):
        """获取用户当日分析额度"""
        current_role = self.check_membership_status(username)
        user = self.users_col.find_one({"username": username})
        if not user: return {}

        is_pro = current_role in ["vip", "svip", "admin", "pro"]
        today_str = datetime.datetime.utcnow().strftime("%Y-%m-%d")
        usage_data = user.get("usage_stats", {})
        
        r1_used = sum(usage_data.get("counts_reasoner", {}).values()) if usage_data.get("last_reset_date") == today_str else 0
        LIMIT = 10 
        return {
            "is_pro": is_pro, "role": current_role, "r1_limit": LIMIT, 
            "r1_used": r1_used, "r1_remaining": max(0, LIMIT - r1_used) if not is_pro else -1
        }

    def check_and_update_usage(self, username, mode, model_type="chat"):
            """检查冷却时间与额度限制"""
            current_role = self.check_membership_status(username)
            user = self.users_col.find_one({"username": username})
            if not user: return False, "用户不存在", 0

            is_pro = current_role in ["vip", "svip", "admin", "pro"]
            now = datetime.datetime.utcnow()
            today_str = now.strftime("%Y-%m-%d")
            usage_data = user.get("usage_stats", {})
            
            # 每日重置逻辑
            if usage_data.get("last_reset_date") != today_str:
                usage_data = {
                    "last_reset_date": today_str, "counts_chat": {}, "counts_reasoner": {}, "last_access": {},
                    "hourly_start": usage_data.get("hourly_start", now.isoformat()), "hourly_count": 0 
                }
            
            # 1. 小时频控 (符合游戏节奏)
            # 正常一局游戏20-30分钟，加上选人阶段，一小时很难超过10场。
            # 每小时：Pro 30次 / 普通 10次，足够正常使用，能防住恶意脚本。
            HOURLY_LIMIT = 30 if is_pro else 10
            
            hourly_start = datetime.datetime.fromisoformat(usage_data.get("hourly_start"))
            hourly_count = usage_data.get("hourly_count", 0)
            
            # 检查是否过了一小时，重置计数
            if (now - hourly_start).total_seconds() > 3600:
                hourly_start, hourly_count = now, 0
                
            if hourly_count >= HOURLY_LIMIT:
                # 统一返回 0，不提示升级，让用户以为是操作太快
                return False, f"操作过于频繁，请稍后重试 ({60 - int((now - hourly_start).total_seconds() / 60)}m)", 0

            # 2. 冷却时间 (CD)
            COOLDOWN = 5 if is_pro else 15
            last_time_str = usage_data.get("last_access", {}).get(mode)
            if last_time_str:
                delta = (now - datetime.datetime.fromisoformat(last_time_str)).total_seconds()
                if delta < COOLDOWN: return False, f"AI思考中，请稍后再试", int(COOLDOWN-delta)

            # 3. R1 深度思考额度检查 (R1 依然需要提示升级，因为成本高)
            if not is_pro and model_type == "reasoner" and sum(usage_data.get("counts_reasoner", {}).values()) >= 10:
                return False, "深度思考限额已满", -1

            # 4. 🟢 [修改] V3 模型 "无限使用" 承诺背后的安全锁
            if model_type == "chat":
                current_chat_usage = sum(usage_data.get("counts_chat", {}).values())
                
                # 设置安全阈值：Pro 100次 / 普通 50次
                # 50次大约对应 15-20 局游戏，正常人类不可能达到，触发即视为异常脚本
                security_limit = 100 if is_pro else 50
                
                if current_chat_usage >= security_limit:
                    # 🟢 关键点：返回 0。前端只会显示 msg，不会显示 "升级 Pro..."。
                    # 提示语话术：强调"安全限额"或"系统繁忙"，避免提及"会员额度"。
                    return False, "系统安全风控：今日调用次数异常 (Limit Reached)", 0

            # 5. 更新计数
            if model_type == "reasoner": usage_data["counts_reasoner"][mode] = usage_data["counts_reasoner"].get(mode, 0) + 1
            else: usage_data["counts_chat"][mode] = usage_data["counts_chat"].get(mode, 0) + 1
                
            usage_data["last_access"][mode] = now.isoformat()
            usage_data.update({"hourly_count": hourly_count + 1, "hourly_start": hourly_start.isoformat()})
            self.users_col.update_one({"username": username}, {"$set": {"usage_stats": usage_data}})
            return True, "OK", 0

    # ==========================
    # 🔥 绝活社区核心逻辑 (完善版)
    # ==========================
    def add_tip(self, hero, enemy, content, author_id, is_general, title=None, tags=None, is_fake=False):
        """发布攻略逻辑：支持标题、标签和马甲标记"""
        tip_doc = {
            "hero": hero,
            "enemy": "general" if is_general else enemy,
            "title": title or (content[:15] + "..." if len(content) > 15 else content),
            "content": content,
            "tags": tags or ["实战经验"],
            "author_id": author_id,
            "liked_by": [],
            "reward_granted": False, # 是否已发放10赞奖励
            "is_fake": is_fake,        # 区分真实玩家与马甲
            "is_polished": False,    # 是否经过 AI 自动装修
            "created_at": datetime.datetime.utcnow()
        }
        return self.tips_col.insert_one(tip_doc)

    def toggle_like(self, tip_id, user_id):
        """点赞逻辑：原子更新并包含10赞自动送3天Pro功能"""
        try:
            # 只有当用户不在点赞列表中时才添加 (原子操作)
            result = self.tips_col.find_one_and_update(
                {"_id": ObjectId(tip_id), "liked_by": {"$ne": user_id}},
                {"$push": {"liked_by": user_id}},
                return_document=True 
            )
            if not result: return False

            # 奖励检查：满10赞、未领过奖且非马甲
            likes_count = len(result.get('liked_by', []))
            if likes_count >= 10 and not result.get('reward_granted', False) and not result.get('is_fake', False):
                author = result.get('author_id')
                if self.upgrade_user_role(author, days=3): # 自动奖励 3 天 Pro
                    self.tips_col.update_one({"_id": ObjectId(tip_id)}, {"$set": {"reward_granted": True}})
            return True
        except: return False

    def get_mixed_tips(self, hero, enemy, limit=10):
        """混合流查询：真实玩家优先(is_fake=False)，对位优先"""
        # 1. 获取对位技巧 (Matchup)
        matchup_tips = list(self.tips_col.find({"hero": hero, "enemy": enemy}).sort([
            ("is_fake", 1), # 0 (False) 排在 1 (True) 前面
            ("liked_by", -1)
        ]).limit(limit))
        for t in matchup_tips: t['tag_label'] = "🔥 对位绝活"

        # 2. 如果数据不足，补充通用技巧 (General)
        if len(matchup_tips) < limit:
            needed = limit - len(matchup_tips)
            general_tips = list(self.tips_col.find({"hero": hero, "enemy": "general"}).sort([
                ("is_fake", 1), 
                ("liked_by", -1)
            ]).limit(needed))
            for t in general_tips: t['tag_label'] = "📚 英雄必修"
            matchup_tips.extend(general_tips)

        # 3. 格式化返回
        final_list = []
        for t in matchup_tips:
            final_list.append({
                "id": str(t['_id']),
                "title": t.get("title", "英雄技巧"),
                "content": t["content"],
                "author": t["author_id"],
                "likes": len(t.get("liked_by", [])),
                "tags": t.get("tags", []),
                "tag_label": t["tag_label"],
                "is_pro_author": self.check_membership_status(t["author_id"]) != "user"
            })
        return final_list

    def get_tips_for_ui(self, hero, enemy, is_general):
        """保留原有接口名称，内部切换到增强逻辑"""
        return self.get_mixed_tips(hero, "general" if is_general else enemy)

    # ==========================
    # 🤖 AI 知识检索与维护
    # ==========================
    def get_top_knowledge_for_ai(self, hero, enemy):
        """为 AI 提供最相关的背景知识"""
        tips = self.get_mixed_tips(hero, enemy, limit=6)
        return {
            "general": [t['content'] for t in tips if t['tag_label'] == "📚 英雄必修"],
            "matchup": [t['content'] for t in tips if t['tag_label'] == "🔥 对位绝活"]
        }

    def get_corrections(self, my_hero, enemy_hero):
        """
        获取修正数据，并按优先级排序 (Priority High -> Low)
        """
        if self.corrections_col is None:
            return []
            
        # 1. 查询匹配的条目 (双向匹配已经在 seed_data 处理过了，这里直接查即可)
        query = {
            "hero": {"$in": [my_hero, "general", "General"]},
            "enemy": {"$in": [enemy_hero, "general", "General"]}
        }
        
        try:
            results = list(self.corrections_col.find(query))
            
            # 2. 🔥 核心修改：按 priority 字段倒序排列 (100 -> 0)
            # 如果没有 priority 字段，默认给 50
            results.sort(key=lambda x: x.get('priority', 50), reverse=True)
            
            # 3. 提取内容返回
            return [r['content'] for r in results]
            
        except Exception as e:
            print(f"Error fetching corrections: {e}")
            return []

    def create_user(self, username, hashed_password, role="user", email=None, device_id=None, ip=None):
        """创建用户并执行多重限制检查"""
        try:
            if self.users_col.find_one({"username": username}): return "USERNAME_TAKEN"
            if email and self.users_col.find_one({"email": email}): return "EMAIL_TAKEN"
            if device_id and device_id != "unknown_client_error" and self.users_col.count_documents({"device_id": device_id}) >= 3: return "DEVICE_LIMIT"
            if ip and self.users_col.count_documents({"ip": ip, "created_at": {"$gte": datetime.datetime.utcnow() - datetime.timedelta(days=1)}}) >= 5: return "IP_LIMIT"

            self.users_col.insert_one({
                "username": username, "password": hashed_password, "role": role,
                "email": email, "device_id": device_id, "ip": ip, "created_at": datetime.datetime.utcnow()
            })
            return True
        except: return False 

    def get_user(self, username): return self.users_col.find_one({"username": username})
    def get_all_feedbacks(self, limit=50): return [dict(doc, _id=str(doc['_id'])) for doc in self.feedback_col.find().sort('_id', -1).limit(limit)]
    def get_prompt_template(self, mode: str): return self.prompt_templates_col.find_one({"mode": mode})
    def get_game_constants(self): return self.config_col.find_one({"_id": "s15_rules"}) or {"patch_version": "Unknown"}
    def delete_tip(self, tip_id):
        try: return self.tips_col.delete_one({"_id": ObjectId(tip_id)}).deleted_count > 0
        except: return False
    def get_tip_by_id(self, tip_id):
        try:
            tip = self.tips_col.find_one({"_id": ObjectId(tip_id)})
            return dict(tip, id=str(tip['_id']), _id=None) if tip else None
        except: return None
    def submit_feedback(self, data):
        data.update({'created_at': datetime.datetime.utcnow(), 'status': 'pending'})
        self.feedback_col.insert_one(data)

    # ==========================
    # 👮 管理员功能 (保留所有更名、删除逻辑)
    # ==========================
    def get_all_users(self, limit=20, search=""):
        """获取用户列表"""
        query = {"username": {"$regex": search, "$options": "i"}} if search else {}
        users = list(self.users_col.find(query, {"password": 0, "usage_stats": 0}).sort("created_at", -1).limit(limit))
        for u in users:
            u["_id"] = str(u["_id"])
            if u.get("created_at"): u["created_at"] = u["created_at"].isoformat()
            if u.get("membership_expire"): u["membership_expire"] = u["membership_expire"].isoformat()
        return users

    def admin_update_user(self, username, action, value):
        """管理员手动修改、重命名或删除"""
        user = self.users_col.find_one({"username": username})
        if not user: return False, "用户不存在"

        if action == "add_days":
            try: return self.upgrade_user_role(username, int(value)), "充值成功"
            except: return False, "天数错误"
        elif action == "set_role":
            self.users_col.update_one({"username": username}, {"$set": {"role": value}})
            return True, f"角色设为 {value}"
        elif action == "rename":
            new_name = value.strip()
            if not new_name or self.users_col.find_one({"username": new_name}): return False, "无效或已占用"
            self.users_col.update_one({"username": username}, {"$set": {"username": new_name}})
            self.tips_col.update_many({"author_id": username}, {"$set": {"author_id": new_name}})
            self.orders_col.update_many({"username": username}, {"$set": {"username": new_name}})
            return True, f"更名成功"
        elif action == "delete":
            self.users_col.delete_one({"username": username})
            return True, "用户已删除"
        return False, "未知操作"