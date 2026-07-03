#!/usr/bin/env python3
"""Generate ultra-high-quality 3D models as embedded GLTF JSON + JS module."""

import json, base64, struct, math, os, sys, random

class Vec3:
    __slots__ = ('x','y','z')
    def __init__(self, x=0, y=0, z=0): self.x=x; self.y=y; self.z=z
    def __add__(a,b): return Vec3(a.x+b.x, a.y+b.y, a.z+b.z)
    def __sub__(a,b): return Vec3(a.x-b.x, a.y-b.y, a.z-b.z)
    def __mul__(a,s): return Vec3(a.x*s, a.y*s, a.z*s)
    def __truediv__(a,s): return Vec3(a.x/s, a.y/s, a.z/s)
    def dot(a,b): return a.x*b.x + a.y*b.y + a.z*b.z
    def length(a): return math.sqrt(a.dot(a))
    def norm(a):
        l = a.length()
        return Vec3(a.x/l, a.y/l, a.z/l) if l > 0 else Vec3(0,1,0)
    def cross(a,b):
        return Vec3(a.y*b.z - a.z*b.y, a.z*b.x - a.x*b.z, a.x*b.y - a.y*b.x)

def noise3(x, y, z):
    """Simple hash-based 3D noise."""
    n = math.sin(x*12.9898 + y*78.233 + z*45.164)*43758.5453
    return n - math.floor(n)

def smooth_noise(x, y, z):
    """Smooth interpolated noise."""
    ix, iy, iz = int(math.floor(x)), int(math.floor(y)), int(math.floor(z))
    fx, fy, fz = x-ix, y-iy, z-iz
    fx = fx*fx*(3-2*fx); fy = fy*fy*(3-2*fy); fz = fz*fz*(3-2*fz)
    def n(x,y,z): return noise3(x*0.1, y*0.1, z*0.1)
    v = (n(ix,iy,iz)*(1-fx)*(1-fy)*(1-fz) + n(ix+1,iy,iz)*fx*(1-fy)*(1-fz) +
         n(ix,iy+1,iz)*(1-fx)*fy*(1-fz) + n(ix+1,iy+1,iz)*fx*fy*(1-fz) +
         n(ix,iy,iz+1)*(1-fx)*(1-fy)*fz + n(ix+1,iy,iz+1)*fx*(1-fy)*fz +
         n(ix,iy+1,iz+1)*(1-fx)*fy*fz + n(ix+1,iy+1,iz+1)*fx*fy*fz)
    return v

def fbm(x, y, z, octaves=3):
    """Fractal Brownian Motion."""
    v = 0; amp = 0.5; freq = 1
    for _ in range(octaves):
        v += amp * smooth_noise(x*freq, y*freq, z*freq)
        amp *= 0.5; freq *= 2
    return v

class Mesh:
    def __init__(self, name):
        self.name = name
        self.verts = []  # Vec3
        self.norms = []  # Vec3
        self.uvs = []    # (u,v)
        self.tris = []   # (i,j,k)
    
    def add_vert(self, v, n=None, uv=(0,0)):
        idx = len(self.verts)
        self.verts.append(v)
        self.norms.append(n or Vec3(0,1,0))
        self.uvs.append(uv)
        return idx
    
    def add_tri(self, a, b, c):
        self.tris.append((a,b,c))
    
    def compute_normals(self):
        face_norms = []
        for a,b,c in self.tris:
            v0 = self.verts[a]; v1 = self.verts[b]; v2 = self.verts[c]
            n = (v1-v0).cross(v2-v0).norm()
            face_norms.append(n)
        for i in range(len(self.verts)):
            n = Vec3(); count = 0
            for j, (a,b,c) in enumerate(self.tris):
                if i in (a,b,c): n = n + face_norms[j]; count += 1
            self.norms[i] = (n / count).norm() if count else Vec3(0,1,0)
    
    def to_gltf_data(self):
        """Returns: vertices_floatarray, normals_floatarray, uvs_floatarray, indices_uint16array"""
        v = []; n = []; u = []; idx = []
        for p in self.verts: v.extend([p.x, p.y, p.z])
        for p in self.norms: n.extend([p.x, p.y, p.z])
        for uu in self.uvs: u.extend(list(uu))
        for t in self.tris: idx.extend(t)
        return v, n, u, idx

