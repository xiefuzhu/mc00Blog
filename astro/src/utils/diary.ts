// Diary data (运行时从 PHP 后端读取)
// 后端不可达时返回空数组, 页面显示空内容。

import { fetchJsonCollection, resolveAssetUrl } from "@/lib/content";

export interface Moment {
    id: string;
    title?: string;
    content: string;
    date: string;
    images?: string[];
    basePath?: string;
}

// biome-ignore lint/suspicious/noExplicitAny: 后端返回的是无类型的 JSON
type RawMoment = Record<string, any>;

/** 日记列表 (来自后端 php/articles/diary, 按日期倒序) */
export async function getMoments(): Promise<Moment[]> {
    const entries = await fetchJsonCollection<RawMoment>("diary");
    const moments: Moment[] = entries.map(
        (entry) =>
            ({
                ...entry,
                id: entry.id,
                images: Array.isArray(entry.images)
                    ? entry.images.map((src: string) => resolveAssetUrl("diary", entry.folderPath, String(src)))
                    : [],
                basePath: `articles/diary/${entry.folderPath}`,
            }) as unknown as Moment,
    );

    return moments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}
