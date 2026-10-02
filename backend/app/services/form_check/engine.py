# -*- coding: utf-8 -*-
"""
动作纠错引擎 —— 主编排逻辑
输入：关键点序列（COCO 17 或 MediaPipe 33）→ 分析帧 → 规则分析 → 报告
"""
import json
import logging
import math

from app.services.form_check.skeleton import SkeletonAnalyzer, JOINT_IDX
from app.services.form_check.smoothing import PoseSmoother
from app.services.form_check import rules, scoring
from app.services.ai.llm import chat_json
from app.services.ai.prompts import FORM_CHECK_SYSTEM
from app.services.ai.provider import run_capability, json_of, CAP_FORM_CHECK

logger = logging.getLogger(__name__)


def _check_keypoint_quality(coco_frames):
    """关键点质量过滤（借鉴 fit-guard）：可见点≥8、平均置信度≥0.3、展开度≥0.05；合格返回 None。"""
    if not coco_frames:
        return {"error": "关键点序列为空", "score": 0,
                "corrections": [{"text": "请确保全身在摄像头范围内", "type": "warning"}]}
    # 取中位数帧评估（序列中部更能代表动作）
    mid = coco_frames[len(coco_frames) // 2]

    def score_of(kp):
        return kp[2] if len(kp) > 2 and kp[2] is not None else 1.0

    visible = [kp for kp in mid if score_of(kp) >= 0.3 and abs(kp[0]) + abs(kp[1]) > 1e-6]
    if len(visible) < 8:
        return {"error": "关键点质量不足", "score": 0,
                "corrections": [{"text": "请让全身清晰进入摄像头范围（至少8个关键点）", "type": "warning"}]}
    avg_conf = sum(score_of(kp) for kp in visible) / len(visible)
    if avg_conf < 0.3:
        return {"error": "关键点置信度不足", "score": 0,
                "corrections": [{"text": "光线或距离不足，请调整站位", "type": "warning"}]}
    xs = [kp[0] for kp in visible]
    ys = [kp[1] for kp in visible]
    spread = max(max(xs) - min(xs), max(ys) - min(ys))
    if spread < 0.05:
        return {"error": "身体未充分展开", "score": 0,
                "corrections": [{"text": "请调整距离，让全身可见", "type": "warning"}]}
    return None


def _prepare_frames(keypoints_sequence, format_type: str) -> tuple:
    """关键点序列转分析帧：统一 COCO17 → 质量过滤 → 平滑 → 归一化。

    返回 (frames, normalized, quality)；quality 非 None 表示质量不合格，应直接返回。
    """
    if not keypoints_sequence or len(keypoints_sequence) == 0:
        return [], None, {"error": "关键点序列为空", "score": 0}

    # 统一为 COCO 17
    coco_frames = []
    for frame in keypoints_sequence:
        if format_type in ("mediapipe33", "mediapipe"):
            coco_frames.append(SkeletonAnalyzer.from_mediapipe(frame))
        else:
            # 已是 COCO 17（兼容 [x,y] 或 [x,y,score]）
            coco_frames.append(frame)

    # 关键点质量过滤
    quality = _check_keypoint_quality(coco_frames)
    if quality is not None:
        return [], None, quality

    # 自适应 EMA 平滑（借鉴 physical_fitness：One-Euro 简化 + 遮挡冻结）
    coco_frames = PoseSmoother(alpha=0.5, min_score=0.15, hold_frames=15) \
        .smooth_sequence(coco_frames)

    # 归一化（用于位移类指标）
    try:
        normalized = SkeletonAnalyzer.normalize(coco_frames)
    except Exception:  # noqa: BLE001
        normalized = None

    # 构建分析帧
    frames = []
    for frame in coco_frames:
        angles = SkeletonAnalyzer.compute_angles(frame)
        frames.append({"keypoints": frame, "angles": angles})

    return frames, normalized, None


def _local_assess(keypoints_sequence, action, format_type) -> dict:
    """内置规则动作评估实现（本地，不依赖LLM/外部AI）"""
    frames, normalized, quality = _prepare_frames(keypoints_sequence, format_type)
    if quality is not None:
        return quality
    if not frames:
        return {"error": "关键点序列为空", "score": 0}

    # 自动识别动作（若未指定）
    if not action:
        action = identify_action(frames, normalized)

    # 规则分析
    metrics = rules.analyze_action(action, frames, normalized)
    if "error" in metrics and not metrics.get("errors"):
        return metrics

    # 生成报告
    report = scoring.build_report(action, metrics)
    # LLM 增强：规则结果 + 大模型生成更自然的纠正建议（未配置时保持规则建议）
    return _llm_enhance(report)


def _llm_enhance(report: dict) -> dict:
    """在规则引擎结果基础上，用 LLM 生成个性化纠正建议。

    规则引擎负责确定性的角度/关节分析，LLM 负责把错误翻译成
    更自然、更懂用户的中文训练建议；LLM 未配置或失败时，
    保留规则引擎自带的建议文案（原有兜底，永远可用）。
    """
    if not report or report.get("error"):
        return report
    errors = report.get("errors") or []
    if not errors:
        return report
    payload = {
        "action": report.get("action", ""),
        "score": report.get("score"),
        "errors": errors,
    }
    try:
        result = chat_json(FORM_CHECK_SYSTEM,
                           json.dumps(payload, ensure_ascii=False, default=str))
    except Exception:  # noqa: BLE001
        result = {}
    suggestions = result.get("suggestions") if isinstance(result, dict) else None
    if isinstance(suggestions, list) and suggestions:
        report["suggestions"] = suggestions
        report["ai_enhanced"] = True
    return report


def assess(keypoints_sequence, action: str | None = None,
           format_type: str = "coco17") -> dict:
    """
    评估动作质量与纠错。

    支持外部AI接口（预留）：当配置 AI_CAPABILITY_FORM_CHECK=external 时，
    将关键点序列发送到外部AI服务，失败自动降级本地规则。
    """
    report = json_of(run_capability(
        CAP_FORM_CHECK,
        local_fn=lambda: _local_assess(keypoints_sequence, action, format_type),
        external_payload={
            "capability": "form_check",
            "action": action,
            "format_type": format_type,
            "keypoints": keypoints_sequence,
        },
    ))
    if not report:
        return {"error": "动作评估失败", "score": 0}
    return report


def identify_action(frames, normalized=None) -> str:
    """识别动作类别（俯卧撑/深蹲/卧推/硬拉/实力推/引体），判据见下方决策树各分支。"""
    from app.services.form_check.skeleton import SkeletonAnalyzer

    # 逐帧收集特征
    trunk_max = 0.0
    trunk_min = 90.0
    spine_max_straight = 0.0
    knee_min = 180.0; knee_max = 0.0
    elbow_min = 180.0; elbow_max = 0.0
    # 归一化位移（Δy / torso_len，屏幕 y 向下）
    was_max = -2.0; was_min = 2.0     # wrist_above_shoulder max/min
    wan_max = -2.0; wan_min = 2.0     # wrist_above_nose max/min
    wbh_max = -2.0                     # wrist_below_hip max（正=腕在髋下方）
    hd_min = 2.0;  hd_max = -2.0      # hip_drop min/max（髋在踝之上的比例）
    n_valid = 0; n_we = 0; n_wane = 0  # 计数：腕高于肩、腕高于鼻的帧数
    body_vspan_max = 0.0              # 鼻-踝垂直跨度 / tlen 的最大值
    _tlens = []

    for fr in frames:
        if isinstance(fr, dict) and "angles" in fr:
            a = fr["angles"]; kp = fr.get("keypoints")
        else:
            a = SkeletonAnalyzer.compute_angles(fr); kp = fr
        if not kp or len(kp) < 17:
            continue

        def pt(i):
            return kp[i] if i < len(kp) and len(kp[i]) >= 2 else None

        ls, rs = pt(5), pt(6); le, re = pt(7), pt(8); lw, rw = pt(9), pt(10)
        lh, rh = pt(11), pt(12); lk, rk = pt(13), pt(14); la, ra = pt(15), pt(16)
        nose = pt(0)
        if not (ls and rs and lh and rh):
            continue

        sh = ((ls[0]+rs[0])/2, (ls[1]+rs[1])/2)
        hp = ((lh[0]+rh[0])/2, (lh[1]+rh[1])/2)
        wr = ((lw[0]+rw[0])/2, (lw[1]+rw[1])/2) if (lw and rw) else None
        an = ((la[0]+ra[0])/2, (la[1]+ra[1])/2) if (la and ra) else None

        tlen = a.get('torso_len') or max(math.hypot(sh[0]-hp[0], sh[1]-hp[1]), 1e-6)
        _tlens.append(tlen)

        tv = a.get('trunk_vertical_deg', 0) or 0
        trunk_max = max(trunk_max, tv); trunk_min = min(trunk_min, tv)
        sp = a.get('spine', 0) or 0; spine_max_straight = max(spine_max_straight, sp)

        if lk and rk and la and ra:
            lka = a.get("left_knee") or SkeletonAnalyzer.compute_angle(lh, lk, la)
            rka = a.get("right_knee") or SkeletonAnalyzer.compute_angle(rh, rk, ra)
            kv = (lka+rka)/2; knee_min = min(knee_min, kv); knee_max = max(knee_max, kv)
        if le and re and ls and rs and lw and rw:
            lea = a.get("left_elbow") or SkeletonAnalyzer.compute_angle(ls, le, lw)
            rea = a.get("right_elbow") or SkeletonAnalyzer.compute_angle(rs, re, rw)
            ev = (lea+rea)/2; elbow_min = min(elbow_min, ev); elbow_max = max(elbow_max, ev)

        if wr:
            was_ = (sh[1] - wr[1]) / tlen
            was_max = max(was_max, was_); was_min = min(was_min, was_)
            if was_ > 0.1: n_we += 1
            if nose:
                wan_ = (nose[1] - wr[1]) / tlen
                wan_max = max(wan_max, wan_); wan_min = min(wan_min, wan_)
                if wan_ > 0.05: n_wane += 1
            # 腕低于髋：wr[1] > hp[1] 时正
            wbh_ = (wr[1] - hp[1]) / tlen
            wbh_max = max(wbh_max, wbh_)
        if an:
            hd_ = (an[1] - hp[1]) / tlen
            hd_min = min(hd_min, hd_); hd_max = max(hd_max, hd_)
        # 身体垂直跨度（鼻到踝的纵向距离 / 躯干长）
        if nose and an:
            vspan = abs(nose[1] - an[1]) / tlen
            body_vspan_max = max(body_vspan_max, vspan)

        n_valid += 1

    if n_valid == 0:
        return "squat"

    knee_range = max(knee_max - knee_min, 0.0)
    elbow_range = max(elbow_max - elbow_min, 0.0)
    we_ratio = n_we / max(n_valid, 1)     # 腕高于肩的帧比例
    wane_ratio = n_wane / max(n_valid, 1) # 腕高于鼻的帧比例

    # 决策树 v3
    # 调试日志（方便用真实视频定位阈值问题）
    try:
        logger.info(
            "[identify] frames=%d trunk=[%.0f~%.0f]° knee=[%.0f~%.0f]Δ%.0f "
            "elb=[%.0f~%.0f]Δ%.0f w↑sho=[%+.2f~%+.2f](%.0f%%) "
            "w↑nose=[%+.2f~%+.2f](%.0f%%) w↓hip_max=%.2f "
            "hip_drop=[%.2f~%.2f] vspan=%.1f spine=%.0f°",
            n_valid, trunk_min, trunk_max, knee_min, knee_max, knee_range,
            elbow_min, elbow_max, elbow_range,
            was_min, was_max, we_ratio*100,
            wan_min, wan_max, wane_ratio*100, wbh_max,
            hd_min, hd_max, body_vspan_max, spine_max_straight,
        )
    except Exception:
        pass

    # A. 水平身体：俯卧撑、卧推
    # 强信号：躯干接近水平（>55°），或者垂直跨度很小（身体平躺/俯卧，纵向没拉开）
    is_horizontal = trunk_max > 55 or (trunk_max > 40 and body_vspan_max < 1.8)
    if is_horizontal:
        # 卧推：仰卧向上推 → 腕明显高于肩（往天花板方向推）
        bench_signals = 0
        if was_max > 0.3:
            bench_signals += 2   # 强信号：手向上推举
        if knee_min < 155:
            bench_signals += 1   # 屈膝踩凳/地
        if bench_signals >= 2:
            return "bench_press"
        # 俯卧撑：俯卧推地 → 腕在肩下方或接近肩高（推地不是推天）+ 身体呈直线
        pushup_signals = 0
        if was_max < 0.3:
            pushup_signals += 2  # 强信号：手没高举过肩
        if spine_max_straight > 130:
            pushup_signals += 1  # 身体接近直线
        if was_max < 0.0 or knee_min > 150:
            pushup_signals += 1  # 手在肩下推地 / 腿直
        if pushup_signals >= 3:
            return "pushup"
        return "pushup" if knee_min > 145 else "bench_press"

    # B. 硬拉：躯干前倾 + 手臂下垂握杠
    # 硬拉区别于深蹲的核心：膝屈不深 + 手臂下垂到膝/胫位置（wrist_below_hip 大）
    is_deadlift = (
        trunk_max >= 25                       # 躯干明显前倾
        and knee_min > 115                    # 膝没有深屈到深蹲程度
        and wbh_max > 0.3                     # 手臂下垂，腕明显低于髋（握杠）
    )
    if is_deadlift:
        return "deadlift"
    # 放宽：躯干前倾大但 wbh 信号弱（可能手被遮挡），也归硬拉
    if trunk_max > 40 and knee_min > 130:
        return "deadlift"

    # C. 躯干接近垂直：深蹲、引体向上、实力推
    # C1. 深蹲：深屈膝+髋下沉+有蹲起幅度
    deep_squat = (knee_min < 125 and hd_min < 0.8 and knee_range > 25)
    if deep_squat:
        return "squat"

    # C2. 引体向上 vs 实力推（都有手举高，核心区别：手的全程位置 + 肘锁定）
    hands_up = was_max > 0.3
    if hands_up:
        # 引体向上强信号（悬挂抓杠）：
        #   - 手始终在头附近/以上（wan_min > -0.15：手基本不会低于鼻子太多）
        #   - 有明显屈肘（拉到最高时肘是弯的）
        #   - 有屈伸变化（拉-放周期）
        is_pullup = (
            wan_min > -0.35          # 手始终接近或高于鼻子（全程抓杠；顶部下巴过杠时鼻略高于手，wan稍负）
            and wane_ratio > 0.7     # 大多数帧手在鼻子以上（悬挂抓杠）
            and we_ratio > 0.5       # 过半帧手在肩上方（悬挂）
            and elbow_min < 155      # 有明显屈肘（拉到顶）
            and elbow_range > 15     # 有屈伸变化
        )
        # 实力推强信号（站立推举）：
        #   - 手从肩旁推起（wan_min 明显负，起始手低于鼻子很多）
        #   - 站直（无深屈膝）
        #   - 推到顶肘伸直锁定
        is_ohp = (
            wan_min < -0.30          # 起始手在肩旁/锁骨，低于鼻子（与引体向上分界）
            and wane_ratio < 0.8     # 不是全程手在鼻以上（起始和下落时手在肩旁）
            and knee_min > 130       # 站姿腿直（没蹲下去）
            and elbow_max > 145      # 有肘伸直锁定帧
            and wan_max > 0.1        # 手确实举到了头附近或以上
        )
        if is_pullup and not is_ohp:
            return "pullup"
        if is_ohp and not is_pullup:
            return "overhead_press"
        # 两者都亮或都不亮时，按 wan_min 仲裁：
        # 手始终在头附近 = 引体；手从低处推上来 = 实力推
        if wan_min > -0.20:
            return "pullup"
        if wan_min < -0.35:
            return "overhead_press"
        # 极模糊：看帧比例
        if wane_ratio > 0.5 and we_ratio > 0.7:
            return "pullup"
        return "overhead_press"

    # C3. 兜底：躯干直立、手没举高
    # 有明显屈膝动作 → 深蹲；否则如果躯干有前倾 → 硬拉；都不满足 → 深蹲
    if knee_min < 130 and knee_range > 20:
        return "squat"
    if trunk_max > 20 and wbh_max > 0.1:
        return "deadlift"
    if knee_min < 145:
        return "squat"
    return "squat"
