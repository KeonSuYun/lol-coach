// src/utils/aiStream.js

// 根据您的环境配置 API 地址
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

/**
 * 流式请求 AI 分析接口
 * @param {Object} payload - 请求参数 (myHero, enemyHero, etc.)
 * @param {string} token - 用户 Token
 * @param {Function} onDelta - 接收每个字符的回调 (用于打字机效果)
 * @param {Function} onDone - 完成时的回调 (返回解析后的 JSON 对象)
 * @param {Function} onError - 错误回调
 */
export async function analyzeStream(payload, token, onDelta, onDone, onError) {
  try {
    const res = await fetch(`${API_BASE_URL}/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      // 尝试读取错误信息
      const errText = await res.text();
      let errMsg = `HTTP ${res.status}`;
      try {
        const errJson = JSON.parse(errText);
        // 如果后端返回了特定的错误结构 (如 concise.content)
        if (errJson?.concise?.content) errMsg = errJson.concise.content;
        else if (errJson?.detail) errMsg = errJson.detail;
      } catch (e) {}
      throw new Error(errMsg);
    }

    if (!res.body) throw new Error("ReadableStream not supported");

    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");

    let raw = "";
    
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value, { stream: true });
      raw += chunk;
      
      // ✅ 实时将字符推给 UI
      onDelta?.(chunk); 
    }

    // --- 数据清洗与解析 ---
    
    // 1. 提取 <think> 内容 (如果有)
    const thinkMatch = raw.match(/<think>([\s\S]*?)<\/think>/);
    const thinkContent = thinkMatch ? thinkMatch[1] : "";

    // 2. 剥离 <think> 标签，获取纯 JSON 文本
    let jsonText = raw.replace(/<think>[\s\S]*?<\/think>/g, "").trim();

    // 3. 尝试解析 JSON
    // 注意：AI 有时会在 JSON 外面包裹 ```json ... ```，需要清洗
    if (jsonText.startsWith("```json")) {
        jsonText = jsonText.replace(/^```json/, "").replace(/```$/, "");
    } else if (jsonText.startsWith("```")) {
        jsonText = jsonText.replace(/^```/, "").replace(/```$/, "");
    }

    try {
        const data = JSON.parse(jsonText);
        // 将思考过程注入回 data 对象，方便 UI 展示 (可选)
        if (thinkContent) {
            data._thinking = thinkContent;
        }
        onDone?.(data, raw);
    } catch (parseErr) {
        console.warn("JSON Parse Warning (Truncated?):", parseErr);
        // 🔥 [核心修复] 如果解析失败（比如因为 Token 限制导致截断），
        // 不要抛出 Error，而是传入 raw 文本，让前端 UI 的容错解析器去处理。
        // AnalysisResult 组件里有 tryFixAndParse 可以处理这种情况。
        onDone?.(null, raw);
    }

  } catch (e) {
    onError?.(e);
  }
}