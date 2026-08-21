package com.formatforge.app;

import android.content.pm.PackageManager;
import android.os.Build;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.BufferedReader;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.InputStream;
import java.io.InputStreamReader;

/**
 * 酷狗 KGG 密钥库原生桥接（Android）
 * - isRooted：检测设备是否已 root
 * - readKugouKeyDb：在 root 设备上读取酷狗音乐客户端的密钥数据库（KGMusicV3.db），返回 base64
 */
@CapacitorPlugin(name = "KugouNative")
public class KugouPlugin extends Plugin {

    private static final String[] SU_PATHS = {
        "/system/bin/su", "/system/xbin/su", "/sbin/su", "/system/sbin/su",
        "/vendor/bin/su", "/su/bin/su", "/data/local/xbin/su", "/data/local/bin/su",
        "/system/sd/xbin/su", "/system/bin/failsafe/su", "/data/adb/su"
    };

    private static final String[] KUGOU_PACKAGES = {
        "com.kugou.android", "com.kugou.android.ct", "com.kugou.android.cmcc"
    };

    private static final String[] DB_FILENAMES = {
        "KGMusicV3.db", "KGMusic.db", "kugou.db", "KGM.db"
    };

    private boolean fileExists(String path) {
        try {
            return new File(path).exists();
        } catch (Exception e) {
            return false;
        }
    }

    private boolean isDeviceRooted() {
        // 1. 常见 su 二进制路径
        for (String p : SU_PATHS) {
            if (fileExists(p)) return true;
        }

        // 2. 构建标签 test-keys 通常是自定义/root ROM
        String tags = Build.TAGS;
        if (tags != null && tags.contains("test-keys")) return true;

        // 3. 常见 root 管理应用
        String[] rootApps = {
            "com.topjohnwu.magisk",
            "eu.chainfire.supersu",
            "com.koushikdutta.superuser",
            "com.noshufou.android.su"
        };
        try {
            PackageManager pm = getContext().getPackageManager();
            for (String pkg : rootApps) {
                try {
                    pm.getPackageInfo(pkg, 0);
                    return true;
                } catch (PackageManager.NameNotFoundException ignored) {
                    // 继续
                }
            }
        } catch (Exception ignored) {
            // 忽略
        }

        // 4. PATH 中是否包含 su
        try {
            Process p = Runtime.getRuntime().exec(new String[]{"which", "su"});
            BufferedReader in = new BufferedReader(new InputStreamReader(p.getInputStream()));
            String line = in.readLine();
            p.destroy();
            if (line != null && !line.trim().isEmpty()) return true;
        } catch (Exception ignored) {
            // 忽略
        }

        return false;
    }

    private byte[] runSuBinary(String command) {
        try {
            Process process = Runtime.getRuntime().exec(new String[]{"su", "-c", command});
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            InputStream in = process.getInputStream();
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) != -1) {
                out.write(buf, 0, n);
            }
            process.waitFor();
            byte[] result = out.toByteArray();
            return result.length == 0 ? null : result;
        } catch (Exception e) {
            return null;
        }
    }

    @PluginMethod
    public void isRooted(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("rooted", isDeviceRooted());
        call.resolve(ret);
    }

    @PluginMethod
    public void readKugouKeyDb(PluginCall call) {
        if (!isDeviceRooted()) {
            JSObject ret = new JSObject();
            ret.put("data", JSObject.NULL);
            call.resolve(ret);
            return;
        }

        byte[] data = null;
        boolean found = false;

        // 1. 直接尝试已知的候选路径
        outer:
        for (String pkg : KUGOU_PACKAGES) {
            for (String name : DB_FILENAMES) {
                String[] paths = {
                    "/data/data/" + pkg + "/databases/" + name,
                    "/data/data/" + pkg + "/files/" + name,
                    "/data/data/" + pkg + "/files/db/" + name,
                    "/data/user/0/" + pkg + "/databases/" + name
                };
                for (String path : paths) {
                    byte[] candidate = runSuBinary("cat " + path + " 2>/dev/null");
                    if (candidate != null && candidate.length >= 1024) {
                        data = candidate;
                        found = true;
                        break outer;
                    }
                }
            }
        }

        // 2. 兜底：用 find 在酷狗数据目录下查找 .db 文件并逐个尝试
        if (!found) {
            for (String pkg : KUGOU_PACKAGES) {
                String find = "find /data/data/" + pkg + " /data/user/0/" + pkg + " -name '*.db' 2>/dev/null";
                byte[] listing = runSuBinary(find);
                if (listing == null) continue;
                String linesText;
                try {
                    linesText = new String(listing, "UTF-8");
                } catch (Exception e) {
                    linesText = new String(listing);
                }
                for (String line : linesText.split("\\r?\\n")) {
                    String path = line.trim();
                    if (path.isEmpty() || !path.endsWith(".db")) continue;
                    byte[] candidate = runSuBinary("cat " + path + " 2>/dev/null");
                    if (candidate != null && candidate.length >= 1024) {
                        data = candidate;
                        found = true;
                        break;
                    }
                }
                if (found) break;
            }
        }

        JSObject ret = new JSObject();
        if (found && data != null) {
            ret.put("data", Base64.encodeToString(data, Base64.NO_WRAP));
        } else {
            ret.put("data", JSObject.NULL);
        }
        call.resolve(ret);
    }
}