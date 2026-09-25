// src/types/data-models.ts - Placeholder state management models

/**
 * Represents the state of the weather.
 */
export interface WeatherState {
  city: string;
  temperature: number; // Celsius
  condition: 'Sunny' | 'Cloudy' | 'Rainy' | 'Unknown';
  lastUpdated: Date;
}

/**
 * Represents the price details for a CEDEAR stock.
 */
export interface CedearQuote {
  ticker: string;
  price: number;
  change: number;
  changePercent: number;
  timestamp: Date;
}

/**
 * Represents the exchange rate state (e.g., ARS vs USD).
 */
export interface RateState {
  baseCurrency: string;
  quoteCurrency: string;
  rate: number;
  source: 'Official' | 'Blue'; // To specify which rate is used
  lastUpdated: Date;
}

/**
 * Combines all major global state components.
 */
export interface GlobalState {
  weather: WeatherState;
  cedearQuotes: CedearQuote[];
  exchangeRate: RateState;
  lastSync: Date;
}