/**
 * 内容集合字段描述与校验 (与 .pages.yml 的字段定义对齐)
 *
 * 同一份描述同时供两处使用:
 *  - 控制台「集合条目编辑器」自动生成表单 (浏览器端)
 *  - /api/content/entry 写入前的服务端校验
 *
 * 本文件不依赖 Astro 内容层, 也不依赖 zod, 可直接进入浏览器端 bundle。
 */

import type { SiteCollectionKey } from "./contentCollections";

export type FieldKind =
    | "string"
    | "text"
    | "number"
    | "boolean"
    | "date"
    | "select"
    | "stringList"
    | "image"
    | "object"
    | "objectList";

export interface FieldDescriptor {
    name: string;
    label: string;
    kind: FieldKind;
    required?: boolean;
    options?: string[];
    min?: number;
    max?: number;
    default?: unknown;
    /** object / objectList 的子字段 */
    fields?: FieldDescriptor[];
}

export interface CollectionFormSchema {
    key: SiteCollectionKey;
    /** 主标识字段 (用于生成文件名与列表标题) */
    nameField: string;
    fields: FieldDescriptor[];
}

/** 可编辑的 JSON 集合 (posts 由文章编辑器单独处理) */
export const JSON_COLLECTION_KEYS = ["albums", "diary", "projects", "skills", "timeline"] as const;
export type JsonCollectionKey = (typeof JSON_COLLECTION_KEYS)[number];

export function isJsonCollectionKey(value: string): value is JsonCollectionKey {
    return (JSON_COLLECTION_KEYS as readonly string[]).includes(value);
}

const ALBUM_PHOTO_FIELDS: FieldDescriptor[] = [
    { name: "src", label: "图片", kind: "image", required: true },
    { name: "alt", label: "说明", kind: "string" },
    { name: "title", label: "标题", kind: "string" },
    { name: "description", label: "描述", kind: "text" },
    { name: "tags", label: "标签", kind: "stringList" },
    { name: "date", label: "日期", kind: "date" },
];

const TIMELINE_LINK_FIELDS: FieldDescriptor[] = [
    { name: "name", label: "名称", kind: "string", required: true },
    { name: "url", label: "链接", kind: "string", required: true },
    { name: "type", label: "类型", kind: "select", options: ["certificate", "project", "other"] },
];

