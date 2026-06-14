/**
 * 统一的语言配置文件
 * 所有语言相关的映射和配置都从这里导出
 */

export interface LanguageConfig {
    /** 翻译服务使用的语言代码 */
    translateCode: string;
    /** 语言显示名称 */
    displayName: string;
    /** Intl.DateTimeFormat 使用的 locale */
    locale: string;
    /** 语言图标（国旗 emoji） */
    icon: string;
}

/**
 * 支持的语言配置
 * 单一数据源，避免重复定义
 */
export const LANGUAGE_CONFIG = {
    en: {
        translateCode: "english",
        displayName: "English",
        locale: "en-US",
        icon: "🇺🇸",
    },
    zh_hant: {
        translateCode: "chinese_traditional",
        displayName: "繁體中文",
        locale: "zh-Hant",
        icon: "🇨🇳",
    },
    zh: {
        translateCode: "chinese_simplified",
        displayName: "简体中文",
        locale: "zh-Hans",
        icon: "🇨🇳",
    },
    ru: {
        translateCode: "russian",
        displayName: "Русский",
        locale: "ru-RU",
        icon: "🇷🇺",
    },
    de: {
        translateCode: "deutsch",
        displayName: "Deutsch",
        locale: "de-DE",
        icon: "🇩🇪",
    },
    fr: {
        translateCode: "french",
        displayName: "Français",
        locale: "fr-FR",
        icon: "🇫🇷",
    },
    es: {
        translateCode: "spanish",
        displayName: "Español",
        locale: "es-ES",
        icon: "🇪🇸",
    },
    tr: {
        translateCode: "turkish",
        displayName: "Türkçe",
        locale: "tr-TR",
        icon: "🇹🇷",
    },
    ar: {
        translateCode: "arabic",
        displayName: "العربية",
        locale: "ar-SA",
        icon: "🇸🇦",
    },
    ko: {
        translateCode: "korean",
        displayName: "한국어",
        locale: "ko-KR",
        icon: "🇰🇷",
    },
    ja: {
        translateCode: "japanese",
        displayName: "日本語",
        locale: "ja-JP",
        icon: "🇯🇵",
    },
    th: {
        translateCode: "thai",
        displayName: "ไทย",
        locale: "th-TH",
        icon: "🇹🇭",
    },
    vi: {
        translateCode: "vietnamese",
        displayName: "Tiếng Việt",
        locale: "vi-VN",
        icon: "🇻🇳",
    },
    id: {
        translateCode: "indonesian",
        displayName: "Bahasa Indonesia",
        locale: "id-ID",
        icon: "🇮🇩",
    },
} as const satisfies Record<string, LanguageConfig>;

/** 支持的语言代码列表 */
export const SUPPORTED_LANGUAGES = Object.keys(LANGUAGE_CONFIG) as Array<
    keyof typeof LANGUAGE_CONFIG
>;

export type SupportedLanguage = keyof typeof LANGUAGE_CONFIG;

/**
 * 配置文件语言代码到翻译服务语言代码的映射
 * 自动从 LANGUAGE_CONFIG 生成
 */
export const langToTranslateMap: Record<string, string> = Object.fromEntries(
    Object.entries(LANGUAGE_CONFIG).map(([lang, config]) => [
        lang,
        config.translateCode,
    ]),
);

/**
 * 翻译服务语言代码到配置文件语言代码的映射
 * 自动从 LANGUAGE_CONFIG 生成
 */
export const translateToLangMap: Record<string, string> = Object.fromEntries(
    Object.entries(LANGUAGE_CONFIG).map(([lang, config]) => [
        config.translateCode,
        lang,
    ]),
);

/**
 * 语言代码到 locale 的映射
 * 自动从 LANGUAGE_CONFIG 生成
 */
export const langToLocaleMap: Record<string, string> = Object.fromEntries(
    Object.entries(LANGUAGE_CONFIG).map(([lang, config]) => [lang, config.locale]),
);

/**
 * 获取所有支持翻译的语言列表（用于 Translator）
 */
export function getSupportedTranslateLanguages() {
    return Object.entries(LANGUAGE_CONFIG).map(([code, config]) => ({
        code: config.translateCode,
        name: config.displayName,
        icon: config.icon,
        langCode: code,
    }));
}
