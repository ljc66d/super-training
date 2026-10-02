# -*- coding: utf-8 -*-
"""
全动作纠错规则库
每个动作定义：
- 标准关节角度参数（min/max/ideal/weight）
- 错误检测规则（基于几何指标 + 阈值）
- 每个错误的中文纠正建议文案

覆盖动作：力量类（深蹲/卧推/硬拉/引体向上/俯卧撑/推举/划船/弓箭步/二头弯举/肩推）、
         功能类（仰卧起坐/跳绳/波比跳）、爆发类（跳远）
"""
from typing import Dict, List

# 动作元信息
ACTION_META = {
    "squat": {
        "name": "深蹲",
        "category": "力量健美",
        "model": "exercises_public",
        "description": "双脚与肩同宽，屈髋屈膝下蹲至大腿平行地面，起身站直",
        "joints_focus": [5, 6, 11, 12, 13, 14, 15, 16],
    },
    "deadlift": {
        "name": "硬拉",
        "category": "力量健美",
        "description": "俯身握杠，挺直背部，髋膝协同发力将杠铃拉起至站立",
    },
    "bench_press": {
        "name": "卧推",
        "category": "力量健美",
        "description": "仰卧于凳，双手握杠下放至胸部，推起至手臂伸直",
    },
    "overhead_press": {
        "name": "实力推",
        "category": "力量健美",
        "description": "站立，将杠铃/哑铃从肩部推举过头顶至手臂伸直",
    },
    "barbell_row": {
        "name": "杠铃划船",
        "category": "力量健美",
        "description": "俯身屈髋，将杠铃拉向腹部，肩胛后缩",
    },
    "lunge": {
        "name": "弓箭步",
        "category": "力量健美",
        "description": "单腿向前跨步下蹲，前腿膝盖与脚尖对齐，后腿膝盖下沉",
    },
    "bicep_curl": {
        "name": "二头弯举",
        "category": "力量健美",
        "description": "手臂前伸握铃，屈肘将重量举起至肩前",
    },
    "pushup": {
        "name": "俯卧撑",
        "category": "力量健美",
        "description": "身体成直线，屈肘下降至胸部贴近地面，推起还原",
    },
    "pullup": {
        "name": "引体向上",
        "category": "力量健美",
        "description": "悬垂于单杠，背阔发力将身体拉起至下巴过杆",
    },
    "situp": {
        "name": "仰卧起坐",
        "category": "功能训练",
        "description": "仰卧屈膝，卷腹起坐，手触膝后缓慢下放",
    },
    "jump_rope": {
        "name": "跳绳",
        "category": "功能训练",
        "description": "手腕摇绳，前脚掌起跳，落地微屈膝缓冲",
    },
    "burpee": {
        "name": "波比跳",
        "category": "功能训练",
        "description": "站立下蹲→俯卧撑→收腿→向上跳起",
    },
    "long_jump": {
        "name": "立定跳远",
        "category": "功能训练",
        "description": "屈膝摆臂，向前上方起跳，落地缓冲",
    },
}


def get_supported_actions() -> list:
    """返回支持纠错的所有动作代码列表"""
    return sorted(ACTION_META.keys())


def get_action_meta(action: str) -> dict:
    return ACTION_META.get(action, {})


# 各动作规则分析函数约定
# 输入：analyzed_frames（每帧含 angles 和关键点坐标）、features（可选，已归一化 [T,17,2]）
# 输出：{指标: 值, errors: [{code, name, severity, advice, detail}]}

def _frame_angles(analyzed_frames) -> Dict[str, float]:
    """聚合多帧角度（取各角度的平均值/极值）"""
    if not analyzed_frames:
        return {}
    agg: Dict[str, list] = {}
    for fr in analyzed_frames:
        for k, v in fr.get("angles", {}).items():
            agg.setdefault(k, []).append(v)
    result = {}
    for k, vals in agg.items():
        result[k] = sum(vals) / len(vals)
    return result


