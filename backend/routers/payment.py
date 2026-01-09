"""
支付相关路由模块

包含爱发电订单处理和邀请码功能
"""
import os
import time
import json
import hashlib
import requests
import datetime
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from typing import Optional

from core.logger import logger
from .dependencies import get_current_user, db

# 创建路由器
router = APIRouter()

# 爱发电配置
AFDIAN_USER_ID = os.getenv("AFDIAN_USER_ID")
AFDIAN_TOKEN = os.getenv("AFDIAN_TOKEN")


# ================= 数据模型 =================

class InviteRequest(BaseModel):
    invite_code: str


# ================= 辅助函数 =================

def calculate_new_expire(user_obj, days=3):
    """计算会员过期时间:在当前剩余时间基础上增加,或从现在开始计算"""
    now = datetime.datetime.now(datetime.timezone.utc)
    current_expire = user_obj.get('membership_expire')

    # 确保数据库取出的时间带时区信息
    if current_expire and current_expire.tzinfo is None:
        current_expire = current_expire.replace(tzinfo=datetime.timezone.utc)

    # 如果已过期或没有记录,从现在开始算
    if not current_expire or current_expire < now:
        return now + datetime.timedelta(days=days)
    else:
        # 如果没过期,在原基础上顺延
        return current_expire + datetime.timedelta(days=days)


def verify_afdian_order(order_no, amount_str):
    """辅助函数:调用爱发电 API 查单"""
    try:
        ts = int(time.time())
        params = json.dumps({"out_trade_no": order_no})
        sign_str = f"{AFDIAN_TOKEN}params{params}ts{ts}user_id{AFDIAN_USER_ID}"
        sign = hashlib.md5(sign_str.encode('utf-8')).hexdigest()

        url = "https://afdian.com/api/open/query-order"
        payload = {
            "user_id": AFDIAN_USER_ID,
            "params": params,
            "ts": ts,
            "sign": sign
        }

        resp = requests.get(url, params=payload, timeout=5)
        res_json = resp.json()

        if res_json['ec'] != 200:
            return False

        order_list = res_json.get('data', {}).get('list', [])
        for order in order_list:
            if order['out_trade_no'] == order_no:
                if str(order['total_amount']) == str(amount_str):
                    return True
        return False
    except Exception as e:
        logger.info(f"Verification Error: {e}")
        return False


# ================= 路由处理函数 =================

@router.post("/user/redeem_invite")
async def redeem_invite(
    payload: InviteRequest,
    current_user: dict = Depends(get_current_user)
):
    """邀请码绑定战友"""
    target_username = payload.invite_code.strip()
    if not target_username:
        raise HTTPException(status_code=400, detail="请输入战友的契约代码")

    if target_username == current_user['username']:
        raise HTTPException(status_code=400, detail="无法与自己缔结契约")

    # 1. 获取当前用户 (操作人 A)
    user_a = db.users_col.find_one({"_id": current_user["_id"]})
    if not user_a:
        raise HTTPException(status_code=404, detail="用户数据同步错误")

    # 2. 获取目标用户 (战友 B)
    user_b = db.users_col.find_one({"username": target_username})
    if not user_b:
        raise HTTPException(status_code=404, detail="未找到该用户,请检查ID是否正确")

    # 3. 校验:战友 B 必须是"单身" (invited_by 字段必须为空)
    if user_b.get('invited_by'):
        raise HTTPException(status_code=400, detail=f"用户 [{target_username}] 已经有战友了,无法进行绑定。")

    # 4. 防同设备刷号风控 (防止自己建小号互刷)
    user_device = str(user_a.get("device_id", "unknown")).lower()
    target_device = str(user_b.get("device_id", "unknown")).lower()
    invalid_fps = ["unknown", "unknown_client_error", "none", ""]

    if (user_device not in invalid_fps) and (user_device == target_device):
        logger.info(f"[Security] 拦截同设备互刷: {user_a['username']} <-> {user_b['username']}")
        raise HTTPException(status_code=400, detail="系统检测到设备环境异常 (同设备无法建立契约)")

    # === 核心逻辑:更换次数与解绑处理 ===

    MAX_CHANGES = 4
    a_change_count = user_a.get('invite_change_count', 0)

    # 场景 A: 当前用户已有旧战友 (执行更换逻辑)
    if user_a.get('invited_by'):
        # 检查剩余次数
        if a_change_count >= MAX_CHANGES:
            raise HTTPException(status_code=400, detail=f"您的更换次数已耗尽 (0/{MAX_CHANGES}),契约已锁定。")

        old_partner_id = user_a['invited_by']

        # --- 对【旧战友 (C)】执行"连坐"处理 ---
        # 1. 解除绑定 (恢复自由身)
        # 2. 强制扣除 1 次更换机会 (因为关系破裂)
        db.users_col.update_one(
            {"_id": old_partner_id},
            {
                "$set": {"invited_by": None},
                "$inc": {"invite_change_count": 1}
            }
        )

        # A 的扣次将在下方 update_one 中统一执行 (原子操作)

    # 场景 B: 当前用户是第一次绑定 -> 不扣次,直接建立关系

    # === 执行双向绑定 (A <-> B) ===

    # 1. 更新 A (操作人)
    db.users_col.update_one(
        {"_id": user_a['_id']},
        {
            "$set": {
                "invited_by": user_b['_id'],           # 指向 B
                "role": "pro",                         # 激活 Pro 身份
                "membership_expire": calculate_new_expire(user_a, 3),  # 加 3 天
                "invite_time": datetime.datetime.now(datetime.timezone.utc)
            },
            # 如果 A 原本有战友,则本次操作算"更换",次数+1;否则+0
            "$inc": {"invite_change_count": 1 if user_a.get('invited_by') else 0}
        }
    )

    # 2. 更新 B (被绑定人)
    # B 是被动绑定的,不扣除更换次数,直接获得奖励
    db.users_col.update_one(
        {"_id": user_b['_id']},
        {
            "$set": {
                "invited_by": user_a['_id'],           # 指向 A (双向)
                "role": "pro",                         # 激活 Pro 身份
                "membership_expire": calculate_new_expire(user_b, 3)  # 加 3 天
            }
        }
    )

    return {"status": "success", "msg": "契约缔结成功!双方 Pro 权限已激活。"}


@router.post("/api/webhook/afdian")
async def afdian_webhook(request: Request):
    """接收爱发电的订单回调"""
    try:
        data = await request.json()
    except:
        return {"ec": 400, "em": "Invalid JSON"}

    if data.get('ec') != 200:
        return {"ec": 200}  # 忽略错误回调

    order_data = data.get('data', {}).get('order', {})
    out_trade_no = order_data.get('out_trade_no')
    remark = order_data.get('remark', '').strip()  # 用户名
    amount = order_data.get('total_amount')
    sku_detail = order_data.get('sku_detail', [])

    if not out_trade_no:
        return {"ec": 200}

    # 安全验证 (防止伪造回调)
    if AFDIAN_USER_ID and AFDIAN_TOKEN:
        verified = verify_afdian_order(out_trade_no, amount)
        if not verified:
            logger.info(f"[Security] 拦截伪造的爱发电订单: {out_trade_no}")
            return {"ec": 200}
    else:
        logger.info("未配置爱发电 Token,跳过二次验证 (仅开发环境建议)")

    if not remark:
        logger.info(f"订单 {out_trade_no} 未填写用户名,需人工处理")
        return {"ec": 200}

    # 调用数据库处理
    db.process_afdian_order(out_trade_no, remark, amount, sku_detail)

    return {"ec": 200}
