import { useState, useEffect } from "react";
import { customFetch } from "@workspace/api-client-react";

export type StockAvailInfo = {
  physicalStock: number;
  reservedQty: number;
  availableStock: number;
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
            reservedQty: item.reservedQty,
            availableStock: item.availableStock,
          };
        }
        setStockAvail(map);
      })
      .catch(() => {});
  }, []);

  return stockAvail;
}
