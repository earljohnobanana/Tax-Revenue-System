import { useState, useEffect, useCallback } from "react";
import api from "../services/api";

export default function useBusinesses() {
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchBusinesses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/businesses");
      setBusinesses(res.data.businesses);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load businesses");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBusinesses();
  }, [fetchBusinesses]);

  return { businesses, loading, error, refetch: fetchBusinesses };
}