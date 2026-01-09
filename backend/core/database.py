# backend/core/database.py

import os
from core.logger import logger
import datetime
import time
import re
import json
from pymongo import MongoClient
from pymongo.errors import ServerSelectionTimeoutError, ConfigurationError 
from bson.objectid import ObjectId
from bson.errors import InvalidId

class KnowledgeBase:
    def __init__(self):
        #  1. 获取 URI
        self.uri = os.getenv("MONGO_URI") or os.getenv("MONGO_URL") or "mongodb://localhost:27017"
        
        self._log_connection_attempt()

        try:
            self.client = MongoClient(self.uri, serverSelectionTimeoutMS=5000)
            
            #  2. 强制连通性检查
            self.client.admin.command('ping')
            
            #  3. 智能数据库选择
            try:
                self.db = self.client.get_default_database()
                logger.info(f" [Database] 使用 URI 指定的数据库: {self.db.name}")
            except (ConfigurationError, ValueError):
                self.db = self.client['lol_community']
                logger.info(f" [Database] URI 未指定库名，使用默认数据库: {self.db.name}")
            
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
            self.sales_records_col = self.db['sales_records']
            
            # === 社区模块集合 ===
            self.wiki_posts = self.db['wiki_posts']
            self.tavern_posts = self.db['tavern_posts']
            self.wiki_summaries = self.db['wiki_summaries']
            self.comments_col = self.db['comments']
            
            # === 私信模块集合 ===
            self.messages_col = self.db['messages']
            
            # === 索引初始化 ===
            self._init_indexes()

        except ServerSelectionTimeoutError:
            logger.info(f" [Database] 连接超时! 请检查 MongoDB 服务。")
        except Exception as e:
            logger.info(f" [Database] 初始化发生未知错误: {e}")

    def _to_oid(self, id_str):
        if not id_str or not isinstance(id_str, str): return None
        try: return ObjectId(id_str)
        except InvalidId: return None

    def _log_connection_attempt(self):
        try:
            if "@" in self.uri:
                part_after_at = self.uri.split("@")[1]
                logger.info(f" [Database] 正在尝试连接: mongodb://****:****@{part_after_at}")
            else:
                logger.info(f" [Database] 正在尝试连接: {self.uri}")
        except:
            logger.info(" [Database] 正在尝试连接 MongoDB...")

    def _init_indexes(self):
        """创建索引 (含金融级并发防护)"""
        try:
            # === 1. 基础业务索引 ===
            self.tips_col.create_index([("hero", 1), ("enemy", 1)])
            self.tips_col.create_index([("is_fake", 1), ("liked_by", -1)]) 
            self.corrections_col.create_index([("hero", 1), ("enemy", 1)])
            
            # 用户相关
            self.users_col.create_index("username", unique=True)
            self.users_col.create_index("device_id")
            self.users_col.create_index("ip")
            
            # 系统配置
            self.prompt_templates_col.create_index("mode", unique=True)
            self.otps_col.create_index("expire_at", expireAfterSeconds=0)

            # === 2. 订单与销售索引 (核心防护区) ===
            # 订单号必须唯一
            self.orders_col.create_index("order_no", unique=True)
            
            # 销售记录查询优化
            self.sales_records_col.create_index([("salesperson", 1), ("created_at", -1)])
            self.sales_records_col.create_index([("salesperson", 1), ("status", 1)]) # 用于快速筛选 pending/paid
            
            #  [防护 1] 防止并发双重支付 (同一订单号只能产生一条佣金)
            # 作用：拦截多线程/网络重试导致的重复写佣金
            self.sales_records_col.create_index("order_no", unique=True)

            #  [防护 2] 防止并发双重首单 (同一个买家只能有一条"首单奖励")
            # 作用：防止用户极速连点两单，骗取两份40%佣金
            try:
                self.sales_records_col.create_index(
                    [("source_user", 1)], 
                    unique=True, 
                    partialFilterExpression={"type": "首单奖励"}
                )
            except Exception as e:
                logger.info(f" [Index] 首单唯一索引创建警告 (可能已有旧数据冲突): {e}")

            # === 3. 社区与私信索引 ===
            try:
                self.wiki_posts.create_index([("hero_id", 1), ("category", 1)])
                self.tavern_posts.create_index([("topic", 1), ("created_at", -1)])
                self.comments_col.create_index([("post_id", 1), ("created_at", 1)])
                # 私信索引
                self.messages_col.create_index([("sender", 1), ("receiver", 1), ("created_at", -1)])
                self.messages_col.create_index([("receiver", 1), ("read", 1)])
            except Exception as e:
                logger.info(f" [Community] 索引创建警告: {e}")

            logger.info(" [Database] 索引检查完毕 (已启用金融级并发防护)")

        except Exception as e:
            logger.info(f" [Database] 索引创建总体警告: {e}")

    # ==========================
    #  核心查询与数据获取
    # ==========================
    def get_champion_info(self, name_or_id):
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

        result = self.champions_col.find_one({"$or": or_conditions})
        
        # 智能兜底
        if not result:
            logger.info(f" [Database] 未找到英雄 '{name_or_id}' (DB Miss)，启用临时兜底模式。")
            return {
                "id": name_or_id, "name": name_or_id, "alias": [name_or_id], 
                "role": "unknown", "tier": "unknown",
                "mechanic_type": "通用英雄", "power_spike": "全期"
            }
        return result

    # ==========================
    #  私信系统
    # ==========================
    def get_unread_count_total(self, username):
        if self.messages_col is None: return 0
        return self.messages_col.count_documents({"receiver": username, "read": False})

    def send_message(self, sender, receiver, content, msg_type="user"):
        receiver_user = self.users_col.find_one({"username": receiver})
        if not receiver_user: return False, "用户不存在"
        if sender in receiver_user.get("blocked_users", []): return False, "消息被拒收"

        msg = {
            "sender": sender, "receiver": receiver, "content": content,
            "type": msg_type, "read": False, "deleted_by": [],
            "created_at": datetime.datetime.now(datetime.timezone.utc)
        }
        self.messages_col.insert_one(msg)
        return True, "发送成功"

    def get_my_conversations(self, username):
        pipeline = [
            {"$match": {
                "$or": [{"sender": username}, {"receiver": username}],
                "deleted_by": {"$ne": username}
            }},
            {"$sort": {"created_at": -1}},
            {"$group": {
                "_id": {"$cond": [{"$eq": ["$sender", username]}, "$receiver", "$sender"]},
                "last_message": {"$first": "$$ROOT"},
                "unread_count": {
                    "$sum": {"$cond": [{"$and": [{"$eq": ["$receiver", username]}, {"$eq": ["$read", False]}]}, 1, 0]}
                }
            }},
            {"$sort": {"last_message.created_at": -1}}
        ]
        try: return list(self.messages_col.aggregate(pipeline))
        except: return []

    def get_chat_history(self, user1, user2, limit=50, before_time=None):
        self.messages_col.update_many(
            {"sender": user2, "receiver": user1, "read": False, "deleted_by": {"$ne": user1}},
            {"$set": {"read": True}}
        )
        query = {
            "$or": [{"sender": user1, "receiver": user2}, {"sender": user2, "receiver": user1}],
            "deleted_by": {"$ne": user1}
        }
        if before_time:
            try:
                if isinstance(before_time, str): b_time = datetime.datetime.fromisoformat(before_time.replace("Z", "+00:00"))
                else: b_time = before_time
                query["created_at"] = {"$lt": b_time}
            except: pass

        cursor = self.messages_col.find(query).sort("created_at", -1).limit(limit)
        msgs = []
        for m in cursor:
            msgs.append({
                "id": str(m["_id"]), "sender": m["sender"], "content": m["content"],
                "type": m.get("type", "user"), "time": m["created_at"].strftime("%m-%d %H:%M"),
                "iso_time": m["created_at"].isoformat(), "read": m.get("read", False)
            })
        return msgs[::-1]

    def broadcast_message(self, sender, content):
            """
            全员广播消息 (高效批量插入版)
            :param sender: 发送者用户名 (通常是 admin/root)
            :param content: 消息内容
            :return: (bool, str) -> (是否成功, 结果描述)
            """
            if self.messages_col is None:
                return False, "消息服务未初始化"
                
            try:
                # 1. 获取所有用户 (只取 username 字段以节省内存)
                # 排除掉发送者自己 (可选，这里我们选择排除，避免自己收到自己的广播)
                cursor = self.users_col.find({"username": {"$ne": sender}}, {"username": 1})
                
                # 2. 构建批量消息对象
                messages_to_insert = []
                now = datetime.datetime.now(datetime.timezone.utc)
                
                for user in cursor:
                    receiver = user['username']
                    msg = {
                        "sender": sender,
                        "receiver": receiver,
                        "content": content,
                        "type": "system",  # 标记为系统广播
                        "read": False,
                        "deleted_by": [],
                        "created_at": now
                    }
                    messages_to_insert.append(msg)
                
                # 3. 执行批量插入 (如果用户量极大，建议分片插入，这里假设在万级以内)
                if messages_to_insert:
                    result = self.messages_col.insert_many(messages_to_insert)
                    count = len(result.inserted_ids)
                    return True, f"成功向 {count} 位用户发送广播"
                else:
                    return True, "没有其他用户需要发送"
                    
            except Exception as e:
                logger.info(f" Broadcast Error: {e}")
                return False, f"广播失败: {str(e)}"

    def delete_conversation(self, operator, target_user):
        if self.messages_col is None: return False
        try:
            self.messages_col.update_many(
                {"$or": [{"sender": operator, "receiver": target_user}, {"sender": target_user, "receiver": operator}]},
                {"$addToSet": {"deleted_by": operator}}
            )
            return True
        except: return False

    # ==========================
    #  验证码管理
    # ==========================
    def save_otp(self, contact, code):
        expire_time = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=5)
        self.otps_col.update_one({"contact": contact}, {"$set": {"code": code, "expire_at": expire_time}}, upsert=True)

    def validate_otp(self, contact, code):
        record = self.otps_col.find_one({"contact": contact})
        if not record: return False 
        if record['code'] == code:
            self.otps_col.delete_one({"contact": contact})
            return True
        return False

    # ==========================
    #  充值与会员系统
    # ==========================
    def upgrade_user_role(self, username, days=30):
        now = datetime.datetime.now(datetime.timezone.utc)
        user = self.users_col.find_one({"username": username})
        if not user: return False

        current_expire = user.get("membership_expire")
        if current_expire and current_expire.tzinfo is None:
            current_expire = current_expire.replace(tzinfo=datetime.timezone.utc)

        base_time = current_expire if current_expire and current_expire > now else now
        new_expire = base_time + datetime.timedelta(days=days)

        self.users_col.update_one(
            {"username": username},
            {"$set": {"role": "pro", "membership_expire": new_expire, "is_pro": True}}
        )
        return True
    
    #  [修改] 核心：阶梯佣金处理逻辑 (首单40%, 复购15%)
    def process_afdian_order(self, order_no, username, amount, sku_detail):
        # ================= 1. 智能幂等性检查 (防止掉单) =================
        existing_order = self.orders_col.find_one({"order_no": order_no})
        
        if existing_order:
            # 如果订单已存在，检查是否遗漏了佣金记录 (即"掉单"情况)
            user = self.users_col.find_one({"username": username})
            if user and user.get("sales_ref"):
                # 检查是否已存在佣金记录
                existing_comm = self.sales_records_col.find_one({"order_no": order_no})
                if not existing_comm:
                    logger.info(f" [Order Fix] 发现掉单: {order_no}，正在尝试补录佣金...")
                    # 允许程序继续向下执行，去跑佣金逻辑
                    pass 
                else:
                    return True # 订单和佣金都存在，是完全重复的请求，直接返回成功
            else:
                return True # 普通用户且订单已存在，无需操作，直接返回

        # ================= 2. 用户校验与充值计算 =================
        user = self.users_col.find_one({"username": username})
        if not user: return False

        amount_float = float(amount)
        
        # 计算增加的天数
        days_to_add = 0
        if amount_float >= 19.90: days_to_add = 30
        elif amount_float >= 6.90: days_to_add = 7
        else: days_to_add = int(amount_float * 0.5)

        if days_to_add < 1: return False

        # ================= 3. 执行充值与记录 =================
        if self.upgrade_user_role(username, days=days_to_add):
            
            # A. 记录订单 (使用 try-except 防止掉单修复时重复插入报错)
            try:
                if not existing_order: # 只有当订单真的不存在时才插入
                    self.orders_col.insert_one({
                        "order_no": order_no, "username": username, "amount": amount,
                        "days_added": days_to_add, "sku": sku_detail,
                        "created_at": datetime.datetime.now(datetime.timezone.utc)
                    })
            except Exception as e:
                logger.info(f"Order Insert Skip (Normal if fixing drop): {e}")

            # B. 处理佣金 (Sales Ref Check)
            sales_ref = user.get("sales_ref")
            if sales_ref:
                agent = self.users_col.find_one({"username": sales_ref})
                
                if agent:
                    # 查询该用户之前的订单数 (排除当前这单)
                    prev_orders_count = self.orders_col.count_documents({
                        "username": username, "order_no": {"$ne": order_no}
                    })

                    #  阶梯佣金配置
                    commission_rate = 0.0
                    commission_type = ""

                    if prev_orders_count == 0:
                        commission_rate = 0.40  # 首单 40%
                        commission_type = "首单奖励"
                    elif prev_orders_count == 1:
                        commission_rate = 0.15  # 次单 15%
                        commission_type = "复购奖励"
                    else:
                        commission_rate = 0.0   # 老用户无佣金
                        commission_type = "老用户复购"

                    # 只有产生佣金才写入记录
                    if commission_rate > 0:
                        commission = amount_float * commission_rate
                        
                        self.sales_records_col.insert_one({
                            "salesperson": sales_ref,
                            "source_user": username,
                            "order_amount": amount_float,
                            "commission": commission,
                            "rate": f"{int(commission_rate * 100)}%",
                            "order_no": order_no,
                            "type": commission_type,
                            "status": "pending", # 默认为待结算
                            "created_at": datetime.datetime.now(datetime.timezone.utc)
                        })

            return True
        return False

    def check_membership_status(self, username):
        user = self.users_col.find_one({"username": username})
        if not user: return "user"
        role = user.get("role", "user")
        if role in ["pro", "vip", "svip"]:
            expire_at = user.get("membership_expire")
            if not expire_at: return role
            now = datetime.datetime.now(datetime.timezone.utc)
            if expire_at.tzinfo is None: expire_at = expire_at.replace(tzinfo=datetime.timezone.utc)
            if expire_at < now:
                self.users_col.update_one({"username": username}, {"$set": {"role": "user"}})
                return "user"
            return role
        return role

    def get_user_usage_status(self, username):
        current_role = self.check_membership_status(username)
        user = self.users_col.find_one({"username": username})
        if not user: return {}
        is_pro = current_role in ["vip", "svip", "admin", "pro"]
        
        # --- R1 (核心) 统计 ---
        today_str = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d")
        usage_data = user.get("usage_stats", {})
        base_limit = 3
        bonus = usage_data.get("bonus_r1", 0)
        total_limit = base_limit + bonus
        r1_used = sum(usage_data.get("counts_reasoner", {}).values()) if usage_data.get("last_reset_date") == today_str else 0
        
        # --- Chat (快速) 统计 [新增逻辑] ---
        bonus_chat = usage_data.get("bonus_chat", 0)
        base_hourly = 30 if is_pro else 10
        chat_limit = base_hourly + bonus_chat
        
        # 计算当前小时已用 (逻辑同 check_and_update_usage)
        chat_used = 0
        hourly_start_str = usage_data.get("hourly_start")
        if hourly_start_str:
            try:
                now = datetime.datetime.now(datetime.timezone.utc)
                hourly_start = datetime.datetime.fromisoformat(hourly_start_str)
                if hourly_start.tzinfo is None: hourly_start = hourly_start.replace(tzinfo=datetime.timezone.utc)
                # 如果距离上次记录起始时间超过1小时，则当前已用视为0
                if (now - hourly_start).total_seconds() <= 3600:
                    chat_used = usage_data.get("hourly_count", 0)
            except:
                chat_used = 0

        return {
            "is_pro": is_pro, 
            "role": current_role, 
            "r1_limit": total_limit, 
            "r1_used": r1_used, 
            "r1_remaining": max(0, total_limit - r1_used) if not is_pro else -1,
            #  新增返回字段
            "chat_hourly_limit": chat_limit,
            "chat_used": chat_used
        }

    def check_and_update_usage(self, username, mode, model_type="chat"):
        # 1. 获取用户身份与基础信息
        current_role = self.check_membership_status(username)
        user = self.users_col.find_one({"username": username})
        if not user: return False, "用户不存在", 0
        
        is_pro = current_role in ["vip", "svip", "admin", "pro"]
        
        # 深度思考余额硬性检查
        if model_type == "reasoner":
                explicit_balance = user.get("r1_remaining")
                if explicit_balance is not None and explicit_balance <= 0:
                    return False, "深度思考次数不足 (余额已耗尽)", -1
        
        now = datetime.datetime.now(datetime.timezone.utc)
        today_str = now.strftime("%Y-%m-%d")
        
        # 2. 初始化或重置每日统计 ( 修改：需要保留 bonus_chat)
        usage_data = user.get("usage_stats", {})
        if usage_data.get("last_reset_date") != today_str:
            current_bonus_r1 = usage_data.get("bonus_r1", 0)
            current_bonus_chat = usage_data.get("bonus_chat", 0) #  继承快速模型奖励
            
            usage_data = {
                "last_reset_date": today_str, 
                "counts_chat": {}, 
                "counts_reasoner": {}, 
                "last_access": {}, 
                "hourly_start": now.isoformat(), 
                "hourly_count": 0,
                "bonus_r1": current_bonus_r1,
                "bonus_chat": current_bonus_chat #  写入新一天的记录
            }
        
        # 3. 小时频控 (防刷)
        #  修改：应用 bonus_chat 提升快速模型上限
        bonus_chat = usage_data.get("bonus_chat", 0)
        base_hourly = 30 if is_pro else 10
        HOURLY_LIMIT = base_hourly + bonus_chat
        
        hourly_start_str = usage_data.get("hourly_start")
        hourly_start = datetime.datetime.fromisoformat(hourly_start_str) if hourly_start_str else now
        if hourly_start.tzinfo is None: hourly_start = hourly_start.replace(tzinfo=datetime.timezone.utc)
        
        if (now - hourly_start).total_seconds() > 3600: 
            hourly_start, usage_data["hourly_count"] = now, 0
            
        if usage_data.get("hourly_count", 0) >= HOURLY_LIMIT:
            return False, f"操作过于频繁 ({60 - int((now - hourly_start).total_seconds() / 60)}m)", 0

        # 4. 冷却时间 (Cooldown)
        COOLDOWN = 5 if is_pro else 15
        last_time_str = usage_data.get("last_access", {}).get(mode)
        if last_time_str:
            try:
                last_time = datetime.datetime.fromisoformat(last_time_str)
                if last_time.tzinfo is None: last_time = last_time.replace(tzinfo=datetime.timezone.utc)
                if (now - last_time).total_seconds() < COOLDOWN: 
                    return False, "AI思考中", int(COOLDOWN - (now - last_time).total_seconds())
            except: pass

        # 5.  修改 2：深度思考 (R1) 次数限制检查 (10 -> 3)
        if not is_pro and model_type == "reasoner":
            bonus = usage_data.get("bonus_r1", 0)
            daily_r1_limit = 3 + bonus  #  这里改为 3
            
            used_today = sum(usage_data.get("counts_reasoner", {}).values())
            
            if used_today >= daily_r1_limit: 
                return False, f"深度思考限额已满 ({used_today}/{daily_r1_limit})", -1
        
        # 6. 更新计数
        if model_type == "reasoner": 
            usage_data["counts_reasoner"][mode] = usage_data["counts_reasoner"].get(mode, 0) + 1
        else: 
            usage_data["counts_chat"][mode] = usage_data["counts_chat"].get(mode, 0) + 1
            
        usage_data["last_access"][mode] = now.isoformat()
        usage_data["hourly_count"] = usage_data.get("hourly_count", 0) + 1
        usage_data["hourly_start"] = hourly_start.isoformat()
        
        self.users_col.update_one({"username": username}, {"$set": {"usage_stats": usage_data}})
        return True, "OK", 0
    # ==========================
    #  管理员 & 统计功能
    # ==========================
    
    # 1. 基础用户管理
    def create_user(self, username, password, role="user", email="", device_id="unknown", ip="unknown", sales_ref=None):
        if self.get_user(username): return "USERNAME_TAKEN"
        if self.users_col.find_one({"email": email}): return "EMAIL_TAKEN"
        # 简单频控
        if device_id and device_id not in ["unknown", "unknown_client_error"] and self.users_col.count_documents({"device_id": device_id}) >= 3: 
            return "DEVICE_LIMIT"
            
        if ip and self.users_col.count_documents({"ip": ip, "created_at": {"$gte": datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=1)}}) >= 5: return "IP_LIMIT"
        
        self.users_col.insert_one({
            "username": username, "password": password, "role": role,
            "email": email, "device_id": device_id, "ip": ip, 
            "created_at": datetime.datetime.now(datetime.timezone.utc),
            "sales_ref": sales_ref
        })
        return True

    def get_user(self, username): return self.users_col.find_one({"username": username})
    # 找到 get_all_users 方法
    def get_all_users(self, limit=20, search="", skip=0):
        """
         [修改] 支持分页 skip/limit，并返回 (list, total) 元组
        """
        query = {"username": {"$regex": search, "$options": "i"}} if search else {}
        
        # 1. 获取总数
        total = self.users_col.count_documents(query)
        
        # 2. 分页查询
        cursor = self.users_col.find(query, {"password": 0, "usage_stats": 0})\
            .sort("created_at", -1)\
            .skip(skip)\
            .limit(limit)
            
        users = list(cursor)
        for u in users:
            u["_id"] = str(u["_id"])
            if u.get("created_at"): u["created_at"] = u["created_at"].isoformat()
            if u.get("membership_expire"): u["membership_expire"] = u["membership_expire"].isoformat()
            
        # 返回 (数据列表, 总条数)
        return users, total

    def admin_update_user(self, username, action, value):
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
            # 级联更新
            self.tips_col.update_many({"author_id": username}, {"$set": {"author_id": new_name}})
            self.orders_col.update_many({"username": username}, {"$set": {"username": new_name}})
            self.messages_col.update_many({"sender": username}, {"$set": {"sender": new_name}})
            self.messages_col.update_many({"receiver": username}, {"$set": {"receiver": new_name}})
            return True, "更名成功"
        elif action == "delete":
            self.users_col.delete_one({"username": username})
            return True, "用户已删除"
        return False, "未知操作"

    #  [修改] 销售报表：区分 待结算(Pending) 和 已结算(Paid)
    def get_admin_sales_summary(self):
        pipeline = [
            {"$group": {
                "_id": "$salesperson", 
                # 只统计 status != 'paid' 的作为待结算佣金
                "pending_commission": {
                    "$sum": {
                        "$cond": [{"$ne": ["$status", "paid"]}, "$commission", 0]
                    }
                },
                # 统计已结算总额
                "paid_commission": {
                    "$sum": {
                        "$cond": [{"$eq": ["$status", "paid"]}, "$commission", 0]
                    }
                },
                "total_sales": {"$sum": "$order_amount"}, 
                "order_count": {"$sum": 1},
                "last_order_date": {"$max": "$created_at"}
            }},
            {"$sort": {"pending_commission": -1}} # 按待结算金额倒序
        ]
        
        try: 
            results = list(self.sales_records_col.aggregate(pipeline))
        except Exception as e: 
            logger.info(f"Agg Error: {e}")
            return []
            
        final_list = []
        for r in results:
            username = r["_id"]
            user = self.users_col.find_one({"username": username})
            contact = user.get("email", "未绑定邮箱") if user else "未知用户"
            game_name = "未同步"
            if user and user.get("game_profile"):
                if isinstance(user["game_profile"], dict): game_name = user["game_profile"].get("gameName", "未同步")
            
            final_list.append({
                "username": username, 
                "game_name": game_name, 
                "contact": contact,
                "pending_commission": round(r["pending_commission"], 2), # 待结算
                "paid_commission": round(r["paid_commission"], 2),       # 已结算
                "total_sales": round(r["total_sales"], 2),
                "order_count": r["order_count"],
                "last_active": r["last_order_date"].strftime("%Y-%m-%d") if r["last_order_date"] else "-"
            })
        return final_list

    #  [新增] 执行结算：将该用户所有未结算订单标记为已结算
    def settle_sales_partner(self, salesperson, operator_name):
        try:
            #  [加固] 记录当前时间作为“结算截止点”
            cutoff_time = datetime.datetime.now(datetime.timezone.utc)
            
            #  [加固] 查询条件增加时间限制：只结算截止时间之前的订单
            query = {
                "salesperson": salesperson, 
                "status": {"$ne": "paid"},
                "created_at": {"$lte": cutoff_time} # Less than or equal to cutoff
            }
            
            result = self.sales_records_col.update_many(
                query,
                {"$set": {
                    "status": "paid",
                    "settled_at": cutoff_time,
                    "settled_by": operator_name
                }}
            )
            
            # 如果 result.modified_count 为 0，说明没有符合条件的订单
            if result.modified_count == 0:
                return True, "没有需要结算的订单 (或订单刚产生，请刷新后再试)"
                
            return True, f"成功结算 {result.modified_count} 笔订单 (截止至 {cutoff_time.strftime('%H:%M:%S')})"
        except Exception as e:
            return False, str(e)

    #  [新增] 全局统计看板数据源
    def get_admin_stats(self):
        total_users = self.users_col.count_documents({})
        pro_users = self.users_col.count_documents({"role": {"$in": ["pro", "vip", "svip", "admin"]}})
        
        revenue_agg = list(self.orders_col.aggregate([{"$group": {"_id": None, "total": {"$sum": {"$toDouble": "$amount"}}}}]))
        total_revenue = revenue_agg[0]['total'] if revenue_agg else 0.0

        commission_agg = list(self.sales_records_col.aggregate([{"$group": {"_id": None, "total": {"$sum": "$commission"}}}]))
        total_commissions = commission_agg[0]['total'] if commission_agg else 0.0

        try:
            pipeline = [
                {"$project": {"chat_count": {"$ifNull": ["$usage_stats.hourly_count", 0]}}},
                {"$group": {"_id": None, "total": {"$sum": "$chat_count"}}}
            ]
            usage_res = list(self.users_col.aggregate(pipeline))
            total_calls = usage_res[0]['total'] * 10 if usage_res else 0
        except: total_calls = 0

        recent_users = []
        cursor = self.users_col.find({}, {"username": 1, "role": 1, "usage_stats": 1}).sort("usage_stats.last_access", -1).limit(50)
        for u in cursor:
            usage = u.get("usage_stats", {})
            r1_count = sum(usage.get("counts_reasoner", {}).values())
            chat_count = sum(usage.get("counts_chat", {}).values())
            last_access = "Long ago"
            if usage.get("last_access"):
                times = [v for k,v in usage["last_access"].items() if isinstance(v, str)]
                if times: last_access = max(times).replace("T", " ")[:16]
            recent_users.append({
                "username": u["username"], "role": u.get("role", "user"),
                "r1_used": r1_count + chat_count, "last_active": last_access
            })

        return {
            "total_users": total_users, "pro_users": pro_users,
            "total_revenue": total_revenue, "total_commissions": total_commissions,
            "total_api_calls": total_calls, "recent_users": recent_users
        }

    # ==========================
    # 销售仪表盘 (代理端)
    # ==========================
    def get_sales_dashboard_data(self, username):
        pipeline = [{"$match": {"salesperson": username}}, {"$group": {"_id": None, "total_commission": {"$sum": "$commission"}, "total_orders": {"$sum": 1}, "total_sales": {"$sum": "$order_amount"}}}]
        stats = list(self.sales_records_col.aggregate(pipeline))
        base_data = stats[0] if stats else {"total_commission": 0, "total_orders": 0, "total_sales": 0}
        
        today_start = datetime.datetime.now(datetime.timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        today_stats = self.sales_records_col.aggregate([{"$match": {"salesperson": username, "created_at": {"$gte": today_start}}}, {"$group": {"_id": None, "today_earnings": {"$sum": "$commission"}}}])
        today_data = list(today_stats)
        
        recent_records = list(self.sales_records_col.find({"salesperson": username}, {"source_user": 1, "commission": 1, "created_at": 1, "rate": 1, "type": 1}).sort("created_at", -1).limit(10))
        formatted_records = []
        for r in recent_records:
            formatted_records.append({
                "source": r.get("source_user", "未知")[:3] + "***",
                "amount": r.get("commission", 0),
                "time": r.get("created_at").strftime("%H:%M"),
                "rate": r.get("rate", "40%"),
                "type": r.get("type", "首单奖励")
            })
            
        return {
            "total_earnings": round(base_data['total_commission'], 2),
            "today_earnings": round(today_data[0]['today_earnings'] if today_data else 0, 2),
            "total_orders": base_data['total_orders'],
            "recent_records": formatted_records
        }

    # ==========================
    # 社区 & Wiki
    # ==========================
    def add_tip(self, hero, enemy, content, author_id, is_general, title=None, tags=None, is_fake=False):
        tip_doc = {
            "hero": hero, "enemy": "general" if is_general else enemy,
            "title": title or (content[:15] + "..." if len(content) > 15 else content),
            "content": content, "tags": tags or ["实战经验"],
            "author_id": author_id, "liked_by": [], "reward_granted": False,
            "is_fake": is_fake, "is_polished": False,
            "created_at": datetime.datetime.now(datetime.timezone.utc)
        }
        return self.tips_col.insert_one(tip_doc)

    def toggle_like(self, tip_id, user_id):
        if not (oid := self._to_oid(tip_id)): return False
        try:
            result = self.tips_col.find_one_and_update(
                {"_id": ObjectId(tip_id), "liked_by": {"$ne": user_id}},
                {"$push": {"liked_by": user_id}}, return_document=True 
            )
            if not result: return False
            if len(result.get('liked_by', [])) >= 10 and not result.get('reward_granted', False):
                if self.upgrade_user_role(result.get('author_id'), days=3):
                    self.tips_col.update_one({"_id": ObjectId(tip_id)}, {"$set": {"reward_granted": True}})
            return True
        except: return False

    def get_mixed_tips(self, hero, enemy, limit=10):
        matchup_tips = list(self.tips_col.find({"hero": hero, "enemy": enemy}).sort([("is_fake", 1), ("liked_by", -1)]).limit(limit))
        for t in matchup_tips: t['tag_label'] = " 对位绝活"
        if len(matchup_tips) < limit:
            needed = limit - len(matchup_tips)
            general_tips = list(self.tips_col.find({"hero": hero, "enemy": "general"}).sort([("is_fake", 1), ("liked_by", -1)]).limit(needed))
            for t in general_tips: t['tag_label'] = " 英雄必修"
            matchup_tips.extend(general_tips)
        
        final_list = []
        for t in matchup_tips:
            role = self.check_membership_status(t["author_id"])
            final_list.append({
                "id": str(t['_id']), "title": t.get("title", "技巧"), "content": t["content"],
                "author": t["author_id"], "author_role": role, "likes": len(t.get("liked_by", [])),
                "tags": t.get("tags", []), "tag_label": t["tag_label"]
            })
        return final_list

    def get_top_knowledge_for_ai(self, hero, enemy):
        tips = self.get_mixed_tips(hero, enemy, limit=6)
        return {
            "general": [t['content'] for t in tips if t['tag_label'] == " 英雄必修"],
            "matchup": [t['content'] for t in tips if t['tag_label'] == " 对位绝活"]
        }

    def get_corrections(self, my_hero, enemy_hero, my_role=None, mode=None):
        if self.corrections_col is None:
            return []

        try:
            # 1) 我方 Keys
            hero_keys = [my_hero, "general"]
            if my_hero and " " in my_hero:
                hero_keys.append(my_hero.replace(" ", ""))

            # 2) 注入位置 Keys & 模式处理
            if my_role:
                role_lower = my_role.lower()
                hero_keys.append(f"role_{role_lower}")

                if role_lower == "jungle":
                    if mode == "role_jungle_farming":
                        hero_keys.append("role_jungle_farming")
                    elif mode == "role_jungle_ganking": 
                        #  server.py 传过来的新默认值
                        hero_keys.append("role_jungle_ganking")
                    else:
                        # 兜底
                        hero_keys.append("role_jungle_ganking")

            # 3) 敌方 Keys
            enemy_keys = [enemy_hero]
            if enemy_hero and " " in enemy_hero:
                enemy_keys.append(enemy_hero.replace(" ", ""))

            query = {
                "$or": [
                    {
                        "hero": {"$in": hero_keys},
                        "enemy": {"$in": enemy_keys + ["general"]}
                    },
                    {
                        "hero": {"$in": enemy_keys},
                        "enemy": "general"
                    }
                ]
            }

            # 按优先级排序 (priority 越高越前)
            res = list(self.corrections_col.find(query).sort("priority", -1))
            return res

        except Exception as e:
            logger.info("get_corrections error:", e)
            return []


    def get_all_feedbacks(self, status="pending", limit=50):
        query = {}
        if status != "all":
            # 兼容旧数据：没有 status 字段的视为 pending
            query = {"$or": [{"status": status}, {"status": {"$exists": False}}]}
        
        # 按时间倒序
        cursor = self.feedback_col.find(query).sort('created_at', -1).limit(limit)
        return [dict(doc, _id=str(doc['_id'])) for doc in cursor]
    def resolve_feedback(self, feedback_id, adopt=False, reward=1, reward_type="r1"):
        if not (oid := self._to_oid(feedback_id)): return False
        try:
            # 如果不采纳(adopt=False)，则奖励归零
            actual_reward = reward if (adopt and reward_type != 'none') else 0
            
            update_doc = {
                "status": "resolved", 
                "resolved_at": datetime.datetime.now(datetime.timezone.utc),
                "adopted": adopt,
                "reward_granted": actual_reward,
                "reward_type": reward_type if adopt else None # 记录奖励类型
            }
            
            feedback = self.feedback_col.find_one_and_update(
                {"_id": oid},
                {"$set": update_doc},
                return_document=True
            )
            
            if not feedback: return False

            # 如果采纳，给用户发奖
            if adopt and feedback.get("user_id") and actual_reward > 0:
                username = feedback["user_id"]
                inc_field = {}
                
                # 根据类型增加对应的 bonus
                if reward_type == "r1":
                    inc_field = {"usage_stats.bonus_r1": actual_reward}
                    logger.info(f" [Reward] 用户 {username} 获得 {actual_reward} 次【核心模型】")
                elif reward_type == "chat":
                    inc_field = {"usage_stats.bonus_chat": actual_reward}
                    logger.info(f" [Reward] 用户 {username} 获得 {actual_reward} 次【快速模型】上限")
                
                if inc_field:
                    self.users_col.update_one(
                        {"username": username},
                        {"$inc": inc_field}
                    )
                
            return True
        except Exception as e:
            logger.info(f"Resolve Error: {e}")
            return False
        
    def get_prompt_template(self, mode): return self.prompt_templates_col.find_one({"mode": mode})
    def get_game_constants(self): return self.config_col.find_one({"_id": "s16_rules"}) or {}
    def delete_tip(self, tip_id): return self.tips_col.delete_one({"_id": ObjectId(tip_id)}).deleted_count > 0 if self._to_oid(tip_id) else False
    def get_tip_by_id(self, tip_id): return self.tips_col.find_one({"_id": ObjectId(tip_id)}) if self._to_oid(tip_id) else None
    def submit_feedback(self, data): self.feedback_col.insert_one({**data, 'created_at': datetime.datetime.now(datetime.timezone.utc)})

    # Wiki & Tavern Helpers
    def get_wiki_posts(self, hero_id=None, category=None):
        q = {}
        if hero_id: q["hero_id"] = str(hero_id)
        if category and category != "all": q["category"] = category
        posts = list(self.wiki_posts.find(q).sort([("is_ai_pick", -1), ("likes", -1)]).limit(20))
        for p in posts: p["id"] = str(p["_id"]); del p["_id"]
        return posts

    def create_wiki_post(self, data):
        data.update({"created_at": datetime.datetime.now(datetime.timezone.utc), "likes": 0, "views": 0, "is_ai_pick": False, "ref_id": f"#U-{int(time.time())%10000:04d}"})
        res = self.wiki_posts.insert_one(data)
        data["id"] = str(res.inserted_id); del data["_id"]
        return data

    def get_tavern_posts(self, topic=None):
        q = {}
        if topic and topic != "all": q["topic"] = topic
        posts = list(self.tavern_posts.find(q).sort("created_at", -1).limit(50))
        for p in posts: p["id"] = str(p["_id"]); del p["_id"]
        return posts

    def create_tavern_post(self, data):
        data.update({"created_at": datetime.datetime.now(datetime.timezone.utc), "likes": 0, "comments": 0})
        res = self.tavern_posts.insert_one(data)
        data["id"] = str(res.inserted_id); del data["_id"]
        return data

    def get_wiki_summary(self, hero_id):
        s = self.wiki_summaries.find_one({"hero_id": str(hero_id)})
        if s: s["id"] = str(s["_id"]); del s["_id"]
        return s

    def add_comment(self, post_id, user_id, user_name, content):
        if not self._to_oid(post_id): return None
        c = {"post_id": str(post_id), "user_id": str(user_id), "user_name": user_name, "content": content, "likes": 0, "created_at": datetime.datetime.now(datetime.timezone.utc)}
        res = self.comments_col.insert_one(c)
        self.wiki_posts.update_one({"_id": ObjectId(post_id)}, {"$inc": {"comments": 1}})
        self.tavern_posts.update_one({"_id": ObjectId(post_id)}, {"$inc": {"comments": 1}})
        c["id"] = str(res.inserted_id); del c["_id"]
        return c

    def get_comments(self, post_id):
        comments = list(self.comments_col.find({"post_id": str(post_id)}).sort("created_at", 1))
        for c in comments:
            c["id"] = str(c["_id"]); del c["_id"]
            if c.get("created_at"): c["created_at"] = c["created_at"].strftime("%Y-%m-%d %H:%M")
        return comments

    def get_wiki_post(self, post_id): return self.wiki_posts.find_one({"_id": ObjectId(post_id)}) if self._to_oid(post_id) else None
    def get_tavern_post(self, post_id): return self.tavern_posts.find_one({"_id": ObjectId(post_id)}) if self._to_oid(post_id) else None
    
    def update_wiki_post(self, post_id, updates):
        if not self._to_oid(post_id): return False
        try:
            for f in ["_id", "author_id", "created_at", "ref_id"]: updates.pop(f, None)
            return self.wiki_posts.update_one({"_id": ObjectId(post_id)}, {"$set": updates}).modified_count > 0
        except: return False

    def update_tavern_post(self, post_id, updates):
        if not self._to_oid(post_id): return False
        try:
            for f in ["_id", "author_id", "created_at"]: updates.pop(f, None)
            return self.tavern_posts.update_one({"_id": ObjectId(post_id)}, {"$set": updates}).modified_count > 0
        except: return False
    
    def delete_wiki_post(self, post_id): return self.wiki_posts.delete_one({"_id": ObjectId(post_id)}).deleted_count > 0 if self._to_oid(post_id) else False
    def delete_tavern_post(self, post_id): return self.tavern_posts.delete_one({"_id": ObjectId(post_id)}).deleted_count > 0 if self._to_oid(post_id) else False
    def get_client_config(self):
        """获取客户端下载配置"""
        try:
            # 默认返回空字典，防止报错
            return self.config_col.find_one({"_id": "client_download"}) or {}
        except:
            return {}

    def update_client_config(self, url, pwd):
        """更新客户端下载配置"""
        try:
            self.config_col.update_one(
                {"_id": "client_download"},
                {
                    "$set": {
                        "pan_url": url, 
                        "pan_pwd": pwd,
                        "updated_at": datetime.datetime.now(datetime.timezone.utc)
                    }
                },
                upsert=True # 如果不存在则自动创建
            )
            return True
        except Exception as e:
            logger.info(f"Config Update Error: {e}")
            return False