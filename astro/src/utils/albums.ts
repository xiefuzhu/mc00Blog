// Album data (运行时从 PHP 后端读取)
// 后端不可达时返回空数组, 页面显示空内容。

import { fetchJsonCollection, resolveAssetUrl } from "@/lib/content";

export interface Photo {
    src: string;
    alt?: string;
    title?: string;
    description?: string;
    tags?: string[];
    date?: string;
    width?: number;
    height?: number;
}

export interface AlbumGroup {
    id: string;
    title: string;
    description?: string;
    cover: string;
    date: string;
    location?: string;
    tags?: string[];
    layout?: "grid" | "masonry" | "list";
    columns?: number;
    photos: Photo[];
    visible?: boolean;
    basePath?: string;
}

// biome-ignore lint/suspicious/noExplicitAny: 后端返回的是无类型的 JSON
type RawAlbum = Record<string, any>;

/** 相册列表 (来自后端 php/articles/albums, 按日期倒序) */
export async function getAlbums(): Promise<AlbumGroup[]> {
    const entries = await fetchJsonCollection<RawAlbum>("albums");
    const albums: AlbumGroup[] = entries.map((entry) => {
        const folderPath = entry.folderPath;
        const photos: Photo[] = Array.isArray(entry.photos)
            ? entry.photos.map((photo: RawAlbum) => ({
                  ...photo,
                  src: resolveAssetUrl("albums", folderPath, String(photo?.src ?? "")),
              }))
            : [];
        return {
            ...entry,
            id: entry.id,
            cover: resolveAssetUrl("albums", folderPath, String(entry.cover ?? "")),
            photos,
            visible: entry.visible !== false,
            basePath: `articles/albums/${folderPath}`,
        } as unknown as AlbumGroup;
    });

    return albums.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}
