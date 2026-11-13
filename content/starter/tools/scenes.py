"""Editorial illustrations for the PressCompass starter articles (flat style of the locked preview).
Each scene is drawn on a 600x400 canvas and rendered at 1800x1200. Fixed natural colours."""
import math, random

def R(x, y, w, h, c, extra=''): return f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" fill="{c}"{extra}/>'
def C(x, y, r, c, extra=''): return f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r:.1f}" fill="{c}"{extra}/>'
def P(d, c, extra=''): return f'<path d="{d}" fill="{c}"{extra}/>'
def grad(id_, stops, x2=0, y2=1):
    s = ''.join(f'<stop offset="{o}" stop-color="{c}"/>' for o, c in stops)
    return f'<linearGradient id="{id_}" x1="0" y1="0" x2="{x2}" y2="{y2}">{s}</linearGradient>'
def ridge(rnd, y, amp, step, x0=-20, x1=620):
    pts = []; x = x0
    while x <= x1:
        pts.append(f'{x:.0f} {y + rnd.uniform(-amp, amp):.1f}'); x += step
    return 'L'.join(pts)

def rice():
    rnd = random.Random(11)
    o = [f'<defs>{grad("sky", [(0, "#f3d9b1"), (0.55, "#f6e6c8"), (1, "#dfe6d4")])}</defs>', R(0, 0, 600, 400, 'url(#sky)'), C(430, 96, 30, '#fbf1da'), C(430, 96, 46, '#fbf1da', ' opacity="0.35"')]
    o.append(P(f'M-20 170 L{ridge(rnd, 150, 18, 40)} L620 400 L-20 400Z', '#a9b6a0'))
    o.append(P(f'M-20 190 L{ridge(rnd, 178, 12, 50)} L620 400 L-20 400Z', '#8ea283'))
    colors = ['#7f9a4f', '#93ab5a', '#a7bb67', '#6f8c45', '#b7c574', '#86a352', '#9cb460']
    y = 200
    for i in range(9):
        c = colors[i % len(colors)]; h = 18 + i * 3.4
        a, b = rnd.uniform(-10, 10), rnd.uniform(-10, 10)
        o.append(P(f'M-20 {y + a:.1f} C150 {y - 14 + b:.1f} 420 {y + 16 - a:.1f} 620 {y + b:.1f} L620 {y + h + 30:.1f} L-20 {y + h + 30:.1f}Z', c))
        o.append(P(f'M-20 {y + a:.1f} C150 {y - 14 + b:.1f} 420 {y + 16 - a:.1f} 620 {y + b:.1f}', 'none', ' stroke="#e9edc9" stroke-width="1.6" opacity="0.75"'))
        y += h
    for x, s in [(70, 1.0), (520, 1.25), (560, 0.8)]:
        base = 205 if x < 300 else 212
        o.append(P(f'M{x} {base} q{3*s:.1f} {-40*s:.1f} {-2*s:.1f} {-70*s:.1f}', 'none', f' stroke="#4f5b3a" stroke-width="{3*s:.1f}"'))
        for ang in range(0, 360, 45):
            dx, dy = math.cos(math.radians(ang)) * 24 * s, math.sin(math.radians(ang)) * 10 * s - 4 * s
            o.append(P(f'M{x - 2*s:.1f} {base - 70*s:.1f} q{dx/2:.1f} {dy - 8*s:.1f} {dx:.1f} {dy + 6*s:.1f}', 'none', f' stroke="#55693a" stroke-width="{2.4*s:.1f}" stroke-linecap="round"'))
    o += [P('M300 238 L330 222 L360 238Z', '#7b5a3b'), R(306, 238, 48, 22, '#a07a52'), R(324, 246, 10, 14, '#5d432c')]
    for x in [180, 200, 410]:
        y0 = 300 if x < 300 else 330
        o += [C(x, y0 - 16, 4.5, '#3f3a33'), P(f'M{x - 10} {y0 - 12} L{x} {y0 - 22} L{x + 10} {y0 - 12}Z', '#c9a86a'), R(x - 3, y0 - 12, 6, 14, '#5a4b3c')]
    return ''.join(o)

