<script lang="ts">
/**
 * 集合条目列表 (非文章集合: albums / diary / projects / skills / timeline)
 */
import Icon from "@components/common/icon.svelte";
import Button from "./Button.svelte";
import type { SiteCollectionKey } from "@utils/contentCollections";
import type { SiteIndexEntry } from "../contentIndex";

interface Props {
    collection: SiteCollectionKey;
    collectionLabel: string;
    entries: SiteIndexEntry[];
    writable: boolean;
    onCreate: () => void;
    onEdit: (entry: SiteIndexEntry) => void;
    onDelete: (entry: SiteIndexEntry) => void;
    onMove: (entry: SiteIndexEntry) => void;
    onPreview: (entry: SiteIndexEntry) => void;
    onExport: (entry: SiteIndexEntry) => void;
}

let {
    collection,
    collectionLabel,
    entries,
    writable,
    onCreate,
    onEdit,
    onDelete,
    onMove,
    onPreview,
    onExport,
}: Props = $props();

function meta(entry: SiteIndexEntry): Record<string, unknown> {
    return (entry.meta || {}) as Record<string, unknown>;
}

function text(value: unknown): string {
    if (value === undefined || value === null || value === "") return "";
    if (Array.isArray(value)) return value.map((item) => text(item)).filter(Boolean).join(", ");
    if (typeof value === "object") return "";
    return String(value);
}

/** 摘要行: 按集合挑出最有信息量的字段 */
function summary(entry: SiteIndexEntry): { label: string; value: string }[] {
    const data = meta(entry);
    const rows: { label: string; value: string }[] = [];

    const push = (label: string, value: string) => {
        if (value) rows.push({ label, value });
    };

    switch (collection) {
        case "albums":
            push("日期", text(data.date).slice(0, 10));
            push("地点", text(data.location));
            push("照片", Array.isArray(data.photos) ? String(data.photos.length) : "");
            push("布局", text(data.layout));
            break;
        case "diary":
            push("日期", text(data.date).slice(0, 10));
            push("配图", Array.isArray(data.images) ? String(data.images.length) : "");
            break;
        case "projects":
            push("状态", text(data.status));
            push("分类", text(data.category));
            push("技术栈", text(data.techStack));
            break;
        case "skills":
            push("分类", text(data.category));
            push("熟练度", text(data.level));
            if (data.experience && typeof data.experience === "object") {
                const exp = data.experience as Record<string, unknown>;
                push("经验", `${text(exp.years) || 0} 年 ${text(exp.months) || 0} 月`);
            }
            break;
        case "timeline":
            push("类型", text(data.type));
            push("时间", `${text(data.startDate).slice(0, 10)}${data.endDate ? " ~ " + text(data.endDate).slice(0, 10) : " ~ 至今"}`);
            push("机构", text(data.organization));
            break;
        default:
            break;
    }

    if (entry.folderPath) rows.push({ label: "文件夹", value: entry.folderPath });
    return rows;
}

function description(entry: SiteIndexEntry): string {
    const data = meta(entry);
    return text(data.description) || text(data.content).slice(0, 120);
}
</script>

<div class="space-y-3.5 min-w-0">
    <div
        class="card-base liquid-glass rounded-3xl p-4 sm:p-5 border border-black/5 dark:border-white/8 shadow-xl flex items-center justify-between gap-3"
    >
        <div class="min-w-0">
            <h3 class="text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                <Icon icon="material-symbols:library-books-outline" class="text-base text-(--primary)" />
                <span>{collectionLabel}</span>
                <span class="console-count-badge">{entries.length}</span>
            </h3>
            <p class="text-[10.5px] text-neutral-400 font-mono mt-0.5 truncate">
                articles/{collection}
            </p>
        </div>
        {#if writable}
            <Button variant="primary" size="sm" icon="material-symbols:add" label="新建条目" onclick={onCreate} />
        {:else}
            <span class="text-[10.5px] text-neutral-400">只读模式 (可查看与导出)</span>
        {/if}
    </div>

    {#if entries.length === 0}
        <div
            class="card-base liquid-glass rounded-3xl p-14 text-center text-neutral-400 text-xs border border-black/5 dark:border-white/8 shadow-xl"
        >
            <Icon icon="material-symbols:inbox-outline" class="text-4xl mx-auto mb-3 opacity-40 text-(--primary)" />
            <p class="font-medium text-sm text-neutral-700 dark:text-neutral-300">该集合暂无条目</p>
            <p class="text-neutral-400 text-[11px] mt-1">
                在 articles/{collection} 下新增 .json 文件, 或使用「新建条目」
            </p>
        </div>
    {:else}
        {#each entries as entry}
            <div
                class="card-base liquid-glass rounded-2xl p-4 sm:p-5 border border-black/5 dark:border-white/8 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4 group hover:border-(--primary)/40 transition-all"
            >
                <div class="flex items-start gap-4 min-w-0 flex-1">
                    {#if collection === "skills" && typeof meta(entry).icon === "string" && meta(entry).icon}
                        <div class="w-12 h-12 rounded-xl shrink-0 border border-black/8 dark:border-white/10 flex items-center justify-center bg-black/2 dark:bg-white/3">
                            <Icon icon={String(meta(entry).icon)} class="text-2xl" />
                        </div>
                    {/if}
                    <div class="min-w-0 flex-1 space-y-1.5">
                        <div class="flex items-center gap-2 flex-wrap">
                            <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold border border-(--primary)/25 bg-(--primary)/10 text-(--primary)">
                                {entry.format.toUpperCase()}
                            </span>
                            <h3 class="text-sm font-bold text-neutral-900 dark:text-white group-hover:text-(--primary) transition-colors truncate">
                                {entry.name}
                            </h3>
                        </div>

                        {#if description(entry)}
                            <p class="text-xs text-neutral-500 dark:text-neutral-400 line-clamp-1">
                                {description(entry)}
                            </p>
                        {/if}

                        <div class="flex items-center gap-3 sm:gap-4 text-[11px] text-neutral-400 flex-wrap font-mono pt-1">
                            {#each summary(entry) as row}
                                <span>{row.label}: <span class="text-neutral-700 dark:text-neutral-300">{row.value}</span></span>
                            {/each}
                        </div>
                    </div>
                </div>

                <div class="flex items-center gap-2 shrink-0 w-full md:w-auto justify-end pt-3 md:pt-0 border-t md:border-t-0 border-black/5 dark:border-white/5">
                    <Button
                        variant="secondary"
                        size="sm"
                        icon="material-symbols:visibility"
                        label="预览"
                        title="打开前台真实页面"
                        onclick={() => onPreview(entry)}
                    />
                    <Button
                        variant="secondary"
                        size="sm"
                        icon="material-symbols:download"
                        label="导出"
                        title="导出为 .json 文件"
                        onclick={() => onExport(entry)}
                    />
                    {#if writable}
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            icon="material-symbols:drive-file-move-outline"
                            title="移动到文件夹"
                            aria-label="移动到文件夹"
                            onclick={() => onMove(entry)}
                        />
                        <Button
                            variant="primary"
                            size="sm"
                            icon="material-symbols:edit-document-outline"
                            label="编辑"
                            onclick={() => onEdit(entry)}
                        />
                        <Button
                            variant="danger"
                            size="icon-sm"
                            icon="material-symbols:delete-outline"
                            title="删除条目文件"
                            aria-label="删除条目"
                            onclick={() => onDelete(entry)}
                        />
                    {/if}
                </div>
            </div>
        {/each}
    {/if}
</div>
