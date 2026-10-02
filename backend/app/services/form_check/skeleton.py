# -*- coding: utf-8 -*-
"""
骨骼数据处理模块 —— 动作纠错的几何基础
参考 pe_assessment 的规则引擎设计，移植并扩展：
- COCO 17 关节 / MediaPipe 33 关键点兼容
- 关节角度计算（肘/膝/髋/肩/脊柱/躯干）
- 坐标归一化（髋中心 + 肩宽缩放 + 旋转）
"""
import math
from typing import Dict, List, Optional

# COCO 17 关节索引（与 pe_assessment 一致）
JOINT_NAMES = [
    'nose', 'left_eye', 'right_eye', 'left_ear', 'right_ear',
    'left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow',
    'left_wrist', 'right_wrist', 'left_hip', 'right_hip',
    'left_knee', 'right_knee', 'left_ankle', 'right_ankle'
]
JOINT_IDX = {name: i for i, name in enumerate(JOINT_NAMES)}

# 角度计算定义 (joint1, center, joint2)
ANGLE_JOINTS = {
    'left_elbow': (5, 7, 9),
    'right_elbow': (6, 8, 10),
    'left_knee': (11, 13, 15),
    'right_knee': (12, 14, 16),
    'left_hip': (5, 11, 13),
    'right_hip': (6, 12, 14),
    'left_shoulder': (7, 5, 11),
    'right_shoulder': (8, 6, 12),
    'spine': (5, 11, 15),      # 躯干直线度（肩-髋-踝）
    'torso': (13, 11, 5),      # 躯干倾斜（膝-髋-肩）
}


class SkeletonAnalyzer:
    """骨骼几何分析器：计算关节角度与归一化坐标"""

    def __init__(self):
        pass

    @staticmethod
    def compute_angle(p1: List[float], p2: List[float], p3: List[float]) -> float:
        """计算三点角度（度），p2为顶点"""
        try:
            v1 = (p1[0] - p2[0], p1[1] - p2[1])
            v2 = (p3[0] - p2[0], p3[1] - p2[1])
            norm1 = math.hypot(*v1)
            norm2 = math.hypot(*v2)
            if norm1 == 0 or norm2 == 0:
                return 0.0
            cos_angle = (v1[0] * v2[0] + v1[1] * v2[1]) / (norm1 * norm2)
            cos_angle = max(-1.0, min(1.0, cos_angle))
            return math.degrees(math.acos(cos_angle))
        except (TypeError, IndexError):
            return 0.0

    @staticmethod
    def compute_angles(frame: List[List[float]]) -> Dict[str, float]:
        """计算单帧所有关节角度 + 空间特征（借鉴 fit-guard 的角度+空间组合判别）"""
        angles = {}
        for name, (i, j, k) in ANGLE_JOINTS.items():
            if i < len(frame) and j < len(frame) and k < len(frame):
                angles[name] = SkeletonAnalyzer.compute_angle(frame[i], frame[j], frame[k])

        # ---- 空间位置特征（区分易混动作：深蹲 vs 仰卧起坐 vs 平板） ----
        def pt(idx):
            if idx < len(frame) and len(frame[idx]) >= 2:
                return frame[idx]
            return None

        ls, rs = pt(5), pt(6)
        lh, rh = pt(11), pt(12)
        lk, rk = pt(13), pt(14)
        la, ra = pt(15), pt(16)

        def mid(a, b):
            return None if (a is None or b is None) else [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]

        shoulder_mid = mid(ls, rs)
        hip_mid = mid(lh, rh)
        ankle_mid = mid(la, ra)

        if hip_mid and ankle_mid:
            # 屏幕坐标系 y 向下：站立时髋在踝上方 → 髋踝Y差为负
            angles['hip_ankle_y_diff'] = hip_mid[1] - ankle_mid[1]
        if shoulder_mid and hip_mid:
            # 肩髋Y差：正值=肩低于髋（仰卧起坐起身/前倾）
            angles['shoulder_hip_y_diff'] = shoulder_mid[1] - hip_mid[1]
            # 躯干相对垂直角（atan2 法）：0°=直立，90°=水平（卧推/俯卧撑/平板）
            dx = shoulder_mid[0] - hip_mid[0]
            dy = -(shoulder_mid[1] - hip_mid[1])
            angles['trunk_vertical_deg'] = math.degrees(math.atan2(abs(dx), max(dy, 1e-6)))
            # 肩髋距离（归一化参考：躯干长度）
            angles['torso_len'] = math.hypot(dx, dy)
        # 髋宽（用于视角判断：正/侧/后）
        if lh and rh:
            angles['hip_width'] = abs(lh[0] - rh[0])
        if ls and rs:
            angles['shoulder_width'] = abs(ls[0] - rs[0])
        # 膝盖内扣（正面视角：膝间距 vs 踝间距）
        if lk and rk and la and ra:
            knee_w = abs(lk[0] - rk[0])
            ankle_w = abs(la[0] - ra[0])
            if ankle_w > 1e-6:
                angles['knee_ankle_ratio'] = knee_w / ankle_w

        return angles

    @staticmethod
    def normalize(keypoints_sequence: List[List[List[float]]]) -> List[List[List[float]]]:
        """坐标归一化：髋中心原点 + 肩宽缩放"""
        if not keypoints_sequence:
            return keypoints_sequence
        norm = []
        for frame in keypoints_sequence:
            left_hip = frame[JOINT_IDX['left_hip']]
            right_hip = frame[JOINT_IDX['right_hip']]
            hip_center = [(left_hip[0] + right_hip[0]) / 2, (left_hip[1] + right_hip[1]) / 2]
            left_shoulder = frame[JOINT_IDX['left_shoulder']]
            right_shoulder = frame[JOINT_IDX['right_shoulder']]
            shoulder_width = math.hypot(
                left_shoulder[0] - right_shoulder[0],
                left_shoulder[1] - right_shoulder[1],
            ) + 1e-6
            new_frame = []
            for kp in frame:
                new_frame.append([
                    (kp[0] - hip_center[0]) / shoulder_width,
                    (kp[1] - hip_center[1]) / shoulder_width,
                ])
            norm.append(new_frame)
        return norm

    @staticmethod
    def from_mediapipe(mp_landmarks) -> List[List[float]]:
        """将 MediaPipe 33 关键点映射为 COCO 17 格式"""
        mapping = {
            0: 0,      # nose
            2: 1,      # left_eye
            5: 2,      # right_eye
            7: 3,      # left_ear
            8: 4,      # right_ear
            11: 5,     # left_shoulder
            12: 6,     # right_shoulder
            13: 7,     # left_elbow
            14: 8,     # right_elbow
            15: 9,     # left_wrist
            16: 10,    # right_wrist
            23: 11,    # left_hip
            24: 12,    # right_hip
            25: 13,    # left_knee
            26: 14,    # right_knee
            27: 15,    # left_ankle
            28: 16,    # right_ankle
        }
        coco = [[0.0, 0.0, 0.0]] * 17
        for mp_idx, coco_idx in mapping.items():
            if mp_idx < len(mp_landmarks):
                lm = mp_landmarks[mp_idx]
                vis = getattr(lm, 'visibility', 1.0)
                coco[coco_idx] = [lm.x, lm.y, vis]
        return coco