def nickel():
    rnd = random.Random(5)
    o = [f'<defs>{grad("sky", [(0, "#c9d3d8"), (1, "#e4ddd0")])}{grad("sea", [(0, "#4f7d8a"), (1, "#2e5664")])}</defs>', R(0, 0, 600, 400, 'url(#sky)')]
    o.append(P(f'M-20 200 L{ridge(rnd, 120, 22, 45)} L620 260 L-20 260Z', '#7e8f6b'))
    o.append(P('M20 236 Q70 150 140 128 Q200 116 250 146 Q300 180 330 236Z', '#a9552f'))
    for i in range(7):
        y = 140 + i * 13
        w = 70 + i * 22
        o.append(P(f'M{150 - w/2:.1f} {y} L{150 + w/2:.1f} {y} L{156 + w/2:.1f} {y + 8} L{144 - w/2:.1f} {y + 8}Z', ['#c97446', '#d68a58', '#bf6a3e'][i % 3]))
        o.append(P(f'M{144 - w/2:.1f} {y + 8} L{156 + w/2:.1f} {y + 8}', 'none', ' stroke="#8f4527" stroke-width="1.2"'))
    for cx, cy, r in [(352, 70, 22), (372, 52, 28), (400, 36, 24), (470, 84, 18), (486, 66, 22)]:
        o.append(C(cx, cy, r, '#eeeae2', ' opacity="0.95"'))
    o += [R(350, 88, 14, 150, '#50545b'), R(468, 104, 12, 130, '#50545b'), R(520, 120, 10, 110, '#5d6168')]
    o.append(P('M250 260 L250 190 L320 205 L320 180 L410 196 L410 176 L560 176 L560 260Z', '#5f646c'))
    o += [R(270, 214, 30, 46, '#6c7179'), R(424, 196, 120, 64, '#686d75')]
    for x in range(432, 540, 14): o.append(R(x, 206, 8, 10, '#e2b26b', ' opacity="0.8"'))
    o.append(R(0, 258, 600, 142, 'url(#sea)'))
    for y in range(272, 400, 12):
        o.append(P(f'M0 {y} ' + ' '.join(f'Q{x + 12} {y - 4} {x + 24} {y}' for x in range(0, 600, 24)), 'none', ' stroke="#7aa2ad" stroke-width="1.2" opacity="0.6"'))
    o += [R(120, 262, 230, 8, '#6a5a4b'), *[R(x, 262, 4, 26, '#4c4036') for x in range(130, 350, 40)]]
    o += [P('M150 300 L330 300 L316 326 L164 326Z', '#3b4a53'), P('M170 300 Q200 276 230 300Z', '#b8613a'), P('M232 300 Q262 272 292 300Z', '#a9552f'), R(296, 286, 22, 14, '#e8e2d6')]
    return ''.join(o)

def parliament():
    o = [f'<defs>{grad("sky", [(0, "#cfe0ea"), (1, "#eef1ec")])}</defs>', R(0, 0, 600, 400, 'url(#sky)')]
    for cx, cy, r in [(110, 70, 20), (134, 60, 26), (162, 68, 18), (470, 54, 16), (490, 46, 22)]: o.append(C(cx, cy, r, '#ffffff', ' opacity="0.9"'))
    o.append(R(0, 250, 600, 150, '#c9c3b2'))
    o.append(P('M150 250 L150 190 L450 190 L450 250Z', '#e7e2d6'))
    o.append(P('M168 192 C176 96 290 92 298 192Z', '#3f8a6c'))
    o.append(P('M302 192 C310 92 424 96 432 192Z', '#3f8a6c'))
    o.append(P('M178 192 C188 116 280 112 288 192Z', '#4f9b7c', ' opacity="0.7"'))
    o.append(P('M312 192 C320 112 412 116 422 192Z', '#4f9b7c', ' opacity="0.7"'))
    o.append(R(296, 96, 8, 96, '#e7e2d6'))
    for x in range(164, 440, 22): o.append(R(x, 204, 10, 46, '#cfc8b8'))
    o += [R(140, 250, 320, 8, '#b7b09f'), R(120, 258, 360, 8, '#aaa392')]
    o += [R(520, 150, 3, 120, '#6b6b6b'), R(523, 152, 34, 11, '#c8382e'), R(523, 163, 34, 11, '#f4f1ea')]
    for x, s in [(60, 1.0), (96, 0.8), (560, 0.9)]:
        o += [R(x - 3, 262 - 40 * s, 6, 40 * s, '#5b4a39'), C(x, 262 - 52 * s, 26 * s, '#5e8a5a'), C(x - 14 * s, 262 - 44 * s, 18 * s, '#6c9a66')]
    o.append(P('M200 400 L260 266 L340 266 L400 400Z', '#d8d2c2'))
    return ''.join(o)

def volcano():
    o = [f'<defs>{grad("sky", [(0, "#e9b98f"), (0.5, "#f1d7b8"), (1, "#d8d6cc")])}{grad("cone", [(0, "#6d5b52"), (1, "#3e3633")])}</defs>', R(0, 0, 600, 400, 'url(#sky)')]
    for i, (cx, cy, r) in enumerate([(392, 70, 26), (376, 50, 32), (350, 34, 30), (322, 26, 26), (296, 22, 22)]):
        o.append(C(cx, cy, r, '#f1ece6' if i % 2 else '#e6ded5', ' opacity="0.95"'))
    o.append(P('M60 260 L210 250 L300 150 L330 96 L352 96 L372 140 L470 240 L600 250 L600 400 L0 400 L0 270Z', '#8a7a70', ' opacity="0.45"'))
    o.append(P('M170 300 L300 132 Q340 92 380 132 L520 300Z', 'url(#cone)'))
    for i in range(10):
        x = 316 + i * 4 - 18
        o.append(P(f'M{x} 128 L{x - 40 - i*9} 300', 'none', ' stroke="#2e2826" stroke-width="2" opacity="0.35"'))
    o.append(P('M318 122 Q340 112 362 122 L356 128 Q340 120 324 128Z', '#d9734a'))
    o.append(P('M0 290 Q150 270 300 292 T600 286 L600 400 L0 400Z', '#c9b49b'))
    o.append(P('M0 330 Q200 316 380 334 T600 330 L600 400 L0 400Z', '#b9a185'))
    o.append(P('M40 330 L120 240 L200 330Z', '#7d6a5e'))
    o.append(P('M60 330 L120 262 L182 330Z', '#9a8676'))
    for x in range(0, 600, 8): o.append(R(x, 360 + (x % 24) / 6, 3, 2, '#a68e73'))
    return ''.join(o)

