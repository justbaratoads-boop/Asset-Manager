import { useState, useEffect } from "react";
import { customFetch } from "@workspace/api-client-react";

export type StockAvailInfo = {
  physicalStock: number;
  unbatchedStock: number;
  reservedQty: number;
  availableStock: number;
  unbatchedAvailable: number;
};

export function useStockAvailability(): Record<number, StockAvailInfo> {
  const [stockAvail, setStockAvail] = useState<Record<number, StockAvailInfo>>({});

  useEffect(() => {
    customFetch<any[]>("/api/stock-availability")
      .then(data => {
        const map: Record<number, StockAvailInfo> = {};
        for (const item of data) {
          map[item.id] = {
            physicalStock: item.physicalStock,
            unbatchedStock: item.unbatchedStock ?? item.physicalStock,
            reservedQty: item.reservedQty,
            availableStock: item.availableStock,
            unbatchedAvailable: item.unbatchedAvailable ?? item.availableStock,
          };
        }
        setStockAvail(map);
      })
      .catch(() => {});
  }, []);

  return stockAvail;
}
