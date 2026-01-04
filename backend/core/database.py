# backend/core/database.py

import os
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
        # 🟢 1. 获取 URI (兼容 MONGO_URI 和 MONGO_URL)
        self.uri = os.getenv("MONGO_URI") or os.getenv("MONGO_URL") or "mongodb://localhost:27017"
        
        self._log_connection_attempt()

        try:
            self.client = MongoClient(self.uri, serverSelectionTimeoutMS=5000)
            
            # 🟢 2. 强制连通性检查
            self.client.admin.command('ping')
            
            # 🟢 3. 智能数据库选择 (确保和 seed_data.py 逻辑一致)
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
            self.sales_records_col = self.db['sales_records']
            # === 社区模块集合 (Wiki & Tavern) ===
            self.wiki_posts = self.db['wiki_posts']          # 绝活攻略
            self.tavern_posts = self.db['tavern_posts']      # 酒馆动态
            self.wiki_summaries = self.db['wiki_summaries']  # 英雄Wiki摘要(机制/对位表)
            self.comments_col = self.db['comments']
            # === 索引初始化 ===
            self._init_indexes()

        except ServerSelectionTimeoutError:
            print(f"❌ [Database] 连接超时! 请检查 MongoDB 服务。")
        except Exception as e:
            print(f"❌ [Database] 初始化发生未知错误: {e}")

    def _to_oid(self, id_str):
        """安全转换 ObjectId"""
        if not id_str or not isinstance(id_str, str):
            return None
        try:
            return ObjectId(id_str)
        except InvalidId:
            return None

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
        """创建索引"""
        try:
            self.tips_col.create_index([("hero", 1), ("enemy", 1)])
            self.tips_col.create_index([("is_fake", 1), ("liked_by", -1)]) 
            self.corrections_col.create_index([("hero", 1), ("enemy", 1)])
            self.users_col.create_index("username", unique=True)
            self.prompt_templates_col.create_index("mode", unique=True)
            self.users_col.create_index("device_id")
            self.users_col.create_index("ip")
            self.otps_col.create_index("expire_at", expireAfterSeconds=0)
            self.orders_col.create_index("order_no", unique=True)
            self.sales_records_col.create_index([("salesperson", 1), ("created_at", -1)])
            try:
                self.wiki_posts.create_index([("hero_id", 1), ("category", 1)])
                self.tavern_posts.create_index([("topic", 1), ("created_at", -1)])
                self.comments_col.create_index([("post_id", 1), ("created_at", 1)])
            except Exception as e:
                print(f"⚠️ [Community] 索引创建警告: {e}")
            print("✅ [Database] 索引检查完毕")
        except Exception as e:
            print(f"⚠️ [Database] 索引创建警告: {e}")

    # ==========================
    # 🔍 核心查询 (🔥 已加入智能兜底)
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

        # 1. 尝试从数据库查找
        result = self.champions_col.find_one({"$or": or_conditions})
        
        # 2. 🔥 [关键修复] 智能兜底逻辑
        # 如果数据库因为同步问题没找到，或者名字有偏差
        # 只要前端传了名字，我们就信任它，构造一个临时对象返回
        # 这样 server.py 就不会抛出 "系统未识别英雄" 的错误
        if not result:
            print(f"⚠️ [Database] 未找到英雄 '{name_or_id}' (DB Miss)，启用临时兜底模式。")
            return {
                "id": name_or_id,
                "name": name_or_id,
                "alias": [name_or_id], 
                "role": "unknown",
                "tier": "unknown",
                "mechanic_type": "通用英雄",
                "power_spike": "全期"
            }
            
        return result

    # ==========================
    # ✨ 验证码管理
    # ==========================
    def save_otp(self, contact, code):
        expire_time = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=5)
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
    # 💰 充值与会员系统 (修复时间时区问题)
    # ==========================
    def upgrade_user_role(self, username, days=30):
        # 🟢 统一使用 UTC 时区
        now = datetime.datetime.now(datetime.timezone.utc)
        
        user = self.users_col.find_one({"username": username})
        if not user: return False

        current_expire = user.get("membership_expire")
        
        # 🔥 [修复] 如果数据库里的时间没有时区，强制加上 UTC，避免报错
        if current_expire and current_expire.tzinfo is None:
            current_expire = current_expire.replace(tzinfo=datetime.timezone.utc)

        base_time = current_expire if current_expire and current_expire > now else now
        new_expire = base_time + datetime.timedelta(days=days)

        self.users_col.update_one(
            {"username": username},
            {"$set": {"role": "pro", "membership_expire": new_expire, "is_pro": True}}
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
                "created_at": datetime.datetime.now(datetime.timezone.utc)
            })
            sales_ref = user.get("sales_ref")
            if sales_ref:
                prev_orders_count = self.orders_col.count_documents({
                    "username": username, 
                    "order_no": {"$ne": order_no}
                })

                if prev_orders_count == 0:
                    commission = amount_float * 0.40
                    self.sales_records_col.insert_one({
                        "salesperson": sales_ref,
                        "source_user": username,
                        "order_amount": amount_float,
                        "commission": commission,
                        "rate": "40%",
                        "order_no": order_no,
                        "type": "first_month_bonus",
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
            
            # 🔥 [修复] 时区兼容检查
            now = datetime.datetime.now(datetime.timezone.utc)
            if expire_at.tzinfo is None:
                expire_at = expire_at.replace(tzinfo=datetime.timezone.utc)
                
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
        today_str = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d")
        usage_data = user.get("usage_stats", {})
        
        r1_used = sum(usage_data.get("counts_reasoner", {}).values()) if usage_data.get("last_reset_date") == today_str else 0
        LIMIT = 10 
        return {
            "is_pro": is_pro, "role": current_role, "r1_limit": LIMIT, 
            "r1_used": r1_used, "r1_remaining": max(0, LIMIT - r1_used) if not is_pro else -1
        }

    def check_and_update_usage(self, username, mode, model_type="chat"):
            """检查冷却时间与额度限制 (已修复 500 报错)"""
            current_role = self.check_membership_status(username)
            user = self.users_col.find_one({"username": username})
            if not user: return False, "用户不存在", 0

            is_pro = current_role in ["vip", "svip", "admin", "pro"]
            
            # 🟢 [修复] 统一使用带时区的时间 (Offset-Aware)
            now = datetime.datetime.now(datetime.timezone.utc)
            today_str = now.strftime("%Y-%m-%d")
            
            usage_data = user.get("usage_stats", {})
            
            if usage_data.get("last_reset_date") != today_str:
                usage_data = {
                    "last_reset_date": today_str, "counts_chat": {}, "counts_reasoner": {}, "last_access": {},
                    "hourly_start": usage_data.get("hourly_start", now.isoformat()), "hourly_count": 0 
                }
            
            HOURLY_LIMIT = 30 if is_pro else 10
            
            # 🔥 [修复] 安全解析数据库时间
            hourly_start_str = usage_data.get("hourly_start")
            if hourly_start_str:
                try:
                    hourly_start = datetime.datetime.fromisoformat(hourly_start_str)
                    # 如果读取的时间是 naive 的，强制转为 utc aware，避免减法报错
                    if hourly_start.tzinfo is None:
                        hourly_start = hourly_start.replace(tzinfo=datetime.timezone.utc)
                except ValueError:
                    hourly_start = now
            else:
                hourly_start = now
            
            hourly_count = usage_data.get("hourly_count", 0)
            
            # 现在减法安全了
            if (now - hourly_start).total_seconds() > 3600:
                hourly_start, hourly_count = now, 0
                
            if hourly_count >= HOURLY_LIMIT:
                return False, f"操作过于频繁，请稍后重试 ({60 - int((now - hourly_start).total_seconds() / 60)}m)", 0

            COOLDOWN = 5 if is_pro else 15
            last_time_str = usage_data.get("last_access", {}).get(mode)
            if last_time_str:
                try:
                    last_time = datetime.datetime.fromisoformat(last_time_str)
                    if last_time.tzinfo is None:
                        last_time = last_time.replace(tzinfo=datetime.timezone.utc)
                    delta = (now - last_time).total_seconds()
                    if delta < COOLDOWN: return False, f"AI思考中，请稍后再试", int(COOLDOWN-delta)
                except: pass

            if not is_pro and model_type == "reasoner" and sum(usage_data.get("counts_reasoner", {}).values()) >= 10:
                return False, "深度思考限额已满", -1

            if model_type == "chat":
                current_chat_usage = sum(usage_data.get("counts_chat", {}).values())
                security_limit = 100 if is_pro else 50
                if current_chat_usage >= security_limit:
                    return False, "系统安全风控：今日调用次数异常 (Limit Reached)", 0

            if model_type == "reasoner": usage_data["counts_reasoner"][mode] = usage_data["counts_reasoner"].get(mode, 0) + 1
            else: usage_data["counts_chat"][mode] = usage_data["counts_chat"].get(mode, 0) + 1
                
            usage_data["last_access"][mode] = now.isoformat()
            usage_data.update({"hourly_count": hourly_count + 1, "hourly_start": hourly_start.isoformat()})
            self.users_col.update_one({"username": username}, {"$set": {"usage_stats": usage_data}})
            return True, "OK", 0

    # ==========================
    # 🔥 绝活社区核心逻辑
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
            likes_count = len(result.get('liked_by', []))
            if likes_count >= 10 and not result.get('reward_granted', False) and not result.get('is_fake', False):
                author = result.get('author_id')
                if self.upgrade_user_role(author, days=3):
                    self.tips_col.update_one({"_id": ObjectId(tip_id)}, {"$set": {"reward_granted": True}})
            return True
        except: return False

    def get_mixed_tips(self, hero, enemy, limit=10):
        matchup_tips = list(self.tips_col.find({"hero": hero, "enemy": enemy}).sort([
            ("is_fake", 1), ("liked_by", -1)
        ]).limit(limit))
        for t in matchup_tips: t['tag_label'] = "🔥 对位绝活"

        if len(matchup_tips) < limit:
            needed = limit - len(matchup_tips)
            general_tips = list(self.tips_col.find({"hero": hero, "enemy": "general"}).sort([
                ("is_fake", 1), ("liked_by", -1)
            ]).limit(needed))
            for t in general_tips: t['tag_label'] = "📚 英雄必修"
            matchup_tips.extend(general_tips)

        final_list = []
        for t in matchup_tips:
            author_role = self.check_membership_status(t["author_id"])
            final_list.append({
                "id": str(t['_id']), "title": t.get("title", "英雄技巧"), "content": t["content"],
                "author": t["author_id"], "author_role": author_role, "author_avatar_key": author_role,
                "likes": len(t.get("liked_by", [])), "tags": t.get("tags", []), "tag_label": t["tag_label"],
                "is_pro_author": author_role in ["pro", "vip", "svip", "admin"]
            })
        return final_list

    def get_tips_for_ui(self, hero, enemy, is_general):
        return self.get_mixed_tips(hero, "general" if is_general else enemy)

    def get_top_knowledge_for_ai(self, hero, enemy):
        tips = self.get_mixed_tips(hero, enemy, limit=6)
        return {
            "general": [t['content'] for t in tips if t['tag_label'] == "📚 英雄必修"],
            "matchup": [t['content'] for t in tips if t['tag_label'] == "🔥 对位绝活"]
        }

    def get_corrections(self, my_hero, enemy_hero):
        if self.corrections_col is None: return []
        query = {
            "hero": {"$in": [my_hero, "general", "General"]},
            "enemy": {"$in": [enemy_hero, "general", "General"]}
        }
        try:
            results = list(self.corrections_col.find(query))
            results.sort(key=lambda x: x.get('priority', 50), reverse=True)
            return [r['content'] for r in results]
        except Exception as e:
            print(f"Error fetching corrections: {e}")
            return []

    def create_user(self, username, password, role="user", email="", device_id="unknown", ip="unknown", sales_ref=None):
        if self.get_user(username): return "USERNAME_TAKEN"
        if self.users_col.find_one({"email": email}): return "EMAIL_TAKEN"
        try:
            if device_id and device_id != "unknown_client_error" and self.users_col.count_documents({"device_id": device_id}) >= 3: return "DEVICE_LIMIT"
            if ip and self.users_col.count_documents({"ip": ip, "created_at": {"$gte": datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=1)}}) >= 5: return "IP_LIMIT"

            self.users_col.insert_one({
                "username": username, "password": password, "role": role,
                "email": email, "device_id": device_id, "ip": ip, 
                "created_at": datetime.datetime.now(datetime.timezone.utc),
                "sales_ref": sales_ref
            })
            return True
        except: return False 

    def get_user(self, username): return self.users_col.find_one({"username": username})
    def get_all_feedbacks(self, limit=50): return [dict(doc, _id=str(doc['_id'])) for doc in self.feedback_col.find().sort('_id', -1).limit(limit)]
    def get_prompt_template(self, mode: str): return self.prompt_templates_col.find_one({"mode": mode})
    def get_game_constants(self): return self.config_col.find_one({"_id": "s15_rules"}) or {"patch_version": "Unknown"}
    def delete_tip(self, tip_id):
        if not (oid := self._to_oid(tip_id)): return False
        try: return self.tips_col.delete_one({"_id": ObjectId(tip_id)}).deleted_count > 0
        except: return False
    def get_tip_by_id(self, tip_id):
        if not (oid := self._to_oid(tip_id)): return None
        try:
            tip = self.tips_col.find_one({"_id": ObjectId(tip_id)})
            return dict(tip, id=str(tip['_id']), _id=None) if tip else None
        except: return None
    def submit_feedback(self, data):
        data.update({'created_at': datetime.datetime.now(datetime.timezone.utc), 'status': 'pending'})
        self.feedback_col.insert_one(data)

    def get_all_users(self, limit=20, search=""):
        query = {"username": {"$regex": search, "$options": "i"}} if search else {}
        users = list(self.users_col.find(query, {"password": 0, "usage_stats": 0}).sort("created_at", -1).limit(limit))
        for u in users:
            u["_id"] = str(u["_id"])
            if u.get("created_at"): u["created_at"] = u["created_at"].isoformat()
            if u.get("membership_expire"): u["membership_expire"] = u["membership_expire"].isoformat()
        return users

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
            self.tips_col.update_many({"author_id": username}, {"$set": {"author_id": new_name}})
            self.orders_col.update_many({"username": username}, {"$set": {"username": new_name}})
            return True, f"更名成功"
        elif action == "delete":
            self.users_col.delete_one({"username": username})
            return True, "用户已删除"
        return False, "未知操作"

    def get_admin_sales_summary(self):
        pipeline = [
            {"$group": {
                "_id": "$salesperson", "total_commission": {"$sum": "$commission"},
                "total_sales": {"$sum": "$order_amount"}, "order_count": {"$sum": 1},
                "last_order_date": {"$max": "$created_at"}
            }},
            {"$sort": {"total_commission": -1}}
        ]
        try: results = list(self.sales_records_col.aggregate(pipeline))
        except Exception as e: return []
        final_list = []
        for r in results:
            username = r["_id"]
            user = self.users_col.find_one({"username": username})
            contact = user.get("email", "未绑定邮箱") if user else "未知用户"
            game_name = "未同步"
            if user and user.get("game_profile"):
                if isinstance(user["game_profile"], dict): game_name = user["game_profile"].get("gameName", "未同步")
                elif isinstance(user["game_profile"], str):
                    try: game_name = json.loads(user["game_profile"]).get("gameName", "未同步")
                    except: pass
            final_list.append({
                "username": username, "game_name": game_name, "contact": contact,
                "total_commission": round(r["total_commission"], 2), "total_sales": round(r["total_sales"], 2),
                "order_count": r["order_count"],
                "last_active": r["last_order_date"].strftime("%Y-%m-%d %H:%M") if r["last_order_date"] else "-"
            })
        return final_list

    def get_sales_dashboard_data(self, username):
            pipeline = [
                {"$match": {"salesperson": username}},
                {"$group": {
                    "_id": None, "total_commission": {"$sum": "$commission"},
                    "total_orders": {"$sum": 1}, "total_sales": {"$sum": "$order_amount"}
                }}
            ]
            stats = list(self.sales_records_col.aggregate(pipeline))
            base_data = stats[0] if stats else {"total_commission": 0, "total_orders": 0, "total_sales": 0}
            today_start = datetime.datetime.now(datetime.timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
            today_stats = self.sales_records_col.aggregate([
                {"$match": {"salesperson": username, "created_at": {"$gte": today_start}}},
                {"$group": {"_id": None, "today_earnings": {"$sum": "$commission"}}}
            ])
            today_data = list(today_stats)
            today_earnings = today_data[0]['today_earnings'] if today_data else 0
            recent_records = list(self.sales_records_col.find(
                {"salesperson": username}, {"source_user": 1, "commission": 1, "created_at": 1, "rate": 1}
            ).sort("created_at", -1).limit(10))
            formatted_records = []
            for r in recent_records:
                formatted_records.append({
                    "source": r.get("source_user", "未知用户")[:3] + "***",
                    "amount": r.get("commission", 0),
                    "time": r.get("created_at").strftime("%H:%M"),
                    "rate": r.get("rate", "40%")
                })
            return {
                "total_earnings": round(base_data['total_commission'], 2),
                "today_earnings": round(today_earnings, 2),
                "total_orders": base_data['total_orders'],
                "conversion_rate": "40%",
                "recent_records": formatted_records
            }

    def get_wiki_posts(self, hero_id=None, category=None, limit=20):
        query = {}
        if hero_id: query["hero_id"] = str(hero_id)
        if category and category != "all": query["category"] = category
        posts = list(self.wiki_posts.find(query).sort([("is_ai_pick", -1), ("likes", -1)]).limit(limit))
        for p in posts:
            p["id"] = str(p["_id"])
            del p["_id"]
        return posts

    def create_wiki_post(self, data):
        data["created_at"] = datetime.datetime.now(datetime.timezone.utc)
        data["likes"] = 0
        data["views"] = 0
        data["is_ai_pick"] = False
        data["ref_id"] = f"#U-{int(time.time()) % 10000:04d}"
        res = self.wiki_posts.insert_one(data)
        data["id"] = str(res.inserted_id)
        del data["_id"]
        return data

    def get_tavern_posts(self, topic=None, limit=50):
        query = {}
        if topic and topic != "all": query["topic"] = topic
        posts = list(self.tavern_posts.find(query).sort("created_at", -1).limit(limit))
        for p in posts:
            p["id"] = str(p["_id"])
            del p["_id"]
        return posts

    def create_tavern_post(self, data):
        data["created_at"] = datetime.datetime.now(datetime.timezone.utc)
        data["likes"] = 0
        data["comments"] = 0
        res = self.tavern_posts.insert_one(data)
        data["id"] = str(res.inserted_id)
        del data["_id"]
        return data

    def get_wiki_summary(self, hero_id):
        summary = self.wiki_summaries.find_one({"hero_id": str(hero_id)})
        if summary:
            summary["id"] = str(summary["_id"])
            del summary["_id"]
        return summary

    def add_comment(self, post_id, user_id, user_name, content):
        if not (oid := self._to_oid(post_id)): return None
        comment = {
            "post_id": str(post_id), "user_id": str(user_id), "user_name": user_name,
            "content": content, "likes": 0, "created_at": datetime.datetime.now(datetime.timezone.utc)
        }
        res = self.comments_col.insert_one(comment)
        self.wiki_posts.update_one({"_id": ObjectId(post_id)}, {"$inc": {"comments": 1}})
        self.tavern_posts.update_one({"_id": ObjectId(post_id)}, {"$inc": {"comments": 1}})
        comment["id"] = str(res.inserted_id)
        del comment["_id"]
        return comment

    def get_comments(self, post_id):
        comments = list(self.comments_col.find({"post_id": str(post_id)}).sort("created_at", 1))
        for c in comments:
            c["id"] = str(c["_id"])
            del c["_id"]
            if c.get("created_at"):
                c["created_at"] = c["created_at"].strftime("%Y-%m-%d %H:%M")
        return comments
    
    def get_wiki_post(self, post_id):
        try:
            post = self.wiki_posts.find_one({"_id": ObjectId(post_id)})
            if post:
                post["id"] = str(post["_id"])
                del post["_id"]
            return post
        except: return None

    def get_tavern_post(self, post_id):
        try:
            post = self.tavern_posts.find_one({"_id": ObjectId(post_id)})
            if post:
                post["id"] = str(post["_id"])
                del post["_id"]
            return post
        except: return None

    def update_wiki_post(self, post_id, updates):
        if not (oid := self._to_oid(post_id)): return False
        try:
            for field in ["_id", "author_id", "created_at", "ref_id"]: updates.pop(field, None)
            result = self.wiki_posts.update_one({"_id": ObjectId(post_id)}, {"$set": updates})
            return result.modified_count > 0
        except: return False

    def update_tavern_post(self, post_id, updates):
        try:
            for field in ["_id", "author_id", "created_at"]: updates.pop(field, None)
            result = self.tavern_posts.update_one({"_id": ObjectId(post_id)}, {"$set": updates})
            return result.modified_count > 0
        except: return False