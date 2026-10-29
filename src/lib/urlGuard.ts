import { lookup } from "dns/promises";

/**
 * SSRF 防护：校验目标 URL 是否指向公网地址。
 * 用于服务端代替用户发起 HTTP 抓取的接口（如文章全文抓取），
 * 防止攻击者利用服务器探测内网或访问云厂商元数据端点。
 */

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return true; // 格式异常一律视为不安全
  }
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true; // 未指定/私网/环回
  if (a === 169 && b === 254) return true; // 链路本地（含云元数据 169.254.169.254）
  if (a === 172 && b >= 16 && b <= 31) return true; // 私网
  if (a === 192 && b === 168) return true; // 私网
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a === 192 && b === 0) return true; // 协议保留段
  if (a === 198 && (b === 18 || b === 19)) return true; // 基准测试段
  if (a >= 224) return true; // 组播与保留段
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  // IPv4 映射地址 ::ffff:a.b.c.d 按原 IPv4 规则判断
  const v4Mapped = lower.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (v4Mapped) return isPrivateIPv4(v4Mapped[1]);
  if (lower === "::" || lower === "::1") return true; // 未指定/环回
  if (/^f[cd]/.test(lower)) return true; // fc00::/7 唯一本地地址
  if (/^fe[89ab]/.test(lower)) return true; // fe80::/10 链路本地
  return false;
}

/**
 * 校验 URL 是否可以安全地从服务端发起抓取：
 * 仅允许 http/https 协议、不含凭据、且 DNS 解析结果全部为公网地址。
 */
export async function isSafePublicUrl(rawUrl: string): Promise<boolean> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
  if (parsed.username || parsed.password) return false;

  const hostname = parsed.hostname.replace(/^\[|\]$/g, "");
  if (!hostname) return false;
  if (
    /^localhost$/i.test(hostname) ||
    hostname.toLowerCase().endsWith(".localhost") ||
    hostname.toLowerCase().endsWith(".local") ||
    hostname.toLowerCase().endsWith(".internal")
  ) {
    return false;
  }

  try {
    const addrs = await lookup(hostname, { all: true, verbatim: true });
    if (addrs.length === 0) return false;
    for (const { address, family } of addrs) {
      if (family === 4 && isPrivateIPv4(address)) return false;
      if (family === 6 && isPrivateIPv6(address)) return false;
    }
    return true;
  } catch {
    return false; // DNS 解析失败一律视为不安全
  }
}
