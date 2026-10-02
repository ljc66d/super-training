' ============================================================
' 超会练 后端开机自启动脚本（静默运行，无窗口）
' 逻辑：等待30秒(网络就绪) -> 检查8000端口 -> 未监听则启动后端
' 用法：放在 Windows 启动文件夹 或 注册为计划任务(看门狗)
' ============================================================
Option Explicit
Dim sh, exec, out
Set sh = CreateObject("Wscript.Shell")

' 等待系统与网络就绪（开机后30秒）
WScript.Sleep 30000

' 检查 8000 端口是否已被监听
Set exec = sh.Exec("cmd /c netstat -ano | findstr :8000 | findstr LISTENING")
out = exec.StdOut.ReadAll

If InStr(out, "LISTENING") = 0 Then
    sh.CurrentDirectory = "f:\super-training\backend"
    sh.Run "cmd /c ""F:\super-training\venv_hrnet\Scripts\python.exe"" run.py --port 8000 >> f:\super-training\backend.log 2>&1", 0, False
End If
