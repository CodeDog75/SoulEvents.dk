export type CapacityTone = "available" | "low" | "sold_out";

export function formatCapacityLabel(availableSeats?: number | null, capacity?: number | null) {
  if (typeof capacity !== "number" || capacity <= 0 || typeof availableSeats !== "number") {
    return null;
  }

  const available = Math.max(availableSeats, 0);

  if (available <= 0) {
    return "UDSOLGT";
  }

  const seatLabel = available === 1 ? "ledig plads" : "ledige pladser";
  return `${available} ${seatLabel} (${capacity} i alt)`;
}

export function getCapacityTone(availableSeats?: number | null, capacity?: number | null): CapacityTone | null {
  if (typeof capacity !== "number" || capacity <= 0 || typeof availableSeats !== "number") {
    return null;
  }

  if (availableSeats <= 0) {
    return "sold_out";
  }

  return availableSeats <= 3 ? "low" : "available";
}