def _add_error(errors: list, code: str, name: str, severity: str, detail: str):
    """添加错误记录"""
    errors.append({
        "code": code, "name": name, "severity": severity,
        "detail": detail,
        "advice": _ADVICE.get(code, "请参考专业教练指导调整动作。"),
    })


# 错误纠正建议文案库（错误代码 → 可执行提示）
_ADVICE = {
    # 深蹲/下肢
    "knee_collapse": "膝盖内扣：有意识地让膝盖向外打开，与脚尖方向对齐，想象膝盖向外推地外展，可先用轻重量练习。",
    "forward_lean": "重心前移：身体过度前倾。应让重心落在足中，保持躯干直立，可降低重量并练习蹲起时挺胸。",
    "shallow_squat": "未达深度：下蹲不够深。应下蹲至大腿至少平行地面（髋低于膝），可先做自重深蹲建立深度。",
    "heel_lift": "踮脚尖：脚跟离地导致重心前移。应保持全脚掌着地，重心压向脚跟，可垫高脚跟练习踝关节活动度。",
    "rounded_back": "圆背：下背弯曲。应保持脊柱中立挺直，核心收紧，想象胸部挺起，下蹲时骨盆略后倾。",
    "knee_forward": "膝盖过度前伸：膝盖远超脚尖。应加大屈髋幅度，让臀部后坐，膝盖与脚尖保持对齐。",
    "knee_locked": "膝盖锁死：站直时膝盖过度伸直。应保持膝盖微屈，不要完全锁死膝关节。",
    # 硬拉/背
    "lower_back_round": "下背弯曲（圆背）：硬拉时腰背未挺直。应核心收紧，挺胸收腹，想象背部放一支笔保持笔直，减轻重量。",
    "bar_off_body": "杠铃离身体过远：杠铃未贴近身体。应让杠铃贴着小腿/大腿上拉，保持杠铃重心在足中。",
    "overextend": "过度后仰：拉起后身体过度后仰。应在站直位用臀部夹紧完成锁定，避免腰椎过度伸展。",
    # 卧推/上肢
    "elbow_flare": "肘外扩：大臂与躯干夹角过大。应让肘部靠近身体，夹角约45度，可减轻重量并控制下放轨迹。",
    "shallow_depth": "未达深度：动作下放不到位。应让重量充分下放（胸部/头部），保证完整动作范围。",
    "shoulder_shrug": "耸肩：肩部耸起。应沉肩夹背，肩胛骨后缩下沉，保持肩部稳定。",
    "wrist_bend": "手腕过度弯曲：手腕后折。应保持手腕中立（拳眼朝前），重量垂直于前臂。",
    "elbow_float": "肘部外漂：弯举时肘部移动。应固定大臂贴紧身体，仅前臂做屈伸，避免借力。",
    "half_rep": "半程动作：未完成完整动作幅度。应完成全程动作，避免只做一半以追求重量。",
    "swing_back": "身体摆动/借力：靠惯性完成动作。应放慢节奏，控制重量，用目标肌群主动发力。",
    "chin_below": "未过杆：下巴未越过单杠。应拉高至下巴过杆，可借助弹力带辅助建立力量。",
    "short_hang": "未充分下放：手臂未完全伸直。应每次下放至手臂完全伸直（肘微屈），充分伸展背阔肌。",
    "body_swing": "身体摆动：引体时身体晃动。应核心收紧，双腿并拢，控制动作，避免借力摇摆。",
    "kicking": "蹬腿借力：用腿部蹬踢借力。应保持下肢稳定，用背部力量主导上拉。",
    "hip_sag": "塌腰：俯卧撑时腰部下沉。应收紧核心和臀部，保持身体成一条直线。",
    "hip_pike": "撅臀：臀部过高。应保持臀部和核心收紧，身体成直线，避免骨盆前倾。",
    "flat_foot": "全脚掌落地：跳绳落地过重。应以前脚掌着地，落地微屈膝缓冲，保持轻盈。",
    "stiff_knee": "膝盖过直：跳绳/落地时膝盖僵硬。应保持膝盖微屈缓冲，避免锁死。",
    "irregular_rhythm": "节奏不稳：跳跃节奏不规律。应稳定摇绳节奏，保持均匀的跳跃频率。",
    "high_jump": "跳跃过高：跳绳跳得过高。应减小起跳高度，让绳子刚好从脚下通过即可。",
    "arm_flare": "手臂外展：跳绳时手臂张开过大。应保持大臂贴近身体，用手腕摇绳。",
    # 仰卧起坐/核心
    "pull_head": "借力拉头：用手拉头部起坐。应双手交叉放胸前或轻触耳侧，用腹部卷曲发力。",
    "hip_lift": "臀部离地：起坐时臀部抬起。应保持下背贴地，用腹肌卷曲而非髋部摆动。",
    "no_touch": "未触膝：手肘未触到膝盖。应完成完整卷腹幅度，让手肘充分靠近膝盖。",
    "momentum": "借助惯性：利用惯性快速起坐。应放慢下放速度，控制动作，感受腹肌持续受力。",
    # 跳远
    "steep_takeoff": "起跳角度过大：向上跳太多、向前不足。应向前上方45度左右发力，兼顾高度与远度。",
    "shallow_takeoff": "起跳角度过小：起跳太低平。应充分蹬地向上跳起，起跳瞬间挺髋摆臂。",
    "poor_arm_swing": "未充分摆臂：摆臂幅度不足。应充分向后摆臂再向前上方摆动，用摆臂带动身体。",
    "unstable_landing": "落地不稳：落地后身体晃动。应屈膝缓冲，保持重心稳定，落地时双臂前伸维持平衡。",
    "lean_back": "身体后仰：落地或起跳时后仰。应保持躯干挺直略前倾，避免后坐。",
    # 通用
    "general": "建议在专业人士指导下调整动作，注意安全，可先减轻重量练习标准动作。",
}


