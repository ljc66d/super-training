# -*- coding: utf-8 -*-
"""RPE 标度归一化（力量 CR-10 与 有氧 Borg 6-20 统一到同一尺度）

小程序按训练类型使用两套主观强度量表：

- **力量训练**：**每组**打一次，用 CR-10（0~10，可 0.5 档），写入
  `detail_json.exercises[].rpe`
- **有氧 / CrossFit / Hyrox**：**整节**打一次，用 Borg 6~20，写入
  `detail_json.rpe`

两套量表数值区间不同（0~10 vs 6~20），直接混合平均会造成**训练类型之间的系统性偏差**：
有氧数值天生更大、力量天生更小，疲劳分与趋势图都不可比。

统一按 **Borg ÷ 2** 折算到 CR-10 标度（Borg 6-20 与 CR-10 的常用粗略换算即
Borg ≈ CR10 × 2，各强度等级一一对应）：

| 主观感受   | Borg 6-20 | CR-10 | Borg ÷ 2 |
|-----------|-----------|-------|----------|
| 非常轻松   | 7         | 1     | 3.5      |
| 较轻松     | 9         | 4     | 4.5      |
| 有点吃力   | 11        | 5     | 5.5      |
| 吃力       | 13        | 6.5   | 6.5      |
| 很吃力     | 15        | 7.5   | 7.5      |
| 接近力竭   | 19        | 9.5   | 9.5      |

## 判定方式：**先看训练类型，再看数值**

两套量表在 **6~10 区间重叠**（Borg 的「很轻松」和 CR-10 的「偏高」数值相同），
只靠数值无法区分，容易把低强度有氧误判成高强度力量。因此优先按训练类型判定：

| category         | 训练类型                | 量表     |
|------------------|-------------------------|----------|
| `力量健美`       | 力量训练                | CR-10    |
| `功能训练`       | CrossFit / Hyrox        | Borg 6-20 |
| `田径耐力`       | 跑步 / 骑行 / 游泳 / 徒步 | Borg 6-20 |
| 其它 / 缺失 / `自定义` | 未知               | 数值兜底（> 10 视为 Borg） |
"""
from typing import List, Optional

#: CR-10 量表上限，同时作为未知类型时的 Borg 判定阈值
CR10_MAX = 10.0
#: Borg 6-20 折算系数（Borg ÷ 2 ≈ CR-10）
BORG_SCALE = 2.0
#: 使用 CR-10 量表（每组打分）的训练分类
STRENGTH_CATEGORIES = {"力量健美"}


def normalize_rpe(value, category: Optional[str] = None, digits: int = 2) -> Optional[float]:
    """RPE 归一到 CR-10：力量类原样，其余按 Borg÷2（未知类型数值>10 视为 Borg）；空值/越界返回 None。"""
    if value is None:
        return None
    try:
        v = float(value)
    except (TypeError, ValueError):
        return None
    if v < 0 or v > 20:  # 超出任何量表的合理范围，视为脏数据
        return None

    if category:
        is_borg = category not in STRENGTH_CATEGORIES
    else:
        is_borg = v > CR10_MAX  # 未知类型：CR-10 上限是 10，超过必是 Borg
    if v > CR10_MAX:
        # 硬约束：CR-10 不可能超过 10，出现即为误填的 Borg 值，一律按 Borg 折算
        is_borg = True
    return round(v / BORG_SCALE, digits) if is_borg else round(v, digits)


def session_rpe_values(detail: dict, category: Optional[str] = None) -> List[float]:
    """提取 detail_json 中的 RPE（exercises[].rpe 每组 + 整节 rpe 两种写入位置），已归一到 CR-10。

    样本粒度不同：调用方应先取单场均值、再跨场平均，别把两组样本混着平均。
    """
    if not isinstance(detail, dict):
        return []
    vals: List[float] = []
    for ex in (detail.get("exercises") or []):
        if isinstance(ex, dict):
            v = normalize_rpe(ex.get("rpe"), category)
            if v is not None:
                vals.append(v)
    overall = normalize_rpe(detail.get("rpe"), category)
    if overall is not None:
        vals.append(overall)
    return vals


def session_rpe_avg(detail: dict, category: Optional[str] = None,
                    digits: int = 1) -> Optional[float]:
    """单场训练的等效 RPE 均值（已归一化到 CR-10）。无有效记录返回 None。"""
    vals = session_rpe_values(detail, category)
    if not vals:
        return None
    return round(sum(vals) / len(vals), digits)
