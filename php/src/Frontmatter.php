<?php
/**
 * 轻量 YAML frontmatter 解析 / 序列化
 *
 * 仅覆盖博客内容 frontmatter 实际用到的子集:
 *   - 标量: 字符串 / 数字 / 布尔 / null (支持单引号、双引号)
 *   - 行内数组: [a, b, c]
 *   - 块数组:  key:\n  - item
 *   - 单层嵌套映射: key:\n  sub: value
 *
 * 该实现刻意不依赖 PHP 的 yaml 扩展 (很多环境未安装)。解析结果按「顶层键」
 * 保留, 写回时未知键原样输出, 避免保存一次就丢字段。
 */
class Frontmatter {
    /**
     * 拆分 frontmatter 与正文。
     * @return array{0: ?string, 1: string} [frontmatter 文本(不含 ---), 正文]
     */
    public static function split(string $text): array {
        if (preg_match('/^---\r?\n(.*?)\r?\n---\r?\n?/s', $text, $m)) {
            return [$m[1], substr($text, strlen($m[0]))];
        }
        return [null, $text];
    }

    /** 解析文本中的 frontmatter 为关联数组 */
    public static function parse(string $text): array {
        [$fm, ] = self::split($text);
        if ($fm === null) return [];
        return self::parseBlock($fm);
    }

    /** 仅解析 frontmatter 文本块 */
    public static function parseBlock(string $block): array {
        $lines = preg_split('/\r?\n/', $block);
        $result = [];
        $i = 0;
        $n = count($lines);

        while ($i < $n) {
            $line = $lines[$i];
            $trimmed = trim($line);
            if ($trimmed === '' || str_starts_with($trimmed, '#')) {
                $i++;
                continue;
            }
            if (!preg_match('/^([A-Za-z0-9_\-]+):(.*)$/', $line, $m)) {
                $i++;
                continue;
            }
            $key = $m[1];
            $rest = trim($m[2]);

            if ($rest !== '') {
                $result[$key] = self::parseScalar($rest);
                $i++;
                continue;
            }

            // 值为空: 可能是块数组或嵌套映射, 也可能就是 null
            $j = $i + 1;
            $items = [];
            $map = [];
            $isList = false;
            $isMap = false;
            while ($j < $n) {
                $raw = $lines[$j];
                if (trim($raw) === '') { $j++; continue; }
                if (!preg_match('/^\s+/', $raw)) break; // 缩进结束, 回到顶层
                $t = ltrim($raw);
                if (str_starts_with($t, '- ') || $t === '-') {
                    $isList = true;
                    $items[] = self::parseScalar(trim(substr($t, 1)));
                } elseif (preg_match('/^([A-Za-z0-9_\-]+):(.*)$/', $t, $mm)) {
                    $isMap = true;
                    $map[$mm[1]] = self::parseScalar(trim($mm[2]));
                }
                $j++;
            }

            if ($isList) {
                $result[$key] = $items;
            } elseif ($isMap) {
                $result[$key] = $map;
            } else {
                $result[$key] = null;
            }
            $i = $j;
        }

        return $result;
    }

    /** @return mixed */
    private static function parseScalar(string $value) {
        $value = trim($value);
        if ($value === '' || $value === '~' || strtolower($value) === 'null') return null;

        if (strlen($value) >= 2 && $value[0] === '[' && substr($value, -1) === ']') {
            $inner = trim(substr($value, 1, -1));
            if ($inner === '') return [];
            return array_map(fn($v) => self::parseScalar($v), self::splitInline($inner));
        }
        if (strlen($value) >= 2 && $value[0] === '"' && substr($value, -1) === '"') {
            return stripcslashes(substr($value, 1, -1));
        }
        if (strlen($value) >= 2 && $value[0] === "'" && substr($value, -1) === "'") {
            return str_replace("''", "'", substr($value, 1, -1));
        }

        $lower = strtolower($value);
        if (in_array($lower, ['true', 'yes', 'on'], true)) return true;
        if (in_array($lower, ['false', 'no', 'off'], true)) return false;
        if (preg_match('/^-?\d+$/', $value)) return (int) $value;
        if (is_numeric($value)) return (float) $value;

        return $value;
    }

    /** 按逗号切分行内数组, 尊重引号 */
    private static function splitInline(string $inner): array {
        $parts = [];
        $buffer = '';
        $quote = null;
        $len = strlen($inner);
        for ($k = 0; $k < $len; $k++) {
            $ch = $inner[$k];
            if ($quote !== null) {
                $buffer .= $ch;
                if ($ch === $quote && ($k === 0 || $inner[$k - 1] !== '\\')) $quote = null;
                continue;
            }
            if ($ch === '"' || $ch === "'") { $quote = $ch; $buffer .= $ch; continue; }
            if ($ch === ',') { $parts[] = trim($buffer); $buffer = ''; continue; }
            $buffer .= $ch;
        }
        if (trim($buffer) !== '') $parts[] = trim($buffer);
        return $parts;
    }

    /** 把关联数组序列化为 frontmatter 文本 (不含首尾的 ---) */
    public static function dump(array $data): string {
        $out = '';
        foreach ($data as $key => $value) {
            $out .= self::dumpEntry((string) $key, $value, 0);
        }
        return $out;
    }

    /** @param mixed $value */
    private static function dumpEntry(string $key, $value, int $indent): string {
        $pad = str_repeat('  ', $indent);
        if (is_array($value)) {
            if (self::isList($value)) {
                if (count($value) === 0) return "{$pad}{$key}: []\n";
                $out = "{$pad}{$key}:\n";
                foreach ($value as $item) {
                    $out .= "{$pad}  - " . self::dumpScalar($item) . "\n";
                }
                return $out;
            }
            $out = "{$pad}{$key}:\n";
            foreach ($value as $subKey => $subValue) {
                $out .= self::dumpEntry((string) $subKey, $subValue, $indent + 1);
            }
            return $out;
        }
        return "{$pad}{$key}: " . self::dumpScalar($value) . "\n";
    }

    /** @param mixed $value */
    private static function dumpScalar($value): string {
        if ($value === null) return 'null';
        if (is_bool($value)) return $value ? 'true' : 'false';
        if (is_int($value) || is_float($value)) return (string) $value;
        $str = (string) $value;
        if ($str === '') return '""';
        // 需要引号的情形: 含特殊字符, 或会被误解析为其它类型
        $needsQuote = preg_match('/[:#\[\]\{\},&*!|>\'"%@`\n\r\t]/', $str)
            || trim($str) !== $str
            || preg_match('/^(true|false|yes|no|on|off|null|~)$/i', $str)
            || is_numeric($str);
        if ($needsQuote) {
            return '"' . addcslashes($str, "\"\\\n\r\t") . '"';
        }
        return $str;
    }

    private static function isList(array $value): bool {
        return array_keys($value) === range(0, count($value) - 1);
    }

    /**
     * 合并写回: 只覆盖 managedKeys 中在 newText 里出现的字段, 其余字段保留原值。
     */
    public static function merge(string $originalText, string $newText, array $managedKeys): string {
        $merged = self::parse($originalText);
        $incoming = self::parse($newText);
        foreach ($managedKeys as $key) {
            if (array_key_exists($key, $incoming)) {
                $merged[$key] = $incoming[$key];
            }
        }
        [, $body] = self::split($newText);
        return "---\n" . self::dump($merged) . "---\n" . $body;
    }
}