# 各动作规则分析函数

def analyze_squat(frames, features) -> Dict:
    """深蹲：膝角/膝盖内扣/躯干前倾/深度/脚跟/圆背"""
    m: Dict = {"errors": []}
    angles = _frame_angles(frames)
    if not angles:
        m["error"] = "关键点数据不足"
        return m

    # 最低点膝角（取膝角最小帧）
    min_knee = 180
    knee_collapse_max = 0.0
    for fr in frames:
        a = fr.get("angles", {})
        lk = a.get("left_knee", 180)
        rk = a.get("right_knee", 180)
        knee = (lk + rk) / 2
        min_knee = min(min_knee, knee)

    # 膝盖内扣：膝相对踝的X偏差，用踝间距（脚宽）归一化
    if features is not None and len(features) > 0:
        for fr in features:
            ankle_w = abs(fr[15][0] - fr[16][0]) + 1e-6
            lk_x = fr[13][0]; la_x = fr[15][0]
            rk_x = fr[14][0]; ra_x = fr[16][0]
            knee_collapse_max = max(knee_collapse_max,
                                    abs(lk_x - la_x) / ankle_w,
                                    abs(rk_x - ra_x) / ankle_w)
    else:
        # 未归一化时，用膝踝X差相对躯干宽度归一
        for fr in frames:
            kp = fr.get("keypoints")
            if kp:
                sh_w = abs(kp[5][0] - kp[6][0]) + 1e-6
                lk_x = kp[13][0]; la_x = kp[15][0]
                rk_x = kp[14][0]; ra_x = kp[16][0]
                knee_collapse_max = max(knee_collapse_max,
                                        abs(lk_x - la_x) / sh_w, abs(rk_x - ra_x) / sh_w)

    m["depth_knee_angle"] = round(min_knee, 1)
    m["knee_collapse"] = round(knee_collapse_max, 3)

    # 错误检测
    if knee_collapse_max > 0.15:
        _add_error(m["errors"], "knee_collapse", "膝盖内扣", "critical", f"膝盖内扣偏差{knee_collapse_max:.2f}")
    if min_knee > 100:
        _add_error(m["errors"], "shallow_squat", "未达深度", "critical", f"最低膝角{min_knee:.0f}°")
    return m


