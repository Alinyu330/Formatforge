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
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 文件保存原生桥接（Android）
 *
 * 分块保存协议（v20 起，修复大文件保存卡死闪退）：
 *   1. beginSave(filename, mimeType)     → 在应用缓存目录创建临时文件，返回 token
 *   2. appendChunk(token, data)          → base64 分块（约 512KB/块）追加写入临时文件
 *   3. finishSave(token)                 → 临时文件完整复制到系统公共下载目录（Download/），
 *                                          Android 10+ 走 MediaStore（无需存储权限），
 *                                          Android 9 及以下直接写公共目录并申请权限。
 *
 * 旧的 saveToDownloads（整文件 base64 一次传输）保留兼容，但 JS 端已不再使用：
 * 大 base64 字符串跨桥传输会造成 3 倍以上内存峰值，导致 WebView OOM 闪退。
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

    /** 进行中的分块保存会话：token → 待落盘信息 */
    private final Map<String, PendingSave> pendingSaves = new ConcurrentHashMap<>();

    private static class PendingSave {
        final File tempFile;
        final String displayName;
        final String mimeType;

        PendingSave(File tempFile, String displayName, String mimeType) {
            this.tempFile = tempFile;
            this.displayName = displayName;
            this.mimeType = mimeType;
        }
    }

    // ==================== 分块保存协议 ====================

    @PluginMethod
    public void beginSave(PluginCall call) {
        String filename = call.getString("filename");
        String mimeType = call.getString("mimeType");
        if (filename == null || filename.trim().isEmpty()) {
            call.reject("缺少文件名");
            return;
        }
        filename = sanitizeFilename(filename.trim());
        if (mimeType == null || mimeType.trim().isEmpty()) {
            mimeType = guessMimeType(filename);
        }
        try {
            // Android 9 及以下最终写公共目录需要权限，提前到 beginSave 申请，
            // 避免 finishSave（数据已在临时文件）阶段才弹权限导致会话中断
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q
                    && !hasPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE)) {
                requestPermissionForAlias("storage", call, "handleBeginSavePermissionResult");
                return;
            }
            doBeginSave(call, filename, mimeType);
        } catch (Exception e) {
            call.reject("创建保存会话失败：" + e.getMessage(), e);
        }
    }

    @ActivityCallback
    private void handleBeginSavePermissionResult(PluginCall call, ActivityResult result) {
        if (!hasPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE)) {
            call.reject("未授予存储权限，无法保存到下载目录，请在系统设置中允许存储权限后重试");
            return;
        }
        String filename = call.getString("filename");
        String mimeType = call.getString("mimeType");
        if (filename == null || filename.trim().isEmpty()) {
            call.reject("缺少文件名");
            return;
        }
        filename = sanitizeFilename(filename.trim());
        if (mimeType == null || mimeType.trim().isEmpty()) {
            mimeType = guessMimeType(filename);
        }
        doBeginSave(call, filename, mimeType);
    }

    private void doBeginSave(PluginCall call, String filename, String mimeType) {
        try {
            File tempDir = new File(getContext().getCacheDir(), "saves");
            if (!tempDir.exists() && !tempDir.mkdirs()) {
                call.reject("无法创建临时目录");
                return;
            }
            File tempFile = new File(tempDir, "save_" + System.nanoTime());
            if (!tempFile.createNewFile()) {
                call.reject("无法创建临时文件");
                return;
            }
            String token = "t" + System.nanoTime();
            pendingSaves.put(token, new PendingSave(tempFile, filename, mimeType));

            JSObject ret = new JSObject();
            ret.put("token", token);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("创建保存会话失败：" + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void appendChunk(PluginCall call) {
        String token = call.getString("token");
        String data = call.getString("data");
        if (token == null || data == null || data.isEmpty()) {
            call.reject("缺少 token 或分块数据");
            return;
        }
        PendingSave save = pendingSaves.get(token);
        if (save == null) {
            call.reject("保存会话不存在或已结束");
            return;
        }
        try {
            byte[] bytes = Base64.decode(data, Base64.NO_WRAP);
            if (bytes.length == 0) {
                call.reject("分块数据为空");
                return;
            }
            // 追加写临时文件；同步锁保证同一会话内块顺序写入
            synchronized (save) {
                try (FileOutputStream fos = new FileOutputStream(save.tempFile, true)) {
                    fos.write(bytes);
                    fos.flush();
                    fos.getFD().sync();
                }
            }
            call.resolve();
        } catch (Exception e) {
            // 任一块失败即终止会话并清理，避免半截文件落盘
            cleanupPending(token);
            call.reject("写入分块失败：" + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void finishSave(PluginCall call) {
        String token = call.getString("token");
        if (token == null) {
            call.reject("缺少 token");
            return;
        }
        PendingSave save = pendingSaves.remove(token);
        if (save == null) {
            call.reject("保存会话不存在或已结束");
            return;
        }
        File tempFile = save.tempFile;
        if (!tempFile.exists() || tempFile.length() == 0) {
            tempFile.delete();
            call.reject("保存会话没有数据");
            return;
        }
        try {
            String savedName;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                savedName = publishViaMediaStore(tempFile, save.displayName, save.mimeType);
            } else {
                savedName = publishViaLegacyPath(tempFile, save.displayName);
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
        } finally {
            // 无论成败都清理临时文件
            tempFile.delete();
        }
    }

    /** 取消进行中的保存会话（JS 端异常中止时调用） */
    @PluginMethod
    public void cancelSave(PluginCall call) {
        String token = call.getString("token");
        if (token != null) {
            cleanupPending(token);
        }
        call.resolve();
    }

    private void cleanupPending(String token) {
        PendingSave save = pendingSaves.remove(token);
        if (save != null) {
            save.tempFile.delete();
        }
    }

    // ==================== 旧接口（整文件 base64，仅兼容保留） ====================

    @PluginMethod
    public void saveToDownloads(PluginCall call) {
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
                savedName = saveBytesViaMediaStore(bytes, filename, mimeType);
            } else {
                savedName = saveBytesViaLegacyPath(bytes, filename);
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

    // ==================== 公共下载目录落盘实现 ====================

    /** Android 10+：临时文件流式复制到 MediaStore 下载记录，无需任何权限 */
    private String publishViaMediaStore(File tempFile, String filename, String mimeType) throws Exception {
        ContentValues values = new ContentValues();
        values.put(MediaStore.Downloads.DISPLAY_NAME, filename);
        values.put(MediaStore.Downloads.MIME_TYPE, mimeType);
        values.put(MediaStore.Downloads.IS_PENDING, 1);
        Uri uri = getContext().getContentResolver()
                .insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
        if (uri == null) {
            throw new IllegalStateException("无法创建下载记录");
        }
        try (InputStream is = new FileInputStream(tempFile);
             OutputStream os = getContext().getContentResolver().openOutputStream(uri)) {
            if (os == null) throw new IllegalStateException("无法打开输出流");
            copyStream(is, os);
        } catch (Exception e) {
            try { getContext().getContentResolver().delete(uri, null, null); } catch (Exception ignored) { }
            throw e;
        }
        ContentValues done = new ContentValues();
        done.put(MediaStore.Downloads.IS_PENDING, 0);
        getContext().getContentResolver().update(uri, done, null, null);
        return filename;
    }

    /** Android 9 及以下：临时文件复制到公共下载目录，重名自动追加序号 */
    private String publishViaLegacyPath(File tempFile, String filename) throws Exception {
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
        try (InputStream is = new FileInputStream(tempFile);
             FileOutputStream fos = new FileOutputStream(target)) {
            copyStream(is, fos);
        }
        try {
            Intent scan = new Intent(Intent.ACTION_MEDIA_SCANNER_SCAN_FILE);
            scan.setData(Uri.fromFile(target));
            getContext().sendBroadcast(scan);
        } catch (Exception ignored) {
            // 个别 ROM 禁止该广播，不影响保存结果
        }
        return target.getName();
    }

    private static void copyStream(InputStream is, OutputStream os) throws Exception {
        byte[] buf = new byte[64 * 1024];
        int n;
        while ((n = is.read(buf)) > 0) {
            os.write(buf, 0, n);
        }
        os.flush();
    }

    // ==================== 旧接口的字节数组落盘实现 ====================

    private String saveBytesViaMediaStore(byte[] bytes, String filename, String mimeType) throws Exception {
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
            try { getContext().getContentResolver().delete(uri, null, null); } catch (Exception ignored) { }
            throw e;
        }
        ContentValues done = new ContentValues();
        done.put(MediaStore.Downloads.IS_PENDING, 0);
        getContext().getContentResolver().update(uri, done, null, null);
        return filename;
    }

    private String saveBytesViaLegacyPath(byte[] bytes, String filename) throws Exception {
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
        try {
            Intent scan = new Intent(Intent.ACTION_MEDIA_SCANNER_SCAN_FILE);
            scan.setData(Uri.fromFile(target));
            getContext().sendBroadcast(scan);
        } catch (Exception ignored) { }
        return target.getName();
    }

    // ==================== 工具方法 ====================

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