def nusantara():
    rnd = random.Random(21)
    o = [f'<defs>{grad("sky", [(0, "#cde3e6"), (1, "#eef0e6")])}</defs>', R(0, 0, 600, 400, 'url(#sky)')]
    o.append(P(f'M-20 210 L{ridge(rnd, 160, 16, 40)} L620 400 L-20 400Z', '#7f9f7c'))
    o.append(P(f'M-20 236 L{ridge(rnd, 210, 10, 30)} L620 400 L-20 400Z', '#5f845d'))
    for _ in range(60):
        x, y = rnd.uniform(0, 600), rnd.uniform(214, 300)
        o.append(C(x, y, rnd.uniform(7, 14), rnd.choice(['#4e7a4e', '#5a885a', '#467044'])))
    o.append(P('M120 300 L480 300 L540 400 L60 400Z', '#c8b89c'))
    o += [R(200, 180, 70, 120, '#e9e6de'), R(280, 150, 90, 150, '#f2efe8'), R(380, 196, 60, 104, '#e2ded5')]
    for bx, by, bw, bh in [(200, 180, 70, 120), (280, 150, 90, 150), (380, 196, 60, 104)]:
        for y in range(int(by) + 10, int(by + bh) - 6, 14):
            o.append(R(bx + 6, y, bw - 12, 5, '#9fb7bd', ' opacity="0.8"'))
    o.append(P('M280 150 L325 120 L370 150Z', '#c9a24a'))
    for x, h in [(170, 170), (470, 140)]:
        o += [R(x, 300 - h, 6, h, '#d9a034'), R(x - 60, 300 - h, 110, 5, '#d9a034'), R(x + 40, 300 - h, 3, 40, '#555'), R(x + 34, 340 - h, 14, 10, '#666')]
    o.append(P('M60 400 L250 300 L350 300 L540 400Z', '#4a4f55'))
    for y in range(312, 400, 18): o.append(R(298 - (y - 300) * 0.05, y, 4 + (y - 300) * 0.05, 9, '#f2e3a0'))
    return ''.join(o)

def world():
    o = [f'<defs>{grad("bg", [(0, "#1c2e4a"), (1, "#0f1e33")])}<clipPath id="g"><circle cx="300" cy="200" r="150"/></clipPath></defs>', R(0, 0, 600, 400, 'url(#bg)')]
    rnd = random.Random(2)
    for _ in range(70): o.append(C(rnd.uniform(0, 600), rnd.uniform(0, 400), rnd.uniform(0.5, 1.4), '#f6f4ef', f' opacity="{rnd.uniform(0.2, 0.7):.2f}"'))
    o.append(C(300, 200, 150, '#2f5f86'))
    g = ['<g clip-path="url(#g)">']
    blobs = [(250, 120, 70, 40), (330, 150, 60, 30), (360, 230, 40, 26), (290, 210, 22, 14), (318, 236, 30, 9), (360, 262, 18, 8), (392, 252, 24, 10), (420, 290, 46, 22), (200, 200, 30, 50), (240, 300, 26, 34)]
    for x, y, w, h in blobs: g.append(f'<ellipse cx="{x}" cy="{y}" rx="{w}" ry="{h}" fill="#7fa77a"/>')
    for lat in range(-60, 61, 30):
        y = 200 - 150 * math.sin(math.radians(lat)); rx = 150 * math.cos(math.radians(lat))
        g.append(f'<ellipse cx="300" cy="{y:.1f}" rx="{rx:.1f}" ry="{rx*0.12:.1f}" fill="none" stroke="#cfe0ea" stroke-width="0.8" opacity="0.45"/>')
    for lon in range(-60, 61, 30):
        rx = 150 * abs(math.sin(math.radians(lon)))
        g.append(f'<ellipse cx="300" cy="200" rx="{rx:.1f}" ry="150" fill="none" stroke="#cfe0ea" stroke-width="0.8" opacity="0.45"/>')
    g.append('</g>'); o += g
    o.append(C(300, 200, 150, 'none', ' stroke="#cfe0ea" stroke-width="1.5" opacity="0.6"'))
    hub = (340, 248)
    for x, y in [(230, 130), (250, 300), (410, 150), (180, 210), (430, 290), (300, 110)]:
        mx, my = (x + hub[0]) / 2, (y + hub[1]) / 2 - 40
        o.append(P(f'M{hub[0]} {hub[1]} Q{mx} {my} {x} {y}', 'none', ' stroke="#f0b35a" stroke-width="1.6" stroke-dasharray="4 4"'))
        o.append(C(x, y, 4, '#f6f4ef'))
    o += [C(*hub, 7, '#c8432b'), C(*hub, 13, '#c8432b', ' opacity="0.3"')]
    return ''.join(o)

