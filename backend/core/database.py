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
            
            # ✨ 新增：验证码专用集合
            self.otps_col = self.db['otps']
            # ✨ 新增：订单集合
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
            # 绝活查询索引
            self.tips_col.create_index([("hero", 1), ("enemy", 1)])
            # 修正规则索引
            self.corrections_col.create_index([("hero", 1), ("enemy", 1)])
            # 用户名唯一索引
            self.users_col.create_index("username", unique=True)
            # Prompt 模式唯一索引
            self.prompt_templates_col.create_index("mode", unique=True)
            
            # 🛡️ 安全相关索引
            self.users_col.create_index("device_id")
            self.users_col.create_index("ip")
            
            # ✨ OTP 验证码 5分钟自动过期 (TTL索引)
            self.otps_col.create_index("expire_at", expireAfterSeconds=0)

            # ✨ 订单号唯一索引
            self.orders_col.create_index("order_no", unique=True)
            
            print("✅ [Database] 索引检查完毕")
        except Exception as e:
            print(f"⚠️ [Database] 索引创建警告: {e}")

    # ==========================
    # ✨ 验证码管理 (持久化版)
    # ==========================
    def save_otp(self, contact, code):
        """
        保存验证码到数据库，5分钟后自动过期。
        contact: 邮箱或手机号
        code: 验证码字符串
        """
        # 设置过期时间为当前UTC时间 + 5分钟
        expire_time = datetime.datetime.utcnow() + datetime.timedelta(minutes=5)
        
        self.otps_col.update_one(
            {"contact": contact}, # 查找条件
            {"$set": {
                "code": code, 
                "expire_at": expire_time
            }}, 
            upsert=True # 如果不存在就插入，存在就更新
        )

    def validate_otp(self, contact, code):
        """
        校验验证码。
        如果校验成功，立即删除该记录防止重放攻击。
        """
        record = self.otps_col.find_one({"contact": contact})
        
        # 1. 没找到记录 (可能是从未发送，或已过期被TTL删除了)
        if not record:
            return False 
        
        # 2. 校验代码是否匹配
        if record['code'] == code:
            # 验证成功，删除验证码 (一次性使用)
            self.otps_col.delete_one({"contact": contact})
            return True
            
        return False

    # ==========================
    # 💰 充值与会员系统 (含爱发电)
    # ==========================
    def upgrade_user_role(self, username, days=30):
        """
        充值成功后调用：升级用户为 Pro 并设置过期时间
        """
        now = datetime.datetime.utcnow()
        user = self.users_col.find_one({"username": username})
        if not user: return False

        # 计算新的过期时间
        current_expire = user.get("membership_expire")
        
        if current_expire and current_expire > now:
            new_expire = current_expire + datetime.timedelta(days=days)
        else:
            new_expire = now + datetime.timedelta(days=days)

        self.users_col.update_one(
            {"username": username},
            {"$set": {
                "role": "pro",  # 设置为 pro 角色
                "membership_expire": new_expire
            }}
        )
        print(f"💰 用户 {username} 已充值，有效期至 {new_expire}")
        return True

    def process_afdian_order(self, order_no, username, amount, sku_detail):
        """
        处理爱发电订单：防重、记录、升级
        """
        # 1. 幂等性检查：如果订单号已存在，直接返回成功，防止重复加时间
        if self.orders_col.find_one({"order_no": order_no}):
            print(f"⚠️ 订单 {order_no} 已处理过，跳过。")
            return True

        # 2. 检查用户是否存在
        user = self.users_col.find_one({"username": username})
        if not user:
            print(f"❌ 充值失败：找不到用户 {username} (订单: {order_no})")
            return False

        # 3. 计算权益时长 (🔴 适配新价格 6.99 和 19.99)
        days_to_add = 0
        amount_float = float(amount)
        
        # 容错处理：设置比定价稍低的阈值
        if amount_float >= 19.90:  # 月卡 (定价 19.99)
            days_to_add = 30
        elif amount_float >= 6.90: # 周卡 (定价 6.99)
            days_to_add = 7
        else:
            # 小额打赏兜底：假设 1元=0.5天
            days_to_add = int(amount_float * 0.5)

        if days_to_add < 1:
            print(f"⚠️ 金额 {amount} 不足以为 {username} 兑换会员")
            return False

        # 4. 执行升级
        try:
            success = self.upgrade_user_role(username, days=days_to_add)
            if success:
                # 5. 记录订单 (关键：防止重复处理)
                self.orders_col.insert_one({
                    "order_no": order_no,
                    "username": username,
                    "amount": amount,
                    "days_added": days_to_add,
                    "sku": sku_detail,
                    "created_at": datetime.datetime.utcnow()
                })
                print(f"✅ 爱发电订单处理成功：用户 {username} +{days_to_add}天")
                return True
        except Exception as e:
            print(f"❌ 订单处理异常: {e}")
            return False

    def check_membership_status(self, username):
        """
        检查会员是否过期，如果过期自动降级。
        此方法会在 check_and_update_usage 中被调用，确保每次使用前状态是最新的。
        """
        user = self.users_col.find_one({"username": username})
        if not user: return "user"

        # 如果是付费角色
        if user.get("role") in ["pro", "vip", "svip"]:
            expire_at = user.get("membership_expire")
            
            # 如果没有过期时间（可能是永久会员），直接返回角色
            if not expire_at:
                return user.get("role")
                
            # 检查是否已过期
            if expire_at < datetime.datetime.utcnow():
                print(f"📉 用户 {username} 会员已过期，自动降级为普通用户")
                self.users_col.update_one(
                    {"username": username},
                    {"$set": {"role": "user"}}
                )
                return "user"
            
            # 未过期
            return user.get("role")
            
        # 默认是普通用户或管理员(admin)
        return user.get("role", "user")

    # ==========================
    # 📊 状态查询 (新功能)
    # ==========================
    def get_user_usage_status(self, username):
        """
        获取用户当前的资源使用状态，用于前端显示剩余次数
        """
        # 1. 刷新状态
        current_role = self.check_membership_status(username)
        user = self.users_col.find_one({"username": username})
        if not user: return {}

        is_pro = current_role in ["vip", "svip", "admin", "pro"]
        
        # 2. 计算使用量
        now = datetime.datetime.utcnow()
        today_str = now.strftime("%Y-%m-%d")
        usage_data = user.get("usage_stats", {})
        
        # 如果是新的一天，视为 0
        if usage_data.get("last_reset_date") != today_str:
             r1_used = 0
        else:
             # 计算所有模式的 R1 使用总和
             counts_reasoner = usage_data.get("counts_reasoner", {})
             r1_used = sum(counts_reasoner.values())

        # ✨ 修改：R1 每日上限改为 10 次
        LIMIT = 10 
        return {
            "is_pro": is_pro,
            "role": current_role,
            "r1_limit": LIMIT, 
            "r1_used": r1_used,
            "r1_remaining": max(0, LIMIT - r1_used) if not is_pro else -1 # -1 代表无限
        }

    # ==========================
    # ⏱️ 核心频控系统 (Hard Limit + Tiered)
    # ==========================
    def check_and_update_usage(self, username, mode, model_type="chat"):
        """
        检查并更新用户的使用次数和冷却时间。
        model_type: 'chat' (普通/V3) 或 'reasoner' (深度思考/R1)
        
        特性：
        1. 自动处理会员过期
        2. Pro/Admin 无限次数 (受每小时硬上限限制)
        3. 普通用户:
           - reasoner: 10次/天 (所有模式共享)
           - chat: 无限次 (受每小时硬上限限制)
        4. 防抖: 普通用户 15s CD，Pro 用户 5s CD
        5. 防刷: 每小时请求硬上限
        """
        # 1. 先检查并更新会员状态
        current_role = self.check_membership_status(username)
        user = self.users_col.find_one({"username": username})
        if not user: return False, "用户不存在", 0

        is_pro = current_role in ["vip", "svip", "admin", "pro"]

        # 2. 获取当前使用统计
        now = datetime.datetime.utcnow()
        today_str = now.strftime("%Y-%m-%d")
        
        usage_data = user.get("usage_stats", {})
        
        # 3. 每日重置逻辑
        if usage_data.get("last_reset_date") != today_str:
            usage_data = {
                "last_reset_date": today_str,
                "counts_chat": {},     # 普通模型计数
                "counts_reasoner": {}, # 思考模型计数
                "last_access": {},
                # 保留小时限制相关数据，因为小时窗可能跨天
                "hourly_start": usage_data.get("hourly_start"),
                "hourly_count": 0 
            }
        
        counts_chat = usage_data.get("counts_chat", {})
        counts_reasoner = usage_data.get("counts_reasoner", {})
        last_access = usage_data.get("last_access", {})

        # === 4. 🚨 每小时硬上限 (防刷第一道防线) ===
        # 逻辑：即使是 Pro，也不允许 1秒请求100次。
        # 设定：普通用户 20次/小时，Pro 用户 100次/小时
        HOURLY_LIMIT = 100 if is_pro else 20
        
        hourly_start_str = usage_data.get("hourly_start")
        hourly_count = usage_data.get("hourly_count", 0)
        
        if not hourly_start_str:
            hourly_start = now
            hourly_count = 0
        else:
            hourly_start = datetime.datetime.fromisoformat(hourly_start_str)
            # 如果窗口超过 1 小时，重置
            if (now - hourly_start).total_seconds() > 3600:
                hourly_start = now
                hourly_count = 0
        
        if hourly_count >= HOURLY_LIMIT:
            wait_min = 60 - int((now - hourly_start).total_seconds() / 60)
            return False, f"请求过于频繁，请休息一下 ({wait_min}分钟后恢复)", -1

        # === 5. 冷却时间 (防抖) ===
        # 普通用户 15秒，Pro用户 5秒 (防止脚本刷接口)
        COOLDOWN_SECONDS = 5 if is_pro else 15
        
        last_time_str = last_access.get(mode)
        if last_time_str:
            last_time = datetime.datetime.fromisoformat(last_time_str)
            delta = (now - last_time).total_seconds()
            if delta < COOLDOWN_SECONDS:
                wait_time = int(COOLDOWN_SECONDS - delta)
                return False, f"技能冷却中 ({wait_time}s)", wait_time

        # === 6. 每日次数限制 (分模型) ===
        if not is_pro:
            # 普通用户限制逻辑
            if model_type == "reasoner":
                # ✨ 修改：R1 模型统计所有模式的总和
                total_r1_used = sum(counts_reasoner.values())
                # ✨ 修改：R1 每日限额改为 10 次
                limit = 10
                if total_r1_used >= limit:
                    return False, f"深度思考(R1) 每日限额已用完 ({limit}次/日)，请升级 Pro 解锁", -1
            else:
                # 普通模型：无限次 (其实受限于每小时硬上限，所以不用担心被刷爆)
                pass 
        else:
            # Pro 用户：无限次
            pass

        # === 7. 更新数据库 ===
        if model_type == "reasoner":
            counts_reasoner[mode] = counts_reasoner.get(mode, 0) + 1
        else:
            counts_chat[mode] = counts_chat.get(mode, 0) + 1
            
        last_access[mode] = now.isoformat()
        
        usage_data["counts_chat"] = counts_chat
        usage_data["counts_reasoner"] = counts_reasoner
        usage_data["last_access"] = last_access
        usage_data["last_reset_date"] = today_str
        
        # 更新小时计数
        usage_data["hourly_start"] = hourly_start.isoformat()
        usage_data["hourly_count"] = hourly_count + 1

        self.users_col.update_one(
            {"username": username},
            {"$set": {"usage_stats": usage_data}}
        )

        return True, "允许分析", 0

    # ==========================
    # 👤 用户系统 (含防刷逻辑)
    # ==========================
    def create_user(self, username, hashed_password, role="user", email=None, device_id=None, ip=None):
        """
        创建新用户，包含设备指纹和IP限制逻辑。
        返回: True (成功) | "USERNAME_TAKEN" | "EMAIL_TAKEN" | "DEVICE_LIMIT" | "IP_LIMIT" | False
        """
        try:
            # 1. 检查用户名是否存在
            if self.users_col.find_one({"username": username}):
                return "USERNAME_TAKEN"
            
            # 2. 检查邮箱是否重复 (如果提供了邮箱)
            if email and self.users_col.find_one({"email": email}):
                print(f"❌ 注册失败: 邮箱 {email} 已存在")
                return "EMAIL_TAKEN"

            # 🔥 核心防刷 1: 设备锁 (同一个设备 ID 只能注册 3 个号)
            if device_id and device_id != "unknown_client_error":
                device_count = self.users_col.count_documents({"device_id": device_id})
                if device_count >= 3:
                    print(f"🚫 注册拦截: 设备 {device_id} 账号过多 ({device_count})")
                    return "DEVICE_LIMIT"

            # 🔥 核心防刷 2: IP锁 (同一个 IP 24小时内只能注册 5 个号)
            if ip:
                yesterday = datetime.datetime.utcnow() - datetime.timedelta(days=1)
                ip_count = self.users_col.count_documents({
                    "ip": ip, 
                    "created_at": {"$gte": yesterday}
                })
                if ip_count >= 5:
                    print(f"🚫 注册拦截: IP {ip} 注册频繁 ({ip_count}/24h)")
                    return "IP_LIMIT"

            # 3. 插入用户
            self.users_col.insert_one({
                "username": username,
                "password": hashed_password,
                "role": role,
                "email": email,
                "device_id": device_id, 
                "ip": ip,               
                "created_at": datetime.datetime.utcnow()
            })
            return True
        except Exception as e:
            print(f"❌ Create User Error: {e}")
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

    def get_champion_info(self, name_or_id):
        if not name_or_id: return None
        # ⚡⚡⚡ 核心修改：同时查 id, alias(英文), name(中文), title(称号) ⚡⚡⚡
        # 使用正则表达式进行不区分大小写的精确匹配或模糊匹配
        query = {
            "$or": [
                {"alias": {"$regex": f"^{name_or_id}$", "$options": "i"}}, # 英文名精确匹配 (Aatrox)
                {"id": str(name_or_id)},                                   # ID 匹配 (266)
                {"name": name_or_id},                                      # 中文名精确匹配 (亚托克斯)
                {"keywords": name_or_id}                                   # 外号匹配 (石头人)
            ]
        }
        return self.champions_col.find_one(query)