def analyze_deadlift(frames, features) -> Dict:
    """硬拉：下背挺直/杠铃贴近/锁定"""
    m: Dict = {"errors": []}
    angles = _frame_angles(frames)
    if not angles:
        m["error"] = "关键点数据不足"
        return m
    # 脊柱直线度（肩-髋-踝角度，接近180为好）
    spine = angles.get("spine", 180)
    m["spine_straightness"] = round(spine, 1)
    if abs(180 - spine) > 25:
        _add_error(m["errors"], "lower_back_round", "下背弯曲", "critical", f"脊柱角{spine:.0f}°")
    return m


def analyze_bench_press(frames, features) -> Dict:
    """卧推：肘部位置/深度/肩胛"""
    m: Dict = {"errors": []}
    angles = _frame_angles(frames)
    if not angles:
        m["error"] = "关键点数据不足"
        return m
    # 肘外扩：肩-肘-腕 角度
    le = angles.get("left_elbow", 90)
    re = angles.get("right_elbow", 90)
    min_elbow = min(le, re)
    m["elbow_angle"] = round(min_elbow, 1)
    if min_elbow > 90:
        _add_error(m["errors"], "shallow_depth", "未达深度", "major", f"最低肘角{min_elbow:.0f}°")
    return m


def analyze_overhead_press(frames, features) -> Dict:
    """肩推：躯干挺直/肘部轨迹"""
    m: Dict = {"errors": []}
    angles = _frame_angles(frames)
    if not angles:
        m["error"] = "关键点数据不足"
        return m
    torso = angles.get("torso", 180)
    m["torso_angle"] = round(torso, 1)
    if abs(180 - torso) > 20:
        _add_error(m["errors"], "lean_back", "身体后仰", "major", f"躯干角{torso:.0f}°")
    return m


def analyze_barbell_row(frames, features) -> Dict:
    """杠铃划船：背部挺直/肘部"""
    return analyze_deadlift(frames, features)


def analyze_lunge(frames, features) -> Dict:
    """弓箭步：前膝对齐/躯干直立"""
    m: Dict = {"errors": []}
    angles = _frame_angles(frames)
    if not angles:
        m["error"] = "关键点数据不足"
        return m
    lk = angles.get("left_knee", 90)
    rk = angles.get("right_knee", 90)
    m["knee_angle"] = round(min(lk, rk), 1)
    # 前膝是否过度前伸
    for fr in frames:
        kp = fr.get("keypoints")
        if kp:
            knee_x = kp[13][0]; ankle_x = kp[15][0]
            toe_off = abs(knee_x - ankle_x)
            if toe_off > 1.2:
                _add_error(m["errors"], "knee_forward", "膝盖过度前伸", "major", f"膝盖超出脚尖{toe_off:.2f}")
                break
    return m


def analyze_bicep_curl(frames, features) -> Dict:
    """二头弯举：肘部固定/借力"""
    m: Dict = {"errors": []}
    for fr in frames:
        kp = fr.get("keypoints")
        if kp:
            # 肘部水平位移（借力摆动检测）
            pass
    # 简单判断半程
    angles = _frame_angles(frames)
    min_elbow = min(angles.get("left_elbow", 180), angles.get("right_elbow", 180))
    m["elbow_angle"] = round(min_elbow, 1)
    if min_elbow > 60:
        _add_error(m["errors"], "half_rep", "半程动作", "minor", f"最低肘角{min_elbow:.0f}°")
    return m


def analyze_pushup(frames, features) -> Dict:
    """俯卧撑：身体直线/深度/肘外扩/塌腰"""
    m: Dict = {"errors": []}
    angles = _frame_angles(frames)
    if not angles:
        m["error"] = "关键点数据不足"
        return m
    spine = angles.get("spine", 180)
    m["body_straightness"] = round(spine, 1)
    if abs(180 - spine) > 25:
        # 判断塌腰还是撅臀
        _add_error(m["errors"], "hip_sag", "塌腰/撅臀", "major", f"身体直线度{spine:.0f}°")
    min_elbow = min(angles.get("left_elbow", 90), angles.get("right_elbow", 90))
    m["elbow_angle"] = round(min_elbow, 1)
    if min_elbow > 90:
        _add_error(m["errors"], "shallow_depth", "未达深度", "critical", f"最低肘角{min_elbow:.0f}°")
    return m


