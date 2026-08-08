"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";

interface Props {
  lat: number | null;
  lng: number | null;
  onChange: (lat: number, lng: number) => void;
}

// Leaflet solo funciona en el cliente
const MapClient = dynamic(() => import("./map-client"), { ssr: false, loading: () => <MapPlaceholder /> });

function MapPlaceholder() {
  return (
    <div className="h-64 rounded-xl border border-dashed border-border bg-surface flex items-center justify-center">
      <p className="text-sm text-text-dim">Cargando mapa...</p>
    </div>
  );
}

export function MapPicker({ lat, lng, onChange }: Props) {
  const defaultCenter = useMemo((): [number, number] => {
    if (lat && lng) return [lat, lng];
    return [4.7110, -74.0721]; // Bogotá como default
  }, [lat, lng]);

  return (
    <MapClient lat={lat} lng={lng} defaultCenter={defaultCenter} onChange={onChange} />
  );
}
