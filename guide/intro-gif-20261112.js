const INTRO_PLAYBACK_RATE = 1.44;

// The intro GIF starts with a full frame and stores later changes as opaque patches.
// Decode each patch separately and composite it onto the persistent canvas.
function readFrames(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const word = offset => view.getUint16(offset, true);
  const paletteLength = flags => flags & 128 ? 3 * (2 << (flags & 7)) : 0;
  if (new TextDecoder().decode(bytes.subarray(0, 3)) !== 'GIF') {
    throw new Error('Invalid intro GIF');
  }
  const width = word(6);
  const height = word(8);
  let offset = 13 + paletteLength(bytes[10]);
  const header = bytes.subarray(0, offset);
  const trailer = new Uint8Array([0x3b]);
  const frames = [];
  let duration = 100;

  function skipBlocks() {
    while (offset < bytes.length) {
      const length = bytes[offset++];
      if (!length) return;
      offset += length;
    }
    throw new Error('Incomplete intro GIF');
  }

  while (offset < bytes.length) {
    const start = offset;
    const marker = bytes[offset++];
    if (marker === 0x3b && frames.length) return { width, height, frames };
    if (marker === 0x21) {
      if (bytes[offset++] === 0xf9) {
        const flags = bytes[offset + 1];
        if ((flags & 1) || ((flags >> 2) & 7) > 1) {
          throw new Error('Intro GIF frames must be opaque');
        }
        duration = word(offset + 2) * 10 || 100;
      }
      skipBlocks();
      continue;
    }
    if (marker !== 0x2c || offset + 9 > bytes.length) {
      throw new Error('Invalid intro GIF frame');
    }
    const left = word(offset);
    const top = word(offset + 2);
    const patchWidth = word(offset + 4);
    const patchHeight = word(offset + 6);
    if (!patchWidth || !patchHeight || left + patchWidth > width || top + patchHeight > height ||
        (!frames.length && (left || top || patchWidth !== width || patchHeight !== height))) {
      throw new Error('Invalid intro GIF patch bounds');
    }
    const frameHeader = header.slice();
    const frameScreen = new DataView(frameHeader.buffer);
    frameScreen.setUint16(6, patchWidth, true);
    frameScreen.setUint16(8, patchHeight, true);
    const descriptor = bytes.slice(start, offset + 9);
    descriptor.fill(0, 1, 5);
    const dataStart = offset + 9;
    offset = dataStart + paletteLength(bytes[offset + 8]) + 1;
    skipBlocks();
    frames.push({
      duration,
      left,
      top,
      image: new Blob([frameHeader, descriptor, bytes.subarray(dataStart, offset), trailer], { type: 'image/gif' })
    });
    duration = 100;
  }
  throw new Error('Missing intro GIF trailer');
}

async function decodeFrame(blob) {
  const url = URL.createObjectURL(blob);
  const image = new Image();
  try {
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function nextPaint() {
  return new Promise(resolve => requestAnimationFrame(resolve));
}

export async function playIntroGif(canvas, src, signal) {
  const loading = new AbortController();
  const abortLoad = () => loading.abort(signal.reason);
  signal.throwIfAborted();
  signal.addEventListener('abort', abortLoad, { once: true });
  const timeout = setTimeout(() => loading.abort(new Error('Intro GIF load timed out')), 12000);
  let bytes;
  try {
    const response = await fetch(src, { signal: loading.signal });
    if (!response.ok) throw new Error('Could not load intro GIF');
    bytes = await response.arrayBuffer();
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener('abort', abortLoad);
  }
  signal.throwIfAborted();
  const { width, height, frames } = readFrames(new Uint8Array(bytes));
  signal.throwIfAborted();
  const source = document.createElement('canvas');
  source.width = width;
  source.height = height;
  const composite = source.getContext('2d', { alpha: false });
  const context = canvas.getContext('2d', { alpha: false });

  function paintFrame(frame, image) {
    composite.drawImage(image, frame.left, frame.top);
    const scale = Math.min(canvas.clientWidth / width, canvas.clientHeight / height) * window.devicePixelRatio;
    const displayWidth = Math.max(1, Math.round(width * scale));
    const displayHeight = Math.max(1, Math.round(height * scale));
    if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
      canvas.width = displayWidth;
      canvas.height = displayHeight;
    }
    // Resample once at the actual display resolution, including Retina screens.
    context.imageSmoothingQuality = 'high';
    context.drawImage(source, 0, 0, displayWidth, displayHeight);
  }
  const pending = new Map();
  let deadline = 0;

  for (const [index, frame] of frames.entries()) {
    signal.throwIfAborted();
    // Bound memory while giving the browser time to decode upcoming frames.
    for (let ahead = index; ahead < Math.min(index + 5, frames.length); ahead++) {
      if (!pending.has(ahead)) {
        pending.set(ahead, decodeFrame(frames[ahead].image).then(
          image => ({ image }),
          error => ({ error })
        ));
      }
    }
    const { image, error } = await pending.get(index);
    pending.delete(index);
    if (error) throw error;

    let now = await nextPaint();
    while (now < deadline) now = await nextPaint();
    signal.throwIfAborted();
    paintFrame(frame, image);
    canvas.dataset.introFrame = String(index + 1);
    // Keep normal refresh-rate rounding from accumulating. If decoding is
    // late, let the timeline slip so no frame is skipped to catch up.
    deadline = Math.max(deadline, now - 16) + frame.duration / INTRO_PLAYBACK_RATE;
  }

  // Hold the last frame for its full encoded duration after it was painted.
  const finalPaint = await nextPaint();
  while (await nextPaint() < finalPaint + frames.at(-1).duration / INTRO_PLAYBACK_RATE) {
    signal.throwIfAborted();
  }
  signal.throwIfAborted();
  canvas.dispatchEvent(new Event('intro-complete'));
}
