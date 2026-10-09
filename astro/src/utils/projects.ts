// Project data (运行时从 PHP 后端读取)
// 后端不可达时返回空数组, 页面显示空内容。

import { fetchJsonCollection, resolveAssetUrl } from "@/lib/content";

export interface Project {
    id: string;
    title: string;
    description: string;
    image: string;
    category: "library" | "ai" | "software" | "website" | "game";
    techStack: string[];
    status: "completed" | "in-progress" | "planned";
    demoUrl?: string;
    sourceUrl?: string;
    startDate: string;
    endDate?: string;
    featured?: boolean;
    tags?: string[];
    basePath?: string;
}

// biome-ignore lint/suspicious/noExplicitAny: 后端返回的是无类型的 JSON
type RawProject = Record<string, any>;

/** 项目列表 (来自后端 php/articles/projects) */
export async function getProjects(): Promise<Project[]> {
    const entries = await fetchJsonCollection<RawProject>("projects");
    return entries.map(
        (entry) =>
            ({
                ...entry,
                id: entry.id,
                image: resolveAssetUrl("projects", entry.folderPath, String(entry.image ?? "")),
                demoUrl: entry.demoUrl ?? entry.liveDemo,
                sourceUrl: entry.sourceUrl ?? entry.sourceCode,
                basePath: `articles/projects/${entry.folderPath}`,
            }) as unknown as Project,
    );
}

// Get project statistics
export const getProjectStats = (projectsData: Project[]) => {
    const total = projectsData.length;
    const completed = projectsData.filter((p) => p.status === "completed").length;
    const inProgress = projectsData.filter((p) => p.status === "in-progress").length;
    const planned = projectsData.filter((p) => p.status === "planned").length;
    return {
        total,
        byStatus: {
            completed,
            inProgress,
            planned,
        },
    };
};

// Get projects by category
export const getProjectsByCategory = (projectsData: Project[], category?: string) => {
    if (!category || category === "all") {
        return projectsData;
    }
    return projectsData.filter((p) => p.category === category);
};

// Get featured projects
export const getFeaturedProjects = (projectsData: Project[]) => {
    return projectsData.filter((p) => p.featured);
};

// Get all tech stacks
export const getAllTechStack = (projectsData: Project[]) => {
    const techSet = new Set<string>();
    projectsData.forEach((project) => {
        (project.techStack || []).forEach((tech) => techSet.add(tech));
    });
    return Array.from(techSet).sort();
};
