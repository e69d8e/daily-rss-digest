import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 开始初始化 Daily RSS Digest 基础数据...");

  // 1. 初始化频道
  const techChannel = await prisma.channel.upsert({
    where: { slug: "tech-ai" },
    update: {},
    create: {
      name: "科技与前沿 AI",
      slug: "tech-ai",
      description: "追踪大语言模型、开源算力、前沿科技突破与开发者生态",
      icon: "cpu",
      scheduleTime: "08:00",
      promptTemplate: "重点聚焦 AI 模型架构突破、商业化落地与开发者生态，去除公关营销软文。",
      filterKeywords: JSON.stringify({
        include: ["AI", "模型", "开源", "架构", "芯片", "Agent", "算法", "发布", "技术"],
        exclude: ["招聘", "兼职", "赞助商广告", "优惠促销"],
      }),
      isEnabled: true,
      sources: {
        create: [
          {
            title: "阮一峰的网络日志",
            url: "http://www.ruanyifeng.com/blog/atom.xml",
            siteUrl: "https://www.ruanyifeng.com/blog/",
            isFullTextFetch: false,
            status: "ACTIVE",
          },
          {
            title: "Solidot 奇客",
            url: "https://www.solidot.org/index.rss",
            siteUrl: "https://www.solidot.org/",
            isFullTextFetch: false,
            status: "ACTIVE",
          },
          {
            title: "量子位 · 前沿AI",
            url: "https://www.qbitai.com/feed",
            siteUrl: "https://www.qbitai.com",
            isFullTextFetch: false,
            status: "ACTIVE",
          },
          {
            title: "极客公园",
            url: "https://www.geekpark.net/rss",
            siteUrl: "https://www.geekpark.net",
            isFullTextFetch: false,
            status: "ACTIVE",
          },
        ],
      },
    },
  });

  const productChannel = await prisma.channel.upsert({
    where: { slug: "product-design" },
    update: {},
    create: {
      name: "独立创造与产品",
      slug: "product-design",
      description: "发现独立开发、数字化工具、交互设计与创意工程作品",
      icon: "sparkles",
      scheduleTime: "08:30",
      promptTemplate: "关注独立创造者故事、新奇工具与生产力实践，提炼商业闭环与设计亮点。",
      isEnabled: true,
      sources: {
        create: [
          {
            title: "少数派",
            url: "https://sspai.com/feed",
            siteUrl: "https://sspai.com",
            isFullTextFetch: false,
            status: "ACTIVE",
          },
        ],
      },
    },
  });

  const businessChannel = await prisma.channel.upsert({
    where: { slug: "business-macro" },
    update: {},
    create: {
      name: "全球商业与宏观",
      slug: "business-macro",
      description: "宏观经济周报、商业科技独角兽财报与全球投资风向",
      icon: "trending-up",
      scheduleTime: "09:00",
      promptTemplate: "提炼商业数据、市场估值变化与政策风向，条理清晰、数字严谨。",
      isEnabled: true,
      sources: {
        create: [
          {
            title: "36氪 8点1氪",
            url: "https://36kr.com/feed",
            siteUrl: "https://36kr.com",
            isFullTextFetch: false,
            status: "ACTIVE",
          },
          {
            title: "界面新闻 · 商业与宏观",
            url: "https://a.jiemian.com/index.php?m=article&a=rss",
            siteUrl: "https://www.jiemian.com",
            isFullTextFetch: false,
            status: "ACTIVE",
          },
        ],
      },
    },
  });

  // 2. 初始化默认系统设置
  const defaultSettings = [
    { key: "ai_provider", value: "deepseek" },
    { key: "ai_base_url", value: "https://api.deepseek.com/v1" },
    { key: "ai_model", value: "deepseek-chat" },
    { key: "ai_temperature", value: "0.4" },
    { key: "notify_enable_feishu", value: "false" },
    { key: "notify_enable_wecom", value: "false" },
    { key: "notify_enable_telegram", value: "false" },
    { key: "notify_enable_discord", value: "false" },
    { key: "notify_enable_email", value: "false" },
  ];

  for (const s of defaultSettings) {
    await prisma.systemSetting.upsert({
      where: { key: s.key },
      update: {},
      create: s,
    });
  }

  // 3. 预置今日样例晨报 (科技与前沿 AI)
  const today = new Date().toISOString().split("T")[0];

  const sampleTopics = [
    {
      id: "t1",
      title: "自主智能体（Agentic AI）从实验室走向生产环境：评估基准与长链路工作流实战",
      summary:
        "多家技术团队最新开源了新一代 Agent 协作编排框架。随着上下文长度和结构化推理能力的突破，智能体已逐步从单步代码补全过渡到多阶段自我验证、多工具协同的自动化交付。实测在复杂工程重构与数据清洗任务中，端到端自动化率提升近 40%。",
      impactScore: 9,
      sentiment: "positive",
      tags: ["Agentic AI", "自动化工作流", "开源生态"],
      sources: [
        {
          sourceName: "机器之心",
          articleTitle: "智能体系统架构演进：从单轮对话到自主多 Agent 协作网络",
          url: "https://www.jiqizhixin.com",
        },
        {
          sourceName: "Solidot 奇客",
          articleTitle: "深度评测：下一代代码助手中的自省机制与验证基准",
          url: "https://www.solidot.org",
        },
      ],
    },
    {
      id: "t2",
      title: "开源端侧小模型与量化推理突破：个人终端跑大模型的黄金时代",
      summary:
        "端侧大模型在 3B 至 8B 尺寸上的性能持续跃升，最新发布的 4-bit 量化方案使旗舰手机与轻薄笔记本无需外置显卡即可实现每秒超过 35 Token 的流畅推理，为离线隐私计算和极速本地交互打开全新想象空间。",
      impactScore: 8,
      sentiment: "positive",
      tags: ["端侧 AI", "量化推理", "算力普惠"],
      sources: [
        {
          sourceName: "阮一峰的网络日志",
          articleTitle: "科技爱好者周刊：本地部署轻量模型的最佳实践",
          url: "https://www.ruanyifeng.com/blog/",
        },
      ],
    },
    {
      id: "t3",
      title: "数据中心绿色算力与高能效互联标准确立",
      summary:
        "全球算力基础设施面临巨大的能耗与散热挑战，最新行业共识正加速转向液冷与光互联技术。算力中心在提升每瓦特 FLOPS 产出比方面取得显著进展，新一代低延迟拓扑网络成为关键竞争壁垒。",
      impactScore: 7,
      sentiment: "neutral",
      tags: ["绿色计算", "硬件架构", "算力基建"],
      sources: [
        {
          sourceName: "Solidot 奇客",
          articleTitle: "算力竞赛背后的电力账单：新一代液冷与网络架构演变",
          url: "https://www.solidot.org",
        },
      ],
    },
  ];

  await prisma.dailyDigest.upsert({
    where: {
      channelId_date: {
        channelId: techChannel.id,
        date: today,
      },
    },
    update: {},
    create: {
      channelId: techChannel.id,
      date: today,
      title: `${today} 科技与前沿 AI·今日智汇晨报`,
      overview: `今日重点聚焦于 **自主智能体协同架构** 的生产落地与 **端侧轻量小模型** 的量化突破。多份技术报告与评测显示，AI 正加速从被动对话界面转变为可独立执行闭环任务的主动助理；同时，算力基础设施关于高能效比与液冷互联的讨论也达到了近期高点。`,
      sectionsJson: JSON.stringify({
        topics: sampleTopics,
        industryInsights: [
          "智能体生态正在快速规范化，工具调用协议与长链路测试基准将成为下一阶段核心竞争点。",
          "边缘计算与端侧推理的成熟，将重构个人生产力软件与笔记/本地知识库形态。",
        ],
      }),
      audioText: `早上好！今天是${today}。为您播报今日科技与前沿AI晨报：今天全网焦点主要集中在自主智能体在生产环境的工程化落地，端侧量化小模型的推理速度突破，以及数据中心对高能效算力互联的最新探索。祝您今天充满创造力！`,
      articleCount: 18,
      status: "COMPLETED",
    },
  });

  console.log("✅ 种子数据填充完成！已创建默认频道、RSS 源以及今日样例晨报。");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
