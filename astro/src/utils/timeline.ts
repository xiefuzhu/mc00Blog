// Timeline data (运行时从 PHP 后端读取)
// 后端不可达时返回空数组, 页面显示空内容。

import { fetchJsonCollection } from "@/lib/content";

export interface TimelineItem {
    id: string;
    title: string;
    description: string;
    type: "education" | "work" | "project" | "achievement";
    startDate: string;
    endDate?: string; // If empty, it means current
    location?: string;
    organization?: string;
    position?: string;
    skills?: string[];
    achievements?: string[];
    links?: {
        name: string;
        url: string;
        type: "certificate" | "project" | "other";
    }[];
    icon?: string; // Iconify icon name
    color?: string;
    featured?: boolean;
    basePath?: string;
}

// biome-ignore lint/suspicious/noExplicitAny: 后端返回的是无类型的 JSON
type RawTimelineItem = Record<string, any>;

/** 时间线列表 (来自后端 php/articles/timeline) */
export async function getTimeline(): Promise<TimelineItem[]> {
    const entries = await fetchJsonCollection<RawTimelineItem>("timeline");
    return entries.map(
        (entry) =>
            ({
                ...entry,
                id: entry.id,
                basePath: `articles/timeline/${entry.folderPath}`,
            }) as unknown as TimelineItem,
    );
}

// Get timeline statistics
export const getTimelineStats = (timelineData: TimelineItem[]) => {
    const total = timelineData.length;
    const byType = {
        education: timelineData.filter((item) => item.type === "education").length,
        work: timelineData.filter((item) => item.type === "work").length,
        project: timelineData.filter((item) => item.type === "project").length,
        achievement: timelineData.filter((item) => item.type === "achievement").length,
    };
    return { total, byType };
};

// Get timeline items by type
export const getTimelineByType = (timelineData: TimelineItem[], type?: string) => {
    if (!type || type === "all") {
        return [...timelineData].sort(
            (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime(),
        );
    }
    return timelineData
        .filter((item) => item.type === type)
        .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
};

// Get featured timeline items
export const getFeaturedTimeline = (timelineData: TimelineItem[]) => {
    return timelineData
        .filter((item) => item.featured)
        .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
};

// Get current ongoing items
export const getCurrentItems = (timelineData: TimelineItem[]) => {
    return timelineData.filter((item) => !item.endDate);
};

// Calculate total work experience
export const getTotalWorkExperience = (timelineData: TimelineItem[]) => {
    const workItems = timelineData.filter((item) => item.type === "work");
    let totalMonths = 0;
    workItems.forEach((item) => {
        const startDate = new Date(item.startDate);
        const endDate = item.endDate ? new Date(item.endDate) : new Date();
        const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
        const diffMonths = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30));
        totalMonths += diffMonths;
    });
    return {
        years: Math.floor(totalMonths / 12),
        months: totalMonths % 12,
    };
};