def haze():
    rnd = random.Random(8)
    o = [f'<defs>{grad("sky", [(0, "#c98a4b"), (0.6, "#ddb07a"), (1, "#cdbb9c")])}</defs>', R(0, 0, 600, 400, 'url(#sky)'), C(410, 120, 34, '#e85d33', ' opacity="0.85"')]
    for i in range(6):
        y = 90 + i * 34
        o.append(P(f'M-20 {y} Q150 {y - 20} 300 {y + 6} T620 {y - 4} L620 {y + 30} Q450 {y + 40} 300 {y + 26} T-20 {y + 28}Z', '#e9d3b4', f' opacity="{0.18 + i*0.05:.2f}"'))
    o.append(P(f'M-20 250 L{ridge(rnd, 240, 6, 30)} L620 400 L-20 400Z', '#5a4a3a'))
    o.append(P('M-20 300 Q300 284 620 304 L620 330 Q300 312 -20 328Z', '#3d4e52'))
    o.append(R(250, 296, 14, 30, '#6b5641'))
    for _ in range(22):
        x = rnd.uniform(0, 600); h = rnd.uniform(60, 150); base = 300 if rnd.random() < 0.5 else 360
        o.append(R(x, base - h, rnd.uniform(3, 6), h, '#2e2722'))
        if rnd.random() < 0.6: o.append(P(f'M{x + 2:.1f} {base - h*0.6:.1f} l{rnd.choice([-1, 1]) * rnd.uniform(10, 22):.1f} {-rnd.uniform(8, 18):.1f}', 'none', ' stroke="#2e2722" stroke-width="2.5"'))
    o.append(P('M-20 360 Q300 340 620 362 L620 400 L-20 400Z', '#4a3c30'))
    for _ in range(14):
        x = rnd.uniform(0, 600); y = rnd.uniform(330, 390)
        o.append(C(x, y, rnd.uniform(1.5, 3), '#ef7d3c', ' opacity="0.8"'))
    return ''.join(o)

def economy():
    rnd = random.Random(7)
    o = [f'<defs>{grad("sky", [(0, "#24344e"), (0.7, "#c9875d"), (1, "#e3a873")])}</defs>', R(0, 0, 600, 400, 'url(#sky)')]
    x = 0
    while x < 600:
        w = rnd.choice([30, 38, 46, 54]); h = rnd.randint(70, 190)
        col = rnd.choice(['#1d2638', '#222d42', '#1a2232'])
        o.append(R(x, 250 - h, w - 3, h + 10, col))
        for wy in range(int(250 - h + 8), 250, 12):
            for wx in range(int(x + 4), int(x + w - 8), 8):
                if rnd.random() < 0.25: o.append(R(wx, wy, 4, 5, '#f1c88c'))
        x += w
    o.append(R(0, 250, 600, 150, '#2b3a4a'))
    for x0 in [60, 200, 470]:
        o += [R(x0, 170, 8, 110, '#c94b32'), R(x0 + 40, 170, 8, 110, '#c94b32'), R(x0 - 30, 166, 120, 8, '#c94b32'), R(x0 + 4, 150, 40, 18, '#c94b32')]
    colors = ['#c8432b', '#2f6f8f', '#d39a3b', '#3f7f5f', '#8d5a9e', '#e8e2d6']
    for row in range(4):
        for col in range(18):
            if rnd.random() < 0.85:
                o.append(R(20 + col * 31, 330 - row * 13, 29, 12, rnd.choice(colors), ' stroke="#1f2a36" stroke-width="0.6"'))
    o.append(R(0, 344, 600, 56, '#1f2a36'))
    for x in range(0, 600, 26): o.append(R(x, 368, 14, 3, '#f2e3a0'))
    for x in range(10, 600, 37): o += [R(x, 356, 6, 3, '#ffd27a'), R(x + 16, 380, 6, 3, '#e85d33')]
    return ''.join(o)

def population():
    rnd = random.Random(4)
    o = [f'<defs>{grad("sky", [(0, "#d7e4ea"), (1, "#f1ece2")])}</defs>', R(0, 0, 600, 400, 'url(#sky)')]
    x = 0
    while x < 600:
        w = rnd.choice([26, 34, 42]); h = rnd.randint(60, 150)
        o.append(R(x, 190 - h, w - 4, h, rnd.choice(['#9aa7b4', '#a7b2bd', '#8f9cab'])))
        x += w + rnd.randint(4, 30)
    o += [C(470, 150, 26, '#e3d9bf'), R(444, 150, 52, 40, '#efe7d2'), R(496, 104, 6, 86, '#efe7d2'), C(499, 100, 5, '#c9a24a')]
    o.append(R(0, 186, 600, 10, '#6a6f75'))
    for x in range(10, 600, 60): o.append(R(x, 196, 10, 40, '#7a7f85'))
    o += [R(40, 162, 280, 24, '#e8e3d8'), R(40, 178, 280, 4, '#c8432b')]
    for x in range(52, 320, 22): o.append(R(x, 167, 14, 7, '#425a6e'))
    roofs = ['#b5543a', '#c56a46', '#a84a33', '#c97c55', '#9c4630']
    for row in range(7):
        y = 214 + row * 27
        x = -30 + (row % 2) * 22
        while x < 620:
            w = rnd.randint(36, 56)
            o.append(R(x + 4, y + 10, w - 8, 22, rnd.choice(['#efe3cf', '#e6d6bd', '#f3ead9', '#dcd0bd'])))
            o.append(P(f'M{x} {y + 12} L{x + w/2:.1f} {y - 6} L{x + w} {y + 12}Z', rnd.choice(roofs)))
            if rnd.random() < 0.4: o.append(R(x + w/2 - 4, y + 18, 8, 8, '#5b6b78'))
            x += w + 2
    return ''.join(o)

