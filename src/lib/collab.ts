/**
 * Collaboration cost model. Pure and deterministic, shared by the Feasibility Critic (server)
 * and the "adjust assumptions" calculator (browser), so both always agree.
 *
 * Every default here is an EXAMPLE ASSUMPTION for planning, not a partner's actual terms.
 */

export type CollabModelId = "consignment" | "counter" | "workshop" | "wholesale";

export const COLLAB_MODEL_INFO: Record<CollabModelId, { label: string; summary: string; requirements: string[]; risks: string[]; simplicity: number }> = {
  consignment: {
    label: "Consignment shelf",
    summary: "You supply products; the partner displays and sells them and keeps a commission on each sale.",
    requirements: ["A small display or shelf space", "A written list of stock left with the partner", "Regular restocking and settlement"],
    risks: ["Sales depend on the partner's staff and placement", "Unsold or damaged stock may come back to you", "Payment usually comes after sales, not upfront"],
    simplicity: 80,
  },
  counter: {
    label: "Weekend counter",
    summary: "You run a small table or counter inside or outside the partner's premises for a fee or revenue share.",
    requirements: ["Your own time at the counter", "Display and payment setup", "The partner's written permission and agreed hours"],
    risks: ["You pay a fee even on a slow day", "Your sales depend on the partner's visitor flow at that time"],
    simplicity: 60,
  },
  workshop: {
    label: "Co-hosted workshop",
    summary: "You and the partner run a paid session together in their space and split the ticket revenue.",
    requirements: ["A session plan you have practised", "Materials for every seat", "Advance sign-ups"],
    risks: ["Low sign-ups make a session uneconomic", "Needs confidence in teaching or hosting"],
    simplicity: 50,
  },
  wholesale: {
    label: "Wholesale supply",
    summary: "The partner buys your products at an agreed wholesale price and resells them.",
    requirements: ["Consistent quality across batches", "An agreed price list and order schedule", "Invoices"],
    risks: ["Lower margin per unit", "Orders may stop if their customers do not respond"],
    simplicity: 70,
  },
};

export interface CollabAssumptions {
  /** Partner's commission on consignment sales, percent. */
  commissionPct: number;
  /** Discount off your retail price when selling wholesale, percent. */
  wholesaleDiscountPct: number;
  /** Partner's share of workshop ticket revenue, percent. */
  workshopVenueSharePct: number;
  /** Fee per day for a weekend counter. */
  counterFeePerDayInr: number;
  /** Expected units sold per day (consignment and counter). */
  unitsPerDay: number;
  /** Units per week in a wholesale order. */
  wholesaleUnitsPerWeek: number;
  /** Your retail price per unit. */
  unitPriceInr: number;
  /** Workshop seats filled per session. */
  seatsPerSession: number;
}

export interface CollabInputs {
  model: CollabModelId;
  weekends: number;
  budgetInr: number;
  unitCostInr: number;
  packagingPerUnitInr: number;
  /** Stock to carry relative to expected sales. */
  stockMultiplier: number;
  /** One-off non-reusable setup (signage, display) for a counter. */
  counterSetupInr: number;
  /** Small display or labels for a shelf. */
  shelfSetupInr: number;
  logisticsPerTripInr: number;
  licenceInr: number;
  workshop?: { priceInr: number; costPerSeatInr: number };
  assumptions: CollabAssumptions;
}

export interface CollabCostLine {
  item: string;
  amountInr: number;
  note?: string;
}

export interface CollabResult {
  model: CollabModelId;
  label: string;
  units: number;
  stockUnits: number;
  costs: CollabCostLine[];
  /** Money you need before the first sale. */
  upfrontInr: number;
  grossRevenueInr: number;
  /** Commission, fees or ticket share paid to the partner (fees are also in costs). */
  partnerShareInr: number;
  /** What you receive after the partner's share. */
  netRevenueInr: number;
  profitInr: number;
  /** Units needed to cover every cost, or undefined when each unit loses money. */
  breakevenUnits: number | undefined;
  budgetUsedPct: number;
}

const DAYS_PER_WEEKEND = 2;
const r = (n: number) => Math.round(n);

