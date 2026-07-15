import { useState, useEffect, useCallback } from "react";
import api from "../services/api";

export default function useRegulatoryFees() {
  const [fees, setFees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchFees = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/regulatory-fees");
      setFees(res.data.fees);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load regulatory fees");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFees();
  }, [fetchFees]);

  return { fees, loading, error, refetch: fetchFees };
}