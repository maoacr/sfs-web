import { FormularioRestablecer } from "./formulario";

/**
 * El token llega por query string, así que lo lee el servidor y se lo pasa al
 * formulario.
 *
 * Server component a propósito: leer el token acá evita `useSearchParams` y el
 * límite de Suspense que arrastra. `searchParams` es una Promise en esta
 * versión de Next — verificado en `node_modules/next/dist/docs`, no asumido.
 */
export default async function RestablecerPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return <FormularioRestablecer token={token ?? ""} />;
}
