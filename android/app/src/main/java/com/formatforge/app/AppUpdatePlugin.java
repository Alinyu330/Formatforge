package com.formatforge.app;

import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * 应用内更新原生桥接（Android）
 *
 * 更新流程（是否更新完全由用户决定）：
 *   1. JS 端获取 version.json（R2），与 getVersion() 返回的 versionCode 比较
 *   2. 用户确认后 downloadApk(url)——后台线程下载到应用缓存目录，
 *      进度经 updateProgress 事件实时通知（percent 0-100）
 *   3. installApk(filePath)——FileProvider content URI + ACTION_VIEW 唤起
 *      系统安装器；Android 8+ 会先请求用户授予「安装未知应用」权限
 *
 * 清单已声明 REQUEST_INSTALL_PACKAGES；file_paths.xml 已含 cache-path。
 */
@CapacitorPlugin(name = "AppUpdateNative")
public class AppUpdatePlugin extends Plugin {

    /** 下载进度回调的最小间隔（百分比变化 1% 才通知一次，避免桥消息洪泛） */
    private static final int PROGRESS_STEP = 1;

    @PluginMethod
    public void getVersion(PluginCall call) {
        try {
            PackageInfo info = getContext().getPackageManager()
                    .getPackageInfo(getContext().getPackageName(), 0);
            JSObject ret = new JSObject();
            ret.put("versionName", info.versionName);
            if (Build.VERSION.SDK_INT >= 28) {
                ret.put("versionCode", info.getLongVersionCode());
            } else {
                ret.put("versionCode", info.versionCode);
            }
            call.resolve(ret);
        } catch (PackageManager.NameNotFoundException e) {
            call.reject("未找到包信息：" + e.getMessage(), e);
        } catch (Exception e) {
            call.reject("获取版本信息失败：" + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void downloadApk(PluginCall call) {
        String url = call.getString("url");
        if (url == null || url.trim().isEmpty()) {
            call.reject("缺少下载地址");
            return;
        }
        // 后台线程下载，进度经 notifyListeners 推送，完成后 resolve 文件路径
        new Thread(() -> {
            File file = new File(getContext().getCacheDir(), "update_latest.apk");
            HttpURLConnection conn = null;
            try {
                conn = (HttpURLConnection) new URL(url).openConnection();
                conn.setConnectTimeout(15_000);
                conn.setReadTimeout(30_000);
                conn.setInstanceFollowRedirects(true);
                int code = conn.getResponseCode();
                if (code != HttpURLConnection.HTTP_OK) {
                    throw new IllegalStateException("下载服务器返回 " + code);
                }
                long total = conn.getContentLength();
                long done = 0;
                int lastPct = -1;
                try (InputStream is = conn.getInputStream();
                     OutputStream os = new FileOutputStream(file)) {
                    byte[] buf = new byte[64 * 1024];
                    int n;
                    while ((n = is.read(buf)) > 0) {
                        os.write(buf, 0, n);
                        done += n;
                        if (total > 0) {
                            int pct = (int) (done * 100 / total);
                            if (pct - lastPct >= PROGRESS_STEP || pct >= 100) {
                                lastPct = pct;
                                JSObject p = new JSObject();
                                p.put("percent", pct);
                                notifyListeners("updateProgress", p);
                            }
                        }
                    }
                    os.flush();
                }
                if (file.length() == 0) {
                    file.delete();
                    throw new IllegalStateException("下载内容为空");
                }
                JSObject ret = new JSObject();
                ret.put("filePath", file.getAbsolutePath());
                call.resolve(ret);
            } catch (Exception e) {
                if (file.exists()) {
                    file.delete();
                }
                call.reject("下载安装包失败：" + e.getMessage(), e);
            } finally {
                if (conn != null) {
                    conn.disconnect();
                }
            }
        }, "apk-download").start();
    }

    @PluginMethod
    public void installApk(PluginCall call) {
        String filePath = call.getString("filePath");
        if (filePath == null || filePath.trim().isEmpty()) {
            call.reject("缺少安装包路径");
            return;
        }
        File file = new File(filePath);
        if (!file.exists() || file.length() == 0) {
            call.reject("安装包不存在或已损坏，请重新下载");
            return;
        }
        try {
            Uri uri = FileProvider.getUriForFile(
                    getContext(), getContext().getPackageName() + ".fileprovider", file);
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(uri, "application/vnd.android.package-archive");
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("无法启动安装器：" + e.getMessage()
                    + "（请在系统设置中允许本应用「安装未知应用」权限）", e);
        }
    }
}
