/** The two columns every foreign query carries: the code the URL uses and the name the page shows. */
export interface CountryNameRow {
  country: string;
  country_name: string | null;
}

/** The country's name as Gold spells it, or its code when the name is missing. */
export function countryName(row: CountryNameRow): string {
  return row.country_name?.trim() || row.country;
}
