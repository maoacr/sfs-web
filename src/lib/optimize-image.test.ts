// @vitest-environment node
//
// Test de conversión REAL: acá sharp NO está mockeado a propósito.
// Prueba la promesa que el producto le hace al usuario: que pueda elegir
// cualquier foto de su galería (JPG del celular, PNG de la PC) y que el
// servidor se encargue de convertirla y comprimirla. Si esto se rompe, subir
// una foto normal empieza a fallar y nadie se entera hasta producción.
import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { optimizeImage } from "@/lib/storage";

type FormatoDeEntrada = "jpeg" | "png" | "tiff";

async function fotoDeGaleria(formato: FormatoDeEntrada, ancho: number, alto: number): Promise<File> {
  const buffer = await sharp({
    create: { width: ancho, height: alto, channels: 3, background: { r: 10, g: 150, b: 60 } },
  })[formato]().toBuffer();

  return new File([buffer], `foto.${formato}`, { type: `image/${formato}` });
}

describe("optimizeImage — el servidor convierte, el usuario no tiene que saber de WebP", () => {
  it("convierte a WebP un JPEG, que es lo que sale de la cámara del celular", async () => {
    const salida = await optimizeImage(await fotoDeGaleria("jpeg", 1200, 900), "profile");

    expect((await sharp(salida).metadata()).format).toBe("webp");
  });

  it("convierte a WebP un PNG, que es lo típico de una captura de pantalla", async () => {
    const salida = await optimizeImage(await fotoDeGaleria("png", 800, 800), "profile");

    expect((await sharp(salida).metadata()).format).toBe("webp");
  });

  it("acepta TIFF: formatos menos comunes tampoco frenan al usuario", async () => {
    const salida = await optimizeImage(await fotoDeGaleria("tiff", 600, 400), "photo");

    expect((await sharp(salida).metadata()).format).toBe("webp");
  });

  it("lee HEIC/HEIF, el formato por defecto del iPhone", () => {
    // Generar un HEIC de prueba requiere un encoder con licencia que libvips no
    // trae, así que se verifica la capacidad de LECTURA, que es la que importa:
    // si esto fuera false, toda foto de iPhone fallaría al subir.
    expect(sharp.format.heif.input.buffer).toBe(true);
  });

  it("encaja la foto de perfil en 512px sin deformarla", async () => {
    const salida = await optimizeImage(await fotoDeGaleria("jpeg", 1200, 900), "profile");
    const { width, height } = await sharp(salida).metadata();

    // 1200x900 es 4:3 — entra en 512x512 como 512x384, manteniendo proporción.
    expect(width).toBe(512);
    expect(height).toBe(384);
  });

  it("permite fotos grandes de cancha hasta 1920px", async () => {
    const salida = await optimizeImage(await fotoDeGaleria("jpeg", 4000, 3000), "photo");
    const { width, height } = await sharp(salida).metadata();

    expect(width).toBe(1920);
    expect(height).toBe(1440);
  });

  it("no agranda una imagen chica: 200px se queda en 200px", async () => {
    const salida = await optimizeImage(await fotoDeGaleria("jpeg", 200, 200), "profile");

    expect((await sharp(salida).metadata()).width).toBe(200);
  });

  it("comprime: el WebP que se sube pesa menos que el original", async () => {
    const original = await fotoDeGaleria("png", 1500, 1500);
    const salida = await optimizeImage(original, "profile");

    expect(salida.byteLength).toBeLessThan(original.size);
  });
});