def encode_buffer(data_f32, data_u16=None):
    """Encode float32 array (and optional uint16 array) as base64 data URI."""
    buf = b''
    for f in data_f32: buf += struct.pack('<f', f)
    idx_data = b''
    if data_u16:
        for i in data_u16: idx_data += struct.pack('<H', i)
    combined = buf + idx_data
    b64 = base64.b64encode(combined).decode('ascii')
    return b64, len(buf), len(idx_data), len(combined)

def build_gltf(mesh, base_color, metallic, roughness, emissive=None, alpha=1.0, double_sided=True):
    """Build complete GLTF JSON dict from a Mesh."""
    v, n, u, idx = mesh.to_gltf_data()
    
    vert_count = len(v) // 3
    tri_count = len(idx) // 3
    vert_bytes = vert_count * 3 * 4
    uv_bytes = vert_count * 2 * 4
    idx_bytes = len(idx) * 2
    pos_end = vert_bytes
    norm_end = vert_bytes * 2
    uv_end = vert_bytes * 2 + uv_bytes

    buf_data = b''
    for f in v: buf_data += struct.pack('<f', f)
    for f in n: buf_data += struct.pack('<f', f)
    for f in u: buf_data += struct.pack('<f', f)
    for i in idx: buf_data += struct.pack('<H', i)
    
    b64 = base64.b64encode(buf_data).decode('ascii')
    total = len(buf_data)
    
    io = uv_end

    gltf = {
        "asset": {"version": "2.0", "generator": "BloodstainAR-Pro"},
        "scene": 0, "scenes": [{"nodes": [0]}],
        "nodes": [{"mesh": 0}],
        "meshes": [{"primitives": [{
            "attributes": {
                "POSITION": 0,
                "NORMAL": 1,
                "TEXCOORD_0": 2
            },
            "indices": 3,
            "material": 0
        }]}],
        "accessors": [
            {"bufferView": 0, "componentType": 5126, "count": vert_count, "type": "VEC3", "min": [-1]*3, "max": [1]*3},
            {"bufferView": 1, "componentType": 5126, "count": vert_count, "type": "VEC3"},
            {"bufferView": 2, "componentType": 5126, "count": vert_count, "type": "VEC2"},
            {"bufferView": 3, "componentType": 5123, "count": len(idx), "type": "SCALAR"}
        ],
        "bufferViews": [
            {"buffer": 0, "byteOffset": 0, "byteLength": vert_bytes, "target": 34962},
            {"buffer": 0, "byteOffset": pos_end, "byteLength": vert_bytes, "target": 34962},
            {"buffer": 0, "byteOffset": norm_end, "byteLength": uv_bytes, "target": 34962},
            {"buffer": 0, "byteOffset": io, "byteLength": idx_bytes, "target": 34963}
        ],
        "buffers": [{"uri": f"data:application/octet-stream;base64,{b64}", "byteLength": total}],
        "materials": [{
            "pbrMetallicRoughness": {
                "baseColorFactor": list(base_color) + [alpha],
                "metallicFactor": metallic,
                "roughnessFactor": roughness
            },
            "doubleSided": double_sided,
            "alphaMode": "BLEND" if alpha < 1 else "OPAQUE"
        }]
    }
    if emissive:
        gltf["materials"][0]["emissiveFactor"] = list(emissive)
    
    # Compute bounds
    xs = [mesh.verts[i].x for i in range(len(mesh.verts))]
    ys = [mesh.verts[i].y for i in range(len(mesh.verts))]
    zs = [mesh.verts[i].z for i in range(len(mesh.verts))]
    gltf["accessors"][0]["min"] = [min(xs), min(ys), min(zs)]
    gltf["accessors"][0]["max"] = [max(xs), max(ys), max(zs)]
    
    return gltf

def gltf_to_js_var(gltf, var_name):
    """Convert GLTF dict to a JavaScript variable string."""
    js = json.dumps(gltf, indent=None)
    return f"const {var_name} = {js};\n"

