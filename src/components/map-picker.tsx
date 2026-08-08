"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";

interface Props {
  lat: number | null;
  lng: number | null;
  address: string;
  onChange: (lat: number, lng: number) => void;
}

const MapClient = dynamic(() => import("./map-client"), { ssr: false, loading: () => <MapPlaceholder /> });

function MapPlaceholder() {
  return (
    <div className="h-64 sm:h-80 lg:h-96 rounded-xl border border-dashed border-border bg-surface flex items-center justify-center">
      <p className="text-sm text-text-dim">Cargando mapa...</p>
    </div>
  );
}

export function MapPicker({ lat, lng, address, onChange }: Props) {
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  const defaultCenter = useMemo((): [number, number] => {
    if (lat && lng) return [lat, lng];
    return [4.7110, -74.0721];
  }, [lat, lng]);

  async function handleGeocode() {
    if (address.length < 5) {
      setSearchError("Escribí una dirección más completa");
      return;
    }
    setSearching(true); setSearchError("");
    try {
      const res = await fetch(`/api/geocoding?q=${encodeURIComponent(address)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No encontrada");
      onChange(data.lat, data.lng);
      setModalOpen(true); // abrir modal en mobile para refinar
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "Error al buscar");
    } finally {
      setSearching(false);
    }
  }

  const mapElement = (
    <MapClient lat={lat} lng={lng} defaultCenter={defaultCenter} onChange={onChange} />
  );

  return (
    <div>
      {/* Botón de búsqueda */}
      <div className="flex gap-2 mb-3">
        <button type="button" onClick={handleGeocode} disabled={searching}
          className="rounded-lg bg-grass px-4 py-2 text-sm font-medium text-white hover:bg-grass-light disabled:opacity-50 transition-colors">
          {searching ? "Buscando..." : "📍 Buscar en mapa"}
        </button>
        <span className="text-xs text-text-dim self-center">Usa la dirección del complejo</span>
      </div>
      {searchError && <p className="text-xs text-error mb-2">{searchError}</p>}

      {/* Desktop: mapa inline */}
      <div className="hidden sm:block">
        {mapElement}
      </div>

      {/* Mobile: botón que abre modal fullscreen */}
      <div className="sm:hidden">
        <button type="button" onClick={() => setModalOpen(true)}
          className="w-full rounded-xl border border-border bg-surface py-4 text-sm font-medium text-text-muted hover:text-text hover:border-border-hover transition-colors">
          🗺️ Tocar para ver y ajustar ubicación
        </button>

        {lat && lng && (
          <div className="flex gap-2 mt-2">
            <a href={`https://www.google.com/maps?q=${lat},${lng}`} target="_blank" rel="noopener noreferrer"
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-xs text-text-muted hover:text-text hover:border-border-hover transition-colors">
              🗺️ Maps
            </a>
            <a href={`https://waze.com/ul?ll=${lat},${lng}&navigate=yes`} target="_blank" rel="noopener noreferrer"
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-xs text-text-muted hover:text-text hover:border-border-hover transition-colors">
              🚗 Waze
            </a>
          </div>
        )}
      </div>

      {/* Desktop links */}
      {lat && lng && (
        <div className="hidden sm:flex gap-2 mt-2">
          <a href={`https://www.google.com/maps?q=${lat},${lng}`} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-text-muted hover:text-text hover:border-border-hover transition-colors">
            🗺️ Google Maps
          </a>
          <a href={`https://waze.com/ul?ll=${lat},${lng}&navigate=yes`} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-text-muted hover:text-text hover:border-border-hover transition-colors">
            🚗 Waze
          </a>
        </div>
      )}

      {!lat && !lng && (
        <p className="mt-2 text-xs text-text-dim">Buscá la dirección o hacé clic en el mapa para marcar la ubicación.</p>
      )}

      {/* Mobile modal */}
      {modalOpen && (
        <div className="sm:hidden fixed inset-0 z-50 bg-bg flex flex-col" onClick={() => setModalOpen(false)}>
          <div className="flex items-center justify-between p-4 border-b border-border" onClick={e => e.stopPropagation()}>
            <span className="text-sm font-medium text-text">Ajustar ubicación</span>
            <button onClick={() => setModalOpen(false)}
              className="rounded-lg bg-grass px-4 py-2 text-sm font-medium text-white">
              Listo
            </button>
          </div>
          <div className="flex-1" onClick={e => e.stopPropagation()}>
            {mapElement}
          </div>
          <p className="p-3 text-xs text-text-dim text-center">Arrastrá el marcador para ajustar la posición exacta</p>
        </div>
      )}
    </div>
  );
}
