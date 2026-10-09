<script lang="ts">
/**
 * 集合条目编辑器
 * 表单由 src/utils/contentSchemas.ts 的字段描述自动生成, 并提供「原始 JSON」切换。
 */
import Icon from "@components/common/icon.svelte";
import Button from "./Button.svelte";
import { validateEntryData, type CollectionFormSchema, type FieldDescriptor } from "@utils/contentSchemas";

interface Props {
    schema: CollectionFormSchema;
    title: string;
    relPath: string | null;
    initialData: Record<string, unknown>;
    writable: boolean;
    saving: boolean;
    error?: string | null;
    onSave: (data: Record<string, unknown>) => void;
    onClose: () => void;
}

let { schema, title, relPath, initialData, writable, saving, error = null, onSave, onClose }: Props =
    $props();

function clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value ?? null)) as T;
}

// 组件由父级 {#key relPath} 包裹, 每次打开条目都会重新挂载, 因此这里只取一次初始快照。
const snapshotInitialData = () => clone(initialData);
let data = $state<Record<string, unknown>>(snapshotInitialData());
let rawMode = $state(false);
let rawText = $state(JSON.stringify(snapshotInitialData(), null, 4));
let localError = $state<string>("");

function toDateInput(value: unknown): string {
    if (typeof value !== "string" || !value) return "";
    const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : "";
}

function fromDateInput(value: string): string {
    return value ? `${value}T00:00:00.000Z` : "";
}

function toggleRawMode() {
    if (!rawMode) {
        rawText = JSON.stringify(data, null, 4);
        rawMode = true;
        return;
    }
    try {
        const parsed = JSON.parse(rawText);
        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
            localError = "原始 JSON 必须是一个对象";
            return;
        }
        data = parsed as Record<string, unknown>;
        localError = "";
        rawMode = false;
    } catch (e) {
        localError = `JSON 解析失败: ${e instanceof Error ? e.message : "未知错误"}`;
    }
}

function setValue(field: FieldDescriptor, value: unknown) {
    data = { ...data, [field.name]: value };
}

function setObjectValue(field: FieldDescriptor, child: FieldDescriptor, value: unknown) {
    const current = (data[field.name] as Record<string, unknown>) || {};
    data = { ...data, [field.name]: { ...current, [child.name]: value } };
}

function listOf(field: FieldDescriptor): unknown[] {
    const value = data[field.name];
    return Array.isArray(value) ? value : [];
}

function updateList(field: FieldDescriptor, list: unknown[]) {
    data = { ...data, [field.name]: list };
}

function addListItem(field: FieldDescriptor) {
    const item: Record<string, unknown> = {};
    for (const child of field.fields || []) {
        if (child.default !== undefined) item[child.name] = child.default;
        else if (child.kind === "number") item[child.name] = child.min ?? 0;
        else if (child.kind === "boolean") item[child.name] = false;
        else if (child.kind === "stringList" || child.kind === "objectList") item[child.name] = [];
        else item[child.name] = "";
    }
    updateList(field, [...listOf(field), item]);
}

function removeListItem(field: FieldDescriptor, index: number) {
    updateList(
        field,
        listOf(field).filter((_, i) => i !== index),
    );
}

function setListItem(field: FieldDescriptor, index: number, childName: string, value: unknown) {
    const list = listOf(field).map((item, i) =>
        i === index ? { ...(item as Record<string, unknown>), [childName]: value } : item,
    );
    updateList(field, list);
}

function stringListText(field: FieldDescriptor): string {
    const value = data[field.name];
    return Array.isArray(value) ? value.join("\n") : "";
}

function setStringList(field: FieldDescriptor, text: string) {
    setValue(
        field,
        text
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean),
    );
}

function submit() {
    localError = "";
    if (rawMode) {
        try {
            data = JSON.parse(rawText) as Record<string, unknown>;
        } catch {
            localError = "原始 JSON 解析失败";
            return;
        }
    }
    const result = validateEntryData(schema.key, data);
    if (!result.ok) {
        localError = result.errors.join("; ");
        return;
    }
    onSave(result.data);
}
</script>

<div
    class="fixed inset-0 z-[70] bg-black/55 backdrop-blur-sm flex items-center justify-center p-4"
    role="presentation"
    onclick={(event) => {
        if (event.target === event.currentTarget) onClose();
    }}
