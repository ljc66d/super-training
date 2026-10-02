# -*- coding: utf-8 -*-
"""动作纠错路由：关键点输入 → 动作评估/纠错"""
import logging
import threading
import time
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, File, Form, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.training import FormCheckRecord
from app.models.user import User
from app.services.form_check.engine import assess, identify_action
from app.services.form_check.rules import get_supported_actions, get_action_meta

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/form-check", tags=["动作纠错"])


class FormCheckRequest(BaseModel):
    """动作纠错请求：关键点序列"""
    keypoints: list[list[list[float]]] = Field(
        description="关键点序列，每帧为关键点列表[[x,y],...]，COCO17或MediaPipe33",
        min_length=1,
    )
    action: str | None = Field(default=None, description="动作类型（如squat），不传则自动识别")
    format_type: str = Field(default="coco17", description="coco17 / mediapipe33")
    exercise_id: str | None = Field(default=None, description="关联动作库ID")


def _validate_keypoints(req: FormCheckRequest):
    n_kp = len(req.keypoints[0])
    if req.format_type in ("mediapipe33", "mediapipe") and n_kp != 33:
        raise ValueError(f"MediaPipe格式需33个关键点，收到{n_kp}个")
    if req.format_type == "coco17" and n_kp != 17:
        raise ValueError(f"COCO17格式需17个关键点，收到{n_kp}个")


@router.get("/actions")
def list_actions():
    """支持纠错的动作列表"""
    actions = []
    for code in get_supported_actions():
        meta = get_action_meta(code)
        actions.append({"code": code, "name": meta.get("name", code),
                        "category": meta.get("category", ""),
                        "description": meta.get("description", "")})
    return {"code": 0, "data": actions}


@router.post("/assess")
def form_check(req: FormCheckRequest, current_user: User = Depends(get_current_user)):
    """评估动作质量并生成纠错建议（不保存记录）"""
    try:
        _validate_keypoints(req)
    except ValueError as e:
        return {"code": 1, "message": str(e)}

    report = assess(req.keypoints, req.action, req.format_type)
    return {"code": 0, "data": report}


def _build_file_item(name: str, data: bytes) -> dict:
    """按内容魔数判定素材类型，扩展名仅兜底。"""
    fname = (name or "").lower()
    is_img = _looks_like_image(data)
    is_vid = _looks_like_video(data)
    if not is_img and not is_vid:
        is_vid = fname.endswith((".mp4", ".mov", ".webm", ".avi", ".mkv", ".m4v"))
        is_img = not is_vid
    return {"name": fname, "data": data, "is_video": is_vid, "is_image": is_img}


