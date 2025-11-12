// Client-side image utilities: load image, resize and compress, convert file to data URL
export async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = (e) => reject(e);
    reader.readAsDataURL(file);
  });
}

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export async function resizeAndCompressImage(file: File, maxDim = 512, quality = 0.8): Promise<Blob> {
  const url = URL.createObjectURL(file);
  const img = await loadImg(url);
  URL.revokeObjectURL(url);
  let targetW = img.width;
  let targetH = img.height;
  if (Math.max(img.width, img.height) > maxDim) {
    if (img.width >= img.height) {
      targetW = maxDim;
      targetH = Math.round((img.height * maxDim) / img.width);
    } else {
      targetH = maxDim;
      targetW = Math.round((img.width * maxDim) / img.height);
    }
  }
  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');
  // draw with high quality settings where available
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, targetW, targetH);
  return await new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b as Blob), 'image/jpeg', quality);
  });
}

// crop a dataURL/image using pixel coordinates (from react-easy-crop's onCropComplete)
export async function getCroppedImg(imageSrc: string, pixelCrop: { x: number; y: number; width: number; height: number }): Promise<Blob> {
  const img = await loadImg(imageSrc);
  const canvas = document.createElement('canvas');
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');
  // draw the cropped area from the source image
  ctx.drawImage(img, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, pixelCrop.width, pixelCrop.height);
  return await new Promise((resolve) => canvas.toBlob((b) => resolve(b as Blob), 'image/jpeg', 0.9));
}