export function computeCollab(i: CollabInputs): CollabResult {
  const a = i.assumptions;
  const days = i.weekends * DAYS_PER_WEEKEND;
  const costs: CollabCostLine[] = [];
  let units = 0;
  let stockUnits = 0;
  let pricePerUnit = a.unitPriceInr;
  let variablePerUnit = i.unitCostInr + i.packagingPerUnitInr;
  let partnerShareInr = 0;
  let fixed = 0;

  if (i.model === "consignment") {
    units = r(a.unitsPerDay * days);
    stockUnits = Math.ceil(units * i.stockMultiplier);
    const share = a.commissionPct / 100;
    pricePerUnit = a.unitPriceInr * (1 - share);
    costs.push({ item: `Stock: ${stockUnits} units`, amountInr: r(stockUnits * i.unitCostInr) });
    costs.push({ item: "Packaging and labels", amountInr: r(stockUnits * i.packagingPerUnitInr) });
    costs.push({ item: "Shelf display and price cards", amountInr: r(i.shelfSetupInr) });
    costs.push({ item: `Delivery trips (${i.weekends})`, amountInr: r(i.logisticsPerTripInr * i.weekends), note: "One restock trip per weekend" });
    fixed = i.shelfSetupInr + i.logisticsPerTripInr * i.weekends;
    partnerShareInr = r(units * a.unitPriceInr * share);
  } else if (i.model === "counter") {
    units = r(a.unitsPerDay * days);
    stockUnits = Math.ceil(units * i.stockMultiplier);
    const fees = a.counterFeePerDayInr * days;
    costs.push({ item: `Counter fee (${days} days)`, amountInr: r(fees), note: `${a.counterFeePerDayInr} per day, to be agreed` });
    costs.push({ item: `Stock: ${stockUnits} units`, amountInr: r(stockUnits * i.unitCostInr) });
    costs.push({ item: "Packaging and labels", amountInr: r(stockUnits * i.packagingPerUnitInr) });
    costs.push({ item: "Table display and signage", amountInr: r(i.counterSetupInr) });
    costs.push({ item: `Transport (${days} days)`, amountInr: r(i.logisticsPerTripInr * days) });
    fixed = fees + i.counterSetupInr + i.logisticsPerTripInr * days;
    partnerShareInr = r(fees);
  } else if (i.model === "workshop") {
    const ws = i.workshop ?? { priceInr: a.unitPriceInr, costPerSeatInr: i.unitCostInr };
    units = r(a.seatsPerSession * i.weekends);
    stockUnits = units + 2;
    const share = a.workshopVenueSharePct / 100;
    pricePerUnit = ws.priceInr * (1 - share);
    variablePerUnit = ws.costPerSeatInr;
    costs.push({ item: `Materials for ${stockUnits} seats`, amountInr: r(stockUnits * ws.costPerSeatInr), note: "Includes two spare kits" });
    costs.push({ item: "Sample pieces and signage", amountInr: r(i.counterSetupInr) });
    costs.push({ item: `Transport (${i.weekends} sessions)`, amountInr: r(i.logisticsPerTripInr * i.weekends) });
    fixed = i.counterSetupInr + i.logisticsPerTripInr * i.weekends + 2 * ws.costPerSeatInr;
    partnerShareInr = r(units * ws.priceInr * share);
  } else {
    units = r(a.wholesaleUnitsPerWeek * i.weekends);
    stockUnits = units;
    pricePerUnit = a.unitPriceInr * (1 - a.wholesaleDiscountPct / 100);
    costs.push({ item: `Stock: ${stockUnits} units`, amountInr: r(stockUnits * i.unitCostInr) });
    costs.push({ item: "Packaging and labels", amountInr: r(stockUnits * i.packagingPerUnitInr) });
    costs.push({ item: `Delivery trips (${i.weekends})`, amountInr: r(i.logisticsPerTripInr * i.weekends) });
    fixed = i.logisticsPerTripInr * i.weekends;
    partnerShareInr = 0;
  }

  if (i.licenceInr > 0) {
    costs.push({ item: "Licence or registration", amountInr: r(i.licenceInr), note: "Your own registration; a partner's licence does not cover you" });
    fixed += i.licenceInr;
  }

  const upfrontInr = costs.reduce((s, c) => s + c.amountInr, 0);
  const grossRevenueInr = i.model === "workshop" ? r(units * (i.workshop?.priceInr ?? a.unitPriceInr)) : r(units * a.unitPriceInr);
  const netRevenueInr = r(units * pricePerUnit);
  const marginPerUnit = pricePerUnit - variablePerUnit;
  const breakevenUnits = marginPerUnit > 0 ? Math.ceil(fixed / marginPerUnit) : undefined;

  return {
    model: i.model,
    label: COLLAB_MODEL_INFO[i.model].label,
    units,
    stockUnits,
    costs,
    upfrontInr,
    grossRevenueInr,
    partnerShareInr,
    netRevenueInr,
    profitInr: netRevenueInr - upfrontInr,
    breakevenUnits,
    budgetUsedPct: i.budgetInr > 0 ? Math.round((upfrontInr / i.budgetInr) * 100) : 0,
  };
}
