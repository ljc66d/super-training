# -*- coding: utf-8 -*-
"""纯 NumPy 计算机视觉数学工具（从 Roboflow supervision 提炼，零外部依赖）。

为未来接入真实目标检测模型（如 YOLO 食物检测 / 姿态检测）铺路：
- box_iou_batch          两组边界框的 IoU 矩阵
- box_non_max_suppression 非极大值抑制（去重叠框）
- polygon_center          多边形质心（带符号面积加权，shoelace 公式）

坐标约定：xyxy = [x1, y1, x2, y2]（图像坐标，x 向右、y 向下）。
"""
from __future__ import annotations

import numpy as np
import numpy.typing as npt


def box_iou_batch(
    boxes_a: npt.NDArray[np.floating] | list,
    boxes_b: npt.NDArray[np.floating] | list,
) -> npt.NDArray[np.floating]:
    """计算两组边界框两两之间的 IoU（交并比）矩阵。

    Args:
        boxes_a: (N, 4) 数组，行格式 [x1, y1, x2, y2]
        boxes_b: (M, 4) 数组，行格式 [x1, y1, x2, y2]

    Returns:
        (N, M) 矩阵，元素 [i, j] = boxes_a[i] 与 boxes_b[j] 的 IoU。

    Examples:
        >>> import numpy as np
        >>> a = np.array([[0, 0, 10, 10]])
        >>> b = np.array([[0, 0, 10, 10], [5, 5, 15, 15]])
        >>> box_iou_batch(a, b)
        array([[1.        , 0.14285714]])
    """
    a = np.asarray(boxes_a, dtype=np.float32)
    b = np.asarray(boxes_b, dtype=np.float32)
    if a.ndim != 2 or a.shape[1] != 4:
        raise ValueError(f"boxes_a 应为 (N, 4)，实际 {a.shape}")
    if b.ndim != 2 or b.shape[1] != 4:
        raise ValueError(f"boxes_b 应为 (M, 4)，实际 {b.shape}")
    if len(a) == 0 or len(b) == 0:
        return np.empty((len(a), len(b)), dtype=np.float32)

    # 交集：右下角取小、左上角取大
    inter_x1 = np.maximum(a[:, None, 0], b[None, :, 0])
    inter_y1 = np.maximum(a[:, None, 1], b[None, :, 1])
    inter_x2 = np.minimum(a[:, None, 2], b[None, :, 2])
    inter_y2 = np.minimum(a[:, None, 3], b[None, :, 3])
    inter_w = np.maximum(0.0, inter_x2 - inter_x1)
    inter_h = np.maximum(0.0, inter_y2 - inter_y1)
    inter = inter_w * inter_h

    area_a = (a[:, 2] - a[:, 0]) * (a[:, 3] - a[:, 1])
    area_b = (b[:, 2] - b[:, 0]) * (b[:, 3] - b[:, 1])
    union = area_a[:, None] + area_b[None, :] - inter

    # 防御：空框（面积为 0）的 IoU 定义为 0，避免除零
    with np.errstate(divide="ignore", invalid="ignore"):
        iou = np.where(union > 0, inter / np.maximum(union, 1e-12), 0.0)
    return iou.astype(np.float32)


def box_non_max_suppression(
    boxes: npt.NDArray[np.floating] | list,
    scores: npt.NDArray[np.floating] | list,
    iou_threshold: float = 0.5,
) -> list[int]:
    """经典非极大值抑制（NMS）：按分数降序贪心选框，抑制高重叠框。

    Args:
        boxes: (N, 4) 数组，行格式 [x1, y1, x2, y2]
        scores: (N,) 置信度分数
        iou_threshold: IoU 超过该值的框视为重复并被抑制（默认 0.5）

    Returns:
        保留框的下标列表（按分数从高到低）。

    Examples:
        >>> import numpy as np
        >>> boxes = np.array([[0, 0, 10, 10], [0.5, 0.5, 10.5, 10.5], [20, 20, 30, 30]])
        >>> scores = np.array([0.9, 0.8, 0.7])
        >>> box_non_max_suppression(boxes, scores, 0.5)
        [0, 2]
    """
    boxes = np.asarray(boxes, dtype=np.float32)
    scores = np.asarray(scores, dtype=np.float32)
    if boxes.ndim != 2 or boxes.shape[1] != 4:
        raise ValueError(f"boxes 应为 (N, 4)，实际 {boxes.shape}")
    if scores.ndim != 1 or len(scores) != len(boxes):
        raise ValueError("scores 应为 (N,) 且与 boxes 行数一致")
    if len(boxes) == 0:
        return []

    # 按分数降序
    order = np.argsort(-scores)
    keep: list[int] = []
    while order.size > 0:
        i = int(order[0])
        keep.append(i)
        if order.size == 1:
            break
        rest = order[1:]
        ious = box_iou_batch(boxes[i : i + 1], boxes[rest]).ravel()
        # 保留与当前框 IoU <= 阈值的其余框
        order = rest[ious <= iou_threshold]
    return keep


def polygon_center(
    polygon: npt.NDArray[np.floating] | list,
) -> tuple[float, float]:
    """计算多边形质心（实心图形中心，非顶点平均）。

    使用带符号面积加权的 shoelace 公式：每个边与原点构成的三角形
    质心按有向面积加权平均。多边形面积为零（退化/自交）时
    退化为顶点坐标平均。

    Args:
        polygon: (V, 2) 顶点数组，行格式 [x, y]，顺序为多边形轮廓。

    Returns:
        (cx, cy) 质心坐标。

    Examples:
        >>> import numpy as np
        >>> poly = np.array([[0, 0], [0, 2], [2, 2], [2, 0]])
        >>> polygon_center(poly)
        (1.0, 1.0)
    """
    p = np.asarray(polygon, dtype=np.float64)
    if p.ndim != 2 or p.shape[1] != 2:
        raise ValueError(f"polygon 应为 (V, 2)，实际 {p.shape}")
    if len(p) == 0:
        raise ValueError("polygon 至少需要一个顶点")

    shift = np.roll(p, -1, axis=0)
    # 每条边有向面积（叉积的一半）
    signed_areas = (p[:, 0] * shift[:, 1] - p[:, 1] * shift[:, 0]) / 2.0
    total = float(signed_areas.sum())
    if abs(total) < 1e-12:
        center = np.mean(p, axis=0)
    else:
        centroids = (p + shift) / 3.0
        center = np.average(centroids, axis=0, weights=signed_areas)
    return (float(center[0]), float(center[1]))
