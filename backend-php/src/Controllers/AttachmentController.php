<?php
/**
 * 媒体资源附件控制器
 * 支持 JSON 结构化登记 与 Multipart 二进制文件真实上传
 */

class AttachmentController {
    private $uploadDir;

    public function __construct() {
        $this->uploadDir = __DIR__ . '/../../public/uploads';
        if (!is_dir($this->uploadDir)) {
            @mkdir($this->uploadDir, 0777, true);
        }
    }

    public function list() {
        $attachments = Storage::get('attachments');
        jsonResponse(true, $attachments, '获取媒体附件列表成功');
    }

    public function create($body) {
        // 1. 支持真实的 Multipart 二进制文件上传
        if (!empty($_FILES['file']) && $_FILES['file']['error'] === UPLOAD_ERR_OK) {
            $file = $_FILES['file'];
            $originalName = basename($file['name']);
            $ext = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
            $safeExt = $ext ?: 'bin';
            $safeFileName = time() . '_' . substr(bin2hex(random_bytes(4)), 0, 8) . '.' . $safeExt;
            $targetPath = $this->uploadDir . '/' . $safeFileName;

            if (move_uploaded_file($file['tmp_name'], $targetPath)) {
                $attachments = Storage::get('attachments');
                $publicUrl = '/uploads/' . $safeFileName;

                $newAtt = [
                    'id' => 'att-' . (count($attachments) + 1) . '-' . substr(bin2hex(random_bytes(3)), 0, 6),
                    'name' => $originalName,
                    'url' => $publicUrl,
                    'size' => (int)$file['size'],
                    'type' => $file['type'] ?: ('image/' . $safeExt),
                    'uploadedAt' => date('c'),
                    'uploadTime' => date('c'),
                    'uploaderId' => 'admin',
                ];

                array_unshift($attachments, $newAtt);
                Storage::set('attachments', $attachments);
                jsonResponse(true, $newAtt, '文件上传并登记成功', 201);
            } else {
                jsonResponse(false, null, '保存上传文件失败，请检查目录权限', 500);
            }
        }

        // 2. 支持 JSON/URL 登记方式
        $name = trim($body['name'] ?? '');
        $url = trim($body['url'] ?? '');
        if ($name === '' || $url === '') {
            jsonResponse(false, null, '素材名称与访问地址不能为空', 400);
        }

        $attachments = Storage::get('attachments');
        $newAtt = [
            'id' => 'att-' . (count($attachments) + 1) . '-' . substr(bin2hex(random_bytes(3)), 0, 6),
            'name' => $name,
            'url' => $url,
            'size' => (int)($body['size'] ?? 102400),
            'type' => $body['type'] ?? 'image/webp',
            'uploadedAt' => date('c'),
            'uploadTime' => date('c'),
            'uploaderId' => $body['uploaderId'] ?? 'admin',
        ];

        array_unshift($attachments, $newAtt);
        Storage::set('attachments', $attachments);
        jsonResponse(true, $newAtt, '素材登记成功', 201);
    }

    public function delete($id) {
        $attachments = Storage::get('attachments');
        $found = null;
        $filtered = [];

        foreach ($attachments as $a) {
            if ($a['id'] === $id) {
                $found = $a;
            } else {
                $filtered[] = $a;
            }
        }

        if (!$found) {
            jsonResponse(false, null, '目标素材不存在', 404);
        }

        // 若为本地上传的文件，尝试清理物理文件
        if (!empty($found['url']) && str_starts_with($found['url'], '/uploads/')) {
            $filePath = $this->uploadDir . '/' . basename($found['url']);
            if (file_exists($filePath)) {
                @unlink($filePath);
            }
        }

        Storage::set('attachments', $filtered);
        jsonResponse(true, ['id' => $id], '删除素材成功');
    }
}
