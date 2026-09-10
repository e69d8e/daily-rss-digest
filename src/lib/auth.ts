import { cookies } from "next/headers";

/**
 * 检查当前系统是否启用了管理访问密码保护
 */
export function isAuthRequired(): boolean {
  return Boolean(
    process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD.trim().length > 0
  );
}

/**
 * 服务端鉴权检查
 * 支持 Cookie (admin_session) 与 请求头 (x-admin-password / Authorization)
 */
export async function verifyAdminAuth(req?: Request): Promise<boolean> {
  const adminPassword = process.env.ADMIN_PASSWORD?.trim();
  if (!adminPassword) {
    // 未在环境变量中配置 ADMIN_PASSWORD 时，开放访问（便利本地开发）
    return true;
  }

  // 1. 检查请求头
  if (req) {
    const headerPass = req.headers.get("x-admin-password");
    if (headerPass && headerPass === adminPassword) {
      return true;
    }

    const authHeader = req.headers.get("authorization");
    if (authHeader && authHeader === `Bearer ${adminPassword}`) {
      return true;
    }
  }

  // 2. 检查 Cookie
  try {
    const cookieStore = await cookies();
    const sessionVal = cookieStore.get("admin_session")?.value;
    if (sessionVal && sessionVal === adminPassword) {
      return true;
    }
  } catch {
    // 在某些静态上下文可能无法访问 cookies
  }

  return false;
}
