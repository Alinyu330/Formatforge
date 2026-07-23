; ===== FormatForge InnoSetup 安装包脚本 =====
; 用法：
;   1. 先执行 npm run electron:pack 生成 dist\win-unpacked\
;   2. 用 Inno Setup Compiler 打开本文件编译（或命令行 ISCC.exe installer.iss）
;   3. 产物位于 installer-output\FormatForge-Setup-1.0.0.exe

#define MyAppName "FormatForge"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "FormatForge"
#define MyAppExeName "FormatForge.exe"
#define MyAppIcon "assets\appIcon.ico"

[Setup]
; AppId 保持唯一，用于升级覆盖识别（勿改）
AppId={{com.formatforge.app}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL=https://github.com/
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
; 输出目录与文件名
OutputDir=installer-output
OutputBaseFilename=FormatForge-Setup-{#MyAppVersion}
; 安装包图标（项目自带 ico）
SetupIconFile={#MyAppIcon}
UninstallDisplayIcon={app}\{#MyAppExeName}
UninstallDisplayName={#MyAppName}
; 压缩
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
; 限定 64 位系统
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitAddressSpace=x64compatible
PrivilegesRequired=admin
; 首次安装显示语言选择
ShowLanguageDialog=yes

[Languages]
Name: "chinesesimp"; MessagesFile: "compiler:Languages\ChineseSimplified.isl"
Name: "english"; MessagesFile: "compiler:Languages\English.isl"

[Tasks]
Name: "desktopicon"; Description: "创建桌面快捷方式(&D)"; GroupDescription: "附加任务:"; Flags: checkedonce
Name: "startup"; Description: "开机自启动(&S)"; GroupDescription: "附加任务:"; Flags: unchecked

[Files]
; 把 electron-builder 解包后的整个目录搬进安装目录
Source: "dist\win-unpacked\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\{#MyAppExeName}"
Name: "{group}\卸载 {#MyAppName}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon; IconFilename: "{app}\{#MyAppExeName}"
; 开机自启动（写入当前用户启动项）
Name: "{userstartup}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: startup; IconFilename: "{app}\{#MyAppExeName}"

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "立即启动 {#MyAppName}"; Flags: nowait postinstall skipifsilent

[UninstallRun]
; 卸载前强制结束进程
Filename: "{cmd}"; Parameters: "/C taskkill /IM {#MyAppExeName} /F"; Flags: runhidden; RunOnceId: "KillApp"

; 如需卸载时清理用户数据，取消下面一行注释
; [UninstallDelete]
; Type: filesandordirs; Name: "{%LOCALAPPDATA}\{#MyAppName}"

[Code]
// 安装前关闭正在运行的旧版本
function InitializeSetup(): Boolean;
var
  ResultCode: Integer;
begin
  Exec(ExpandConstant('{cmd}'), '/C taskkill /IM {#MyAppExeName} /F', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Result := True;
end;

// 卸载前关闭正在运行的程序
function InitializeUninstall(): Boolean;
var
  ResultCode: Integer;
begin
  Exec(ExpandConstant('{cmd}'), '/C taskkill /IM {#MyAppExeName} /F', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Result := True;
end;
