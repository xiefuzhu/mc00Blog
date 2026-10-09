// Skill data (运行时从 PHP 后端读取)
// 后端不可达时返回空数组, 页面显示空内容。

import { fetchJsonCollection } from "@/lib/content";

export interface Skill {
    id: string;
    name: string;
    description: string;
    icon: string; // Iconify icon name
    category: "ai" | "backend" | "client" | "frontend" | "database" | "engines" | "tools" | "others";
    level: "beginner" | "intermediate" | "advanced" | "expert";
    experience: {
        years: number;
        months: number;
    };
    projects?: string[]; // Related project IDs
    certifications?: string[];
    color?: string; // Skill card theme color
    basePath?: string;
}

// biome-ignore lint/suspicious/noExplicitAny: 后端返回的是无类型的 JSON
type RawSkill = Record<string, any>;

/** 技能列表 (来自后端 php/articles/skills) */
export async function getSkills(): Promise<Skill[]> {
    const entries = await fetchJsonCollection<RawSkill>("skills");
    return entries.map(
        (entry) =>
            ({
                ...entry,
                id: entry.id,
                basePath: `articles/skills/${entry.folderPath}`,
            }) as unknown as Skill,
    );
}

// Get skill statistics
export const getSkillStats = (skillsData: Skill[]) => {
    const total = skillsData.length;
    const byLevel = {
        beginner: skillsData.filter((s) => s.level === "beginner").length,
        intermediate: skillsData.filter((s) => s.level === "intermediate").length,
        advanced: skillsData.filter((s) => s.level === "advanced").length,
        expert: skillsData.filter((s) => s.level === "expert").length,
    };
    const byCategory = {
        ai: skillsData.filter((s) => s.category === "ai").length,
        backend: skillsData.filter((s) => s.category === "backend").length,
        client: skillsData.filter((s) => s.category === "client").length,
        frontend: skillsData.filter((s) => s.category === "frontend").length,
        database: skillsData.filter((s) => s.category === "database").length,
        tools: skillsData.filter((s) => s.category === "tools").length,
        engines: skillsData.filter((s) => s.category === "engines").length,
        others: skillsData.filter((s) => s.category === "others").length,
    };
    return { total, byLevel, byCategory };
};

// Get skills by category
export const getSkillsByCategory = (skillsData: Skill[], category?: string) => {
    if (!category || category === "all") {
        return skillsData;
    }
    return skillsData.filter((s) => s.category === category);
};

// Get advanced skills
export const getAdvancedSkills = (skillsData: Skill[]) => {
    return skillsData.filter((s) => s.level === "advanced" || s.level === "expert");
};

// Calculate total years of experience
export const getTotalExperience = (skillsData: Skill[]) => {
    const totalMonths = skillsData.reduce((total, skill) => {
        const experience = skill.experience || { years: 0, months: 0 };
        return total + experience.years * 12 + experience.months;
    }, 0);
    return {
        years: Math.floor(totalMonths / 12),
        months: totalMonths % 12,
    };
};
