export type CapacityTone = "available" | "low" | "sold_out";

export function isEventSoldOutForCapacity(status?: string | null, availableSeats?: number | null) {
  return status === "sold_out" || (typeof availableSeats === "number" && availableSeats <= 0);
}

export function formatCapacityLabel(availableSeats?: number | null, capacity?: number | null, status?: string | null) {
  if (typeof capacity !== "number" || capacity <= 0 || typeof availableSeats !== "number") {
    return null;
  }

  if (isEventSoldOutForCapacity(status, availableSeats)) {
    return null;
  }

  const available = Math.max(availableSeats, 0);

  const seatLabel = available === 1 ? "ledig plads" : "ledige pladser";
  return `${available} ${seatLabel} (${capacity} i alt)`;
}

export function getCapacityTone(availableSeats?: number | null, capacity?: number | null, status?: string | null): CapacityTone | null {
  if (status === "sold_out") {
    return "sold_out";
  }

  if (typeof capacity !== "number" || capacity <= 0 || typeof availableSeats !== "number") {
    return null;
  }

  if (isEventSoldOutForCapacity(status, availableSeats)) {
    return "sold_out";
  }

  return availableSeats <= 3 ? "low" : "available";
}
