export interface ResourceTransfer {
  id: string;
  from_province_id: string;
  to_province_id: string;
  resource_type: string;
  amount: number;
  departure_time: number;
  arrival_time: number;
  status: "in_transit" | "delivered";
}