export const CONTENT_FORM_SCHEMAS: Record<JsonCollectionKey, CollectionFormSchema> = {
    albums: {
        key: "albums",
        nameField: "title",
        fields: [
            { name: "title", label: "标题", kind: "string", required: true },
            { name: "description", label: "描述", kind: "text" },
            { name: "cover", label: "封面", kind: "image" },
            { name: "date", label: "日期", kind: "date" },
            { name: "location", label: "地点", kind: "string" },
            { name: "tags", label: "标签", kind: "stringList" },
            { name: "layout", label: "布局", kind: "select", options: ["grid", "masonry", "list"], default: "grid" },
            { name: "columns", label: "列数", kind: "number", min: 1, max: 6, default: 3 },
            { name: "photos", label: "照片", kind: "objectList", fields: ALBUM_PHOTO_FIELDS },
            { name: "visible", label: "前台可见", kind: "boolean", default: true },
        ],
    },
    diary: {
        key: "diary",
        nameField: "title",
        fields: [
            { name: "title", label: "标题", kind: "string" },
            { name: "content", label: "内容", kind: "text", required: true },
            { name: "date", label: "日期", kind: "date", required: true },
            { name: "images", label: "配图", kind: "stringList" },
        ],
    },
    projects: {
        key: "projects",
        nameField: "title",
        fields: [
            { name: "title", label: "标题", kind: "string", required: true },
            { name: "description", label: "描述", kind: "text", required: true },
            { name: "image", label: "封面", kind: "image" },
            {
                name: "category",
                label: "分类",
                kind: "select",
                options: ["library", "ai", "software", "website", "game"],
            },
            { name: "techStack", label: "技术栈", kind: "stringList" },
            {
                name: "status",
                label: "状态",
                kind: "select",
                options: ["completed", "in-progress", "planned"],
            },
            { name: "liveDemo", label: "在线演示", kind: "string" },
            { name: "sourceCode", label: "源码地址", kind: "string" },
            { name: "startDate", label: "开始日期", kind: "date" },
            { name: "endDate", label: "结束日期", kind: "date" },
            { name: "featured", label: "精选", kind: "boolean", default: false },
            { name: "tags", label: "标签", kind: "stringList" },
        ],
    },
    skills: {
        key: "skills",
        nameField: "name",
        fields: [
            { name: "name", label: "名称", kind: "string", required: true },
            { name: "description", label: "描述", kind: "text", required: true },
            { name: "icon", label: "图标", kind: "string", required: true },
            {
                name: "category",
                label: "分类",
                kind: "select",
                options: ["ai", "backend", "client", "frontend", "database", "engines", "tools", "others"],
            },
            {
                name: "level",
                label: "熟练度",
                kind: "select",
                options: ["beginner", "intermediate", "advanced", "expert"],
            },
            {
                name: "experience",
                label: "经验",
                kind: "object",
                fields: [
                    { name: "years", label: "年", kind: "number", min: 0, default: 0 },
                    { name: "months", label: "月", kind: "number", min: 0, max: 11, default: 0 },
                ],
            },
            { name: "projects", label: "关联项目", kind: "stringList" },
            { name: "certifications", label: "证书", kind: "stringList" },
            { name: "color", label: "主题色", kind: "string" },
        ],
    },
    timeline: {
        key: "timeline",
        nameField: "title",
        fields: [
            { name: "title", label: "标题", kind: "string", required: true },
            { name: "description", label: "描述", kind: "text", required: true },
            {
                name: "type",
                label: "类型",
                kind: "select",
                options: ["education", "work", "project", "achievement"],
            },
            { name: "startDate", label: "开始日期", kind: "date", required: true },
            { name: "endDate", label: "结束日期", kind: "date" },
            { name: "location", label: "地点", kind: "string" },
            { name: "organization", label: "机构", kind: "string" },
            { name: "position", label: "职位", kind: "string" },
            { name: "skills", label: "技能", kind: "stringList" },
            { name: "achievements", label: "成就", kind: "stringList" },
            { name: "links", label: "相关链接", kind: "objectList", fields: TIMELINE_LINK_FIELDS },
            { name: "icon", label: "图标", kind: "string" },
            { name: "color", label: "主题色", kind: "string" },
        ],
    },
};

export function getCollectionSchema(key: string): CollectionFormSchema | null {
    return isJsonCollectionKey(key) ? CONTENT_FORM_SCHEMAS[key] : null;
}

/** 生成一个符合 schema 的空白条目 */
export function createDefaultEntry(key: JsonCollectionKey): Record<string, unknown> {
    const schema = CONTENT_FORM_SCHEMAS[key];
    const data: Record<string, unknown> = {};
    for (const field of schema.fields) {
        if (field.default !== undefined) {
            data[field.name] = field.default;
            continue;
        }
        switch (field.kind) {
            case "boolean":
                data[field.name] = false;
                break;
            case "number":
                data[field.name] = field.min ?? 0;
                break;
            case "stringList":
                data[field.name] = [];
                break;
            case "objectList":
                data[field.name] = [];
                break;
            case "object":
                data[field.name] = createDefaultObject(field);
                break;
            default:
                data[field.name] = "";
        }
    }
    return data;
}

function createDefaultObject(field: FieldDescriptor): Record<string, unknown> {
    const data: Record<string, unknown> = {};
    for (const child of field.fields || []) {
        if (child.default !== undefined) {
            data[child.name] = child.default;
        } else if (child.kind === "number") {
            data[child.name] = child.min ?? 0;
        } else if (child.kind === "boolean") {
            data[child.name] = false;
        } else if (child.kind === "stringList" || child.kind === "objectList") {
            data[child.name] = [];
        } else {
            data[child.name] = "";
        }
    }
    return data;
}

