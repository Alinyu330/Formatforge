package com.formatforge.app;

import android.Manifest;
import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.MimeTypeMap;
import android.widget.Toast;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

/**
 * 文件保存原生桥接（Android）
 * - saveToDownloads：将 base64 文件数据保存到系统公共下载目录（Download/）
 *   Android 10+ 走 MediaStore（无需存储权限），旧版本直接写公共目录并申请权限。
 *   解决 WebView 内 <a download> 点击无响应的问题。
 */
@CapacitorPlugin(
    name = "SaveFileNative",
    permissions = {
        @Permission(
            strings = { Manifest.permission.WRITE_EXTERNAL_STORAGE },
            alias = "storage"
        )
    }
)
public class SaveFilePlugin extends Plugin {

    @PluginMethod
    public void saveToDownloads(PluginCall call) {
        // Android 9 及以下写公共下载目录需要运行时存储权限
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q
                && !hasPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE)) {
            requestPermissionForAlias("storage", call, "handleStoragePermissionResult");
            return;
        }
        performSave(call);
    }

    @ActivityCallback
    private void handleStoragePermissionResult(PluginCall call, ActivityResult result) {
        if (hasPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE)) {
            performSave(call);
        } else {
            call.reject("未授予存储权限，无法保存到下载目录，请在系统设置中允许存储权限后重试");
        }
    }

    private void performSave(PluginCall call) {
        String data = call.getString("data");
        String filename = call.getString("filename");
        String mimeType = call.getString("mimeType");

        if (data == null || data.isEmpty()) {
            call.reject("缺少文件数据");
            return;
        }
        if (filename == null || filename.trim().isEmpty()) {
            call.reject("缺少文件名");
            return;
        }
        filename = sanitizeFilename(filename.trim());

        byte[] bytes;
        try {
            bytes = Base64.decode(data, Base64.NO_WRAP);
        } catch (Exception e) {
            call.reject("文件数据解码失败");
            return;
        }
        if (bytes.length == 0) {
            call.reject("文件数据为空");
            return;
        }

        if (mimeType == null || mimeType.trim().isEmpty()) {
            mimeType = guessMimeType(filename);
        }

        try {
            String savedName;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                savedName = saveViaMediaStore(bytes, filename, mimeType);
            } else {
                savedName = saveViaLegacyPath(bytes, filename);
            }

            final String toastText = "已保存到 Download/" + savedName;
            getActivity().runOnUiThread(() ->
                    Toast.makeText(getContext(), toastText, Toast.LENGTH_LONG).show());

            JSObject ret = new JSObject();
            ret.put("saved", true);
            ret.put("path", "Download/" + savedName);
            call.resolve(ret);
        } catch (SecurityException e) {
            call.reject("没有写入下载目录的权限，请授予存储权限后重试");
        } catch (Exception e) {
            call.reject("保存失败：" + e.getMessage(), e);
        }
    }

    /** Android 10+：MediaStore 插入下载记录，无需任何权限 */
    private String saveViaMediaStore(byte[] bytes, String filename, String mimeType) throws Exception {
        ContentValues values = new ContentValues();
        values.put(MediaStore.Downloads.DISPLAY_NAME, filename);
        values.put(MediaStore.Downloads.MIME_TYPE, mimeType);
        values.put(MediaStore.Downloads.IS_PENDING, 1);
        Uri uri = getContext().getContentResolver()
                .insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
        if (uri == null) {
            throw new IllegalStateException("无法创建下载记录");
        }
        try (OutputStream os = getContext().getContentResolver().openOutputStream(uri)) {
            if (os == null) throw new IllegalStateException("无法打开输出流");
            os.write(bytes);
            os.flush();
        } catch (Exception e) {
            // 写入失败时清理 pending 记录，避免残留 0B 文件
            try { getContext().getContentResolver().delete(uri, null, null); } catch (Exception ignored) { }
            throw e;
        }
        ContentValues done = new ContentValues();
        done.put(MediaStore.Downloads.IS_PENDING, 0);
        getContext().getContentResolver().update(uri, done, null, null);
        return filename;
    }

    /** Android 9 及以下：直接写公共下载目录，重名自动追加序号 */
    private String saveViaLegacyPath(byte[] bytes, String filename) throws Exception {
        File dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
        if (!dir.exists() && !dir.mkdirs()) {
            throw new IllegalStateException("下载目录不存在且无法创建");
        }
        String base = filename;
        String ext = "";
        int dot = filename.lastIndexOf('.');
        if (dot >= 0) {
            base = filename.substring(0, dot);
            ext = filename.substring(dot);
        }
        File target = new File(dir, filename);
        int seq = 1;
        while (target.exists()) {
            target = new File(dir, base + " (" + (seq++) + ")" + ext);
        }
        try (FileOutputStream fos = new FileOutputStream(target)) {
            fos.write(bytes);
            fos.flush();
        }
        // 通知媒体扫描器立即可见
        try {
            Intent scan = new Intent(Intent.ACTION_MEDIA_SCANNER_SCAN_FILE);
            scan.setData(Uri.fromFile(target));
            getContext().sendBroadcast(scan);
        } catch (Exception ignored) {
            // 个别 ROM 禁止该广播，不影响保存结果
        }
        return target.getName();
    }

    /** 清理文件名中的非法字符（Android 各版本对路径分隔符敏感） */
    private String sanitizeFilename(String name) {
        String cleaned = name.replaceAll("[\\\\/:*?\"<>|]", "_").trim();
        return cleaned.isEmpty() ? "download" : cleaned;
    }

    private String guessMimeType(String filename) {
        String ext = "";
        int dot = filename.lastIndexOf('.');
        if (dot >= 0 && dot < filename.length() - 1) {
            ext = filename.substring(dot + 1).toLowerCase();
        }
        String type = MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext);
        return type != null ? type : "application/octet-stream";
    }
}
