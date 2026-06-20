import { getResolvedSiteLang } from "@utils/language";
import {
    LANGUAGE_CONFIG,
    LANGUAGE_REGION_MAP,
    localTranslations,
} from "@i18n/language";
import type I18nKey from "./i18nKey";
import type { Translation } from "@i18n/language";

const defaultTranslation = localTranslations.en!;

export function getTranslation(lang: string): Translation {
    const code = lang.toLowerCase();
    // LANGUAGE_CONFIG 中有该语言且有本地翻译
    if (code in LANGUAGE_CONFIG && code in localTranslations) {
        return localTranslations[code as SupportedLanguage]!;
    }
    // 匹配 region 变体（例如 zh_cn → zh_hans）
    if (code in LANGUAGE_REGION_MAP) {
        const baseCode = LANGUAGE_REGION_MAP[code];
        if (baseCode in localTranslations) {
            return localTranslations[baseCode]!;
        }
    }
    // Fallback 到英文
    return defaultTranslation;
}

export function i18n(key: I18nKey): string {
    const lang = getResolvedSiteLang();
    return getTranslation(lang)[key];
}