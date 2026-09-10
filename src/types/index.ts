export interface FilterKeywordsConfig {
  include?: string[];
  exclude?: string[];
}

export interface TopicItem {
  id: string;
  title: string;
  summary: string;
  impactScore?: number; // 1 - 10
  sentiment?: "positive" | "neutral" | "negative" | "critical";
  tags?: string[];
  sources: {
    sourceName: string;
    articleTitle: string;
    url: string;
    author?: string;
  }[];
}

export interface DigestSections {
  topics: TopicItem[];
  industryInsights?: string[];
  worthReading?: {
    title: string;
    source: string;
    url: string;
    reason: string;
  }[];
}

export interface ChannelWithSources {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string;
  scheduleTime: string;
  promptTemplate: string | null;
  filterKeywords: string | null;
  isEnabled: boolean;
  sources: {
    id: string;
    title: string;
    url: string;
    siteUrl: string | null;
    iconUrl: string | null;
    isFullTextFetch: boolean;
    lastFetchedAt: Date | null;
    status: string;
    lastError: string | null;
    _count?: {
      articles: number;
    };
  }[];
  _count?: {
    sources: number;
    digests: number;
  };
}

export interface AiSettingsConfig {
  provider: "deepseek" | "openai" | "ollama" | "custom";
  apiKey: string;
  baseURL: string;
  model: string;
  temperature: number;
  promptStyle?: "editorial" | "bullet" | "deep" | "humorous";
}

export interface NotificationSettingsConfig {
  feishuWebhook?: string;
  wecomWebhook?: string;
  telegramBotToken?: string;
  telegramChatId?: string;
  discordWebhook?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  smtpFrom?: string;
  emailRecipients?: string; // comma-separated
  enableFeishu?: boolean;
  enableWecom?: boolean;
  enableTelegram?: boolean;
  enableDiscord?: boolean;
  enableEmail?: boolean;
}
