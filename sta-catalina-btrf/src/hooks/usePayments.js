import { useState, useEffect, useCallback } from "react";
import api from "../services/api";

export default function usePayments(ownerId) {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/payments", {
        params: ownerId ? { ownerId } : {},
      });
      setPayments(res.data.payments);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load receipts");
    } finally {
      setLoading(false);
    }
  }, [ownerId]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  return { payments, loading, error, refetch: fetchPayments };
}