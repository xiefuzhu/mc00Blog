<script lang="ts">
/**
 * 文件夹操作弹窗 (新建 / 重命名 / 复制 / 移动 / 删除 / 移动条目)
 * 目标以「集合相对路径」表达, 与 articles/<collection> 下的真实目录一一对应。
 */
import Icon from "@components/common/icon.svelte";
import Button from "./Button.svelte";
import type { ArticleFolder } from "../types";

export type FolderDialogMode = "create" | "rename" | "copy" | "move-folder" | "move-entry" | "delete";

export interface FolderDialogResult {
    name: string;
    /** 新建时的上级文件夹路径 (空串 = 集合根目录) */
    parentPath: string;
    /** 移动时的目标文件夹路径 */
    targetPath: string;
    /** 删除时是否把内容上移一级 */
    keepEntries: boolean;
}

interface Props {
    mode: FolderDialogMode;
    /** 当前操作的文件夹路径 (rename/copy/move-folder/delete) */
    folderPath?: string | null;
    folderCount?: number;
    /** 可选的目标文件夹 (已按当前集合过滤) */
    folderOptions: { folder: ArticleFolder; depth: number }[];
    /** 集合根目录的展示名 (例如 文章 / 相册) */
    collectionLabel: string;
    /** 仓库相对根目录 (例如 articles/posts) */
    collectionRoot: string;
    entryCount?: number;
    defaultParentPath?: string;
    defaultTargetPath?: string;
    onConfirm: (result: FolderDialogResult) => void;
    onClose: () => void;
}

let {
    mode,
    folderPath = null,
    folderCount = 0,
    folderOptions,
    collectionLabel,
    collectionRoot,
    entryCount = 0,
    defaultParentPath = "",
    defaultTargetPath = "",
    onConfirm,
    onClose,
}: Props = $props();

const titleMap: Record<FolderDialogMode, string> = {
    create: "新建文件夹",
    rename: "重命名文件夹",
    copy: "复制文件夹",
    "move-folder": "移动文件夹",
    "move-entry": "移动条目到文件夹",
    delete: "删除文件夹",
};

const iconMap: Record<FolderDialogMode, string> = {
    create: "material-symbols:create-new-folder-outline",
    rename: "material-symbols:edit-outline",
    copy: "material-symbols:content-copy-outline",
    "move-folder": "material-symbols:drive-file-move-outline",
    "move-entry": "material-symbols:drive-file-move-outline",
    delete: "material-symbols:delete-outline",
};

/**
 * 弹窗每次打开都是一次性表单, 只取挂载瞬间的初始值。
 * 放入闭包读取, 既保留"仅取初始值"的语义, 也避免 Svelte 的 state_referenced_locally 警告。
 */
function readInitialState() {
    const segment = folderPath ? folderPath.split("/").pop() || "" : "";
    const initialName = folderPath ? (mode === "copy" ? `${segment}-copy` : segment) : "";
    return {
        name: initialName,
        parentPath: defaultParentPath,
        targetPath: defaultTargetPath,
    };
}

const initialState = readInitialState();

let name = $state(initialState.name);
let parentPath = $state<string>(initialState.parentPath);
let targetPath = $state<string>(initialState.targetPath);
let keepEntries = $state(true);
let error = $state<string>("");

const needsName = $derived(mode === "create" || mode === "rename" || mode === "copy");
const needsParent = $derived(mode === "create");
const needsTarget = $derived(mode === "move-folder" || mode === "move-entry");
const isDanger = $derived(mode === "delete");

/** 判断某个文件夹是否可以作为移动目标 (排除自身与子孙) */
function isDisabledTarget(candidate: ArticleFolder): boolean {
    if (mode !== "move-folder" || !folderPath) return false;
    return candidate.path === folderPath || candidate.path.startsWith(folderPath + "/");
}