>
    <div
        class="w-full max-w-3xl max-h-[90vh] overflow-y-auto custom-scrollbar card-base liquid-glass rounded-3xl border border-black/8 dark:border-white/10 shadow-2xl p-5 sm:p-6 text-neutral-800 dark:text-neutral-200 space-y-4"
    >
        <div class="flex items-center justify-between pb-3 border-b border-black/5 dark:border-white/10">
            <div class="relative pl-3 before:w-1 before:h-4 before:rounded-md before:bg-(--primary) before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2">
                <h3 class="text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                    <Icon icon="material-symbols:edit-note" class="text-base text-(--primary)" />
                    <span>{title}</span>
                </h3>
                <p class="text-[10.5px] text-neutral-400 font-mono mt-0.5">
                    articles/{schema.key}/{relPath || "<新条目>.json"}
                </p>
            </div>
            <div class="flex items-center gap-2">
                <Button
                    variant="secondary"
                    size="sm"
                    icon="material-symbols:code"
                    label={rawMode ? "表单模式" : "原始 JSON"}
                    onclick={toggleRawMode}
                />
                <Button variant="ghost" size="icon-sm" icon="material-symbols:close" title="关闭" onclick={onClose} />
            </div>
        </div>

        {#if !writable}
            <div class="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-700 dark:text-amber-300 text-xs">
                当前环境不支持写回仓库文件, 保存会被禁用 (可查看与导出)。
            </div>
        {/if}

        {#if rawMode}
            <textarea
                class="console-field w-full h-[52vh] font-mono text-xs leading-relaxed resize-none"
                style="border-radius: 1rem;"
                bind:value={rawText}
            ></textarea>
        {:else}
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {#each schema.fields as field}
                    <div class={field.kind === "text" || field.kind === "objectList" ? "sm:col-span-2" : ""}>
                        <span class="block font-semibold text-neutral-700 dark:text-neutral-300 text-xs mb-1.5">
                            {field.label}{field.required ? " *" : ""}
                        </span>

                        {#if field.kind === "text"}
                            <textarea
                                class="console-field w-full h-24 resize-none leading-relaxed"
                                style="border-radius: 1rem;"
                                value={String(data[field.name] ?? "")}
                                oninput={(e) => setValue(field, (e.target as HTMLTextAreaElement).value)}
                            ></textarea>
                        {:else if field.kind === "boolean"}
                            <label class="flex items-center gap-2 cursor-pointer text-xs">
                                <input
                                    type="checkbox"
                                    class="accent-(--primary) w-4 h-4 cursor-pointer"
                                    checked={data[field.name] === true}
                                    onchange={(e) => setValue(field, (e.target as HTMLInputElement).checked)}
                                />
                                <span class="text-neutral-500">启用</span>
                            </label>
                        {:else if field.kind === "number"}
                            <input
                                type="number"
                                class="console-field w-full"
                                min={field.min}
                                max={field.max}
                                value={String(data[field.name] ?? "")}
                                oninput={(e) => setValue(field, Number((e.target as HTMLInputElement).value))}
                            />
                        {:else if field.kind === "date"}
                            <input
                                type="date"
                                class="console-field w-full"
                                value={toDateInput(data[field.name])}
                                oninput={(e) => setValue(field, fromDateInput((e.target as HTMLInputElement).value))}
                            />
                        {:else if field.kind === "select"}
                            <select
                                class="console-field w-full cursor-pointer"
                                value={String(data[field.name] ?? "")}
                                onchange={(e) => setValue(field, (e.target as HTMLSelectElement).value)}
                            >
                                <option value="">(未设置)</option>
                                {#each field.options || [] as option}
                                    <option value={option}>{option}</option>
                                {/each}
                            </select>
                        {:else if field.kind === "stringList"}
                            <textarea
                                class="console-field w-full h-20 resize-none font-mono text-xs"
                                style="border-radius: 1rem;"
                                placeholder="每行一项"
                                value={stringListText(field)}
                                oninput={(e) => setStringList(field, (e.target as HTMLTextAreaElement).value)}
                            ></textarea>
                        {:else if field.kind === "object"}
                            <div class="p-3 rounded-2xl bg-black/2 dark:bg-white/3 border border-black/5 dark:border-white/5 space-y-2.5">
                                {#each field.fields || [] as child}
                                    <div class="flex items-center gap-2">
                                        <span class="text-[11px] text-neutral-500 w-14 shrink-0">{child.label}</span>
                                        {#if child.kind === "number"}
                                            <input
                                                type="number"
                                                class="console-field flex-1"
                                                min={child.min}
                                                max={child.max}
                                                value={String(
                                                    ((data[field.name] as Record<string, unknown>) || {})[child.name] ?? "",
                                                )}
                                                oninput={(e) =>
                                                    setObjectValue(field, child, Number((e.target as HTMLInputElement).value))}
                                            />
                                        {:else}
                                            <input
                                                type="text"
                                                class="console-field flex-1"
                                                value={String(
                                                    ((data[field.name] as Record<string, unknown>) || {})[child.name] ?? "",
                                                )}
                                                oninput={(e) =>
                                                    setObjectValue(field, child, (e.target as HTMLInputElement).value)}
                                            />
                                        {/if}
                                    </div>
                                {/each}
                            </div>
                        {:else if field.kind === "objectList"}
                            <div class="space-y-2.5">
                                {#each listOf(field) as item, index}
                                    <div class="p-3 rounded-2xl bg-black/2 dark:bg-white/3 border border-black/5 dark:border-white/5 space-y-2">
                                        <div class="flex items-center justify-between">
                                            <span class="text-[10.5px] text-neutral-400 font-mono">
                                                {field.label} #{index + 1}
                                            </span>
                                            <Button
                                                variant="ghost"
                                                size="icon-sm"
                                                icon="material-symbols:delete-outline"
                                                title="移除该项"
                                                onclick={() => removeListItem(field, index)}
                                            />
                                        </div>
                                        {#each field.fields || [] as child}
                                            <div class="flex items-start gap-2">
                                                <span class="text-[11px] text-neutral-500 w-16 shrink-0 pt-2">
                                                    {child.label}
                                                </span>
                                                {#if child.kind === "text"}
                                                    <textarea
                                                        class="console-field flex-1 h-16 resize-none"
                                                        style="border-radius: 0.9rem;"
                                                        value={String((item as Record<string, unknown>)[child.name] ?? "")}
                                                        oninput={(e) =>
                                                            setListItem(field, index, child.name, (e.target as HTMLTextAreaElement).value)}
                                                    ></textarea>
                                                {:else if child.kind === "select"}
                                                    <select
                                                        class="console-field flex-1 cursor-pointer"
                                                        value={String((item as Record<string, unknown>)[child.name] ?? "")}
                                                        onchange={(e) =>
                                                            setListItem(field, index, child.name, (e.target as HTMLSelectElement).value)}
                                                    >
                                                        <option value="">(未设置)</option>
                                                        {#each child.options || [] as option}
                                                            <option value={option}>{option}</option>
                                                        {/each}
                                                    </select>
                                                {:else if child.kind === "stringList"}
                                                    <textarea
                                                        class="console-field flex-1 h-16 resize-none font-mono text-xs"
                                                        style="border-radius: 0.9rem;"
                                                        placeholder="每行一项"
                                                        value={Array.isArray((item as Record<string, unknown>)[child.name])
                                                            ? ((item as Record<string, unknown>)[child.name] as string[]).join("\n")
                                                            : ""}
                                                        oninput={(e) =>
                                                            setListItem(
                                                                field,
                                                                index,
                                                                child.name,
                                                                (e.target as HTMLTextAreaElement).value
                                                                    .split("\n")
                                                                    .map((line) => line.trim())
                                                                    .filter(Boolean),
                                                            )}
                                                    ></textarea>
                                                {:else if child.kind === "date"}
                                                    <input
                                                        type="date"
                                                        class="console-field flex-1"
                                                        value={toDateInput((item as Record<string, unknown>)[child.name])}
                                                        oninput={(e) =>
                                                            setListItem(
                                                                field,
                                                                index,
                                                                child.name,
                                                                fromDateInput((e.target as HTMLInputElement).value),
                                                            )}
                                                    />
                                                {:else}
                                                    <input
                                                        type="text"
                                                        class="console-field flex-1"
                                                        value={String((item as Record<string, unknown>)[child.name] ?? "")}
                                                        oninput={(e) =>
                                                            setListItem(field, index, child.name, (e.target as HTMLInputElement).value)}
                                                    />
                                                {/if}
                                            </div>
                                        {/each}
                                    </div>
                                {/each}
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    icon="material-symbols:add"
                                    label={`新增一项 ${field.label}`}
                                    onclick={() => addListItem(field)}
                                />
                            </div>
                        {:else}
                            <input
                                type="text"
                                class="console-field w-full font-mono"
                                placeholder={field.kind === "image" ? "图片路径或 URL" : ""}
                                value={String(data[field.name] ?? "")}
                                oninput={(e) => setValue(field, (e.target as HTMLInputElement).value)}
                            />
                        {/if}
                    </div>
                {/each}
            </div>
        {/if}

        {#if localError || error}
            <div class="p-2.5 rounded-xl bg-rose-500/12 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-medium">
                {localError || error}
            </div>
        {/if}

        <div class="pt-3 border-t border-black/5 dark:border-white/10 flex items-center justify-end gap-2.5">
            <Button variant="secondary" size="md" label="取消" onclick={onClose} />
            <Button
                variant="primary"
                size="md"
                icon="material-symbols:save"
                label={saving ? "保存中..." : "保存条目"}
                onclick={submit}
            />
        </div>
    </div>
</div>
