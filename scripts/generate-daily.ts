import { prisma } from "../src/lib/db";
import { generateDailyDigestForChannel } from "../src/lib/digest/generator";

async function main() {
  const targetDate =
    process.env.TARGET_DATE || new Date().toISOString().split("T")[0];
  const targetChannelId = process.env.CHANNEL_ID || "";
  const baseUrl =
    process.env.BASE_URL || "https://daily-rss-digest.netlify.app";

  console.log("==========================================");
  console.log("🚀 开始执行每日 RSS 晨报生成自动化任务");
  console.log(`📅 目标日期: ${targetDate}`);
  console.log(`🌐 站点基准 URL: ${baseUrl}`);
  console.log("==========================================");

  // 查询待生成的频道
  const whereCondition: any = { isEnabled: true };
  if (targetChannelId) {
    whereCondition.id = targetChannelId;
  }

  const channels = await prisma.channel.findMany({
    where: whereCondition,
    include: {
      sources: {
        where: { status: "ACTIVE" },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  if (channels.length === 0) {
    console.log("⚠️ 未检索到任何有效激活的频道，任务结束。");
    return;
  }

  console.log(`📋 共发现 ${channels.length} 个激活频道待处理。\n`);

  const report: {
    channel: string;
    status: "SUCCESS" | "FAILED" | "SKIPPED";
    duration: string;
    articlesCount?: number;
    error?: string;
  }[] = [];

  for (let i = 0; i < channels.length; i++) {
    const channel = channels[i];
    const prefix = `[${i + 1}/${channels.length}]「${channel.name}」`;

    if (channel.sources.length === 0) {
      console.log(`${prefix} 未配置任何活跃订阅源，跳过。`);
      report.push({
        channel: channel.name,
        status: "SKIPPED",
        duration: "0s",
        error: "无活跃订阅源",
      });
      continue;
    }

    console.log(
      `${prefix} 开始处理，包含 ${channel.sources.length} 个订阅源...`
    );
    const start = Date.now();

    try {
      const digest = await generateDailyDigestForChannel({
        channelId: channel.id,
        date: targetDate,
        baseUrl,
      });

      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      console.log(
        `✅ ${prefix} 生成成功！耗时: ${elapsed}s | 汇集文章: ${digest.articleCount} 篇 | 标题: ${digest.title}`
      );

      report.push({
        channel: channel.name,
        status: "SUCCESS",
        duration: `${elapsed}s`,
        articlesCount: digest.articleCount,
      });
    } catch (err: any) {
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      console.error(
        `❌ ${prefix} 生成失败！耗时: ${elapsed}s | 错误: ${err.message}`
      );

      report.push({
        channel: channel.name,
        status: "FAILED",
        duration: `${elapsed}s`,
        error: err.message,
      });
    }
  }

  console.log("\n==========================================");
  console.log("📊 每日晨报生成汇总报告：");
  console.table(report);
  console.log("==========================================");

  const hasFailure = report.some((r) => r.status === "FAILED");
  if (hasFailure) {
    console.warn("⚠️ 部分频道生成存在失败，请检查上方日志。");
  } else {
    console.log("🎉 全部频道晨报生成完毕！");
  }
}

main()
  .catch((err) => {
    console.error("💥 脚本执行发生致命异常:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