def _run_assessment(file_items: list[dict], action: str | None, user_id: str) -> dict:
    """姿态提取 → 评估 → 保存记录。multipart 与 URL 拉取两条链路共用。

    返回 {"code": 0, "data": report} 或 {"code": 1, "message": ...}。
    """
    has_video = any(it["is_video"] for it in file_items)
    source = "video" if has_video else "photo"
    logger.info("video-assess: n_files=%d action=%s sizes=%s",
                len(file_items), action, [len(it["data"]) for it in file_items])

    engine_used = None
    all_keypoints = []  # 合并所有文件的关键帧
    identified_action = action
    n_failed = 0

    try:
        from app.services.form_check.hrnet_pose import get_hrnet_estimator
        hrnet = get_hrnet_estimator()

        def _extract_one(est, data: bytes, as_video: bool):
            """从单个文件提取关键点；返回 (keypoints_list, identified_action)

            HRNet 的 extract_from_video 接受 (bytes, action)；YOLOv8 只接受 (bytes)。
            通过 inspect 判断签名，避免传错参数导致提取失败。
            """
            import inspect
            try:
                if as_video and hasattr(est, "extract_from_video"):
                    fn = est.extract_from_video
                    params = inspect.signature(fn).parameters
                    raw = fn(data, action) if "action" in params else fn(data)
                elif hasattr(est, "extract_from_image"):
                    raw = est.extract_from_image(data)
                else:
                    return None, None
                if raw is None:
                    return None, None
                if isinstance(raw, tuple) and len(raw) == 2:
                    return raw[0], raw[1]
                return raw, None
            except Exception as e:  # noqa: BLE001
                logger.warning("提取关键点失败: %s", e)
                return None, None

        for it in file_items:
            kpts = None
            id_act = None
            if hrnet.is_available():
                kpts, id_act = _extract_one(hrnet, it["data"], it["is_video"])
                if not kpts:
                    kpts, id_act2 = _extract_one(hrnet, it["data"], not it["is_video"])
                    if id_act2 and not id_act:
                        id_act = id_act2
                engine_used = "hrnet"
            if not kpts:
                from app.services.form_check.pose_estimator import get_pose_estimator
                est = get_pose_estimator()
                kpts, _ = _extract_one(est, it["data"], it["is_video"])
                if not kpts:
                    kpts, _ = _extract_one(est, it["data"], not it["is_video"])
                engine_used = "yolov8"
            if kpts:
                all_keypoints.extend(kpts)
                if id_act and not identified_action:
                    identified_action = id_act
            else:
                n_failed += 1
                logger.info("video-assess: 文件 %s 未检测到人体", it["name"])

        if not all_keypoints:
            msg = "未能从素材中检测到人体骨骼"
            if n_failed == len(file_items):
                msg += "（请确保全身在画面内、光线充足，建议侧面拍摄）"
            return {"code": 1, "message": msg}

        logger.info("video-assess: OK engine=%s n_files=%d/%d total_frames=%d action=%s",
                    engine_used, len(file_items)-n_failed, len(file_items),
                    len(all_keypoints), identified_action)

        # 评估引擎全局 try/except：任何错误都降级为 code=1，不抛 500
        try:
            # 用户指定动作优先；未指定时用HRNet全量帧预识别的动作
            report = assess(all_keypoints, identified_action, "coco17")
        except Exception as e:  # noqa: BLE001
            logger.exception("动作评估异常: %s", e)
            return {"code": 1, "message": f"评估失败: {e}"}

        if not report or (isinstance(report, dict) and report.get("error") and not report.get("score")):
            return {"code": 1, "message": (report or {}).get("error", "未能识别动作")}

        report["source"] = source
        report["frame_count"] = len(all_keypoints)
        report["file_count"] = len(file_items) - n_failed
        report["angle_count"] = len(file_items)  # 用户上传了几个角度
        report["engine"] = engine_used

        # 评估成功后自动保存历史记录
        try:
            from app.database import SessionLocal
            db = SessionLocal()
            try:
                rec = FormCheckRecord(
                    check_id=str(uuid.uuid4()),
                    user_id=user_id,
                    exercise_id=None,
                    score=report.get("score"),
                    angles_json={"indicators": report.get("indicators", [])},
                    feedback_json={
                        "errors": report.get("errors", []),
                        "suggestions": report.get("suggestions", []),
                        "grade": report.get("grade"),
                        "grade_message": report.get("grade_message"),
                        "action_name": report.get("action_name"),
                    },
                )
                db.add(rec)
                db.commit()
                report["check_id"] = rec.check_id
            finally:
                db.close()
        except Exception as e:  # noqa: BLE001
            logger.warning("保存纠错记录失败（不影响评估结果）: %s", e)

        return {"code": 0, "data": report}
    except Exception as e:  # noqa: BLE001
        logger.exception("video-assess 全局异常: %s", e)
        return {"code": 1, "message": f"服务处理异常: {e}"}


