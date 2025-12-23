import os
import datetime
from pymongo import MongoClient
from bson.objectid import ObjectId

class KnowledgeBase:
    def __init__(self):
        # 🟢 自动切换：如果在 Sealos 上跑，会自动获取环境变量；
        # 🟢 本地开发：默认连接 localhost:27017 (你需要确保本地安装并启动了 MongoDB)
        self.uri = os.getenv("MONGO_URI", "mongodb://localhost:27017")
        
        try:
            self.client = MongoClient(self.uri, serverSelectionTimeoutMS=5000)
            # 测试连接
            self.client.server_info()
            print(f"✅ 成功连接到数据库: {self.uri}")
        except Exception as e:
            print(f"❌ 数据库连接失败: {e}")
            print("请检查：1. 是否安装了 MongoDB？ 2. MongoDB 服务是否已启动？")

        self.db = self.client['lol_community']
        self.collection = self.db['tips']

    def get_tips_for_ui(self, hero, enemy, is_general):
        """给前端展示用的：按点赞数倒序"""
        query = {"hero": hero}
        
        # 区分是通用技巧还是对位技巧
        if is_general:
            query["enemy"] = "general"
        else:
            query["enemy"] = enemy
        
        # 从数据库查找
        tips = list(self.collection.find(query))
        
        # 处理数据格式供前端使用 (把 ObjectId 转为字符串)
        for tip in tips:
            tip['id'] = str(tip['_id'])
            del tip['_id']
            if 'liked_by' not in tip: tip['liked_by'] = []
            
        # 按点赞人数倒序排序 (赞多的在前面)
        tips.sort(key=lambda x: len(x.get('liked_by', [])), reverse=True)
        return tips

    def get_top_knowledge_for_ai(self, hero, enemy):
        """给 AI 用的：只取前 3 名优质内容，防止被垃圾信息误导"""
        # 1. 获取通用绝活 Top 3
        gen_tips = self.get_tips_for_ui(hero, enemy, True)[:3]
        # 2. 获取对位绝活 Top 3
        match_tips = self.get_tips_for_ui(hero, enemy, False)[:3]
        
        return {
            "general": [t['content'] for t in gen_tips],
            "matchup": [t['content'] for t in match_tips]
        }

    def add_tip(self, hero, enemy, content, author_id, is_general):
        """添加一条新绝活"""
        new_tip = {
            "hero": hero,
            "enemy": "general" if is_general else enemy,
            "content": content,
            "author_id": author_id,
            "liked_by": [],
            "created_at": datetime.datetime.utcnow()
        }
        self.collection.insert_one(new_tip)

    def toggle_like(self, tip_id, user_id):
        """点赞/取消点赞 (这里只实现点赞，防止重复)"""
        try:
            # 原子操作：如果该用户没赞过，就 push 进去
            result = self.collection.update_one(
                {"_id": ObjectId(tip_id), "liked_by": {"$ne": user_id}}, 
                {"$push": {"liked_by": user_id}}
            )
            return result.modified_count > 0
        except:
            return False

    def delete_tip(self, tip_id):
        """删除评论"""
        try:
            self.collection.delete_one({"_id": ObjectId(tip_id)})
            return True
        except:
            return False