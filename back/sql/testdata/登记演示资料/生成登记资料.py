"""从既有登记测试表生成建议清单、合成样本和交易预览图。"""

import csv
import html
import math
from pathlib import Path
import random
import subprocess
import tempfile
from datetime import datetime, timedelta


ROOT = Path(__file__).resolve().parent
SOURCE = ROOT.parent / "上链登记测试数据.csv"
ART = ROOT / "封面"
ART.mkdir(exist_ok=True)

PALETTES = {
    "自动驾驶法律": ("#e7ecf3", "#334e68", "#7796ad", "REGULATION"),
    "自动驾驶电力": ("#e4eeeb", "#315e57", "#6fa395", "ELECTRIC"),
    "自动驾驶征信": ("#eae9f0", "#4f4d69", "#8e8aaa", "RISK"),
    "自动驾驶医疗健康": ("#f0e9e7", "#795f65", "#b58b91", "HEALTH"),
    "自动驾驶金融": ("#ebeee8", "#536148", "#96a682", "FINANCE"),
    "自动驾驶版权": ("#ede9ed", "#64556b", "#a28fa8", "RIGHTS"),
    "自动驾驶文化": ("#f0ece6", "#746453", "#b09b7e", "CULTURE"),
    "自动驾驶能源": ("#e7eeef", "#3c6068", "#7ba8aa", "ENERGY"),
    "自动驾驶碳证": ("#e7eee7", "#49654e", "#83a386", "CARBON"),
}

# 单份固定价，仅供演示。真实定价须结合数据量、质量、授权和交付成本。
PRICES = [2680, 1980, 1760, 1520, 3220, 2860, 3580, 2140, 1920, 2460,
          2280, 3120, 3980, 4360, 3650, 2840, 3180, 2560, 2740, 2380,
          2080, 2660, 2950, 3180, 1680, 2760, 2890, 3040]


