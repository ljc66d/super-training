# -*- coding: utf-8 -*-
"""本地 YOLO 食物检测器（ONNX Runtime，纯 CPU 无 GPU 依赖）

设计来源：
- letterbox 预处理 / scale_boxes 坐标还原 / 输出解析：提取自 YOLOv8-main（YOLOv8s 训练部署项目）
- NMS 后处理：复用 app/utils/cv_math.box_non_max_suppression（NumPy 实现，supervision 同款算法）
- 分割能力：支持 YOLOv8-seg（实例分割），mask 面积计算分量（比框面积更准）。
  相比 Mask2Former（detectron2+自定义CUDA算子，CPU 不可实时），YOLOv8-seg 同生态、轻量、可 ONNX 导出。

模型文件：backend/models/yolov8s_food.onnx（检测）或 yolov8s_food_seg.onnx（分割），
放入后自动生效；缺失时优雅降级。自动识别 detect/seg 输出。

调用：
    det = YOLODetector()                 # 惰性加载（首次 detect 才初始化）
    foods = det.detect(image_bytes)      # [{"name","confidence","weight_g","box","mask_area_ratio"}] 或 None
"""
import logging
import os

import numpy as np

from app.utils.cv_math import box_non_max_suppression

logger = logging.getLogger(__name__)

# opencv 可选依赖（pip install opencv-python-headless），缺失时检测功能自动降级
try:
    import cv2  # noqa: F401
except ImportError:  # pragma: no cover
    cv2 = None  # type: ignore[assignment]

# app/services/ai/yolo_detector.py → 上溯 4 层到 backend/
_MODELS_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(
        os.path.abspath(__file__))))), "models")
DEFAULT_MODEL = os.path.join(_MODELS_DIR, "yolov8s_food.onnx")

CONF_THRES = 0.30   # 置信度阈值（低于视为未检测到）
IOU_THRES = 0.45    # NMS IoU 阈值
INPUT_SIZE = 640    # letterbox 目标尺寸
MAX_DET = 50        # 最多保留检测数
# 无元数据时的默认类别名（模型导出时 ultralytics 会写入 names 元数据，优先使用）
_DEFAULT_NAMES = ["food"]


def letterbox(img: np.ndarray, new_shape: int = INPUT_SIZE, color=(114, 114, 114)):
    """YOLO letterbox：等比缩放 + 灰边填充（提取自 YOLOv8-main inference.py）

    Returns: (padded_img, ratio, (dw, dh))
    """
    shape = img.shape[:2]  # (h, w)
    r = min(new_shape / shape[0], new_shape / shape[1])
    new_unpad = (int(round(shape[1] * r)), int(round(shape[0] * r)))  # (w, h)
    dw = (new_shape - new_unpad[0]) / 2
    dh = (new_shape - new_unpad[1]) / 2
    if shape[::-1] != new_unpad:
        img = cv2.resize(img, new_unpad, interpolation=cv2.INTER_LINEAR)
    top, bottom = int(round(dh - 0.1)), int(round(dh + 0.1))
    left, right = int(round(dw - 0.1)), int(round(dw + 0.1))
    img = cv2.copyMakeBorder(img, top, bottom, left, right, cv2.BORDER_CONSTANT, value=color)
    return img, r, (dw, dh)


def xywh2xyxy(x: np.ndarray) -> np.ndarray:
    """中心点宽高 → 左上右下（YOLO 输出格式转换）"""
    y = np.copy(x)
    y[..., 0] = x[..., 0] - x[..., 2] / 2  # x1
    y[..., 1] = x[..., 1] - x[..., 3] / 2  # y1
    y[..., 2] = x[..., 0] + x[..., 2] / 2  # x2
    y[..., 3] = x[..., 1] + x[..., 3] / 2  # y2
    return y


def scale_boxes(img1_shape: tuple, boxes: np.ndarray, img0_shape: tuple) -> np.ndarray:
    """将 letterbox 空间坐标还原回原图（提取自 ultralytics ops.scale_boxes）"""
    gain = min(img1_shape[0] / img0_shape[0], img1_shape[1] / img0_shape[1])
    pad_x = (img1_shape[1] - img0_shape[1] * gain) / 2
    pad_y = (img1_shape[0] - img0_shape[0] * gain) / 2
    boxes[..., [0, 2]] -= pad_x
    boxes[..., [1, 3]] -= pad_y
    boxes[..., :4] /= gain
    # 裁剪到原图边界
    boxes[..., [0, 2]] = boxes[..., [0, 2]].clip(0, img0_shape[1])
    boxes[..., [1, 3]] = boxes[..., [1, 3]].clip(0, img0_shape[0])
    return boxes