def timezones():
    o = [f'<defs>{grad("a", [(0, "#f2c99a"), (1, "#f6e3c4")])}{grad("b", [(0, "#a9d0e6"), (1, "#e7f1f2")])}{grad("c", [(0, "#e5965f"), (1, "#f2c79b")])}</defs>']
    for i, g in enumerate(['a', 'b', 'c']): o.append(R(i * 200, 0, 200, 400, f'url(#{g})'))
    o.append(R(0, 260, 600, 140, '#4f7f95'))
    for y in range(272, 400, 12):
        o.append(P(f'M0 {y} ' + ' '.join(f'Q{x + 12} {y - 4} {x + 24} {y}' for x in range(0, 600, 24)), 'none', ' stroke="#86aebd" stroke-width="1.2" opacity="0.6"'))
    for d in ['M20 262 Q70 236 130 250 Q160 240 190 262Z', 'M230 262 Q260 244 300 252 Q330 246 360 262Z', 'M400 262 Q440 236 500 246 Q550 240 590 262Z', 'M150 300 Q180 290 210 300Z', 'M450 310 Q490 296 530 310Z']:
        o.append(P(d, '#6f8f5a'))
    for x in [200, 400]: o.append(R(x - 1, 0, 2, 400, '#f6f4ef', ' opacity="0.8"'))
    for i, hour in enumerate([7, 8, 9]):
        cx, cy = 100 + i * 200, 130
        o += [C(cx, cy, 52, '#f6f4ef'), C(cx, cy, 52, 'none', ' stroke="#0f1e33" stroke-width="4"')]
        for t in range(12):
            a = math.radians(t * 30)
            r1, r2 = (40, 47) if t % 3 else (36, 47)
            o.append(f'<line x1="{cx + r1*math.sin(a):.1f}" y1="{cy - r1*math.cos(a):.1f}" x2="{cx + r2*math.sin(a):.1f}" y2="{cy - r2*math.cos(a):.1f}" stroke="#0f1e33" stroke-width="{3 if t % 3 == 0 else 1.6}"/>')
        ah = math.radians(hour * 30)
        o.append(f'<line x1="{cx}" y1="{cy}" x2="{cx + 24*math.sin(ah):.1f}" y2="{cy - 24*math.cos(ah):.1f}" stroke="#0f1e33" stroke-width="5" stroke-linecap="round"/>')
        o.append(f'<line x1="{cx}" y1="{cy}" x2="{cx}" y2="{cy - 38}" stroke="#0f1e33" stroke-width="3" stroke-linecap="round"/>')
        o.append(C(cx, cy, 4, '#c8432b'))
    return ''.join(o)

def mudik():
    rnd = random.Random(21)
    o = [f'<defs>{grad("sky", [(0, "#f2b98a"), (0.6, "#f7dcb6"), (1, "#f3e7cf")])}</defs>', R(0, 0, 600, 400, 'url(#sky)'), C(470, 120, 34, '#fbe9c9')]
    o.append(P(f'M-20 200 L{ridge(rnd, 160, 20, 40)} L620 230 L-20 230Z', '#9aa88a'))
    o.append(P(f'M-20 215 L{ridge(rnd, 190, 12, 50)} L620 240 L-20 240Z', '#7f9472'))
    o += [R(96, 168, 26, 40, '#d9cdb5'), C(109, 168, 14, '#3f8a6c'), R(107, 140, 4, 16, '#d9cdb5'), C(109, 138, 3, '#3f8a6c')]
    o.append(P('M0 240 L600 240 L600 400 L0 400Z', '#8fa178'))
    o.append(P('M250 240 L350 240 L560 400 L40 400Z', '#5b5f66'))
    o.append(P('M298 240 L302 240 L310 400 L290 400Z', '#e9e2d0', ' opacity="0.0"'))
    for i in range(9):
        t = i / 9; y = 244 + t * t * 150; w = 2 + t * 6
        o.append(R(300 - w / 2, y, w, 4 + t * 12, '#f3ead7'))
    o.append(P('M250 240 L246 240 L30 400 L40 400Z', '#e9e2d0'))
    o.append(P('M350 240 L354 240 L570 400 L560 400Z', '#e9e2d0'))
    cars = [(268, 252, 0.25, '#c8432b'), (318, 258, 0.3, '#2f5d8a'), (250, 280, 0.45, '#e8b04a'), (330, 290, 0.5, '#f2f0ea'), (205, 330, 0.75, '#3f8a6c'), (370, 340, 0.8, '#c8432b'), (150, 375, 1.0, '#2f5d8a'), (410, 382, 1.05, '#d9a441')]
    for x, y, s, c in cars:
        w, h = 46 * s, 22 * s
        o += [R(x - w / 2, y - h, w, h, c, ' rx="3"'), R(x - w / 2 + 5 * s, y - h - 10 * s, w - 10 * s, 12 * s, c, ' rx="3"'), R(x - w / 2 + 7 * s, y - h - 8 * s, w - 14 * s, 8 * s, '#cfe0ea', ' opacity="0.85"')]
        o += [C(x - w / 3, y, 4 * s, '#2b2b2b'), C(x + w / 3, y, 4 * s, '#2b2b2b'), R(x - w / 2 + 2, y - h + 4 * s, 4 * s, 3 * s, '#ffe7a3'), R(x + w / 2 - 2 - 4 * s, y - h + 4 * s, 4 * s, 3 * s, '#ffe7a3')]
    bx, by = 470, 300
    o += [R(bx - 40, by - 54, 80, 54, '#4d7fa8', ' rx="5"'), *[R(bx - 34 + i * 17, by - 46, 13, 14, '#dfeaf1') for i in range(4)], C(bx - 24, by, 7, '#2b2b2b'), C(bx + 24, by, 7, '#2b2b2b')]
    return ''.join(o)

