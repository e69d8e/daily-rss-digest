import { NextResponse } from "next/server";
import { isAuthRequired, verifyAdminAuth } from "@/lib/auth";
import { cookies } from "next/headers";

export async function GET(req: Request) {
  try {
    const required = isAuthRequired();
    const authenticated = await verifyAdminAuth(req);
    return NextResponse.json({
      required,
      authenticated,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { password } = body;
    const adminPassword = process.env.ADMIN_PASSWORD?.trim();

    if (!adminPassword) {
      return NextResponse.json({ success: true, message: "无需密码" });
    }

    if (!password || password.trim() !== adminPassword) {
      return NextResponse.json({ error: "密码错误，请重新输入" }, { status: 401 });
    }

    const cookieStore = await cookies();
    cookieStore.set("admin_session", adminPassword, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 天有效
      path: "/",
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete("admin_session");
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
