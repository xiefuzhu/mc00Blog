<?php
/**
 * 站点全局设置控制器
 */

class SettingsController {
    public function get() {
        $settings = Storage::get('settings');
        jsonResponse(true, $settings, '获取站点设置成功');
    }

    public function update($body) {
        $settings = Storage::get('settings');
        foreach ($body as $key => $val) {
            $settings[$key] = $val;
        }
        Storage::set('settings', $settings);
        jsonResponse(true, $settings, '站点设置更新成功');
    }
}