def merdeka():
    o = [f'<defs>{grad("sky", [(0, "#9cc7e3"), (1, "#e8f1f4")])}</defs>', R(0, 0, 600, 400, 'url(#sky)')]
    for cx, cy, r in [(90, 70, 18), (112, 62, 24), (138, 70, 16), (420, 48, 14), (440, 42, 20)]: o.append(C(cx, cy, r, '#ffffff', ' opacity="0.9"'))
    o.append(R(0, 270, 600, 130, '#7fa36a'))
    o.append(P('M150 270 L150 200 L450 200 L450 270Z', '#f4f1ea'))
    o.append(P('M136 200 L300 160 L464 200Z', '#e6e0d2'))
    for x in range(168, 440, 32): o.append(R(x, 206, 12, 64, '#ffffff'))
    o += [R(130, 270, 340, 8, '#d9d2c2')]
    o += [R(296, 40, 6, 232, '#8a8a8a'), C(299, 38, 5, '#d9a441')]
    wave = 'M302 52 C340 44 370 64 410 56 L410 82 C370 90 340 70 302 78Z'
    o += [P(wave, '#c8382e'), P('M302 78 C340 70 370 90 410 82 L410 108 C370 116 340 96 302 104Z', '#f6f4ef')]
    for i in range(0, 600, 30):
        o.append(P(f'M{i} 150 Q{i + 15} 164 {i + 30} 150', 'none', ' stroke="#8a8a8a" stroke-width="1"'))
        o.append(P(f'M{i + 4} 152 L{i + 15} 172 L{i + 26} 152Z', '#c8382e' if (i // 30) % 2 == 0 else '#f6f4ef'))
    rnd = random.Random(8)
    for row, y in enumerate([330, 352, 374]):
        for x in range(10, 600, 22):
            xx = x + (11 if row % 2 else 0) + rnd.uniform(-3, 3)
            c = rnd.choice(['#3f3a33', '#5a4b3c', '#2f2a26'])
            o += [C(xx, y - 10, 6, c), R(xx - 8, y - 4, 16, 26, rnd.choice(['#f6f4ef', '#c8382e', '#e9e2d0', '#d9d2c2']), ' rx="5"')]
    return ''.join(o)

def ballot():
    o = [f'<defs>{grad("bg", [(0, "#e6e1d6"), (1, "#d6d0c3")])}</defs>', R(0, 0, 600, 400, 'url(#bg)')]
    o.append(R(0, 300, 600, 100, '#b9b1a1'))
    o += [P('M180 160 L420 160 L440 310 L160 310Z', '#f6f4ef'), P('M180 160 L420 160 L410 140 L190 140Z', '#e4ded0'), R(250, 146, 100, 8, '#2b2b2b', ' rx="3"')]
    o.append(R(160, 300, 280, 10, '#d9d2c2'))
    o += [R(230, 210, 140, 40, '#0f1e33', ' rx="4"'), P('M246 230 L262 230', 'none', ' stroke="#f6f4ef" stroke-width="4"')]
    for i, c in enumerate(['#c8432b', '#3f8a6c', '#2f5d8a']):
        o.append(R(280 + i * 26, 222, 18, 18, c, ' rx="3"'))
    o += [P('M270 60 L340 54 L346 130 L276 136Z', '#ffffff', ' stroke="#c9c2b2" stroke-width="1.5"'), P('M292 92 L304 106 L328 74', 'none', ' stroke="#c8432b" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"')]
    for i in range(3):
        o.append(R(282, 112 + 0 * i, 0, 0, '#000'))
    o += [P('M470 330 C470 280 486 250 500 250 C514 250 520 270 516 300 L530 300 C546 300 548 330 530 336 L480 344Z', '#c99a72'), R(496, 232, 14, 30, '#c99a72', ' rx="7"'), R(496, 232, 14, 12, '#5b3a8c', ' rx="6"')]
    return ''.join(o)

def asean():
    o = [f'<defs>{grad("sea", [(0, "#2f5d78"), (1, "#1d3f57")])}</defs>', R(0, 0, 600, 400, 'url(#sea)')]
    for y in range(20, 400, 26):
        o.append(P(f'M0 {y} ' + ' '.join(f'Q{x + 15} {y - 5} {x + 30} {y}' for x in range(0, 600, 30)), 'none', ' stroke="#4b7b95" stroke-width="1" opacity="0.4"'))
    cx, cy, r = 300, 200, 130
    pts = [(cx + r * math.sin(math.radians(i * 360 / 11)), cy - r * math.cos(math.radians(i * 360 / 11))) for i in range(11)]
    for i, (x, y) in enumerate(pts):
        for j in range(i + 1, 11):
            if (j - i) in (1, 10): o.append(f'<line x1="{x:.1f}" y1="{y:.1f}" x2="{pts[j][0]:.1f}" y2="{pts[j][1]:.1f}" stroke="#d9c58a" stroke-width="2" opacity="0.7"/>')
    for i, (x, y) in enumerate(pts):
        new = i == 10
        o.append(C(x, y, 22 if new else 18, '#f2c14e' if new else '#f6f4ef'))
        o.append(C(x, y, 10 if new else 8, '#c8432b' if new else '#2f5d78'))
    o += [C(cx, cy, 52, '#f6f4ef', ' opacity="0.12"'), C(cx, cy, 34, '#f6f4ef', ' opacity="0.18"')]
    for a in range(10):
        ang = math.radians(a * 36)
        o.append(P(f'M{cx} {cy} L{cx + 30*math.cos(ang - 0.12):.1f} {cy + 30*math.sin(ang - 0.12):.1f} L{cx + 30*math.cos(ang + 0.12):.1f} {cy + 30*math.sin(ang + 0.12):.1f}Z', '#f2c14e', ' opacity="0.85"'))
    return ''.join(o)

def natuna():
    rnd = random.Random(3)
    o = [f'<defs>{grad("sky", [(0, "#bcd6e4"), (1, "#eef3ef")])}{grad("sea", [(0, "#3f7a8f"), (1, "#24516a")])}</defs>', R(0, 0, 600, 400, 'url(#sky)')]
    for cx, cy, r in [(480, 70, 20), (502, 62, 26), (528, 72, 16)]: o.append(C(cx, cy, r, '#ffffff', ' opacity="0.9"'))
    o.append(R(0, 190, 600, 210, 'url(#sea)'))
    for y in range(200, 400, 12):
        o.append(P(f'M0 {y} ' + ' '.join(f'Q{x + 12} {y - 4} {x + 24} {y}' for x in range(0, 600, 24)), 'none', ' stroke="#6f9fb0" stroke-width="1.1" opacity="0.55"'))
    o += [P('M40 192 Q90 150 150 160 Q190 150 230 192Z', '#5f8a55'), P('M70 192 Q100 168 130 176 Q160 168 180 192Z', '#719c63'), P('M250 192 Q275 178 300 192Z', '#6f8f5a')]
    o.append(P('M0 250 L600 300', 'none', ' stroke="#f2c14e" stroke-width="2.5" stroke-dasharray="10 8" opacity="0.9"'))
    o += [P('M380 268 L500 268 L488 290 L392 290Z', '#e9e5dc'), R(420, 246, 46, 22, '#f6f4ef'), R(430, 236, 22, 10, '#d9d2c2'), R(440, 222, 3, 14, '#8a8a8a'), R(392, 276, 96, 4, '#c8382e')]
    for x, y, s in [(120, 330, 1.0), (230, 352, 0.8), (520, 360, 0.9)]:
        o += [P(f'M{x - 26*s:.1f} {y} L{x + 26*s:.1f} {y} L{x + 18*s:.1f} {y + 10*s:.1f} L{x - 18*s:.1f} {y + 10*s:.1f}Z', '#a0522d'), R(x - 2 * s, y - 30 * s, 2.5 * s, 30 * s, '#5b4a39'), P(f'M{x:.1f} {y - 28*s:.1f} L{x + 20*s:.1f} {y - 6*s:.1f} L{x:.1f} {y - 6*s:.1f}Z', '#f2e8d2')]
    return ''.join(o)

def whoosh():
    rnd = random.Random(14)
    o = [f'<defs>{grad("sky", [(0, "#cfe3ee"), (1, "#f3efe4")])}{grad("train", [(0, "#ffffff"), (1, "#d9dde2")], 0, 1)}</defs>', R(0, 0, 600, 400, 'url(#sky)')]
    o.append(P(f'M-20 200 L{ridge(rnd, 140, 26, 40)} L620 240 L-20 240Z', '#9fb3a6'))
    o.append(P(f'M-20 230 L{ridge(rnd, 190, 14, 50)} L620 260 L-20 260Z', '#86a07f'))
    colors = ['#93ab5a', '#a7bb67', '#86a352', '#b7c574']
    for i, y in enumerate(range(250, 400, 22)): o.append(R(0, y, 600, 22, colors[i % 4]))
    for i, y in enumerate(range(250, 400, 22)): o.append(P(f'M0 {y} L600 {y}', 'none', ' stroke="#e9edc9" stroke-width="1.2" opacity="0.6"'))
    o.append(R(0, 232, 600, 14, '#c9c3b6'))
    for x in range(30, 600, 80): o += [R(x, 246, 14, 160, '#b9b2a4'), R(x - 6, 246, 26, 6, '#a9a293')]
    o.append(P('M60 232 L470 232 C520 232 560 220 580 204 L580 196 C560 188 520 186 480 186 L60 186Z', 'url(#train)'))
    o.append(P('M60 214 L470 214 C510 214 545 208 570 200', 'none', ' stroke="#c8382e" stroke-width="5"'))
    for x in range(80, 440, 34): o.append(R(x, 194, 24, 12, '#2c3e50', ' rx="2"'))
    o.append(P('M486 192 C520 190 548 192 566 198 L560 204 C540 200 510 198 486 200Z', '#2c3e50'))
    for i, y in enumerate([196, 208, 222]): o.append(P(f'M{10 + i*6} {y} L{50 - i*4} {y}', 'none', ' stroke="#8fa3b0" stroke-width="2.4" stroke-linecap="round" opacity="0.8"'))
    return ''.join(o)

def komodo():
    rnd = random.Random(9)
    o = [f'<defs>{grad("sky", [(0, "#a7cde0"), (1, "#f0ead8")])}{grad("sea", [(0, "#5aa0b0"), (1, "#3f8296")])}</defs>', R(0, 0, 600, 400, 'url(#sky)')]
    o.append(R(0, 150, 600, 60, 'url(#sea)'))
    o.append(P(f'M-20 190 Q120 110 230 150 Q330 90 460 140 Q540 120 620 160 L620 220 L-20 220Z', '#b7a26c'))
    o.append(P(f'M-20 215 Q150 170 300 200 Q450 175 620 205 L620 400 L-20 400Z', '#cdb57a'))
    for x, y, s in [(90, 190, 1.0), (510, 186, 0.9), (560, 200, 0.7)]:
        o.append(R(x - 2 * s, y - 70 * s, 4 * s, 70 * s, '#6d5a43'))
        for ang in range(0, 360, 30):
            dx, dy = math.cos(math.radians(ang)) * 18 * s, math.sin(math.radians(ang)) * 18 * s
            o.append(P(f'M{x:.1f} {y - 70*s:.1f} L{x + dx:.1f} {y - 70*s + dy:.1f}', 'none', f' stroke="#5f7a45" stroke-width="{3*s:.1f}" stroke-linecap="round"'))
    for i in range(40):
        x, y = rnd.uniform(0, 600), rnd.uniform(230, 400)
        o.append(P(f'M{x:.1f} {y:.1f} l2 -8 l2 8', 'none', ' stroke="#a8925c" stroke-width="1.2"'))
    body = '#6a6152'
    o.append(P('M150 330 C220 300 300 296 360 304 C400 310 430 316 452 322 C470 326 484 330 480 340 C470 348 440 346 410 342 C380 340 330 344 280 348 C220 352 180 352 120 360 C80 366 40 372 20 374 C50 362 100 346 150 330Z', body))
    o.append(P('M452 322 C470 314 492 314 506 322 C514 328 512 336 500 338 C490 340 482 338 480 340Z', '#5d5547'))
    o.append(P('M506 330 L540 334 L506 336', 'none', ' stroke="#d9a441" stroke-width="2" stroke-linecap="round"'))
    o += [C(492, 322, 2.2, '#1f1c18')]
    for x, d in [(250, -1), (300, 1), (390, -1), (430, 1)]:
        o.append(P(f'M{x} 340 L{x + 8*d} 364 L{x + 20*d} 368', 'none', f' stroke="{body}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"'))
    for i in range(18):
        x = 180 + i * 16
        o.append(C(x, 318 + rnd.uniform(-4, 4), 2, '#7d725f'))
    return ''.join(o)

def inflation():
    o = [f'<defs>{grad("bg", [(0, "#f3e7cf"), (1, "#ead9b8")])}</defs>', R(0, 0, 600, 400, 'url(#bg)')]
    o += [P('M40 60 L560 60 L590 110 L10 110Z', '#c8432b'), *[P(f'M{10 + i*58} 110 Q{39 + i*58} 130 {68 + i*58} 110Z', '#c8432b') for i in range(10)]]
    for i in range(0, 600, 58): o.append(P(f'M{10 + i} 60 L{40 + i} 110', 'none', ' stroke="#f6f4ef" stroke-width="10" opacity="0.5"'))
    o.append(R(40, 250, 520, 150, '#8a6a48'))
    o.append(R(30, 240, 540, 16, '#a07a52'))
    baskets = [(110, '#d23a2a', 'chili'), (240, '#a8456b', 'shallot'), (370, '#f2efe6', 'egg'), (490, '#e0b04a', 'rice')]
    rnd = random.Random(4)
    for x, c, kind in baskets:
        o.append(P(f'M{x - 54} 230 L{x + 54} 230 L{x + 44} 280 L{x - 44} 280Z', '#b58b55'))
        for row in range(3):
            o.append(P(f'M{x - 50 + row*3} {244 + row*12} L{x + 50 - row*3} {244 + row*12}', 'none', ' stroke="#8f6a3e" stroke-width="2"'))
        for k in range(16):
            px, py = x + rnd.uniform(-44, 44), 226 + rnd.uniform(-14, 4)
            if kind == 'chili': o.append(P(f'M{px:.1f} {py:.1f} q8 -4 14 4', 'none', f' stroke="{c}" stroke-width="5" stroke-linecap="round"'))
            elif kind == 'rice': o.append(C(px, py, 3, c))
            else: o.append(C(px, py, 7 if kind == 'egg' else 6, c))
        o += [R(x - 22, 170, 44, 26, '#f6f4ef', ' rx="3"'), P(f'M{x} 196 L{x} 212', 'none', ' stroke="#6b6b6b" stroke-width="1.5"')]
        o.append(P(f'M{x - 12} 188 L{x} 176 L{x + 12} 188', 'none', ' stroke="#c8432b" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"'))
    o.append(P('M60 350 L180 330 L300 340 L420 300 L540 270', 'none', ' stroke="#f6f4ef" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"'))
    o.append(P('M528 262 L548 266 L536 284Z', '#f6f4ef'))
    return ''.join(o)

SCENES = {'rice': rice, 'nickel': nickel, 'parliament': parliament, 'volcano': volcano, 'nusantara': nusantara, 'world': world, 'haze': haze, 'economy': economy, 'population': population, 'timezones': timezones, 'mudik': mudik, 'merdeka': merdeka, 'ballot': ballot, 'asean': asean, 'natuna': natuna, 'whoosh': whoosh, 'komodo': komodo, 'inflation': inflation}

if __name__ == '__main__':
    import sys, os
    out = sys.argv[1]
    for name, fn in SCENES.items():
        with open(os.path.join(out, f'{name}.svg'), 'w') as f:
            f.write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400" width="1800" height="1200" preserveAspectRatio="xMidYMid slice">{fn()}</svg>')
    print('ok', len(SCENES))