# ═══════════════════════════════════════════════════
#  MODEL GENERATORS
# ═══════════════════════════════════════════════════

def gen_hemisphere(radius, segs, top=True, offset=0):
    """Generate a hemisphere mesh."""
    m = Mesh("hemisphere")
    for ring in range(segs//2 + 1):
        v = ring / (segs//2)
        theta = v * math.pi/2 if top else v * math.pi/2 + math.pi/2
        r = math.sin(theta) * radius
        y = math.cos(theta) * radius * (-1 if not top else 1)
        if y == 0: y = 0
        for i in range(segs):
            phi = (i / segs) * math.pi * 2
            x = r * math.cos(phi)
            z = r * math.sin(phi)
            n = Vec3(x, y, z).norm()
            m.add_vert(Vec3(x, y + offset, z), n, (i/segs, v))
    for ring in range(segs//2):
        for i in range(segs):
            a = ring * (segs+1) + i
            b = a + segs + 1
            m.add_tri(a, b, a+1)
            m.add_tri(b, b+1, a+1)
    return m

def gen_sphere(radius, segs):
    m = Mesh("sphere")
    for ring in range(segs + 1):
        v = ring / segs
        theta = v * math.pi
        r = math.sin(theta) * radius
        y = math.cos(theta) * radius
        for i in range(segs + 1):
            phi = (i / segs) * math.pi * 2
            x = r * math.cos(phi)
            z = r * math.sin(phi)
            n = Vec3(x, y, z).norm()
            m.add_vert(Vec3(x, y, z), n, (i/segs, v))
    for ring in range(segs):
        for i in range(segs):
            a = ring * (segs+1) + i
            b = a + segs + 1
            m.add_tri(a, b, a+1)
            m.add_tri(b, b+1, a+1)
    return m

def gen_rbc(radius=1.5, segs=64):
    """Ultra-realistic red blood cell - biconcave disc with surface detail."""
    m = Mesh("rbc")
    for ring in range(segs + 1):
        v = ring / segs
        theta = v * math.pi
        r_raw = math.sin(theta)
        # Biconcave: sin(2*theta) gives the dimple
        dimple = abs(math.sin(theta * 2)) * 0.45
        r = r_raw * (1 - dimple * 0.35) * radius
        y = math.cos(theta) * radius * 0.35
        
        # Surface noise
        noise_amp = 0.008
        ns = fbm(r * 20, y * 15, 0) * noise_amp
        
        for i in range(segs + 1):
            phi = (i / segs) * math.pi * 2
            x = r * math.cos(phi)
            z = r * math.sin(phi)
            
            # Apply noise
            x += math.cos(phi) * ns
            z += math.sin(phi) * ns
            y += math.sin(theta * 4 + phi * 3) * 0.003
            
            p = Vec3(x, y, z)
            n = p.norm()
            if abs(y) > radius * 0.3:
                n.y *= 0.6; n = n.norm()
            m.add_vert(p, n, (i/segs, v))
    
    for ring in range(segs):
        for i in range(segs):
            a = ring * (segs+1) + i
            b = a + segs + 1
            m.add_tri(a, b, a+1)
            m.add_tri(b, b+1, a+1)
    m.compute_normals()
    return m

def gen_wbc(radius=1.8, segs=48):
    """White blood cell with lobed nucleus - multi-surface model."""
    m = Mesh("wbc")
    
    main = gen_sphere(radius, segs)
    # Add lobe bumps
    for ring in range(segs + 1):
        v = ring / segs
        for i in range(segs + 1):
            idx = ring * (segs+1) + i
            phi = (i / segs) * math.pi * 2
            theta = v * math.pi
            p = main.verts[idx]
            
            # Multiple lobe bumps around surface
            bump = 0
            for li in range(5):
                la = li * 2.094 + 0.5
                lp = li * 1.047 + 0.3
                dx = p.x - math.sin(la) * math.cos(lp) * radius * 0.5
                dy = p.y - math.sin(la) * math.sin(lp) * radius * 0.5
                dz = p.z - math.cos(la) * radius * 0.5
                d = math.sqrt(dx*dx + dy*dy + dz*dz)
                bump += max(0, 1 - d / (radius * 0.6)) * 0.25
            
            scale = 1 + bump + fbm(p.x*5, p.y*5, p.z*5, 2) * 0.06
            new_p = Vec3(p.x * scale, p.y * scale, p.z * scale)
            main.verts[idx] = new_p
    
    for p in main.verts:
        n = p.norm()
        n.x += fbm(p.x*8, p.y*8, p.z*8) * 0.15
        n.y += fbm(p.x*8+5, p.y*8+5, p.z*8+5) * 0.15
        n.z += fbm(p.x*8+10, p.y*8+10, p.z*8+10) * 0.15
        main.norms.append(n.norm())
    
    return main

def gen_platelet(radius=1.2, segs=32):
    """Platelet with irregular shape and pseudopods."""
    m = Mesh("platelet")
    
    base = gen_sphere(radius, segs)
    # Flatten and add irregularity
    for ring in range(segs + 1):
        v = ring / segs
        for i in range(segs + 1):
            idx = ring * (segs+1) + i
            p = base.verts[idx]
            # Flatten
            p.y *= 0.4
            
            # Irregular surface
            irr = fbm(p.x*6, p.y*10, p.z*6, 3) * 0.3 + 0.7
            p.x *= irr; p.y *= irr; p.z *= irr
            
            # Pseudopod extrusions
            for pi in range(6):
                pa = pi * 1.047 + 0.2
                pp = 0.3 + pi * 0.15
                dx = p.x - math.sin(pa) * math.cos(pp) * radius * 0.4
                dy = p.y - math.sin(pa) * math.sin(pp) * radius * 0.15
                dz = p.z - math.cos(pa) * radius * 0.4
                d = math.sqrt(dx*dx + dy*dy + dz*dz)
                if d < radius * 0.5:
                    ext = (1 - d/(radius*0.5)) * 0.4
                    p.x += dx * ext; p.y += dy * ext * 0.3; p.z += dz * ext
            
            base.verts[idx] = p
    
    # Recompute normals
    base.compute_normals()
    # Smooth normals
    for i in range(len(base.norms)):
        n = base.norms[i]
        p = base.verts[i]
        n.x += fbm(p.x*10, p.y*10, p.z*10) * 0.2
        n.y += fbm(p.x*10+7, p.y*10+7, p.z*10+7) * 0.2
        n.z += fbm(p.x*10+13, p.y*10+13, p.z*10+13) * 0.2
        base.norms[i] = n.norm()
    
    return base

def gen_plasma(radius=2.0, segs=48):
    """Plasma droplet with surface tension wobble."""
    m = gen_sphere(radius, segs)
    for ring in range(segs + 1):
        v = ring / segs
        for i in range(segs + 1):
            idx = ring * (segs+1) + i
            p = m.verts[idx]
            wobble = math.sin(p.x*2 + p.y*3) * 0.02 + math.cos(p.z*2 + p.x*4) * 0.015
            s = 1 + wobble + fbm(p.x*3, p.y*3, p.z*3) * 0.01
            m.verts[idx] = Vec3(p.x*s, p.y*s, p.z*s)
    m.compute_normals()
    return m

# ── Bloodstain Pattern Meshes ──

def gen_stain_plane(segments, height_func):
    """Generate a subdivided plane with height displacement."""
    m = Mesh("stain")
    res = segments
    for y in range(res + 1):
        vy = y / res
        for x in range(res + 1):
            vx = x / res
            px = (vx - 0.5) * 2
            pz = (vy - 0.5) * 2
            h = height_func(px, pz, vx, vy)
            p = Vec3(px * 0.8, h, pz * 0.8)
            m.add_vert(p, Vec3(0,1,0), (vx, vy))
    for y in range(res):
        for x in range(res):
            a = y * (res+1) + x
            b = a + res + 1
            m.add_tri(a, b, a+1)
            m.add_tri(b, b+1, a+1)
    m.compute_normals()
    return m

def gen_drip_stain():
    def h(x, z, u, v):
        d = math.sqrt(x*x + z*z)
        r = 0.85 + math.sin(u*9 + v*8)*0.03 + math.sin(u*17 - v*13)*0.015
        edge = 1 - min(1, d / r)
        return math.pow(edge, 2) * 0.06 + fbm(x*12, z*12, 0)*0.003
    return gen_stain_plane(48, h)

def gen_flow_pattern():
    def h(x, z, u, v):
        # Flowing downhill in +x direction
        flow = max(0, x + 0.3) * 0.15
        spread = math.exp(-z*z*3) * flow
        return spread + fbm(x*8, z*8, 0)*0.004
    return gen_stain_plane(48, h)

def gen_pool_pattern():
    def h(x, z, u, v):
        d = math.sqrt(x*x + z*z)
        r = 0.9 + math.sin(u*7 + v*5)*0.05
        pool = max(0, 1 - d/r) * 0.1
        # Drying edge
        edge = max(0, d/r - 0.7) * 3
        edge_drop = -edge*edge * 0.02
        return pool + edge_drop + fbm(x*10, z*10, 0)*0.003
    return gen_stain_plane(48, h)

def gen_impact_spatter():
    def h(x, z, u, v):
        d = math.sqrt(x*x + z*z)
        # Central spatter
        central = math.exp(-d*d*8) * 0.08
        # Random droplets
        drops = 0; seed = hash((int(u*20), int(v*20))) % 1000
        if seed > 800:
            drops = 0.03 + (seed % 100) * 0.0002
        return central + drops + fbm(x*15, z*15, 0)*0.002
    return gen_stain_plane(64, h)

def gen_castoff_pattern():
    def h(x, z, u, v):
        # Linear arc pattern
        arc_y = math.sin(x*10 + 1.5) * 0.04
        drop_y = -abs(x) * 0.1 + 0.05
        stain = max(0, drop_y) * 0.12
        # Individual drops along line
        drop_pos = int(x * 12 + 6)
        if 0 <= drop_pos < 12 and abs(z) < 0.04:
            stain += 0.06
        return arc_y + stain + fbm(x*12, z*12, 0)*0.003
    return gen_stain_plane(48, h)

def gen_arterial_spurt():
    def h(x, z, u, v):
        # Parabolic spurt
        xp = x * 1.5
        yp = -(xp*xp) * 0.5 + 0.3
        spurt = max(0, yp) * 0.15 * math.exp(-z*z*8)
        # Rhythmic pulses along spurt
        pulse = math.sin(xp*12 + 1) * 0.5 + 0.5
        spurt *= 0.5 + pulse * 0.5
        return spurt + fbm(x*10, z*10, 0)*0.004
    return gen_stain_plane(48, h)

def gen_swipe_pattern():
    def h(x, z, u, v):
        # Sharp leading edge, feathered trailing
        dir = x + 0.3
        blood = 1 / (1 + math.exp(-dir*15))  # Sigmoid
        blood *= math.exp(-z*z*3)
        return blood * 0.08 + fbm(x*8, z*8, 0)*0.003
    return gen_stain_plane(48, h)

def gen_wipe_pattern():
    def h(x, z, u, v):
        d = math.sqrt(x*x + z*z)
        base = math.exp(-d*d*3) * 0.08
        # Smear in one direction
        smear = math.exp(-(x-0.2)*(x-0.2)*5 - z*z*8) * 0.04
        return base + smear + fbm(x*8, z*8, 0)*0.003
    return gen_stain_plane(48, h)

def gen_contact_stain():
    def h(x, z, u, v):
        d = math.sqrt(x*x + z*z)
        blood = math.exp(-d*d*5) * 0.08
        # Fingerprint ridges
        ridge = math.sin(x*30 + z*20) * 0.5 + 0.5
        ridge *= math.exp(-d*d*8) * 0.015
        return blood - ridge + fbm(x*10, z*10, 0)*0.002
    return gen_stain_plane(48, h)

def gen_altered_stain():
    def h(x, z, u, v):
        d = math.sqrt(x*x + z*z)
        base = math.exp(-d*d*2.5) * 0.06
        # Dilution halo
        halo = math.exp(-(d-0.5)*(d-0.5)*6) * 0.025
        return base + halo + fbm(x*6, z*6, 0)*0.005
    return gen_stain_plane(48, h)

# ═══════════════════════════════════════════════════
#  GENERATE ALL MODELS
# ═══════════════════════════════════════════════════

MODELS = {}

def add(name, mesh, color, metallic, roughness, emissive=None, alpha=1.0):
    gltf = build_gltf(mesh, color, metallic, roughness, emissive, alpha)
    MODELS[name] = gltf
    print(f"  ✓ {name}: {len(mesh.verts)} verts, {len(mesh.tris)} tris")

print("Generating ultra-high-quality 3D models...\n")

# Blood Components
add('rbc', gen_rbc(1.5, 64), (0.75, 0.12, 0.12), 0.0, 0.25, (0.25, 0.02, 0.02))
add('wbc', gen_wbc(1.8, 48), (0.91, 0.88, 0.82), 0.0, 0.35, (0.15, 0.12, 0.10))
add('platelet', gen_platelet(1.2, 40), (0.83, 0.77, 0.66), 0.0, 0.45, (0.12, 0.10, 0.08))
add('plasma', gen_plasma(2.0, 48), (0.96, 0.90, 0.72), 0.0, 0.05, (0.08, 0.06, 0.04), 0.55)

# Bloodstain Patterns
add('drip', gen_drip_stain(), (0.55, 0.04, 0.04), 0.0, 0.3, (0.12, 0.01, 0.01))
add('flow', gen_flow_pattern(), (0.60, 0.05, 0.05), 0.0, 0.35, (0.15, 0.01, 0.01))
add('pool', gen_pool_pattern(), (0.48, 0.03, 0.03), 0.0, 0.25, (0.10, 0.01, 0.01))
add('spatter', gen_impact_spatter(), (0.55, 0.04, 0.04), 0.0, 0.3, (0.12, 0.01, 0.01))
add('castoff', gen_castoff_pattern(), (0.72, 0.08, 0.12), 0.0, 0.28, (0.20, 0.02, 0.03))
add('spurt', gen_arterial_spurt(), (0.75, 0.05, 0.05), 0.0, 0.2, (0.18, 0.01, 0.01))
add('swipe', gen_swipe_pattern(), (0.50, 0.04, 0.04), 0.0, 0.4, (0.10, 0.01, 0.01))
add('wipe', gen_wipe_pattern(), (0.40, 0.03, 0.03), 0.0, 0.45, (0.08, 0.01, 0.01))
add('contact', gen_contact_stain(), (0.58, 0.05, 0.05), 0.0, 0.3, (0.12, 0.01, 0.01))
add('altered', gen_altered_stain(), (0.33, 0.03, 0.03), 0.0, 0.5, (0.06, 0.01, 0.01))

# ═══════════════════════════════════════════════════
#  OUTPUT JAVASCRIPT MODULE
# ═══════════════════════════════════════════════════

out_path = os.path.join(os.path.dirname(__file__), '..', 'public', 'js', 'models_gltf.js')
os.makedirs(os.path.dirname(out_path), exist_ok=True)

js_lines = ['// Auto-generated ultra-high-quality 3D models (GLTF embedded)\n']
js_lines.append('// Generated by BloodstainAR Model Generator\n\n')

for name, gltf in MODELS.items():
    var_name = f'MODEL_{name}'
    js_lines.append(gltf_to_js_var(gltf, var_name))

# Build lookup object
js_lines.append('const MODELS_GLTF = {\n')
for name in MODELS:
    js_lines.append(f'  "{name}": MODEL_{name},\n')
js_lines.append('};\n')
js_lines.append('if (typeof window !== "undefined") window.MODELS_GLTF = MODELS_GLTF;\n')

with open(out_path, 'w') as f:
    f.writelines(js_lines)

total_size = sum(len(v['buffers'][0]['uri']) for v in MODELS.values())
print(f"\n✓ Written to: {out_path}")
print(f"  {len(MODELS)} models")
print(f"  Total encoded size: ~{total_size // 1024} KB")
print(f"  Total vertices: {sum(len(build_gltf.__code__.co_code) for _ in range(1))} (dummy)")
for name, gltf in MODELS.items():
    vert_count = gltf['accessors'][0]['count']
    tri_count = gltf['accessors'][3]['count'] // 3
    print(f"    {name:12s}: {vert_count:5d} verts, {tri_count:4d} tris")
