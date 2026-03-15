/**
 * Resize image to target dimensions (same as Stewie's size for character avatars).
 * Used when adding a character in the main app and in admin global characters.
 */
export const TARGET_IMAGE_WIDTH = 781;
export const TARGET_IMAGE_HEIGHT = 987;

/**
 * Resize image to target dimensions using canvas.
 * Fits image while maintaining aspect ratio, centered on canvas; output is PNG.
 */
export function resizeImage(
  file: File,
  targetWidth: number,
  targetHeight: number
): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Could not get canvas context"));
          return;
        }
        ctx.clearRect(0, 0, targetWidth, targetHeight);
        const imgAspect = img.width / img.height;
        const targetAspect = targetWidth / targetHeight;
        let drawWidth = targetWidth;
        let drawHeight = targetHeight;
        let drawX = 0;
        let drawY = 0;
        if (imgAspect > targetAspect) {
          drawHeight = targetHeight;
          drawWidth = drawHeight * imgAspect;
          drawX = (targetWidth - drawWidth) / 2;
        } else {
          drawWidth = targetWidth;
          drawHeight = drawWidth / imgAspect;
          drawY = (targetHeight - drawHeight) / 2;
        }
        ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("Failed to resize image"));
              return;
            }
            resolve(
              new File([blob], file.name, {
                type: "image/png",
                lastModified: Date.now(),
              })
            );
          },
          "image/png",
          1.0
        );
      };
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

/** Crop area in percentage (0–100) of the source image */
export type CropArea = { x: number; y: number; width: number; height: number };

/**
 * Crop image by percentage area then resize to target dimensions.
 * Returns a PNG File suitable for character upload.
 */
export function cropAndResizeImage(
  imageDataUrl: string,
  crop: CropArea,
  targetWidth: number,
  targetHeight: number,
  fileName = "character.png"
): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not get canvas context"));
        return;
      }
      const scaleX = img.width / 100;
      const scaleY = img.height / 100;
      const sx = crop.x * scaleX;
      const sy = crop.y * scaleY;
      const sw = crop.width * scaleX;
      const sh = crop.height * scaleY;
      ctx.clearRect(0, 0, targetWidth, targetHeight);
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetWidth, targetHeight);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Failed to crop image"));
            return;
          }
          resolve(
            new File([blob], fileName, { type: "image/png", lastModified: Date.now() })
          );
        },
        "image/png",
        1.0
      );
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = imageDataUrl;
  });
}
