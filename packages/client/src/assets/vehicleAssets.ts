import { ROOM_PROP_CATALOG } from "@gammyverse/shared";

const LEGACY_VEHICLE_ASSETS: Readonly<Record<string, { modelUrl: string; label: string }>> = {
  "vehicle-speedster": { modelUrl: "/assets/kenney/toy-car-kit/Models/GLB format/vehicle-speedster.glb", label: "Speedster" },
  "vehicle-racer": { modelUrl: "/assets/kenney/toy-car-kit/Models/GLB format/vehicle-racer.glb", label: "Racer" },
  "vehicle-suv": { modelUrl: "/assets/kenney/toy-car-kit/Models/GLB format/vehicle-suv.glb", label: "Toy SUV" },
  "vehicle-monster-truck": { modelUrl: "/assets/kenney/toy-car-kit/Models/GLB format/vehicle-monster-truck.glb", label: "Monster Truck" },
  "vehicle-truck": { modelUrl: "/assets/kenney/toy-car-kit/Models/GLB format/vehicle-truck.glb", label: "Toy Truck" },
  "car-sedan": { modelUrl: "/assets/kenney/car-kit/Models/GLB format/sedan.glb", label: "Sedan" },
  "car-hatchback-sports": { modelUrl: "/assets/kenney/car-kit/Models/GLB format/hatchback-sports.glb", label: "Sports Hatchback" },
  "car-taxi": { modelUrl: "/assets/kenney/car-kit/Models/GLB format/taxi.glb", label: "Taxi" },
  "car-kart-oopi": { modelUrl: "/assets/kenney/toy-car-kit/Models/GLB format/vehicle-racer-low.glb", label: "Kart" },
};

const CATALOG_VEHICLES = new Map(ROOM_PROP_CATALOG.flatMap((item) => item.vehicleId ? [[item.vehicleId, item] as const] : []));

export function vehicleModelUrl(vehicleId: string): string {
  return LEGACY_VEHICLE_ASSETS[vehicleId]?.modelUrl
    ?? CATALOG_VEHICLES.get(vehicleId)?.modelUrl
    ?? LEGACY_VEHICLE_ASSETS["car-sedan"]!.modelUrl;
}

export function vehicleLabel(vehicleId: string): string {
  return LEGACY_VEHICLE_ASSETS[vehicleId]?.label
    ?? CATALOG_VEHICLES.get(vehicleId)?.label
    ?? vehicleId.replace(/^(vehicle|car)-/, "").replaceAll("-", " ").replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}
