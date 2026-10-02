# -*- coding: utf-8 -*-
"""视频/图片 → 人体姿态关键点（YOLOv8-Pose ONNX，纯 ONNX Runtime CPU 推理）

- 模型：backend/models/yolov8n-pose.onnx（COCO17 关键点，输出直接兼容评估引擎）
- 输入：视频（mp4/mov/webm）或图片
- 输出：关键点序列 list[[x,y,conf]*17]，像素坐标
- 惰性加载，模型缺失/失败返回 None（不抛错）
"""
import logging
import os
import tempfile

import numpy as np

from app.services.form_check.hrnet_pose import _transcode_mp4

logger = logging.getLogger(__name__)

_MODELS_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(
        os.path.abspath(__file__))))), "models")
DEFAULT_MODEL = os.path.join(_MODELS_DIR, "yolov8n-pose.onnx")

IMGSZ = 640           # 模型输入尺寸
MAX_FRAMES = 60       # 最多抽 60 帧（评估足够，控制耗时）
FRAME_STRIDE = 3      # 每 3 帧取 1 帧

try:
    import cv2  # noqa: F401
except ImportError:
    cv2 = None


class PoseEstimator:
    """YOLOv8-Pose 姿态估计器（惰性加载）"""

    def __init__(self, model_path: str | None = None):
        self.model_path = model_path or DEFAULT_MODEL
        self._session = None

    def _ensure_session(self) -> bool:
        if self._session is not None:
            return True
        if not os.path.exists(self.model_path):
            logger.info("姿态估计模型不存在（%s），跳过", self.model_path)
            return False
        try:
            import onnxruntime as ort
            self._session = ort.InferenceSession(
                self.model_path, providers=["CPUExecutionProvider"])
            logger.info("姿态估计模型加载成功: %s", self.model_path)
            return True
        except Exception as e:  # noqa: BLE001
            logger.warning("姿态估计模型加载失败: %s", e)
            self._session = None
            return False

    # ---- 推理核心 ----
    def _infer(self, img_bgr: np.ndarray) -> list[list[float]] | None:
        """单帧姿态推理 → COCO17 关键点 [x,y,conf]*17（原图像素坐标）"""
        if cv2 is None or not self._ensure_session():
            return None
        try:
            h, w = img_bgr.shape[:2]
            # letterbox 到 640
            scale = IMGSZ / max(h, w)
            new_w, new_h = int(round(w * scale)), int(round(h * scale))
            resized = cv2.resize(img_bgr, (new_w, new_h))
            canvas = np.zeros((IMGSZ, IMGSZ, 3), dtype=np.uint8)
            canvas[:new_h, :new_w] = resized
            blob = cv2.cvtColor(canvas, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
            blob = np.transpose(blob, (2, 0, 1))[None]
            out = self._session.run(None, {self._session.get_inputs()[0].name: blob})[0]
            # out: (1, 56, 8400): [x,y,w,h, kpt17*3, cls_conf]
            preds = out[0].T  # (8400, 56)
            confs = preds[:, 4]  # box 置信度
            best = int(np.argmax(confs))
            if confs[best] < 0.25:
                return None
            row = preds[best]
            kpts = row[4:55].reshape(17, 3)  # x, y, conf
            # 坐标还原到原图
            kpts[:, 0] /= scale
            kpts[:, 1] /= scale
            return kpts.tolist()
        except Exception as e:  # noqa: BLE001
            logger.warning("姿态推理失败: %s", e)
            return None

    def detect_human_box(self, img_bgr: np.ndarray) -> list[int] | None:
        """检测画面中置信度最高的人体框 [x1, y1, x2, y2]（原图像素）。
        用于 HRNet 的 top-down 裁剪放大，人占画面小也能识别。
        模型不可用/未检测到时返回 None（不抛错）。
        """
        if cv2 is None or not self._ensure_session():
            return None
        try:
            h, w = img_bgr.shape[:2]
            scale = IMGSZ / max(h, w)
            new_w, new_h = int(round(w * scale)), int(round(h * scale))
            resized = cv2.resize(img_bgr, (new_w, new_h))
            canvas = np.zeros((IMGSZ, IMGSZ, 3), dtype=np.uint8)
            canvas[:new_h, :new_w] = resized
            blob = cv2.cvtColor(canvas, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
            blob = np.transpose(blob, (2, 0, 1))[None]
            out = self._session.run(None, {self._session.get_inputs()[0].name: blob})[0]
            preds = out[0].T
            confs = preds[:, 4]
            best = int(np.argmax(confs))
            if confs[best] < 0.25:
                return None
            row = preds[best]
            cx, cy, bw, bh = row[0] / scale, row[1] / scale, row[2] / scale, row[3] / scale
            x1, y1 = int(cx - bw / 2), int(cy - bh / 2)
            x2, y2 = int(cx + bw / 2), int(cy + bh / 2)
            # 扩大 15% 留边，并夹到图内
            pad_x, pad_y = int(bw * 0.15), int(bh * 0.15)
            x1, y1 = max(0, x1 - pad_x), max(0, y1 - pad_y)
            x2, y2 = min(w, x2 + pad_x), min(h, y2 + pad_y)
            if x2 - x1 < 10 or y2 - y1 < 10:
                return None
            return [x1, y1, x2, y2]
        except Exception as e:  # noqa: BLE001
            logger.warning("人体框检测失败: %s", e)
            return None

    # ---- 视频处理 ----
    def extract_from_video(self, video_bytes: bytes) -> list[list[list[float]]] | None:
        """解析视频 → 关键点序列（抽帧 + 姿态推理）

        兼容多种编码：opencv 打不开（如 HEVC）时用系统 ffmpeg 转 H.264 再解码。
        """
        if cv2 is None or not video_bytes:
            return None
        tmp = tempfile.NamedTemporaryFile(suffix=".mp4", delete=False)
        try:
            tmp.write(video_bytes)
            tmp.close()
            frames_out = self._read_frames(tmp.name)
            if not frames_out:
                trans = _transcode_mp4(tmp.name)
                if trans:
                    frames_out = self._read_frames(trans)
                    try:
                        os.unlink(trans)
                    except OSError:
                        pass
            return frames_out or None
        except Exception as e:  # noqa: BLE001
            logger.warning("视频解析失败: %s", e)
            return None
        finally:
            try:
                os.unlink(tmp.name)
            except OSError:
                pass

    def _read_frames(self, path: str) -> list | None:
        cap = cv2.VideoCapture(path)
        if not cap.isOpened():
            return None
        frames_out = []
        idx = 0
        try:
            while True:
                ok, frame = cap.read()
                if not ok:
                    break
                if idx % FRAME_STRIDE == 0:
                    kpts = self._infer(frame)
                    if kpts:
                        frames_out.append(kpts)
                    if len(frames_out) >= MAX_FRAMES:
                        break
                idx += 1
        finally:
            cap.release()
        return frames_out or None

    # ---- 图片处理 ----
    def extract_from_image(self, image_bytes: bytes) -> list[list[list[float]]] | None:
        """解析图片 → 关键点（单帧包装为序列）"""
        if cv2 is None or not image_bytes:
            return None
        try:
            img = cv2.imdecode(np.frombuffer(image_bytes, np.uint8), cv2.IMREAD_COLOR)
            if img is None:
                return None
            kpts = self._infer(img)
            if not kpts:
                return None
            return [kpts]
        except Exception as e:  # noqa: BLE001
            logger.warning("图片解析失败: %s", e)
            return None


# 全局单例
_estimator: PoseEstimator | None = None


def get_pose_estimator() -> PoseEstimator:
    global _estimator
    if _estimator is None:
        _estimator = PoseEstimator()
    return _estimator
