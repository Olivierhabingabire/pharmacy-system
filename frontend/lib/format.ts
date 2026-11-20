export const money = (value: string | number) =>
  Number(value).toLocaleString("en-US");

export const compact = (value: number) =>
  new Intl.NumberFormat("en", { notation: "compact" }).format(value);