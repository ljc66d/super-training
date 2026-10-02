# -*- coding: utf-8 -*-
"""本地食物分类器（ONNX Runtime，纯 CPU 无 GPU 依赖）

用于：① 单食物特写识别（用户拍菜特写 → 直接出菜名）
      ② stage2 细分类（YOLO 检测框 crop 后精化相似食物）

模型：YOLOv8s-cls 导出的 ONNX（ultralytics `yolo classify export format=onnx`），
      放入 backend/models/food_cls.onnx；类别名映射 backend/models/food_labels.json
      （由 food_train/02_convert_dataset.py 生成）。

调用：
    clf = FoodClassifier()                  # 惰性加载（首次 classify 才初始化）
    top = clf.classify(image_bytes)         # [{"class_id","name","confidence"}] top5 或 None
"""
import json
import logging
import os

import numpy as np

logger = logging.getLogger(__name__)

# app/services/ai/classifier.py → 上溯 4 层到 backend/
_MODELS_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(
        os.path.abspath(__file__))))), "models")
DEFAULT_MODEL = os.path.join(_MODELS_DIR, "food_cls.onnx")
DEFAULT_LABELS = os.path.join(_MODELS_DIR, "food_labels.json")

INPUT_SIZE = 224   # 分类输入尺寸
TOP_K = 5          # 返回 top5

try:
    import cv2  # noqa: F401
except ImportError:  # pragma: no cover
    cv2 = None  # type: ignore[assignment]


class FoodClassifier:
    """本地食物分类器（惰性加载，模型缺失/失败返回 None 不抛错）"""

    def __init__(self, model_path: str | None = None, labels_path: str | None = None):
        self.model_path = model_path or DEFAULT_MODEL
        self.labels_path = labels_path or DEFAULT_LABELS
        self._session = None
        self._labels: list[str] = []

    def _ensure_session(self) -> bool:
        if self._session is not None:
            return True
        if not os.path.exists(self.model_path):
            logger.info("本地分类模型不存在（%s），跳过本地分类", self.model_path)
            return False
        try:
            import onnxruntime as ort
            self._session = ort.InferenceSession(
                self.model_path, providers=["CPUExecutionProvider"])
            # 加载类别名映射（002_convert_dataset.py 生成）
            try:
                with open(self.labels_path, encoding="utf-8") as f:
                    raw = json.load(f)
                keys = sorted(raw.keys(), key=lambda k: int(k))
                self._labels = [str(raw[k]) for k in keys]
            except (OSError, ValueError, KeyError):
                self._labels = [f"food_{i}" for i in range(self.nc)]
            logger.info("本地分类模型加载成功（%s，%d 类）",
                        self.model_path, self.nc)
            return True
        except Exception as e:  # noqa: BLE001
            logger.warning("本地分类模型加载失败（降级）: %s", e)
            self._session = None
            return False

    @property
    def nc(self) -> int:
        if self._session is not None:
            return self._session.get_outputs()[0].shape[1]
        return 0

    def classify(self, image_bytes: bytes, image_name: str = "") -> list[dict] | None:
        """返回按置信度降序的 top5；模型未配置/加载失败返回 None。"""
        if not image_bytes or not self._ensure_session():
            return None
        if cv2 is None:
            logger.warning("缺少 opencv（pip install opencv-python-headless），本地分类不可用")
            return None
        try:
            img = cv2.imdecode(np.frombuffer(image_bytes, np.uint8), cv2.IMREAD_COLOR)
            if img is None:
                return None
            # 预处理（与 ultralytics classify_transforms 一致）：
            #   Resize(最短边->INPUT_SIZE) -> CenterCrop(INPUT_SIZE) -> BGR2RGB -> /255 -> NCHW
            h, w = img.shape[:2]
            scale = INPUT_SIZE / min(h, w)
            new_w = max(INPUT_SIZE, round(w * scale))
            new_h = max(INPUT_SIZE, round(h * scale))
            resized = cv2.resize(img, (new_w, new_h),
                                 interpolation=cv2.INTER_LINEAR)
            ch, cw = resized.shape[:2]
            y0 = (ch - INPUT_SIZE) // 2
            x0 = (cw - INPUT_SIZE) // 2
            crop = resized[y0:y0 + INPUT_SIZE, x0:x0 + INPUT_SIZE]
            blob = cv2.cvtColor(crop, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
            blob = np.transpose(blob, (2, 0, 1))[None]  # (1,3,224,224)
            # 推理（ONNX 输出已是 softmax 概率，无需再 softmax）
            out = self._session.run(
                None, {self._session.get_inputs()[0].name: blob})[0]  # (1, nc)
            probs = out[0]
            # top5
            idx = np.argsort(-probs)[:TOP_K]
            result = []
            for cid in idx:
                name = self._labels[cid] if cid < len(self._labels) else f"food_{cid}"
                result.append({
                    "class_id": int(cid),
                    "name": name,
                    "confidence": round(float(probs[cid]), 4),
                })
            return result
        except Exception as e:  # noqa: BLE001
            logger.warning("本地分类推理失败（降级）: %s", e)
            return None


# 全局单例
_classifier: FoodClassifier | None = None


def get_classifier() -> FoodClassifier:
    global _classifier
    if _classifier is None:
        _classifier = FoodClassifier()
    return _classifier
