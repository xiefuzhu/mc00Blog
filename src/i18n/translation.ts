import { getResolvedSiteLang } from "@utils/language";
import { en } from "./languages/en";
import { zh_hant } from "./languages/zh_hant";
import { zh_hans } from "./languages/zh_hans";
import { ja } from "./languages/ja";
import type I18nKey from "./i18nKey";


export type Translation = {
    [K in I18nKey]: string;
};

const defaultTranslation = en;

const map: { [key: string]: Translation } = {
    en: en,
    en_us: en,
    en_gb: en,
    en_au: en,
    zh: zh_hans,
    zh_hant: zh_hant,
    zh_hans: zh_hans,
    zh_cn: zh_hans,
    zh_hk: zh_hant,
    zh_mo: zh_hant,
    zh_tw: zh_hant,
    zh_sg: zh_hans,
    ja: ja,
    ja_jp: ja,
};

export function getTranslation(lang: string): Translation {
    return map[lang.toLowerCase()] || defaultTranslation;
}

export function i18n(key: I18nKey): string {
    const lang = getResolvedSiteLang();
    return getTranslation(lang)[key];
}