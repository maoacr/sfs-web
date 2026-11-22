/**
 * Política de imágenes compartida entre cliente y servidor.
 *
 * Vive aparte de `storage.ts` a propósito: ese módulo importa `sharp` y el
 * cliente de Supabase, que son server-only. Un componente con "use client"
 * que importara de ahí arrastraría todo eso al bundle del navegador.
 */

/**
 * Tope del archivo que sube el usuario, antes de optimizar.
 *
 * Se valida en el cliente para dar feedback inmediato y en el servidor porque
 * el cliente no es confiable: sin el chequeo del servidor, un archivo enorme
 * llega hasta `sharp`, que lo decodifica en memoria.
 *
 * 10 MB deja pasar cómodamente una foto de celular moderno (3–12 MP suele
 * pesar 2–6 MB) sin dejar la puerta abierta a subidas que tiren el proceso.
 */
export const TAMANO_MAXIMO_DE_IMAGEN_BYTES = 10 * 1024 * 1024;

/** El mismo tope, en MB, para los mensajes que ve el usuario. */
export const TAMANO_MAXIMO_DE_IMAGEN_MB = TAMANO_MAXIMO_DE_IMAGEN_BYTES / (1024 * 1024);
