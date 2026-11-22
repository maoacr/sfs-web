/**
 * Cómo se escribe la plata en SFS.
 *
 * Vive acá porque lo mostraban ocho archivos —tres pantallas del dueño, dos del
 * jugador y tres componentes— cada uno con su propia copia de la misma
 * expresión. Ocho copias no se desincronizan "si alguien se descuida": se
 * desincronizan el día que haya que cambiar algo, porque nadie encuentra las
 * ocho. Y el formato del dinero es exactamente lo que no puede verse distinto
 * según en qué pantalla estés parado.
 *
 * Es el par de `formatearFecha` y `formatearHora` (`zona-horaria.ts`): el mismo
 * criterio de que el formato de un dato tiene un solo dueño.
 */

/**
 * Pesos colombianos, sin centavos.
 *
 * `minimumFractionDigits: 0` es deliberado: acá no se cobran centavos, y
 * mostrar «$ 160.000,00» es ruido que hace más difícil leer el número.
 *
 * Toma `number` a propósito, aunque el API serialice los decimales como string.
 * Que el llamador tenga que escribir `Number(...)` deja a la vista que ahí hay
 * una conversión — esconderla acá sería tapar que el dato llegó como texto.
 */
export function formatearPrecio(monto: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(monto);
}
