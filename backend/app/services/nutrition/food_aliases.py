# -*- coding: utf-8 -*-
"""中英文食材名映射 —— 解决中文饮食记录0卡问题

公有食材库(food_public)来自 Open Food Facts，食材名多为英文。
中文用户录入(米饭/鸡胸肉/鸡蛋...)无法直接匹配，导致营养=0。
本模块维护常见中文食材 → 英文搜索关键词的映射，供 _match_food 兜底匹配。
"""

# 常见中文食材 → 英文关键词（按匹配优先级排序，取第一个命中的）
CN_FOOD_ALIASES: dict[str, list[str]] = {
    # 主食
    "米饭": ["rice"],
    "白米饭": ["rice"],
    "大米": ["rice"],
    "米": ["rice"],
    "粥": ["rice porridge", "porridge"],
    "面条": ["noodle"],
    "面": ["noodle"],
    "馒头": ["steamed bun", "mantou", "wheat"],
    "包子": ["steamed bun", "mantou"],
    "面包": ["bread"],
    "燕麦": ["oat"],
    "燕麦片": ["oat"],
    "玉米": ["corn"],
    "土豆": ["potato"],
    "红薯": ["sweet potato"],
    "紫薯": ["sweet potato"],
    "山药": ["yam"],
    "饺子": ["dumpling"],
    "米粉": ["rice noodle"],
    "粉丝": ["glass noodle", "mung bean noodle"],
    "通心粉": ["pasta"],
    "意面": ["pasta"],
    # 肉蛋
    "鸡胸肉": ["鸡胸脯肉", "chicken breast"],
    "鸡胸": ["鸡胸脯肉", "chicken breast"],
    "鸡腿": ["鸡腿", "chicken leg", "chicken thigh"],
    "鸡翅": ["鸡翅", "chicken wing"],
    "鸡肉": ["chicken"],
    "鸡蛋": ["egg"],
    "蛋": ["egg"],
    "鸭蛋": ["duck egg"],
    "牛肉": ["beef"],
    "牛腩": ["beef brisket"],
    "牛排": ["steak", "beef"],
    "羊肉": ["lamb", "mutton"],
    "猪肉": ["pork"],
    "五花肉": ["pork belly"],
    "排骨": ["pork rib", "rib"],
    "火腿": ["ham"],
    "培根": ["bacon"],
    "香肠": ["sausage"],
    "腊肠": ["sausage"],
    "鱼": ["fish"],
    "三文鱼": ["salmon"],
    "鲈鱼": ["sea bass", "fish"],
    "虾": ["shrimp", "prawn"],
    "虾仁": ["shrimp"],
    "蟹": ["crab"],
    "螃蟹": ["crab"],
    "鱿鱼": ["squid", "calamari"],
    "蛤蜊": ["clam"],
    "扇贝": ["scallop"],
    # 豆制品
    "豆腐": ["tofu"],
    "豆干": ["tofu", "bean curd"],
    "豆浆": ["soy milk", "soybean milk"],
    "豆奶": ["soy milk"],
    "黄豆": ["soybean"],
    "腐竹": ["bean curd stick", "tofu"],
    "毛豆": ["edamame", "soybean"],
    # 蔬菜
    "青菜": ["bok choy", "chinese cabbage", "leafy green"],
    "小白菜": ["bok choy", "chinese cabbage"],
    "菠菜": ["spinach"],
    "西兰花": ["broccoli"],
    "花菜": ["cauliflower"],
    "菜花": ["cauliflower"],
    "胡萝卜": ["carrot"],
    "番茄": ["tomato"],
    "西红柿": ["tomato"],
    "黄瓜": ["cucumber"],
    "茄子": ["eggplant"],
    "青椒": ["green pepper", "bell pepper"],
    "辣椒": ["pepper", "chili"],
    "洋葱": ["onion"],
    "大蒜": ["garlic"],
    "生姜": ["ginger"],
    "姜": ["ginger"],
    "大白菜": ["chinese cabbage", "napa cabbage"],
    "卷心菜": ["cabbage"],
    "包菜": ["cabbage"],
    "生菜": ["lettuce"],
    "芹菜": ["celery"],
    "韭菜": ["chinese chive", "leek"],
    "韭菜": ["chive"],
    "豆角": ["green bean", "string bean"],
    "四季豆": ["green bean"],
    "豌豆": ["pea"],
    "玉米粒": ["corn"],
    "南瓜": ["pumpkin"],
    "冬瓜": ["winter melon", "gourd"],
    "丝瓜": ["luffa", "gourd"],
    "苦瓜": ["bitter melon", "gourd"],
    "蘑菇": ["mushroom"],
    "香菇": ["shiitake mushroom", "mushroom"],
    "金针菇": ["enoki mushroom", "mushroom"],
    "木耳": ["black fungus", "wood ear"],
    "紫菜": ["seaweed", "nori"],
    "海带": ["kelp", "seaweed"],
    "芦笋": ["asparagus"],
    "西葫芦": ["zucchini", "squash"],
    # 水果
    "苹果": ["apple"],
    "香蕉": ["banana"],
    "橙子": ["orange"],
    "橘子": ["orange", "tangerine"],
    "葡萄": ["grape"],
    "西瓜": ["watermelon"],
    "草莓": ["strawberry"],
    "蓝莓": ["blueberry"],
    "猕猴桃": ["kiwi"],
    "桃子": ["peach"],
    "梨": ["pear"],
    "芒果": ["mango"],
    "菠萝": ["pineapple"],
    "柠檬": ["lemon"],
    "樱桃": ["cherry"],
    "石榴": ["pomegranate"],
    "荔枝": ["lychee"],
    "火龙果": ["dragon fruit"],
    "椰子": ["coconut"],
    "哈密瓜": ["cantaloupe", "melon"],
    # 坚果
    "花生": ["peanut"],
    "核桃": ["walnut"],
    "杏仁": ["almond"],
    "腰果": ["cashew"],
    "开心果": ["pistachio"],
    "榛子": ["hazelnut"],
    "瓜子": ["sunflower seed"],
    "芝麻": ["sesame"],
    # 奶制品
    "牛奶": ["milk"],
    "酸奶": ["yogurt"],
    "奶酪": ["cheese"],
    "芝士": ["cheese"],
    "黄油": ["butter"],
    "奶油": ["cream"],
    # 调味/油脂
    "食用油": ["cooking oil"],
    "橄榄油": ["olive oil"],
    "菜籽油": ["vegetable oil", "rapeseed oil"],
    "花生油": ["peanut oil"],
    "盐": ["salt"],
    "糖": ["sugar"],
    "酱油": ["soy sauce"],
    "醋": ["vinegar"],
    # 饮品
    "咖啡": ["coffee"],
    "茶": ["tea"],
    "可乐": ["cola"],
    "橙汁": ["orange juice"],
    "果汁": ["fruit juice", "juice"],
    "啤酒": ["beer"],
    "红酒": ["red wine", "wine"],
    "白酒": ["white wine", "liquor"],
}


def normalize_food_name(name: str) -> str:
    """去空格、去常见修饰词，保留核心食材词用于匹配"""
    s = (name or "").strip()
    for token in ["大概", "大约", "约", "一份", "一个", "一碗", "一勺", "一小", "一大",
                  "片", "块", "克", "g", "G", "熟", "生", "炒", "烤", "煮", "清蒸",
                  "红烧", "白灼", "水煮", "干煸"]:
        s = s.replace(token, "")
    return s.strip()


def resolve_food_keywords(name: str) -> list[str] | None:
    """根据中文/英文食材名返回匹配关键词列表（中文名优先）。

    - 映射表中命中时：返回 [中文原名] + 对应英文关键词（中文库优先命中）
    - 否则返回 [原名称]
    """
    normalized = normalize_food_name(name)
    if not normalized:
        return None
    for cn, kws in CN_FOOD_ALIASES.items():
        if normalized == cn or normalized.startswith(cn):
            return [normalized] + [k for k in kws if k != normalized]
    return [normalized]
