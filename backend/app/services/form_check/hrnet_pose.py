# -*- coding: utf-8 -*-
"""视频/图片 → 人体姿态关键点（HRNet-W48，PyTorch 高精度路径）

配合「先识别、再纠错」：
1. 识别（关键帧选择）：对视频采样帧跑 HRNet 算出各关节角度，
   按动作的运动学特征挑出"最能评判动作姿势"的 1~3 帧；
2. 纠错：把这 1~3 帧的高精度 COCO17 关键点交给现有 assess() 引擎。

与 pose_estimator.py（YOLOv8-Pose，快）并列，是本项目的高精度识别源：
- 权重大（w48 约 300MB）、依赖 PyTorch，用于离线/照片级高精度评估；
- 惰性加载：未装 torch 或权重缺失时返回 None，调用方自行降级（不抛错）。
- 输出与 pose_estimator 完全一致：COCO17 [x, y, conf] * 17 原图像素坐标。
"""
import logging
import os
import shutil

logger = logging.getLogger(__name__)

# ---- 可选依赖：torch / cv2（仅加载 HRNet 时才需要） ----
try:
    import torch
    import torchvision.transforms as _transforms
except Exception:  # noqa: BLE001
    torch = None
    _transforms = None

try:
    import cv2  # noqa: F401
except ImportError:  # noqa: F401
    cv2 = None

import numpy as np

from app.services.form_check.skeleton import SkeletonAnalyzer

# backend/models/ 目录（上溯 3 层：form_check -> services -> app -> ...）实际是 backend root 下的 models
_MODELS_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(
        os.path.abspath(__file__))))), "models")
DEFAULT_MODEL_W48 = os.path.join(_MODELS_DIR, "pose_hrnet_w48_384x288.pth")
DEFAULT_MODEL_W32 = os.path.join(_MODELS_DIR, "pose_hrnet_w32_256x192.pth")

MAX_SAMPLED_FRAMES = 15   # 视频最多采样并跑 HRNet 的帧数（HRNet 慢，需限流）
FRAME_STRIDE = 3          # 每 3 帧取 1 帧（避免逐帧全跑）

# 输入分辨率由权重决定：(H, W)
_WEIGHT_PARAMS = {
    DEFAULT_MODEL_W48: dict(c=48, input_hw=(384, 288)),   # (高度, 宽度)
    DEFAULT_MODEL_W32: dict(c=32, input_hw=(256, 192)),
}
_MEAN = [0.485, 0.456, 0.406]
_STD = [0.229, 0.224, 0.225]


def _is_available():
    return torch is not None and _transforms is not None and cv2 is not None


def _transcode_mp4(src: str) -> str | None:
    """用系统 ffmpeg 把视频转成 H.264 mp4（兼容 HEVC/VP9 等）。返回转码文件路径或 None。"""
    import subprocess
    import tempfile
    exe = None
    for cand in (os.environ.get("FFMPEG_BIN"), shutil.which("ffmpeg"),
                 r"C:\Windows\ffmpeg.exe", "/usr/bin/ffmpeg", "/usr/local/bin/ffmpeg"):
        if cand and os.path.exists(cand):
            exe = cand
            break
    if not exe:
        logger.info("未找到系统 ffmpeg，跳过视频转码")
        return None
    out = tempfile.NamedTemporaryFile(suffix=".mp4", delete=False)
    out.close()
    try:
        # 先试 H.264；若 ffmpeg 无 libx264 则退回 mpeg4
        for codec in ("libx264", "mpeg4"):
            cmd = [exe, "-y", "-i", src, "-c:v", codec, "-pix_fmt", "yuv420p",
                   "-an", "-loglevel", "error", out.name]
            r = subprocess.run(cmd, capture_output=True, timeout=180)
            if r.returncode == 0 and os.path.getsize(out.name) > 0:
                logger.info("视频已用 ffmpeg 转码为 H.264（%s）", codec)
                return out.name
        logger.warning("ffmpeg 转码失败: %s", (r.stderr or b"").decode(errors="ignore")[:200])
    except Exception as e:  # noqa: BLE001
        logger.warning("ffmpeg 转码异常: %s", e)
    try:
        os.unlink(out.name)
    except OSError:
        pass
    return None