@router.post("/video-assess")
async def video_assess(
    files: list[UploadFile] | None = File(default=None),
    file: UploadFile | None = File(default=None),
    action: str | None = Form(default=None),
    current_user: User = Depends(get_current_user),
):
    """上传视频/照片（支持最多3个文件，多角度拍摄）→ 姿态估计 → 动作评估与纠错

    - action: 用户选择的动作类型（6种经典动作）；未传时自动识别（兼容旧版）
    - files: 1~3个视频/照片文件（多文件字段，前端新接口）
    - file: 单个文件字段（兼容旧版前端，仅传一个文件时可用）
    - 优先 HRNet（高精度）；HRNet 不可用时回退 YOLOv8-Pose
    - 任何异常都转成 code=1 错误响应，不返回 500
    """
    # 兼容单文件/多文件两种字段
    uploads: list[UploadFile] = []
    if files:
        uploads.extend([f for f in files if f is not None])
    if file:
        uploads.append(file)
    if not uploads:
        return {"code": 1, "message": "请上传至少一个视频或照片"}
    if len(uploads) > 3:
        return {"code": 1, "message": "最多支持上传3个视频（正面/侧面/背面）"}

    # 读取所有文件字节
    file_items = []
    total_size = 0
    for f in uploads:
        try:
            data = await f.read()
        except Exception as e:  # noqa: BLE001
            return {"code": 1, "message": f"文件 {f.filename} 读取失败: {e}"}
        if not data:
            continue
        total_size += len(data)
        if total_size > 150 * 1024 * 1024:
            return {"code": 1, "message": "文件总大小过大（≤150MB）"}
        file_items.append(_build_file_item(f.filename or "", data))

    if not file_items:
        return {"code": 1, "message": "文件内容为空"}

    return _run_assessment(file_items, action, current_user.user_id)


# ---------- 云存储 URL 链路（小程序专用，异步任务） ----------
#
# callContainer 请求包上限 100KB、单次调用 15s 超时，视频（几 MB、分析 20~60s）
# 两个硬限制都绕不开。前端先 wx.cloud.uploadFile 传云存储，拿临时链接调本接口，
# 后端后台线程拉取并分析，前端再轮询 /video-assess-result 取结果。
# 任务表驻内存：云托管 maxNum=1 单实例，轮询必命中同实例；重启丢任务，
# 前端超时重传即可，可接受。

class VideoAssessUrlsRequest(BaseModel):
    """云存储临时链接形式的视频/照片纠错请求"""
    urls: list[str] = Field(min_length=1, max_length=3)
    action: str | None = None


_TASKS: dict[str, dict] = {}
_TASK_TTL = 1800  # 结果保留 30 分钟


def _task_gc():
    now = time.time()
    for k in [k for k, v in _TASKS.items() if now - v["created_at"] > _TASK_TTL]:
        _TASKS.pop(k, None)


def _run_video_task(task_id: str, urls: list[str], action: str | None, user_id: str):
    from app.services.media_fetch import fetch_bytes
    try:
        file_items = []
        total = 0
        for i, url in enumerate(urls):
            data = fetch_bytes(url, timeout=60)
            total += len(data)
            if total > 150 * 1024 * 1024:
                raise ValueError("文件总大小过大（≤150MB）")
            file_items.append(_build_file_item(f"cloud_{i}.mp4", data))
        result = _run_assessment(file_items, action, user_id)
        if result.get("code") == 0:
            _TASKS[task_id] = {"status": "done", "created_at": time.time(),
                               "report": result["data"]}
        else:
            _TASKS[task_id] = {"status": "failed", "created_at": time.time(),
                               "message": result.get("message", "分析失败")}
    except Exception as e:  # noqa: BLE001
        logger.exception("视频纠错任务失败: %s", e)
        _TASKS[task_id] = {"status": "failed", "created_at": time.time(),
                           "message": f"处理失败: {e}"}


@router.post("/video-assess-urls")
def video_assess_urls(req: VideoAssessUrlsRequest,
                      current_user: User = Depends(get_current_user)):
    """创建视频纠错异步任务，立即返回 task_id（小程序云存储链路）"""
    _task_gc()
    task_id = uuid.uuid4().hex
    _TASKS[task_id] = {"status": "running", "created_at": time.time()}
    threading.Thread(target=_run_video_task,
                     args=(task_id, req.urls, req.action, current_user.user_id),
                     daemon=True).start()
    return {"code": 0, "data": {"task_id": task_id}}


