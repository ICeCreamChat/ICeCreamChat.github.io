"""Render the homepage's model illustrations. Requires NumPy, Pillow and FFmpeg."""

import argparse
import collections
from pathlib import Path
import subprocess

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SIZE, FPS, FRAMES = 480, 20, 240
PAPER = np.array([247, 249, 252], dtype=np.float32)
FIELD = np.array([240, 246, 249], dtype=np.float32)
TEAL = np.array([9, 108, 112], dtype=np.float32)
OCHRE = np.array([166, 120, 58], dtype=np.float32)


def encode(name, frames, ffmpeg):
    output = ROOT / 'assets' / 'media' / f'{name}.mp4'
    output.parent.mkdir(parents=True, exist_ok=True)
    command = [ffmpeg, '-y', '-loglevel', 'error', '-f', 'rawvideo',
               '-pix_fmt', 'rgb24', '-s', f'{SIZE}x{SIZE}', '-r', str(FPS),
               '-i', '-', '-an', '-c:v', 'libx264', '-preset', 'medium',
               '-crf', '24', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', str(output)]
    process = subprocess.Popen(command, stdin=subprocess.PIPE)
    poster = None
    try:
        for poster in frames:
            process.stdin.write(poster.tobytes())
    finally:
        process.stdin.close()
    if process.wait() != 0 or poster is None:
        raise RuntimeError(f'FFmpeg failed for {name}')
    poster_path = ROOT / 'assets' / 'img' / f'{name}-poster.png'
    poster_path.parent.mkdir(parents=True, exist_ok=True)
    poster.save(poster_path, optimize=True)
    print(f'{name}: {FRAMES / FPS:.0f} s, {output.stat().st_size / 1024:.0f} KiB', flush=True)


def spiral_frames():
    coordinates = (np.arange(SIZE, dtype=np.float32) + .5 - SIZE / 2) / (SIZE * .43)
    x, y = np.meshgrid(coordinates, -coordinates)
    radius, angle = np.hypot(x, y), np.arctan2(y, x)
    edge = np.clip((1 - radius) * 100, 0, 1)[..., None]
    for frame in range(FRAMES):
        phase = 2 * np.pi * frame / FRAMES
        value = np.sin(2 * np.pi * 5 * radius + angle - phase)
        strength = (np.abs(value) ** 12 * np.minimum(1, radius * 6))[..., None]
        color = np.where((value > 0)[..., None], TEAL, OCHRE)
        field = FIELD + (color - FIELD) * strength
        image = Image.fromarray(np.uint8(PAPER + (field - PAPER) * edge))
        draw = ImageDraw.Draw(image)
        draw.line((20, SIZE / 2, SIZE - 20, SIZE / 2), fill=(203, 214, 224), width=1)
        draw.line((SIZE / 2, 20, SIZE / 2, SIZE - 20), fill=(203, 214, 224), width=1)
        boundary = SIZE * .07
        draw.ellipse((boundary, boundary, SIZE - boundary, SIZE - boundary), outline=(180, 198, 211), width=1)
        draw.ellipse((SIZE / 2 - 2, SIZE / 2 - 2, SIZE / 2 + 2, SIZE / 2 + 2), fill=(24, 48, 71))
        yield image


def laplacian(field):
    return (np.roll(field, 1, 0) + np.roll(field, -1, 0)
            + np.roll(field, 1, 1) + np.roll(field, -1, 1) - 4 * field)


def turing_frames():
    # Schnakenberg kinetics: the homogeneous equilibrium (u, v) = (1, .9)
    # is stable without diffusion, and unstable for these diffusion coefficients.
    rng = np.random.default_rng(330)
    grid = 96
    u = (1 + rng.normal(0, .015, (grid, grid))).astype(np.float32)
    v = (.9 + rng.normal(0, .015, (grid, grid))).astype(np.float32)
    a, b, rate, du, dv, dt = .1, .9, .2, .16, 3.2, .05
    for frame in range(FRAMES):
        for _ in range(22):
            reaction = u * u * v
            next_u = u + dt * (du * laplacian(u) + rate * (a - u + reaction))
            next_v = v + dt * (dv * laplacian(v) + rate * (b - reaction))
            u, v = next_u, next_v
        if not np.isfinite(u).all() or np.min(u) < 0 or np.min(v) < 0:
            raise RuntimeError('Reaction-diffusion integration became unstable')
        concentration = np.clip((u - .35) / 1.8, 0, 1)[..., None]
        field = np.uint8(FIELD + (TEAL - FIELD) * concentration)
        pattern = Image.fromarray(field).resize((420, 420), Image.Resampling.BICUBIC)
        image = Image.new('RGB', (SIZE, SIZE), tuple(PAPER.astype(int)))
        image.paste(pattern, (30, 30))
        ImageDraw.Draw(image).rectangle((29, 29, 450, 450), outline=(203, 214, 224))
        yield image
    print(f'  Schnakenberg final u range: {u.min():.3f}–{u.max():.3f}', flush=True)


def collective_frames():
    # Vicsek model: fixed-speed particles align to local neighbours, with noise.
    rng = np.random.default_rng(6216)
    count, speed, radius, noise = 180, .006, .13, .22
    positions = rng.random((count, 2))
    angles = rng.uniform(-np.pi, np.pi, count)
    trails = collections.deque(maxlen=10)
    for frame in range(FRAMES):
        trails.append(positions.copy())
        difference = (positions[None, :, :] - positions[:, None, :] + .5) % 1 - .5
        neighbours = np.sum(difference ** 2, axis=2) < radius ** 2
        angles = np.arctan2(neighbours @ np.sin(angles), neighbours @ np.cos(angles))
        angles += rng.uniform(-noise / 2, noise / 2, count)
        directions = np.column_stack((np.cos(angles), np.sin(angles)))
        positions = (positions + speed * directions) % 1
        image = Image.new('RGB', (SIZE, SIZE), tuple(PAPER.astype(int)))
        draw = ImageDraw.Draw(image)
        for coordinate in range(30, 451, 84):
            draw.line((coordinate, 30, coordinate, 450), fill=(227, 234, 241))
            draw.line((30, coordinate, 450, coordinate), fill=(227, 234, 241))
        draw.rectangle((30, 30, 450, 450), outline=(203, 214, 224))
        history = np.array(trails)
        for index in range(count):
            trail = history[:, index]
            for start, end in zip(trail[:-1], trail[1:]):
                if np.linalg.norm(end - start) < .1:
                    draw.line((*tuple(30 + 420 * start), *tuple(30 + 420 * end)), fill=(192, 209, 216), width=1)
            center = 30 + 420 * positions[index]
            direction = directions[index]
            normal = np.array([-direction[1], direction[0]])
            triangle = [tuple(center + direction * 4.5),
                        tuple(center - direction * 3 + normal * 2),
                        tuple(center - direction * 3 - normal * 2)]
            color = TEAL if index % 4 else OCHRE
            draw.polygon(triangle, fill=tuple(color.astype(int)))
        yield image
    order = np.linalg.norm(np.mean(directions, axis=0))
    print(f'  Vicsek final orientation order: {order:.3f}', flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--ffmpeg', default='ffmpeg')
    parser.add_argument('--only', choices=['spiral', 'turing', 'collective'])
    args = parser.parse_args()
    for key, name, renderer in [('spiral', 'spiral-wave', spiral_frames),
                                ('turing', 'turing-pattern', turing_frames),
                                ('collective', 'collective-motion', collective_frames)]:
        if args.only is None or args.only == key:
            encode(name, renderer(), args.ffmpeg)