export interface ValidationResult {
    ok: boolean;
    errors: string[];
    /** 归一化后的数据 (未知字段原样保留) */
    data: Record<string, unknown>;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateFields(
    fields: FieldDescriptor[],
    input: Record<string, unknown>,
    output: Record<string, unknown>,
    errors: string[],
    prefix: string,
): void {
    for (const field of fields) {
        const raw = input[field.name];
        const label = `${prefix}${field.label}`;
        const missing = raw === undefined || raw === null || raw === "";

        if (missing) {
            if (field.required) {
                errors.push(`${label} 为必填项`);
            }
            continue;
        }

        switch (field.kind) {
            case "string":
            case "text":
            case "image":
            case "date": {
                if (typeof raw !== "string") {
                    errors.push(`${label} 必须是字符串`);
                    break;
                }
                output[field.name] = raw;
                break;
            }
            case "select": {
                if (typeof raw !== "string" || (field.options && !field.options.includes(raw))) {
                    errors.push(`${label} 取值不在允许范围内`);
                    break;
                }
                output[field.name] = raw;
                break;
            }
            case "number": {
                const num = typeof raw === "number" ? raw : Number(raw);
                if (!Number.isFinite(num)) {
                    errors.push(`${label} 必须是数字`);
                    break;
                }
                if (field.min !== undefined && num < field.min) {
                    errors.push(`${label} 不能小于 ${field.min}`);
                    break;
                }
                if (field.max !== undefined && num > field.max) {
                    errors.push(`${label} 不能大于 ${field.max}`);
                    break;
                }
                output[field.name] = num;
                break;
            }
            case "boolean": {
                if (typeof raw !== "boolean") {
                    errors.push(`${label} 必须是布尔值`);
                    break;
                }
                output[field.name] = raw;
                break;
            }
            case "stringList": {
                if (!Array.isArray(raw) || raw.some((item) => typeof item !== "string")) {
                    errors.push(`${label} 必须是字符串数组`);
                    break;
                }
                output[field.name] = raw;
                break;
            }
            case "object": {
                if (!isPlainObject(raw)) {
                    errors.push(`${label} 必须是对象`);
                    break;
                }
                const nested: Record<string, unknown> = {};
                validateFields(field.fields || [], raw, nested, errors, `${label}.`);
                output[field.name] = nested;
                break;
            }
            case "objectList": {
                if (!Array.isArray(raw)) {
                    errors.push(`${label} 必须是数组`);
                    break;
                }
                const list: Record<string, unknown>[] = [];
                raw.forEach((item, index) => {
                    if (!isPlainObject(item)) {
                        errors.push(`${label}[${index + 1}] 必须是对象`);
                        return;
                    }
                    const nested: Record<string, unknown> = {};
                    validateFields(field.fields || [], item, nested, errors, `${label}[${index + 1}].`);
                    list.push(nested);
                });
                output[field.name] = list;
                break;
            }
        }
    }
}

/** 按集合 schema 校验并归一化条目数据 */
export function validateEntryData(key: string, input: unknown): ValidationResult {
    const schema = getCollectionSchema(key);
    const errors: string[] = [];
    if (!schema) {
        return { ok: false, errors: [`未知的内容集合: ${key}`], data: {} };
    }
    if (!isPlainObject(input)) {
        return { ok: false, errors: ["条目数据必须是 JSON 对象"], data: {} };
    }

    // 先原样保留输入, 再覆盖校验通过的已知字段, 从而不丢失 schema 之外的扩展字段
    const output: Record<string, unknown> = { ...input };
    validateFields(schema.fields, input, output, errors, "");

    return { ok: errors.length === 0, errors, data: output };
}

/** 由展示名生成安全的文件名 (不含扩展名) */
export function slugifyEntryName(name: string): string {
    const cleaned = (name || "")
        .trim()
        .replace(/[\\/:*?"<>|]+/g, "-")
        .replace(/\s+/g, "-")
        .replace(/^\.+/, "")
        .replace(/-{2,}/g, "-")
        .replace(/^-+|-+$/g, "");
    return cleaned || `entry-${Date.now()}`;
}