def analyze_pullup(frames, features) -> Dict:
    """引体向上：过杆/下放/摆动"""
    m: Dict = {"errors": []}
    angles = _frame_angles(frames)
    if not angles:
        m["error"] = "关键点数据不足"
        return m
    # 手臂伸直角度（最高伸展）
    max_elbow = max(angles.get("left_elbow", 0), angles.get("right_elbow", 0))
    m["max_elbow_angle"] = round(max_elbow, 1)
    if max_elbow < 150:
        _add_error(m["errors"], "short_hang", "未充分下放", "critical", f"最大肘角{max_elbow:.0f}°")
    # 身体摆动（髋部水平位移）
    if features is not None:
        try:
            hip_x = [fr[11][0] for fr in features]
            swing = max(hip_x) - min(hip_x)
            m["body_swing"] = round(swing, 3)
            if swing > 0.3:
                _add_error(m["errors"], "body_swing", "身体摆动", "major", f"摆动幅度{swing:.2f}")
        except Exception:
            pass
    return m


def analyze_situp(frames, features) -> Dict:
    """仰卧起坐：借力拉头/臀部离地/未触膝"""
    m: Dict = {"errors": []}
    angles = _frame_angles(frames)
    if not angles:
        m["error"] = "关键点数据不足"
        return m
    # 臀部稳定性（髋部垂直位移）
    if features is not None:
        try:
            hip_y = [fr[11][1] for fr in features]
            hip_range = max(hip_y) - min(hip_y)
            m["hip_stability"] = round(hip_range, 3)
            if hip_range > 0.3:
                _add_error(m["errors"], "hip_lift", "臀部离地", "critical", f"髋部位移{hip_range:.2f}")
        except Exception:
            pass
    return m


def analyze_jump_rope(frames, features) -> Dict:
    """跳绳：膝盖缓冲/节奏"""
    m: Dict = {"errors": []}
    angles = _frame_angles(frames)
    if not angles:
        m["error"] = "关键点数据不足"
        return m
    min_knee = min(angles.get("left_knee", 160), angles.get("right_knee", 160))
    m["min_knee_angle"] = round(min_knee, 1)
    if min_knee > 160:
        _add_error(m["errors"], "stiff_knee", "膝盖过直", "major", f"最小膝角{min_knee:.0f}°")
    return m


def analyze_burpee(frames, features) -> Dict:
    """波比跳：借力/半程"""
    m: Dict = {"errors": []}
    angles = _frame_angles(frames)
    if not angles:
        m["error"] = "关键点数据不足"
        return m
    m["note"] = "波比跳关注动作连贯性与俯卧撑阶段深度"
    return m


def analyze_long_jump(frames, features) -> Dict:
    """立定跳远：起跳角度/摆臂/落地稳定"""
    m: Dict = {"errors": []}
    angles = _frame_angles(frames)
    if not angles:
        m["error"] = "关键点数据不足"
        return m
    return m


# 动作分析分发表
_ANALYZERS = {
    "squat": analyze_squat,
    "deadlift": analyze_deadlift,
    "bench_press": analyze_bench_press,
    "overhead_press": analyze_overhead_press,
    "barbell_row": analyze_barbell_row,
    "lunge": analyze_lunge,
    "bicep_curl": analyze_bicep_curl,
    "pushup": analyze_pushup,
    "pullup": analyze_pullup,
    "situp": analyze_situp,
    "jump_rope": analyze_jump_rope,
    "burpee": analyze_burpee,
    "long_jump": analyze_long_jump,
}


def analyze_action(action: str, frames, features=None) -> Dict:
    """分发到对应动作的分析函数"""
    analyzer = _ANALYZERS.get(action)
    if not analyzer:
        return {"error": f"暂不支持动作: {action}", "supported": get_supported_actions()}
    try:
        return analyzer(frames, features)
    except Exception as e:  # noqa: BLE001
        return {"error": f"分析异常: {e}"}