def make_cover(index: int, name: str, category: str) -> str:
    bg, ink, accent, label = PALETTES[category]
    short = name if len(name) <= 17 else name[:17] + "…"
    safe_name = html.escape(short)
    safe_category = html.escape(category)
    lines = []
    for n in range(9):
        x = 650 + n * 76
        y = 95 + ((n * 71 + index * 37) % 390)
        lines.append(f'<circle cx="{x}" cy="{y}" r="{4 + n % 3}" fill="{accent}" opacity=".7"/>')
        if n:
            prev_x = 650 + (n - 1) * 76
            prev_y = 95 + (((n - 1) * 71 + index * 37) % 390)
            lines.append(f'<path d="M{prev_x} {prev_y} L{x} {y}" stroke="{accent}" stroke-width="2" opacity=".45"/>')
    mesh = "".join(lines)
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="750" viewBox="0 0 1200 750">
      <rect width="1200" height="750" fill="{bg}"/>
      <path d="M650 0 H1200 V750 H860 Q1000 530 820 370 Q690 240 650 0Z" fill="{accent}" opacity=".1"/>
      <path d="M655 610 C800 540 875 660 1200 510" fill="none" stroke="{accent}" stroke-width="2" opacity=".4"/>
      <path d="M630 660 C850 580 940 700 1200 565" fill="none" stroke="{accent}" stroke-width="2" opacity=".28"/>
      {mesh}
      <rect x="70" y="74" width="88" height="5" rx="2.5" fill="{accent}"/>
      <text x="70" y="128" fill="{ink}" font-family="Arial, sans-serif" font-size="23" letter-spacing="4">DATA ASSET / {index:02d}</text>
      <text x="70" y="310" fill="{ink}" font-family="Heiti SC, PingFang SC, Noto Sans CJK SC, sans-serif" font-size="47" font-weight="600">{safe_name}</text>
      <text x="72" y="371" fill="{ink}" opacity=".72" font-family="Heiti SC, PingFang SC, sans-serif" font-size="25">{safe_category}</text>
      <rect x="70" y="625" width="1058" height="1" fill="{ink}" opacity=".2"/>
      <text x="70" y="676" fill="{ink}" opacity=".75" font-family="Arial, sans-serif" font-size="19" letter-spacing="3">AUTONOMOUS DRIVING  /  {label}</text>
      <text x="1128" y="676" fill="{ink}" text-anchor="end" font-family="Arial, sans-serif" font-size="25">{index:02d}</text>
    </svg>'''
    output = ART / f"{index:02d}-{label.lower()}.png"
    with tempfile.NamedTemporaryFile("w", suffix=".svg", encoding="utf-8") as source:
        source.write(svg)
        source.flush()
        subprocess.run(["rsvg-convert", "-w", "1200", "-h", "750", "-o", str(output), source.name], check=True)
    return str(output.relative_to(ROOT))


def build_catalog():
    with SOURCE.open(encoding="utf-8-sig", newline="") as source:
        original = list(csv.DictReader(source))
    if len(original) != len(PRICES):
        raise ValueError("来源条目数已变化，请先复核价格和封面映射")
    rows = []
    for index, item in enumerate(original, 1):
        category = item["资产大类"]
        name = item["资产名称"]
        cover = make_cover(index, name, category)
        # 这是拟议权益，不代表来源站点授权。只有获得许可后才可实际出售。
        is_sensitive = category in {"自动驾驶医疗健康", "自动驾驶征信"}
        rows.append({
            "序号": index,
            "建议资产名称": name,
            "数据产品类型": category,
            "数据产品方向": item["资产子类"],
            "资产介绍草稿": item["详细描述"],
            "建议价格_人民币每份": PRICES[index - 1],
            "建议交易模式": "固定价格",
            "建议资产总份数": 1,
            "建议可售持有权": 0,
            "建议可售经营权": 0 if is_sensitive else 1,
            "建议可售加工使用权": 1,
            "封面文件": cover,
            "原资料链接": item["来源链接"],
            "原表所列源文件名_未提供文件": item["源文件名称"],
            "登记前检查": "核实原始文件、使用许可及可售权益；敏感字段需脱敏。",
        })
    with (ROOT / "28个数据集登记建议.csv").open("w", encoding="utf-8-sig", newline="") as target:
        writer = csv.DictWriter(target, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)


def build_synthetic_data():
    randomizer = random.Random(20261126)
    columns = ["vehicle_id", "timestamp", "speed_kmh", "acceleration_ms2", "soc_percent",
               "battery_voltage_v", "battery_current_a", "trip_distance_km", "ambient_temp_c", "road_type"]
    with (ROOT / "合成车辆能耗与驾驶行为_测试源文件.csv").open("w", encoding="utf-8-sig", newline="") as target:
        writer = csv.writer(target)
        writer.writerow(columns)
        for vehicle in range(1, 6):
            soc = 88 - vehicle
            distance = 0.0
            for step in range(24):
                speed = round(max(0, 35 + 22 * math.sin(step / 4 + vehicle) + randomizer.uniform(-7, 7)), 1)
                acceleration = round(randomizer.uniform(-1.6, 1.8), 2)
                distance += speed / 60
                soc -= 0.16 + speed / 320
                current = round(18 + speed * 0.55 + randomizer.uniform(-4, 4), 1)
                writer.writerow([f"SYN-{vehicle:03d}", (datetime(2026, 11, 1, 8, 0) + timedelta(minutes=step)).isoformat(),
                                 speed, acceleration, round(soc, 1), round(345 + soc * 0.28, 1), current,
                                 round(distance, 2), round(18 + vehicle + randomizer.uniform(-1, 1), 1),
                                 "urban" if step < 12 else "highway"])
    make_cover(29, "合成车辆能耗与驾驶行为样本集", "自动驾驶电力")


if __name__ == "__main__":
    build_catalog()
    build_synthetic_data()
    print("已生成 28 条登记建议、29 张封面和 1 份合成测试源文件")
