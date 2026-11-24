// Prepara una foto para subirla: el diario, El Refugio y los Recuerdos la usan.
//
// Lo normal es reducirla en el navegador a 1600 px (pesa poco y sube rápido). Algunos
// Android guardan las fotos en HEIC, que Chrome no sabe leer, y las cámaras de 108 o
// 200 MP pueden dejar al celular sin memoria al abrirlas: en esos casos se manda el
// archivo tal cual y el servidor lo convierte a JPG.

export type PreparedPhoto = { photo_base64: string; photo_type: string };

const MAX_SIDE = 1600;
// El proxy de Vercel acepta ~4.5 MB por petición y el base64 pesa un tercio más.
const MAX_RAW_BYTES = 3 * 1024 * 1024;
const RAW_TYPES: Record<string, string> = { heic: "image/heic", heif: "image/heif", avif: "image/avif", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };

function drawScaled(source: CanvasImageSource, width: number, height: number, maxSide: number): string {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Sin canvas");
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  const data = canvas.toDataURL("image/jpeg", 0.85);
  // Si el celular se quedó sin memoria, el canvas sale vacío en lugar de fallar.
  if (!data.startsWith("data:image/jpeg") || data.length < 1000) throw new Error("Canvas vacío");
  return data;
}

async function viaBitmap(file: File, maxSide: number): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    return drawScaled(bitmap, bitmap.width, bitmap.height, maxSide);
  } finally {
    bitmap.close();
  }
}

function viaImage(file: File, maxSide: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      try {
        resolve(drawScaled(image, image.naturalWidth, image.naturalHeight, maxSide));
      } catch (error) {
        reject(error);
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("El navegador no pudo leer la foto"));
    };
    image.src = url;
  });
}

function rawType(file: File): string | null {
  if (file.type && Object.values(RAW_TYPES).includes(file.type)) return file.type;
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return RAW_TYPES[extension] ?? null;
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("No se pudo leer el archivo"));
    reader.readAsDataURL(file);
  });
}

export async function preparePhoto(file: File, maxSide = MAX_SIDE): Promise<PreparedPhoto> {
  for (const shrink of [viaBitmap, viaImage]) {
    try {
      return { photo_base64: await shrink(file, maxSide), photo_type: "image/jpeg" };
    } catch {
      // Se intenta el siguiente camino.
    }
  }
  const type = rawType(file);
  if (!type) throw new Error("Ese archivo no parece una foto. Prueba con una JPG, PNG o HEIC.");
  if (file.size > MAX_RAW_BYTES) throw new Error("Tu celular no pudo achicar esta foto y es muy pesada para subirla así. Prueba con una captura de pantalla de la foto.");
  return { photo_base64: await readAsDataUrl(file), photo_type: type };
}
