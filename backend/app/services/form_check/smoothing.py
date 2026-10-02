# -*- coding: utf-8 -*-
"""关键点序列平滑器 —— 借鉴 physical_fitness 的 PoseSmoother（One-Euro 简化思想）

- 自适应 EMA：位移小→强锁定(α=0.85)抗抖动；位移大→快速跟随(α=0.2)保响应
- 置信度低/遮挡：冻结位置（hold 时长内保持），防止关键点突变
- 输入帧格式 [x, y] 或 [x, y, score]；score 缺失时视为可见
"""
from typing import List, Optional


class PoseSmoother:
    def __init__(self, alpha: float = 0.5, min_score: float = 0.15,
                 hold_frames: int = 20):
        """
        alpha: 基准 EMA 系数（0-1，越大越平滑）
        min_score: 低于此置信度视为遮挡（无 score 时忽略）
        hold_frames: 遮挡后冻结的最大帧数
        """
        self.alpha = alpha
        self.min_score = min_score
        self.hold_frames = hold_frames
        self._state: List[Optional[dict]] = None  # 每关键点 {x, y, score, last_seen}

    def reset(self):
        self._state = None

    def smooth_frame(self, frame: List[list], frame_idx: int = 0) -> List[list]:
        """平滑单帧关键点，返回与输入同形状。"""
        n = len(frame)
        if self._state is None or len(self._state) != n:
            # 首帧初始化
            self._state = []
            for kp in frame:
                self._state.append({
                    'x': float(kp[0]), 'y': float(kp[1]),
                    'score': float(kp[2]) if len(kp) > 2 else 1.0,
                    'last_seen': frame_idx,
                })
            return [list(kp) for kp in frame]

        out = []
        for i, kp in enumerate(frame):
            st = self._state[i]
            score = float(kp[2]) if len(kp) > 2 else 1.0
            x, y = float(kp[0]), float(kp[1])

            if score >= self.min_score:
                # 可见：自适应 alpha（阈值基于归一化坐标的典型帧间位移）
                dx, dy = x - st['x'], y - st['y']
                dist = (dx * dx + dy * dy) ** 0.5
                if dist < 0.004:
                    a = 0.85   # 几乎不动（传感器噪声级），死死锁住
                elif dist > 0.03:
                    a = 0.25   # 明显运动，快速跟随
                else:
                    a = 0.85 - (dist - 0.004) / 0.026 * 0.60
                sx = st['x'] + dx * (1 - a)
                sy = st['y'] + dy * (1 - a)
                sscore = st['score'] + (score - st['score']) * 0.5
                self._state[i] = {
                    'x': sx, 'y': sy, 'score': sscore, 'last_seen': frame_idx,
                }
            else:
                # 遮挡：冻结位置（hold 帧内），超时则原样透传
                if frame_idx - st['last_seen'] < self.hold_frames:
                    decay = 1.0 - (frame_idx - st['last_seen']) / self.hold_frames
                    sscore = max(st['score'] * decay, 0.05)
                    sx, sy = st['x'], st['y']
                    self._state[i] = {**st, 'score': sscore}
                else:
                    sx, sy, sscore = x, y, score
                    self._state[i] = {
                        'x': x, 'y': y, 'score': score, 'last_seen': frame_idx,
                    }

            out.append([sx, sy] + ([sscore] if len(kp) > 2 else []))

        return out

    def smooth_sequence(self, keypoints_sequence: List[List[list]]) -> List[List[list]]:
        """平滑整个关键点序列（逐帧）。"""
        self.reset()
        result = []
        for idx, frame in enumerate(keypoints_sequence):
            result.append(self.smooth_frame(frame, idx))
        return result
