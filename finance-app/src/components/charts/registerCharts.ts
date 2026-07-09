import { Chart, ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from "chart.js";

let registered = false;
export function ensureChartsRegistered() {
  if (registered) return;
  Chart.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend);
  registered = true;
}