@router.get("/video-assess-result")
def video_assess_result(task_id: str,
                        current_user: User = Depends(get_current_user)):
    """轮询视频纠错任务结果：running / done(report) / failed(message)"""
    _task_gc()
    t = _TASKS.get(task_id)
    if not t:
        return {"code": 1, "message": "任务不存在或已过期，请重新上传"}
    if t["status"] == "done":
        return {"code": 0, "data": {"status": "done", "report": t["report"]}}
    if t["status"] == "failed":
        return {"code": 0, "data": {"status": "failed", "message": t["message"]}}
    return {"code": 0, "data": {"status": "running"}}


def _looks_like_image(data: bytes) -> bool:
    if not data:
        return False
    head = data[:16]
    if head.startswith(b"\xff\xd8\xff"):        # JPEG
        return True
    if head.startswith(b"\x89PNG\r\n\x1a\n"):   # PNG
        return True
    if head.startswith(b"GIF8"):                 # GIF
        return True
    if head.startswith(b"BM"):                   # BMP
        return True
    if head.startswith(b"RIFF") and head[8:12] == b"WEBP":  # WebP
        return True
    return False


def _looks_like_video(data: bytes) -> bool:
    if not data:
        return False
    head = data[:16]
    if head.startswith(b"\x00\x00\x00") and data[4:8] in (b"ftyp", b"moov"):  # MP4/MOV
        return True
    if head.startswith(b"ftyp"):                # MP4
        return True
    if head.startswith(b"1a45dfa3"):            # MKV/WebM (EBML)
        return True
    if head.startswith(b"\x00\x00\x01\xba") or head.startswith(b"\x00\x00\x01\xb3"):  # MPEG
        return True
    if b"webm" in head.lower():
        return True
    return False


@router.post("/save")
def form_check_save(req: FormCheckRequest,
                    current_user: User = Depends(get_current_user),
                    db: Session = Depends(get_db)):
    """评估动作质量，生成纠错建议并保存记录"""
    try:
        _validate_keypoints(req)
    except ValueError as e:
        return {"code": 1, "message": str(e)}

    report = assess(req.keypoints, req.action, req.format_type)
    if "error" in report and not report.get("errors"):
        return {"code": 1, "message": report.get("error", "评估失败")}

    record = FormCheckRecord(
        check_id=str(uuid.uuid4()),
        user_id=current_user.user_id,
        exercise_id=req.exercise_id,
        score=report.get("score"),
        angles_json={"indicators": report.get("indicators", [])},
        feedback_json={"errors": report.get("errors", []),
                       "suggestions": report.get("suggestions", []),
                       "grade": report.get("grade"),
                       "grade_message": report.get("grade_message"),
                       "action_name": report.get("action_name")},
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    return {"code": 0, "data": {**report, "check_id": record.check_id}}


@router.get("/records")
def list_records(current_user: User = Depends(get_current_user),
                 db: Session = Depends(get_db)):
    """查询当前用户的动作纠错历史"""
    rows = db.query(FormCheckRecord) \
        .filter(FormCheckRecord.user_id == current_user.user_id) \
        .order_by(FormCheckRecord.created_at.desc()).limit(50).all()
    return {"code": 0, "data": [{
        "check_id": r.check_id,
        "exercise_id": r.exercise_id,
        "score": float(r.score) if r.score else None,
        "angles_json": r.angles_json,
        "feedback_json": r.feedback_json,
        "created_at": str(r.created_at),
    } for r in rows]}


@router.post("/identify")
def identify(req: FormCheckRequest, current_user: User = Depends(get_current_user)):
    """识别关键点对应的动作类型"""
    try:
        _validate_keypoints(req)
    except ValueError as e:
        return {"code": 1, "message": str(e)}
    from app.services.form_check.skeleton import SkeletonAnalyzer
    frames, normalized = [], None
    for frame in req.keypoints:
        angles = SkeletonAnalyzer.compute_angles(frame)
        frames.append({"keypoints": frame, "angles": angles})
    action = identify_action(frames, normalized)
    meta = get_action_meta(action)
    return {"code": 0, "data": {"action": action, "name": meta.get("name", action)}}
