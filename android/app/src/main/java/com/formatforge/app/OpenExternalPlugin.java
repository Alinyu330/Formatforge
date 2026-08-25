package com.formatforge.app;

import android.content.Intent;
import android.net.Uri;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * 系统浏览器打开外部链接（Android）
 *
 * 客户端内的信息型页面（使用说明、历史版本）改为在系统默认浏览器打开在线版，
 * 内容随网页部署自动更新，彻底摆脱客户端打包版本滞后的历史问题。
 */
@CapacitorPlugin(name = "OpenExternalNative")
public class OpenExternalPlugin extends Plugin {

    @PluginMethod
    public void open(PluginCall call) {
        String url = call.getString("url");
        if (url == null || url.trim().isEmpty()) {
            call.reject("缺少链接地址");
            return;
        }
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getActivity().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("无法打开浏览器：" + e.getMessage(), e);
        }
    }
}