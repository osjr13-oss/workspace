/** Weight and height are stored metric and shown in the user's preferred units. */

export type Units = "metric" | "imperial";

const KG_PER_LB = 0.45359237;

export function kgToLb(kg: number) {
  return kg / KG_PER_LB;
}

export function lbToKg(lb: number) {
  return lb * KG_PER_LB;
}

export function cmToFeetInches(cm: number) {
  const totalInches = cm / 2.54;
  let feet = Math.floor(totalInches / 12);
  let inches = Math.round(totalInches - feet * 12);
  if (inches === 12) {
    feet += 1;
    inches = 0;
  }
  return { feet, inches };
}

export function feetInchesToCm(feet: number, inches: number) {
  return (feet * 12 + inches) * 2.54;
}

/** A weight in the user's units, as a number rounded for display. */
export function displayWeight(kg: number, units: Units) {
  return Math.round((units === "imperial" ? kgToLb(kg) : kg) * 10) / 10;
}

export function weightUnit(units: Units) {
  return units === "imperial" ? "lb" : "kg";
}

export function formatWeight(kg: number, units: Units) {
  return `${displayWeight(kg, units)} ${weightUnit(units)}`;
}

/** A weight the user typed, in their units, converted to kilograms. */
export function inputToKg(value: number, units: Units) {
  return units === "imperial" ? lbToKg(value) : value;
}