class HRNetPoseEstimator:
    """HRNet 姿态估计器（惰性加载，PyTorch）"""

    def __init__(self, model_path: str | None = None):
        self.model_path = model_path or (
            DEFAULT_MODEL_W48 if os.path.exists(DEFAULT_MODEL_W48) else DEFAULT_MODEL_W32)
        params = _WEIGHT_PARAMS.get(self.model_path, _WEIGHT_PARAMS[DEFAULT_MODEL_W48])
        self.c = params["c"]
        self.input_hw = params["input_hw"]  # (H, W)
        self._model = None
        self._device = None
        self._transform = None

    # ---- 惰性加载 ----
    def is_available(self) -> bool:
        """HRNet 是否可用（torch + 权重齐全）。不触发模型加载。"""
        if not _is_available():
            return False
        return os.path.exists(self.model_path)

    def _ensure_model(self) -> bool:
        """加载 HRNet + 官方权重。失败时返回 False（不抛错）。"""
        if self._model is not None:
            return True
        if not _is_available():
            logger.info("缺少 torch/torchvision/cv2，HRNet 不可用")
            return False
        if not os.path.exists(self.model_path):
            logger.info("HRNet 权重不存在（%s），跳过高精度识别", self.model_path)
            return False
        try:
            from app.services.form_check.hrnet_model import build_hrnet
            self._device = torch.device(
                "cuda" if torch.cuda.is_available() else "cpu")
            model = build_hrnet(c=self.c, nof_joints=17)
            ckpt = torch.load(self.model_path, map_location=self._device)
            state = ckpt.get("model") if isinstance(ckpt, dict) and "model" in ckpt else ckpt
            model.load_state_dict(state)
            model = model.to(self._device).eval()
            self._model = model
            self._transform = _transforms.Compose([
                _transforms.ToTensor(),
                _transforms.Normalize(mean=_MEAN, std=_STD),
            ])
            logger.info("HRNet 加载成功（%s, %s, %s）",
                        os.path.basename(self.model_path), self.input_hw, self._device)
            return True
        except Exception as e:  # noqa: BLE001
            logger.warning("HRNet 加载失败（%s）", e)
            self._model = None
            return False

    # ---- 推理 ----
    def _infer(self, img_bgr: np.ndarray) -> list[list[float]] | None:
        """单帧高精度姿态 → COCO17 [x,y,conf]*17（原图像素坐标）

        Top-down 策略：若画面中人体框显著小于整图（用 YOLOv8-Pose 检测），
        先裁剪放大再 HRNet，人占画面小也能识别；YOLO 不可用时直接全图推理。
        """
        if not self._ensure_model():
            return None
        try:
            h, w = img_bgr.shape[:2]
            rh, rw = self.input_hw
            crop = None
            try:
                from app.services.form_check.pose_estimator import get_pose_estimator
                box = get_pose_estimator().detect_human_box(img_bgr)
                if box:
                    x1, y1, x2, y2 = box
                    bh, bw = y2 - y1, x2 - x1
                    # 人体框占画面比例较小（<70%）时裁剪放大，避免全图压缩丢失细节
                    if bh < h * 0.7 or bw < w * 0.7:
                        crop = (x1, y1, x2, y2)
            except Exception:  # noqa: BLE001
                crop = None

            src_img = img_bgr
            if crop:
                x1, y1, x2, y2 = crop
                src_img = img_bgr[y1:y2, x1:x2]

            ch, cw = src_img.shape[:2]
            img = cv2.resize(src_img, (rw, rh), interpolation=cv2.INTER_CUBIC)
            img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            tensor = self._transform(img).unsqueeze(0).to(self._device)
            with torch.no_grad():
                out = self._model(tensor)  # (1, 17, Hh, Ww)
            heat = out[0].cpu().numpy()      # (17, Hh, Ww)
            Hh, Ww = heat.shape[1], heat.shape[2]
            # 置信度取热图原始峰值（与官方 simple-HRNet 一致）：
            # 已检测关节峰值较高（判定可见），背景约为 0（判定不可见），
            # 与现有纠错引擎的 conf>=0.3 质量门槛语义一致。
            flat = heat.reshape(17, -1).astype(np.float32)
            idx = flat.argmax(axis=1)
            yidx, xidx = np.divmod(idx, Ww)
            conf = np.clip(flat.max(axis=1), 0.0, None)
            # 映射回原图像素坐标（裁剪时加回偏移）
            ox, oy = (crop[0], crop[1]) if crop else (0, 0)
            kpts = [
                [float(xidx[j]) * cw / Ww + ox, float(yidx[j]) * ch / Hh + oy, float(conf[j])]
                for j in range(17)
            ]
            return kpts
        except Exception as e:  # noqa: BLE001
            logger.warning("HRNet 推理失败: %s", e)
            return None

    # ---- 关键帧选择（先识别：挑最能评判动作姿势的帧）----
    @staticmethod
    def _frame_score(angles: dict, action: str) -> float:
        """按动作给每帧的"评判价值"打分（越极端越有代表性能评判）"""
        lk, rk = angles.get("left_knee"), angles.get("right_knee")
        le, re = angles.get("left_elbow"), angles.get("right_elbow")
        avg_knee = (lk + rk) / 2 if (lk is not None and rk is not None) else None
        avg_elbow = (le + re) / 2 if (le is not None and re is not None) else None
        tv = angles.get("trunk_vertical_deg")

        # 每帧都齐全时评分：
        # 深蹲/弓步类：膝角最小（蹲最深）最能评判
        if action in ("squat", "lunge"):
            return -avg_knee if avg_knee is not None else 0.0
        # 俯卧撑/卧推/弯举类：肘角最小（压/弯到底）最能评判
        if action in ("pushup", "bench_press", "bicep_curl"):
            return -avg_elbow if avg_elbow is not None else 0.0
        # 实力推：肘角最大（锁肘=推到顶）最能评判
        if action in ("overhead_press",):
            return avg_elbow if avg_elbow is not None else 0.0
        # 引体向上：肘角最小（屈肘拉到最高=下巴过杠）最能评判
        if action in ("pullup",):
            return -avg_elbow if avg_elbow is not None else 0.0
        # 硬拉/划船/卷腹类：躯干最水平（俯身最到位）
        if action in ("deadlift", "barbell_row", "situp"):
            return tv if tv is not None else 0.0
        return 0.0

    def _select_key_indices(self, kpts_sequence: list, action: str) -> list[int]:
        """从已采样帧中挑出覆盖动作全程的代表帧（用于纠错分析）
        策略：极值帧（最到位）+ 均匀采样帧，保证有时序上下文做规则判断。
        """
        n = len(kpts_sequence)
        if n == 0:
            return []
        if n <= 5:
            return list(range(n))
        if not action:
            # 无动作提示时均匀取 5 帧
            step = max(1, n // 5)
            return list(range(0, n, step))[:5]
        scored = []
        for i, kpts in enumerate(kpts_sequence):
            angles = SkeletonAnalyzer.compute_angles(kpts)
            scored.append((self._frame_score(angles, action), i))
        scored.sort(reverse=True, key=lambda t: t[0])
        # 取 top-3 极值帧（最到位的几个姿势）
        picked = {t[1] for t in scored[:3]}
        # 再加 2 个均匀帧覆盖起始/结束，保证有完整动作周期
        picked.add(0)
        picked.add(n - 1)
        return sorted(picked)[:6]

    # ---- 视频处理 ----
    def extract_from_video(self, video_bytes: bytes, action: str | None = None):
        """解析视频 → 关键帧序列 + 预识别动作（HRNet 高精度）

        兼容多种编码（H.264/H.265/VP8/VP9/AV1 等）：
        - 优先 opencv 直接解码
        - 打不开/解不出帧时，用系统 ffmpeg 转码为 H.264 mp4 再解码
          （手机录的 HEVC/高压缩视频 opencv 内置 ffmpeg 可能不支持）

        Returns:
            (keypoints_list, identified_action) 元组；
            identified_action 是用全量采样帧识别出的动作（str or None），
            调用方可直接使用，避免二次识别误判。
            失败返回 None。
        """
        if cv2 is None or not video_bytes or not self._ensure_model():
            return None
        import subprocess
        import tempfile
        tmp = tempfile.NamedTemporaryFile(suffix=".mp4", delete=False)
        try:
            tmp.write(video_bytes)
            tmp.close()
            frames_out = self._read_video_frames(tmp.name)
            if not frames_out:
                # 兜底：opencv 打不开（如 HEVC 编码）→ 用系统 ffmpeg 转 H.264 再读
                trans = _transcode_mp4(tmp.name)
                if trans:
                    frames_out = self._read_video_frames(trans)
                    try:
                        os.unlink(trans)
                    except OSError:
                        pass
            if not frames_out:
                return None
            # 未指定动作时：先用【全部采样帧】做一次动作识别（聚合几何特征），
            # 这一步用全量帧是最准确的；结果随返回值带出，上层无需二次识别。
            identified = action
            if not identified:
                try:
                    from app.services.form_check.engine import identify_action
                    identified = identify_action(frames_out)
                    logger.info("HRNet 预识别动作: %s（共 %d 帧）", identified, len(frames_out))
                except Exception as e:  # noqa: BLE001
                    logger.warning("HRNet 预识别失败: %s", e)
                    identified = None
            # 选关键帧用于纠错（保留足够多帧覆盖动作全程）
            idxs = self._select_key_indices(frames_out, identified or action)
            key_frames = [frames_out[i] for i in idxs]
            return key_frames, identified
        except Exception as e:  # noqa: BLE001
            logger.warning("HRNet 视频解析失败: %s", e)
            return None
        finally:
            try:
                os.unlink(tmp.name)
            except OSError:
                pass

    def _read_video_frames(self, path: str) -> list | None:
        """opencv 抽帧 + HRNet 推理，返回关键帧列表"""
        cap = cv2.VideoCapture(path)
        if not cap.isOpened():
            return None
        sampled = []
        idx = 0
        try:
            while len(sampled) < MAX_SAMPLED_FRAMES:
                ok, frame = cap.read()
                if not ok:
                    break
                if idx % FRAME_STRIDE == 0:
                    kpts = self._infer(frame)
                    if kpts:
                        sampled.append(kpts)
                idx += 1
        finally:
            cap.release()
        return sampled or None

    # ---- 图片处理 ----
    def extract_from_image(self, image_bytes: bytes) -> list[list[list[float]]] | None:
        """解析图片 → 关键点（单帧包装为序列）"""
        if cv2 is None or not image_bytes or not self._ensure_model():
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
            logger.warning("HRNet 图片解析失败: %s", e)
            return None


# 全局单例
_estimator: HRNetPoseEstimator | None = None


def get_hrnet_estimator() -> HRNetPoseEstimator:
    global _estimator
    if _estimator is None:
        _estimator = HRNetPoseEstimator()
    return _estimator