class YOLODetector:
    """本地 YOLO 食物检测器（惰性加载，模型缺失/推理失败返回 None 不抛错）"""

    def __init__(self, model_path: str | None = None, names: list[str] | None = None):
        self.model_path = model_path or DEFAULT_MODEL
        self.names = names or _DEFAULT_NAMES
        self._session = None
        self._meta_names: list[str] | None = None

    # ---- 惰性加载 ----
    def _ensure_session(self):
        if self._session is not None:
            return True
        if not os.path.exists(self.model_path):
            logger.info("本地YOLO模型不存在（%s），跳过本地检测", self.model_path)
            return False
        try:
            import onnxruntime as ort
            self._session = ort.InferenceSession(
                self.model_path, providers=["CPUExecutionProvider"])
            # 从模型元数据读取类别名（ultralytics 导出时写入 custom_metadata_map["names"]）
            meta = self._session.get_modelmeta().custom_metadata_map or {}
            names_raw = meta.get("names")
            if names_raw:
                try:
                    self._meta_names = list(eval(names_raw).values())  # noqa: S307 模型自身元数据
                except Exception:  # noqa: BLE001
                    self._meta_names = None
            logger.info("本地YOLO模型加载成功（%s）", self.model_path)
            return True
        except Exception as e:  # noqa: BLE001
            logger.warning("本地YOLO模型加载失败（降级）: %s", e)
            self._session = None
            return False

    # ---- 主入口 ----
    def detect(self, image_bytes: bytes, image_name: str = "") -> list[dict] | None:
        """检测图片中的食物，返回 [{"name","confidence","weight_g","box","mask_area_ratio"}]；无配置/失败返回 None。"""
        if not image_bytes or not self._ensure_session():
            return None
        if cv2 is None:
            logger.warning("缺少 opencv（pip install opencv-python-headless），本地检测不可用")
            return None
        try:
            img = cv2.imdecode(np.frombuffer(image_bytes, np.uint8), cv2.IMREAD_COLOR)
            if img is None:
                return None
            h0, w0 = img.shape[:2]
            # 1. 预处理：letterbox + BGR2RGB + 归一化 + NCHW
            padded, _, _ = letterbox(img)
            blob = cv2.cvtColor(padded, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
            blob = np.transpose(blob, (2, 0, 1))[None]  # (1,3,640,640)
            # 2. 推理（seg 模型有 2 个输出：检测头 + mask proto）
            outs = self._session.run(None, {self._session.get_inputs()[0].name: blob})
            # 3. 后处理
            foods = self._postprocess(outs, (h0, w0))
            return foods or None
        except Exception as e:  # noqa: BLE001
            logger.warning("本地YOLO推理失败（降级）: %s", e)
            return None

    # ---- 后处理 ----
    def _postprocess(self, outputs, orig_shape: tuple) -> list[dict]:
        """解析 YOLOv8 输出 → 置信度过滤 → NMS → 坐标还原 → 分量估算

        - detect 模型：单输出 (1, 4+nc, 8400)
        - seg 模型：双输出 (1, 4+nc+nm, 8400) + (1, nm, 160, 160)
        """
        if isinstance(outputs, np.ndarray):
            outputs = [outputs]
        # 统一为 (anchors, 4+nc+nm) 布局：
        # 原生输出 (1, 4+nc+nm, 8400) → 特征维(37) < anchors(8400) → 转置
        # 已转置 (1, 8400, 4+nc+nm) → 保持不变
        pred = np.squeeze(outputs[0], 0)
        if pred.shape[0] < pred.shape[1]:
            pred = pred.T
        nm = pred.shape[1] - 4 - self.nc  # mask 通道数（detect 模型为 0）
        if nm < 0 or pred.shape[1] < 4 + self.nc:
            logger.warning("本地YOLO输出形状异常: %s", pred.shape)
            return []
        # xywh → xyxy（模型空间）
        boxes_xyxy = xywh2xyxy(pred[:, :4].astype(np.float32))
        scores = pred[:, 4:4 + self.nc]
        cls_ids = scores.argmax(axis=1)
        confs = scores.max(axis=1)
        # 置信度过滤
        keep = confs >= CONF_THRES
        if not keep.any():
            return []
        boxes_xyxy, confs, cls_ids = boxes_xyxy[keep], confs[keep], cls_ids[keep]
        # NMS（复用 cv_math：分数降序贪心）
        keep_idx = box_non_max_suppression(boxes_xyxy, confs, iou_threshold=IOU_THRES)
        # 坐标还原到原图
        boxes = scale_boxes((INPUT_SIZE, INPUT_SIZE), boxes_xyxy[keep_idx], orig_shape)
        confs = confs[keep_idx]
        cls_ids = cls_ids[keep_idx]

        # 分割模型：用 mask 面积估算分量（比框面积更准，避开背景/其他菜干扰）
        mask_ratio = None
        if nm > 0 and len(outputs) >= 2:
            coeffs = pred[keep][keep_idx][:, 4 + self.nc:4 + self.nc + nm]
            # 传入 640 空间 box（用于 mask ROI 裁剪，借鉴 TensorRT-Alpha 的按框计算）
            mask_ratio = self._process_masks(coeffs, outputs[1],
                                             boxes_xyxy[keep_idx])
        area_ratio = mask_ratio if mask_ratio is not None else np.clip(
            (boxes[:, 2] - boxes[:, 0]) * (boxes[:, 3] - boxes[:, 1])
            / (orig_shape[0] * orig_shape[1]), 0.02, 0.8)

        names = self._meta_names or self.names
        result = []
        for i in range(min(len(boxes), MAX_DET)):
            cid = int(cls_ids[i])
            name = names[cid] if cid < len(names) else "food"
            # 分量粗估：面积占比 × 一餐 500g，夹在 30-400g
            weight_g = int(round(float(area_ratio[i]) * 500))
            weight_g = max(30, min(400, weight_g))
            item = {
                "name": name,
                "confidence": round(float(confs[i]), 3),
                "weight_g": weight_g,
                "box": [int(v) for v in boxes[i][:4]],
            }
            if mask_ratio is not None:
                item["mask_area_ratio"] = round(float(mask_ratio[i]), 4)
            result.append(item)
        return result

    @staticmethod
    def _process_masks(coeffs: np.ndarray, proto, boxes_640: np.ndarray) -> np.ndarray:
        """mask 系数×proto → sigmoid → 阈值 → 面积占比；只算每个框 ROI 内的 mask（框外恒 0，全图纯浪费）。

        Returns: (N,) 各实例 mask 面积占比 [0,1]（相对全图）
        """
        p = np.squeeze(proto, 0)  # (nm, Hm, Wm) 或 (Hm, Wm, nm)
        if p.shape[0] != coeffs.shape[1]:
            p = np.transpose(p, (2, 0, 1))
        nm, hm, wm = p.shape
        scale = wm / INPUT_SIZE  # 160 / 640 = 0.25（mask 空间 ↔ 输入空间）
        total = hm * wm
        ratios = []
        for i, box in enumerate(boxes_640):
            # box 由 xywh2xyxy 得出（640 空间）→ 裁剪到 mask 空间
            rx1 = int(max(0.0, box[0] * scale))
            ry1 = int(max(0.0, box[1] * scale))
            rx2 = int(min(wm, box[2] * scale))
            ry2 = int(min(hm, box[3] * scale))
            if rx2 <= rx1 or ry2 <= ry1:
                ratios.append(0.0)
                continue
            roi_flat = p[:, ry1:ry2, rx1:rx2].reshape(nm, -1)  # (nm, roi_area)
            logits = coeffs[i].astype(np.float32) @ roi_flat    # (roi_area,)
            mask_roi = (1.0 / (1.0 + np.exp(-logits)) > 0.5).astype(np.float32)
            # 面积占比相对全图（ROI 外为 0，数学等价于全图计算）
            ratios.append(float(mask_roi.sum()) / total)
        return np.array(ratios, dtype=np.float32)

    @property
    def nc(self) -> int:
        """类别数（元数据优先，否则默认 1）"""
        if self._meta_names:
            return len(self._meta_names)
        return len(self.names)


# 全局单例（惰性加载，不阻塞启动）
_detector: YOLODetector | None = None


def get_detector() -> YOLODetector:
    global _detector
    if _detector is None:
        _detector = YOLODetector()
    return _detector