function submit() {
    error = "";
    if (needsName && !name.trim()) {
        error = "请填写文件夹名称";
        return;
    }
    onConfirm({
        name: name.trim(),
        parentPath,
        targetPath,
        keepEntries,
    });
}
</script>

<div
    class="fixed inset-0 z-[70] bg-black/55 backdrop-blur-sm flex items-center justify-center p-4"
    role="presentation"
    onclick={(event) => {
        if (event.target === event.currentTarget) onClose();
    }}
>
    <div class="w-full max-w-lg card-base liquid-glass rounded-3xl border border-black/8 dark:border-white/10 shadow-2xl p-5 sm:p-6 text-neutral-800 dark:text-neutral-200 space-y-4">
        <div class="flex items-center justify-between pb-3 border-b border-black/5 dark:border-white/10">
            <div class="relative pl-3 before:w-1 before:h-4 before:rounded-md before:bg-(--primary) before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2">
                <h3 class="text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                    <Icon icon={iconMap[mode]} class="text-base text-(--primary)" />
                    <span>{titleMap[mode]}</span>
                </h3>
            </div>
            <Button variant="ghost" size="icon-sm" icon="material-symbols:close" title="关闭" onclick={onClose} />
        </div>

        <div class="text-xs text-neutral-500 dark:text-neutral-400 font-mono">
            集合: <span class="text-(--primary)">{collectionLabel}</span>
            <span class="ml-2 text-neutral-400">{collectionRoot}</span>
            {#if folderPath}
                <div class="mt-1">
                    当前文件夹: <span class="text-(--primary)">{folderPath}</span>
                    <span class="ml-2 text-neutral-400">({folderCount} 项)</span>
                </div>
            {/if}
        </div>

        {#if needsName}
            <div>
                <label class="block font-semibold text-neutral-700 dark:text-neutral-300 text-xs mb-1.5" for="folder-name-input">
                    文件夹名称 *
                </label>
                <input
                    id="folder-name-input"
                    type="text"
                    class="console-field w-full"
                    placeholder="例如: 技术笔记"
                    bind:value={name}
                    onkeydown={(event) => {
                        if (event.key === "Enter") {
                            event.preventDefault();
                            submit();
                        }
                    }}
                />
                <p class="text-[10px] text-neutral-400 mt-1">
                    目标路径: {collectionRoot}/{mode === "rename" && folderPath ? (folderPath.includes("/") ? folderPath.slice(0, folderPath.lastIndexOf("/")) + "/" : "") : parentPath ? parentPath + "/" : ""}{name.trim() || "…"}
                </p>
            </div>
        {/if}

        {#if needsParent}
            <div>
                <div class="block font-semibold text-neutral-700 dark:text-neutral-300 text-xs mb-1.5">
                    上级文件夹
                </div>
                <div class="max-h-56 overflow-y-auto custom-scrollbar rounded-2xl border border-black/5 dark:border-white/10 p-1.5 space-y-0.5">
                    <div
                        class="console-row {parentPath === '' ? 'is-active' : ''}"
                        role="button"
                        tabindex="0"
                        onclick={() => (parentPath = "")}
                        onkeydown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                parentPath = "";
                            }
                        }}
                    >
                        <Icon icon="material-symbols:home-storage" class="text-base shrink-0 opacity-80" />
                        <span class="truncate mr-auto text-left">{collectionLabel} 根目录</span>
                    </div>
                    {#each folderOptions as option}
                        <div
                            class="console-row {parentPath === option.folder.path ? 'is-active' : ''}"
                            role="button"
                            tabindex="0"
                            style={`padding-left: ${0.75 + option.depth * 0.75}rem;`}
                            onclick={() => (parentPath = option.folder.path)}
                            onkeydown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault();
                                    parentPath = option.folder.path;
                                }
                            }}
                        >
                            <Icon icon="material-symbols:folder-outline" class="text-base shrink-0 opacity-80" />
                            <span class="truncate mr-auto text-left">{option.folder.name}</span>
                        </div>
                    {/each}
                </div>
            </div>
        {/if}

        {#if needsTarget}
            <div>
                <div class="block font-semibold text-neutral-700 dark:text-neutral-300 text-xs mb-1.5">
                    目标文件夹
                </div>
                <div class="max-h-56 overflow-y-auto custom-scrollbar rounded-2xl border border-black/5 dark:border-white/10 p-1.5 space-y-0.5">
                    <div
                        class="console-row {targetPath === '' ? 'is-active' : ''}"
                        role="button"
                        tabindex="0"
                        onclick={() => (targetPath = "")}
                        onkeydown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                targetPath = "";
                            }
                        }}
                    >
                        <Icon icon="material-symbols:home-storage" class="text-base shrink-0 opacity-80" />
                        <span class="truncate mr-auto text-left">{collectionLabel} 根目录</span>
                    </div>
                    {#each folderOptions as option}
                        {@const disabled = isDisabledTarget(option.folder)}
                        <div
                            class="console-row {targetPath === option.folder.path ? 'is-active' : ''} {disabled ? 'opacity-40 pointer-events-none' : ''}"
                            role="button"
                            tabindex="0"
                            style={`padding-left: ${0.75 + option.depth * 0.75}rem;`}
                            onclick={() => (targetPath = option.folder.path)}
                            onkeydown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault();
                                    targetPath = option.folder.path;
                                }
                            }}
                        >
                            <Icon icon="material-symbols:folder-outline" class="text-base shrink-0 opacity-80" />
                            <span class="truncate mr-auto text-left">{option.folder.name}</span>
                        </div>
                    {/each}
                </div>
                {#if mode === "move-entry"}
                    <p class="text-[10px] text-neutral-400 mt-1">将移动 {entryCount} 个条目到所选文件夹</p>
                {/if}
            </div>
        {/if}

        {#if mode === "delete"}
            <div class="space-y-2">
                <label class="flex items-start gap-3 cursor-pointer p-3 rounded-2xl bg-black/2 dark:bg-white/3 border border-black/5 dark:border-white/5 hover:border-(--primary)/30 transition-colors">
                    <input type="radio" class="accent-(--primary) mt-0.5 cursor-pointer" checked={keepEntries} onchange={() => (keepEntries = true)} />
                    <span>
                        <span class="font-semibold text-neutral-800 dark:text-neutral-200 block text-xs">保留内容 (上移一级)</span>
                        <span class="text-[10.5px] text-neutral-400 block mt-0.5">只删除文件夹结构, 其中的文件上移到上级目录</span>
                    </span>
                </label>
                <label class="flex items-start gap-3 cursor-pointer p-3 rounded-2xl bg-rose-500/5 border border-rose-500/20 hover:border-rose-500/40 transition-colors">
                    <input type="radio" class="accent-rose-500 mt-0.5 cursor-pointer" checked={!keepEntries} onchange={() => (keepEntries = false)} />
                    <span>
                        <span class="font-semibold text-rose-600 dark:text-rose-400 block text-xs">连同内容一并删除</span>
                        <span class="text-[10.5px] text-neutral-400 block mt-0.5">该文件夹与所有子文件夹中的文件都会被移除</span>
                    </span>
                </label>
            </div>
        {/if}

        {#if error}
            <div class="p-2.5 rounded-xl bg-rose-500/12 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-medium">
                {error}
            </div>
        {/if}

        <div class="pt-3 border-t border-black/5 dark:border-white/10 flex items-center justify-end gap-2.5">
            <Button variant="secondary" size="md" label="取消" onclick={onClose} />
            <Button
                variant={isDanger ? "danger-solid" : "primary"}
                size="md"
                icon={isDanger ? "material-symbols:delete-outline" : "material-symbols:check"}
                label={isDanger ? "确认删除" : "确认"}
                onclick={submit}
            />
        </div>
    </div>
</div>
