import { NextResponse } from "next/server";
import { callLlmModel, parseJsonFromLlmOutput } from "@/lib/ai/summarizer";
import { prisma } from "@/lib/db";
import { verifyAdminAuth } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const isAuthed = await verifyAdminAuth(req);
    if (!isAuthed) {
      return NextResponse.json(
        { error: "未授权：请先输入管理密码" },
        { status: 401 }
      );
    }

    const body = await req.json();
    let { apiFormat = "chat_completions", apiKey, baseURL, model } = body;

    // 如果客户端传入的是脱敏掩码或为空，则读取服务器端存储的真实密钥
    if (!apiKey || !apiKey.trim() || apiKey.includes("•••") || apiKey.includes("云端环境变量")) {
      const dbKey = await prisma.systemSetting.findUnique({
        where: { key: "ai_api_key" },
      });
      apiKey = dbKey?.value || process.env.AI_API_KEY || "";
    }

    if (!apiKey || !apiKey.trim()) {
      return NextResponse.json(
        { error: "未检测到有效 API Key，请填写密钥或在云端环境变量中配置 AI_API_KEY" },
        { status: 400 }
      );
    }

    const startTime = Date.now();
    const rawOutput = await callLlmModel({
      apiFormat,
      apiKey: apiKey.trim(),
      baseURL: baseURL?.trim() || "https://api.deepseek.com/v1",
      model: model?.trim() || "deepseek-chat",
      temperature: 0.1,
      systemPrompt:
        'You are an AI test probe. Respond with only JSON: {"status": "ok", "message": "Connection successful!"}',
      userPrompt: "Hello, test probe!",
    });
    const latencyMs = Date.now() - startTime;

    let message = "连通性测试成功";
    try {
      const parsed = parseJsonFromLlmOutput(rawOutput);
      message = parsed.message || parsed.status || message;
    } catch {
      message = rawOutput.slice(0, 100);
    }

    return NextResponse.json({
      success: true,
      latencyMs,
      message,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "测试连接失败" },
      { status: 400 }
    );
  }
}
